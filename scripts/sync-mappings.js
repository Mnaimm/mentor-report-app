#!/usr/bin/env node
// scripts/sync-mappings.js
// Syncs entrepreneur and mentor data from Google Sheets mapping tab to Supabase

// Load environment variables from .env.local (Next.js convention) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env if .env.local doesn't exist

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient, upsertRecord, logDiscrepancy } = require('./lib/supabase-client');

// Configuration
const MAPPING_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_MAPPING_ID;
const MAPPING_TAB_NAME = 'mapping';
const TEST_MODE = process.argv.includes('--test');
const TEST_LIMIT = 10;

/**
 * Map Google Sheets row to entrepreneur record
 */
function mapToEntrepreneur(row) {
  // Extract zone from Zon field
  const zone = row.Zon || '';

  // Determine program from Batch field
  let program = 'Bangkit'; // Default
  if (row.Batch) {
    if (row.Batch.toLowerCase().includes('maju')) {
      program = 'Maju';
    } else if (row.Batch.toLowerCase().includes('bangkit')) {
      program = 'Bangkit';
    }
  }

  return {
    name: row.Mentee || '',
    business_name: row['Nama Syarikat'] || '',
    email: (row.EMAIL || '').toLowerCase().trim(),
    phone: row['no Telefon'] || '',
    batch: row.Batch || '',
    folder_id: row.Folder_ID || '',
    program: program,
    zone: zone,
    business_type: row['JENIS BISNES'] || '',
    status: 'active',
    updated_at: new Date().toISOString()
    // Note: 'address' field doesn't exist in DB, ignoring row['Alamat ']
    // Note: region, state, district, cohort, notes not in mapping sheet
  };
}

/**
 * Map Google Sheets row to mentor record
 */
function mapToMentor(row) {
  // Determine program from Batch
  let program = 'Bangkit'; // Default
  if (row.Batch) {
    if (row.Batch.toLowerCase().includes('maju')) {
      program = 'Maju';
    } else if (row.Batch.toLowerCase().includes('bangkit')) {
      program = 'Bangkit';
    }
  }

  return {
    name: row.Mentor || '',
    email: (row.Mentor_Email || '').toLowerCase().trim(),
    phone: row['no Telefon'] || '', // Use entrepreneur's phone for now
    program: program,
    region: null, // region is enum in DB - leave as null for now
    status: 'active',
    updated_at: new Date().toISOString()
    // Note: Zon field doesn't map cleanly to region enum
  };
}

/**
 * Validate that row has required fields
 */
function isValidRow(row, type = 'entrepreneur') {
  if (type === 'entrepreneur') {
    return row.Mentee && row.EMAIL && row.EMAIL.trim() !== '';
  } else if (type === 'mentor') {
    return row.Mentor && row.Mentor_Email && row.Mentor_Email.trim() !== '';
  }
  return false;
}

/**
 * Main sync function
 */
async function syncMappings() {
  console.log('\n🚀 Starting Mapping Sync...\n');

  if (!MAPPING_SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SHEETS_MAPPING_ID environment variable not set');
    process.exit(1);
  }

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE: Processing first ${TEST_LIMIT} rows only\n`);
  }

  const stats = {
    entrepreneurs: { new: 0, updated: 0, errors: 0, skipped: 0 },
    mentors: { new: 0, updated: 0, errors: 0, skipped: 0 },
    totalRows: 0
  };

  const errors = [];

  try {
    // Initialize clients
    console.log('📊 Connecting to Google Sheets...');
    const { getRows } = await createSheetsClient();

    console.log('🗄️  Connecting to Supabase...');
    const supabase = createSupabaseClient();

    // Fetch mapping data
    console.log(`📥 Fetching data from "${MAPPING_TAB_NAME}" tab...`);
    let rows = await getRows(MAPPING_SPREADSHEET_ID, MAPPING_TAB_NAME, 'A:K');

    if (rows.length === 0) {
      console.log('⚠️  No data found in mapping sheet');
      return;
    }

    stats.totalRows = rows.length;
    console.log(`✅ Found ${rows.length} rows\n`);

    // Apply test mode limit
    if (TEST_MODE) {
      rows = rows.slice(0, TEST_LIMIT);
    }

    // Track unique mentors (by email) to avoid duplicate processing
    const processedMentors = new Set();

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = row._rowNumber;

      console.log(`\n--- Processing Row ${rowNum} (${i + 1}/${rows.length}) ---`);

      // === PROCESS ENTREPRENEUR ===
      if (isValidRow(row, 'entrepreneur')) {
        const entrepreneur = mapToEntrepreneur(row);

        console.log(`👤 Entrepreneur: ${entrepreneur.name} (${entrepreneur.email})`);

        const result = await upsertRecord(
          supabase,
          'entrepreneurs',
          entrepreneur,
          ['email']
        );

        if (result.success) {
          if (result.isNew) {
            stats.entrepreneurs.new++;
            console.log(`   ✅ Created new entrepreneur`);
          } else {
            stats.entrepreneurs.updated++;
            console.log(`   ✅ Updated existing entrepreneur`);
          }
        } else {
          stats.entrepreneurs.errors++;
          const errorMsg = `Row ${rowNum}: Failed to upsert entrepreneur ${entrepreneur.email}: ${result.error.message}`;
          errors.push(errorMsg);
          console.log(`   ❌ ${errorMsg}`);

          // Log to discrepancies
          await logDiscrepancy(supabase, {
            operation_type: 'sync',
            table_name: 'entrepreneurs',
            record_id: entrepreneur.email,
            program: entrepreneur.program,
            user_email: 'system@sync',
            sheets_success: true,
            supabase_success: false,
            supabase_error: result.error.message
          });
        }
      } else {
        stats.entrepreneurs.skipped++;
        console.log(`   ⏭️  Skipped entrepreneur (missing email or name)`);
      }

      // === PROCESS MENTOR ===
      if (isValidRow(row, 'mentor')) {
        const mentor = mapToMentor(row);
        const mentorEmail = mentor.email;

        // Skip if we've already processed this mentor
        if (processedMentors.has(mentorEmail)) {
          console.log(`👨‍🏫 Mentor: ${mentor.name} (${mentorEmail}) - Already processed`);
        } else {
          console.log(`👨‍🏫 Mentor: ${mentor.name} (${mentorEmail})`);

          const result = await upsertRecord(
            supabase,
            'mentors',
            mentor,
            ['email']
          );

          if (result.success) {
            processedMentors.add(mentorEmail);

            if (result.isNew) {
              stats.mentors.new++;
              console.log(`   ✅ Created new mentor`);
            } else {
              stats.mentors.updated++;
              console.log(`   ✅ Updated existing mentor`);
            }
          } else {
            stats.mentors.errors++;
            const errorMsg = `Row ${rowNum}: Failed to upsert mentor ${mentor.email}: ${result.error.message}`;
            errors.push(errorMsg);
            console.log(`   ❌ ${errorMsg}`);

            // Log to discrepancies
            await logDiscrepancy(supabase, {
              operation_type: 'sync',
              table_name: 'mentors',
              record_id: mentor.email,
              program: mentor.program,
              user_email: 'system@sync',
              sheets_success: true,
              supabase_success: false,
              supabase_error: result.error.message
            });
          }
        }
      } else {
        stats.mentors.skipped++;
        console.log(`   ⏭️  Skipped mentor (missing email or name)`);
      }
    }

    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed: ${TEST_MODE ? TEST_LIMIT : stats.totalRows}`);
    console.log('');
    console.log('👤 Entrepreneurs:');
    console.log(`   • New: ${stats.entrepreneurs.new}`);
    console.log(`   • Updated: ${stats.entrepreneurs.updated}`);
    console.log(`   • Errors: ${stats.entrepreneurs.errors}`);
    console.log(`   • Skipped: ${stats.entrepreneurs.skipped}`);
    console.log('');
    console.log('👨‍🏫 Mentors:');
    console.log(`   • New: ${stats.mentors.new}`);
    console.log(`   • Updated: ${stats.mentors.updated}`);
    console.log(`   • Errors: ${stats.mentors.errors}`);
    console.log(`   • Skipped: ${stats.mentors.skipped}`);
    console.log('');
    console.log(`   • Unique mentors: ${processedMentors.size}`);
    console.log('');

    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.forEach(err => console.log(`   - ${err}`));
      console.log('');
    }

    // Success message
    const totalSuccess = stats.entrepreneurs.new + stats.entrepreneurs.updated +
                        stats.mentors.new + stats.mentors.updated;
    const totalErrors = stats.entrepreneurs.errors + stats.mentors.errors;

    if (totalErrors === 0) {
      console.log(`✅ Sync complete: ${stats.entrepreneurs.new + stats.entrepreneurs.updated} entrepreneurs (${stats.entrepreneurs.new} new, ${stats.entrepreneurs.updated} updated), ${stats.mentors.new + stats.mentors.updated} mentors (${stats.mentors.new} new, ${stats.mentors.updated} updated)`);
    } else {
      console.log(`⚠️  Sync complete with errors: ${totalSuccess} successful, ${totalErrors} errors`);
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncMappings()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { syncMappings };
