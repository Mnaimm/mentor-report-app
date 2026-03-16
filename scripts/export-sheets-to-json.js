/**
 * EXPORT GOOGLE SHEETS DATA TO JSON FILES
 * Run: node scripts/export-sheets-to-json.js
 *
 * Purpose: Export latest data from Google Sheets to JSON files for syncing to Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Sheet ID from user-provided URL
const SHEET_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';

// Tab names and output files
const EXPORTS = [
  {
    tabName: 'Bangkit',
    outputFile: 'bangkit.json',
    description: 'Bangkit program reports'
  },
  {
    tabName: 'LaporanMajuUM',
    outputFile: 'LaporanMajuUM.json',
    description: 'Maju program reports'
  }
];

/**
 * Convert sheet rows to array of objects
 */
function rowsToObjects(values) {
  if (!values || values.length === 0) {
    return [];
  }

  const [header, ...rows] = values;

  return rows.map((row, index) => {
    const rowData = {};

    header.forEach((key, colIndex) => {
      const cleanKey = key.trim();
      const value = row[colIndex];

      // Handle empty values
      if (value === undefined || value === null || value === '') {
        rowData[cleanKey] = '';
      } else {
        // Try to parse as number if it looks like a number
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && value.toString() === numValue.toString()) {
          rowData[cleanKey] = numValue;
        } else if (value === 'true') {
          rowData[cleanKey] = true;
        } else if (value === 'false') {
          rowData[cleanKey] = false;
        } else {
          rowData[cleanKey] = value;
        }
      }
    });

    return rowData;
  });
}

async function exportSheetsToJSON() {
  console.log('📊 Exporting Google Sheets to JSON...\n');
  console.log('═'.repeat(70));
  console.log(`📄 Sheet ID: ${SHEET_ID}\n`);

  try {
    // Initialize Google Sheets API with Base64 credentials
    const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;

    if (!base64Credentials) {
      throw new Error('GOOGLE_CREDENTIALS_BASE64 environment variable not found');
    }

    // Decode and parse credentials
    const decodedJson = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const credentials = JSON.parse(decodedJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Create sync-data directory if it doesn't exist
    const syncDataDir = path.join(process.cwd(), 'sync-data');
    if (!fs.existsSync(syncDataDir)) {
      fs.mkdirSync(syncDataDir, { recursive: true });
    }

    const results = [];

    // Export each tab
    for (const exportConfig of EXPORTS) {
      console.log(`\n📝 Exporting "${exportConfig.tabName}" tab...`);

      try {
        // Fetch all data from the tab (using A:ZZ to capture all columns)
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${exportConfig.tabName}!A:ZZ`,
        });

        const values = response.data.values;

        if (!values || values.length === 0) {
          console.log(`   ⚠️  Tab "${exportConfig.tabName}" is empty or has no data`);
          results.push({
            tab: exportConfig.tabName,
            file: exportConfig.outputFile,
            count: 0,
            status: 'empty'
          });
          continue;
        }

        // Convert to array of objects
        const data = rowsToObjects(values);

        // Write to JSON file
        const outputPath = path.join(syncDataDir, exportConfig.outputFile);
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

        console.log(`   ✅ Exported ${data.length} rows`);
        console.log(`   📁 Saved to: sync-data/${exportConfig.outputFile}`);

        // Show sample record
        if (data.length > 0) {
          const sample = data[0];
          const fieldCount = Object.keys(sample).length;
          console.log(`   📋 Sample: ${fieldCount} fields per record`);

          // Show first few field names
          const firstFields = Object.keys(sample).slice(0, 5);
          console.log(`   🔑 First fields: ${firstFields.join(', ')}, ...`);
        }

        results.push({
          tab: exportConfig.tabName,
          file: exportConfig.outputFile,
          count: data.length,
          status: 'success'
        });

      } catch (error) {
        console.error(`   ❌ Error exporting "${exportConfig.tabName}":`, error.message);
        results.push({
          tab: exportConfig.tabName,
          file: exportConfig.outputFile,
          count: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('\n📊 EXPORT SUMMARY:\n');

    const totalRecords = results.reduce((sum, r) => sum + r.count, 0);

    results.forEach(result => {
      const icon = result.status === 'success' ? '✅' :
                   result.status === 'empty' ? '⚠️' : '❌';
      console.log(`${icon} ${result.tab}: ${result.count} records → ${result.file}`);
    });

    console.log(`\n📈 Total records exported: ${totalRecords}`);
    console.log('═'.repeat(70));

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    if (errorCount > 0) {
      console.log(`\n⚠️  ${errorCount} tab(s) had errors`);
      console.log('\n💡 Next steps:');
      console.log('   1. Check the error messages above');
      console.log('   2. Verify the tab names exist in the Google Sheet');
      console.log('   3. Check Google Sheets API permissions');
    } else if (successCount > 0) {
      console.log('\n✅ Export complete!');
      console.log('\n💡 Next steps:');
      console.log('   1. Review the exported JSON files in sync-data/');
      console.log('   2. Run sync scripts to import into Supabase:');
      console.log('      - node sync-scripts/04-sync-bangkit-reports.js');
      console.log('      - node sync-scripts/05-sync-maju-reports.js');
    }

    console.log('═'.repeat(70));

    return results;

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.message.includes('GOOGLE_CREDENTIALS_BASE64')) {
      console.error('\n⚠️  Make sure .env.local file exists with:');
      console.error('   - GOOGLE_CREDENTIALS_BASE64');
    }
    console.error('\n' + error.stack);
    process.exit(1);
  }
}

// Run the export
if (require.main === module) {
  exportSheetsToJSON()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { exportSheetsToJSON };
