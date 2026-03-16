// Quick sanity check: What are all distinct payment_status values in reports table?

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPaymentStatus() {
  console.log('🔍 Checking distinct payment_status values in reports table...\n');

  try {
    // Get all distinct payment_status values with counts
    const { data, error } = await supabase
      .from('reports')
      .select('payment_status')
      .order('payment_status');

    if (error) throw error;

    // Count occurrences manually since Supabase doesn't support GROUP BY directly
    const statusCounts = {};
    data.forEach(row => {
      const status = row.payment_status || 'NULL';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Payment Status Distribution:\n');
    console.log('Status                      | Count');
    console.log('----------------------------|------');

    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .forEach(([status, count]) => {
        console.log(`${status.padEnd(27)} | ${count}`);
      });

    console.log('\n' + '='.repeat(40));
    console.log(`Total Reports: ${data.length}`);
    console.log('='.repeat(40) + '\n');

    // Specific check for reports that should be 'paid'
    console.log('🔍 Checking for reports that might need status update...\n');

    const { data: approvedReports, error: approvedError } = await supabase
      .from('reports')
      .select('id, nama_mentor, nama_usahawan, program, session_number, payment_status, payment_batch_id')
      .eq('payment_status', 'approved_for_payment')
      .not('payment_batch_id', 'is', null)
      .limit(10);

    if (approvedError) throw approvedError;

    if (approvedReports && approvedReports.length > 0) {
      console.log(`⚠️  Found ${approvedReports.length} reports with payment_status='approved_for_payment' that have a payment_batch_id`);
      console.log('   These reports are in a payment batch but not marked as paid yet.\n');
      console.log('   Sample records:');
      approvedReports.slice(0, 5).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.nama_mentor} → ${r.nama_usahawan} (${r.program} S${r.session_number}) - Batch: ${r.payment_batch_id.substring(0, 8)}...`);
      });
      console.log('\n   💡 These will be marked as "paid" when their batch is marked as paid via the new fix.\n');
    } else {
      console.log('✅ No reports found with payment_batch_id but status still "approved_for_payment"\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkPaymentStatus();
