#!/usr/bin/env node
// sync-premis-dilawat.js
//
// Backfill premis_dilawat in the reports table by combining:
//   1. Google Sheets (Bangkit tab → Premis_Dilawat_Checked column)
//   2. Google Sheets (LaporanMajuUM tab → URL_GAMBAR_PREMIS_JSON column)
//   3. Supabase upward_mobility_reports (tarikh_lawatan IS a real date)
//
// Either source saying TRUE is enough. Never downgrades TRUE → FALSE.
//
// Usage:
//   node sync-premis-dilawat.js           (dry run — default)
//   node sync-premis-dilawat.js --dry-run (dry run — explicit)
//   node sync-premis-dilawat.js --apply   (write to Supabase)

'use strict';

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { google }       = require('googleapis');

// ─── Constants ────────────────────────────────────────────────────────────────

const DRY_RUN        = !process.argv.includes('--apply');
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
const BANGKIT_TAB    = 'Bangkit';          // exact tab name from mentor-stats.js
const MAJU_TAB       = 'LaporanMajuUM';    // exact tab name from mentor-stats.js
const BANGKIT_COL    = 'Premis_Dilawat_Checked';
const MAJU_COL       = 'URL_GAMBAR_PREMIS_JSON';
const BATCH_SIZE     = 50;

// ─── Supabase client (same pattern as createAdminClient() in lib/supabaseAdmin.js)

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Sheets client (same pattern as getSheetsClient() in lib/sheets.js) ───────

async function buildSheetsClient() {
  const b64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!b64) throw new Error('GOOGLE_CREDENTIALS_BASE64 not set');
  const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert zero-based column index to spreadsheet letter (0→A, 25→Z, 26→AA …)
function colLetter(idx) {
  let i = idx + 1;
  let s = '';
  while (i > 0) {
    i--;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

// Bangkit: TRUE / "TRUE" / "true" / "1" / "BENAR" / "Yes"
function bangkitTrue(cell) {
  const v = String(cell ?? '').trim().toUpperCase();
  return v === 'TRUE' || v === '1' || v === 'BENAR' || v === 'YES';
}

// Maju: any non-empty, non-null content in the image JSON column
function majuTrue(cell) {
  const v = String(cell ?? '').trim();
  return v !== '' && v !== 'null';
}

// ─── Sheet map loader ─────────────────────────────────────────────────────────
// Returns { [rowNumber: int]: boolean }
// Row number = Google Sheets 1-based row. Header = row 1, first data = row 2.
// In the values array (0-indexed), values[0] = header, values[i] = row i+1.
// So: rowNumber = i + 1, where i starts at 1 for the first data row.

async function loadSheetMap(sheets, tabName, colName, valueChecker) {
  console.log(`  Loading "${tabName}" tab…`);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1:BZ`,
  });

  const values = response.data.values;
  if (!values || values.length < 2) {
    console.warn(`  ⚠️  "${tabName}" is empty or header-only — returning empty map`);
    return {};
  }

  const header   = values[0];
  const colIndex = header.findIndex(h => h === colName);

  if (colIndex === -1) {
    const preview = header.slice(0, 12).join(', ');
    console.warn(`  ⚠️  Column "${colName}" not found in "${tabName}"`);
    console.warn(`       First 12 headers: ${preview}`);
    return {};
  }

  console.log(`  Column "${colName}" → index ${colIndex} (col ${colLetter(colIndex)})`);

  const map = {};
  let trueCount = 0;
  for (let i = 1; i < values.length; i++) {
    const rowNumber = i + 1; // row 2 is the first data row
    const cell      = values[i][colIndex] ?? '';
    const val       = valueChecker(cell);
    map[rowNumber]  = val;
    if (val) trueCount++;
  }

  console.log(`  ${Object.keys(map).length} data rows, ${trueCount} with premis_dilawat = true`);
  return map;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!SPREADSHEET_ID) throw new Error('GOOGLE_SHEETS_REPORT_ID not set');

  console.log('');
  console.log('=== SYNC PREMIS DILAWAT ===');
  console.log(`Mode:          ${DRY_RUN ? 'DRY RUN (no writes)' : '⚠️  APPLY (will write to Supabase)'}`);
  console.log(`Spreadsheet:   ${SPREADSHEET_ID}`);
  console.log('');

  const supabase = createAdminClient();
  const sheets   = await buildSheetsClient();

  // ── Step 1: Load reports from Supabase ──────────────────────────────────────
  console.log('[Step 1] Loading reports from Supabase (Bangkit + Maju, sheets_row_number not null)…');

  let allReports = [];
  const PAGE     = 1000;
  let from       = 0;

  while (true) {
    const { data, error } = await supabase
      .from('reports')
      .select('id, program, sheets_row_number, entrepreneur_id, premis_dilawat, nama_mentee')
      .in('program', ['Bangkit', 'Maju'])
      .not('sheets_row_number', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`reports query failed: ${error.message}`);
    allReports = allReports.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }

  const bangkitReports = allReports.filter(r => r.program === 'Bangkit');
  const majuReports    = allReports.filter(r => r.program === 'Maju');
  console.log(`  Total: ${allReports.length} (Bangkit: ${bangkitReports.length}, Maju: ${majuReports.length})`);

  // ── Steps 2 & 3: Load both Sheets tabs in parallel ──────────────────────────
  console.log('');
  console.log('[Steps 2 & 3] Loading Sheets data…');

  const [bangkitMap, majuMap] = await Promise.all([
    loadSheetMap(sheets, BANGKIT_TAB, BANGKIT_COL, bangkitTrue),
    loadSheetMap(sheets, MAJU_TAB,    MAJU_COL,    majuTrue),
  ]);

  // ── Step 4: Load upward_mobility_reports ────────────────────────────────────
  console.log('');
  console.log('[Step 4] Loading upward_mobility_reports…');

  const { data: umRows, error: umError } = await supabase
    .from('upward_mobility_reports')
    .select('entrepreneur_id, tarikh_lawatan')
    .not('tarikh_lawatan', 'is', null)
    .neq('tarikh_lawatan', '')
    .neq('tarikh_lawatan', 'Belum dilawat');

  if (umError) throw new Error(`upward_mobility_reports query failed: ${umError.message}`);

  // Trim whitespace in JS (can't do TRIM() via PostgREST filters)
  const umVisitedSet = new Set(
    (umRows || [])
      .filter(row => row.entrepreneur_id && (row.tarikh_lawatan || '').trim() !== '')
      .map(row => row.entrepreneur_id)
  );

  console.log(`  ${umVisitedSet.size} unique entrepreneurs with a confirmed UM premises visit`);

  // ── Step 5: Compute correct value per report ─────────────────────────────────
  console.log('');
  console.log('[Step 5] Computing correct premis_dilawat values…');

  const toUpdate     = []; // { id, rowNum, nama_mentee, program, sheetsVal, umVal, source }
  const skipped      = []; // already true in DB but computed false — no downgrade
  const noMatch      = []; // row number not found in the relevant Sheets map
  let alreadyCorrect = 0;

  for (const report of allReports) {
    const rowNum     = report.sheets_row_number;
    const relevantMap = report.program === 'Bangkit' ? bangkitMap : majuMap;

    // Skip if row number has no entry in the Sheets map
    if (!(rowNum in relevantMap)) {
      noMatch.push(report);
      continue;
    }

    const sheetsVal  = relevantMap[rowNum];                          // boolean
    const umVal      = umVisitedSet.has(report.entrepreneur_id);     // boolean
    const correctVal = sheetsVal || umVal;

    if (report.premis_dilawat === true) {
      // Safety check: never downgrade
      if (!correctVal) {
        skipped.push(report);
      } else {
        alreadyCorrect++;
      }
      continue;
    }

    // Current value is false or null — may need update
    if (correctVal) {
      const source = (sheetsVal && umVal) ? 'both' : sheetsVal ? 'sheets' : 'um_table';
      toUpdate.push({ id: report.id, rowNum, nama_mentee: report.nama_mentee, program: report.program, sheetsVal, umVal, source });
    } else {
      alreadyCorrect++;
    }
  }

  // ── Step 6: Batch update Supabase ───────────────────────────────────────────
  console.log('');
  if (DRY_RUN) {
    console.log(`[Step 6] DRY RUN — skipping ${toUpdate.length} updates`);
  } else if (toUpdate.length === 0) {
    console.log('[Step 6] Nothing to update');
  } else {
    console.log(`[Step 6] Applying ${toUpdate.length} updates in batches of ${BATCH_SIZE}…`);
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      const ids   = batch.map(r => r.id);
      const { error } = await supabase
        .from('reports')
        .update({ premis_dilawat: true })
        .in('id', ids);
      if (error) {
        throw new Error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} update failed: ${error.message}`);
      }
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${batch.length} rows`);
    }
  }

  // ── Step 7: Summary ──────────────────────────────────────────────────────────
  const verb = DRY_RUN ? 'would update' : 'updated';

  console.log('');
  console.log('=== SYNC PREMIS DILAWAT SUMMARY ===');
  console.log(`Bangkit reports processed: ${bangkitReports.length}`);
  console.log(`Maju reports processed:    ${majuReports.length}`);
  console.log('');
  console.log(`Changes (${verb}):`);

  if (toUpdate.length === 0) {
    console.log('  (none)');
  } else {
    for (const r of toUpdate) {
      const name    = (r.nama_mentee || 'Unknown').padEnd(32);
      const program = r.program.padEnd(6);
      console.log(`  [ROW ${String(r.rowNum).padStart(4)}] ${name} | ${program} | false → true | source: ${r.source}`);
    }
  }

  console.log('');
  console.log(`Total ${verb}:                        ${toUpdate.length}`);
  console.log(`Total already correct:             ${alreadyCorrect}`);
  console.log(`Total skipped (already true, no downgrade): ${skipped.length}`);

  if (noMatch.length > 0) {
    console.log('');
    console.log(`⚠️  ${noMatch.length} report(s) had no matching row in Sheets map (skipped):`);
    const show = noMatch.slice(0, 10);
    for (const r of show) {
      console.log(`  [ROW ${r.sheets_row_number}] ${r.nama_mentee || r.id} | ${r.program}`);
    }
    if (noMatch.length > 10) {
      console.log(`  … and ${noMatch.length - 10} more`);
    }
  }

  if (DRY_RUN && toUpdate.length > 0) {
    console.log('');
    console.log('Run with --apply to write changes to Supabase.');
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  process.exit(1);
});
