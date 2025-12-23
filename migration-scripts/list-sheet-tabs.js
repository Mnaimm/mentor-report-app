/**
 * LIST ALL TABS IN GOOGLE SHEETS
 * Run: node migration-scripts/list-sheet-tabs.js
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const BANGKIT_SHEET_ID = process.env.SHEET_ID;
const MAJU_SHEET_ID = process.env.SHEET_ID_MAJU || BANGKIT_SHEET_ID;

async function listSheetTabs() {
  console.log('📋 Listing all tabs in Google Sheets...\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get Bangkit sheet metadata
    console.log('📊 BANGKIT/V8 SHEET:');
    console.log(`   Sheet ID: ${BANGKIT_SHEET_ID}`);
    const bangkitMeta = await sheets.spreadsheets.get({
      spreadsheetId: BANGKIT_SHEET_ID,
    });

    console.log(`   Title: ${bangkitMeta.data.properties.title}\n`);
    console.log('   Tabs:');
    bangkitMeta.data.sheets.forEach((sheet, index) => {
      console.log(`   ${index + 1}. "${sheet.properties.title}"`);
    });

    console.log('\n' + '-'.repeat(60) + '\n');

    // Get Maju sheet metadata
    if (MAJU_SHEET_ID && MAJU_SHEET_ID !== BANGKIT_SHEET_ID) {
      console.log('📊 MAJU SHEET:');
      console.log(`   Sheet ID: ${MAJU_SHEET_ID}`);
      const majuMeta = await sheets.spreadsheets.get({
        spreadsheetId: MAJU_SHEET_ID,
      });

      console.log(`   Title: ${majuMeta.data.properties.title}\n`);
      console.log('   Tabs:');
      majuMeta.data.sheets.forEach((sheet, index) => {
        console.log(`   ${index + 1}. "${sheet.properties.title}"`);
      });
    } else {
      console.log('📊 MAJU SHEET: Using same sheet as Bangkit');
    }

    console.log('\n✅ Done! Use these exact tab names in the count script.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listSheetTabs();
