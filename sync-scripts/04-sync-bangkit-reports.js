// 04-sync-bangkit-reports.js
// Syncs bangkit.json (105 rows) to reports + upward_mobility_reports tables

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false';

const results = {
  reports: { success: 0, skipped: 0, failed: 0 },
  um_reports: { success: 0, skipped: 0, failed: 0 },
  errors: []
};

const mentorCache = new Map();
const entrepreneurCache = new Map();

// Helper: Get mentor ID by email
async function getMentorId(email) {
  if (!email) return null;

  const key = email.toLowerCase();
  if (mentorCache.has(key)) return mentorCache.get(key);

  const { data, error } = await supabase
    .from('mentors')
    .select('id')
    .eq('email', key)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(`   ⚠️  Mentor not found: ${email}`);
    return null;
  }

  mentorCache.set(key, data.id);
  return data.id;
}

// Helper: Get entrepreneur ID by name
async function getEntrepreneurId(name) {
  if (!name) return null;

  const key = name.toLowerCase();
  if (entrepreneurCache.has(key)) return entrepreneurCache.get(key);

  const { data, error } = await supabase
    .from('entrepreneurs')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(`   ⚠️  Entrepreneur not found: ${name}`);
    return null;
  }

  entrepreneurCache.set(key, data.id);
  return data.id;
}

// Helper: Parse session number from "Sesi #1" format
function parseSessionNumber(sesiLaporan) {
  if (!sesiLaporan) return 1;
  const match = sesiLaporan.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

// Helper: Build mentoring findings JSONB from Fokus Area 1-4 columns
function buildMentoringFindings(row) {
  const findings = [];

  for (let i = 1; i <= 4; i++) {
    const fokusArea = row[`Fokus Area ${i}`];
    const keputusan = row[`Keputusan ${i}`];
    const tindakan = row[`Cadangan Tindakan ${i}`];

    if (fokusArea || keputusan || tindakan) {
      findings.push({
        'Fokus Area': fokusArea || '',
        'Keputusan': keputusan || '',
        'Cadangan Tindakan': tindakan || ''
      });
    }
  }

  return findings.length > 0 ? findings : null;
}

// Helper: Build jualan_terkini JSONB from Jualan Jan-Dis columns
function buildJualanTerkini(row) {
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
  const jualan = [];

  for (const month of months) {
    const value = row[`Jualan ${month}`];
    if (value !== undefined && value !== null && value !== '') {
      jualan.push({
        month: month,
        sales: parseFloat(value) || 0
      });
    }
  }

  return jualan.length > 0 ? jualan : null;
}

// Helper: Build GW scores JSONB from GW_Skor_1-20 columns
function buildGWScores(row) {
  const scores = [];

  for (let i = 1; i <= 20; i++) {
    const score = row[`GW_Skor_${i}`];
    if (score !== undefined && score !== null && score !== '') {
      scores.push(parseFloat(score) || 0);
    }
  }

  return scores.length > 0 ? scores : null;
}

// Helper: Build refleksi JSONB
function buildRefleksi(row) {
  const refleksi = {};

  if (row.Refleksi_Perasaan) refleksi.perasaan = row.Refleksi_Perasaan;
  if (row.Refleksi_Komitmen) refleksi.komitmen = row.Refleksi_Komitmen;
  if (row.Refleksi_Lain) refleksi.lain = row.Refleksi_Lain;

  return Object.keys(refleksi).length > 0 ? refleksi : null;
}

// Helper: Check if UM data exists
function hasUMData(row) {
  return !!(row.UM_STATUS_PENGLIBATAN || row.UM_PENDAPATAN_SEMASA || row.UM_PEKERJA_SEMASA);
}

// Helper: Build UM report data
function buildUMReport(row, mentorId, entrepreneurId) {
  if (!hasUMData(row)) return null;

  return {
    mentor_id: mentorId,
    entrepreneur_id: entrepreneurId,
    program: 'BANGKIT',
    batch: row.Batch || null,
    sesi_mentoring: row['Sesi Laporan'] || null,
    jenis_perniagaan: row.Jenis_Perniagaan || null,
    status_penglibatan: row.UM_STATUS_PENGLIBATAN || null,
    upward_mobility_status: row.UM_UPWARD_MOBILITY_STATUS || null,
    pendapatan_sebelum: row.UM_PENDAPATAN_SEBELUM ? parseFloat(row.UM_PENDAPATAN_SEBELUM) : null,
    pendapatan_selepas: row.UM_PENDAPATAN_SELEPAS ? parseFloat(row.UM_PENDAPATAN_SELEPAS) : null,
    pendapatan_semasa: row.UM_PENDAPATAN_SEMASA ? parseFloat(row.UM_PENDAPATAN_SEMASA) : null,
    pekerjaan_sebelum: row.UM_PEKERJAAN_SEBELUM ? parseInt(row.UM_PEKERJAAN_SEBELUM) : null,
    pekerjaan_selepas: row.UM_PEKERJAAN_SELEPAS ? parseInt(row.UM_PEKERJAAN_SELEPAS) : null,
    pekerja_semasa: row.UM_PEKERJA_SEMASA ? parseInt(row.UM_PEKERJA_SEMASA) : null,
    // pembiayaan_sebelum: row.UM_PEMBIAYAAN_SEBELUM || null,
    // pembiayaan_selepas: row.UM_PEMBIAYAAN_SELEPAS || null,
    // ulasan_pekerja: row.UM_ULASAN_PEKERJA || null,
    // ulasan_pekerjaan: row.UM_ULASAN_PEKERJAAN || null
  };
}

async function syncBangkitReports() {
  console.log('\n=== 04-sync-bangkit-reports.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/bangkit.json (105 rows)');
  console.log('Output: reports + upward_mobility_reports tables\n');

  const dataPath = path.join(process.cwd(), 'sync-data', 'bangkit.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from bangkit.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorEmail = row.Emai || row.Email || row.email;
      const entrepreneurName = row['Nama Usahawan'];
      const sessionDate = row['Tarikh Sesi'];
      const sessionNumber = parseSessionNumber(row['Sesi Laporan']);

      if (!entrepreneurName) {
        throw new Error('Missing entrepreneur name');
      }

      console.log(`[${rowNum}/${data.length}] Processing: ${entrepreneurName} - Session ${sessionNumber}`);

      // Get IDs
      const mentorId = await getMentorId(mentorEmail);
      const entrepreneurId = await getEntrepreneurId(entrepreneurName);

      if (!mentorId || !entrepreneurId) {
        throw new Error(`Missing mentor or entrepreneur ID`);
      }

      // Check if report already exists
      const { data: existingReport, error: reportCheckError } = await supabase
        .from('reports')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('entrepreneur_id', entrepreneurId)
        .eq('session_number', sessionNumber)
        .eq('program', 'Bangkit')
        .limit(1)
        .maybeSingle();

      if (reportCheckError) throw reportCheckError;

      // === 1. Create or Update report ===
      const reportData = {
        mentor_id: mentorId,
        entrepreneur_id: entrepreneurId,
        program: 'Bangkit',
        session_number: sessionNumber,
        session_date: sessionDate || null, // Added session_date
        nama_usahawan: entrepreneurName,
        nama_syarikat: row['Nama Bisnes'] || null,
        mentoring_findings: buildMentoringFindings(row),
        jualan_terkini: buildJualanTerkini(row),
        gw_skor: buildGWScores(row),
        refleksi: buildRefleksi(row),
        rumusan: row.Ringkasan || null,
        pemerhatian: row.Pemerhatian || null,
        premis_dilawat: row.Premis_Dilawat === 'true' || row.Premis_Dilawat === true,
        mia_status: row['Status Sesi'] || 'Selesai',
        source: 'google_sheets_sync'
      };

      if (!DRY_RUN) {
        if (existingReport) {
          // Update existing
          const { error: reportUpdateError } = await supabase
            .from('reports')
            .update(reportData)
            .eq('id', existingReport.id);

          if (reportUpdateError) throw reportUpdateError;
          results.reports.success++;
          console.log(`   ✅ Updated existing report`);
        } else {
          // Insert new
          const { error: reportInsertError } = await supabase
            .from('reports')
            .insert(reportData);

          if (reportInsertError) throw reportInsertError;
          results.reports.success++;
          console.log(`   ✅ Created report`);
        }
      } else if (DRY_RUN) {
        results.reports.success++;
        console.log(`   🔍 [DRY] Would ${existingReport ? 'update' : 'create'} report`);
      }

      // === 3. Create UM report if data exists ===
      if (hasUMData(row)) {
        const umData = buildUMReport(row, mentorId, entrepreneurId);

        if (umData && !DRY_RUN) {
          const { error: umInsertError } = await supabase
            .from('upward_mobility_reports')
            .insert(umData);

          if (umInsertError) throw umInsertError;
          results.um_reports.success++;
          console.log(`   ✅ Created UM report`);
        } else if (DRY_RUN && umData) {
          results.um_reports.success++;
          console.log(`   🔍 [DRY] Would create UM report`);
        }
      }

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.reports.failed++;
      results.errors.push({
        row: rowNum,
        data: row,
        error: error.message
      });
      console.error(`[${rowNum}/${data.length}] ❌ Error:`, error.message);
    }
  }

  // === Summary ===
  console.log('\n=== RESULTS ===');
  console.log('Reports:');
  console.log(`  ✅ Created: ${results.reports.success}`);
  console.log(`  ⏭️  Skipped: ${results.reports.skipped}`);
  console.log(`  ❌ Failed: ${results.reports.failed}`);
  console.log('\nUM Reports:');
  console.log(`  ✅ Created: ${results.um_reports.success}`);
  console.log(`  ⏭️  Skipped: ${results.um_reports.skipped}`);
  console.log(`  ❌ Failed: ${results.um_reports.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-04.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncBangkitReports()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncBangkitReports;
