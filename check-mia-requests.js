// Check MIA requests in Supabase
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMIARequests() {
  console.log('🔍 Checking MIA requests table...\n');

  // Get all MIA requests
  const { data, error } = await supabase
    .from('mia_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching MIA requests:', error);
    return;
  }

  console.log(`📊 Found ${data.length} MIA requests\n`);

  if (data.length === 0) {
    console.log('⚠️ No MIA requests found in database');
    console.log('\nTrying to find reports with MIA status...\n');

    // Check reports table for MIA entries
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, mentor_email, mentee_name, program_type, session_number, mia_status, mia_reason, created_at')
      .eq('mia_status', 'MIA')
      .order('created_at', { ascending: false })
      .limit(5);

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`📋 Found ${reports.length} reports with MIA status:`);
    reports.forEach(r => {
      console.log(`  - ${r.mentee_name} (${r.program_type}) - Session ${r.session_number}`);
      console.log(`    Mentor: ${r.mentor_email}`);
      console.log(`    Reason: ${r.mia_reason?.substring(0, 50)}...`);
      console.log(`    Created: ${r.created_at}\n`);
    });

  } else {
    data.forEach((req, i) => {
      console.log(`${i + 1}. ${req.mentee_name} (${req.program})`);
      console.log(`   Mentor: ${req.mentor_name}`);
      console.log(`   Session: ${req.session_number}, Batch: ${req.batch}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Created: ${req.created_at}`);
      console.log(`   Proofs: WA=${!!req.proof_whatsapp_url}, Email=${!!req.proof_email_url}, Call=${!!req.proof_call_url}\n`);
    });
  }
}

checkMIARequests().catch(console.error);
