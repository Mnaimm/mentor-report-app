const fs = require('fs');

const data = JSON.parse(fs.readFileSync('sync-data/LaporanMajuUM.json', 'utf8'));
console.log('Total records:', data.length);

// Find a Session 2 record
const record = data.find(r => r.SESI_NUMBER == 2);

if (record) {
    console.log('\n=== Sample Session 2 Record ===');
    console.log('NAMA_MENTEE:', record.NAMA_MENTEE);
    console.log('SESI_NUMBER:', record.SESI_NUMBER);
    console.log('Has URL_GAMBAR_SESI_JSON:', !!record.URL_GAMBAR_SESI_JSON);
    console.log('URL_GAMBAR_SESI_JSON:', record.URL_GAMBAR_SESI_JSON);
    console.log('Has MENTORING_FINDINGS_JSON:', !!record.MENTORING_FINDINGS_JSON);
    console.log('MENTORING_FINDINGS_JSON:', record.MENTORING_FINDINGS_JSON);

    console.log('\n=== Field names containing GAMBAR or FINDINGS ===');
    console.log(Object.keys(record).filter(k => k.includes('GAMBAR') || k.includes('FINDINGS')));

    console.log('\n=== ALL Field names ===');
    console.log(Object.keys(record).join(', '));
} else {
    console.log('No Session 2 record found');
}
