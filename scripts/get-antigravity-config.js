#!/usr/bin/env node

/**
 * Helper script to generate Antigravity MCP config from your .env file
 *
 * Usage:
 *   node scripts/get-antigravity-config.js
 *
 * This will:
 * 1. Read your GOOGLE_CREDENTIALS_BASE64 from .env
 * 2. Generate a ready-to-use mcp_config.json
 * 3. Save it to antigravity-mcp-config.json (ready to copy)
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found!');
    console.log('Make sure you have a .env file in the project root.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }

  return env;
}

function generateConfig(env) {
  const base64Creds = env.GOOGLE_CREDENTIALS_BASE64;

  if (!base64Creds) {
    console.error('❌ Error: GOOGLE_CREDENTIALS_BASE64 not found in .env file!');
    console.log('\nMake sure your .env file has this variable set.');
    process.exit(1);
  }

  console.log('✅ Found GOOGLE_CREDENTIALS_BASE64 in .env');
  console.log(`   Length: ${base64Creds.length} characters\n`);

  const config = {
    mcpServers: {
      'google-sheets': {
        command: 'uvx',
        args: ['mcp-google-sheets@latest'],
        env: {
          CREDENTIALS_CONFIG: base64Creds
        }
      }
    }
  };

  return config;
}

function main() {
  console.log('🚀 Generating Antigravity MCP Config for Google Sheets\n');
  console.log('━'.repeat(60));

  // Load .env
  const env = loadEnv();

  // Generate config
  const config = generateConfig(env);

  // Save to file
  const outputPath = path.join(__dirname, '..', 'antigravity-mcp-config-READY.json');
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');

  console.log('✅ Config generated successfully!\n');
  console.log('📄 Saved to: antigravity-mcp-config-READY.json\n');
  console.log('━'.repeat(60));
  console.log('\n📋 Next Steps:\n');
  console.log('1. Open the generated file: antigravity-mcp-config-READY.json');
  console.log('2. Copy the entire content');
  console.log('3. Paste it into your Antigravity config:\n');

  if (process.platform === 'win32') {
    console.log('   Windows: C:\\Users\\<USERNAME>\\.gemini\\antigravity\\mcp_config.json\n');
  } else if (process.platform === 'darwin') {
    console.log('   macOS: ~/.gemini/antigravity/mcp_config.json\n');
  } else {
    console.log('   Linux: ~/.gemini/antigravity/mcp_config.json\n');
  }

  console.log('   OR via Antigravity UI:');
  console.log('   ... menu → MCP Servers → Manage MCP Servers → View raw config\n');
  console.log('4. Restart Antigravity\n');
  console.log('━'.repeat(60));
  console.log('\n🧪 Test Commands:\n');
  console.log('   "List all my spreadsheets"');
  console.log(`   "Get data from the 'mapping' sheet in ${env.GOOGLE_SHEETS_MAPPING_ID || '<SHEET_ID>'}"\n`);
  console.log('━'.repeat(60));
  console.log('\n💡 Pro Tip: You can also use these environment variables:\n');

  const sheetIds = {
    'Bangkit Reports': env.GOOGLE_SHEETS_REPORT_ID,
    'Maju Reports': env.GOOGLE_SHEETS_MAJU_REPORT_ID,
    'Mapping Data': env.GOOGLE_SHEETS_MAPPING_ID,
    'UM Data': env.GOOGLE_SHEET_ID_UM
  };

  for (const [name, id] of Object.entries(sheetIds)) {
    if (id) {
      console.log(`   ${name}: ${id}`);
    }
  }

  console.log('\n✨ Happy coding with Antigravity!\n');
}

main();
