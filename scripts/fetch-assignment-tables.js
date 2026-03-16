/**
 * Fetch all assignment-related table schemas
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTableColumns(tableName) {
  try {
    // Try to get columns by querying with limit 0
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      // If table is empty, we can still see the schema structure
      if (error.code === 'PGRST116') {
        console.log(`\n⚠️  Table "${tableName}" is empty - trying alternative method...`);
        return null;
      }
      throw error;
    }

    // If we have data, show the columns
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }

    // Table exists but is empty - we need another approach
    return null;
  } catch (error) {
    console.error(`❌ Error for ${tableName}:`, error.message);
    return null;
  }
}

async function describeTable(tableName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Table: ${tableName}`);
  console.log('='.repeat(80));

  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`❌ Table does not exist or is not accessible`);
    console.log(`   Error: ${error.message}`);
    return;
  }

  console.log(`📊 Total records: ${count || 0}`);
  console.log(`   Status: ${count > 0 ? '✅ Has data' : '⚠️  Empty table'}`);

  // Try to insert and immediately delete to see schema (safe for empty tables)
  // Actually, let's just try to describe it using information_schema via raw query

  // Alternative: Directly query pg_catalog for column information
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_table_columns`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ table_name: tableName })
    });

    if (response.ok) {
      const columns = await response.json();
      console.log('\n📋 Columns:');
      columns.forEach((col, idx) => {
        console.log(`${idx + 1}. ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n⚠️  Could not fetch column details via RPC');
      await manualSchemaCheck(tableName);
    }
  } catch (err) {
    console.log('\n⚠️  RPC method not available, using manual check');
    await manualSchemaCheck(tableName);
  }
}

async function manualSchemaCheck(tableName) {
  // For empty tables, we can try inserting a test row to see what columns exist
  // But this is risky, so let's just note that the table exists but is empty
  console.log('\n📝 Table exists but schema details require data or direct DB access');
  console.log('   Suggestion: Check Supabase Dashboard → Table Editor for full schema');
}

async function main() {
  console.log('🚀 Fetching Assignment-Related Table Schemas\n');

  const tables = [
    'entrepreneur_assignments',
    'mentor_entrepreneur_assignments',
    'entrepreneur_mentors',
    'mentor_mentees',
    'mentee_assignments'
  ];

  for (const table of tables) {
    await describeTable(table);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Done!');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
