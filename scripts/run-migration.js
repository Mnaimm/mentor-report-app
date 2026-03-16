/**
 * Run Supabase migration directly using service role key
 * Migration: add_verification_payment_revision_columns
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Use Supabase REST API directly
async function runMigration() {
  console.log('🚀 Starting migration: add_verification_payment_revision_columns');

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

  console.log('📄 Migration file loaded');
  console.log(`   File: ${migrationPath}`);
  console.log(`   Size: ${sql.length} bytes`);

  // Execute SQL using Supabase REST API
  const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Migration failed');
      console.error('   Status:', response.status);
      console.error('   Error:', error);

      // Try alternative approach using pg-admin
      console.log('\n⚠️  REST API approach failed. Trying direct SQL execution...');
      await runMigrationDirect(sql);
      return;
    }

    console.log('✅ Migration executed successfully via REST API');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.log('\n⚠️  Trying alternative approach...');
    await runMigrationDirect(sql);
  }
}

async function runMigrationDirect(sql) {
  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`   [${i + 1}/${statements.length}] Executing...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Some errors are acceptable (e.g., column already exists)
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Already exists (skipping)`);
        } else {
          throw error;
        }
      } else {
        console.log(`   ✅ Success`);
      }
    }

    console.log('\n✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📝 Manual steps required:');
    console.error('   1. Go to Supabase Dashboard: https://app.supabase.com/project/oogrwqxlwyoswyfqgxxi/editor');
    console.error('   2. Go to SQL Editor');
    console.error('   3. Copy and paste the SQL from:');
    console.error(`      ${path.join(__dirname, '..', 'supabase', 'migrations', '20260226000000_add_verification_payment_revision_columns.sql')}`);
    console.error('   4. Execute the query');
    process.exit(1);
  }
}

// Verification function
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');

  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Check reports table columns
  const reportsColumns = [
    'verification_nota',
    'revision_count',
    'revision_reason',
    'revision_notes',
    'revision_requested_by',
    'revision_requested_at',
    'revised_at'
  ];

  const paymentColumns = [
    'approved_by',
    'approved_at'
  ];

  console.log('\n📋 Checking reports table columns:');
  for (const col of reportsColumns) {
    const { data, error } = await supabase
      .from('reports')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`   ❌ ${col}: NOT FOUND`);
    } else {
      console.log(`   ✅ ${col}: EXISTS`);
    }
  }

  console.log('\n📋 Checking payment_batches table columns:');
  for (const col of paymentColumns) {
    const { data, error } = await supabase
      .from('payment_batches')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`   ❌ ${col}: NOT FOUND`);
    } else {
      console.log(`   ✅ ${col}: EXISTS`);
    }
  }

  console.log('\n📋 Checking report_revisions table:');
  const { data, error } = await supabase
    .from('report_revisions')
    .select('*')
    .limit(1);

  if (error) {
    console.log('   ❌ Table does NOT exist');
  } else {
    console.log('   ✅ Table exists');
  }

  console.log('\n✅ Verification complete!');
}

// Run migration
runMigration()
  .then(() => verifyMigration())
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
