
const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');

// Load env
const envConfig = dotenv.config({ path: '.env.local' });
if (envConfig.error) {
    console.error('Error loading .env.local', envConfig.error);
    process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('statusCode=' + res.statusCode));
            }
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function fetchSchema() {
    const start = Date.now();
    try {
        const url = `${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`;
        console.log(`Fetching schema from ${SUPABASE_URL}...`);

        const data = await fetchJson(url);

        const tables = ['mentors', 'mentor_assignments', 'batch_rounds'];

        console.log('\n--- Schema Definitions ---\n');

        tables.forEach(table => {
            const def = data.definitions[table];
            if (def) {
                console.log(`\nTable: ${table}`);
                console.log('Properties:');
                if (def.properties) {
                    Object.entries(def.properties).forEach(([col, details]) => {
                        console.log(`  - ${col}: ${details.type} ${details.format ? '(' + details.format + ')' : ''} ${details.description ? '[' + details.description + ']' : ''}`);
                    });
                } else {
                    console.log('  (No properties found)');
                }
                if (def.required) {
                    console.log('Required:', def.required.join(', '));
                }
            } else {
                console.log(`\nTable: ${table} - NOT FOUND in OpenAPI definitions (Check permissions or if table exists)`);
            }
        });

    } catch (error) {
        console.error('Error fetching schema:', error);
    }
    console.log(`\nTime taken: ${(Date.now() - start) / 1000}s`);
}

fetchSchema();
