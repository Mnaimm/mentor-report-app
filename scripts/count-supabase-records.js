/**
 * COUNT RECORDS IN SUPABASE
 * Run: node scripts/count-supabase-records.js
 *
 * Purpose: Get current record counts from Supabase tables
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function countSupabaseRecords() {
  console.log('📊 Counting Supabase Records...\n');
  console.log('═'.repeat(70));

  try {
    // Count reports by program
    const { count: bangkitCount, error: bangkitError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Bangkit');

    const { count: majuCount, error: majuError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('program', 'Maju');

    const { count: totalCount, error: allError } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true });

    if (bangkitError || majuError || allError) {
      throw new Error('Error fetching counts: ' + (bangkitError?.message || majuError?.message || allError?.message));
    }

    console.log('\n📈 REPORTS TABLE:\n');
    console.log(`   Bangkit reports: ${bangkitCount}`);
    console.log(`   Maju reports:    ${majuCount}`);
    console.log(`   ─────────────────────`);
    console.log(`   Total reports:   ${totalCount}`);

    console.log('\n' + '═'.repeat(70));

    return {
      bangkit: bangkitCount,
      maju: majuCount,
      total: totalCount
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the count
if (require.main === module) {
  countSupabaseRecords()
    .then((counts) => {
      console.log('\n✅ Count complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { countSupabaseRecords };
