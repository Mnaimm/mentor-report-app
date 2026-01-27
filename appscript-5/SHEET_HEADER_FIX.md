# Sheet Header Issues and Fixes

## Issues Found:

### 1. **Column Position Off by 1**
- Your `Status` is at column 53 (script expects 52)
- Your `DOC_URL` is at column 54 (script expects 53)

### 2. **Trailing Spaces**
- Column 64: `UM_PENDAPATAN_SEMASA ` (has space at end)
- Column 70: `UM_ASET_TUNAI_SEMASA ` (has space at end)

### 3. **Duplicate Columns**
- Column 81: `UM_PENDAPATAN_SEMASA` (duplicate of column 64)
- Column 82: `UM_ASET_TUNAI_SEMASA` (duplicate of column 70)

### 4. **Extra Column**
- You have 83 columns, should have 81

---

## Solution: Fix Your Google Sheet (Recommended)

### Step 1: Remove Trailing Spaces
1. Open your Bangkit sheet
2. **Column 64 (BL1)**: Change `UM_PENDAPATAN_SEMASA ` → `UM_PENDAPATAN_SEMASA`
3. **Column 70 (BR1)**: Change `UM_ASET_TUNAI_SEMASA ` → `UM_ASET_TUNAI_SEMASA`

### Step 2: Delete Duplicate Columns
1. **Right-click column CC** (column 81) → Delete column
2. **Right-click column CC** (column 82, now 81) → Delete column

After deletion, you'll have 81 columns.

### Step 3: Check Column 52
What is in column 52 (BA1) of your sheet? It should be empty or you need to identify what's there.

You can check by running this in Apps Script:
```javascript
function checkColumn52() {
  const ss = SpreadsheetApp.openById('1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w');
  const sheet = ss.getSheetByName('Bangkit');
  const col52Value = sheet.getRange(1, 52).getValue();
  console.log('Column 52 header:', col52Value);
}
```

### Step 4: After Fixing
Your sheet should have exactly **81 columns** (A through CC):
- Columns 1-51: Session data
- Column 52: Status
- Column 53: DOC_URL
- Columns 54-81: UM fields (28 columns)

---

## Alternative: Update Apps Script Comments

If you don't want to change the sheet, just update the comments in Code.js to match reality:

```javascript
// Bangkit Sheet Headers (83 columns: A-CE) - ACTUAL STRUCTURE
// Columns A-AZ (0-51): Session data
// Column BA (52): ??? (unknown/empty)
// Column BB (53): Status (Apps Script fills)
// Column BC (54): DOC_URL (Apps Script fills)
// Columns BD-CE (55-83): Upward Mobility data (29 columns)
```

But this means there's an extra mystery column at 52. Better to fix the sheet!

---

## Quick Test After Fixing

Run this to verify:
```javascript
function verifySheetStructure() {
  const ss = SpreadsheetApp.openById('1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w');
  const sheet = ss.getSheetByName('Bangkit');

  const totalCols = sheet.getLastColumn();
  console.log('Total columns:', totalCols, '(should be 81)');

  const headers = sheet.getRange(1, 1, 1, totalCols).getValues()[0];

  // Check Status position
  const statusIdx = headers.indexOf('Status');
  console.log('Status at column:', statusIdx + 1, '(should be 52)');

  // Check DOC_URL position
  const docUrlIdx = headers.indexOf('DOC_URL');
  console.log('DOC_URL at column:', docUrlIdx + 1, '(should be 53)');

  // Check for duplicates
  const duplicates = headers.filter((h, i) => h && headers.indexOf(h) !== i);
  if (duplicates.length > 0) {
    console.error('❌ Found duplicates:', duplicates);
  } else {
    console.log('✅ No duplicates found');
  }

  // Check for trailing spaces
  const withSpaces = headers.map((h, i) => h !== h.trim() ? `Column ${i+1}: "${h}"` : null).filter(Boolean);
  if (withSpaces.length > 0) {
    console.error('❌ Found trailing spaces:', withSpaces);
  } else {
    console.log('✅ No trailing spaces');
  }
}
```

---

## What Column 52 Should Be

Looking at the original spec from submitBangkit.js:
- Columns 0-51 (A-AZ): Session data (52 columns)
- Columns 52-53 (BA-BB): Status, DOC_URL (2 columns)
- Columns 54-81 (BC-CB): UM data (28 columns)
- **Total: 82 columns**

But your sheet shows Status at 53, meaning column 52 has something unexpected.

**Most likely**: Column 52 should not exist, or it's a leftover column that needs to be deleted.
