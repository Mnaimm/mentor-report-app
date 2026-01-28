/**
 * COMPREHENSIVE AUDIT OF ALL SUPABASE TABLES
 * Run: node migration-scripts/audit-all-tables.js
 *
 * This will:
 * 1. List all tables in Supabase
 * 2. Export each table to JSON
 * 3. Analyze data quality (NULL fields, test data, etc.)
 * 4. Compare with Google Sheets structure
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SHEET_ID = process.env.SHEET_ID;

// Create export directory
const exportDir = path.join(__dirname, '..', 'supabase-audit');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

async function analyzeDataQuality(tableName, data) {
  if (!data || data.length === 0) {
    return {
      totalRecords: 0,
      nullAnalysis: {},
      sampleRecord: null
    };
  }

  // Count nulls for each field
  const allFields = data.reduce((acc, record) => {
    const fields = Object.keys(record);
    fields.forEach(field => {
      if (!acc[field]) acc[field] = { total: 0, nulls: 0, nullPercent: 0 };
      acc[field].total++;
      if (record[field] === null || record[field] === undefined) {
        acc[field].nulls++;
      }
    });
    return acc;
  }, {});

  // Calculate percentages
  Object.keys(allFields).forEach(field => {
    allFields[field].nullPercent = Math.round((allFields[field].nulls / allFields[field].total) * 100);
  });

  // Get high NULL fields
  const highNullFields = Object.entries(allFields)
    .filter(([_, stats]) => stats.nullPercent > 50)
    .sort((a, b) => b[1].nullPercent - a[1].nullPercent);

  return {
    totalRecords: data.length,
    totalFields: Object.keys(allFields).length,
    nullAnalysis: allFields,
    highNullFields: highNullFields.map(([field, stats]) => ({
      field,
      nullPercent: stats.nullPercent,
      nullCount: stats.nulls,
      total: stats.total
    })),
    sampleRecord: data[0]
  };
}

async function exportTable(tableName) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📊 Exporting: ${tableName.toUpperCase()}`);
  console.log('─'.repeat(70));

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      return null;
    }

    // Save to file
    const filename = `${tableName}_${timestamp}.json`;
    fs.writeFileSync(
      path.join(exportDir, filename),
      JSON.stringify(data, null, 2)
    );

    console.log(`   ✅ Exported ${data.length} records`);

    // Analyze data quality
    const analysis = await analyzeDataQuality(tableName, data);

    if (data.length > 0) {
      console.log(`   📋 Total fields: ${analysis.totalFields}`);
      console.log(`   📋 Sample ID: ${data[0].id || data[0].email || 'N/A'}`);

      if (analysis.highNullFields.length > 0) {
        console.log(`\n   ⚠️  HIGH NULL FIELDS (>50%):`);
        analysis.highNullFields.slice(0, 10).forEach(field => {
          console.log(`      • ${field.field}: ${field.nullPercent}% NULL (${field.nullCount}/${field.total})`);
        });
      }
    }

    return { tableName, data, analysis, filename };

  } catch (error) {
    console.error(`   ❌ Fatal error: ${error.message}`);
    return null;
  }
}

async function getGoogleSheetsTabs() {
  console.log('\n📋 Fetching Google Sheets structure...\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const tabs = metadata.data.sheets.map(sheet => ({
      name: sheet.properties.title,
      id: sheet.properties.sheetId
    }));

    console.log('   ✅ Google Sheets tabs:');
    tabs.forEach((tab, index) => {
      console.log(`      ${index + 1}. "${tab.name}"`);
    });

    // Count rows in key tabs
    console.log('\n   📊 Counting rows in key tabs:');

    const tabsToCount = ['Bangkit', 'LaporanMajuUM', 'mapping', 'batch 5', 'batch 6'];
    const counts = {};

    for (const tabName of tabsToCount) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${tabName}!A2:A`,
        });
        const rows = response.data.values || [];
        counts[tabName] = rows.length;
        console.log(`      • ${tabName}: ${rows.length} rows`);
      } catch (err) {
        console.log(`      • ${tabName}: Not found or empty`);
      }
    }

    return { tabs, counts };

  } catch (error) {
    console.error('   ❌ Error fetching sheets:', error.message);
    return null;
  }
}

async function auditAllTables() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 COMPREHENSIVE SUPABASE AUDIT');
  console.log('═'.repeat(70));

  // List of tables to audit
  const tables = [
    'reports',
    'sessions',
    'entrepreneurs',
    'mentors',
    'users',
    'mentor_profiles',
    'mentor_assignments',
    'mentoring_rounds',
    'batch_rounds',
    'batches',
    'dual_write_logs',
    'activity_logs',
    'error_logs'
  ];

  const results = [];

  // Get Google Sheets structure first
  const sheetsInfo = await getGoogleSheetsTabs();

  // Export each table
  for (const tableName of tables) {
    const result = await exportTable(tableName);
    if (result) {
      results.push(result);
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }

  // Generate comprehensive report
  console.log('\n' + '═'.repeat(70));
  console.log('📊 AUDIT SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n📈 TABLE OVERVIEW:\n');
  results.forEach(result => {
    const hasData = result.data.length > 0;
    const quality = result.analysis.highNullFields.length === 0 ? '✅ GOOD' :
                   result.analysis.highNullFields.length < 5 ? '⚠️  FAIR' : '❌ POOR';

    console.log(`   ${hasData ? '📦' : '📭'} ${result.tableName.padEnd(25)} ${String(result.data.length).padStart(5)} rows   ${quality}`);
  });

  // Create mapping comparison
  console.log('\n' + '═'.repeat(70));
  console.log('🔗 GOOGLE SHEETS vs SUPABASE MAPPING:');
  console.log('═'.repeat(70));

  if (sheetsInfo) {
    console.log('\n📋 Expected Migrations:\n');
    console.log('   Google Sheet Tab          →  Supabase Table');
    console.log('   ' + '─'.repeat(66));
    console.log('   v8 (28 rows)              →  reports (Bangkit program)');
    console.log('   LaporanMaju (10 rows)     →  reports (Maju program)');
    console.log('   mapping                   →  mentor_assignments + entrepreneurs');
    console.log('   batch 5 / batch 6         →  mentoring_rounds + batches');
    console.log('   (mentor emails)           →  mentors OR users table');
  }

  // Identify issues
  console.log('\n' + '═'.repeat(70));
  console.log('🚨 CRITICAL ISSUES FOUND:');
  console.log('═'.repeat(70));

  const criticalIssues = results.filter(r =>
    r.analysis.highNullFields.length > 5 ||
    (r.data.length > 0 && r.analysis.highNullFields.some(f => f.nullPercent === 100 && ['mentor_email', 'email', 'nama_mentor'].includes(f.field)))
  );

  if (criticalIssues.length > 0) {
    console.log('\n❌ Tables with CRITICAL data quality issues:\n');
    criticalIssues.forEach(result => {
      console.log(`   • ${result.tableName}: ${result.analysis.highNullFields.length} fields >50% NULL`);
      const criticalFields = result.analysis.highNullFields.filter(f =>
        f.nullPercent === 100 && ['mentor_email', 'email', 'nama_mentor', 'nama_mentee'].includes(f.field)
      );
      if (criticalFields.length > 0) {
        console.log(`     🔴 CRITICAL: ${criticalFields.map(f => f.field).join(', ')} are 100% NULL`);
      }
    });
  }

  // Generate summary JSON
  const summaryReport = {
    auditDate: new Date().toISOString(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    googleSheetsInfo: sheetsInfo,
    tables: results.map(r => ({
      name: r.tableName,
      recordCount: r.data.length,
      totalFields: r.analysis.totalFields,
      highNullFieldsCount: r.analysis.highNullFields.length,
      dataQuality: r.analysis.highNullFields.length === 0 ? 'GOOD' :
                   r.analysis.highNullFields.length < 5 ? 'FAIR' : 'POOR',
      criticalIssues: r.analysis.highNullFields.filter(f =>
        f.nullPercent === 100 && ['mentor_email', 'email', 'nama_mentor'].includes(f.field)
      )
    })),
    recommendations: [
      'DELETE all data from reports, sessions tables (test data)',
      'VERIFY mentors vs users table - which one to use?',
      'MIGRATE mapping tab → mentor_assignments + entrepreneurs',
      'MIGRATE v8 tab (28 rows) → reports (Bangkit)',
      'MIGRATE LaporanMaju tab (10 rows) → reports (Maju)',
      'MIGRATE batch tabs → mentoring_rounds + batches'
    ]
  };

  fs.writeFileSync(
    path.join(exportDir, `AUDIT_SUMMARY_${timestamp}.json`),
    JSON.stringify(summaryReport, null, 2)
  );

  console.log('\n' + '═'.repeat(70));
  console.log('✅ AUDIT COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`\n📁 All data exported to: ${exportDir}`);
  console.log(`\n📄 Summary report: AUDIT_SUMMARY_${timestamp}.json`);
  console.log('\n💡 RECOMMENDED NEXT STEPS:');
  console.log('   1. Review the exported JSON files');
  console.log('   2. Confirm which tables need cleanup');
  console.log('   3. Clarify: mentors vs users table usage');
  console.log('   4. Run cleanup script to DELETE test data');
  console.log('   5. Run proper migration from Google Sheets');
  console.log('═'.repeat(70));
}

auditAllTables();
