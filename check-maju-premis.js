const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMajuPremis() {
  const { data } = await supabase
    .from('reports')
    .select('program, session_number, premis_dilawat, image_urls, base_payment_amount')
    .eq('program', 'Maju')
    .not('base_payment_amount', 'is', null)
    .limit(10);

  console.log('Maju reports with payment amounts:\n');
  data.forEach(r => {
    const hasPremisImages = r.image_urls?.premis && r.image_urls.premis.length > 0;
    console.log(`S${r.session_number}: premis_dilawat=${r.premis_dilawat}, has_premis_images=${hasPremisImages}, amount=RM${r.base_payment_amount}`);
  });
}

checkMajuPremis().catch(console.error);
