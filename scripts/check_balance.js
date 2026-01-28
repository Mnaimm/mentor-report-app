const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../pages/laporan-bangkit.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let startLine = 983; // 0-indexed (line 984)
let endLine = 1490;

let openBraces = 0;
let openParens = 0;
let openTags = 0;

console.log('Checking balance from line ' + (startLine + 1) + ' to ' + (endLine + 1));

for (let i = startLine; i <= endLine; i++) {
    const line = lines[i];
    for (let char of line) {
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '(') openParens++;
        if (char === ')') openParens--;
        // Simple tag check (naive)
        if (char === '<') openTags++;
        if (char === '>') openTags--;
    }
    if (openBraces < 0) console.log(`LINE ${i + 1}: Negative Braces count!`);
    if (openParens < 0) console.log(`LINE ${i + 1}: Negative Parens count!`);
}

console.log(`Final Counts at line ${endLine + 1}:`);
console.log('Braces:', openBraces);
console.log('Parens:', openParens);
console.log('Tags:', openTags);
