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

async function investigateDiscrepancies() {
  console.log('🔍 INVESTIGATING DISCREPANCIES (FIXED SESSION PARSING)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load Google Sheets data
  console.log('📊 Loading Google Sheets data...');
  const bangkitPath = path.join(process.cwd(), 'sync-data', 'bangkit.json');
  const majuPath = path.join(process.cwd(), 'sync-data', 'LaporanMajuUM.json');

  const bangkitSheets = JSON.parse(fs.readFileSync(bangkitPath, 'utf8'));
  const majuSheets = JSON.parse(fs.readFileSync(majuPath, 'utf8'));

  console.log(`   ✅ Sheets: ${bangkitSheets.length} Bangkit, ${majuSheets.length} Maju\n`);

  // Fetch Supabase data
  console.log('📊 Fetching Supabase data...');
  const { data: allSupabaseRecords, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const bangkitSupabase = allSupabaseRecords.filter(r =>
    (r.program || '').toLowerCase() === 'bangkit' ||
    (r.program_type || '').toLowerCase() === 'bangkit'
  );
  const majuSupabase = allSupabaseRecords.filter(r =>
    (r.program || '').toLowerCase() === 'maju' ||
    (r.program_type || '').toLowerCase() === 'maju'
  );

  console.log(`   ✅ Supabase: ${bangkitSupabase.length} Bangkit, ${majuSupabase.length} Maju\n`);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 DISCREPANCY SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Bangkit: Sheets ${bangkitSheets.length} vs Supabase ${bangkitSupabase.length} (${bangkitSupabase.length > bangkitSheets.length ? '+' : ''}${bangkitSupabase.length - bangkitSheets.length})`);
  console.log(`Maju:    Sheets ${majuSheets.length} vs Supabase ${majuSupabase.length} (${majuSupabase.length > majuSheets.length ? '+' : ''}${majuSupabase.length - majuSheets.length})\n`);

  // ========================================
  // BANGKIT ANALYSIS
  // ========================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 BANGKIT DETAILED ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create sets for comparison using composite keys WITH PARSED SESSION NUMBERS
  const bangkitSheetsSet = new Set();
  const bangkitSheetsMap = new Map();

  bangkitSheets.forEach((row, index) => {
    const mentorEmail = normalizeString(row.Email || row.Emai);
    const menteeName = normalizeString(row['Nama Usahawan']);
    const session = parseSessionNumber(row['Sesi Laporan']); // PARSE THE SESSION NUMBER!

    // Skip empty rows
    if (!mentorEmail || !menteeName) {
      return;
    }

    const key = `${mentorEmail}|${menteeName}|${session}`;
    bangkitSheetsSet.add(key);
    bangkitSheetsMap.set(key, {
      rowNumber: index + 2,
      mentorEmail,
      menteeName,
      session,
      date: row['Tarikh Sesi'],
      raw: row
    });
  });

  const bangkitSupabaseSet = new Set();
  const bangkitSupabaseMap = new Map();

  bangkitSupabase.forEach(record => {
    const mentorEmail = normalizeString(record.mentor_email || record.email_mentor);
    const menteeName = normalizeString(record.nama_mentee || record.mentee_name || record.nama_usahawan);
    const session = record.sesi_laporan || record.session_number;

    // Skip empty records
    if (!mentorEmail || !menteeName) {
      return;
    }

    const key = `${mentorEmail}|${menteeName}|${session}`;
    bangkitSupabaseSet.add(key);
    if (!bangkitSupabaseMap.has(key)) {
      bangkitSupabaseMap.set(key, []);
    }
    bangkitSupabaseMap.get(key).push({
      id: record.id,
      mentorEmail,
      menteeName,
      session,
      date: record.tarikh_sesi || record.session_date,
      createdAt: record.created_at,
      docUrl: record.doc_url,
      source: record.source
    });
  });

  // Find Bangkit differences
  const bangkitOnlyInSheets = [...bangkitSheetsSet].filter(key => !bangkitSupabaseSet.has(key));
  const bangkitOnlyInSupabase = [...bangkitSupabaseSet].filter(key => !bangkitSheetsSet.has(key));

  console.log(`✅ Matched records: ${bangkitSheetsSet.size - bangkitOnlyInSheets.length}`);
  console.log(`❌ Only in Sheets: ${bangkitOnlyInSheets.length}`);
  console.log(`⚠️  Only in Supabase: ${bangkitOnlyInSupabase.length}\n`);

  if (bangkitOnlyInSheets.length > 0) {
    console.log('📋 BANGKIT: Only in Google Sheets:\n');
    bangkitOnlyInSheets.forEach((key, index) => {
      const record = bangkitSheetsMap.get(key);
      console.log(`${index + 1}. Row ${record.rowNumber}: ${record.menteeName}`);
      console.log(`   Mentor: ${record.mentorEmail}`);
      console.log(`   Session: ${record.session} on ${record.date}`);
      console.log(`   Key: ${key}\n`);
    });
  }

  if (bangkitOnlyInSupabase.length > 0) {
    console.log('📋 BANGKIT: Only in Supabase:\n');
    bangkitOnlyInSupabase.forEach((key, index) => {
      const records = bangkitSupabaseMap.get(key);
      records.forEach((record, i) => {
        console.log(`${index + 1}.${i + 1} ID: ${record.id}`);
        console.log(`   Mentee: ${record.menteeName || 'N/A'}`);
        console.log(`   Mentor: ${record.mentorEmail || 'N/A'}`);
        console.log(`   Session: ${record.session} on ${record.date || 'N/A'}`);
        console.log(`   Created: ${record.createdAt}`);
        console.log(`   Source: ${record.source || 'N/A'}`);
        console.log(`   PDF: ${record.docUrl ? 'Yes' : 'No'}\n`);
      });
    });
  }

  // ========================================
  // MAJU ANALYSIS
  // ========================================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 MAJU DETAILED ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Create sets for Maju comparison
  const majuSheetsSet = new Set();
  const majuSheetsMap = new Map();

  majuSheets.forEach((row, index) => {
    const mentorEmail = normalizeString(row.Email || row.Emai);
    const menteeName = normalizeString(row['Nama Usahawan']);
    const session = parseSessionNumber(row['Sesi Laporan']);

    // Skip empty rows
    if (!mentorEmail || !menteeName) {
      console.log(`   ℹ️  Skipped empty row ${index + 2} in Maju Sheets`);
      return;
    }

    const key = `${mentorEmail}|${menteeName}|${session}`;
    majuSheetsSet.add(key);
    majuSheetsMap.set(key, {
      rowNumber: index + 2,
      mentorEmail,
      menteeName,
      session,
      date: row['Tarikh Sesi'],
      raw: row
    });
  });

  const majuSupabaseSet = new Set();
  const majuSupabaseMap = new Map();

  majuSupabase.forEach(record => {
    const mentorEmail = normalizeString(record.mentor_email || record.email_mentor);
    const menteeName = normalizeString(record.nama_mentee || record.mentee_name || record.nama_usahawan);
    const session = record.sesi_laporan || record.session_number;

    // Skip empty records
    if (!mentorEmail || !menteeName) {
      return;
    }

    const key = `${mentorEmail}|${menteeName}|${session}`;
    majuSupabaseSet.add(key);
    if (!majuSupabaseMap.has(key)) {
      majuSupabaseMap.set(key, []);
    }
    majuSupabaseMap.get(key).push({
      id: record.id,
      mentorEmail,
      menteeName,
      session,
      date: record.tarikh_sesi || record.session_date,
      createdAt: record.created_at,
      docUrl: record.doc_url,
      source: record.source
    });
  });

  // Find Maju differences
  const majuOnlyInSheets = [...majuSheetsSet].filter(key => !majuSupabaseSet.has(key));
  const majuOnlyInSupabase = [...majuSupabaseSet].filter(key => !majuSheetsSet.has(key));

  console.log(`\n✅ Matched records: ${majuSheetsSet.size - majuOnlyInSheets.length}`);
  console.log(`❌ Only in Sheets: ${majuOnlyInSheets.length}`);
  console.log(`⚠️  Only in Supabase: ${majuOnlyInSupabase.length}\n`);

  if (majuOnlyInSheets.length > 0) {
    console.log('📋 MAJU: Only in Google Sheets:\n');
    majuOnlyInSheets.forEach((key, index) => {
      const record = majuSheetsMap.get(key);
      console.log(`${index + 1}. Row ${record.rowNumber}: ${record.menteeName}`);
      console.log(`   Mentor: ${record.mentorEmail}`);
      console.log(`   Session: ${record.session} on ${record.date}\n`);
    });
  }

  if (majuOnlyInSupabase.length > 0) {
    console.log('📋 MAJU: Only in Supabase:\n');
    majuOnlyInSupabase.forEach((key, index) => {
      const records = majuSupabaseMap.get(key);
      records.forEach((record, i) => {
        console.log(`${index + 1}.${i + 1} ID: ${record.id}`);
        console.log(`   Mentee: ${record.menteeName || 'N/A'}`);
        console.log(`   Mentor: ${record.mentorEmail || 'N/A'}`);
        console.log(`   Session: ${record.session} on ${record.date || 'N/A'}`);
        console.log(`   Created: ${record.createdAt}`);
        console.log(`   Source: ${record.source || 'N/A'}`);
        console.log(`   PDF: ${record.docUrl ? 'Yes' : 'No'}\n`);
      });
    });
  }

  // ========================================
  // EXPORT DETAILED REPORT
  // ========================================
  const reportData = {
    summary: {
      bangkit: {
        sheets: bangkitSheetsSet.size,
        supabase: bangkitSupabaseSet.size,
        matched: bangkitSheetsSet.size - bangkitOnlyInSheets.length,
        onlyInSheets: bangkitOnlyInSheets.length,
        onlyInSupabase: bangkitOnlyInSupabase.length,
      },
      maju: {
        sheets: majuSheetsSet.size,
        supabase: majuSupabaseSet.size,
        matched: majuSheetsSet.size - majuOnlyInSheets.length,
        onlyInSheets: majuOnlyInSheets.length,
        onlyInSupabase: majuOnlyInSupabase.length,
      }
    },
    bangkit: {
      onlyInSheets: bangkitOnlyInSheets.map(key => bangkitSheetsMap.get(key)),
      onlyInSupabase: bangkitOnlyInSupabase.map(key => ({
        key,
        records: bangkitSupabaseMap.get(key)
      })),
    },
    maju: {
      onlyInSheets: majuOnlyInSheets.map(key => majuSheetsMap.get(key)),
      onlyInSupabase: majuOnlyInSupabase.map(key => ({
        key,
        records: majuSupabaseMap.get(key)
      })),
    }
  };

  fs.writeFileSync(
    'discrepancy-details-fixed.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📄 REPORT EXPORTED');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ Detailed report saved to: discrepancy-details-fixed.json\n');

  // Final summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('BANGKIT:');
  console.log(`  Valid Sheets records: ${bangkitSheetsSet.size}`);
  console.log(`  Supabase records: ${bangkitSupabaseSet.size}`);
  console.log(`  Matched: ${bangkitSheetsSet.size - bangkitOnlyInSheets.length}`);
  console.log(`  → Extra in Supabase: ${bangkitOnlyInSupabase.length}`);
  console.log(`  → Missing from Supabase: ${bangkitOnlyInSheets.length}\n`);

  console.log('MAJU:');
  console.log(`  Valid Sheets records: ${majuSheetsSet.size}`);
  console.log(`  Supabase records: ${majuSupabaseSet.size}`);
  console.log(`  Matched: ${majuSheetsSet.size - majuOnlyInSheets.length}`);
  console.log(`  → Extra in Supabase: ${majuOnlyInSupabase.length}`);
  console.log(`  → Missing from Supabase: ${majuOnlyInSheets.length}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

investigateDiscrepancies().catch(console.error);
