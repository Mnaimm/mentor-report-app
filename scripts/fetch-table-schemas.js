/**
 * Fetch Supabase Table Schemas
 * Retrieves detailed schema information for mentors, assignments, and batch_rounds tables
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Fetch schema using PostgREST API introspection
 */
async function fetchTableSchema(tableName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Schema for table: ${tableName}`);
  console.log('='.repeat(80));

  try {
    // Method 1: Fetch sample data to infer columns
    const { data: sampleData, error: sampleError, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (sampleError) {
      throw sampleError;
    }

    console.log(`\n📊 Table: ${tableName}`);
    console.log(`   Total rows: ${count || 'unknown'}`);
    console.log(`   Status: ${sampleData ? '✅ Accessible' : '⚠️  Empty'}`);

    if (sampleData && sampleData.length > 0) {
      console.log('\n📋 Columns (detected from data):');
      console.log('-'.repeat(80));

      const columns = Object.keys(sampleData[0]);
      columns.forEach((col, idx) => {
        const value = sampleData[0][col];
        let inferredType = typeof value;

        // Better type inference
        if (value === null) {
          inferredType = 'null (unknown type)';
        } else if (Array.isArray(value)) {
          inferredType = 'array';
        } else if (value instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(value)) {
          inferredType = 'timestamp/date';
        } else if (typeof value === 'object') {
          inferredType = 'jsonb/object';
        } else if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          inferredType = 'uuid';
        }

        console.log(`\n${idx + 1}. ${col}`);
        console.log(`   Inferred Type: ${inferredType}`);

        if (value !== null) {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value).substring(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '')
            : String(value).substring(0, 100);
          console.log(`   Sample: ${displayValue}`);
        } else {
          console.log(`   Sample: NULL`);
        }
      });
    } else {
      console.log('\n⚠️  Table is empty, fetching column info another way...');
      await fetchEmptyTableSchema(tableName);
    }

    // Method 2: Try to get total count
    const { count: totalCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Statistics:`);
    console.log(`   Total Records: ${totalCount || 0}`);

  } catch (error) {
    console.error(`❌ Error fetching schema for ${tableName}:`, error.message);

    // If table doesn't exist, note it
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log(`\n⚠️  Table "${tableName}" does not exist in the database`);
    }
  }
}

/**
 * Fetch schema for empty tables using PostgREST HEAD request
 */
async function fetchEmptyTableSchema(tableName) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);

    const options = {
      method: 'OPTIONS',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('   Schema introspection via OPTIONS not fully supported');
        console.log('   Try inserting a sample row to see full schema');
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('   Error fetching schema:', error.message);
      resolve();
    });

    req.end();
  });
}

async function main() {
  console.log('🚀 Fetching Supabase Table Schemas');
  console.log(`📍 Database: ${supabaseUrl}`);

  const tables = ['mentors', 'assignments', 'batch_rounds'];

  for (const table of tables) {
    await fetchTableSchema(table);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Schema fetch complete!');
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
