const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Normalize string for comparison
function normalizeString(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

// Parse session number from "Sesi #1" format
function parseSessionNumber(sesiLaporan) {
  if (!sesiLaporan) return undefined;
  const match = sesiLaporan.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : undefined;
}

// Create a match key for comparison
function createMatchKey(record) {
  const mentorEmail = normalizeString(record.mentorEmail || '');
  const menteeName = normalizeString(record.menteeName || '');
  const menteeIC = normalizeString(record.menteeIC || '');
  const session = normalizeString(record.sessionNumber || '');
  const date = normalizeString(record.sessionDate || '');

  // Use multiple keys for better matching
  return {
    primary: `${mentorEmail}|${menteeName}|${session}`,
    withIC: `${mentorEmail}|${menteeIC}|${session}`,
    withDate: `${mentorEmail}|${menteeName}|${session}|${date}`,
    full: `${mentorEmail}|${menteeName}|${menteeIC}|${session}|${date}`,
  };
}

async function compareData() {
  console.log('🔍 DEEP DIVE: Google Sheets vs Supabase Comparison (v2)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Load Google Sheets data from exported JSON
  console.log('📊 Step 1: Loading Google Sheets data from JSON files...');

  const bangkitPath = path.join(process.cwd(), 'sync-data', 'bangkit.json');
  const majuPath = path.join(process.cwd(), 'sync-data', 'LaporanMajuUM.json');

  if (!fs.existsSync(bangkitPath)) {
    console.error(`❌ File not found: ${bangkitPath}`);
    console.log('\n💡 Run this first: node scripts/export-sheets-to-json.js\n');
    return;
  }

  const bangkitData = JSON.parse(fs.readFileSync(bangkitPath, 'utf8'));
  const majuData = fs.existsSync(majuPath) ? JSON.parse(fs.readFileSync(majuPath, 'utf8')) : [];

  // Parse Google Sheets data
  const sheetsRecords = [];

  // Process Bangkit records
  bangkitData.forEach((row, index) => {
    sheetsRecords.push({
      rowNumber: index + 2,
      program: 'bangkit',
      mentorEmail: row.Email || row.Emai,
      mentorName: row['Nama Mentor'],
      menteeName: row['Nama Usahawan'],
      menteeIC: row['No. KP'],
      sessionNumber: parseSessionNumber(row['Sesi Laporan']),
      sessionDate: row['Tarikh Sesi'],
      status: row['Status Sesi'] || 'Selesai',
      docUrl: row['Pautan Dokumen'],
      timestamp: row.Timestamp,
      rawRow: row,
    });
  });

  // Process Maju records
  majuData.forEach((row, index) => {
    sheetsRecords.push({
      rowNumber: index + 2,
      program: 'maju',
      mentorEmail: row.Email || row.Emai,
      mentorName: row['Nama Mentor'],
      menteeName: row['Nama Usahawan'],
      menteeIC: row['No. KP'],
      sessionNumber: parseSessionNumber(row['Sesi Laporan']),
      sessionDate: row['Tarikh Sesi'],
      status: row['Status Sesi'] || 'Selesai',
      docUrl: row['Pautan Dokumen'],
      timestamp: row.Timestamp,
      rawRow: row,
    });
  });

  console.log(`   ✅ Loaded ${bangkitData.length} Bangkit records`);
  console.log(`   ✅ Loaded ${majuData.length} Maju records`);
  console.log(`   📊 Total Google Sheets records: ${sheetsRecords.length}\n`);

  // Step 2: Fetch Supabase data
  console.log('📊 Step 2: Fetching Supabase data...');
  const { data: supabaseRecords, error: supabaseError } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: true });

  if (supabaseError) {
    console.error('❌ Error fetching Supabase data:', supabaseError);
    return;
  }

  console.log(`   ✅ Fetched ${supabaseRecords.length} records from Supabase\n`);

  // Step 3: Create lookup maps
  console.log('📊 Step 3: Creating match keys and comparing...\n');

  const sheetsMap = new Map();
  const supabaseMap = new Map();

  // Build Sheets map
  sheetsRecords.forEach(record => {
    const keys = createMatchKey({
      mentorEmail: record.mentorEmail,
      menteeName: record.menteeName,
      menteeIC: record.menteeIC,
      sessionNumber: record.sessionNumber,
      sessionDate: record.sessionDate,
    });

    // Store by primary key
    const primaryKey = keys.primary;
    if (!sheetsMap.has(primaryKey)) {
      sheetsMap.set(primaryKey, []);
    }
    sheetsMap.get(primaryKey).push({ ...record, matchKeys: keys });
  });

  // Build Supabase map
  supabaseRecords.forEach(record => {
    const keys = createMatchKey({
      mentorEmail: record.mentor_email || record.email_mentor,
      menteeName: record.mentee_name || record.nama_usahawan,
      menteeIC: record.mentee_ic || record.no_kp_usahawan,
      sessionNumber: record.sesi_laporan || record.session_number,
      sessionDate: record.tarikh_sesi || record.session_date,
    });

    const primaryKey = keys.primary;
    if (!supabaseMap.has(primaryKey)) {
      supabaseMap.set(primaryKey, []);
    }
    supabaseMap.get(primaryKey).push({ ...record, matchKeys: keys });
  });

  // Step 4: Compare and categorize
  const matched = [];
  const onlyInSheets = [];
  const onlyInSupabase = [];
  const multipleInSheets = [];
  const multipleInSupabase = [];

  // Check Sheets records
  sheetsMap.forEach((sheetsGroup, key) => {
    const supabaseGroup = supabaseMap.get(key);

    if (supabaseGroup) {
      // Found match
      matched.push({
        key,
        sheetsCount: sheetsGroup.length,
        supabaseCount: supabaseGroup.length,
        sheetsRecords: sheetsGroup,
        supabaseRecords: supabaseGroup,
      });

      if (sheetsGroup.length > 1) {
        multipleInSheets.push({ key, records: sheetsGroup });
      }
      if (supabaseGroup.length > 1) {
        multipleInSupabase.push({ key, records: supabaseGroup });
      }
    } else {
      // Only in Sheets
      onlyInSheets.push({
        key,
        records: sheetsGroup,
      });
    }
  });

  // Check for records only in Supabase
  supabaseMap.forEach((supabaseGroup, key) => {
    if (!sheetsMap.has(key)) {
      onlyInSupabase.push({
        key,
        records: supabaseGroup,
      });
    }
  });

  // Calculate totals
  const totalSheetsRecords = Array.from(sheetsMap.values()).reduce((sum, arr) => sum + arr.length, 0);
  const totalSupabaseRecords = Array.from(supabaseMap.values()).reduce((sum, arr) => sum + arr.length, 0);
  const totalOnlyInSheetsRecords = onlyInSheets.reduce((sum, item) => sum + item.records.length, 0);
  const totalOnlyInSupabaseRecords = onlyInSupabase.reduce((sum, item) => sum + item.records.length, 0);

  // Step 5: Display results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 COMPARISON RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Google Sheets records: ${totalSheetsRecords}`);
  console.log(`Total Supabase records: ${totalSupabaseRecords}`);
  console.log(`Difference: ${Math.abs(totalSheetsRecords - totalSupabaseRecords)}\n`);

  console.log(`Matched (in both systems): ${matched.length} unique groups`);
  console.log(`Only in Google Sheets: ${onlyInSheets.length} groups (${totalOnlyInSheetsRecords} records)`);
  console.log(`Only in Supabase: ${onlyInSupabase.length} groups (${totalOnlyInSupabaseRecords} records)\n`);

  console.log(`Multiple in Google Sheets: ${multipleInSheets.length} groups`);
  console.log(`Multiple in Supabase: ${multipleInSupabase.length} groups\n`);

  // Show samples of mismatched data
  if (onlyInSheets.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 SAMPLE: RECORDS ONLY IN GOOGLE SHEETS (First 10)');
    console.log('═══════════════════════════════════════════════════════════\n');

    onlyInSheets.slice(0, 10).forEach((item, index) => {
      const record = item.records[0];
      console.log(`${index + 1}. ${record.program.toUpperCase()} - Row ${record.rowNumber}`);
      console.log(`   Mentor: ${record.mentorName} (${record.mentorEmail})`);
      console.log(`   Mentee: ${record.menteeName}`);
      console.log(`   IC: ${record.menteeIC || 'N/A'}`);
      console.log(`   Session: ${record.sessionNumber || 'N/A'} on ${record.sessionDate || 'N/A'}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Match Key: ${item.key}\n`);
    });

    if (onlyInSheets.length > 10) {
      console.log(`   ... and ${onlyInSheets.length - 10} more\n`);
    }
  }

  if (onlyInSupabase.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 SAMPLE: RECORDS ONLY IN SUPABASE (First 10)');
    console.log('═══════════════════════════════════════════════════════════\n');

    onlyInSupabase.slice(0, 10).forEach((item, index) => {
      item.records.slice(0, 2).forEach((record, i) => {
        console.log(`${index + 1}.${i + 1} ID: ${record.id}`);
        console.log(`   Mentor: ${record.mentor_name || record.nama_mentor} (${record.mentor_email || record.email_mentor})`);
        console.log(`   Mentee: ${record.mentee_name || record.nama_usahawan}`);
        console.log(`   IC: ${record.mentee_ic || record.no_kp_usahawan || 'N/A'}`);
        console.log(`   Session: ${record.sesi_laporan || record.session_number || 'N/A'}`);
        console.log(`   Date: ${record.tarikh_sesi || record.session_date || 'N/A'}`);
        console.log(`   Program: ${record.program_type || record.program || 'N/A'}`);
        console.log(`   Created: ${record.created_at}`);
        console.log(`   PDF: ${record.doc_url ? 'Yes' : 'No'}\n`);
      });
    });

    if (onlyInSupabase.length > 10) {
      console.log(`   ... and ${onlyInSupabase.length - 10} more groups\n`);
    }
  }

  // Mismatched counts
  const mismatchedCounts = matched.filter(m => m.sheetsCount !== m.supabaseCount);
  if (mismatchedCounts.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚠️  MATCHED RECORDS WITH DIFFERENT COUNTS (First 10)');
    console.log('═══════════════════════════════════════════════════════════\n');

    mismatchedCounts.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. Match Key: ${item.key}`);
      console.log(`   Sheets: ${item.sheetsCount} record(s)`);
      console.log(`   Supabase: ${item.supabaseCount} record(s)`);
      const sample = item.sheetsRecords[0];
      console.log(`   Sample: ${sample.mentorName} → ${sample.menteeName} (Session ${sample.sessionNumber})\n`);
    });

    if (mismatchedCounts.length > 10) {
      console.log(`   ... and ${mismatchedCounts.length - 10} more\n`);
    }
  }

  // Export detailed data
  const exportData = {
    summary: {
      totalSheets: totalSheetsRecords,
      totalSupabase: totalSupabaseRecords,
      difference: Math.abs(totalSheetsRecords - totalSupabaseRecords),
      matchedGroups: matched.length,
      onlyInSheetsGroups: onlyInSheets.length,
      onlyInSheetsRecords: totalOnlyInSheetsRecords,
      onlyInSupabaseGroups: onlyInSupabase.length,
      onlyInSupabaseRecords: totalOnlyInSupabaseRecords,
      multipleInSheetsGroups: multipleInSheets.length,
      multipleInSupabaseGroups: multipleInSupabase.length,
      mismatchedCounts: mismatchedCounts.length,
    },
    matched,
    onlyInSheets,
    onlyInSupabase,
    multipleInSheets,
    multipleInSupabase,
    mismatchedCounts,
  };

  fs.writeFileSync(
    'comparison-report-v2.json',
    JSON.stringify(exportData, null, 2)
  );

  console.log('\n✅ Detailed comparison report exported to: comparison-report-v2.json\n');

  // Recommendations
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (totalOnlyInSupabaseRecords > 0) {
    console.log(`1. ⚠️  INVESTIGATE ${totalOnlyInSupabaseRecords} records in Supabase that don't exist in Google Sheets`);
    console.log(`   These may be:`);
    console.log(`   - Duplicates from failed syncs`);
    console.log(`   - Records with missing/incorrect session numbers or dates`);
    console.log(`   - Direct submissions that didn't write to Sheets\n`);
  }

  if (totalOnlyInSheetsRecords > 0) {
    console.log(`2. 📥 SYNC ${totalOnlyInSheetsRecords} records from Google Sheets to Supabase`);
    console.log(`   Run: node sync-scripts/04-sync-bangkit-reports.js\n`);
  }

  if (multipleInSupabase.length > 0) {
    console.log(`3. 🧹 DEDUPLICATE ${multipleInSupabase.length} groups in Supabase`);
    console.log(`   Keep records with PDF URLs (from Sheets sync)`);
    console.log(`   Delete records without PDF URLs (likely duplicates)\n`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

compareData().catch(console.error);
