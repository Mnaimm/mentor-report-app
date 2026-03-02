const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Caches
const mentorCache = new Map();
const entrepreneurCache = new Map();

// Look up mentor ID by email
async function getMentorId(email) {
  if (!email) return null;

  const key = email.toLowerCase();
  if (mentorCache.has(key)) {
    return mentorCache.get(key);
  }

  const { data, error } = await supabase
    .from('mentors')
    .select('id')
    .ilike('email', key)
    .maybeSingle();

  if (error || !data) {
    console.log(`      ⚠️  Mentor not found: ${email}`);
    return null;
  }

  mentorCache.set(key, data.id);
  return data.id;
}

// Look up entrepreneur ID by name
async function getEntrepreneurId(name) {
  if (!name) return null;

  const key = name.toLowerCase();
  if (entrepreneurCache.has(key)) {
    return entrepreneurCache.get(key);
  }

  const { data, error } = await supabase
    .from('entrepreneurs')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (error || !data) {
    console.log(`      ⚠️  Entrepreneur not found: ${name}`);
    return null;
  }

  entrepreneurCache.set(key, data.id);
  return data.id;
}

async function syncMissingRecords() {
  console.log('🔄 Syncing Missing Records (Final Version with ID Resolution)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

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

  // Process missing records
  console.log('🔄 Processing missing records...\n');

  let inserted = 0;
  let skipped = 0;
  let errors = [];

  for (const group of onlyInSheets) {
    for (const record of group.records) {
      try {
        const menteeName = record.menteeName;

        if (!menteeName) {
          console.log(`Row ${record.rowNumber}: Skipped (no mentee name)\n`);
          skipped++;
          continue;
        }

        console.log(`Row ${record.rowNumber}: ${menteeName}`);

        // Resolve IDs
        const mentorId = await getMentorId(record.mentorEmail);
        const entrepreneurId = await getEntrepreneurId(menteeName);

        if (!mentorId || !entrepreneurId) {
          throw new Error(`Could not resolve IDs (mentor: ${mentorId ? 'OK' : 'MISSING'}, entrepreneur: ${entrepreneurId ? 'OK' : 'MISSING'})`);
        }

        // Parse session number from "Sesi #1" to 1
        let sessionNum = null;
        if (record.sessionNumber) {
          if (typeof record.sessionNumber === 'number') {
            sessionNum = record.sessionNumber;
          } else if (typeof record.sessionNumber === 'string') {
            // Extract number from "Sesi #1" or just "1"
            const match = record.sessionNumber.match(/\d+/);
            sessionNum = match ? parseInt(match[0]) : null;
          }
        }

        // Parse date from DD/MM/YYYY to YYYY-MM-DD
        let sessionDate = record.sessionDate || null;
        if (sessionDate && typeof sessionDate === 'string') {
          // Check if date is in DD/MM/YYYY format
          const ddmmyyyyMatch = sessionDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            sessionDate = `${year}-${month}-${day}`;
          }
          // Otherwise assume it's already in YYYY-MM-DD format
        }

        // Parse submission_date from original Sheet timestamp (not sessionDate!)
        let submissionDate = record.timestamp || null;
        if (submissionDate && typeof submissionDate === 'string') {
          // Handle various timestamp formats from Sheets
          // Could be: "2025-10-10 14:30:00", "10/10/2025 14:30:00", or ISO format
          try {
            const parsed = new Date(submissionDate);
            if (!isNaN(parsed.getTime())) {
              submissionDate = parsed.toISOString();
            }
          } catch (e) {
            console.log(`      ⚠️  Could not parse timestamp: ${submissionDate}`);
            submissionDate = null;
          }
        }

        // Build report data with ALL name fields populated
        const reportData = {
          mentor_id: mentorId,
          entrepreneur_id: entrepreneurId,
          program: record.program === 'bangkit' ? 'Bangkit' : 'Maju',
          session_number: sessionNum,
          session_date: sessionDate,
          submission_date: submissionDate, // Original Sheet timestamp
          // Populate ALL name fields (fix "Unknown Mentee" issue)
          nama_mentee: menteeName,
          nama_usahawan: menteeName,  // Also populate old field
          nama_mentor: record.mentorName || null,
          mentor_email: record.mentorEmail || null,
          mia_status: record.status || 'Selesai',
          doc_url: record.docUrl || null,
          source: 'manual_sync_missing_records',
        };

        // UPSERT instead of INSERT to prevent duplicates
        // Uses unique constraint: mentor_id + entrepreneur_id + program + session_number
        const { data, error } = await supabase
          .from('reports')
          .upsert(reportData, {
            onConflict: 'mentor_id,entrepreneur_id,program,session_number',
            ignoreDuplicates: false // Update if exists
          })
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
  console.log(`⚠️  Skipped: ${skipped} records`);
  console.log(`📊 Total processed: ${inserted + skipped} records\n`);

  if (errors.length > 0) {
    console.log('❌ Errors:\n');
    errors.slice(0, 10).forEach((err, index) => {
      console.log(`${index + 1}. Row ${err.row}: ${err.mentee}`);
      console.log(`   ${err.error}\n`);
    });
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more\n`);
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

    if (count >= 206 + inserted) {
      console.log('   ✅ Sync successful!\n');
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  return { inserted, skipped, errors };
}

syncMissingRecords().catch(console.error);
