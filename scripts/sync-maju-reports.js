#!/usr/bin/env node
// scripts/sync-maju-reports.js
// Syncs Maju session reports from Google Sheets LaporanMaju tab to Supabase

// Load environment variables from .env.local (Next.js convention) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient, logDiscrepancy } = require('./lib/supabase-client');
const { mapMajuRow } = require('./lib/field-mappers');
const { resolveAllEntities } = require('./lib/entity-resolver');

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
const SHEET_NAME = 'LaporanMaju';
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
async function syncMajuReports() {
  console.log('\n🚀 Starting Maju Reports Sync...\n');

  if (!SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SHEETS_MAJU_REPORT_ID or GOOGLE_SHEETS_REPORT_ID environment variable not set');
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
    errors: 0
  };

  const errors = [];

  try {
    // Initialize clients
    console.log('📊 Connecting to Google Sheets...');
    const { getRows } = await createSheetsClient();

    console.log('🗄️  Connecting to Supabase...');
    const supabase = createSupabaseClient();

    // Fetch data from LaporanMaju sheet
    console.log(`📥 Fetching data from "${SHEET_NAME}" tab...`);
    let rows = await getRows(SPREADSHEET_ID, SHEET_NAME, 'A:AD');

    if (rows.length === 0) {
      console.log('⚠️  No data found in LaporanMaju sheet');
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
      const entrepreneurName = row.Timestamp ? row['NAMA_MENTEE'] : null;
      const mentorEmail = row.Timestamp ? row['EMAIL_MENTOR'] : null;
      const sessionNumber = row.Timestamp ? row['SESI_NUMBER'] : null;

      // Skip rows without timestamp (likely empty)
      if (!row.Timestamp || !entrepreneurName || !mentorEmail) {
        stats.skipped++;
        console.log(`   ⏭️  Skipped (missing required data)`);
        continue;
      }

      console.log(`   👤 ${entrepreneurName}`);
      console.log(`   👨‍🏫 ${mentorEmail}`);
      console.log(`   📝 Session ${sessionNumber || '?'}`);

      // Convert row object to array for entity resolution
      // LaporanMaju columns: 0-29 (30 columns)
      const rowArray = [
        row.Timestamp,              // 0
        row['NAMA_MENTOR'],         // 1
        row['EMAIL_MENTOR'],        // 2
        row['NAMA_MENTEE'],         // 3
        row['NAMA_BISNES'],         // 4
        row['LOKASI_BISNES'],       // 5
        row['PRODUK_SERVIS'],       // 6
        row['NO_TELEFON'],          // 7
        row['TARIKH_SESI'],         // 8
        row['SESI_NUMBER'],         // 9
        row['MOD_SESI'],            // 10
        row['LOKASI_F2F'],          // 11
        row['MASA_MULA'],           // 12
        row['MASA_TAMAT'],          // 13
        row['LATARBELAKANG_USAHAWAN'], // 14
        row['DATA_KEWANGAN_BULANAN_JSON'], // 15
        row['MENTORING_FINDINGS_JSON'], // 16
        row['REFLEKSI_MENTOR_PERASAAN'], // 17
        row['REFLEKSI_MENTOR_KOMITMEN'], // 18
        row['REFLEKSI_MENTOR_LAIN'], // 19
        row['STATUS_PERNIAGAAN_KESELURUHAN'], // 20
        row['RUMUSAN_DAN_LANGKAH_KEHADAPAN'], // 21
        row['URL_GAMBAR_PREMIS_JSON'], // 22
        row['URL_GAMBAR_SESI_JSON'], // 23
        row['URL_GAMBAR_GW360'],    // 24
        row['Mentee_Folder_ID'],    // 25
        row['Laporan_Maju_Doc_ID'], // 26
        row['MIA_STATUS'],          // 27
        row['MIA_REASON'],          // 28
        row['MIA_PROOF_URL']        // 29
      ];

      // For entity resolution, we need entrepreneur name in column 3 (NAMA_MENTEE)
      // and mentor email in column 2 (EMAIL_MENTOR)
      // The resolveAllEntities function expects specific columns:
      // - row[7] for entrepreneur name (we need to adjust)
      // - row[1] for mentor email (we need to adjust)

      // Create adjusted array for entity resolution (mimic Bangkit structure)
      const entityResolutionArray = [...rowArray];
      // Move NAMA_MENTEE to position 7 (where Bangkit expects entrepreneur name)
      entityResolutionArray[7] = row['NAMA_MENTEE'];
      // Move EMAIL_MENTOR to position 1 (where Bangkit expects mentor email)
      entityResolutionArray[1] = row['EMAIL_MENTOR'];
      // Session date is in position 8 (TARIKH_SESI)
      entityResolutionArray[4] = row['TARIKH_SESI'];

      const parsedSessionNumber = sessionNumber ? parseInt(sessionNumber, 10) : null;

      // Resolve FK entities
      const resolution = await resolveAllEntities(supabase, entityResolutionArray, parsedSessionNumber,'Maju');

      if (!resolution.success) {
        stats.errors++;
        const errorMsg = `Row ${rowNumber}: ${resolution.errors.join(', ')}`;
        errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);

        // Log to discrepancies
        await logDiscrepancy(supabase, {
          operation_type: 'sync',
          table_name: 'reports',
          record_id: `maju_row_${rowNumber}`,
          program: 'Maju',
          user_email: 'system@sync',
          sheets_success: true,
          supabase_success: false,
          supabase_error: resolution.errors.join('; ')
        });

        continue;
      }

      console.log(`   ✅ Resolved entities (session: ${resolution.entities.session_id})`);

      // Map row data to report object
      const reportData = mapMajuRow(rowArray, rowNumber, resolution.entities);

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
          record_id: reportData.session_id || `maju_row_${rowNumber}`,
          program: 'Maju',
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
      console.log(`✅ Maju sync complete: ${stats.total} total rows, ${stats.new} new reports, ${stats.updated} updated reports`);
    } else {
      console.log(`⚠️  Maju sync complete with errors: ${totalSuccess} successful, ${stats.errors} errors`);
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncMajuReports()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { syncMajuReports };
