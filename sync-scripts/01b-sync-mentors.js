// 01b-sync-mentors.js
// Syncs mentors.json (43 rows) to mentors table

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default true, set DRY_RUN=false to execute

const results = {
  mentors: { success: 0, skipped: 0, failed: 0 },
  errors: []
};

// Helper: Parse state from address
function parseStateFromAddress(address) {
  if (!address) return null;

  const stateKeywords = {
    'Kedah': ['Kedah', 'Alor Setar', 'Sungai Petani'],
    'Perlis': ['Perlis', 'Kangar'],
    'Penang': ['Penang', 'Pulau Pinang', 'Georgetown', 'Kepala Batas', 'Bertam'],
    'Perak': ['Perak', 'Ipoh', 'Taiping', 'Hutan Melintang'],
    'Kelantan': ['Kelantan', 'Kota Bharu'],
    'Terengganu': ['Terengganu', 'Kuala Terengganu'],
    'Pahang': ['Pahang', 'Kuantan'],
    'Selangor': ['Selangor', 'Shah Alam', 'Petaling Jaya', 'Batu Caves'],
    'Kuala Lumpur': ['Kuala Lumpur', 'KL'],
    'Negeri Sembilan': ['Negeri Sembilan', 'Seremban'],
    'Melaka': ['Melaka', 'Malacca'],
    'Johor': ['Johor', 'Johor Bahru'],
    'Sarawak': ['Sarawak', 'Kuching'],
    'Sabah': ['Sabah', 'Kota Kinabalu']
  };

  for (const [stateName, keywords] of Object.entries(stateKeywords)) {
    if (keywords.some(kw => address.includes(kw))) {
      return stateName;
    }
  }

  return null;
}

async function syncMentors() {
  console.log('\n=== 01b-sync-mentors.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/mentors.json (43 rows)');
  console.log('Output: mentors table\n');

  // Read JSON data
  const dataPath = path.join(process.cwd(), 'sync-data', 'mentors.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} mentors from mentors.json\n`);

  for (let i = 0; i < data.length; i++) {
    const mentor = data[i];
    const rowNum = i + 1;

    try {
      if (!mentor.email || !mentor.name) {
        throw new Error('Missing email or name');
      }

      console.log(`[${rowNum}/${data.length}] Processing: ${mentor.name}`);

      // Check if mentor exists by email
      const { data: existingMentor, error: checkError } = await supabase
        .from('mentors')
        .select('id')
        .eq('email', mentor.email)
        .limit(1)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingMentor) {
        results.mentors.skipped++;
        console.log(`   ⭐️ Mentor exists: ${mentor.email}`);
      } else {
        // Parse state from address
        const state = parseStateFromAddress(mentor.address);

        // Create new mentor
        if (!DRY_RUN) {
          const { error: insertError } = await supabase
            .from('mentors')
            .insert({
              name: mentor.name,
              email: mentor.email,
              phone: mentor.phone,
              ic_number: mentor.ic_number,
              address: mentor.address,
              state: state,
              bank_account: mentor.bank_account,
              emergency_contact: mentor.emergency_contact,
              status: 'active'
            });

          if (insertError) throw insertError;
          results.mentors.success++;
          console.log(`   ✅ Created mentor: ${mentor.name} (${mentor.email})`);
        } else {
          results.mentors.success++;
          console.log(`   🔍 [DRY] Would create mentor: ${mentor.name} (${mentor.email})`);
        }
      }

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.mentors.failed++;
      results.errors.push({
        row: rowNum,
        data: mentor,
        error: error.message
      });
      console.error(`[${rowNum}/${data.length}] ❌ Error:`, error.message);
    }
  }

  // === Summary ===
  console.log('\n=== RESULTS ===');
  console.log('Mentors:');
  console.log(`  ✅ Created: ${results.mentors.success}`);
  console.log(`  ⭐️ Skipped: ${results.mentors.skipped}`);
  console.log(`  ❌ Failed: ${results.mentors.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-01b.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncMentors()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncMentors;
