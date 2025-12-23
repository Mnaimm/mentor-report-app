/**
 * DEBUG BANGKIT ROW 70 MIGRATION ISSUE
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugRow70() {
  console.log('\n🔍 Debugging Bangkit Row 70: NOOR SHA\'ADAH BINTI MAHADI\n');

  const entrepreneurName = 'NOOR SHA\'ADAH BINTI MAHADI';
  const mentorEmail = 'muxemizziller@gmail.com';
  const program = 'Bangkit';
  const sessionNumber = 1;

  // 1. Check entrepreneur
  console.log('1️⃣ Checking entrepreneur...');
  const { data: entrepreneurs, error: entError } = await supabase
    .from('entrepreneurs')
    .select('*')
    .eq('name', entrepreneurName)
    .eq('program', program);

  if (entError) {
    console.log('   ❌ Error:', entError.message);
  } else {
    console.log(`   Found ${entrepreneurs.length} entrepreneur(s):`);
    entrepreneurs.forEach(ent => {
      console.log(`   - ID: ${ent.id}, Name: ${ent.name}`);
    });
  }

  // 2. Check mentor
  console.log('\n2️⃣ Checking mentor...');
  const { data: mentor, error: mentorError } = await supabase
    .from('mentors')
    .select('*')
    .eq('email', mentorEmail)
    .maybeSingle();

  if (mentorError) {
    console.log('   ❌ Error:', mentorError.message);
  } else if (mentor) {
    console.log(`   ✅ Found: ${mentor.name} (${mentor.email}) - ID: ${mentor.id}`);
  } else {
    console.log('   ❌ Mentor not found');
  }

  // 3. Check if entrepreneur and session already exist
  if (mentor && entrepreneurs.length > 0) {
    const entrepreneurId = entrepreneurs[0].id;
    const mentorId = mentor.id;

    console.log('\n3️⃣ Checking for existing sessions...');
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('mentor_id', mentorId)
      .eq('entrepreneur_id', entrepreneurId)
      .eq('program', program)
      .eq('session_number', sessionNumber);

    if (sessionError) {
      console.log('   ❌ Error:', sessionError.message);
    } else {
      console.log(`   Found ${sessions.length} session(s):`);
      sessions.forEach(sess => {
        console.log(`   - ID: ${sess.id}, Session #${sess.session_number}, Date: ${sess.session_date}`);
      });
    }

    // 4. Check for existing reports
    console.log('\n4️⃣ Checking for existing reports...');
    const { data: reports, error: reportError } = await supabase
      .from('reports')
      .select('id, sheets_row_number, session_id, source')
      .eq('sheets_row_number', 70)
      .eq('program', program);

    if (reportError) {
      console.log('   ❌ Error:', reportError.message);
    } else {
      console.log(`   Found ${reports.length} report(s) with sheets_row_number=70:`);
      reports.forEach(rep => {
        console.log(`   - ID: ${rep.id}, Session: ${rep.session_id}, Source: ${rep.source}`);
      });
    }
  }

  console.log('\n✅ Debug complete\n');
}

debugRow70();
