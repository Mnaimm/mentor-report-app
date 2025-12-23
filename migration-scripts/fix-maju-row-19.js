/**
 * FIX MAJU ROW 19 - Update nama_mentee to "Daliah Binti Dahalang"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixMajuRow19() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔧 FIXING MAJU ROW 19 - Updating nama_mentee');
  console.log('═'.repeat(70));

  try {
    // Find the report with sheets_row_number=19 and program=Maju
    console.log('\n📋 Finding Maju Row 19...');
    const { data: report, error: findError } = await supabase
      .from('reports')
      .select('*')
      .eq('sheets_row_number', 19)
      .eq('program', 'Maju')
      .single();

    if (findError) {
      console.log('   ❌ Error finding report:', findError.message);
      return;
    }

    if (!report) {
      console.log('   ❌ Report not found!');
      return;
    }

    console.log('   ✅ Found report ID:', report.id);
    console.log('   Current nama_mentee:', report.nama_mentee || '(null)');

    // Update nama_mentee
    console.log('\n🔧 Updating nama_mentee to "Daliah Binti Dahalang"...');
    const { data: updated, error: updateError } = await supabase
      .from('reports')
      .update({
        nama_mentee: 'Daliah Binti Dahalang'
      })
      .eq('id', report.id)
      .select()
      .single();

    if (updateError) {
      console.log('   ❌ Update failed:', updateError.message);
      return;
    }

    console.log('   ✅ Successfully updated!');
    console.log('   New nama_mentee:', updated.nama_mentee);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ FIX COMPLETE!');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
  }
}

fixMajuRow19();
