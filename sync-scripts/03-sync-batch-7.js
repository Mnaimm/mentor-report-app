// 03-sync-batch-7.js
// Syncs all-m.json (69 rows - Batch 7 Maju) to entrepreneurs + mentor_assignments tables

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
  entrepreneurs: { success: 0, skipped: 0, failed: 0 },
  assignments: { success: 0, skipped: 0, failed: 0 },
  errors: []
};

const entrepreneurCache = new Map();
const mentorCache = new Map();
let batch7Id = null;

// Helper: Get mentor ID by name
async function getMentorIdByName(mentorName) {
  if (!mentorName) return null;

  const cached = mentorCache.get(mentorName.toLowerCase());
  if (cached) return cached;

  const { data, error } = await supabase
    .from('mentors')
    .select('id')
    .ilike('name', mentorName)
    .maybeSingle();

  if (error) {
    console.warn(`   ⚠️  Mentor lookup error: ${mentorName}`, error.message);
    return null;
  }

  if (data) {
    mentorCache.set(mentorName.toLowerCase(), data.id);
    return data.id;
  }

  console.warn(`   ⚠️  Mentor not found: ${mentorName}`);
  return null;
}

// Helper: Get Batch 7 ID
async function getBatch7Id() {
  if (batch7Id) return batch7Id;

  const { data, error } = await supabase
    .from('batches')
    .select('id')
    .eq('batch_name', 'Batch 7')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    console.warn('   ⚠️  Batch 7 not found in database. Please run 01-sync-batches.js first.');
    return null;
  }

  batch7Id = data.id;
  return batch7Id;
}

async function syncBatch7() {
  console.log('\n=== 03-sync-batch-7.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/all-m.json (69 rows - Batch 7 Maju)');
  console.log('Output: entrepreneurs + mentor_assignments tables\n');

  const dataPath = path.join(process.cwd(), 'sync-data', 'all-m.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from all-m.json\n`);

  // Get Batch 7 ID
  const batchId = await getBatch7Id();
  if (!batchId && !DRY_RUN) {
    console.error('❌ Cannot proceed without Batch 7 in database.');
    process.exit(1);
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const businessName = row['NAME OF BUSINESS'] || row.name_of_business;
      const ownerName = row['NAME OF BUSINESS OWNER'] || row.name_of_business_owner;
      const mentorName = row.Mentor || row.mentor;
      const state = row.STATE || row.state;
      const phone = row['CONTACT NO'] || row.contact_no;
      const email = row['EMAIL ADDRESS'] || row.email_address;
      const businessType = row['BUSINESS SEGMENTATION'] || row.business_segmentation;
      const program = row.Program || 'Maju';

      if (!ownerName) {
        throw new Error('Missing business owner name');
      }

      console.log(`[${rowNum}/${data.length}] Processing: ${ownerName}`);

      // Check if entrepreneur exists
      const cacheKey = `${ownerName.toLowerCase()}_${email?.toLowerCase() || 'no-email'}`;
      let entrepreneurId = entrepreneurCache.get(cacheKey);

      if (!entrepreneurId) {
        let query = supabase.from('entrepreneurs').select('id').eq('name', ownerName);
        if (email) {
          query = query.eq('email', email.toLowerCase());
        }

        const { data: existing, error: checkError } = await query.maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          entrepreneurId = existing.id;
          entrepreneurCache.set(cacheKey, entrepreneurId);
          results.entrepreneurs.skipped++;
          console.log(`   ⏭️  Entrepreneur exists: ${ownerName}`);
        } else {
          // Create new entrepreneur
          if (!DRY_RUN) {
            const { data: newEntrepreneur, error: insertError } = await supabase
              .from('entrepreneurs')
              .insert({
                name: ownerName,
                email: email ? email.toLowerCase() : null,
                business_name: businessName,
                phone: phone,
                program: program,
                batch: 'Batch 7',
                state: state,
                business_type: businessType,
                status: 'active'
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            entrepreneurId = newEntrepreneur.id;
            entrepreneurCache.set(cacheKey, entrepreneurId);
            results.entrepreneurs.success++;
            console.log(`   ✅ Created entrepreneur: ${ownerName}`);
          } else {
            entrepreneurId = `dry-entrepreneur-${ownerName}`;
            entrepreneurCache.set(cacheKey, entrepreneurId);
            results.entrepreneurs.success++;
            console.log(`   🔍 [DRY] Would create entrepreneur: ${ownerName}`);
          }
        }
      }

      // Create assignment
      if (mentorName && entrepreneurId && !entrepreneurId.startsWith('dry-')) {
        const mentorId = await getMentorIdByName(mentorName);

        if (mentorId) {
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
              console.log(`   ✅ Created assignment (Mentor: ${mentorName})`);
            } else {
              results.assignments.success++;
              console.log(`   🔍 [DRY] Would create assignment (Mentor: ${mentorName})`);
            }
          }
        }
      } else if (entrepreneurId?.startsWith('dry-')) {
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
  console.log('Entrepreneurs:');
  console.log(`  ✅ Created: ${results.entrepreneurs.success}`);
  console.log(`  ⏭️  Skipped: ${results.entrepreneurs.skipped}`);
  console.log(`  ❌ Failed: ${results.entrepreneurs.failed}`);
  console.log('\nAssignments:');
  console.log(`  ✅ Created: ${results.assignments.success}`);
  console.log(`  ⏭️  Skipped: ${results.assignments.skipped}`);
  console.log(`  ❌ Failed: ${results.assignments.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-03.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncBatch7()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncBatch7;
