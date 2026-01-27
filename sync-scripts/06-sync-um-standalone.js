// 06-sync-um-standalone.js
// Syncs um.json (23 rows) to upward_mobility_reports table (standalone UM reports)

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

  const { data, error} = await supabase
    .from('entrepreneurs')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (error || !data) {
    console.warn(`   ⚠️  Entrepreneur not found: ${name}`);
    return null;
  }

  entrepreneurCache.set(key, data.id);
  return data.id;
}

// Helper: Parse array from comma-separated string
function parseArrayField(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;

  try {
    // Handle comma-separated values
    const items = value.toString().split(',').map(item => item.trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

async function syncUMStandalone() {
  console.log('\n=== 06-sync-um-standalone.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/um.json (23 rows)');
  console.log('Output: upward_mobility_reports table (standalone)\n');

  const dataPath = path.join(process.cwd(), 'sync-data', 'um.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from um.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorEmail = row['Email Address'] || row.email_address;
      const entrepreneurName = row['Nama Penuh Usahawan'] || row.nama_penuh_usahawan;
      const program = row.Program || row.program;
      const batch = row.Batch || row.batch;
      const sesiMentoring = row['Sesi Mentoring'] || row.sesi_mentoring;

      if (!entrepreneurName) {
        throw new Error('Missing entrepreneur name');
      }

      console.log(`[${rowNum}/${data.length}] Processing: ${entrepreneurName} - ${sesiMentoring}`);

      // Get IDs
      const mentorId = await getMentorId(mentorEmail);
      const entrepreneurId = await getEntrepreneurId(entrepreneurName);

      if (!mentorId || !entrepreneurId) {
        throw new Error(`Missing mentor or entrepreneur ID`);
      }

      // Check for duplicate (by mentor + entrepreneur + sesi)
      const { data: existingUM, error: checkError } = await supabase
        .from('upward_mobility_reports')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('entrepreneur_id', entrepreneurId)
        .eq('sesi_mentoring', sesiMentoring)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUM) {
        results.um_reports.skipped++;
        console.log(`   ⏭️  UM report already exists`);
        continue;
      }

      // Build UM report
      const umReport = {
        mentor_id: mentorId,
        entrepreneur_id: entrepreneurId,
        program: program?.toUpperCase() || null,
        batch: batch,
        sesi_mentoring: sesiMentoring,
        jenis_perniagaan: row['Jenis Perniagaan'] || row.jenis_perniagaan,
        status_penglibatan: row['Status Penglibatan'] || row.status_penglibatan,
        upward_mobility_status: row['Upward Mobility Status'] || row.upward_mobility_status,

        // Numeric fields - Before/After
        pendapatan_sebelum: row['Jumlah Pendapatan (Sebelum)'] ? parseFloat(row['Jumlah Pendapatan (Sebelum)']) : null,
        pendapatan_selepas: row['Jumlah Pendapatan (Selepas)'] ? parseFloat(row['Jumlah Pendapatan (Selepas)']) : null,
        pekerjaan_sebelum: row['Peluang Pekerjaan (Sebelum)'] ? parseInt(row['Peluang Pekerjaan (Sebelum)']) : null,
        pekerjaan_selepas: row['Peluang Pekerjaan (Selepas)'] ? parseInt(row['Peluang Pekerjaan (Selepas)']) : null,

        // Pembiayaan
        pembiayaan_sebelum: row['Akses Pembiayaan (Sebelum)'] || row.pembiayaan_sebelum,
        pembiayaan_selepas: row['Akses Pembiayaan (Selepas)'] || row.pembiayaan_selepas,
        jumlah_pembiayaan_sebelum: row['Jumlah Pembiayaan (Sebelum)'] ? parseFloat(row['Jumlah Pembiayaan (Sebelum)']) : null,
        jumlah_pembiayaan_selepas: row['Jumlah Pembiayaan (Selepas)'] ? parseFloat(row['Jumlah Pembiayaan (Selepas)']) : null,

        // Formalisasi
        pendaftaran_sebelum: row['Status Pendaftaran (Sebelum)'] || row.pendaftaran_sebelum,
        pendaftaran_selepas: row['Status Pendaftaran (Selepas)'] || row.pendaftaran_selepas,

        // Array fields - Digital usage
        digital_sebelum: parseArrayField(row['Penggunaan Digital (Sebelum)'] || row.digital_sebelum),
        digital_selepas: parseArrayField(row['Penggunaan Digital (Selepas)'] || row.digital_selepas),

        // Array fields - Online sales platforms
        online_sales_sebelum: parseArrayField(row['Jualan Online (Sebelum)'] || row.online_sales_sebelum),
        online_sales_selepas: parseArrayField(row['Jualan Online (Selepas)'] || row.online_sales_selepas),

        // Ulasan/Comments
        ulasan_pekerja: row['Ulasan - Pekerja'] || row.ulasan_pekerja,
        ulasan_pekerjaan: row['Ulasan - Pekerjaan'] || row.ulasan_pekerjaan,
        ulasan_pendapatan: row['Ulasan - Pendapatan'] || row.ulasan_pendapatan,
        ulasan_pembiayaan: row['Ulasan - Pembiayaan'] || row.ulasan_pembiayaan,
        ulasan_formalisasi: row['Ulasan - Formalisasi'] || row.ulasan_formalisasi,
        ulasan_digital: row['Ulasan - Penggunaan Digital'] || row.ulasan_digital,
        ulasan_jualan_online: row['Ulasan - Jualan Online'] || row.ulasan_jualan_online
      };

      // Create UM report
      if (!DRY_RUN) {
        const { error: insertError } = await supabase
          .from('upward_mobility_reports')
          .insert(umReport);

        if (insertError) throw insertError;
        results.um_reports.success++;
        console.log(`   ✅ Created standalone UM report`);
      } else {
        results.um_reports.success++;
        console.log(`   🔍 [DRY] Would create standalone UM report`);
      }

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.um_reports.failed++;
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
  console.log('UM Reports:');
  console.log(`  ✅ Created: ${results.um_reports.success}`);
  console.log(`  ⏭️  Skipped: ${results.um_reports.skipped}`);
  console.log(`  ❌ Failed: ${results.um_reports.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-06.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncUMStandalone()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncUMStandalone;
