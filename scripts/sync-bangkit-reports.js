#!/usr/bin/env node
// scripts/sync-bangkit-reports.js
// Syncs Bangkit session reports from Google Sheets V8 tab to Supabase

// Load environment variables from .env.local (Next.js convention) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient, logDiscrepancy } = require('./lib/supabase-client');
const { parseSessionNumber, mapBangkitRow } = require('./lib/field-mappers');
const { resolveAllEntities } = require('./lib/entity-resolver');

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const SHEET_NAME = 'V8';
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

/**
 * Check if report already exists
 */
async function findExistingReport(supabase, program, sheetsRowNumber) {
  const { data, error } = await supabase
    .from('reports')
    .select('id')
    .eq('program', program)
    .eq('sheets_row_number', sheetsRowNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Upsert report (update if exists by sheets_row_number, insert if new)
 */
async function upsertReport(supabase, reportData) {
  try {
    // Check if report exists
    const existing = await findExistingReport(
      supabase,
      reportData.program,
      reportData.sheets_row_number
    );

    if (existing) {
      // Update existing report
      const { data, error } = await supabase
        .from('reports')
        .update(reportData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return { success: false, data: null, error, isNew: false };
      }

      return { success: true, data, error: null, isNew: false };
    } else {
      // Insert new report
      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single();

      if (error) {
        return { success: false, data: null, error, isNew: true };
      }

      return { success: true, data, error: null, isNew: true };
    }
  } catch (err) {
    return { success: false, data: null, error: err, isNew: false };
  }
}

/**
 * Main sync function
 */
async function syncBangkitReports() {
  console.log('\n🚀 Starting Bangkit Reports Sync...\n');

  if (!SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SHEETS_REPORT_ID environment variable not set');
    process.exit(1);
  }

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: Processing first ${TEST_LIMIT} rows only\n`);
  }

  const stats = {
    total: 0,
    new: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    newSessions: 0
  };

  const errors = [];

  try {
    // Initialize clients
    console.log('📊 Connecting to Google Sheets...');
    const { getRows } = await createSheetsClient();

    console.log('🗄️  Connecting to Supabase...');
    const supabase = createSupabaseClient();

    // Fetch data from V8 sheet
    console.log(`📥 Fetching data from "${SHEET_NAME}" tab...`);
    let rows = await getRows(SPREADSHEET_ID, SHEET_NAME, 'A:CZ');

    if (rows.length === 0) {
      console.log('⚠️  No data found in V8 sheet');
      return;
    }

    stats.total = rows.length;
    console.log(`✅ Found ${rows.length} rows\n`);

    // Apply test mode limit
    if (TEST_MODE) {
      rows = rows.slice(0, TEST_LIMIT);
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = row._rowNumber;

      console.log(`\n--- Processing Row ${rowNumber} (${i + 1}/${rows.length}) ---`);

      // Extract key info for display
      const entrepreneurName = row.Timestamp ? row['Nama Usahawan'] : null;
      const mentorEmail = row.Timestamp ? row['Emai'] : null;
      const sessionStr = row.Timestamp ? row['Sesi Laporan'] : null;

      // Skip rows without timestamp (likely empty)
      if (!row.Timestamp || !entrepreneurName || !mentorEmail) {
        stats.skipped++;
        console.log(`   ⏭️  Skipped (missing required data)`);
        continue;
      }

      const sessionNumber = parseSessionNumber(sessionStr);
      console.log(`   👤 ${entrepreneurName}`);
      console.log(`   👨‍🏫 ${mentorEmail}`);
      console.log(`   📝 Session ${sessionNumber || '?'}`);

      // Resolve FK entities
      const resolution = await resolveAllEntities(supabase, [
        row.Timestamp,
        row['Emai'],
        row['Status Sesi'],
        row['Sesi Laporan'],
        row['Tarikh Sesi'],
        row['Masa Sesi'],
        row['Mod Sesi'],
        row['Nama Usahawan'],
        row['Nama Bisnes'],
        row['Nama Mentor'],
        row['Update Keputusan Terdahulu 1'],
        row['Ringkasan Sesi'],
        row['Fokus Area 1'],
        row['Keputusan 1'],
        row['Cadangan Tindakan 1'],
        row['Fokus Area 2'],
        row['Keputusan 2'],
        row['Cadangan Tindakan 2'],
        row['Fokus Area 3'],
        row['Keputusan 3'],
        row['Cadangan Tindakan 3'],
        row['Fokus Area 4'],
        row['Keputusan 4'],
        row['Cadangan Tindakan 4'],
        row['Jualan Jan'],
        row['Jualan Feb'],
        row['Jualan Mac'],
        row['Jualan Apr'],
        row['Jualan Mei'],
        row['Jualan Jun'],
        row['Jualan Jul'],
        row['Jualan Ogos'],
        row['Jualan Sep'],
        row['Jualan Okt'],
        row['Jualan Nov'],
        row['Jualan Dis'],
        row['Link Gambar'],
        row['Produk/Servis'],
        row['Pautan Media Sosial'],
        row['Link_Carta_GrowthWheel'],
        row['Link_Bukti_MIA'],
        row['Panduan_Pemerhatian_Mentor'],
        row['Refleksi_Perasaan'],
        row['Refleksi_Skor'],
        row['Refleksi_Alasan_Skor'],
        row['Refleksi_Eliminate'],
        row['Refleksi_Raise'],
        row['Refleksi_Reduce'],
        row['Refleksi_Create'],
        row['Link_Gambar_Profil'],
        row['Link_Gambar_Premis'],
        row['Premis_Dilawat_Checked'],
        row['Status'],
        row['DOC_URL'],
        row['GW_Skor_1'],
        row['GW_Skor_2'],
        row['GW_Skor_3'],
        // Add more GW scores if they exist
        ...Object.keys(row)
          .filter(k => k.startsWith('GW_Skor_'))
          .slice(3, 20)
          .map(k => row[k])
      ], sessionNumber);

      if (!resolution.success) {
        stats.errors++;
        const errorMsg = `Row ${rowNumber}: ${resolution.errors.join(', ')}`;
        errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);

        // Log to discrepancies
        await logDiscrepancy(supabase, {
          operation_type: 'sync',
          table_name: 'reports',
          record_id: `row_${rowNumber}`,
          program: 'Bangkit',
          user_email: 'system@sync',
          sheets_success: true,
          supabase_success: false,
          supabase_error: resolution.errors.join('; ')
        });

        continue;
      }

      console.log(`   ✅ Resolved entities (session: ${resolution.entities.session_id})`);

      // Map row data to report object
      const rowArray = [
        row.Timestamp,
        row['Emai'],
        row['Status Sesi'],
        row['Sesi Laporan'],
        row['Tarikh Sesi'],
        row['Masa Sesi'],
        row['Mod Sesi'],
        row['Nama Usahawan'],
        row['Nama Bisnes'],
        row['Nama Mentor'],
        row['Update Keputusan Terdahulu 1'],
        row['Ringkasan Sesi'],
        row['Fokus Area 1'],
        row['Keputusan 1'],
        row['Cadangan Tindakan 1'],
        row['Fokus Area 2'],
        row['Keputusan 2'],
        row['Cadangan Tindakan 2'],
        row['Fokus Area 3'],
        row['Keputusan 3'],
        row['Cadangan Tindakan 3'],
        row['Fokus Area 4'],
        row['Keputusan 4'],
        row['Cadangan Tindakan 4'],
        row['Jualan Jan'],
        row['Jualan Feb'],
        row['Jualan Mac'],
        row['Jualan Apr'],
        row['Jualan Mei'],
        row['Jualan Jun'],
        row['Jualan Jul'],
        row['Jualan Ogos'],
        row['Jualan Sep'],
        row['Jualan Okt'],
        row['Jualan Nov'],
        row['Jualan Dis'],
        row['Link Gambar'],
        row['Produk/Servis'],
        row['Pautan Media Sosial'],
        row['Link_Carta_GrowthWheel'],
        row['Link_Bukti_MIA'],
        row['Panduan_Pemerhatian_Mentor'],
        row['Refleksi_Perasaan'],
        row['Refleksi_Skor'],
        row['Refleksi_Alasan_Skor'],
        row['Refleksi_Eliminate'],
        row['Refleksi_Raise'],
        row['Refleksi_Reduce'],
        row['Refleksi_Create'],
        row['Link_Gambar_Profil'],
        row['Link_Gambar_Premis'],
        row['Premis_Dilawat_Checked'],
        row['Status'],
        row['DOC_URL'],
        row['GW_Skor_1'],
        row['GW_Skor_2'],
        row['GW_Skor_3'],
        ...Object.keys(row)
          .filter(k => k.startsWith('GW_Skor_'))
          .slice(3, 20)
          .map(k => row[k])
      ];

      const reportData = mapBangkitRow(rowArray, rowNumber, resolution.entities);

      // Upsert report
      const result = await upsertReport(supabase, reportData);

      if (result.success) {
        if (result.isNew) {
          stats.new++;
          console.log(`   ✅ Created new report`);
        } else {
          stats.updated++;
          console.log(`   ✅ Updated existing report`);
        }
      } else {
        stats.errors++;
        const errorMsg = `Row ${rowNumber}: Failed to upsert report: ${result.error.message}`;
        errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);

        // Log to discrepancies
        await logDiscrepancy(supabase, {
          operation_type: 'sync',
          table_name: 'reports',
          record_id: reportData.session_id || `row_${rowNumber}`,
          program: 'Bangkit',
          user_email: 'system@sync',
          sheets_success: true,
          supabase_success: false,
          supabase_error: result.error.message
        });
      }
    }

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed: ${TEST_MODE ? TEST_LIMIT : stats.total}`);
    console.log('');
    console.log('📝 Reports:');
    console.log(`   • New: ${stats.new}`);
    console.log(`   • Updated: ${stats.updated}`);
    console.log(`   • Skipped: ${stats.skipped}`);
    console.log(`   • Errors: ${stats.errors}`);
    console.log('');

    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
      console.log('');
    }

    // Success message
    const totalSuccess = stats.new + stats.updated;
    if (stats.errors === 0) {
      console.log(`✅ Bangkit sync complete: ${stats.total} total rows, ${stats.new} new reports, ${stats.updated} updated reports`);
    } else {
      console.log(`⚠️  Bangkit sync complete with errors: ${totalSuccess} successful, ${stats.errors} errors`);
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncBangkitReports()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { syncBangkitReports };
