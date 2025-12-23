/**
 * CLEANUP TEST DATA FROM SUPABASE
 * Run: node migration-scripts/cleanup-test-data.js
 *
 * This will DELETE all test data from:
 * - reports table (309 test records with NULL fields)
 * - sessions table (40 test records)
 *
 * IMPORTANT: This is DESTRUCTIVE! Make sure you have backups.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check for --confirm flag
const CONFIRMED = process.argv.includes('--confirm');

async function cleanupTestData() {
  console.log('\n' + '═'.repeat(70));
  console.log('🗑️  CLEANUP TEST DATA FROM SUPABASE');
  console.log('═'.repeat(70));

  console.log('\n⚠️  WARNING: This will DELETE the following data:');
  console.log('   • 309 test reports (with 100% NULL critical fields)');
  console.log('   • 40 test sessions');
  console.log('\n   This action CANNOT be undone!');
  console.log('   Make sure you have exported the data first (already done in supabase-audit/)');

  // Count current data
  console.log('\n📊 Current data in Supabase:');

  const { count: reportCount } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  const { count: sessionCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });

  console.log(`   Reports: ${reportCount} records`);
  console.log(`   Sessions: ${sessionCount} records`);

  // Ask for confirmation
  console.log('\n' + '─'.repeat(70));

  if (!CONFIRMED) {
    console.log('\n❌ Cleanup cancelled. To proceed, run with --confirm flag:');
    console.log('   node migration-scripts/cleanup-test-data.js --confirm');
    process.exit(0);
  }

  console.log('\n✅ Confirmed with --confirm flag. Starting cleanup...\n');
  console.log('═'.repeat(70));

  try {
    // ============================================
    // STEP 1: DELETE ALL REPORTS
    // ============================================
    console.log('\n🗑️  Step 1: Deleting all reports...');

    const { error: reportsError, count: deletedReports } = await supabase
      .from('reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible ID match)

    if (reportsError) {
      console.error('   ❌ Error deleting reports:', reportsError.message);
      throw reportsError;
    }

    console.log(`   ✅ Deleted all reports`);

    // ============================================
    // STEP 2: DELETE ALL SESSIONS
    // ============================================
    console.log('\n🗑️  Step 2: Deleting all sessions...');

    const { error: sessionsError, count: deletedSessions } = await supabase
      .from('sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (sessionsError) {
      console.error('   ❌ Error deleting sessions:', sessionsError.message);
      throw sessionsError;
    }

    console.log(`   ✅ Deleted all sessions`);

    // ============================================
    // STEP 3: VERIFY CLEANUP
    // ============================================
    console.log('\n' + '═'.repeat(70));
    console.log('📊 VERIFICATION:');
    console.log('═'.repeat(70));

    const { count: newReportCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true });

    const { count: newSessionCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });

    console.log(`\n   Reports remaining:  ${newReportCount} (should be 0)`);
    console.log(`   Sessions remaining: ${newSessionCount} (should be 0)`);

    if (newReportCount === 0 && newSessionCount === 0) {
      console.log('\n   ✅ SUCCESS! Tables are now empty and ready for clean migration.');
    } else {
      console.log('\n   ⚠️  WARNING: Some records may still remain. Check manually.');
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ CLEANUP COMPLETE!');
    console.log('═'.repeat(70));
    console.log('\n💡 Next steps:');
    console.log('   1. Run migration script for v8 tab (28 Bangkit reports)');
    console.log('   2. Run migration script for LaporanMaju tab (10 Maju reports)');
    console.log('   3. Verify all 38 reports have complete data (no NULL fields)');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ FATAL ERROR during cleanup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanupTestData();
