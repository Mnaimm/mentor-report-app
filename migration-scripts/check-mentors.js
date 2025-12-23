/**
 * CHECK MENTORS TABLE FOR MISSING EMAILS
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMentors() {
  console.log('\n🔍 Checking mentors table for missing emails...\n');

  const emailsToCheck = [
    'muxemizziller@gmail.com',     // Hazazi Ariffin (Bangkit Row 70)
    'nurathirahrazduan@gmail.com'  // KUSPA (Maju Row 19)
  ];

  for (const email of emailsToCheck) {
    const { data, error } = await supabase
      .from('mentors')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.log(`❌ Error checking ${email}:`, error.message);
    } else if (data) {
      console.log(`✅ FOUND: ${email}`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Name: ${data.name}`);
    } else {
      console.log(`❌ NOT FOUND: ${email}`);
    }
    console.log('');
  }

  // Also check for Hazazi and KUSPA by name
  console.log('🔍 Searching for "Hazazi" by name...\n');
  const { data: hazaziData } = await supabase
    .from('mentors')
    .select('*')
    .ilike('name', '%Hazazi%');

  if (hazaziData && hazaziData.length > 0) {
    hazaziData.forEach(mentor => {
      console.log(`   Found: ${mentor.name} (${mentor.email}) - ID: ${mentor.id}`);
    });
  } else {
    console.log('   No mentors found with name containing "Hazazi"');
  }

  console.log('\n🔍 Searching for "KUSPA" by name...\n');
  const { data: kuspaData } = await supabase
    .from('mentors')
    .select('*')
    .ilike('name', '%KUSPA%');

  if (kuspaData && kuspaData.length > 0) {
    kuspaData.forEach(mentor => {
      console.log(`   Found: ${mentor.name} (${mentor.email}) - ID: ${mentor.id}`);
    });
  } else {
    console.log('   No mentors found with name containing "KUSPA"');
  }

  console.log('\n✅ Check complete\n');
}

checkMentors();
