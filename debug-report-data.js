/**
 * Debug script to inspect raw report data from Supabase
 * Usage: node debug-report-data.js [report_id]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugReport(reportId) {
    if (!reportId) {
        console.error('❌ Usage: node debug-report-data.js [report_id]');
        process.exit(1);
    }

    console.log(`🔍 Fetching report ID: ${reportId}\n`);

    try {
        const { data: report, error } = await supabase
            .from('reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (error) throw error;
        if (!report) {
            console.error(`❌ Report not found with ID: ${reportId}`);
            process.exit(1);
        }

        console.log('📊 REPORT OVERVIEW');
        console.log('='.repeat(80));
        console.log(`Program: ${report.program}`);
        console.log(`Session: ${report.session_number}`);
        console.log(`Mentor: ${report.nama_mentor || report.mentor_email}`);
        console.log(`Mentee: ${report.nama_usahawan}`);
        console.log(`Status: ${report.status}`);
        console.log(`Submission Date: ${report.submission_date}`);
        console.log('='.repeat(80));

        console.log('\n🔍 COMPLIANCE CHECK FIELDS');
        console.log('='.repeat(80));

        // Check 1: Session Photos
        console.log('\n1️⃣ SESSION PHOTO EVIDENCE');
        console.log(`   Field: image_urls.sesi`);
        console.log(`   Type: ${typeof report.image_urls}`);
        console.log(`   Value:`, JSON.stringify(report.image_urls, null, 2));

        if (report.image_urls?.sesi) {
            console.log(`   ✅ image_urls.sesi exists`);
            console.log(`   Type: ${typeof report.image_urls.sesi}`);
            console.log(`   Is Array: ${Array.isArray(report.image_urls.sesi)}`);
            console.log(`   Length: ${report.image_urls.sesi.length || 0}`);
            console.log(`   Content:`, JSON.stringify(report.image_urls.sesi, null, 2));
        } else {
            console.log(`   ❌ image_urls.sesi is ${report.image_urls?.sesi}`);
        }

        // Check 2: Key Decision Points (Inisiatif OR Mentoring Findings)
        console.log('\n2️⃣ KEY DECISION POINTS');

        console.log('\n   📌 Checking: inisiatif');
        console.log(`   Type: ${typeof report.inisiatif}`);
        if (report.inisiatif !== null && report.inisiatif !== undefined) {
            console.log(`   Is Array: ${Array.isArray(report.inisiatif)}`);
            console.log(`   Length: ${Array.isArray(report.inisiatif) ? report.inisiatif.length : 'N/A'}`);
            console.log(`   Value:`, JSON.stringify(report.inisiatif, null, 2));
        } else {
            console.log(`   ❌ inisiatif is ${report.inisiatif}`);
        }

        console.log('\n   📌 Checking: mentoring_findings');
        console.log(`   Type: ${typeof report.mentoring_findings}`);
        if (report.mentoring_findings !== null && report.mentoring_findings !== undefined) {
            console.log(`   Is Array: ${Array.isArray(report.mentoring_findings)}`);
            console.log(`   Length: ${Array.isArray(report.mentoring_findings) ? report.mentoring_findings.length : 'N/A'}`);
            console.log(`   Value:`, JSON.stringify(report.mentoring_findings, null, 2));
        } else {
            console.log(`   ❌ mentoring_findings is ${report.mentoring_findings}`);
        }

        // Calculate compliance
        const inisiatifCount = Array.isArray(report.inisiatif) ? report.inisiatif.length : 0;
        const findingsCount = Array.isArray(report.mentoring_findings) ? report.mentoring_findings.length : 0;
        const totalCount = inisiatifCount + findingsCount;
        const passed = totalCount > 0;

        console.log(`\n   📊 Summary:`);
        console.log(`   - inisiatif count: ${inisiatifCount}`);
        console.log(`   - mentoring_findings count: ${findingsCount}`);
        console.log(`   - Total count: ${totalCount}`);
        console.log(`   - Compliance passed: ${passed ? '✅ YES' : '❌ NO'}`);

        // Check 3: GrowthWheel (Bangkit Session 1 only)
        if (report.program === 'Bangkit' && report.session_number == 1) {
            console.log('\n3️⃣ GROWTHWHEEL CHART (Bangkit Session 1)');
            console.log(`   Field: image_urls.gw360`);
            if (report.image_urls?.gw360) {
                console.log(`   ✅ GrowthWheel chart attached`);
                console.log(`   URL:`, report.image_urls.gw360);
            } else {
                console.log(`   ❌ Missing GrowthWheel chart`);
            }
        }

        // Check 4: Premises Visit
        console.log('\n4️⃣ PREMISES VISIT EVIDENCE');
        console.log(`   Claimed visit: ${report.premis_dilawat ? 'YES' : 'NO'}`);
        if (report.premis_dilawat) {
            console.log(`   Field: image_urls.premis`);
            if (report.image_urls?.premis) {
                console.log(`   Type: ${typeof report.image_urls.premis}`);
                console.log(`   Is Array: ${Array.isArray(report.image_urls.premis)}`);
                console.log(`   Length: ${Array.isArray(report.image_urls.premis) ? report.image_urls.premis.length : 'N/A'}`);
                console.log(`   Content:`, JSON.stringify(report.image_urls.premis, null, 2));
            } else {
                console.log(`   ❌ No premises photos attached`);
            }
        }

        // Check 5: MIA Status
        console.log('\n5️⃣ MIA STATUS');
        console.log(`   Status: ${report.status}`);
        if (report.status === 'MIA') {
            console.log(`   ⚠️ Mentee marked as MIA`);
            console.log(`   MIA Reason: ${report.mia_reason || 'Not provided'}`);
            console.log(`   MIA Proof URL: ${report.mia_proof_url || 'Not provided'}`);
        } else {
            console.log(`   ✅ Normal status`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Debug complete\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Get report ID from command line argument
const reportId = process.argv[2];
debugReport(reportId);
