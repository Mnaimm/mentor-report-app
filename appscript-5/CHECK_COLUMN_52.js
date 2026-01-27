/**
 * Quick diagnostic: What's in column 52?
 * Add this to your Apps Script and run it
 */

function checkColumn52() {
  console.log('=== CHECKING COLUMN 52 ===');

  const ss = SpreadsheetApp.openById('1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w');
  const sheet = ss.getSheetByName('Bangkit');

  // Get column 52 header
  const col52Header = sheet.getRange(1, 52).getValue();
  console.log('Column 52 (BA1) header:', `"${col52Header}"`);
  console.log('Is empty?', col52Header === '' || col52Header === null);

  // Check columns 51-55 to see the area
  console.log('\n=== COLUMNS 51-55 AREA ===');
  for (let col = 51; col <= 55; col++) {
    const header = sheet.getRange(1, col).getValue();
    console.log(`Column ${col}: "${header}"`);
  }

  // Check if column 52 has any data
  const lastRow = sheet.getLastRow();
  let hasData = false;
  for (let row = 2; row <= Math.min(lastRow, 10); row++) {
    const value = sheet.getRange(row, 52).getValue();
    if (value !== '' && value !== null) {
      hasData = true;
      console.log(`Row ${row}, Column 52 has data:`, value);
    }
  }

  if (!hasData) {
    console.log('\n✅ Column 52 appears to be empty - safe to delete');
  } else {
    console.log('\n⚠️ Column 52 has data - investigate before deleting');
  }

  console.log('\n=== RECOMMENDATION ===');
  if (col52Header === '' || col52Header === null) {
    console.log('Column 52 is empty. You should DELETE this column.');
    console.log('Steps:');
    console.log('1. Open your Bangkit sheet');
    console.log('2. Right-click on column BA (column 52) header');
    console.log('3. Select "Delete column"');
    console.log('4. This will shift Status to column 52 and DOC_URL to column 53');
  } else {
    console.log(`Column 52 has header: "${col52Header}"`);
    console.log('Investigate what this column is for before deleting.');
  }
}
