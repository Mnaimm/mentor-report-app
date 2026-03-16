const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeDuplicates() {
  console.log('🔍 Analyzing Supabase reports table for duplicates...\n');

  try {
    // Fetch all records from Supabase
    const { data: allRecords, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching records:', error);
      return;
    }

    console.log(`✅ Fetched ${allRecords.length} total records from Supabase\n`);

    // Export all records to JSON
    const exportData = allRecords.map(r => ({
      id: r.id,
      reportId: r.report_id || 'N/A',
      mentorName: r.mentor_name || r.nama_mentor,
      mentorEmail: r.mentor_email || r.email_mentor,
      entrepreneurName: r.mentee_name || r.nama_usahawan,
      entrepreneurIC: r.mentee_ic || r.no_kp_usahawan,
      sessionNumber: r.sesi_laporan,
      sessionDate: r.tarikh_sesi,
      program: r.program_type,
      batch: r.batch,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      docUrl: r.doc_url
    }));

    require('fs').writeFileSync(
      'supabase-all-records.json',
      JSON.stringify(exportData, null, 2)
    );
    console.log('📄 Exported all records to: supabase-all-records.json\n');

    // Find duplicates by grouping
    const duplicateGroups = {};

    allRecords.forEach(record => {
      // Create a composite key for grouping
      const mentorName = (record.mentor_name || record.nama_mentor || '').trim().toLowerCase();
      const entrepreneurName = (record.mentee_name || record.nama_usahawan || '').trim().toLowerCase();
      const session = record.sesi_laporan;
      const date = record.tarikh_sesi;

      const key = `${mentorName}|${entrepreneurName}|${session}|${date}`;

      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }

      duplicateGroups[key].push({
        id: record.id,
        reportId: record.report_id,
        mentorName: record.mentor_name || record.nama_mentor,
        mentorEmail: record.mentor_email || record.email_mentor,
        entrepreneurName: record.mentee_name || record.nama_usahawan,
        sessionNumber: record.sesi_laporan,
        sessionDate: record.tarikh_sesi,
        program: record.program_type,
        status: record.status,
        createdAt: record.created_at,
        docUrl: record.doc_url
      });
    });

    // Filter to only groups with 2+ records (duplicates)
    const duplicates = Object.entries(duplicateGroups)
      .filter(([key, records]) => records.length > 1)
      .map(([key, records]) => ({
        groupKey: key,
        count: records.length,
        records: records
      }));

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 DUPLICATE ANALYSIS RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total records in Supabase: ${allRecords.length}`);
    console.log(`Unique groups: ${Object.keys(duplicateGroups).length}`);
    console.log(`Duplicate groups found: ${duplicates.length}\n`);

    if (duplicates.length > 0) {
      console.log('🚨 DUPLICATE GROUPS:\n');

      duplicates.forEach((group, index) => {
        console.log(`\n─── Duplicate Group #${index + 1} ───────────────────────────`);
        console.log(`Key: ${group.groupKey}`);
        console.log(`Count: ${group.count} records`);
        console.log('\nRecords:');

        group.records.forEach((record, i) => {
          console.log(`\n  [${i + 1}] ID: ${record.id}`);
          console.log(`      Mentor: ${record.mentorName} (${record.mentorEmail})`);
          console.log(`      Entrepreneur: ${record.entrepreneurName}`);
          console.log(`      Session: ${record.sessionNumber} on ${record.sessionDate}`);
          console.log(`      Program: ${record.program}`);
          console.log(`      Status: ${record.status}`);
          console.log(`      Created: ${record.createdAt}`);
          console.log(`      PDF: ${record.docUrl || 'N/A'}`);
        });
      });

      // Export duplicates to JSON
      require('fs').writeFileSync(
        'supabase-duplicates.json',
        JSON.stringify(duplicates, null, 2)
      );
      console.log('\n\n📄 Exported duplicates to: supabase-duplicates.json');
    } else {
      console.log('✅ No duplicates found based on the grouping criteria');
    }

    // Summary by program
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 BREAKDOWN BY PROGRAM');
    console.log('═══════════════════════════════════════════════════════════\n');

    const programCounts = allRecords.reduce((acc, r) => {
      const program = r.program_type || 'unknown';
      acc[program] = (acc[program] || 0) + 1;
      return acc;
    }, {});

    Object.entries(programCounts).forEach(([program, count]) => {
      console.log(`${program}: ${count} records`);
    });

    // Summary by status
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 BREAKDOWN BY STATUS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const statusCounts = allRecords.reduce((acc, r) => {
      const status = r.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count} records`);
    });

    console.log('\n\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

analyzeDuplicates();
