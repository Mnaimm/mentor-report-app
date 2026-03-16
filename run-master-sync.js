// Wrapper to run master sync with proper output
import dotenv from 'dotenv';

// Set to 'false' for LIVE mode, 'true' for DRY_RUN - MUST BE SET BEFORE IMPORTING SCRIPTS
process.env.DRY_RUN = 'false';  // ⚠️ CHANGE THIS TO 'true' FOR DRY RUN

dotenv.config();

console.log('🚀 Starting master sync wrapper...\n');
console.log(`📋 DRY_RUN mode: ${process.env.DRY_RUN}\n`);
console.log(`⚠️  ${process.env.DRY_RUN === 'false' ? '🔴 LIVE MODE - DATA WILL BE WRITTEN!' : '🟢 DRY RUN - NO CHANGES'}\n`);

// Import and run (after setting env var)
const { default: masterSync } = await import('./sync-scripts/07-master-sync.js');
await masterSync();

console.log('\n✅ Master sync wrapper complete!');
