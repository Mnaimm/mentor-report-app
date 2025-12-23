/**
 * INSPECT FAILED ROWS FROM MIGRATION
 * Checks specific rows that failed during migration
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID?.replace(/"/g, '') ||
                 process.env.GOOGLE_SHEETS_REPORT_ID?.replace(/"/g, '') ||
                 process.env.SHEET_ID;

async function inspectFailedRows() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 INSPECTING FAILED MIGRATION ROWS');
  console.log('═'.repeat(70));

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Check Bangkit Row 58 and 70
    console.log('\n' + '─'.repeat(70));
    console.log('📋 BANGKIT - Checking Rows 58 and 70');
    console.log('─'.repeat(70));

    const bangkitResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A58:Z70',
    });

    const bangkitRows = bangkitResponse.data.values || [];
    const bangkitHeaders = bangkitRows[0]; // Assumes row 1 is header (unlikely at row 58)

    // Get headers from row 1
    const headersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A1:Z1',
    });
    const headers = headersResponse.data.values[0];

    console.log('\n🔍 Bangkit Row 58 (actual sheet row):');
    // Row 58 in sheet = index 0 in our fetched range (A58:Z70)
    const row58Data = bangkitRows[0];
    if (row58Data && row58Data.length > 0) {
      console.log('   Timestamp:', row58Data[0] || '(empty)');
      console.log('   Email:', row58Data[headers.indexOf('Emai')] || '(empty)');
      console.log('   Nama Usahawan:', row58Data[headers.indexOf('Nama Usahawan')] || '(empty)');
      console.log('   Nama Mentor:', row58Data[headers.indexOf('Nama Mentor')] || '(empty)');
      console.log('   Status Sesi:', row58Data[headers.indexOf('Status Sesi')] || '(empty)');
      console.log('   Full row length:', row58Data.length);
      console.log('   Raw data:', JSON.stringify(row58Data.slice(0, 10)));
    } else {
      console.log('   ❌ Row 58 is EMPTY or has no data');
    }

    console.log('\n🔍 Bangkit Row 70 (actual sheet row):');
    // Row 70 in sheet = index 12 in our fetched range (58 + 12 = 70)
    const row70Data = bangkitRows[12];
    if (row70Data && row70Data.length > 0) {
      console.log('   Timestamp:', row70Data[0] || '(empty)');
      console.log('   Email:', row70Data[headers.indexOf('Emai')] || '(empty)');
      console.log('   Nama Usahawan:', row70Data[headers.indexOf('Nama Usahawan')] || '(empty)');
      console.log('   Nama Mentor:', row70Data[headers.indexOf('Nama Mentor')] || '(empty)');
      console.log('   Status Sesi:', row70Data[headers.indexOf('Status Sesi')] || '(empty)');
      console.log('   Full row length:', row70Data.length);
      console.log('   Raw data:', JSON.stringify(row70Data.slice(0, 10)));
    } else {
      console.log('   ❌ Row 70 is EMPTY or has no data');
    }

    // Check Maju Row 14, 18, 19
    console.log('\n' + '─'.repeat(70));
    console.log('📋 MAJU - Checking Rows 14, 18, 19');
    console.log('─'.repeat(70));

    const majuResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'LaporanMaju!A14:Z19',
    });

    const majuRows = majuResponse.data.values || [];

    // Get Maju headers
    const majuHeadersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'LaporanMaju!A1:Z1',
    });
    const majuHeaders = majuHeadersResponse.data.values[0];

    console.log('\n🔍 Maju Row 14 (actual sheet row):');
    const row14Data = majuRows[0];
    if (row14Data && row14Data.length > 0) {
      console.log('   EMAIL_MENTOR:', row14Data[majuHeaders.indexOf('EMAIL_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTOR:', row14Data[majuHeaders.indexOf('NAMA_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTEE:', row14Data[majuHeaders.indexOf('NAMA_MENTEE')] || '(empty)');
      console.log('   NAMA_BISNES:', row14Data[majuHeaders.indexOf('NAMA_BISNES')] || '(empty)');
      console.log('   Full row length:', row14Data.length);
      console.log('   Raw data:', JSON.stringify(row14Data.slice(0, 10)));
    } else {
      console.log('   ❌ Row 14 is EMPTY or has no data');
    }

    console.log('\n🔍 Maju Row 18 (actual sheet row):');
    const row18Data = majuRows[4]; // 14 + 4 = 18
    if (row18Data && row18Data.length > 0) {
      console.log('   EMAIL_MENTOR:', row18Data[majuHeaders.indexOf('EMAIL_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTOR:', row18Data[majuHeaders.indexOf('NAMA_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTEE:', row18Data[majuHeaders.indexOf('NAMA_MENTEE')] || '(empty)');
      console.log('   NAMA_BISNES:', row18Data[majuHeaders.indexOf('NAMA_BISNES')] || '(empty)');
      console.log('   Full row length:', row18Data.length);
      console.log('   Raw data:', JSON.stringify(row18Data.slice(0, 10)));
    } else {
      console.log('   ❌ Row 18 is EMPTY or has no data');
    }

    console.log('\n🔍 Maju Row 19 (actual sheet row):');
    const row19Data = majuRows[5]; // 14 + 5 = 19
    if (row19Data && row19Data.length > 0) {
      console.log('   EMAIL_MENTOR:', row19Data[majuHeaders.indexOf('EMAIL_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTOR:', row19Data[majuHeaders.indexOf('NAMA_MENTOR')] || '(empty)');
      console.log('   NAMA_MENTEE:', row19Data[majuHeaders.indexOf('NAMA_MENTEE')] || '(empty)');
      console.log('   NAMA_BISNES:', row19Data[majuHeaders.indexOf('NAMA_BISNES')] || '(empty)');
      console.log('   Full row length:', row19Data.length);
      console.log('   Raw data:', JSON.stringify(row19Data.slice(0, 10)));
    } else {
      console.log('   ❌ Row 19 is EMPTY or has no data');
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ INSPECTION COMPLETE');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

inspectFailedRows();
