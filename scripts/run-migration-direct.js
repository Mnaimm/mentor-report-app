/**
 * Run migration using Supabase Management API
 * This uses the pg-meta API endpoint for direct SQL execution
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 Starting migration: add_verification_payment_revision_columns\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260226000000_add_verification_payment_revision_columns.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log('━'.repeat(80));
  console.log(sql);
  console.log('━'.repeat(80));
  console.log('\n');

  // Parse project ref from URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
  console.log(`📌 Project: ${projectRef}`);

  // Try Management API
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  console.log('\n🔄 Attempting to execute via Management API...');
  console.log(`   Endpoint: ${mgmtUrl}`);

  try {
    const response = await fetch(mgmtUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        query: sql
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ Management API failed');
      console.error(`   Status: ${response.status}`);
      console.error(`   Response: ${responseText}`);
      throw new Error('Management API not accessible');
    }

    console.log('✅ Migration executed successfully!');
    console.log(`   Response: ${responseText}`);

    return true;

  } catch (error) {
    console.error('❌ Management API error:', error.message);
    return false;
  }
}

async function showManualSteps() {
  console.log('\n' + '='.repeat(80));
  console.log('📝 MANUAL MIGRATION STEPS REQUIRED');
  console.log('='.repeat(80));
  console.log('\n1. Open Supabase Dashboard SQL Editor:');
  console.log('   https://app.supabase.com/project/oogrwqxlwyoswyfqgxxi/sql/new');
  console.log('\n2. Copy the SQL from this file:');
  console.log('   supabase/migrations/20260226000000_add_verification_payment_revision_columns.sql');
  console.log('\n3. Paste into SQL Editor and click "Run"');
  console.log('\n4. After running, verify columns exist using:');
  console.log('\n   SELECT column_name FROM information_schema.columns');
  console.log('   WHERE table_name = \'reports\'');
  console.log('   AND column_name IN (\'verification_nota\', \'revision_count\', \'revision_reason\');');
  console.log('\n   SELECT column_name FROM information_schema.columns');
  console.log('   WHERE table_name = \'payment_batches\'');
  console.log('   AND column_name IN (\'approved_by\', \'approved_at\');');
  console.log('\n   SELECT table_name FROM information_schema.tables');
  console.log('   WHERE table_name = \'report_revisions\';');
  console.log('\n' + '='.repeat(80));
}

// Run migration
runMigration()
  .then(success => {
    if (!success) {
      showManualSteps();
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    showManualSteps();
    process.exit(1);
  });
