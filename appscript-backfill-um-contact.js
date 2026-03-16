/**
 * ONE-TIME BACKFILL SCRIPT: Populate Alamat Perniagaan and Nombor Telefon in UM Sheet
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open https://docs.google.com/spreadsheets/d/1mO4Vn24QxbCO87iTKCVJn7E98ew5fxb7mTn_Yh6L2KI
 * 2. Go to Extensions → Apps Script
 * 3. Create new file, paste this entire script
 * 4. Run verifyColumnDetection() first to confirm column mapping
 * 5. Review logs, then run backfillUMAddressAndPhone()
 * 6. DELETE this script after successful backfill
 *
 * WHAT IT DOES:
 * - Cross-references Mapping spreadsheet to populate missing contact info in UM sheet
 * - Only fills BLANK cells (never overwrites existing data)
 * - Logs all operations for transparency
 */

// ==================== CONFIGURATION ====================

const MAPPING_SS_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';
const MAPPING_TAB = 'Mapping';

const UM_SS_ID = '1mO4Vn24QxbCO87iTKCVJn7E98ew5fxb7mTn_Yh6L2KI';
const UM_TAB = 'UM';

// Mapping tab column indexes (0-based)
const MAP_COL_MENTEE  = 4;  // Col E = Mentee/Usahawan name
const MAP_COL_TELEFON = 6;  // Col G = No Telefon
const MAP_COL_ALAMAT  = 7;  // Col H = Alamat

// UM tab column indexes (0-based)
const UM_COL_MENTEE  = 6;   // Col G = Nama Penuh Usahawan
const UM_COL_ALAMAT  = 9;   // Col J = Alamat Perniagaan Terkini
const UM_COL_TELEFON = 10;  // Col K = Nombor Telefon Terkini

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert 0-based column index to Excel-style letter (0 → A, 25 → Z, 26 → AA)
 */
function columnLetter_(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// ==================== STEP 1: VERIFICATION ====================

/**
 * STEP 1: Run this first to verify columns before backfill
 *
 * This function:
 * - Displays all column headers from both spreadsheets
 * - Shows sample data from first 3 rows
 * - Confirms column indexes are correct
 *
 * AFTER RUNNING: Check logs to ensure columns match expectations
 */
function verifyColumnDetection() {
  console.log('========== VERIFICATION START ==========');

  // ===== Check Mapping sheet =====
  const mappingSS = SpreadsheetApp.openById(MAPPING_SS_ID);
  const mappingSheet = mappingSS.getSheetByName(MAPPING_TAB);
  const mappingHeaders = mappingSheet.getRange(1, 1, 1, mappingSheet.getLastColumn()).getValues()[0];

  console.log('\n=== MAPPING TAB HEADERS ===');
  mappingHeaders.forEach((h, i) => {
    const col = columnLetter_(i);
    const marker = (i === MAP_COL_MENTEE || i === MAP_COL_ALAMAT || i === MAP_COL_TELEFON) ? ' ← USED' : '';
    console.log(`  ${col} (${i}): "${h}"${marker}`);
  });

  // Spot check first 3 data rows
  const mappingSample = mappingSheet.getRange(2, 1, 3, mappingSheet.getLastColumn()).getValues();
  console.log('\n=== MAPPING SAMPLE DATA (first 3 rows) ===');
  mappingSample.forEach((row, i) => {
    console.log(`  Row ${i+2}: Mentee="${row[MAP_COL_MENTEE]}" | Tel="${row[MAP_COL_TELEFON]}" | Alamat="${row[MAP_COL_ALAMAT]}"`);
  });

  // ===== Check UM sheet =====
  const umSS = SpreadsheetApp.openById(UM_SS_ID);
  const umSheet = umSS.getSheetByName(UM_TAB);
  const umHeaders = umSheet.getRange(1, 1, 1, umSheet.getLastColumn()).getValues()[0];

  console.log('\n=== UM TAB HEADERS ===');
  umHeaders.forEach((h, i) => {
    const col = columnLetter_(i);
    const marker = (i === UM_COL_MENTEE || i === UM_COL_ALAMAT || i === UM_COL_TELEFON) ? ' ← USED' : '';
    console.log(`  ${col} (${i}): "${h}"${marker}`);
  });

  // Spot check first 3 data rows
  const umSample = umSheet.getRange(2, 1, 3, umSheet.getLastColumn()).getValues();
  console.log('\n=== UM SAMPLE DATA (first 3 rows) ===');
  umSample.forEach((row, i) => {
    const mentee = row[UM_COL_MENTEE];
    const alamat = row[UM_COL_ALAMAT] || '[EMPTY]';
    const tel = row[UM_COL_TELEFON] || '[EMPTY]';
    console.log(`  Row ${i+2}: Mentee="${mentee}" | Alamat="${alamat}" | Tel="${tel}"`);
  });

  console.log('\n========== VERIFICATION COMPLETE ==========');
  console.log('✅ If all values above look correct, proceed to run backfillUMAddressAndPhone()');
  console.log('⚠️  If something looks wrong, update column indexes in configuration section');
}

// ==================== STEP 2: BACKFILL ====================

/**
 * STEP 2: Run after verifyColumnDetection confirms columns are correct
 *
 * This function:
 * - Loads all mentee data from Mapping spreadsheet
 * - Iterates through UM sheet rows
 * - Fills BLANK Alamat and Telefon cells with data from Mapping
 * - NEVER overwrites existing data
 * - Logs all operations
 *
 * AFTER RUNNING: Review logs and verify data in spreadsheet
 */
function backfillUMAddressAndPhone() {
  console.log('========== BACKFILL START ==========');

  // ===== Load Mapping lookup =====
  const mappingSS = SpreadsheetApp.openById(MAPPING_SS_ID);
  const mappingSheet = mappingSS.getSheetByName(MAPPING_TAB);
  const mappingData = mappingSheet.getDataRange().getValues();

  const mappingLookup = {};
  for (let i = 1; i < mappingData.length; i++) {
    const name = String(mappingData[i][MAP_COL_MENTEE] || '').trim();
    if (name) {
      mappingLookup[name.toLowerCase()] = {
        alamat:  String(mappingData[i][MAP_COL_ALAMAT]  || '').trim(),
        telefon: String(mappingData[i][MAP_COL_TELEFON] || '').trim()
      };
    }
  }
  console.log(`✅ Loaded ${Object.keys(mappingLookup).length} mentees from Mapping tab`);

  // ===== Load UM sheet =====
  const umSS = SpreadsheetApp.openById(UM_SS_ID);
  const umSheet = umSS.getSheetByName(UM_TAB);
  const umData = umSheet.getDataRange().getValues();
  console.log(`📊 UM sheet has ${umData.length - 1} data rows (excluding header)`);

  // ===== Process each row =====
  let updated = 0;
  let alreadyHasData = 0;
  let notFound = 0;
  let skipped = 0;

  for (let i = 1; i < umData.length; i++) {
    const row = umData[i];
    const menteeName = String(row[UM_COL_MENTEE] || '').trim();

    // Skip rows without mentee name
    if (!menteeName) {
      skipped++;
      continue;
    }

    const currentAlamat  = String(row[UM_COL_ALAMAT]  || '').trim();
    const currentTelefon = String(row[UM_COL_TELEFON] || '').trim();

    // Skip rows that already have both values
    if (currentAlamat && currentTelefon) {
      alreadyHasData++;
      continue;
    }

    // Look up in Mapping
    const found = mappingLookup[menteeName.toLowerCase()];
    if (!found) {
      console.log(`⚠️ Row ${i+1}: Not in Mapping → "${menteeName}"`);
      notFound++;
      continue;
    }

    // Only write to EMPTY cells - never overwrite existing data
    let didUpdate = false;

    if (!currentAlamat && found.alamat) {
      umSheet.getRange(i + 1, UM_COL_ALAMAT + 1).setValue(found.alamat);
      didUpdate = true;
    }

    if (!currentTelefon && found.telefon) {
      umSheet.getRange(i + 1, UM_COL_TELEFON + 1).setValue(found.telefon);
      didUpdate = true;
    }

    if (didUpdate) {
      updated++;
      console.log(`✅ Row ${i+1}: "${menteeName}" → Alamat: "${found.alamat}" | Tel: "${found.telefon}"`);
    } else {
      // Found in mapping but no updates needed (partial data exists)
      alreadyHasData++;
    }
  }

  // ===== Summary =====
  console.log('\n========== BACKFILL COMPLETE ==========');
  console.log(`✅ Updated:             ${updated} rows`);
  console.log(`⏭️  Already had data:   ${alreadyHasData} rows`);
  console.log(`⚠️  Not in Mapping:     ${notFound} rows`);
  console.log(`⏭️  Skipped (no name):  ${skipped} rows`);
  console.log('=======================================');
  console.log('🔍 Verify data in spreadsheet, then DELETE this script.');
}
