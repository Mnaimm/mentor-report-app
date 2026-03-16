// Check if ROZAINI exists in entrepreneurs table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRozaini() {
  console.log('🔍 Checking for ROZAINI BINTI JAAFAR in entrepreneurs table...\n');

  // Check by name
  const { data: byName, error: nameError } = await supabase
    .from('entrepreneurs')
    .select('*')
    .ilike('name', '%ROZAINI%JAAFAR%');

  if (nameError) {
    console.error('❌ Error searching by name:', nameError);
  } else {
    console.log(`Found ${byName.length} records by name:`);
    byName.forEach(e => {
      console.log(`  - ID: ${e.id}`);
      console.log(`    Name: ${e.name}`);
      console.log(`    Email: ${e.email}`);
      console.log(`    Company: ${e.company_name}`);
      console.log('');
    });
  }

  // Check by email
  console.log('\n🔍 Checking by email: rozainijaafar.ent@gmail.com\n');
  const { data: byEmail, error: emailError } = await supabase
    .from('entrepreneurs')
    .select('*')
    .eq('email', 'rozainijaafar.ent@gmail.com');

  if (emailError) {
    console.error('❌ Error searching by email:', emailError);
  } else {
    console.log(`Found ${byEmail.length} records by email:`);
    byEmail.forEach(e => {
      console.log(`  - ID: ${e.id}`);
      console.log(`    Name: ${e.name}`);
      console.log(`    Email: ${e.email}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkRozaini();
