/**
 * DEBUG SCRIPT - Check Header Mapping
 * Run this in your Apps Script to see what headers exist vs what the script expects
 */

function debugHeaderMapping() {
  console.log('=== DEBUGGING HEADER MAPPING ===');

  try {
    // Open sheet
    const REPORT_SHEET_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';
    const REPORT_SHEET_NAME = 'Bangkit';

    const ss = SpreadsheetApp.openById(REPORT_SHEET_ID);
    const sheet = ss.getSheetByName(REPORT_SHEET_NAME);

    if (!sheet) {
      console.error('ERROR: Sheet "Bangkit" not found!');
      console.log('Available sheets:', ss.getSheets().map(s => s.getName()).join(', '));
      return;
    }

    console.log('✅ Sheet found:', REPORT_SHEET_NAME);

    // Get headers
    const lastCol = sheet.getLastColumn();
    console.log('Total columns:', lastCol);

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    console.log('Total headers found:', headers.length);

    // Check critical headers
    const criticalHeaders = [
      'Status',
      'DOC_URL',
      'Nama Usahawan',
      'Sesi Laporan',
      'UM_STATUS_PENGLIBATAN',
      'UM_PENDAPATAN_SEMASA'
    ];

    console.log('\n=== CRITICAL HEADERS CHECK ===');
    criticalHeaders.forEach(headerName => {
      const index = headers.indexOf(headerName);
      if (index === -1) {
        console.error(`❌ MISSING: "${headerName}"`);
      } else {
        console.log(`✅ FOUND: "${headerName}" at column ${index + 1}`);
      }
    });

    // Show first 20 headers
    console.log('\n=== FIRST 20 HEADERS ===');
    headers.slice(0, 20).forEach((h, i) => {
      console.log(`Column ${i + 1}: "${h}"`);
    });

    // Show last 30 headers (UM section)
    console.log('\n=== LAST 30 HEADERS (UM Section) ===');
    const startIdx = Math.max(0, headers.length - 30);
    headers.slice(startIdx).forEach((h, i) => {
      console.log(`Column ${startIdx + i + 1}: "${h}"`);
    });

    // Check row 2 data
    console.log('\n=== ROW 2 DATA CHECK ===');
    const lastRow = sheet.getLastRow();
    console.log('Total rows:', lastRow);

    if (lastRow >= 2) {
      const namaUsahawanIdx = headers.indexOf('Nama Usahawan');
      const sesiIdx = headers.indexOf('Sesi Laporan');

      if (namaUsahawanIdx !== -1) {
        const namaUsahawan = sheet.getRange(2, namaUsahawanIdx + 1).getValue();
        console.log('Row 2 - Nama Usahawan:', namaUsahawan);
      }

      if (sesiIdx !== -1) {
        const sesi = sheet.getRange(2, sesiIdx + 1).getValue();
        console.log('Row 2 - Sesi Laporan:', sesi);
      }
    } else {
      console.log('⚠️ No data rows found (only header row exists)');
    }

    console.log('\n=== DEBUG COMPLETE ===');

  } catch (err) {
    console.error('DEBUG ERROR:', err.toString());
    console.error('Stack:', err.stack);
  }
}

/**
 * Test if we can access row 2
 */
function debugRow2Access() {
  console.log('=== TESTING ROW 2 ACCESS ===');

  try {
    const REPORT_SHEET_ID = '1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w';
    const REPORT_SHEET_NAME = 'Bangkit';

    const ss = SpreadsheetApp.openById(REPORT_SHEET_ID);
    const sheet = ss.getSheetByName(REPORT_SHEET_NAME);

    if (!sheet) {
      console.error('Sheet not found');
      return;
    }

    // Get headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Build column index
    const idx = {};
    headers.forEach((header, i) => {
      if (header) {
        idx[String(header)] = i + 1; // 1-indexed
      }
    });

    console.log('Column index built. Total keys:', Object.keys(idx).length);

    // Try to access Status column
    const statusColIdx = idx['Status'];
    console.log('Status column index:', statusColIdx);

    if (statusColIdx) {
      const statusValue = sheet.getRange(2, statusColIdx).getValue();
      console.log('Row 2 Status value:', statusValue);
    } else {
      console.error('❌ Status column not found in index!');
      console.log('Available columns starting with "S":',
        Object.keys(idx).filter(k => k.startsWith('S')).join(', '));
    }

    // Try to access DOC_URL column
    const docUrlColIdx = idx['DOC_URL'];
    console.log('DOC_URL column index:', docUrlColIdx);

    if (docUrlColIdx) {
      const docUrlValue = sheet.getRange(2, docUrlColIdx).getValue();
      console.log('Row 2 DOC_URL value:', docUrlValue);
    } else {
      console.error('❌ DOC_URL column not found in index!');
      console.log('Available columns starting with "D":',
        Object.keys(idx).filter(k => k.startsWith('D')).join(', '));
    }

    console.log('\n=== TEST COMPLETE ===');

  } catch (err) {
    console.error('TEST ERROR:', err.toString());
    console.error('Stack:', err.stack);
  }
}
