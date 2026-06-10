const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Running migration: Add approved_at column to reports table\n');

  try {
    // Read the SQL migration file
    const sql = fs.readFileSync('./migrations/add-approved-at-column.sql', 'utf8');

    console.log('📋 SQL to execute:');
    console.log(sql);
    console.log('\n⏳ Executing migration...\n');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // If RPC doesn't exist, try direct query
      console.log('⚠️ RPC method not available, trying direct query...\n');

      const { error: directError } = await supabase
        .from('reports')
        .select('approved_at')
        .limit(1);

      if (directError && directError.message.includes('column "approved_at" does not exist')) {
        console.error('❌ Migration failed: Column does not exist and cannot be created via API');
        console.error('Please run this SQL manually in Supabase SQL Editor:');
        console.log('\n' + sql);
        process.exit(1);
      } else {
        console.log('✅ Column already exists or migration completed previously');
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }

    // Verify the column exists
    console.log('\n🔍 Verifying column was added...\n');
    const { data: testData, error: testError } = await supabase
      .from('reports')
      .select('id, approved_at')
      .limit(1);

    if (testError) {
      console.error('❌ Verification failed:', testError.message);
      process.exit(1);
    }

    console.log('✅ Verification successful! Column "approved_at" is accessible.');
    console.log('Sample data:', testData);

  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

runMigration().catch(console.error);
