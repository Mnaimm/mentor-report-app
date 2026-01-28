const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../pages/laporan-maju-um.js');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find start of duplicate ("3. Buka akaun Al-Awfar")
// Note: Item 2 was deleted, so Item 3 is the new start of duplicates.
const startMarker = '3. Buka akaun Al-Awfar (Opened Al-Awfar Account)';
let startIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startMarker)) {
        // The wrapper div is the previous line
        startIndex = i - 1;
        break;
    }
}

if (startIndex === -1) {
    console.error('Start marker not found!');
    process.exit(1);
}

// Find end of duplicate (Start of Lampiran Gambar)
const endMarker = 'Section title="Lampiran Gambar"';
let endIndex = -1;

for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].includes(endMarker)) {
        // The wrapper div for Lampiran is the previous line
        endIndex = i - 1;
        break;
    }
}

if (endIndex === -1) {
    console.error('End marker not found!');
    process.exit(1);
}

console.log(`Deleting duplicates from line ${startIndex + 1} to ${endIndex}`);
console.log('Start Line Content:', lines[startIndex]);
console.log('End Line Content (will be Kept? No, this is the Lampiran wrapper, so delete up to endIndex-1):', lines[endIndex]);

// Wait, endIndex is the Lampiran wrapper line. We want to KEEP it.
// So we delete from startIndex to endIndex - 1.

const newLines = [
    ...lines.slice(0, startIndex),
    ...lines.slice(endIndex)
];

const newContent = newLines.join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully removed duplicates.');
