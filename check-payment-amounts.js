const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPaymentAmounts() {
  console.log('🔍 Checking payment amounts in reports table...\n');

  // Get sample of reports WITH payment amounts
  const { data: withPayment, error: error1 } = await supabase
    .from('reports')
    .select('program, session_number, premis_dilawat, base_payment_amount, nama_mentor')
    .not('base_payment_amount', 'is', null)
    .limit(5);

  console.log('📊 Sample reports WITH base_payment_amount:');
  console.table(withPayment);

  // Get sample of reports WITHOUT payment amounts
  const { data: withoutPayment, error: error2 } = await supabase
    .from('reports')
    .select('program, session_number, premis_dilawat, base_payment_amount, nama_mentor, status, payment_status')
    .is('base_payment_amount', null)
    .limit(10);

  console.log('\n📊 Sample reports WITHOUT base_payment_amount:');
  console.table(withoutPayment);

  // Count by program
  const { data: bangkitWithout } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('program', 'Bangkit')
    .is('base_payment_amount', null);

  const { data: majuWithout } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('program', 'Maju')
    .is('base_payment_amount', null);

  console.log('\n📊 Reports without payment amounts:');
  console.log(`Bangkit: ${bangkitWithout?.length || 0}`);
  console.log(`Maju: ${majuWithout?.length || 0}`);
}

checkPaymentAmounts().catch(console.error);
