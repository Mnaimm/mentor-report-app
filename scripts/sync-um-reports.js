#!/usr/bin/env node
// scripts/sync-um-reports.js
// Syncs Upward Mobility reports from Google Sheets UM tab to Supabase

// Load environment variables from .env.local (Next.js convention) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient, logDiscrepancy } = require('./lib/supabase-client');
const { mapUMRow } = require('./lib/field-mappers');

// Configuration
const SPREADSHEET_ID = process.env.UPWARD_MOBILITY_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
const SHEET_NAME = process.env.UM_SHEET_NAME || 'UM';
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

/**
 * Get value from row by column index, trying multiple possible header variations
 * Google Forms adds trailing periods, newlines, and long descriptions to headers
 * @param {Object} row - Sheet row object
 * @param {number} index - Column index (0-based)
 * @param {Array<string>} possibleNames - Array of possible column names to try
 * @returns {any} Column value or undefined
 */
function getColumnValue(row, index, possibleNames = []) {
  // Try direct index access first
  if (row[index] !== undefined) {
    return row[index];
  }

  // Try each possible name
  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return row[name];
    }

    // Try with trailing period
    if (row[name + '.'] !== undefined) {
      return row[name + '.'];
    }
  }

  // Fallback: search for partial match (for long headers with descriptions)
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const partialMatch = keys.find(k => k.startsWith(name));
    if (partialMatch && row[partialMatch] !== undefined) {
      return row[partialMatch];
    }
  }

  return undefined;
}

/**
 * Normalize string for matching (lowercase, trim)
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Resolve entrepreneur ID by name
 */
async function resolveEntrepreneurId(supabase, entrepreneurName) {
  if (!entrepreneurName || !entrepreneurName.trim()) {
    return { id: null, error: 'Missing entrepreneur name' };
  }

  try {
    // Try exact match first (case-insensitive)
    const { data, error } = await supabase
      .from('entrepreneurs')
      .select('id, name')
      .ilike('name', entrepreneurName.trim())
      .limit(1);

    if (error) {
      return { id: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { id: data[0].id, error: null };
    }

    // If no exact match, try partial match
    const { data: partialData, error: partialError } = await supabase
      .from('entrepreneurs')
      .select('id, name')
      .or(`name.ilike.%${entrepreneurName.trim()}%`)
      .limit(1);

    if (partialError) {
      return { id: null, error: partialError.message };
    }

    if (partialData && partialData.length > 0) {
      return { id: partialData[0].id, error: null };
    }

    return { id: null, error: `Entrepreneur not found: ${entrepreneurName}` };
  } catch (err) {
    return { id: null, error: err.message };
  }
}

/**
 * Resolve mentor ID by email
 */
async function resolveMentorId(supabase, mentorEmail) {
  if (!mentorEmail || !mentorEmail.trim()) {
    return { id: null, error: 'Missing mentor email' };
  }

  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('id, email')
      .ilike('email', mentorEmail.trim())
      .limit(1);

    if (error) {
      return { id: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { id: data[0].id, error: null };
    }

    return { id: null, error: `Mentor not found: ${mentorEmail}` };
  } catch (err) {
    return { id: null, error: err.message };
  }
}

/**
 * Resolve entities for UM report (entrepreneur + mentor)
 */
async function resolveUMEntities(supabase, row) {
  const errors = [];
  const entities = {
    entrepreneur_id: null,
    mentor_id: null
  };

  // Resolve entrepreneur from Column G (index 6)
  const entrepreneurName = row[6];
  const entrepreneurResult = await resolveEntrepreneurId(supabase, entrepreneurName);
  if (entrepreneurResult.error) {
    errors.push(`Entrepreneur: ${entrepreneurResult.error}`);
  } else {
    entities.entrepreneur_id = entrepreneurResult.id;
  }

  // Resolve mentor from Column B (index 1)
  const mentorEmail = row[1];
  const mentorResult = await resolveMentorId(supabase, mentorEmail);
  if (mentorResult.error) {
    errors.push(`Mentor: ${mentorResult.error}`);
  } else {
    entities.mentor_id = mentorResult.id;
  }

  const success = errors.length === 0 && entities.entrepreneur_id && entities.mentor_id;
  return { success, entities, errors };
}

/**
 * Check if UM report already exists (by entrepreneur + sesi_mentoring)
 */
async function findExistingUMReport(supabase, entrepreneurId, sesiMentoring) {
  const { data, error } = await supabase
    .from('upward_mobility_reports')
    .select('id')
    .eq('entrepreneur_id', entrepreneurId)
    .eq('sesi_mentoring', sesiMentoring)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Insert UM report (or update if duplicate found)
 */
async function insertUMReport(supabase, reportData) {
  try {
    // Check for existing report by entrepreneur + sesi
    const existing = await findExistingUMReport(
      supabase,
      reportData.entrepreneur_id,
      reportData.sesi_mentoring
    );

    if (existing) {
      // Update existing report
      const { data, error } = await supabase
        .from('upward_mobility_reports')
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
        .from('upward_mobility_reports')
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
async function syncUMReports() {
  console.log('\n🚀 Starting Upward Mobility Reports Sync...\n');

  if (!SPREADSHEET_ID) {
    console.error('❌ UPWARD_MOBILITY_SPREADSHEET_ID or GOOGLE_SHEETS_REPORT_ID environment variable not set');
    process.exit(1);
  }

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: Processing first ${TEST_LIMIT} rows only\n`);
  }

  const stats = {
    total: 0,
    inserted: 0,
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

    // Fetch data from UM sheet
    console.log(`📥 Fetching data from "${SHEET_NAME}" tab...`);
    let rows = await getRows(SPREADSHEET_ID, SHEET_NAME, 'A:AR');

    if (rows.length === 0) {
      console.log('⚠️  No data found in UM sheet');
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
      const timestamp = getColumnValue(row, 0, ['Timestamp']);
      const mentorEmail = getColumnValue(row, 1, ['Email Address']);
      const entrepreneurName = getColumnValue(row, 6, ['Nama Penuh Usahawan']);
      const sesiMentoring = getColumnValue(row, 4, ['Sesi Mentoring']);

      // Skip rows without required data
      if (!timestamp || !mentorEmail || !entrepreneurName) {
        stats.skipped++;
        console.log(`   ⏭️  Skipped (missing required data)`);
        continue;
      }

      console.log(`   👤 ${entrepreneurName}`);
      console.log(`   👨‍🏫 ${mentorEmail}`);
      console.log(`   📝 ${sesiMentoring || 'N/A'}`);

      // Build row array for mapUMRow (44 columns A-AR)
      // Note: Google Forms adds trailing periods, newlines, and long descriptions to headers
      const rowArray = [
        getColumnValue(row, 0, ['Timestamp']),                                      // A
        getColumnValue(row, 1, ['Email Address']),                                  // B
        getColumnValue(row, 2, ['Program']),                                        // C
        getColumnValue(row, 3, ['Batch']),                                          // D
        getColumnValue(row, 4, ['Sesi Mentoring']),                                 // E
        getColumnValue(row, 5, ['Nama Mentor']),                                    // F
        getColumnValue(row, 6, ['Nama Penuh Usahawan']),                           // G
        getColumnValue(row, 7, ['Nama Penuh Perniagaan']),                         // H
        getColumnValue(row, 8, ['Jenis Perniagaan']),                              // I
        getColumnValue(row, 9, ['Alamat Perniagaan']),                             // J
        getColumnValue(row, 10, ['Nombor Telefon']),                               // K
        getColumnValue(row, 11, ['Status Penglibatan']),                           // L
        getColumnValue(row, 12, ['Upward Mobility Status']),                       // M
        getColumnValue(row, 13, ['Jika G1 atau G2 atau G3', 'Kriteria Improvement']), // N
        getColumnValue(row, 14, ['Tarikh lawatan ke premis']),                     // O
        getColumnValue(row, 15, ['1. Penggunaan Akaun Semasa', 'Penggunaan Akaun Semasa']), // P
        getColumnValue(row, 16, ['2. Penggunaan BIMB Biz', 'Penggunaan BIMB Biz']), // Q
        getColumnValue(row, 17, ['3. Buka akaun Al-Awfar', 'Buka akaun Al-Awfar']), // R
        getColumnValue(row, 18, ['4. Penggunaan BIMB Merchant', 'Penggunaan BIMB Merchant']), // S
        getColumnValue(row, 19, ['5. Lain-lain Fasiliti', 'Lain-lain Fasiliti']), // T
        getColumnValue(row, 20, ['6. Melanggan aplikasi MesinKira', 'Langgan aplikasi MesinKira']), // U
        getColumnValue(row, 21, ['Jumlah Pendapatan (Sebelum)']),                  // V
        getColumnValue(row, 22, ['Jumlah Pendapatan (Selepas)']),                  // W
        getColumnValue(row, 23, ['Ulasan Mentor (Jumlah Pendapatan)']),            // X
        getColumnValue(row, 24, ['Peluang Pekerjaan (Sebelum)']),                  // Y
        getColumnValue(row, 25, ['Peluang Pekerjaan (Selepas)']),                  // Z
        getColumnValue(row, 26, ['Ulasan Mentor (Peluang Pekerjaan)']),            // AA
        getColumnValue(row, 27, ['Nilai Aset Bukan Tunai (Sebelum)']),             // AB
        getColumnValue(row, 28, ['Nilai Aset Bukan Tunai (Selepas)']),             // AC
        getColumnValue(row, 29, ['Nilai Aset Bentuk Tunai (Sebelum)']),            // AD
        getColumnValue(row, 30, ['Nilai Aset Bentuk Tunai (Selepas)']),            // AE
        getColumnValue(row, 31, ['Ulasan Mentor (Nilai Aset)']),                   // AF
        getColumnValue(row, 32, ['Simpanan Perniagaan', 'Simpanan Perniagaan (Savings). (Sebelum)']), // AG
        getColumnValue(row, 33, ['Simpanan Perniagaan', 'Simpanan Perniagaan (Savings). (Selepas)']), // AH
        getColumnValue(row, 34, ['Ulasan Mentor (Simpanan)']),                     // AI
        getColumnValue(row, 35, ['Pembayaran Zakat Perniagaan', 'Pembayaran Zakat Perniagaan. (Sebelum)']), // AJ
        getColumnValue(row, 36, ['Pembayaran Zakat Perniagaan', 'Pembayaran Zakat Perniagaan. (Selepas)']), // AK
        getColumnValue(row, 37, ['Ulasan Mentor (Pembayaran Zakat']),              // AL
        getColumnValue(row, 38, ['Penggunaan Digital', 'Penggunaan Digital (Digitalization) - Sebelum']), // AM
        getColumnValue(row, 39, ['Penggunaan Digital', 'Penggunaan Digital (Digitalization) - Selepas']), // AN
        getColumnValue(row, 40, ['Ulasan Mentor (Penggunaan Digital)']),           // AO
        getColumnValue(row, 41, ['Jualan dan Pemasaran Dalam Talian', 'Jualan dan Pemasaran Dalam Talian (Online Sales/Marketing) - Sebelum']), // AP
        getColumnValue(row, 42, ['Jualan dan Pemasaran Dalam Talian', 'Jualan dan Pemasaran Dalam Talian (Online Sales/Marketing) - Selepas']), // AQ
        getColumnValue(row, 43, ['Ulasan Mentor (Jualan dan Pemasaran'])           // AR
      ];

      // Resolve FK entities
      const resolution = await resolveUMEntities(supabase, rowArray);

      if (!resolution.success) {
        stats.errors++;
        const errorMsg = `Row ${rowNumber}: ${resolution.errors.join(', ')}`;
        errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);

        // Log to discrepancies
        await logDiscrepancy(supabase, {
          operation_type: 'sync',
          table_name: 'upward_mobility_reports',
          record_id: `row_${rowNumber}`,
          program: 'UM',
          user_email: 'system@sync',
          sheets_success: true,
          supabase_success: false,
          supabase_error: resolution.errors.join('; ')
        });

        continue;
      }

      console.log(`   ✅ Resolved entities (entrepreneur: ${resolution.entities.entrepreneur_id})`);

      // Map row data to UM report object
      const reportData = mapUMRow(rowArray, rowNumber, resolution.entities);

      // Insert report
      const result = await insertUMReport(supabase, reportData);

      if (result.success) {
        if (result.isNew) {
          stats.inserted++;
          console.log(`   ✅ Inserted new UM report`);
        } else {
          stats.updated++;
          console.log(`   ✅ Updated existing UM report`);
        }
      } else {
        stats.errors++;
        const errorMsg = `Row ${rowNumber}: Failed to insert UM report: ${result.error.message}`;
        errors.push(errorMsg);
        console.log(`   ❌ ${errorMsg}`);

        // Log to discrepancies
        await logDiscrepancy(supabase, {
          operation_type: 'sync',
          table_name: 'upward_mobility_reports',
          record_id: `entrepreneur_${reportData.entrepreneur_id}_${reportData.sesi_mentoring}`,
          program: 'UM',
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
    console.log('📝 UM Reports:');
    console.log(`   • Inserted: ${stats.inserted}`);
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
    if (stats.errors === 0) {
      console.log(`✅ UM sync complete: ${stats.total} total rows, ${stats.inserted} inserted, ${stats.updated} updated`);
    } else {
      const totalSuccess = stats.inserted + stats.updated;
      console.log(`⚠️  UM sync complete with errors: ${totalSuccess} successful, ${stats.errors} errors`);
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncUMReports()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { syncUMReports };
