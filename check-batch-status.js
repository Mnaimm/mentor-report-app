// Check the status of the payment batch containing the 5 reports

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBatch() {
  console.log('🔍 Checking payment batch for the 5 reports...\n');

  // First, get the batch ID from one of the reports
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('payment_batch_id')
    .eq('payment_status', 'approved_for_payment')
    .not('payment_batch_id', 'is', null)
    .limit(1)
    .single();

  if (reportError || !report) {
    console.log('❌ Could not find report with payment_batch_id');
    return;
  }

  const batchId = report.payment_batch_id;
  console.log(`📦 Batch ID: ${batchId}\n`);

  // Now get batch details
  const { data: batch, error: batchError } = await supabase
    .from('payment_batches')
    .select('*')
    .eq('id', batchId)
    .single();

  if (batchError || !batch) {
    console.log('❌ Batch not found in payment_batches table');
    return;
  }

  console.log('📊 Batch Details:\n');
  console.log(`Name:         ${batch.batch_name}`);
  console.log(`Status:       ${batch.status}`);
  console.log(`Created:      ${new Date(batch.created_at).toLocaleString()}`);
  console.log(`Created By:   ${batch.created_by}`);
  console.log(`Paid At:      ${batch.paid_at ? new Date(batch.paid_at).toLocaleString() : 'NOT PAID YET'}`);
  console.log(`Paid By:      ${batch.paid_by || 'N/A'}`);
  console.log(`Total Amount: RM ${batch.total_amount}`);
  console.log(`Total Reports: ${batch.total_reports}`);
  console.log(`\n${'='.repeat(50)}\n`);

  if (batch.status === 'paid' && batch.paid_at) {
    console.log('⚠️  ISSUE DETECTED:\n');
    console.log('   This batch is marked as PAID in payment_batches table');
    console.log('   BUT the 5 reports still have payment_status="approved_for_payment"');
    console.log('   \n   This happened because the batch was marked as paid BEFORE the fix.\n');
    console.log('💡 SOLUTION:\n');
    console.log('   Run this SQL in Supabase to fix the 5 reports:\n');
    console.log(`   UPDATE reports`);
    console.log(`   SET payment_status = 'paid',`);
    console.log(`       paid_at = '${batch.paid_at}'`);
    console.log(`   WHERE payment_batch_id = '${batchId}';`);
    console.log('\n   This will update the 5 reports to match the batch status.');
  } else {
    console.log('✅ Batch is NOT marked as paid yet.\n');
    console.log('   When an admin marks this batch as paid via the UI,');
    console.log('   the NEW FIX will automatically update all 5 reports');
    console.log('   to payment_status="paid".');
  }
}

checkBatch();
