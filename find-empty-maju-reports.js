/**
 * Find Maju reports with empty image_urls or mentoring_findings
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findEmptyReports() {
    console.log('🔍 Finding Maju reports with empty compliance fields...\n');

    try {
        // Fetch all Maju Session 2 reports
        const { data: reports, error } = await supabase
            .from('reports')
            .select('id, nama_usahawan, session_number, image_urls, mentoring_findings, inisiatif, source, created_at')
            .eq('program', 'Maju')
            .eq('session_number', 2)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`📊 Found ${reports.length} Maju Session 2 reports\n`);

        let emptyCount = 0;

        reports.forEach((report, idx) => {
            const hasSesiImages = report.image_urls?.sesi?.length > 0;
            const hasMentoringFindings = Array.isArray(report.mentoring_findings) && report.mentoring_findings.length > 0;
            const hasInisiatif = Array.isArray(report.inisiatif) && report.inisiatif.length > 0;

            const isEmpty = !hasSesiImages || (!hasMentoringFindings && !hasInisiatif);

            if (isEmpty) {
                emptyCount++;
                console.log(`\n[${idx + 1}] ❌ EMPTY DATA FOUND`);
                console.log(`    ID: ${report.id}`);
                console.log(`    Mentee: ${report.nama_usahawan}`);
                console.log(`    Session: ${report.session_number}`);
                console.log(`    Source: ${report.source}`);
                console.log(`    Created: ${new Date(report.created_at).toLocaleDateString()}`);
                console.log(`    Session Images: ${hasSesiImages ? '✅ Has images' : '❌ Empty'}`);
                console.log(`    Mentoring Findings: ${hasMentoringFindings ? `✅ ${report.mentoring_findings.length} items` : '❌ Empty'}`);
                console.log(`    Inisiatif: ${hasInisiatif ? `✅ ${report.inisiatif.length} items` : '❌ Empty'}`);
                console.log(`    image_urls: ${JSON.stringify(report.image_urls)}`);
            }
        });

        console.log('\n' + '='.repeat(80));
        console.log(`📊 Summary: ${emptyCount} out of ${reports.length} reports have empty compliance fields`);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

findEmptyReports();
