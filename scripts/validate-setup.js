#!/usr/bin/env node
// scripts/validate-setup.js
// Validates that all environment variables and dependencies are properly configured

// Load environment variables from .env.local (Next.js convention) or .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env if .env.local doesn't exist

const REQUIRED_ENV_VARS = [
  'GOOGLE_CREDENTIALS_BASE64',
  'GOOGLE_SHEETS_MAPPING_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const OPTIONAL_ENV_VARS = [
  'GOOGLE_SHEETS_REPORT_ID',
  'GOOGLE_SHEETS_MAJU_REPORT_ID'
];

console.log('\n🔍 Validating Sync Setup...\n');

let hasErrors = false;
const warnings = [];

// Check required environment variables
console.log('📋 Required Environment Variables:');
REQUIRED_ENV_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const displayValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`   ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`   ❌ ${varName}: MISSING`);
    hasErrors = true;
  }
});

// Check optional environment variables
console.log('\n📋 Optional Environment Variables:');
OPTIONAL_ENV_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    const displayValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
    console.log(`   ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`   ⚠️  ${varName}: Not set`);
    warnings.push(`${varName} is not set (optional)`);
  }
});

// Validate Google credentials format
console.log('\n🔐 Google Credentials Validation:');
try {
  const base64Creds = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (base64Creds) {
    const decoded = Buffer.from(base64Creds, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);

    if (parsed.type === 'service_account') {
      console.log(`   ✅ Valid service account credentials`);
      console.log(`   ✅ Project ID: ${parsed.project_id}`);
      console.log(`   ✅ Client Email: ${parsed.client_email}`);
    } else {
      console.log(`   ⚠️  Credentials type: ${parsed.type} (expected: service_account)`);
      warnings.push('Credentials may not be a service account');
    }
  }
} catch (err) {
  console.log(`   ❌ Invalid credentials format: ${err.message}`);
  hasErrors = true;
}

// Check Supabase URL format
console.log('\n🗄️  Supabase Configuration:');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  if (supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co')) {
    console.log(`   ✅ Valid Supabase URL format`);
  } else {
    console.log(`   ⚠️  Unusual Supabase URL format: ${supabaseUrl}`);
    warnings.push('Supabase URL may be incorrect');
  }
} else {
  console.log(`   ❌ Supabase URL not set`);
  hasErrors = true;
}

// Check dependencies
console.log('\n📦 Package Dependencies:');
const requiredPackages = [
  '@supabase/supabase-js',
  'googleapis',
  'dotenv'
];

requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
    console.log(`   ✅ ${pkg}: installed`);
  } catch (err) {
    console.log(`   ❌ ${pkg}: NOT INSTALLED`);
    hasErrors = true;
  }
});

// Test Google Sheets client
console.log('\n📊 Testing Google Sheets Connection:');
(async () => {
  try {
    const { createSheetsClient } = require('./lib/sheets-client');
    const client = await createSheetsClient();
    console.log(`   ✅ Google Sheets client initialized successfully`);

    // Test fetching mapping sheet
    if (process.env.GOOGLE_SHEETS_MAPPING_ID) {
      try {
        const rows = await client.getRows(
          process.env.GOOGLE_SHEETS_MAPPING_ID,
          'mapping',
          'A1:A1'
        );
        console.log(`   ✅ Successfully connected to mapping sheet`);
      } catch (err) {
        console.log(`   ⚠️  Could not fetch mapping sheet: ${err.message}`);
        warnings.push('Mapping sheet may not exist or be accessible');
      }
    }
  } catch (err) {
    console.log(`   ❌ Failed to initialize Sheets client: ${err.message}`);
    hasErrors = true;
  }

  // Test Supabase client
  console.log('\n🗄️  Testing Supabase Connection:');
  try {
    const { createSupabaseClient } = require('./lib/supabase-client');
    const supabase = createSupabaseClient();
    console.log(`   ✅ Supabase client initialized successfully`);

    // Test connection by querying entrepreneurs table
    const { data, error } = await supabase
      .from('entrepreneurs')
      .select('id')
      .limit(1);

    if (error) {
      console.log(`   ⚠️  Entrepreneurs table query failed: ${error.message}`);
      warnings.push('Entrepreneurs table may not exist');
    } else {
      console.log(`   ✅ Successfully connected to entrepreneurs table`);
    }

    // Test mentors table
    const { data: mentorsData, error: mentorsError } = await supabase
      .from('mentors')
      .select('id')
      .limit(1);

    if (mentorsError) {
      console.log(`   ⚠️  Mentors table query failed: ${mentorsError.message}`);
      warnings.push('Mentors table may not exist');
    } else {
      console.log(`   ✅ Successfully connected to mentors table`);
    }

  } catch (err) {
    console.log(`   ❌ Failed to initialize Supabase client: ${err.message}`);
    hasErrors = true;
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));

  if (!hasErrors && warnings.length === 0) {
    console.log('✅ All checks passed! You are ready to run the sync.');
    console.log('\nNext steps:');
    console.log('  1. Test with 10 rows: npm run sync:mappings:test');
    console.log('  2. Review output and verify data');
    console.log('  3. Run full sync: npm run sync:mappings');
  } else {
    if (hasErrors) {
      console.log('❌ ERRORS FOUND - Please fix the errors above before running sync');
    }
    if (warnings.length > 0) {
      console.log(`\n⚠️  ${warnings.length} WARNING(S):`);
      warnings.forEach(w => console.log(`   - ${w}`));
    }

    console.log('\nSee scripts/README.md for troubleshooting help.');
  }

  console.log('='.repeat(60) + '\n');

  process.exit(hasErrors ? 1 : 0);
})();
