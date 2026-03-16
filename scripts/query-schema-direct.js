/**
 * Query schema directly using PostgreSQL information_schema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: {
      schema: 'public'
    }
  }
);

async function querySchema(tableName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Schema for: ${tableName}`);
  console.log('='.repeat(80));

  // Use PostgREST's ability to query system tables
  // We'll use a direct HTTP request to query information_schema
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`;

  const sql = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = '${tableName}'
    ORDER BY ordinal_position;
  `;

  try {
    // Try using fetch to query
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      console.log('⚠️  RPC exec not available, trying alternative...');

      // Alternative: Create a temporary view or use direct table query
      // Let's try to read from pg_catalog
      await queryViaPgCatalog(tableName);
    } else {
      const data = await response.json();
      displaySchema(data);
    }
  } catch (error) {
    console.log('⚠️  Direct query failed, trying pg_catalog approach...');
    await queryViaPgCatalog(tableName);
  }
}

async function queryViaPgCatalog(tableName) {
  try {
    // Use supabase.from() to query pg_catalog views if accessible
    const { data, error } = await supabase
      .schema('information_schema')
      .from('columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .order('ordinal_position');

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('\n💡 Recommendation: Access Supabase Dashboard → Table Editor to view schema');
      console.log(`   Or use Supabase SQL Editor with this query:`);
      console.log(`\n   SELECT * FROM information_schema.columns`);
      console.log(`   WHERE table_name = '${tableName}';`);
      return;
    }

    if (data && data.length > 0) {
      displaySchema(data);
    } else {
      console.log('⚠️  No schema found - table may not exist');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function displaySchema(columns) {
  if (!columns || columns.length === 0) {
    console.log('⚠️  No columns found');
    return;
  }

  console.log('\n📋 Columns:');
  console.log('-'.repeat(80));

  columns.forEach((col, idx) => {
    console.log(`\n${idx + 1}. ${col.column_name}`);
    console.log(`   Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
    console.log(`   Nullable: ${col.is_nullable}`);
    console.log(`   Default: ${col.column_default || 'NULL'}`);
    if (col.udt_name) {
      console.log(`   UDT: ${col.udt_name}`);
    }
  });
}

async function main() {
  console.log('🚀 Querying Supabase Table Schemas via information_schema\n');

  const tables = [
    'mentors',
    'batch_rounds',
    'entrepreneur_assignments',
    'mentor_entrepreneur_assignments'
  ];

  for (const table of tables) {
    await querySchema(table);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Query complete!');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
