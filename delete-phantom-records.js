/**
 * Delete 5 phantom Maju Session 2 records
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function deletePhantomRecords() {
    console.log('🗑️  Delete Phantom Maju Session 2 Records');
    console.log('='.repeat(80));
    console.log(`DRY_RUN: ${DRY_RUN} (set DRY_RUN=false to actually delete)\n`);

    // Step 1: Find phantom records
    console.log('📊 Step 1: Finding phantom records...\n');

    const { data: phantoms, error: fetchError } = await supabase
        .from('reports')
        .select('id, nama_usahawan, nama_mentee, mentor_email, entrepreneur_id, image_urls')
        .eq('source', 'manual_sync_missing_records')
        .eq('program', 'Maju')
        .eq('session_number', 2);

    if (fetchError) throw fetchError;

    console.log(`Found ${phantoms.length} records with source='manual_sync_missing_records'\n`);

    // Verify they have empty image_urls
    const emptyImagePhantoms = phantoms.filter(r => {
        const imageUrlsString = JSON.stringify(r.image_urls);
        return imageUrlsString === '{}' || imageUrlsString === 'null' || !r.image_urls;
    });

    console.log(`Of those, ${emptyImagePhantoms.length} have empty image_urls = {}\n`);

    if (emptyImagePhantoms.length === 0) {
        console.log('✅ No phantom records to delete\n');
        return;
    }

    console.log('Records to delete:\n');
    emptyImagePhantoms.forEach((r, idx) => {
        const name = r.nama_usahawan || r.nama_mentee || 'NULL';
        console.log(`${idx + 1}. ${r.id}`);
        console.log(`   Name: ${name}`);
        console.log(`   Mentor: ${r.mentor_email}`);
        console.log(`   image_urls: ${JSON.stringify(r.image_urls)}`);
        console.log('');
    });

    // Step 2: Delete
    if (!DRY_RUN) {
        console.log('🗑️  Step 2: Deleting records...\n');

        const { error: deleteError, count } = await supabase
            .from('reports')
            .delete({ count: 'exact' })
            .eq('source', 'manual_sync_missing_records')
            .eq('program', 'Maju')
            .eq('session_number', 2)
            .eq('image_urls', '{}');

        if (deleteError) throw deleteError;

        console.log(`✅ Successfully deleted ${count} records\n`);
    } else {
        console.log('🔍 [DRY RUN] Would delete these records\n');
    }

    // Step 3: Verify deletion
    if (!DRY_RUN) {
        console.log('🔍 Step 3: Verifying deletion...\n');

        const { data: remaining, error: verifyError } = await supabase
            .from('reports')
            .select('id')
            .eq('source', 'manual_sync_missing_records')
            .eq('program', 'Maju')
            .eq('session_number', 2);

        if (verifyError) throw verifyError;

        if (remaining.length === 0) {
            console.log('✅ Verification passed: No phantom records remain\n');
        } else {
            console.log(`⚠️  WARNING: ${remaining.length} records still exist with source='manual_sync_missing_records'\n`);
        }
    }

    console.log('='.repeat(80));
}

deletePhantomRecords().catch(console.error);
