/**
 * Count Maju Session 2 records in Google Sheets vs Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function countMajuSession2() {
    console.log('📊 Counting Maju Session 2 Records');
    console.log('='.repeat(80));
    console.log('');

    // ========================================
    // COUNT 1: Google Sheets - Actual Records
    // ========================================
    console.log('1️⃣  Google Sheets - Maju Session 2 (with mentor_email filled)');
    console.log('-'.repeat(80));

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LaporanMaju!A2:BM100', // Extended range to catch all data
    });

    const rows = response.data.values || [];
    console.log(`   Total rows fetched: ${rows.length}`);

    // Filter for Session 2 with mentor email filled
    const session2WithMentor = rows.filter(row => {
        const mentorEmail = row[2]; // Column C = EMAIL_MENTOR
        const sessionNum = row[9]; // Column J = SESI_NUMBER

        return mentorEmail && mentorEmail.trim() !== '' && sessionNum == 2;
    });

    console.log(`   ✅ Session 2 records with mentor_email: ${session2WithMentor.length}\n`);

    // Show the records
    if (session2WithMentor.length > 0) {
        console.log('   Records:');
        session2WithMentor.forEach((row, idx) => {
            console.log(`   ${idx + 1}. ${row[3]} (Mentor: ${row[2]})`);
        });
        console.log('');
    }

    // ========================================
    // COUNT 2: Supabase - Total Session 2
    // ========================================
    console.log('2️⃣  Supabase - Total Maju Session 2 records');
    console.log('-'.repeat(80));

    const { data: allSession2, error: allError } = await supabase
        .from('reports')
        .select('id, nama_usahawan, mentor_email, source, image_urls, mentoring_findings')
        .eq('program', 'Maju')
        .eq('session_number', 2);

    if (allError) throw allError;

    console.log(`   ✅ Total records: ${allSession2.length}\n`);

    // ========================================
    // COUNT 3: Supabase - Excluding Phantoms
    // ========================================
    console.log('3️⃣  Supabase - Maju Session 2 EXCLUDING phantom records');
    console.log('-'.repeat(80));

    const { data: phantomRecords, error: phantomError } = await supabase
        .from('reports')
        .select('id, nama_usahawan, mentor_email, entrepreneur_id')
        .eq('program', 'Maju')
        .eq('session_number', 2)
        .eq('source', 'manual_sync_missing_records');

    if (phantomError) throw phantomError;

    console.log(`   Phantom records (source='manual_sync_missing_records'): ${phantomRecords.length}`);

    if (phantomRecords.length > 0) {
        console.log('   Phantom IDs:');
        phantomRecords.forEach((r, idx) => {
            console.log(`   ${idx + 1}. ${r.id} - ${r.nama_usahawan || 'NULL'} (${r.mentor_email})`);
        });
        console.log('');
    }

    const nonPhantomCount = allSession2.length - phantomRecords.length;
    console.log(`   ✅ Non-phantom records: ${nonPhantomCount}\n`);

    // Show non-phantom records
    const nonPhantomRecords = allSession2.filter(r => r.source !== 'manual_sync_missing_records');
    if (nonPhantomRecords.length > 0) {
        console.log('   Non-phantom records:');
        nonPhantomRecords.forEach((r, idx) => {
            const hasImages = r.image_urls?.sesi?.length > 0;
            const hasFindings = r.mentoring_findings?.length > 0;
            const complete = hasImages && hasFindings;
            console.log(`   ${idx + 1}. ${complete ? '✅' : '⚠️ '} ${r.nama_usahawan} (${r.mentor_email}) [${r.source}]`);
        });
        console.log('');
    }

    // ========================================
    // COMPARISON ANALYSIS
    // ========================================
    console.log('='.repeat(80));
    console.log('📊 COMPARISON ANALYSIS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Google Sheets (Session 2 with mentor_email):    ${session2WithMentor.length}`);
    console.log(`Supabase Total (Session 2):                     ${allSession2.length}`);
    console.log(`Supabase Non-Phantom (Session 2):               ${nonPhantomCount}`);
    console.log('');

    // Determine verdict
    if (session2WithMentor.length === nonPhantomCount) {
        console.log('✅ VERDICT: Sheets count = Supabase non-phantom count');
        console.log('   → The 5 phantom records are EXTRA and safe to DELETE');
        console.log('');
    } else if (session2WithMentor.length === allSession2.length) {
        console.log('⚠️  VERDICT: Sheets count = Supabase total (WITH phantoms)');
        console.log('   → Either:');
        console.log('      a) Sheets has 5 empty/incomplete rows being counted');
        console.log('      b) Phantoms are actually legitimate but missing data');
        console.log('');
    } else {
        console.log('⚠️  VERDICT: Counts don\'t match - needs investigation');
        console.log(`   Difference: Sheets=${session2WithMentor.length}, Supabase Total=${allSession2.length}, Non-Phantom=${nonPhantomCount}`);
        console.log('');
    }

    console.log('='.repeat(80));
    console.log('');

    // Additional check: Are there any Session 2 records in Sheets NOT in Supabase?
    console.log('🔍 ADDITIONAL CHECK: Records in Sheets but NOT in Supabase?');
    console.log('-'.repeat(80));

    for (const sheetRow of session2WithMentor) {
        const menteeName = sheetRow[3];
        const mentorEmail = sheetRow[2];

        const foundInSupabase = allSession2.find(r =>
            r.mentor_email?.toLowerCase() === mentorEmail?.toLowerCase() &&
            (r.nama_usahawan?.toLowerCase() === menteeName?.toLowerCase() ||
             r.nama_mentee?.toLowerCase() === menteeName?.toLowerCase())
        );

        if (!foundInSupabase) {
            console.log(`❌ MISSING IN SUPABASE: ${menteeName} (Mentor: ${mentorEmail})`);
        }
    }

    console.log('✅ Check complete\n');
    console.log('='.repeat(80));
}

countMajuSession2().catch(console.error);
