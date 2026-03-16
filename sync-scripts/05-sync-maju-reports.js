// 05-sync-maju-reports.js
// Syncs LaporanMajuUM.json (28 rows) to reports + upward_mobility_reports tables

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

// Helper: Safe JSON parse
function safeJSONParse(jsonString, defaultValue = null) {
  if (!jsonString) return defaultValue;

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`   ⚠️  JSON parse error:`, error.message);
    return defaultValue;
  }
}

// Helper: Format time string or Date ISO string to HH:MM:SS
function formatTime(val) {
  if (!val) return null;
  // If it's a full ISO string (e.g. 1899-12-30T09:04:35.000Z)
  if (typeof val === 'string' && val.includes('T')) {
    const timePart = val.split('T')[1]; // 09:04:35.000Z
    if (timePart) {
      return timePart.split('.')[0]; // 09:04:35
    }
  }
  return val;
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
    program: 'MAJU',
    batch: row.Batch || null,
    sesi_mentoring: row.SESI_NUMBER ? `Sesi ${row.SESI_NUMBER}` : null,
    jenis_perniagaan: row.JENIS_PERNIAGAAN || null,
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

async function syncMajuReports() {
  console.log('\n=== 05-sync-maju-reports.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/LaporanMajuUM.json (28 rows)');
  console.log('Output: sessions + reports + upward_mobility_reports tables\n');

  const dataPath = path.join(process.cwd(), 'sync-data', 'LaporanMajuUM.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from LaporanMajuUM.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorEmail = row.EMAIL_MENTOR;
      const entrepreneurName = row.NAMA_MENTEE;
      const sessionDate = row.TARIKH_SESI;
      const sessionNumber = row.SESI_NUMBER || 1;

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
        .eq('program', 'Maju')
        .limit(1)
        .maybeSingle();

      if (reportCheckError) throw reportCheckError;

      // Parse JSON fields
      const dataKewangan = safeJSONParse(row.DATA_KEWANGAN_BULANAN_JSON, []);
      const mentoringFindings = safeJSONParse(row.MENTORING_FINDINGS_JSON, []);
      const imageUrlsSesi = safeJSONParse(row.URL_GAMBAR_SESI_JSON, []);
      const imageUrlsPremis = safeJSONParse(row.URL_GAMBAR_PREMIS_JSON, []);

      // === 1. Create or Update report ===
      const reportData = {
        mentor_id: mentorId,
        entrepreneur_id: entrepreneurId,
        program: 'Maju',
        session_number: sessionNumber,
        session_date: sessionDate || null,
        mod_sesi: row.MOD_SESI || null,
        lokasi_f2f: row.LOKASI_F2F || null,
        masa_mula: formatTime(row.MASA_MULA), // Use formatTime
        masa_tamat: formatTime(row.MASA_TAMAT), // Use formatTime
        nama_usahawan: entrepreneurName,
        nama_syarikat: row.NAMA_BISNES || null,
        lokasi_bisnes: row.LOKASI_BISNES || null,
        produk_servis: row.PRODUK_SERVIS || null,
        no_telefon: row.NO_TELEFON || null,
        data_kewangan_bulanan: dataKewangan,
        mentoring_findings: mentoringFindings,
        latarbelakang_usahawan: row.LATARBELAKANG_USAHAWAN || null,
        // status_perniagaan_keseluruhan: row.STATUS_PERNIAGAAN_KESELURUHAN || null, // Column does not exist
        rumusan: row.RUMUSAN_DAN_LANGKAH_KEHADAPAN || null,
        refleksi: {
          perasaan: row.REFLEKSI_MENTOR_PERASAAN || null,
          komitmen: row.REFLEKSI_MENTOR_KOMITMEN || null,
          lain: row.REFLEKSI_MENTOR_LAIN || null
        },
        image_urls: {
          sesi: imageUrlsSesi,
          premis: imageUrlsPremis,
          gw360: row.URL_GAMBAR_GW360 || null
        },
        mia_status: row.MIA_STATUS || 'Selesai',
        mia_reason: row.MIA_REASON || null,
        mia_proof_url: row.MIA_PROOF_URL || null,
        folder_id: row.Mentee_Folder_ID || null,
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
  // console.log('Sessions:');
  // console.log(`  ✅ Created: ${results.sessions.success}`);
  // console.log(`  ⏭️  Skipped: ${results.sessions.skipped}`);
  // console.log(`  ❌ Failed: ${results.sessions.failed}`);
  console.log('\nReports:');
  console.log(`  ✅ Created: ${results.reports.success}`);
  console.log(`  ⏭️  Skipped: ${results.reports.skipped}`);
  console.log(`  ❌ Failed: ${results.reports.failed}`);
  console.log('\nUM Reports:');
  console.log(`  ✅ Created: ${results.um_reports.success}`);
  console.log(`  ⏭️  Skipped: ${results.um_reports.skipped}`);
  console.log(`  ❌ Failed: ${results.um_reports.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-05.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncMajuReports()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncMajuReports;
