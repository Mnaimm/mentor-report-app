// Set DRY_RUN to false to apply changes *before* imports
process.env.DRY_RUN = 'false';

async function run() {
    console.log('Starting sync fix...');
    try {
        // Dynamic imports to ensure env var is respected
        const { default: syncBatches } = await import('./sync-scripts/01-sync-batches.js');
        const { default: syncMentors } = await import('./sync-scripts/01b-sync-mentors.js');
        const { default: syncMapping } = await import('./sync-scripts/02-sync-mapping.js');
        const { default: syncBatch7 } = await import('./sync-scripts/03-sync-batch-7.js');
        const { default: syncBangkit } = await import('./sync-scripts/04-sync-bangkit-reports.js');
        const { default: syncMaju } = await import('./sync-scripts/05-sync-maju-reports.js');

        console.log('--- Running 01 (Batches) ---');
        await syncBatches();
        console.log('\n--- Running 01b (Mentors) ---');
        await syncMentors();
        console.log('\n--- Running 02 (Mapping) ---');
        await syncMapping();
        console.log('\n--- Running 03 (Batch 7) ---');
        await syncBatch7();
        console.log('\n--- Running 04 (Bangkit) ---');
        await syncBangkit();
        console.log('\n--- Running 05 (Maju) ---');
        await syncMaju();
        console.log('\nDone.');
    } catch (err) {
        console.error('Error running syncs:', err);
    }
}

run();
