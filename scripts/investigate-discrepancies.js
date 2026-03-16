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

async function investigateDiscrepancies() {
  console.log('🔍 INVESTIGATING DISCREPANCIES\n');
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

  // Create sets for comparison using composite keys
  const bangkitSheetsSet = new Set();
  const bangkitSheetsMap = new Map();

  bangkitSheets.forEach((row, index) => {
    const mentorEmail = normalizeString(row.Email || row.Emai);
    const menteeName = normalizeString(row['Nama Usahawan']);
    const session = row['Sesi Laporan'];
    const date = row['Tarikh Sesi'];

    const key = `${mentorEmail}|${menteeName}|${session}`;
    bangkitSheetsSet.add(key);
    bangkitSheetsMap.set(key, {
      rowNumber: index + 2,
      mentorEmail,
      menteeName,
      session,
      date,
      raw: row
    });
  });

  const bangkitSupabaseSet = new Set();
  const bangkitSupabaseMap = new Map();

  bangkitSupabase.forEach(record => {
    const mentorEmail = normalizeString(record.mentor_email || record.email_mentor);
    const menteeName = normalizeString(record.nama_mentee || record.mentee_name || record.nama_usahawan);
    const session = record.sesi_laporan || record.session_number;

    const key = `${mentorEmail}|${menteeName}|${session}`;
    bangkitSupabaseSet.add(key);
    bangkitSupabaseMap.set(key, {
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

  console.log(`Records only in Sheets: ${bangkitOnlyInSheets.length}`);
  console.log(`Records only in Supabase: ${bangkitOnlyInSupabase.length}\n`);

  if (bangkitOnlyInSheets.length > 0) {
    console.log('📋 BANGKIT: Only in Google Sheets:\n');
    bangkitOnlyInSheets.slice(0, 10).forEach((key, index) => {
      const record = bangkitSheetsMap.get(key);
      console.log(`${index + 1}. Row ${record.rowNumber}: ${record.menteeName}`);
      console.log(`   Mentor: ${record.mentorEmail}`);
      console.log(`   Session: ${record.session} on ${record.date}`);
      console.log(`   Key: ${key}\n`);
    });
    if (bangkitOnlyInSheets.length > 10) {
      console.log(`   ... and ${bangkitOnlyInSheets.length - 10} more\n`);
    }
  }

  if (bangkitOnlyInSupabase.length > 0) {
    console.log('📋 BANGKIT: Only in Supabase:\n');
    bangkitOnlyInSupabase.slice(0, 10).forEach((key, index) => {
      const record = bangkitSupabaseMap.get(key);
      console.log(`${index + 1}. ID: ${record.id}`);
      console.log(`   Mentee: ${record.menteeName || 'N/A'}`);
      console.log(`   Mentor: ${record.mentorEmail || 'N/A'}`);
      console.log(`   Session: ${record.session} on ${record.date || 'N/A'}`);
      console.log(`   Created: ${record.createdAt}`);
      console.log(`   Source: ${record.source || 'N/A'}`);
      console.log(`   PDF: ${record.docUrl ? 'Yes' : 'No'}`);
      console.log(`   Key: ${key}\n`);
    });
    if (bangkitOnlyInSupabase.length > 10) {
      console.log(`   ... and ${bangkitOnlyInSupabase.length - 10} more\n`);
    }
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
    const session = row['Sesi Laporan'];
    const date = row['Tarikh Sesi'];

    const key = `${mentorEmail}|${menteeName}|${session}`;
    majuSheetsSet.add(key);
    majuSheetsMap.set(key, {
      rowNumber: index + 2,
      mentorEmail,
      menteeName,
      session,
      date,
      raw: row
    });
  });

  const majuSupabaseSet = new Set();
  const majuSupabaseMap = new Map();

  majuSupabase.forEach(record => {
    const mentorEmail = normalizeString(record.mentor_email || record.email_mentor);
    const menteeName = normalizeString(record.nama_mentee || record.mentee_name || record.nama_usahawan);
    const session = record.sesi_laporan || record.session_number;

    const key = `${mentorEmail}|${menteeName}|${session}`;
    majuSupabaseSet.add(key);
    majuSupabaseMap.set(key, {
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

  console.log(`Records only in Sheets: ${majuOnlyInSheets.length}`);
  console.log(`Records only in Supabase: ${majuOnlyInSupabase.length}\n`);

  if (majuOnlyInSheets.length > 0) {
    console.log('📋 MAJU: Only in Google Sheets:\n');
    majuOnlyInSheets.slice(0, 10).forEach((key, index) => {
      const record = majuSheetsMap.get(key);
      console.log(`${index + 1}. Row ${record.rowNumber}: ${record.menteeName}`);
      console.log(`   Mentor: ${record.mentorEmail}`);
      console.log(`   Session: ${record.session} on ${record.date}`);
      console.log(`   Key: ${key}\n`);
    });
    if (majuOnlyInSheets.length > 10) {
      console.log(`   ... and ${majuOnlyInSheets.length - 10} more\n`);
    }
  }

  if (majuOnlyInSupabase.length > 0) {
    console.log('📋 MAJU: Only in Supabase:\n');
    majuOnlyInSupabase.slice(0, 10).forEach((key, index) => {
      const record = majuSupabaseMap.get(key);
      console.log(`${index + 1}. ID: ${record.id}`);
      console.log(`   Mentee: ${record.menteeName || 'N/A'}`);
      console.log(`   Mentor: ${record.mentorEmail || 'N/A'}`);
      console.log(`   Session: ${record.session} on ${record.date || 'N/A'}`);
      console.log(`   Created: ${record.createdAt}`);
      console.log(`   Source: ${record.source || 'N/A'}`);
      console.log(`   PDF: ${record.docUrl ? 'Yes' : 'No'}`);
      console.log(`   Key: ${key}\n`);
    });
    if (majuOnlyInSupabase.length > 10) {
      console.log(`   ... and ${majuOnlyInSupabase.length - 10} more\n`);
    }
  }

  // ========================================
  // EXPORT DETAILED REPORT
  // ========================================
  const reportData = {
    summary: {
      bangkit: {
        sheets: bangkitSheets.length,
        supabase: bangkitSupabase.length,
        onlyInSheets: bangkitOnlyInSheets.length,
        onlyInSupabase: bangkitOnlyInSupabase.length,
      },
      maju: {
        sheets: majuSheets.length,
        supabase: majuSupabase.length,
        onlyInSheets: majuOnlyInSheets.length,
        onlyInSupabase: majuOnlyInSupabase.length,
      }
    },
    bangkit: {
      onlyInSheets: bangkitOnlyInSheets.map(key => bangkitSheetsMap.get(key)),
      onlyInSupabase: bangkitOnlyInSupabase.map(key => bangkitSupabaseMap.get(key)),
    },
    maju: {
      onlyInSheets: majuOnlyInSheets.map(key => majuSheetsMap.get(key)),
      onlyInSupabase: majuOnlyInSupabase.map(key => majuSupabaseMap.get(key)),
    }
  };

  fs.writeFileSync(
    'discrepancy-details.json',
    JSON.stringify(reportData, null, 2)
  );

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📄 REPORT EXPORTED');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ Detailed report saved to: discrepancy-details.json\n');

  // Final summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('BANGKIT:');
  console.log(`  Sheets has ${bangkitSheets.length} records`);
  console.log(`  Supabase has ${bangkitSupabase.length} records`);
  console.log(`  → Extra in Supabase: ${bangkitOnlyInSupabase.length}`);
  console.log(`  → Missing from Supabase: ${bangkitOnlyInSheets.length}\n`);

  console.log('MAJU:');
  console.log(`  Sheets has ${majuSheets.length} records`);
  console.log(`  Supabase has ${majuSupabase.length} records`);
  console.log(`  → Extra in Supabase: ${majuOnlyInSupabase.length}`);
  console.log(`  → Missing from Supabase: ${majuOnlyInSheets.length}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

investigateDiscrepancies().catch(console.error);
