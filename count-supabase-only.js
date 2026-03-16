/**
 * Count Supabase Maju Session 2 records only
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false
        },
        global: {
            fetch: (...args) => {
                return fetch(...args, {
                    timeout: 30000
                });
            }
        }
    }
);

async function countSupabase() {
    console.log('📊 Counting Supabase Maju Session 2 Records\n');

    try {
        // Count all Session 2
        const { data: allSession2, error: allError } = await supabase
            .from('reports')
            .select('id, nama_usahawan, nama_mentee, mentor_email, source, image_urls, mentoring_findings')
            .eq('program', 'Maju')
            .eq('session_number', 2);

        if (allError) throw allError;

        console.log(`2️⃣  Supabase - Total Maju Session 2 records: ${allSession2.length}\n`);

        // Show all records
        allSession2.forEach((r, idx) => {
            const hasImages = r.image_urls?.sesi?.length > 0;
            const hasFindings = r.mentoring_findings?.length > 0;
            const complete = hasImages && hasFindings;
            const name = r.nama_usahawan || r.nama_mentee || 'NULL';
            console.log(`${idx + 1}. ${complete ? '✅' : '❌'} ${name} (${r.mentor_email}) [${r.source}]`);
        });

        console.log('');

        // Count phantoms
        const phantoms = allSession2.filter(r => r.source === 'manual_sync_missing_records');
        console.log(`3️⃣  Phantom records (source='manual_sync_missing_records'): ${phantoms.length}\n`);

        if (phantoms.length > 0) {
            phantoms.forEach((r, idx) => {
                const name = r.nama_usahawan || r.nama_mentee || 'NULL';
                console.log(`   ${idx + 1}. ${r.id} - ${name} (${r.mentor_email})`);
            });
            console.log('');
        }

        const nonPhantomCount = allSession2.length - phantoms.length;
        console.log(`   Non-phantom records: ${nonPhantomCount}\n`);

        console.log('='.repeat(80));
        console.log('SUMMARY:');
        console.log(`   Google Sheets Session 2: 2 records (from previous count)`);
        console.log(`   Supabase Total:          ${allSession2.length}`);
        console.log(`   Supabase Non-Phantom:    ${nonPhantomCount}`);
        console.log('='.repeat(80));

        if (nonPhantomCount === 2) {
            console.log('\n✅ VERDICT: Non-phantom count (${nonPhantomCount}) matches Sheets count (2)');
            console.log('   → The ${phantoms.length} phantom records are EXTRA and safe to DELETE\n');
        } else {
            console.log('\n⚠️  VERDICT: Counts don\'t match - needs investigation\n');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    }
}

countSupabase().catch(console.error);
