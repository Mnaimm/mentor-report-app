/**
 * LIST FAILED SYNC RECORDS
 * Run: node scripts/list-failed-records.js
 *
 * Purpose: Identify records that failed during sync
 */

const fs = require('fs');
const path = require('path');

// Read the Maju data file
const majuPath = path.join(__dirname, '..', 'sync-data', 'LaporanMajuUM.json');
const majuData = JSON.parse(fs.readFileSync(majuPath, 'utf8'));

console.log('\n' + '='.repeat(70));
console.log('🔍 FAILED MAJU RECORDS ANALYSIS');
console.log('='.repeat(70));

const failedRecords = [];

// Check each record for date format issues
majuData.forEach((row, index) => {
  const rowNum = index + 1;
  const date = row.TARIKH_SESI;

  // Check if date is in DD/MM/YYYY format (problematic)
  if (date && typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    failedRecords.push({
      rowNum: rowNum,
      entrepreneurName: row.NAMA_MENTEE,
      mentorName: row.NAMA_MENTOR,
      mentorEmail: row.EMAIL_MENTOR,
      sessionNumber: row.SESI_NUMBER,
      problematicDate: date,
      businessName: row.NAMA_BISNES,
      timestamp: row.Timestamp
    });
  }
});

if (failedRecords.length === 0) {
  console.log('\n✅ No failed records found! All dates are in correct format.\n');
  console.log('='.repeat(70));
  process.exit(0);
}

console.log(`\n⚠️  Found ${failedRecords.length} records with date format issues:\n`);
console.log('These records have dates in DD/MM/YYYY format instead of ISO format.');
console.log('They need to be corrected in the Google Sheet.\n');
console.log('='.repeat(70));

failedRecords.forEach((record, index) => {
  console.log(`\n${index + 1}. Row ${record.rowNum} in JSON (approx row ${record.rowNum + 1} in Sheet)`);
  console.log('   ' + '-'.repeat(66));
  console.log(`   Entrepreneur: ${record.entrepreneurName}`);
  console.log(`   Business:     ${record.businessName || 'N/A'}`);
  console.log(`   Mentor:       ${record.mentorName} (${record.mentorEmail})`);
  console.log(`   Session:      ${record.sessionNumber}`);
  console.log(`   ❌ PROBLEM:   TARIKH_SESI = "${record.problematicDate}"`);
  console.log(`   ✅ SHOULD BE: ISO format like "2026-01-26T16:00:00.000Z"`);
  console.log(`   📅 Timestamp: ${record.timestamp}`);
});

console.log('\n' + '='.repeat(70));
console.log('\n📋 SUMMARY OF ISSUES:\n');
console.log(`   Total failed records: ${failedRecords.length}`);
console.log(`   Issue type: Date format (DD/MM/YYYY instead of ISO)`);

console.log('\n💡 HOW TO FIX:\n');
console.log('   Option 1: In Google Sheet');
console.log('   ─────────────────────────');
console.log('   1. Open the Google Sheet tab "LaporanMajuUM"');
console.log('   2. Find the TARIKH_SESI column');
console.log('   3. For the rows listed above, ensure the date cells are:');
console.log('      - Formatted as Date (not Text)');
console.log('      - Using Google Sheets date picker or proper date formula');
console.log('   4. Re-export and sync\n');

console.log('   Option 2: Direct database fix (Advanced)');
console.log('   ─────────────────────────────────────────');
console.log('   1. Use the fix script we can create to parse and insert these manually');
console.log('   2. Or manually edit in Supabase dashboard\n');

console.log('='.repeat(70));

// Export failed records to JSON for reference
const outputPath = path.join(__dirname, '..', 'failed-maju-records.json');
fs.writeFileSync(outputPath, JSON.stringify(failedRecords, null, 2));

console.log(`\n📁 Detailed report saved to: failed-maju-records.json`);
console.log('='.repeat(70) + '\n');
