const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Sheets setup
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString()
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Sheet IDs
const BANGKIT_SHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const MAJU_SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID;

// Normalize string for comparison
function normalizeString(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

// Create a unique key for matching
// Using only: mentor + mentee + session + date (excluding business name to avoid NULL mismatch issues)
function createMatchKey(record) {
  const mentorEmail = normalizeString(record.mentorEmail || record.email_mentor || '');
  const menteeName = normalizeString(record.menteeName || record.nama_usahawan || record.entrepreneurName || '');
  const session = normalizeString(record.sessionNumber || record.sesi_laporan || record.sesiLaporan || '');
  const date = normalizeString(record.sessionDate || record.tarikh_sesi || record.tarikhSesi || '');

  return `${mentorEmail}|${menteeName}|${session}|${date}`;
}

// Fetch data from Google Sheets
async function fetchSheetData(sheetId, tabName, programType) {
  console.log(`📥 Fetching data from ${tabName} (${programType})...`);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A2:ZZ`, // Get all data from row 2 onwards
    });

    const rows = response.data.values || [];
    console.log(`   Found ${rows.length} rows in ${tabName}`);

    // Parse rows into structured data
    const records = rows.map((row, index) => {
      // Different column mappings for Bangkit vs Maju
      if (programType === 'bangkit') {
        return {
          rowNumber: index + 2,
          program: 'bangkit',
          timestamp: row[0],
          mentorEmail: row[1],
          status: row[2],
          sessionNumber: row[3],
          sessionDate: row[4],
          sessionTime: row[5],
          sessionMode: row[6],
          menteeName: row[7],
          menteeIC: row[8],
          mentorName: row[9],
          docUrl: row[row.length - 1], // Usually last column
          rawRow: row,
        };
      } else {
        // Maju UM format - CORRECT column mapping based on actual headers
        return {
          rowNumber: index + 2,
          program: 'maju',
          timestamp: row[0],           // Timestamp
          mentorEmail: row[2],         // EMAIL_MENTOR (index 2, not 1!)
          mentorName: row[1],          // NAMA_MENTOR
          menteeName: row[3],          // NAMA_MENTEE
          menteeIC: row[4],            // NAMA_BISNES
          sessionNumber: row[9],       // SESI_NUMBER (index 9, not 3!)
          sessionDate: row[8],         // TARIKH_SESI (index 8, not 4!)
          sessionTime: row[12] + '-' + row[13], // MASA_MULA - MASA_TAMAT
          sessionMode: row[10],        // MOD_SESI
          status: row[27] || 'Selesai', // MIA_STATUS (default to Selesai if empty)
          docUrl: row[26] || row[row.length - 1], // Laporan_Maju_Doc_ID
          rawRow: row,
        };
      }
    });

    return records;
  } catch (error) {
    console.error(`   ❌ Error fetching ${tabName}:`, error.message);
    return [];
  }
}

// Main comparison function
async function compareData() {
  console.log('🔍 DEEP DIVE: Google Sheets vs Supabase Comparison\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Fetch all data from Supabase
  console.log('📊 Step 1: Fetching Supabase data...');
  const { data: supabaseRecords, error: supabaseError } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: true });

  if (supabaseError) {
    console.error('❌ Error fetching Supabase data:', supabaseError);
    return;
  }

  console.log(`   ✅ Fetched ${supabaseRecords.length} records from Supabase\n`);

  // Step 2: Fetch all data from Google Sheets
  console.log('📊 Step 2: Fetching Google Sheets data...');

  const bangkitRecords = await fetchSheetData(BANGKIT_SHEET_ID, 'Bangkit', 'bangkit');
  const majuRecords = await fetchSheetData(MAJU_SHEET_ID, 'LaporanMajuUM', 'maju');

  const allSheetRecords = [...bangkitRecords, ...majuRecords];

  console.log(`\n   ✅ Total Google Sheets records: ${allSheetRecords.length}`);
  console.log(`      - Bangkit: ${bangkitRecords.length}`);
  console.log(`      - Maju: ${majuRecords.length}\n`);

  // Step 3: Create match keys and compare
  console.log('📊 Step 3: Matching records...\n');

  const sheetsMap = new Map();
  const supabaseMap = new Map();

  // Build Sheets map
  allSheetRecords.forEach(record => {
    const key = createMatchKey(record);
    if (!sheetsMap.has(key)) {
      sheetsMap.set(key, []);
    }
    sheetsMap.get(key).push(record);
  });

  // Build Supabase map
  supabaseRecords.forEach(record => {
    const key = createMatchKey({
      mentorEmail: record.mentor_email || record.email_mentor,
      menteeName: record.nama_usahawan || record.mentee_name,
      menteeIC: record.nama_bisnes || record.mentee_ic || record.no_kp_usahawan,
      sessionNumber: record.session_number ? `Sesi #${record.session_number}` : (record.sesi_laporan || ''),
      sessionDate: record.session_date || record.tarikh_sesi || '',
    });
    if (!supabaseMap.has(key)) {
      supabaseMap.set(key, []);
    }
    supabaseMap.get(key).push(record);
  });

  // Step 4: Categorize records
  const matched = [];
  const onlyInSheets = [];
  const onlyInSupabase = [];
  const duplicatesInSheets = [];
  const duplicatesInSupabase = [];

  // Check Sheets records
  sheetsMap.forEach((sheetsRecordsArray, key) => {
    const supabaseRecordsArray = supabaseMap.get(key);

    if (supabaseRecordsArray) {
      // Record exists in both systems
      matched.push({
        key,
        sheetsCount: sheetsRecordsArray.length,
        supabaseCount: supabaseRecordsArray.length,
        sheetsRecords: sheetsRecordsArray,
        supabaseRecords: supabaseRecordsArray,
      });

      // Check for duplicates
      if (sheetsRecordsArray.length > 1) {
        duplicatesInSheets.push({ key, records: sheetsRecordsArray });
      }
      if (supabaseRecordsArray.length > 1) {
        duplicatesInSupabase.push({ key, records: supabaseRecordsArray });
      }
    } else {
      // Record only in Sheets
      onlyInSheets.push({
        key,
        records: sheetsRecordsArray,
      });
    }
  });

  // Check for records only in Supabase
  supabaseMap.forEach((supabaseRecordsArray, key) => {
    if (!sheetsMap.has(key)) {
      onlyInSupabase.push({
        key,
        records: supabaseRecordsArray,
      });
    }
  });

  // Step 5: Generate Report
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 COMPARISON RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Google Sheets records: ${allSheetRecords.length}`);
  console.log(`Total Supabase records: ${supabaseRecords.length}`);
  console.log(`Difference: ${Math.abs(allSheetRecords.length - supabaseRecords.length)}\n`);

  console.log(`Matched (in both systems): ${matched.length} unique combinations`);
  console.log(`Only in Google Sheets: ${onlyInSheets.length} combinations`);
  console.log(`Only in Supabase: ${onlyInSupabase.length} combinations\n`);

  console.log(`Duplicates in Google Sheets: ${duplicatesInSheets.length} combinations`);
  console.log(`Duplicates in Supabase: ${duplicatesInSupabase.length} combinations\n`);

  // Detailed breakdown of "Only in Sheets"
  if (onlyInSheets.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 RECORDS ONLY IN GOOGLE SHEETS (Missing in Supabase)');
    console.log('═══════════════════════════════════════════════════════════\n');

    onlyInSheets.forEach((item, index) => {
      const record = item.records[0];
      console.log(`${index + 1}. ${record.program.toUpperCase()} - Row ${record.rowNumber}`);
      console.log(`   Mentor: ${record.mentorName} (${record.mentorEmail})`);
      console.log(`   Mentee: ${record.menteeName} (${record.menteeIC})`);
      console.log(`   Session: ${record.sessionNumber} on ${record.sessionDate}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Match Key: ${item.key}\n`);
    });
  }

  // Detailed breakdown of "Only in Supabase"
  if (onlyInSupabase.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 RECORDS ONLY IN SUPABASE (Not in Google Sheets)');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('These are likely duplicates or sync artifacts\n');

    onlyInSupabase.forEach((item, index) => {
      item.records.forEach((record, i) => {
        console.log(`${index + 1}.${i + 1} ID: ${record.id}`);
        console.log(`   Mentor: ${record.mentor_name || record.nama_mentor} (${record.mentor_email || record.email_mentor})`);
        console.log(`   Mentee: ${record.mentee_name || record.nama_usahawan} (${record.mentee_ic || record.no_kp_usahawan})`);
        console.log(`   Session: ${record.sesi_laporan} on ${record.tarikh_sesi}`);
        console.log(`   Program: ${record.program_type}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   Created: ${record.created_at}`);
        console.log(`   PDF: ${record.doc_url || 'N/A'}`);
        console.log(`   Match Key: ${item.key}\n`);
      });
    });
  }

  // Matched records with mismatched counts
  const mismatchedCounts = matched.filter(m => m.sheetsCount !== m.supabaseCount);
  if (mismatchedCounts.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚠️  MATCHED RECORDS WITH DIFFERENT COUNTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('These records exist in both systems but have different counts\n');

    mismatchedCounts.forEach((item, index) => {
      console.log(`${index + 1}. Match Key: ${item.key}`);
      console.log(`   Sheets count: ${item.sheetsCount}`);
      console.log(`   Supabase count: ${item.supabaseCount}`);
      console.log(`   Sample record:`);
      const sample = item.sheetsRecords[0];
      console.log(`   - ${sample.mentorName} → ${sample.menteeName}`);
      console.log(`   - Session ${sample.sessionNumber} on ${sample.sessionDate}\n`);
    });
  }

  // Export detailed data to JSON
  const exportData = {
    summary: {
      totalSheets: allSheetRecords.length,
      totalSupabase: supabaseRecords.length,
      difference: Math.abs(allSheetRecords.length - supabaseRecords.length),
      matchedCombinations: matched.length,
      onlyInSheetsCount: onlyInSheets.length,
      onlyInSupabaseCount: onlyInSupabase.length,
      duplicatesInSheetsCount: duplicatesInSheets.length,
      duplicatesInSupabaseCount: duplicatesInSupabase.length,
    },
    matched,
    onlyInSheets,
    onlyInSupabase,
    duplicatesInSheets,
    duplicatesInSupabase,
    mismatchedCounts,
  };

  fs.writeFileSync(
    'comparison-report.json',
    JSON.stringify(exportData, null, 2)
  );

  console.log('\n\n✅ Detailed comparison report exported to: comparison-report.json\n');

  // Summary recommendations
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (onlyInSupabase.length > 0) {
    const totalOnlyInSupabase = onlyInSupabase.reduce((sum, item) => sum + item.records.length, 0);
    console.log(`1. REMOVE ${totalOnlyInSupabase} duplicate/orphaned records from Supabase`);
    console.log(`   These records don't exist in Google Sheets (source of truth)`);
  }

  if (onlyInSheets.length > 0) {
    console.log(`\n2. SYNC ${onlyInSheets.length} missing records to Supabase`);
    console.log(`   These records exist in Sheets but not in Supabase`);
  }

  if (duplicatesInSupabase.length > 0) {
    console.log(`\n3. DEDUPLICATE ${duplicatesInSupabase.length} combinations in Supabase`);
    console.log(`   Keep only the record with PDF URL (oldest)`);
  }

  console.log('\n');
}

compareData().catch(console.error);
