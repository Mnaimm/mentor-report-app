
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'sync-data', 'LaporanMajuUM.json');

try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Loaded ${data.length} rows.`);

    let missingNameCount = 0;
    data.forEach((row, index) => {
        if (!row.NAMA_MENTEE) {
            console.log(`Row ${index + 1} missing NAMA_MENTEE. Keys found:`, Object.keys(row));
            missingNameCount++;
        }
    });

    if (missingNameCount === 0) {
        console.log('✅ All rows have NAMA_MENTEE.');
    } else {
        console.log(`❌ ${missingNameCount} rows missing NAMA_MENTEE.`);
    }

} catch (err) {
    console.error('Error reading/parsing file:', err);
}
