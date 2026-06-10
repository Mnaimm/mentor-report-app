const extra = require('./extra-in-supabase.json');

console.log('═══════════════════════════════════════════════════════════');
console.log('📊 ANALYSIS OF 99 EXTRA SUPABASE RECORDS');
console.log('═══════════════════════════════════════════════════════════\n');

// Group by program
const byProgram = extra.records.reduce((acc, rec) => {
  acc[rec.program] = (acc[rec.program] || 0) + 1;
  return acc;
}, {});

console.log('By Program:');
Object.entries(byProgram).forEach(([prog, count]) => {
  console.log('  - ' + prog + ': ' + count);
});
console.log('');

// Group by creation date range
const byMonth = extra.records.reduce((acc, rec) => {
  const month = rec.createdAt.substring(0, 7); // YYYY-MM
  acc[month] = (acc[month] || 0) + 1;
  return acc;
}, {});

console.log('By Creation Month:');
Object.entries(byMonth).sort().forEach(([month, count]) => {
  console.log('  - ' + month + ': ' + count);
});
console.log('');

// Count records with NULL business names
const nullBusiness = extra.records.filter(r => !r.businessName || r.businessName === 'null').length;
console.log('Records with NULL business name: ' + nullBusiness + '\n');

// Look for test records
const testRecords = extra.records.filter(r =>
  r.menteeName && (r.menteeName.toUpperCase().includes('TEST') || r.menteeName.toUpperCase().includes('DEMO'))
);
console.log('Test/Demo records: ' + testRecords.length);
if (testRecords.length > 0) {
  testRecords.forEach(rec => {
    console.log('  - ' + rec.menteeName + ' (created: ' + rec.createdAt.substring(0, 10) + ')');
  });
}
console.log('');

// Group by mentor email to see if specific mentors have orphaned records
const byMentor = extra.records.reduce((acc, rec) => {
  const email = rec.mentorEmail || 'unknown';
  if (!acc[email]) acc[email] = [];
  acc[email].push(rec);
  return acc;
}, {});

console.log('Top 5 Mentors with Extra Records:');
Object.entries(byMentor)
  .map(([email, recs]) => ({ email, count: recs.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5)
  .forEach((item, idx) => {
    console.log('  ' + (idx+1) + '. ' + item.email + ': ' + item.count + ' records');
  });
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('💡 KEY INSIGHTS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('These 99 extra records are likely:');
console.log('');
console.log('1. EARLY SUBMISSIONS (Nov-Dec 2025)');
console.log('   - Submitted via portal before Sheets structure was finalized');
console.log('   - Data format differences prevent matching');
console.log('');
console.log('2. TEST RECORDS');
console.log('   - Found ' + testRecords.length + ' with TEST/DEMO in name');
console.log('   - Can be safely ignored or cleaned up');
console.log('');
console.log('3. NULL BUSINESS NAMES (' + nullBusiness + ' records)');
console.log('   - Portal submissions that did not capture business name');
console.log('   - Prevents matching even though record may exist in Sheets');
console.log('');
console.log('4. RECENT SUBMISSIONS (Jan-Feb 2026)');
console.log('   - May not have been synced to Sheets yet');
console.log('   - Or exist in Sheets with slight name/date differences');
console.log('');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✅ Files created for manual review:');
console.log('   - missing-final.json (100 records missing in Supabase)');
console.log('   - extra-in-supabase.json (99 records extra in Supabase)\n');
