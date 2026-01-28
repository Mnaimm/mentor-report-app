#!/usr/bin/env node
// scripts/sync-docurl.js
// Backfills missing doc_url values from Google Sheets to Supabase

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient } = require('./lib/supabase-client');

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const MAJU_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || SPREADSHEET_ID;
const LIVE_MODE = process.argv.includes('--live');

// Statistics
const stats = {
  bangkit: {
    total: 0,
    missing: 0,
    found: 0,
    updated: 0
  },
  maju: {
    total: 0,
    missing: 0,
    found: 0,
    updated: 0
  }
};

const updatesPlanned = [];

/**
 * Print section header
 */
function printSection(title) {
  console.log('\n' + '━'.repeat(60));
  console.log(`  ${title}`);
  console.log('━'.repeat(60));
}

/**
 * Sync Bangkit doc URLs from Column BB (DOC_URL)
 */
async function syncBangkitDocURLs(supabase, getRows) {
  printSection('📊 BANGKIT (V8 Sheet → Column BB)');

  try {
    // Get all Bangkit reports missing doc_url
    const { data: missingReports, error: queryError } = await supabase
      .from('reports')
      .select('id, sheets_row_number, nama_usahawan')
      .eq('program', 'Bangkit')
      .is('doc_url', null)
      .not('sheets_row_number', 'is', null);

    if (queryError) throw queryError;

    // Get total Bangkit reports
    const { count: totalCount, error: countError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Bangkit');

    if (countError) throw countError;

    stats.bangkit.total = totalCount || 0;
    stats.bangkit.missing = missingReports?.length || 0;

    console.log(`Total reports in DB: ${stats.bangkit.total}`);
    console.log(`Missing doc_url: ${stats.bangkit.missing}`);

    if (stats.bangkit.missing === 0) {
      console.log('✅ All Bangkit reports have doc_url');
      return;
    }

    // Fetch V8 sheet data (Column BB is index 53)
    console.log('\n📥 Fetching V8 sheet data...');
    const rows = await getRows(SPREADSHEET_ID, 'Bangkit', 'A:BB');

    // Process each missing report
    console.log('\n🔍 Checking for doc URLs in sheet...');

    for (const report of missingReports) {
      const sheetRow = rows.find(r => r._rowNumber === report.sheets_row_number);

      if (!sheetRow) {
        console.log(`   ⚠️  Row ${report.sheets_row_number}: Not found in sheet`);
        continue;
      }

      const docUrl = sheetRow.DOC_URL || sheetRow['DOC_URL'];

      if (docUrl && docUrl.trim()) {
        stats.bangkit.found++;

        const update = {
          program: 'Bangkit',
          reportId: report.id,
          rowNumber: report.sheets_row_number,
          entrepreneur: report.nama_usahawan,
          docUrl: docUrl.trim()
        };

        updatesPlanned.push(update);

        if (LIVE_MODE) {
          // Actually update the database
          const { error: updateError } = await supabase
            .from('reports')
            .update({ doc_url: docUrl.trim(), updated_at: new Date().toISOString() })
            .eq('id', report.id);

          if (updateError) {
            console.log(`   ❌ Row ${report.sheets_row_number}: Update failed - ${updateError.message}`);
          } else {
            stats.bangkit.updated++;
            console.log(`   ✅ Row ${report.sheets_row_number}: Updated (${report.nama_usahawan})`);
          }
        } else {
          console.log(`   [DRY RUN] Would update Row ${report.sheets_row_number}: ${report.nama_usahawan}`);
          console.log(`             URL: ${docUrl.substring(0, 60)}...`);
        }
      }
    }

    if (stats.bangkit.found === 0) {
      console.log('   ℹ️  No doc URLs found in sheet for missing reports');
    }

  } catch (error) {
    console.error('❌ Error syncing Bangkit doc URLs:', error.message);
  }
}

/**
 * Sync Maju doc URLs from Column AA (Laporan_Maju_Doc_ID)
 */
async function syncMajuDocURLs(supabase, getRows) {
  printSection('📊 MAJU (LaporanMajuUM → Column AA)');

  try {
    // Get all Maju reports missing doc_url
    const { data: missingReports, error: queryError } = await supabase
      .from('reports')
      .select('id, sheets_row_number, nama_mentee')
      .eq('program', 'Maju')
      .is('doc_url', null)
      .not('sheets_row_number', 'is', null);

    if (queryError) throw queryError;

    // Get total Maju reports
    const { count: totalCount, error: countError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Maju');

    if (countError) throw countError;

    stats.maju.total = totalCount || 0;
    stats.maju.missing = missingReports?.length || 0;

    console.log(`Total reports in DB: ${stats.maju.total}`);
    console.log(`Missing doc_url: ${stats.maju.missing}`);

    if (stats.maju.missing === 0) {
      console.log('✅ All Maju reports have doc_url');
      return;
    }

    // Fetch LaporanMajuUM sheet data (Column AA is index 26)
    console.log('\n📥 Fetching LaporanMajuUM sheet data...');
    const rows = await getRows(MAJU_SPREADSHEET_ID, 'LaporanMajuUM', 'A:AA');

    // Process each missing report
    console.log('\n🔍 Checking for doc URLs in sheet...');

    for (const report of missingReports) {
      const sheetRow = rows.find(r => r._rowNumber === report.sheets_row_number);

      if (!sheetRow) {
        console.log(`   ⚠️  Row ${report.sheets_row_number}: Not found in sheet`);
        continue;
      }

      const docUrl = sheetRow.Laporan_Maju_Doc_ID || sheetRow['Laporan_Maju_Doc_ID'];

      if (docUrl && docUrl.trim()) {
        stats.maju.found++;

        const update = {
          program: 'Maju',
          reportId: report.id,
          rowNumber: report.sheets_row_number,
          entrepreneur: report.nama_mentee,
          docUrl: docUrl.trim()
        };

        updatesPlanned.push(update);

        if (LIVE_MODE) {
          // Actually update the database
          const { error: updateError } = await supabase
            .from('reports')
            .update({ doc_url: docUrl.trim(), updated_at: new Date().toISOString() })
            .eq('id', report.id);

          if (updateError) {
            console.log(`   ❌ Row ${report.sheets_row_number}: Update failed - ${updateError.message}`);
          } else {
            stats.maju.updated++;
            console.log(`   ✅ Row ${report.sheets_row_number}: Updated (${report.nama_mentee})`);
          }
        } else {
          console.log(`   [DRY RUN] Would update Row ${report.sheets_row_number}: ${report.nama_mentee}`);
          console.log(`             URL: ${docUrl.substring(0, 60)}...`);
        }
      }
    }

    if (stats.maju.found === 0) {
      console.log('   ℹ️  No doc URLs found in sheet for missing reports');
    }

  } catch (error) {
    console.error('❌ Error syncing Maju doc URLs:', error.message);
  }
}

/**
 * Print summary
 */
function printSummary() {
  printSection('📋 SUMMARY');

  const totalMissing = stats.bangkit.missing + stats.maju.missing;
  const totalFound = stats.bangkit.found + stats.maju.found;
  const totalUpdated = stats.bangkit.updated + stats.maju.updated;

  console.log(`\nBangkit:`);
  console.log(`  • Total reports: ${stats.bangkit.total}`);
  console.log(`  • Missing doc_url: ${stats.bangkit.missing}`);
  console.log(`  • Found in sheet: ${stats.bangkit.found}`);
  if (LIVE_MODE) {
    console.log(`  • Updated: ${stats.bangkit.updated}`);
  }

  console.log(`\nMaju:`);
  console.log(`  • Total reports: ${stats.maju.total}`);
  console.log(`  • Missing doc_url: ${stats.maju.missing}`);
  console.log(`  • Found in sheet: ${stats.maju.found}`);
  if (LIVE_MODE) {
    console.log(`  • Updated: ${stats.maju.updated}`);
  }

  console.log('\n' + '━'.repeat(60));

  if (LIVE_MODE) {
    if (totalUpdated > 0) {
      console.log(`✅ Successfully updated ${totalUpdated} report(s)`);
    } else if (totalMissing > 0 && totalFound === 0) {
      console.log(`⚠️  No doc URLs found in sheets (Apps Script may not have run yet)`);
    } else {
      console.log(`✅ All reports already have doc URLs`);
    }
  } else {
    if (totalFound > 0) {
      console.log(`📊 Would update ${totalFound} report(s)`);
      console.log(`\n💡 Run with --live flag to actually update:`);
      console.log(`   npm run sync:docurl -- --live`);
    } else if (totalMissing > 0) {
      console.log(`ℹ️  ${totalMissing} report(s) missing doc_url, but none found in sheets yet`);
      console.log(`   (Apps Script may still be generating docs)`);
    } else {
      console.log(`✅ All reports already have doc URLs - nothing to update`);
    }
  }

  console.log('━'.repeat(60) + '\n');
}

/**
 * Main function
 */
async function syncDocURLs() {
  console.log('\n🔗 Doc URL Backfill Sync\n');

  if (LIVE_MODE) {
    console.log('⚡ LIVE MODE - Will update database');
  } else {
    console.log('🧪 DRY RUN MODE (use --live to actually update)');
  }

  if (!SPREADSHEET_ID) {
    console.error('\n❌ GOOGLE_SHEETS_REPORT_ID environment variable not set');
    process.exit(1);
  }

  try {
    // Initialize clients
    console.log('\n📊 Connecting to Google Sheets...');
    const { getRows } = await createSheetsClient();

    console.log('🗄️  Connecting to Supabase...');
    const supabase = createSupabaseClient();

    // Sync Bangkit doc URLs
    await syncBangkitDocURLs(supabase, getRows);

    // Sync Maju doc URLs
    await syncMajuDocURLs(supabase, getRows);

    // Print summary
    printSummary();

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
if (require.main === module) {
  syncDocURLs()
    .then(() => {
      // Handled by printSummary
    })
    .catch(err => {
      console.error('❌ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { syncDocURLs };
