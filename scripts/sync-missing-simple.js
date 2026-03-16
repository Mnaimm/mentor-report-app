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

async function syncMissingRecords() {
  console.log('🔄 Syncing Missing Records (Simplified)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // First, let's check what columns actually exist
  console.log('🔍 Checking existing record structure...');
  const { data: sampleData } = await supabase
    .from('reports')
    .select('*')
    .limit(1);

  if (sampleData && sampleData.length > 0) {
    const columns = Object.keys(sampleData[0]);
    console.log(`   ✅ Found ${columns.length} columns in reports table`);
    console.log(`   📋 Columns: ${columns.slice(0, 10).join(', ')}, ...\n`);
  }

  // Load comparison report
  console.log('📊 Loading comparison report...');
  const reportPath = path.join(process.cwd(), 'comparison-report-v2.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ comparison-report-v2.json not found!\n');
    return;
  }

  const comparisonData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const onlyInSheets = comparisonData.onlyInSheets || [];

  console.log(`   ✅ Found ${onlyInSheets.length} groups missing in Supabase\n`);

  // Load Sheets data
  console.log('📊 Loading Google Sheets data...');
  const bangkitPath = path.join(process.cwd(), 'sync-data', 'bangkit.json');
  const majuPath = path.join(process.cwd(), 'sync-data', 'LaporanMajuUM.json');

  const bangkitData = JSON.parse(fs.readFileSync(bangkitPath, 'utf8'));
  const majuData = fs.existsSync(majuPath) ? JSON.parse(fs.readFileSync(majuPath, 'utf8')) : [];

  console.log(`   ✅ Loaded ${bangkitData.length} Bangkit + ${majuData.length} Maju records\n`);

  // Process missing records
  console.log('🔄 Processing missing records...\n');

  let inserted = 0;
  let skipped = 0;
  let errors = [];

  for (const group of onlyInSheets) {
    for (const record of group.records) {
      try {
        console.log(`Row ${record.rowNumber}: ${record.menteeName || 'N/A'}`);

        // Only use basic columns that exist in all reports
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
          source: 'manual_sync_missing_records',
        };

        // Skip if mentee name is missing
        if (!reportData.mentee_name) {
          console.log(`   ⚠️  Skipped: No mentee name\n`);
          skipped++;
          continue;
        }

        // Insert into Supabase
        const { data, error } = await supabase
          .from('reports')
          .insert(reportData)
          .select();

        if (error) {
          throw error;
        }

        inserted++;
        console.log(`   ✅ Inserted (ID: ${data[0]?.id})\n`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        skipped++;
        errors.push({
          row: record.rowNumber,
          mentee: record.menteeName || 'N/A',
          error: error.message,
        });
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SYNC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Successfully inserted: ${inserted} records`);
  console.log(`⚠️  Skipped due to errors: ${skipped} records`);
  console.log(`📊 Total processed: ${inserted + skipped} records\n`);

  if (errors.length > 0) {
    console.log('❌ Errors:\n');
    errors.slice(0, 5).forEach((err, index) => {
      console.log(`${index + 1}. Row ${err.row}: ${err.mentee} - ${err.error}`);
    });
    if (errors.length > 5) {
      console.log(`... and ${errors.length - 5} more\n`);
    }

    fs.writeFileSync(
      'sync-missing-errors.json',
      JSON.stringify(errors, null, 2)
    );
    console.log('📄 Full error list: sync-missing-errors.json\n');
  }

  // Verify
  console.log('🔍 Verifying...');
  const { count, error: countError } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`   📊 Total records in Supabase now: ${count}`);
    console.log(`   🎯 Started with: 206 | Added: ${inserted} | Expected: ${206 + inserted}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  return { inserted, skipped, errors };
}

syncMissingRecords().catch(console.error);
