/**
 * EXPORT ALL SUPABASE DATA TO JSON FILES
 * Run: node migration-scripts/export-supabase-data.js
 *
 * This will export all data from Supabase tables to JSON files
 * so we can inspect what's actually in there
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function exportAllData() {
  console.log('📦 Exporting all Supabase data...\n');
  console.log('═'.repeat(70));

  // Create export directory
  const exportDir = path.join(__dirname, '..', 'supabase-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    // ============================================
    // 1. EXPORT REPORTS
    // ============================================
    console.log('\n📊 Exporting REPORTS table...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('   ❌ Error:', reportsError.message);
    } else {
      const filename = `reports_${timestamp}.json`;
      fs.writeFileSync(
        path.join(exportDir, filename),
        JSON.stringify(reports, null, 2)
      );
      console.log(`   ✅ Exported ${reports.length} reports to: ${filename}`);

      // Show sample
      if (reports.length > 0) {
        console.log('\n   📋 Sample report (first record):');
        const sample = reports[0];
        console.log(`      ID: ${sample.id}`);
        console.log(`      Program: ${sample.program}`);
        console.log(`      Mentor: ${sample.mentor_email}`);
        console.log(`      Session: ${sample.session_number}`);
        console.log(`      Date: ${sample.session_date}`);
        console.log(`      Created: ${sample.created_at}`);

        // Count null fields
        const fields = Object.keys(sample);
        const nullFields = fields.filter(f => sample[f] === null);
        console.log(`      Total fields: ${fields.length}`);
        console.log(`      NULL fields: ${nullFields.length} (${Math.round(nullFields.length/fields.length*100)}%)`);
      }
    }

    // ============================================
    // 2. EXPORT SESSIONS
    // ============================================
    console.log('\n📊 Exporting SESSIONS table...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('   ❌ Error:', sessionsError.message);
    } else {
      const filename = `sessions_${timestamp}.json`;
      fs.writeFileSync(
        path.join(exportDir, filename),
        JSON.stringify(sessions, null, 2)
      );
      console.log(`   ✅ Exported ${sessions.length} sessions to: ${filename}`);
    }

    // ============================================
    // 3. EXPORT ENTREPRENEURS
    // ============================================
    console.log('\n📊 Exporting ENTREPRENEURS table...');
    const { data: entrepreneurs, error: entrepreneursError } = await supabase
      .from('entrepreneurs')
      .select('*')
      .order('created_at', { ascending: false });

    if (entrepreneursError) {
      console.error('   ❌ Error:', entrepreneursError.message);
    } else {
      const filename = `entrepreneurs_${timestamp}.json`;
      fs.writeFileSync(
        path.join(exportDir, filename),
        JSON.stringify(entrepreneurs, null, 2)
      );
      console.log(`   ✅ Exported ${entrepreneurs.length} entrepreneurs to: ${filename}`);
    }

    // ============================================
    // 4. ANALYZE REPORTS DATA QUALITY
    // ============================================
    console.log('\n' + '═'.repeat(70));
    console.log('\n📈 DATA QUALITY ANALYSIS:\n');

    if (reports && reports.length > 0) {
      // Group by program
      const byProgram = reports.reduce((acc, r) => {
        acc[r.program] = (acc[r.program] || 0) + 1;
        return acc;
      }, {});

      console.log('📊 Reports by Program:');
      Object.entries(byProgram).forEach(([program, count]) => {
        console.log(`   ${program}: ${count} reports`);
      });

      // Check for null mentor_email
      const nullMentors = reports.filter(r => !r.mentor_email);
      console.log(`\n⚠️  Reports with NULL mentor_email: ${nullMentors.length}`);

      // Check for null dates
      const nullDates = reports.filter(r => !r.session_date);
      console.log(`⚠️  Reports with NULL session_date: ${nullDates.length}`);

      // Check for null session_id
      const nullSessions = reports.filter(r => !r.session_id);
      console.log(`⚠️  Reports with NULL session_id: ${nullSessions.length}`);

      // Check overall null percentage
      const allFields = reports.reduce((acc, report) => {
        const fields = Object.keys(report);
        fields.forEach(field => {
          if (!acc[field]) acc[field] = { total: 0, nulls: 0 };
          acc[field].total++;
          if (report[field] === null) acc[field].nulls++;
        });
        return acc;
      }, {});

      console.log('\n📋 Fields with HIGH NULL rate (>50%):');
      Object.entries(allFields)
        .filter(([_, stats]) => stats.nulls / stats.total > 0.5)
        .sort((a, b) => (b[1].nulls / b[1].total) - (a[1].nulls / a[1].total))
        .slice(0, 10)
        .forEach(([field, stats]) => {
          const pct = Math.round((stats.nulls / stats.total) * 100);
          console.log(`   ${field}: ${pct}% NULL (${stats.nulls}/${stats.total})`);
        });
    }

    // ============================================
    // 5. EXPORT SUMMARY
    // ============================================
    const summary = {
      exportedAt: new Date().toISOString(),
      tables: {
        reports: { count: reports?.length || 0, file: `reports_${timestamp}.json` },
        sessions: { count: sessions?.length || 0, file: `sessions_${timestamp}.json` },
        entrepreneurs: { count: entrepreneurs?.length || 0, file: `entrepreneurs_${timestamp}.json` }
      },
      analysis: {
        nullMentors: reports?.filter(r => !r.mentor_email).length || 0,
        nullDates: reports?.filter(r => !r.session_date).length || 0,
        nullSessions: reports?.filter(r => !r.session_id).length || 0
      }
    };

    fs.writeFileSync(
      path.join(exportDir, `SUMMARY_${timestamp}.json`),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n' + '═'.repeat(70));
    console.log('\n✅ Export complete!');
    console.log(`\n📁 All files saved to: ${exportDir}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Open the JSON files to inspect the data');
    console.log('   2. Look for test data, incomplete records, or NULL fields');
    console.log('   3. We can then clean up and do proper migration from Google Sheets');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

exportAllData();
