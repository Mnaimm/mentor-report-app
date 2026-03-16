const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Normalize string
function normalizeString(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

// Parse session number
function parseSessionNumber(sesiLaporan) {
  if (!sesiLaporan) return undefined;
  const match = sesiLaporan.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : undefined;
}

// Create match key
function createMatchKey(record) {
  const mentorEmail = normalizeString(record.mentorEmail || '');
  const menteeName = normalizeString(record.menteeName || '');
  const session = normalizeString(record.sessionNumber || '');
  return `${mentorEmail}|${menteeName}|${session}`;
}

async function syncMissingRecords() {
  console.log('🔄 Syncing Missing Records from Google Sheets to Supabase\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Load comparison report
  console.log('📊 Loading comparison report...');
  const reportPath = path.join(process.cwd(), 'comparison-report-v2.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ comparison-report-v2.json not found!');
    console.log('💡 Run: node scripts/compare-sheets-supabase-v2.js first\n');
    return;
  }

  const comparisonData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const onlyInSheets = comparisonData.onlyInSheets || [];

  console.log(`   ✅ Found ${onlyInSheets.length} groups missing in Supabase\n`);

  // Step 2: Load Sheets data for field details
  console.log('📊 Loading Google Sheets data...');
  const bangkitPath = path.join(process.cwd(), 'sync-data', 'bangkit.json');
  const majuPath = path.join(process.cwd(), 'sync-data', 'LaporanMajuUM.json');

  const bangkitData = JSON.parse(fs.readFileSync(bangkitPath, 'utf8'));
  const majuData = fs.existsSync(majuPath) ? JSON.parse(fs.readFileSync(majuPath, 'utf8')) : [];

  console.log(`   ✅ Loaded ${bangkitData.length} Bangkit + ${majuData.length} Maju records\n`);

  // Step 3: Process missing records
  console.log('🔄 Processing missing records...\n');

  let inserted = 0;
  let skipped = 0;
  let errors = [];

  for (const group of onlyInSheets) {
    for (const record of group.records) {
      try {
        const rowData = record.rawRow;

        console.log(`Processing Row ${record.rowNumber}: ${record.menteeName}`);

        // Build report data for Supabase
        const reportData = {
          program_type: record.program === 'bangkit' ? 'bangkit' : 'maju',
          mentor_email: record.mentorEmail || null,
          mentor_name: record.mentorName || null,
          mentee_name: record.menteeName || null,
          mentee_ic: record.menteeIC || null,
          sesi_laporan: record.sessionNumber || null,
          tarikh_sesi: record.sessionDate || null,
          status: record.status || 'Selesai',
          doc_url: record.docUrl || null,

          // Additional fields from raw row
          nama_bisnes: rowData['Nama Bisnes'] || rowData['Nama Syarikat'] || null,
          jenis_perniagaan: rowData['Jenis Perniagaan'] || null,
          lokasi_premis: rowData['Lokasi Premis'] || null,
          mod_sesi: rowData['Mod Sesi'] || rowData['Mode'] || null,

          // Metadata
          source: 'manual_sync_missing_records',
          created_at: new Date().toISOString(),
        };

        // Insert into Supabase
        const { data, error } = await supabase
          .from('reports')
          .insert(reportData)
          .select();

        if (error) {
          throw error;
        }

        inserted++;
        console.log(`   ✅ Inserted successfully (ID: ${data[0]?.id})\n`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        skipped++;
        errors.push({
          row: record.rowNumber,
          mentee: record.menteeName,
          error: error.message,
        });
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    }
  }

  // Step 4: Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SYNC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Successfully inserted: ${inserted} records`);
  console.log(`⚠️  Skipped due to errors: ${skipped} records`);
  console.log(`📊 Total processed: ${inserted + skipped} records\n`);

  if (errors.length > 0) {
    console.log('❌ Errors encountered:\n');
    errors.slice(0, 10).forEach((err, index) => {
      console.log(`${index + 1}. Row ${err.row}: ${err.mentee}`);
      console.log(`   Error: ${err.error}\n`);
    });

    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors\n`);
    }

    // Save errors to file
    fs.writeFileSync(
      'sync-missing-errors.json',
      JSON.stringify(errors, null, 2)
    );
    console.log('📄 Full error list saved to: sync-missing-errors.json\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 5: Verify
  console.log('🔍 Verifying sync...');
  const { count, error: countError } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`   📊 Total records in Supabase: ${count}`);
    console.log(`   🎯 Expected: at least ${206 + inserted} records\n`);
  }

  return {
    inserted,
    skipped,
    errors,
  };
}

syncMissingRecords().catch(console.error);
