/**
 * VERIFY MIGRATED DATA IN SUPABASE
 * Run: node migration-scripts/verify-migrated-data.js
 *
 * Verifies all migrated reports from Google Sheets → Supabase
 * Checks:
 * - Total count of reports
 * - Required fields are populated (not NULL)
 * - Breakdown by program (Bangkit vs Maju)
 * - Sample data preview
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Count NULL values in important fields
 */
function countNulls(report) {
  const nullFields = [];

  // Check basic fields
  if (!report.mentor_email) nullFields.push('mentor_email');
  if (!report.nama_mentor) nullFields.push('nama_mentor');
  if (!report.session_date) nullFields.push('session_date');
  if (!report.session_number) nullFields.push('session_number');

  // Program-specific checks
  if (report.program === 'Bangkit') {
    if (!report.nama_usahawan) nullFields.push('nama_usahawan');
  } else if (report.program === 'Maju') {
    if (!report.nama_mentee) nullFields.push('nama_mentee');
  }

  return nullFields;
}

/**
 * Main verification function
 */
async function verifyMigratedData() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 VERIFYING MIGRATED DATA IN SUPABASE');
  console.log('═'.repeat(70));

  try {
    // ============================================
    // 1. COUNT TOTAL REPORTS
    // ============================================
    console.log('\n📊 STEP 1: COUNT REPORTS');
    console.log('─'.repeat(70));

    const { data: allReports, error: countError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (countError) {
      console.error('❌ Error fetching reports:', countError);
      return;
    }

    const totalReports = allReports.length;
    const bangkitReports = allReports.filter(r => r.program === 'Bangkit');
    const majuReports = allReports.filter(r => r.program === 'Maju');
    const migratedReports = allReports.filter(r => r.source?.includes('migration'));

    console.log(`   📝 Total reports:      ${totalReports}`);
    console.log(`   🔵 Bangkit reports:    ${bangkitReports.length}`);
    console.log(`   🟢 Maju reports:       ${majuReports.length}`);
    console.log(`   📦 Migrated reports:   ${migratedReports.length}`);

    // ============================================
    // 2. CHECK FOR NULL VALUES
    // ============================================
    console.log('\n📊 STEP 2: CHECK FOR NULL/EMPTY REQUIRED FIELDS');
    console.log('─'.repeat(70));

    let totalNullCount = 0;
    const reportswithNulls = [];

    migratedReports.forEach(report => {
      const nullFields = countNulls(report);
      if (nullFields.length > 0) {
        totalNullCount += nullFields.length;
        reportswithNulls.push({
          id: report.id,
          program: report.program,
          entrepreneur: report.nama_usahawan || report.nama_mentee,
          nullFields: nullFields
        });
      }
    });

    if (totalNullCount === 0) {
      console.log('   ✅ All required fields are populated!');
      console.log('   🎉 No NULL values found in critical fields');
    } else {
      console.log(`   ⚠️  Found ${totalNullCount} NULL values across ${reportswithNulls.length} reports`);
      console.log('\n   Reports with NULL values:');
      reportswithNulls.forEach(({ id, program, entrepreneur, nullFields }) => {
        console.log(`      - ${program} | ${entrepreneur}`);
        console.log(`        NULL fields: ${nullFields.join(', ')}`);
      });
    }

    // ============================================
    // 3. BREAKDOWN BY SOURCE
    // ============================================
    console.log('\n📊 STEP 3: BREAKDOWN BY SOURCE');
    console.log('─'.repeat(70));

    const sourceBreakdown = {};
    allReports.forEach(report => {
      const source = report.source || 'unknown';
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    });

    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`   ${source.padEnd(25)}: ${count} reports`);
    });

    // ============================================
    // 4. COUNT SESSIONS & ENTREPRENEURS
    // ============================================
    console.log('\n📊 STEP 4: RELATED DATA');
    console.log('─'.repeat(70));

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*');

    const { data: entrepreneurs, error: entError } = await supabase
      .from('entrepreneurs')
      .select('*');

    if (!sessionsError) {
      const bangkitSessions = sessions.filter(s => s.program === 'Bangkit').length;
      const majuSessions = sessions.filter(s => s.program === 'Maju').length;
      console.log(`   📅 Total sessions:     ${sessions.length}`);
      console.log(`      - Bangkit:          ${bangkitSessions}`);
      console.log(`      - Maju:             ${majuSessions}`);
    }

    if (!entError) {
      const bangkitEnts = entrepreneurs.filter(e => e.program === 'Bangkit').length;
      const majuEnts = entrepreneurs.filter(e => e.program === 'Maju').length;
      console.log(`   👥 Total entrepreneurs: ${entrepreneurs.length}`);
      console.log(`      - Bangkit:          ${bangkitEnts}`);
      console.log(`      - Maju:             ${majuEnts}`);
    }

    // ============================================
    // 5. SAMPLE BANGKIT REPORT
    // ============================================
    console.log('\n📊 STEP 5: SAMPLE BANGKIT REPORT');
    console.log('─'.repeat(70));

    if (bangkitReports.length > 0) {
      const sample = bangkitReports[0];
      console.log(`   ID:              ${sample.id}`);
      console.log(`   Entrepreneur:    ${sample.nama_usahawan}`);
      console.log(`   Mentor:          ${sample.nama_mentor}`);
      console.log(`   Session #:       ${sample.session_number}`);
      console.log(`   Session Date:    ${sample.session_date}`);
      console.log(`   Rumusan:         ${sample.rumusan ? sample.rumusan.substring(0, 60) + '...' : '[empty]'}`);
      console.log(`   Inisiatif:       ${sample.inisiatif?.length || 0} items`);
      console.log(`   Jualan Terkini:  ${sample.jualan_terkini?.length || 0} months`);
      console.log(`   Source:          ${sample.source}`);
      console.log(`   Sheets Row:      ${sample.sheets_row_number}`);
    }

    // ============================================
    // 6. SAMPLE MAJU REPORT
    // ============================================
    console.log('\n📊 STEP 6: SAMPLE MAJU REPORT');
    console.log('─'.repeat(70));

    if (majuReports.length > 0) {
      const sample = majuReports[0];
      console.log(`   ID:              ${sample.id}`);
      console.log(`   Mentee:          ${sample.nama_mentee}`);
      console.log(`   Business:        ${sample.nama_bisnes}`);
      console.log(`   Mentor:          ${sample.nama_mentor}`);
      console.log(`   Session #:       ${sample.session_number}`);
      console.log(`   Session Date:    ${sample.session_date}`);
      console.log(`   Findings:        ${sample.mentoring_findings?.length || 0} items`);
      console.log(`   Financial Data:  ${sample.data_kewangan_bulanan?.length || 0} months`);
      console.log(`   Source:          ${sample.source}`);
      console.log(`   Sheets Row:      ${sample.sheets_row_number}`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '═'.repeat(70));
    console.log('✅ VERIFICATION COMPLETE!');
    console.log('═'.repeat(70));

    if (totalNullCount === 0 && migratedReports.length === 38) {
      console.log('\n🎉 SUCCESS! All 38 reports migrated with complete data!');
      console.log(`   ✅ ${bangkitReports.length} Bangkit reports`);
      console.log(`   ✅ ${majuReports.length} Maju reports`);
      console.log(`   ✅ No NULL values in required fields`);
    } else {
      console.log('\n⚠️  ISSUES FOUND:');
      if (migratedReports.length !== 38) {
        console.log(`   - Expected 38 migrated reports, found ${migratedReports.length}`);
      }
      if (totalNullCount > 0) {
        console.log(`   - Found ${totalNullCount} NULL values in required fields`);
      }
    }

    console.log('\n' + '═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run verification
verifyMigratedData();
