// 01-sync-batches.js
// Syncs batch.json (37 rows) to batches + batch_rounds tables

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
  batches: { success: 0, skipped: 0, failed: 0 },
  batch_rounds: { success: 0, skipped: 0, failed: 0 },
  errors: []
};

// Helper: Parse program from batch name
function parseProgramFromBatch(batchName) {
  const upper = batchName.toUpperCase();
  if (upper.includes('BANGKIT')) return 'Bangkit';
  if (upper.includes('MAJU')) return 'Maju';
  return 'Unknown';
}

// Helper: Parse date from "Start Month" or "End Month" (format: "Jan 2024" or "2024-01")
function parseMonthToDate(monthStr, isEndDate = false) {
  if (!monthStr) return null;

  try {
    // Handle formats like "Jan 2024", "January 2024"
    const monthMap = {
      'jan': '01', 'january': '01',
      'feb': '02', 'february': '02',
      'mar': '03', 'march': '03',
      'apr': '04', 'april': '04',
      'may': '05',
      'jun': '06', 'june': '06',
      'jul': '07', 'july': '07',
      'aug': '08', 'august': '08',
      'sep': '09', 'september': '09',
      'oct': '10', 'october': '10',
      'nov': '11', 'november': '11',
      'dec': '12', 'december': '12'
    };

    const parts = monthStr.trim().split(/[\s-]+/);
    if (parts.length >= 2) {
      const month = monthMap[parts[0].toLowerCase()];
      const year = parts[1];

      if (month && year) {
        // If end date, use last day of month
        const day = isEndDate ? new Date(parseInt(year), parseInt(month), 0).getDate() : '01';
        return `${year}-${month}-${day.toString().padStart(2, '0')}`;
      }
    }

    // Try ISO format
    if (monthStr.match(/^\d{4}-\d{2}/)) {
      return monthStr;
    }
  } catch (error) {
    console.warn(`Failed to parse date: ${monthStr}`, error);
  }

  return null;
}

async function syncBatches() {
  console.log('\n=== 01-sync-batches.js ===');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log('Input: sync-data/batch.json (37 rows)');
  console.log('Output: batches + batch_rounds tables\n');

  // Read JSON data
  const dataPath = path.join(process.cwd(), 'sync-data', 'batch.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File not found: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📊 Loaded ${data.length} rows from batch.json\n`);

  // Track unique batches
  const batchCache = new Map(); // batch_name -> batch_id

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      // Extract fields
      const batchName = row.Batch || row.batch;
      const roundNumber = row['Mentoring Round'] || row.mentoring_round || 1;
      const period = row.Period || row.period;
      const startMonth = row['Start Month'] || row.start_month;
      const endMonth = row['End Month'] || row.end_month;
      const notes = row.Notes || row.notes;

      if (!batchName) {
        throw new Error('Missing Batch name');
      }

      // Determine program
      const program = parseProgramFromBatch(batchName);

      // === 1. Create/lookup batch ===
      let batchId = batchCache.get(batchName);

      if (!batchId) {
        // Check if batch exists
        const { data: existingBatch, error: checkError } = await supabase
          .from('batches')
          .select('id')
          .eq('batch_name', batchName)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingBatch) {
          batchId = existingBatch.id;
          batchCache.set(batchName, batchId);
          results.batches.skipped++;
          console.log(`[${rowNum}/${data.length}] ⏭️  Batch exists: ${batchName}`);
        } else {
          // Create new batch
          if (!DRY_RUN) {
            const { data: newBatch, error: insertError } = await supabase
              .from('batches')
              .insert({
                batch_name: batchName,
                program: program,
                description: notes || period,
                status: 'active'
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            batchId = newBatch.id;
            batchCache.set(batchName, batchId);
            results.batches.success++;
            console.log(`[${rowNum}/${data.length}] ✅ Created batch: ${batchName} (${program})`);
          } else {
            console.log(`[${rowNum}/${data.length}] 🔍 [DRY] Would create batch: ${batchName} (${program})`);
            batchId = 'dry-run-id';
            batchCache.set(batchName, batchId);
            results.batches.success++;
          }
        }
      }

      // === 2. Create batch_round ===
      if (batchId && batchId !== 'dry-run-id') {
        // Check if round exists
        const { data: existingRound, error: roundCheckError } = await supabase
          .from('batch_rounds')
          .select('id')
          .eq('batch_id', batchId)
          .eq('round_number', roundNumber)
          .maybeSingle();

        if (roundCheckError) throw roundCheckError;

        if (existingRound) {
          results.batch_rounds.skipped++;
          console.log(`[${rowNum}/${data.length}]    ⏭️  Round ${roundNumber} exists`);
        } else {
          const startDate = parseMonthToDate(startMonth, false);
          const endDate = parseMonthToDate(endMonth, true);

          if (!DRY_RUN) {
            const { error: roundInsertError } = await supabase
              .from('batch_rounds')
              .insert({
                batch_id: batchId,
                round_number: roundNumber,
                round_name: `Round ${roundNumber}`,
                start_date: startDate,
                end_date: endDate,
                description: period,
                status: 'active'
              });

            if (roundInsertError) throw roundInsertError;
            results.batch_rounds.success++;
            console.log(`[${rowNum}/${data.length}]    ✅ Created round ${roundNumber}: ${period}`);
          } else {
            console.log(`[${rowNum}/${data.length}]    🔍 [DRY] Would create round ${roundNumber}: ${period}`);
            results.batch_rounds.success++;
          }
        }
      }

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.batch_rounds.failed++;
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
  console.log('Batches:');
  console.log(`  ✅ Created: ${results.batches.success}`);
  console.log(`  ⏭️  Skipped: ${results.batches.skipped}`);
  console.log(`  ❌ Failed: ${results.batches.failed}`);
  console.log('\nBatch Rounds:');
  console.log(`  ✅ Created: ${results.batch_rounds.success}`);
  console.log(`  ⏭️  Skipped: ${results.batch_rounds.skipped}`);
  console.log(`  ❌ Failed: ${results.batch_rounds.failed}`);

  if (results.errors.length > 0) {
    const errorsPath = path.join(process.cwd(), 'sync-errors-01.json');
    fs.writeFileSync(errorsPath, JSON.stringify(results.errors, null, 2));
    console.log(`\n⚠️  ${results.errors.length} errors written to ${errorsPath}`);
  }

  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncBatches()
    .then(() => {
      console.log('\n✅ Sync complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default syncBatches;
