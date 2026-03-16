/**
 * Check specific rows in Google Sheets
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function checkRows() {
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;

    console.log('📊 Checking rows 35 and 36 in Google Sheets...\n');

    // Check row 35
    const row35 = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LaporanMaju!A35:K35',
    });

    console.log('Row 35:');
    if (row35.data.values && row35.data.values.length > 0) {
        const data = row35.data.values[0];
        console.log('  Timestamp:', data[0] || 'EMPTY');
        console.log('  Mentor:', data[2] || 'EMPTY');
        console.log('  Mentee:', data[3] || 'EMPTY');
        console.log('  Session:', data[9] || 'EMPTY');
    } else {
        console.log('  ❌ Row 35 is EMPTY or does not exist');
    }

    console.log('');

    // Check row 36
    const row36 = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LaporanMaju!A36:K36',
    });

    console.log('Row 36:');
    if (row36.data.values && row36.data.values.length > 0) {
        const data = row36.data.values[0];
        console.log('  Timestamp:', data[0] || 'EMPTY');
        console.log('  Mentor:', data[2] || 'EMPTY');
        console.log('  Mentee:', data[3] || 'EMPTY');
        console.log('  Session:', data[9] || 'EMPTY');
    } else {
        console.log('  ❌ Row 36 is EMPTY or does not exist');
    }
}

checkRows().catch(console.error);
