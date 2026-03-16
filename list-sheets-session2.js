/**
 * List all Session 2 records from Google Sheets to find missing mentees
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function listSession2Records() {
    console.log('📊 Fetching Session 2 records from Google Sheets...\n');

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LaporanMaju!A2:K50', // Headers: timestamp, mentor name, email, mentee, etc.
    });

    const rows = response.data.values || [];
    console.log(`Total rows: ${rows.length}\n`);

    // Filter for Session 2
    const session2Rows = rows.filter(row => {
        const sessionNum = row[9]; // Column J = SESI_NUMBER
        return sessionNum == 2;
    });

    console.log(`Session 2 records: ${session2Rows.length}\n`);
    console.log('='.repeat(100));

    session2Rows.forEach((row, idx) => {
        const mentorName = row[1];
        const mentorEmail = row[2];
        const menteeName = row[3];
        const sessionNum = row[9];

        console.log(`[${idx + 1}] ${menteeName}`);
        console.log(`    Mentor: ${mentorName} (${mentorEmail})`);
        console.log(`    Session: ${sessionNum}`);
        console.log('');
    });

    console.log('='.repeat(100));

    // Check for the 5 missing entrepreneurs
    const missingNames = [
        'Norine Binti Mohd Noh',
        'Muhammad Husaini Bin Arifin',
        'Muhammad Faizal Bin Shaari',
        'Mohd Najmi Bin Abd Rahim',
        'Lim Boon Chin'
    ];

    console.log('\n🔍 Checking for missing entrepreneurs...\n');

    missingNames.forEach(name => {
        // Check all rows (not just session 2)
        const found = rows.find(row => {
            const menteeName = row[3];
            return menteeName?.toLowerCase() === name.toLowerCase();
        });

        if (found) {
            console.log(`✅ ${name} - FOUND in row (Session ${found[9]})`);
            console.log(`   Mentor: ${found[2]}`);
        } else {
            console.log(`❌ ${name} - NOT FOUND in Google Sheets`);
        }
    });

    console.log('\n' + '='.repeat(100));
}

listSession2Records().catch(console.error);
