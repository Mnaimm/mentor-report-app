/**
 * RUN SYNC SCRIPTS
 * Simple wrapper to run sync scripts
 */

require('dotenv').config({ path: '../.env.local' });

async function runSync() {
  console.log('Starting sync process...\n');

  // Since the sync scripts use ES modules, we'll run them via child process
  const { spawn } = require('child_process');
  const path = require('path');

  function runScript(scriptName) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '..', 'sync-scripts', scriptName);

      console.log(`\n${'='.repeat(70)}`);
      console.log(`Running: ${scriptName}`);
      console.log('='.repeat(70));

      const child = spawn('node', [scriptPath], {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          DRY_RUN: 'false'  // Set to false for actual sync
        },
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Script exited with code ${code}`));
        } else {
          resolve();
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  try {
    // Run Bangkit sync
    await runScript('04-sync-bangkit-reports.js');

    // Run Maju sync
    await runScript('05-sync-maju-reports.js');

    console.log('\n' + '='.repeat(70));
    console.log('✅ All syncs complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

runSync();
