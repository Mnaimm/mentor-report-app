const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzePaymentRates() {
  console.log('🔍 Analyzing payment rate patterns...\n');

  const { data, error } = await supabase
    .from('reports')
    .select('program, premis_dilawat, base_payment_amount, session_number')
    .not('base_payment_amount', 'is', null)
    .order('program');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const grouped = {};
  data.forEach(r => {
    const key = `${r.program}_${r.premis_dilawat ? 'with_premis' : 'no_premis'}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r.base_payment_amount);
  });

  console.log('📊 Payment amount distribution by program and premises visit:\n');
  Object.keys(grouped).sort().forEach(key => {
    const amounts = grouped[key];
    const unique = [...new Set(amounts)].sort((a, b) => a - b);
    const counts = unique.map(amt => ({
      amount: amt,
      count: amounts.filter(a => a === amt).length
    }));

    console.log(`${key}:`);
    counts.forEach(({ amount, count }) => {
      console.log(`  RM ${amount.toFixed(2)}: ${count} reports`);
    });
    console.log('');
  });
}

analyzePaymentRates().catch(console.error);
