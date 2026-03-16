// Quick wrapper to run sync-mapping script

// Set environment variable BEFORE importing (module loads on import)
process.env.DRY_RUN = 'false';

import syncMapping from './sync-scripts/02-sync-mapping.js';

console.log('🚀 Starting mapping sync (LIVE MODE)...\n');

syncMapping()
  .then((results) => {
    console.log('\n✅ Sync complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
