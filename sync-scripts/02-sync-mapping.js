// 02-sync-mapping.js
// Syncs mapping.json (204 rows) to mentors + entrepreneurs + mentor_assignments tables

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false';

const results = {
  mentors: { success: 0, skipped: 0, failed: 0 },
  entrepreneurs: { success: 0, skipped: 0, failed: 0 },
  assignments: { success: 0, skipped: 0, failed: 0 },
  errors: []
};

// Caches
const mentorCache = new Map(); // email -> mentor_id
const entrepreneurCache = new Map(); // name -> entrepreneur_id
const batchCache = new Map(); // batch_name -> batch_id

// Helper: Parse state and district from address
function parseAddress(alamat) {
  if (!alamat) return { state: null, district: null };

  const stateKeywords = {
    'Kedah': ['Kedah', 'Alor Setar', 'Sungai Petani'],
    'Perlis': ['Perlis', 'Kangar'],
    'Penang': ['Penang', 'Pulau Pinang', 'Georgetown'],
    'Perak': ['Perak', 'Ipoh', 'Taiping'],
    'Kelantan': ['Kelantan', 'Kota Bharu'],
    'Terengganu': ['Terengganu', 'Kuala Terengganu'],
    'Pahang': ['Pahang', 'Kuantan'],
    'Selangor': ['Selangor', 'Shah Alam', 'Petaling Jaya'],
    'Kuala Lumpur': ['Kuala Lumpur', 'KL'],
    'Negeri Sembilan': ['Negeri Sembilan', 'Seremban'],
    'Melaka': ['Melaka', 'Malacca'],
    'Johor': ['Johor', 'Johor Bahru'],
    'Sarawak': ['Sarawak', 'Kuching'],
    'Sabah': ['Sabah', 'Kota Kinabalu']
  };

  let state = null;
  for (const [stateName, keywords] of Object.entries(stateKeywords)) {
    if (keywords.some(kw => alamat.includes(kw))) {
      state = stateName;
      break;
    }
  }

  return { state, district: null };
}

// Helper: Get or create mentor
async function getOrCreateMentor(mentorName, mentorEmail) {
  if (!mentorEmail) {
    throw new Error(`Missing mentor email for: ${mentorName}`);
  }

  const cachedId = mentorCache.get(mentorEmail.toLowerCase());
  if (cachedId) return cachedId;

  // Check if exists
  const { data: existing, error: checkError } = await supabase
    .from('mentors')
    .select('id')
    .eq('email', mentorEmail.toLowerCase())
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    mentorCache.set(mentorEmail.toLowerCase(), existing.id);
    results.mentors.skipped++;
    return existing.id;
  }

  // Create new
  if (!DRY_RUN) {
    const { data: newMentor, error: insertError } = await supabase
      .from('mentors')
      .insert({
        name: mentorName,
        email: mentorEmail.toLowerCase(),
        status: 'active'
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    mentorCache.set(mentorEmail.toLowerCase(), newMentor.id);
    results.mentors.success++;
    console.log(`   ✅ Created mentor: ${mentorName} (${mentorEmail})`);
    return newMentor.id;
  } else {
    const dryId = `dry-mentor-${mentorEmail}`;
    mentorCache.set(mentorEmail.toLowerCase(), dryId);
    results.mentors.success++;
    console.log(`   🔍 [DRY] Would create mentor: ${mentorName} (${mentorEmail})`);
    return dryId;
  }
}

// Helper: Get or create entrepreneur
async function getOrCreateEntrepreneur(row, program) {
  const name = row.Mentee || row.mentee;
  const email = row.EMAIL || row.email;

  if (!name) {
    throw new Error('Missing entrepreneur name');
  }

  const cacheKey = `${name.toLowerCase()}_${email?.toLowerCase() || 'no-email'}`;
  const cachedId = entrepreneurCache.get(cacheKey);
  if (cachedId) return cachedId;

  // Check if exists by name AND email (if email provided)
  let query = supabase.from('entrepreneurs').select('id').eq('name', name);
  if (email) {
    query = query.eq('email', email.toLowerCase());
  }

  const { data: existing, error: checkError } = await query.maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    entrepreneurCache.set(cacheKey, existing.id);
    results.entrepreneurs.skipped++;
    return existing.id;
  }

  // Parse address
  const address = row.Alamat || row.alamat;
  const { state, district } = parseAddress(address);

  // Create new
  if (!DRY_RUN) {
    const { data: newEntrepreneur, error: insertError } = await supabase
      .from('entrepreneurs')
      .insert({
        name: name,
        email: email ? email.toLowerCase() : null,
        business_name: row['Nama Syarikat'] || row.nama_syarikat,
        phone: row['no Telefon'] || row.no_telefon,
        program: program,
        batch: row.Batch || row.batch,
        zone: row.Zon || row.zon,
        state: state,
        district: district,
        business_type: row['JENIS BISNES'] || row.jenis_bisnes,
        folder_id: row.Folder_ID || row.folder_id,
        status: 'active'
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    entrepreneurCache.set(cacheKey, newEntrepreneur.id);
    results.entrepreneurs.success++;
    console.log(`   ✅ Created entrepreneur: ${name}`);
    return newEntrepreneur.id;
  } else {
    const dryId = `dry-entrepreneur-${name}`;
    entrepreneurCache.set(cacheKey, dryId);
    results.entrepreneurs.success++;
    console.log(`   🔍 [DRY] Would create entrepreneur: ${name}`);
    return dryId;
  }
}

// Helper: Get batch ID
async function getBatchId(batchName) {
  if (!batchName) return null;

  const cachedId = batchCache.get(batchName);
  if (cachedId) return cachedId;

  const { data: batch, error } = await supabase
    .from('batches')
    .select('id')
    .eq('batch_name', batchName)
    .maybeSingle();

  if (error) {
    console.warn(`   ⚠️  Batch not found: ${batchName}`);
    return null;
  }

  if (batch) {
    batchCache.set(batchName, batch.id);
    return batch.id;
  }

  return null;
}

async function syncMapping() {
  console.log('\n=== 02-sync-mapping.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/mapping.json (204 rows)');
  console.log('Output: mentors + entrepreneurs + mentor_assignments tables\n');

  const dataPath = path.join(process.cwd(), 'sync-data', 'mapping.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from mapping.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorName = row.Mentor || row.mentor;
      const mentorEmail = row.Mentor_Email || row.mentor_email;
      const batchName = row.Batch || row.batch;

      console.log(`[${rowNum}/${data.length}] Processing: ${row.Mentee || row.mentee}`);

      // Determine program from batch
      const program = batchName?.toUpperCase().includes('BANGKIT') ? 'Bangkit' : 'Maju';

      // 1. Get or create mentor
      const mentorId = await getOrCreateMentor(mentorName, mentorEmail);

      // 2. Get or create entrepreneur
      const entrepreneurId = await getOrCreateEntrepreneur(row, program);

      // 3. Get batch ID
      const batchId = await getBatchId(batchName);

      // 4. Create assignment
      if (mentorId && entrepreneurId && !mentorId.startsWith('dry-') && !entrepreneurId.startsWith('dry-')) {
        // Check if assignment exists
        const { data: existingAssignment, error: assignCheckError } = await supabase
          .from('mentor_assignments')
          .select('id')
          .eq('mentor_id', mentorId)
          .eq('entrepreneur_id', entrepreneurId)
          .eq('batch_id', batchId)
          .maybeSingle();

        if (assignCheckError) throw assignCheckError;

        if (existingAssignment) {
          results.assignments.skipped++;
          console.log(`   ⏭️  Assignment exists`);
        } else {
          if (!DRY_RUN) {
            const { error: assignInsertError } = await supabase
              .from('mentor_assignments')
              .insert({
                mentor_id: mentorId,
                entrepreneur_id: entrepreneurId,
                batch_id: batchId,
                status: 'active'
              });

            if (assignInsertError) throw assignInsertError;
            results.assignments.success++;
            console.log(`   ✅ Created assignment`);
          } else {
            results.assignments.success++;
            console.log(`   🔍 [DRY] Would create assignment`);
          }
        }
      } else if (mentorId.startsWith('dry-') || entrepreneurId.startsWith('dry-')) {
        results.assignments.success++;
        console.log(`   🔍 [DRY] Would create assignment`);
      }

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.entrepreneurs.failed++;
      results.errors.push({
        row: rowNum,
        data: row,
        error: error.message
      });
      console.error(`[${rowNum}/${data.length}] ❌ Error:`, error.message);
    }
  }

  // === Summary ===
  console.log('\n=== RESULTS ===');
  console.log('Mentors:');
  console.log(`  ✅ Created: ${results.mentors.success}`);
  console.log(`  ⏭️  Skipped: ${results.mentors.skipped}`);
  console.log(`  ❌ Failed: ${results.mentors.failed}`);
  console.log('\nEntrepreneurs:');
  console.log(`  ✅ Created: ${results.entrepreneurs.success}`);
  console.log(`  ⏭️  Skipped: ${results.entrepreneurs.skipped}`);
  console.log(`  ❌ Failed: ${results.entrepreneurs.failed}`);
  console.log('\nAssignments:');
  console.log(`  ✅ Created: ${results.assignments.success}`);
  console.log(`  ⏭️  Skipped: ${results.assignments.skipped}`);
  console.log(`  ❌ Failed: ${results.assignments.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-02.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncMapping()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncMapping;
