/**
 * COUNT ALL DATA IN GOOGLE SHEETS
 * Run: node migration-scripts/count-sheets-data.js
 *
 * Purpose: Count total rows in Google Sheets to compare with Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

// Both Bangkit and Maju are in the SAME spreadsheet
const SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID?.replace(/"/g, '') ||
                 process.env.GOOGLE_SHEETS_REPORT_ID?.replace(/"/g, '') ||
                 process.env.SHEET_ID;

const BANGKIT_SHEET_ID = SHEET_ID;
const MAJU_SHEET_ID = SHEET_ID;

async function countSheetsData() {
  console.log('📊 Counting Google Sheets Data...\n');
  console.log('═'.repeat(60));

  try {
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Count Bangkit reports (V8 Sheet → v8 tab)
    console.log('📝 Counting Bangkit reports...');
    try {
      const bangkitResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: BANGKIT_SHEET_ID,
        range: 'v8!A2:ZZ',  // Extended to ZZ to capture all columns
      });
      const bangkitRows = bangkitResponse.data.values || [];
      const bangkitCount = bangkitRows.length;

      console.log(`   ✅ BANGKIT (V8 Sheet → mentoring_rounds tab): ${bangkitCount} rows`);

      // Show date range if available
      if (bangkitCount > 0) {
        const firstRow = bangkitRows[0];
        const lastRow = bangkitRows[bangkitRows.length - 1];
        console.log(`   📅 First entry: Row 2`);
        console.log(`   📅 Last entry: Row ${bangkitCount + 1}`);
      }

      console.log('\n' + '-'.repeat(60) + '\n');

      // Count Maju reports (LaporanMaju sheet)
      console.log('📝 Counting Maju reports...');
      const majuResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: MAJU_SHEET_ID,
        range: 'LaporanMaju!A2:ZZ',  // Extended to ZZ to capture all columns
      });
      const majuRows = majuResponse.data.values || [];
      const majuCount = majuRows.length;

      console.log(`   ✅ MAJU (Maju Sheet → LaporanMaju tab): ${majuCount} rows`);

      // Show date range if available
      if (majuCount > 0) {
        const firstRow = majuRows[0];
        const lastRow = majuRows[majuRows.length - 1];
        console.log(`   📅 First entry: Row 2`);
        console.log(`   📅 Last entry: Row ${majuCount + 1}`);
      }

      console.log('\n' + '═'.repeat(60));
      console.log('\n📊 SUMMARY:');
      console.log('═'.repeat(60));
      console.log(`Total Bangkit reports in Sheets:  ${bangkitCount}`);
      console.log(`Total Maju reports in Sheets:     ${majuCount}`);
      console.log(`GRAND TOTAL:                       ${bangkitCount + majuCount}`);
      console.log('═'.repeat(60));

      console.log('\n💡 Next Step:');
      console.log('   Compare these numbers with your Supabase counts to find the gap.');
      console.log('   Then we\'ll create the backfill migration script.');

      return {
        bangkit: bangkitCount,
        maju: majuCount,
        total: bangkitCount + majuCount
      };

    } catch (error) {
      console.error('❌ Error counting Bangkit sheets:', error.message);
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    if (error.message.includes('ENOENT')) {
      console.error('\n⚠️  Make sure .env.local file exists with:');
      console.error('   - SHEET_ID');
      console.error('   - SHEET_ID_MAJU');
      console.error('   - GOOGLE_SERVICE_ACCOUNT_EMAIL');
      console.error('   - GOOGLE_PRIVATE_KEY');
    }
    process.exit(1);
  }
}

// Run the count
countSheetsData();
