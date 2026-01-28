#!/usr/bin/env node
// scripts/validate-sync.js
// Daily validation script to compare Google Sheets vs Supabase data integrity

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback

const { createSheetsClient } = require('./lib/sheets-client');
const { createSupabaseClient } = require('./lib/supabase-client');

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const UM_SPREADSHEET_ID = process.env.UPWARD_MOBILITY_SPREADSHEET_ID || SPREADSHEET_ID;

// Validation statistics
const stats = {
  totalIssues: 0,
  criticalIssues: 0,
  warnings: 0,
  passed: 0
};

const issues = [];
const warnings = [];

/**
 * Add issue to tracking
 */
function addIssue(category, severity, message, details = null) {
  const issue = { category, severity, message, details, timestamp: new Date().toISOString() };

  if (severity === 'CRITICAL') {
    stats.criticalIssues++;
    issues.push(issue);
  } else if (severity === 'WARNING') {
    stats.warnings++;
    warnings.push(issue);
  }

  stats.totalIssues++;
}

/**
 * Print section header
 */
function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

/**
 * Print check result
 */
function printCheck(checkName, passed, message, details = null) {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${checkName}: ${message}`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (passed) stats.passed++;
}

/**
 * CHECK 1: Count Comparison
 */
async function checkCounts(supabase, getRows) {
  printSection('1. COUNT COMPARISON');

  // Bangkit counts
  try {
    const bangkitSheetRows = await getRows(SPREADSHEET_ID, 'Bangkit', 'A:A');
    const bangkitSheetCount = bangkitSheetRows.length;

    const { count: bangkitDbCount, error: bangkitError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Bangkit');

    if (bangkitError) throw bangkitError;

    const bangkitMatch = bangkitSheetCount === bangkitDbCount;
    const bangkitDiff = bangkitDbCount - bangkitSheetCount;

    printCheck(
      'Bangkit Count',
      bangkitMatch,
      `Sheets: ${bangkitSheetCount} | Supabase: ${bangkitDbCount}`,
      bangkitMatch ? null : `Difference: ${bangkitDiff > 0 ? '+' : ''}${bangkitDiff}`
    );

    if (!bangkitMatch) {
      addIssue(
        'Count Mismatch',
        Math.abs(bangkitDiff) > 5 ? 'CRITICAL' : 'WARNING',
        `Bangkit: ${bangkitDiff > 0 ? 'Supabase has more' : 'Sheets has more'} (diff: ${Math.abs(bangkitDiff)})`,
        { sheetsCount: bangkitSheetCount, dbCount: bangkitDbCount }
      );
    }
  } catch (err) {
    printCheck('Bangkit Count', false, `Error: ${err.message}`);
    addIssue('Count Check', 'CRITICAL', 'Failed to check Bangkit counts', { error: err.message });
  }

  // Maju counts
  try {
    const majuSheetRows = await getRows(SPREADSHEET_ID, 'LaporanMajuUM', 'A:A');
    const majuSheetCount = majuSheetRows.length;

    const { count: majuDbCount, error: majuError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Maju');

    if (majuError) throw majuError;

    const majuMatch = majuSheetCount === majuDbCount;
    const majuDiff = majuDbCount - majuSheetCount;

    printCheck(
      'Maju Count',
      majuMatch,
      `Sheets: ${majuSheetCount} | Supabase: ${majuDbCount}`,
      majuMatch ? null : `Difference: ${majuDiff > 0 ? '+' : ''}${majuDiff}`
    );

    if (!majuMatch) {
      addIssue(
        'Count Mismatch',
        Math.abs(majuDiff) > 5 ? 'CRITICAL' : 'WARNING',
        `Maju: ${majuDiff > 0 ? 'Supabase has more' : 'Sheets has more'} (diff: ${Math.abs(majuDiff)})`,
        { sheetsCount: majuSheetCount, dbCount: majuDbCount }
      );
    }
  } catch (err) {
    printCheck('Maju Count', false, `Error: ${err.message}`);
    addIssue('Count Check', 'CRITICAL', 'Failed to check Maju counts', { error: err.message });
  }

  // UM counts
  try {
    const umSheetRows = await getRows(UM_SPREADSHEET_ID, 'UM', 'A:A');
    const umSheetCount = umSheetRows.length;

    const { count: umDbCount, error: umError } = await supabase
      .from('upward_mobility_reports')
      .select('*', { count: 'exact', head: true });

    if (umError) throw umError;

    const umMatch = umSheetCount === umDbCount;
    const umDiff = umDbCount - umSheetCount;

    printCheck(
      'Upward Mobility Count',
      umMatch,
      `Sheets: ${umSheetCount} | Supabase: ${umDbCount}`,
      umMatch ? null : `Difference: ${umDiff > 0 ? '+' : ''}${umDiff}`
    );

    if (!umMatch) {
      addIssue(
        'Count Mismatch',
        Math.abs(umDiff) > 3 ? 'CRITICAL' : 'WARNING',
        `UM: ${umDiff > 0 ? 'Supabase has more' : 'Sheets has more'} (diff: ${Math.abs(umDiff)})`,
        { sheetsCount: umSheetCount, dbCount: umDbCount }
      );
    }
  } catch (err) {
    printCheck('Upward Mobility Count', false, `Error: ${err.message}`);
    addIssue('Count Check', 'CRITICAL', 'Failed to check UM counts', { error: err.message });
  }
}

/**
 * CHECK 2: Recent Submissions (Last 24 hours)
 */
async function checkRecentSubmissions(supabase, getRows) {
  printSection('2. RECENT SUBMISSIONS CHECK (Last 24h)');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Bangkit recent submissions
  try {
    const bangkitSheetRows = await getRows(SPREADSHEET_ID, 'Bangkit', 'A:H');
    // Get last 10 rows (most recent)
    const recentBangkit = bangkitSheetRows.slice(-10);

    let missingInDb = 0;
    const missingRows = [];

    for (const row of recentBangkit) {
      const rowNumber = row._rowNumber;
      const timestamp = row.Timestamp;

      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('program', 'Bangkit')
        .eq('sheets_row_number', rowNumber)
        .maybeSingle();

      if (!data && !error) {
        missingInDb++;
        missingRows.push({ rowNumber, timestamp, entrepreneur: row['Nama Usahawan'] });
      }
    }

    printCheck(
      'Bangkit Recent Submissions',
      missingInDb === 0,
      `Checked last 10 rows: ${missingInDb} missing in Supabase`,
      missingInDb > 0 ? `Missing rows: ${missingRows.map(r => r.rowNumber).join(', ')}` : null
    );

    if (missingInDb > 0) {
      addIssue(
        'Recent Submissions',
        'CRITICAL',
        `Bangkit: ${missingInDb} recent rows not synced to Supabase`,
        { missingRows }
      );
    }
  } catch (err) {
    printCheck('Bangkit Recent Submissions', false, `Error: ${err.message}`);
    addIssue('Recent Submissions', 'WARNING', 'Failed to check Bangkit recent submissions', { error: err.message });
  }

  // Maju recent submissions
  try {
    const majuSheetRows = await getRows(SPREADSHEET_ID, 'LaporanMajuUM', 'A:D');
    const recentMaju = majuSheetRows.slice(-10);

    let missingInDb = 0;
    const missingRows = [];

    for (const row of recentMaju) {
      const rowNumber = row._rowNumber;
      const timestamp = row.Timestamp;

      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('program', 'Maju')
        .eq('sheets_row_number', rowNumber)
        .maybeSingle();

      if (!data && !error) {
        missingInDb++;
        missingRows.push({ rowNumber, timestamp, mentee: row.NAMA_MENTEE });
      }
    }

    printCheck(
      'Maju Recent Submissions',
      missingInDb === 0,
      `Checked last 10 rows: ${missingInDb} missing in Supabase`,
      missingInDb > 0 ? `Missing rows: ${missingRows.map(r => r.rowNumber).join(', ')}` : null
    );

    if (missingInDb > 0) {
      addIssue(
        'Recent Submissions',
        'CRITICAL',
        `Maju: ${missingInDb} recent rows not synced to Supabase`,
        { missingRows }
      );
    }
  } catch (err) {
    printCheck('Maju Recent Submissions', false, `Error: ${err.message}`);
    addIssue('Recent Submissions', 'WARNING', 'Failed to check Maju recent submissions', { error: err.message });
  }

  // UM recent submissions
  try {
    const umSheetRows = await getRows(UM_SPREADSHEET_ID, 'UM', 'A:G');
    const recentUM = umSheetRows.slice(-10);

    let missingInDb = 0;
    const missingRows = [];

    for (const row of recentUM) {
      const rowNumber = row._rowNumber;
      const timestamp = row.Timestamp;

      const { data, error } = await supabase
        .from('upward_mobility_reports')
        .select('id')
        .eq('sheets_row_number', rowNumber)
        .maybeSingle();

      if (!data && !error) {
        missingInDb++;
        missingRows.push({
          rowNumber,
          timestamp,
          entrepreneur: row['Nama Penuh Usahawan.'] || row['Nama Penuh Usahawan']
        });
      }
    }

    printCheck(
      'UM Recent Submissions',
      missingInDb === 0,
      `Checked last 10 rows: ${missingInDb} missing in Supabase`,
      missingInDb > 0 ? `Missing rows: ${missingRows.map(r => r.rowNumber).join(', ')}` : null
    );

    if (missingInDb > 0) {
      addIssue(
        'Recent Submissions',
        'CRITICAL',
        `UM: ${missingInDb} recent rows not synced to Supabase`,
        { missingRows }
      );
    }
  } catch (err) {
    printCheck('UM Recent Submissions', false, `Error: ${err.message}`);
    addIssue('Recent Submissions', 'WARNING', 'Failed to check UM recent submissions', { error: err.message });
  }
}

/**
 * CHECK 3: Data Consistency Spot Checks
 */
async function checkDataConsistency(supabase, getRows) {
  printSection('3. DATA CONSISTENCY SPOT CHECKS');

  // Bangkit spot check
  try {
    const { data: bangkitSamples, error: bangkitError } = await supabase
      .from('reports')
      .select('sheets_row_number, nama_usahawan, session_number, mia_status')
      .eq('program', 'Bangkit')
      .not('sheets_row_number', 'is', null)
      .limit(10);

    if (bangkitError) throw bangkitError;

    const bangkitSheetRows = await getRows(SPREADSHEET_ID, 'Bangkit', 'A:L');
    let mismatches = 0;
    const mismatchDetails = [];

    for (const dbRecord of bangkitSamples || []) {
      const sheetRow = bangkitSheetRows.find(r => r._rowNumber === dbRecord.sheets_row_number);

      if (!sheetRow) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          issue: 'Row not found in sheet'
        });
        continue;
      }

      // Compare key fields
      const sheetEntrepreneur = sheetRow['Nama Usahawan'];
      const sheetStatus = sheetRow['Status Sesi'];

      if (dbRecord.nama_usahawan !== sheetEntrepreneur) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          field: 'nama_usahawan',
          dbValue: dbRecord.nama_usahawan,
          sheetValue: sheetEntrepreneur
        });
      }

      if (dbRecord.mia_status !== sheetStatus) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          field: 'mia_status',
          dbValue: dbRecord.mia_status,
          sheetValue: sheetStatus
        });
      }
    }

    printCheck(
      'Bangkit Data Consistency',
      mismatches === 0,
      `Spot-checked ${bangkitSamples?.length || 0} records: ${mismatches} mismatches`,
      mismatches > 0 ? `First mismatch: Row ${mismatchDetails[0]?.rowNumber}` : null
    );

    if (mismatches > 0) {
      addIssue(
        'Data Consistency',
        'WARNING',
        `Bangkit: ${mismatches} field mismatches found`,
        { mismatches: mismatchDetails.slice(0, 5) }
      );
    }
  } catch (err) {
    printCheck('Bangkit Data Consistency', false, `Error: ${err.message}`);
    addIssue('Data Consistency', 'WARNING', 'Failed to check Bangkit consistency', { error: err.message });
  }

  // Maju spot check
  try {
    const { data: majuSamples, error: majuError } = await supabase
      .from('reports')
      .select('sheets_row_number, nama_mentee, session_number, mia_status')
      .eq('program', 'Maju')
      .not('sheets_row_number', 'is', null)
      .limit(10);

    if (majuError) throw majuError;

    const majuSheetRows = await getRows(SPREADSHEET_ID, 'LaporanMajuUM', 'A:AB');
    let mismatches = 0;
    const mismatchDetails = [];

    for (const dbRecord of majuSamples || []) {
      const sheetRow = majuSheetRows.find(r => r._rowNumber === dbRecord.sheets_row_number);

      if (!sheetRow) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          issue: 'Row not found in sheet'
        });
        continue;
      }

      const sheetMentee = sheetRow.NAMA_MENTEE;
      const sheetStatus = sheetRow.MIA_STATUS;

      if (dbRecord.nama_mentee !== sheetMentee) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          field: 'nama_mentee',
          dbValue: dbRecord.nama_mentee,
          sheetValue: sheetMentee
        });
      }
    }

    printCheck(
      'Maju Data Consistency',
      mismatches === 0,
      `Spot-checked ${majuSamples?.length || 0} records: ${mismatches} mismatches`,
      mismatches > 0 ? `First mismatch: Row ${mismatchDetails[0]?.rowNumber}` : null
    );

    if (mismatches > 0) {
      addIssue(
        'Data Consistency',
        'WARNING',
        `Maju: ${mismatches} field mismatches found`,
        { mismatches: mismatchDetails.slice(0, 5) }
      );
    }
  } catch (err) {
    printCheck('Maju Data Consistency', false, `Error: ${err.message}`);
    addIssue('Data Consistency', 'WARNING', 'Failed to check Maju consistency', { error: err.message });
  }

  // UM spot check
  try {
    const { data: umSamples, error: umError } = await supabase
      .from('upward_mobility_reports')
      .select('sheets_row_number, upward_mobility_status, entrepreneur_id')
      .not('sheets_row_number', 'is', null)
      .limit(10);

    if (umError) throw umError;

    const umSheetRows = await getRows(UM_SPREADSHEET_ID, 'UM', 'A:M');
    let mismatches = 0;
    const mismatchDetails = [];

    for (const dbRecord of umSamples || []) {
      const sheetRow = umSheetRows.find(r => r._rowNumber === dbRecord.sheets_row_number);

      if (!sheetRow) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          issue: 'Row not found in sheet'
        });
        continue;
      }

      // Find the Upward Mobility Status column (it has a long description with newlines)
      const statusKey = Object.keys(sheetRow).find(k => k.startsWith('Upward Mobility Status'));
      const sheetStatus = statusKey ? sheetRow[statusKey] : null;

      if (dbRecord.upward_mobility_status !== sheetStatus) {
        mismatches++;
        mismatchDetails.push({
          rowNumber: dbRecord.sheets_row_number,
          field: 'upward_mobility_status',
          dbValue: dbRecord.upward_mobility_status,
          sheetValue: sheetStatus
        });
      }
    }

    printCheck(
      'UM Data Consistency',
      mismatches === 0,
      `Spot-checked ${umSamples?.length || 0} records: ${mismatches} mismatches`,
      mismatches > 0 ? `First mismatch: Row ${mismatchDetails[0]?.rowNumber}` : null
    );

    if (mismatches > 0) {
      addIssue(
        'Data Consistency',
        'WARNING',
        `UM: ${mismatches} field mismatches found`,
        { mismatches: mismatchDetails.slice(0, 5) }
      );
    }
  } catch (err) {
    printCheck('UM Data Consistency', false, `Error: ${err.message}`);
    addIssue('Data Consistency', 'WARNING', 'Failed to check UM consistency', { error: err.message });
  }
}

/**
 * CHECK 4: Doc URL Completeness
 */
async function checkDocURLs(supabase) {
  printSection('4. DOC URL COMPLETENESS');

  // Bangkit doc URLs
  try {
    const { data: bangkitMissing, error: bangkitError } = await supabase
      .from('reports')
      .select('id, sheets_row_number, nama_usahawan, session_number')
      .eq('program', 'Bangkit')
      .is('doc_url', null)
      .limit(100);

    if (bangkitError) throw bangkitError;

    const bangkitMissingCount = bangkitMissing?.length || 0;

    printCheck(
      'Bangkit Doc URLs',
      bangkitMissingCount === 0,
      `${bangkitMissingCount} reports missing doc_url`,
      bangkitMissingCount > 0 && bangkitMissingCount <= 10
        ? `Rows: ${bangkitMissing.map(r => r.sheets_row_number).filter(r => r).join(', ')}`
        : bangkitMissingCount > 10
        ? `First 10 rows: ${bangkitMissing.slice(0, 10).map(r => r.sheets_row_number).filter(r => r).join(', ')}`
        : null
    );

    if (bangkitMissingCount > 0) {
      addIssue(
        'Doc URL Missing',
        bangkitMissingCount > 10 ? 'WARNING' : 'INFO',
        `Bangkit: ${bangkitMissingCount} reports need doc_url backfill`,
        {
          count: bangkitMissingCount,
          sampleRows: bangkitMissing.slice(0, 5).map(r => r.sheets_row_number).filter(r => r)
        }
      );
    }
  } catch (err) {
    printCheck('Bangkit Doc URLs', false, `Error: ${err.message}`);
  }

  // Maju doc URLs
  try {
    const { data: majuMissing, error: majuError } = await supabase
      .from('reports')
      .select('id, sheets_row_number, nama_mentee, session_number')
      .eq('program', 'Maju')
      .is('doc_url', null)
      .limit(100);

    if (majuError) throw majuError;

    const majuMissingCount = majuMissing?.length || 0;

    printCheck(
      'Maju Doc URLs',
      majuMissingCount === 0,
      `${majuMissingCount} reports missing doc_url`,
      majuMissingCount > 0 && majuMissingCount <= 10
        ? `Rows: ${majuMissing.map(r => r.sheets_row_number).filter(r => r).join(', ')}`
        : majuMissingCount > 10
        ? `First 10 rows: ${majuMissing.slice(0, 10).map(r => r.sheets_row_number).filter(r => r).join(', ')}`
        : null
    );

    if (majuMissingCount > 0) {
      addIssue(
        'Doc URL Missing',
        majuMissingCount > 10 ? 'WARNING' : 'INFO',
        `Maju: ${majuMissingCount} reports need doc_url backfill`,
        {
          count: majuMissingCount,
          sampleRows: majuMissing.slice(0, 5).map(r => r.sheets_row_number).filter(r => r)
        }
      );
    }
  } catch (err) {
    printCheck('Maju Doc URLs', false, `Error: ${err.message}`);
  }

  console.log('   ℹ️  UM reports do not require doc_url');
}

/**
 * CHECK 5: Session Integrity
 */
async function checkSessionIntegrity(supabase) {
  printSection('5. SESSION INTEGRITY CHECK');

  // Reports without session_id
  try {
    const { count: reportsWithoutSession, error: reportsError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .is('session_id', null);

    if (reportsError) throw reportsError;

    printCheck(
      'Reports with session_id',
      reportsWithoutSession === 0,
      `${reportsWithoutSession} reports missing session_id`,
      reportsWithoutSession > 0 ? 'These reports need session creation' : null
    );

    if (reportsWithoutSession > 0) {
      addIssue(
        'Session Integrity',
        reportsWithoutSession > 10 ? 'CRITICAL' : 'WARNING',
        `${reportsWithoutSession} reports missing session_id`,
        { count: reportsWithoutSession }
      );
    }
  } catch (err) {
    printCheck('Reports with session_id', false, `Error: ${err.message}`);
  }

  // Orphaned sessions (sessions without reports)
  try {
    const { data: allSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id');

    if (sessionsError) throw sessionsError;

    let orphanedCount = 0;
    const orphanedIds = [];

    for (const session of allSessions || []) {
      const { count, error } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      if (!error && count === 0) {
        orphanedCount++;
        orphanedIds.push(session.id);
      }
    }

    printCheck(
      'Orphaned Sessions',
      orphanedCount === 0,
      `${orphanedCount} sessions without reports`,
      orphanedCount > 0 && orphanedCount <= 5
        ? `IDs: ${orphanedIds.slice(0, 5).join(', ')}`
        : orphanedCount > 5
        ? `${orphanedCount} orphaned sessions found`
        : null
    );

    if (orphanedCount > 0) {
      addIssue(
        'Session Integrity',
        'WARNING',
        `${orphanedCount} orphaned sessions (sessions without reports)`,
        { count: orphanedCount, sampleIds: orphanedIds.slice(0, 5) }
      );
    }
  } catch (err) {
    printCheck('Orphaned Sessions', false, `Error: ${err.message}`);
  }
}

/**
 * Print final summary
 */
function printSummary() {
  printSection('VALIDATION SUMMARY');

  console.log(`Total Checks Passed: ${stats.passed}`);
  console.log(`Total Issues Found: ${stats.totalIssues}`);
  console.log(`  • Critical: ${stats.criticalIssues}`);
  console.log(`  • Warnings: ${stats.warnings}`);

  if (stats.criticalIssues > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. [${issue.category}] ${issue.message}`);
      if (issue.details) {
        console.log(`   Details: ${JSON.stringify(issue.details, null, 2)}`);
      }
    });
  }

  if (stats.warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.slice(0, 5).forEach((warning, i) => {
      console.log(`\n${i + 1}. [${warning.category}] ${warning.message}`);
    });
    if (warnings.length > 5) {
      console.log(`\n   ... and ${warnings.length - 5} more warnings`);
    }
  }

  console.log('\n' + '='.repeat(70));

  if (stats.criticalIssues === 0 && stats.warnings === 0) {
    console.log('✅ ALL VALIDATION CHECKS PASSED - Data is in sync!');
  } else if (stats.criticalIssues > 0) {
    console.log('❌ VALIDATION FAILED - Critical issues require immediate attention!');
  } else {
    console.log('⚠️  VALIDATION COMPLETED WITH WARNINGS - Review and address warnings');
  }

  console.log('='.repeat(70) + '\n');
}

/**
 * Main validation function
 */
async function runValidation() {
  console.log('\n🔍 Starting Daily Validation: Google Sheets ↔️ Supabase\n');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  if (!SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SHEETS_REPORT_ID environment variable not set');
    process.exit(1);
  }

  try {
    // Initialize clients
    console.log('📊 Connecting to Google Sheets...');
    const { getRows } = await createSheetsClient();

    console.log('🗄️  Connecting to Supabase...');
    const supabase = createSupabaseClient();

    // Run all validation checks
    await checkCounts(supabase, getRows);
    await checkRecentSubmissions(supabase, getRows);
    await checkDataConsistency(supabase, getRows);
    await checkDocURLs(supabase);
    await checkSessionIntegrity(supabase);

    // Print summary
    printSummary();

    // Exit with appropriate code
    if (stats.criticalIssues > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during validation:', error);
    process.exit(1);
  }
}

// Run the validation
if (require.main === module) {
  runValidation()
    .then(() => {
      // Handled by printSummary
    })
    .catch(err => {
      console.error('❌ Validation script failed:', err);
      process.exit(1);
    });
}

module.exports = { runValidation };
