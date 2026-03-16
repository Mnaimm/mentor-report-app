// 07-master-sync.js
// Master orchestrator - runs all sync scripts in correct order

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from the project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Import all sync scripts
import syncBatches from './01-sync-batches.js';
import syncMentors from './01b-sync-mentors.js';
import syncMapping from './02-sync-mapping.js';
import syncBatch7 from './03-sync-batch-7.js';
import syncBangkitReports from './04-sync-bangkit-reports.js';
import syncMajuReports from './05-sync-maju-reports.js';
import syncUMStandalone from './06-sync-um-standalone.js';

const DRY_RUN = process.env.DRY_RUN !== 'false';

const masterResults = {
  scripts: [],
  totalSuccess: 0,
  totalSkipped: 0,
  totalFailed: 0,
  startTime: null,
  endTime: null,
  duration: null
};

// Helper: Run a script and track results
async function runScript(scriptName, scriptFunction) {
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 Running: ${scriptName}`);
  console.log('='.repeat(80));

  const startTime = Date.now();
  let status = 'success';
  let results = null;
  let error = null;

  try {
    results = await scriptFunction();
  } catch (err) {
    status = 'failed';
    error = err.message;
    console.error(`\n❌ ${scriptName} failed:`, err.message);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Aggregate results
  const scriptResult = {
    script: scriptName,
    status: status,
    duration: `${duration}s`,
    results: results,
    error: error
  };

  masterResults.scripts.push(scriptResult);

  // Update totals
  if (results) {
    Object.values(results).forEach(stat => {
      if (typeof stat === 'object' && stat.success !== undefined) {
        masterResults.totalSuccess += stat.success || 0;
        masterResults.totalSkipped += stat.skipped || 0;
        masterResults.totalFailed += stat.failed || 0;
      }
    });
  }

  console.log(`\n⏱️  ${scriptName} completed in ${duration}s\n`);

  return { status, results };
}

// Main orchestrator
async function masterSync() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      MASTER SYNC - DATA MIGRATION                      ║');
  console.log('║           Google Sheets → Supabase Database (8 Scripts)              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n🔧 MODE: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE MODE (changes will be written)'}`);
  console.log('📅 Start Time:', new Date().toLocaleString());
  console.log('\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE ENABLED');
    console.log('   - No data will be written to Supabase');
    console.log('   - Set DRY_RUN=false to execute for real\n');
  }

  masterResults.startTime = new Date().toISOString();

  try {
    // ===================================================
    // PHASE 1: FOUNDATION
    // ===================================================
    console.log('\n📦 PHASE 1: FOUNDATION DATA');
    console.log('   Building batches, mentors, entrepreneurs, assignments\n');

    await runScript('01-sync-batches.js', syncBatches);
    await runScript('01b-sync-mentors.js', syncMentors);
    await runScript('02-sync-mapping.js', syncMapping);
    await runScript('03-sync-batch-7.js', syncBatch7);

    // ===================================================
    // PHASE 2: SESSION REPORTS
    // ===================================================
    console.log('\n📊 PHASE 2: SESSION REPORTS');
    console.log('   Creating sessions, reports, embedded UM reports\n');

    await runScript('04-sync-bangkit-reports.js', syncBangkitReports);
    await runScript('05-sync-maju-reports.js', syncMajuReports);

    // ===================================================
    // PHASE 3: STANDALONE UM REPORTS
    // ===================================================
    console.log('\n📈 PHASE 3: STANDALONE UM REPORTS');
    console.log('   Creating additional UM reports\n');

    await runScript('06-sync-um-standalone.js', syncUMStandalone);

    // ===================================================
    // COMPLETION
    // ===================================================
    masterResults.endTime = new Date().toISOString();
    const totalDuration = masterResults.scripts.reduce((sum, script) => {
      return sum + parseFloat(script.duration);
    }, 0);
    masterResults.duration = `${totalDuration.toFixed(2)}s`;

    // Generate final report
    generateFinalReport();

    // Save results to file
    const resultsPath = path.join(process.cwd(), 'master-sync-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(masterResults, null, 2));
    console.log(`\n📄 Full results saved to: ${resultsPath}`);

  } catch (error) {
    console.error('\n❌ FATAL ERROR in master sync:', error);
    masterResults.endTime = new Date().toISOString();
    masterResults.fatalError = error.message;

    // Save error state
    const errorPath = path.join(process.cwd(), 'master-sync-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(masterResults, null, 2));
    console.log(`\n📄 Error state saved to: ${errorPath}`);

    process.exit(1);
  }
}

// Generate final report
function generateFinalReport() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          FINAL SYNC REPORT                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log('\n📊 OVERALL STATISTICS:\n');
  console.log(`   ✅ Total Success: ${masterResults.totalSuccess}`);
  console.log(`   ⏭️  Total Skipped: ${masterResults.totalSkipped}`);
  console.log(`   ❌ Total Failed:  ${masterResults.totalFailed}`);
  console.log(`   ⏱️  Total Duration: ${masterResults.duration}\n`);

  console.log('📋 SCRIPT STATUS:\n');
  masterResults.scripts.forEach(script => {
    const icon = script.status === 'success' ? '✅' : '❌';
    console.log(`   ${icon} ${script.script.padEnd(35)} ${script.duration.padStart(8)} ${script.status}`);
  });

  console.log('\n📈 DETAILED BREAKDOWN:\n');
  masterResults.scripts.forEach(script => {
    if (script.results) {
      console.log(`   ${script.script}:`);
      Object.entries(script.results).forEach(([key, value]) => {
        if (typeof value === 'object' && value.success !== undefined) {
          console.log(`      ${key}: ✅ ${value.success}  ⏭️  ${value.skipped}  ❌ ${value.failed}`);
        }
      });
    }
  });

  const allSuccess = masterResults.scripts.every(s => s.status === 'success');
  const noFailures = masterResults.totalFailed === 0;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  if (allSuccess && noFailures) {
    console.log('║                    🎉 MIGRATION COMPLETED SUCCESSFULLY! 🎉              ║');
  } else if (allSuccess && masterResults.totalFailed > 0) {
    console.log('║          ⚠️  MIGRATION COMPLETED WITH SOME ERRORS (see logs) ⚠️          ║');
  } else {
    console.log('║              ❌ MIGRATION COMPLETED WITH SCRIPT FAILURES ❌             ║');
  }
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  if (DRY_RUN) {
    console.log('💡 This was a DRY RUN - no data was actually written.');
    console.log('   To execute for real: export DRY_RUN=false && node 07-master-sync.js\n');
  } else {
    console.log('✅ Live migration complete - data has been written to Supabase.\n');
  }

  console.log('📅 End Time:', new Date().toLocaleString());
  console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  masterSync()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export default masterSync;
