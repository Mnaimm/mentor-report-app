/**
 * INSPECT GOOGLE SHEETS COLUMN STRUCTURE
 * Run: node migration-scripts/inspect-sheet-columns.js
 *
 * This will show the header row (column names) from:
 * - v8 tab (Bangkit reports)
 * - LaporanMaju tab (Maju reports)
 *
 * So we can create proper column mapping for migration
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.SHEET_ID;

async function inspectSheetColumns() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 INSPECTING GOOGLE SHEETS COLUMN STRUCTURE');
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

    // ============================================
    // V8 TAB (Bangkit)
    // ============================================
    console.log('\n📊 V8 TAB (Bangkit Reports):');
    console.log('─'.repeat(70));

    const v8Response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A1:Z1', // Get header row
    });

    const v8Headers = v8Response.data.values ? v8Response.data.values[0] : [];
    console.log(`\n   Found ${v8Headers.length} columns:\n`);
    v8Headers.forEach((header, index) => {
      const col = String.fromCharCode(65 + index); // A, B, C, etc.
      console.log(`   ${col.padEnd(3)} (${String(index).padStart(2)}) : ${header}`);
    });

    // Get sample row
    console.log('\n   📋 Sample data (Row 2):');
    const v8SampleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A2:Z2',
    });
    const v8SampleRow = v8SampleResponse.data.values ? v8SampleResponse.data.values[0] : [];
    v8Headers.forEach((header, index) => {
      const value = v8SampleRow[index] || '[empty]';
      const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
      console.log(`      ${header}: ${displayValue}`);
    });

    // ============================================
    // LAPORAN MAJU TAB
    // ============================================
    console.log('\n\n📊 LAPORANMAJU TAB (Maju Reports):');
    console.log('─'.repeat(70));

    const majuResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'LaporanMaju!A1:Z1', // Get header row
    });

    const majuHeaders = majuResponse.data.values ? majuResponse.data.values[0] : [];
    console.log(`\n   Found ${majuHeaders.length} columns:\n`);
    majuHeaders.forEach((header, index) => {
      const col = String.fromCharCode(65 + index);
      console.log(`   ${col.padEnd(3)} (${String(index).padStart(2)}) : ${header}`);
    });

    // Get sample row
    console.log('\n   📋 Sample data (Row 2):');
    const majuSampleResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'LaporanMaju!A2:Z2',
    });
    const majuSampleRow = majuSampleResponse.data.values ? majuSampleResponse.data.values[0] : [];
    majuHeaders.forEach((header, index) => {
      const value = majuSampleRow[index] || '[empty]';
      const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
      console.log(`      ${header}: ${displayValue}`);
    });

    console.log('\n' + '═'.repeat(70));
    console.log('✅ INSPECTION COMPLETE!');
    console.log('═'.repeat(70));
    console.log('\n💡 Next: Use this column mapping to create migration scripts');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

inspectSheetColumns();
