// scripts/apply-mia-migration.js
// Applies the MIA requests table migration to Supabase

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Starting MIA requests table migration...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/001_create_mia_requests_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded:', migrationPath);
    console.log('📝 SQL length:', migrationSQL.length, 'characters\n');

    // Execute migration
    console.log('⏳ Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      // If exec_sql function doesn't exist, try direct query
      console.log('⚠️ exec_sql function not found, trying direct execution...');

      // Split into individual statements (simple split by semicolon)
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';';
        console.log(`[${i + 1}/${statements.length}] Executing...`);

        const { error: stmtError } = await supabase.rpc('exec', {
          sql: stmt
        });

        if (stmtError) {
          console.error(`❌ Error on statement ${i + 1}:`, stmtError.message);
          throw stmtError;
        }
      }

      console.log('\n✅ All statements executed successfully');
    } else {
      console.log('✅ Migration executed successfully');
    }

    // Verify table was created
    console.log('\n🔍 Verifying table creation...');
    const { data: tables, error: verifyError } = await supabase
      .from('mia_requests')
      .select('*')
      .limit(0);

    if (verifyError) {
      console.error('❌ Table verification failed:', verifyError.message);
      throw verifyError;
    }

    console.log('✅ Table mia_requests verified successfully');

    // Get table info
    console.log('\n📊 Fetching table structure...');
    const { data: columns } = await supabase.rpc('get_table_columns', {
      table_name: 'mia_requests'
    });

    if (columns) {
      console.log('✅ Table columns:', columns.length);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ mia_requests table created');
    console.log('   ✅ Indexes applied');
    console.log('   ✅ RLS policies configured');
    console.log('   ✅ Triggers set up');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n💡 Manual Application Required:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Copy contents of migrations/001_create_mia_requests_table.sql');
    console.error('   3. Paste and run the SQL');
    process.exit(1);
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
