# Sync Scripts

This directory contains scripts for syncing data between Google Sheets and Supabase database.

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains:
   ```env
   GOOGLE_CREDENTIALS_BASE64=your-base64-credentials
   GOOGLE_SHEETS_MAPPING_ID=your-mapping-sheet-id
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Dependencies**: Install required packages:
   ```bash
   npm install
   ```

3. **Database Schema**: Ensure your Supabase database has:
   - `entrepreneurs` table with columns: `name`, `email`, `business_name`, `phone`, `batch`, `folder_id`, `program`, `region`, `zone`, `business_type`, `address`, `status`
   - `mentors` table with columns: `name`, `email`, `phone`, `program`, `region`, `status`
   - `dual_write_logs` table for error tracking

## Scripts

### sync-mappings.js (Entrepreneur & Mentor Sync)

Syncs entrepreneur and mentor data from Google Sheets "mapping" tab to Supabase.

**Features:**
- ✅ Upserts entrepreneurs and mentors (insert new, update existing)
- ✅ Uses email as unique identifier
- ✅ Logs errors to `dual_write_logs` table
- ✅ Skips rows with missing required fields
- ✅ Test mode for safe validation
- ✅ Detailed progress logging
- ✅ Summary statistics

**Usage:**

```bash
# Step 1: Validate your setup (RECOMMENDED)
npm run sync:validate

# Step 2: Test mode - Process first 10 rows only
npm run sync:mappings:test

# Step 3: Full sync - Process all rows (after validating test results)
npm run sync:mappings
```

**Direct Node execution:**
```bash
# Test mode
node scripts/sync-mappings.js --test

# Full sync
node scripts/sync-mappings.js
```

**Google Sheets Mapping Tab Format:**

The script expects the following columns in the "mapping" tab:

| Column | Maps To | Required | Notes |
|--------|---------|----------|-------|
| `Batch` | entrepreneur.batch, program | Yes | Used to determine program (Bangkit/Maju) |
| `Zon` | entrepreneur.zone, region | No | Format: "Region - Zone" |
| `Mentor` | mentor.name | Yes* | Required for mentor sync |
| `Mentor_Email` | mentor.email | Yes* | Required for mentor sync (unique key) |
| `Usahawan` | entrepreneur.name | Yes** | Required for entrepreneur sync |
| `Nama_Syarikat` | entrepreneur.business_name | No | Business name |
| `Alamat` | entrepreneur.address | No | Business address |
| `No_Tel` | entrepreneur.phone | No | Phone number |
| `Folder_ID` | entrepreneur.folder_id | No | **CRITICAL** for doc generation |
| `Emel` | entrepreneur.email | Yes** | Required for entrepreneur sync (unique key) |
| `Jenis_Bisnes` | entrepreneur.business_type | No | Type of business |

\* Required for mentor processing
\** Required for entrepreneur processing

**Output:**

```
✅ Sync complete: 280 entrepreneurs (10 new, 270 updated), 25 mentors (2 new, 23 updated)
```

---

### sync-bangkit-reports.js (Bangkit Session Reports Sync)

Syncs Bangkit session reports from Google Sheets "Bangkit" tab to Supabase `reports` and `sessions` tables.

**Features:**
- ✅ Resolves entrepreneur_id and mentor_id via name/email lookup
- ✅ Creates/updates session records automatically
- ✅ Parses complex JSONB fields (initiatives, sales, reflections, GW scores)
- ✅ Handles image URLs and file attachments
- ✅ Upserts reports by sheets_row_number (update existing, insert new)
- ✅ Logs FK resolution failures
- ✅ Test mode for validation

**Usage:**

```bash
# Step 1: Validate your setup (RECOMMENDED)
npm run sync:validate

# Step 2: Test mode - Process first 10 rows only
npm run sync:bangkit:test

# Step 3: Full sync - Process all rows (after validating test results)
npm run sync:bangkit
```

**Direct Node execution:**
```bash
# Test mode
node scripts/sync-bangkit-reports.js --test

# Full sync
node scripts/sync-bangkit-reports.js
```

**Bangkit Sheet Structure (74 columns):**

| Column Range | Description | Maps To |
|-------------|-------------|---------|
| A | Timestamp | submission_date |
| B | Emai (mentor email) | mentor_email (denormalized) |
| C | Status Sesi | mia_status |
| D | Sesi Laporan | session_number (parsed) |
| E | Tarikh Sesi | session_date |
| F | Masa Sesi | masa_mula |
| G | Mod Sesi | mod_sesi |
| H | Nama Usahawan | nama_usahawan (denormalized) + FK lookup |
| I | Nama Bisnes | nama_syarikat, nama_bisnes |
| J | Nama Mentor | nama_mentor (denormalized) |
| K | Update Keputusan | kemaskini_inisiatif |
| L | Ringkasan Sesi | rumusan |
| M-W | Initiatives 1-4 | inisiatif (JSONB array) |
| X-AI | Sales Jan-Dec | jualan_terkini (JSONB array) |
| AJ | Link Gambar | image_urls.sesi (JSONB) |
| AK | Produk/Servis | produk_servis |
| AL | Pautan Media Sosial | pautan_media_sosial |
| AM | Link Carta GrowthWheel | image_urls.growthwheel |
| AN | Link Bukti MIA | mia_proof_url (if MIA) |
| AO-AV | Reflections | refleksi (JSONB, session 1 only) |
| AW | Link Gambar Profil | image_urls.profil |
| AX | Link Gambar Premis | image_urls.premis |
| AY | Premis Dilawat | premis_dilawat (boolean) |
| AZ | Status | (Apps Script) |
| BA | DOC_URL | doc_url, google_doc_url |
| BB+ | GW Scores | gw_skor (JSONB array) |

**FK Resolution Logic:**
1. **Entrepreneur**: Lookup by name (case-insensitive match)
2. **Mentor**: Lookup by email (case-insensitive match)
3. **Session**: Create if doesn't exist (unique on mentor_id + entrepreneur_id + program + session_number)

**Output:**

```
✅ Bangkit sync complete: 76 total rows, 0 new reports, 76 updated reports
```

**Error Handling:**

- Rows with missing required data are skipped
- FK lookup failures logged to `dual_write_logs`
- Script continues processing on errors
- All errors shown in summary

---

### sync-maju-reports.js (Maju Session Reports Sync)

Syncs Maju session reports from Google Sheets "LaporanMajuUM" tab to Supabase `reports` and `sessions` tables.

**Features:**
- ✅ Resolves entrepreneur_id and mentor_id via name/email lookup
- ✅ Creates/updates session records automatically
- ✅ Parses JSONB fields (financial data, mentoring findings)
- ✅ Handles Malaysian timestamp format
- ✅ Supports MIA tracking with reason and proof
- ✅ Upserts reports by sheets_row_number
- ✅ Test mode for validation

**Usage:**

```bash
# Step 1: Validate your setup
npm run sync:validate

# Step 2: Test mode - Process first 10 rows only
npm run sync:maju:test

# Step 3: Full sync - Process all rows
npm run sync:maju
```

**LaporanMajuUM Sheet Structure (30 columns):**

| Column | Field | Maps To |
|--------|-------|---------|
| A | Timestamp | submission_date (Malaysian format) |
| B | NAMA_MENTOR | nama_mentor (denormalized) |
| C | EMAIL_MENTOR | mentor_email + FK lookup |
| D | NAMA_MENTEE | nama_mentee + FK lookup |
| E | NAMA_BISNES | nama_bisnes, nama_syarikat |
| F | LOKASI_BISNES | lokasi_bisnes |
| G | PRODUK_SERVIS | produk_servis |
| H | NO_TELEFON | no_telefon |
| I | TARIKH_SESI | session_date |
| J | SESI_NUMBER | session_number (already numeric) |
| K | MOD_SESI | mod_sesi |
| L | LOKASI_F2F | lokasi_f2f |
| M | MASA_MULA | masa_mula (start time) |
| N | MASA_TAMAT | masa_tamat (end time) |
| O | LATARBELAKANG_USAHAWAN | latarbelakang_usahawan |
| P | DATA_KEWANGAN_BULANAN_JSON | data_kewangan_bulanan (JSONB) |
| Q | MENTORING_FINDINGS_JSON | mentoring_findings (JSONB) |
| R | REFLEKSI_MENTOR_PERASAAN | refleksi_mentor_perasaan |
| S | REFLEKSI_MENTOR_KOMITMEN | refleksi_mentor_komitmen |
| T | REFLEKSI_MENTOR_LAIN | refleksi_mentor_lain |
| U | STATUS_PERNIAGAAN_KESELURUHAN | status_perniagaan |
| V | RUMUSAN_DAN_LANGKAH_KEHADAPAN | rumusan_langkah_kehadapan |
| W | URL_GAMBAR_PREMIS_JSON | image_urls.premis (JSONB) |
| X | URL_GAMBAR_SESI_JSON | image_urls.sesi (JSONB) |
| Y | URL_GAMBAR_GW360 | image_urls.growthwheel |
| Z | Mentee_Folder_ID | folder_id |
| AA | Laporan_Maju_Doc_ID | doc_url |
| AB | MIA_STATUS | mia_status ('MIA' or 'Tidak MIA') |
| AC | MIA_REASON | mia_reason |
| AD | MIA_PROOF_URL | mia_proof_url |

**Key Differences from Bangkit:**
- Uses **NAMA_MENTEE** (not NAMA_USAHAWAN) for entrepreneur name
- Has **two time fields**: MASA_MULA and MASA_TAMAT
- **Malaysian timestamp format**: "24/09/2025, 12:42:34" (auto-converted to ISO)
- **MIA_STATUS values**: 'MIA' or 'Tidak MIA' (not 'Selesai')
- Simpler structure: no initiatives, no sales array, different JSONB fields

**Output:**

```
✅ Maju sync complete: 18 total rows, 0 new reports, 18 updated reports
```

**Error Handling:**

- Rows with missing entrepreneur or mentor are skipped
- FK lookup failures logged to `dual_write_logs`
- JSON parsing errors logged but script continues
- All errors shown in summary

---

### sync-um-reports.js (Upward Mobility Reports Sync)

Syncs Upward Mobility reports from Google Sheets "UM" tab to Supabase `upward_mobility_reports` table.

**Features:**
- ✅ Resolves entrepreneur_id and mentor_id via name/email lookup
- ✅ Parses financial metrics (before/after comparisons)
- ✅ Handles banking facility checkboxes
- ✅ Converts comma-separated lists to PostgreSQL text[] arrays
- ✅ Parses numeric values with RM formatting and commas
- ✅ INSERT strategy with duplicate detection
- ✅ Logs FK resolution failures
- ✅ Test mode for validation

**Usage:**

```bash
# Step 1: Validate your setup (RECOMMENDED)
npm run sync:validate

# Step 2: Test mode - Process first 10 rows only
node scripts/sync-um-reports.js --test

# Step 3: Full sync - Process all rows (after validating test results)
node scripts/sync-um-reports.js
```

**Environment Variables:**

Add to your `.env` file:
```env
# Use same spreadsheet as other reports
UPWARD_MOBILITY_SPREADSHEET_ID=your-spreadsheet-id
# OR reuse existing:
# GOOGLE_SHEETS_REPORT_ID=your-spreadsheet-id

# Optional: Override default sheet name
UM_SHEET_NAME=UM
```

**UM Sheet Structure (44 columns A-AR):**

| Column | Field | Maps To | Type | Notes |
|--------|-------|---------|------|-------|
| A | Timestamp | report_date | timestamp | Auto-converted to ISO |
| B | Email Address | mentor_email + FK lookup | string | **Required** for mentor_id |
| C | Program | program | string | Default: 'iTEKAD BangKIT' |
| D | Batch | batch | string | |
| E | Sesi Mentoring | sesi_mentoring | string | 'Sesi 2' or 'Sesi 4' |
| F | Nama Mentor | (denormalized) | string | Display only |
| G | Nama Penuh Usahawan | FK lookup | string | **Required** for entrepreneur_id |
| H | Nama Penuh Perniagaan | (not stored) | string | Business name |
| I | Jenis Perniagaan | jenis_perniagaan | string | Business type |
| J | Alamat Perniagaan | (not stored) | string | |
| K | Nombor Telefon | (not stored) | string | |
| L | Status Penglibatan | status_penglibatan | string | 'Active', 'Not Active', 'Not Involved' |
| M | Upward Mobility Status | upward_mobility_status | string | **'G1', 'G2', 'G3', 'NIL'** |
| N | Kriteria Improvement | kriteria_improvement | text | Explanation |
| O | Tarikh lawatan ke premis | tarikh_lawatan | date | Visit date (DD/MM/YYYY) |
| P | Penggunaan Akaun Semasa | penggunaan_akaun_semasa | text | Yes/No |
| Q | Penggunaan BIMB Biz | penggunaan_bimb_biz | text | Yes/No |
| R | Buka akaun Al-Awfar | buka_akaun_al_awfar | text | Yes/No |
| S | Penggunaan BIMB Merchant | penggunaan_bimb_merchant | text | Yes/No |
| T | Lain-lain Fasiliti | lain_lain_fasiliti | text | Yes/No |
| U | Langgan aplikasi MesinKira | langgan_mesin_kira | text | Yes/No |
| V | Jumlah Pendapatan - Sebelum | pendapatan_sebelum | numeric | Parsed (removes RM, commas) |
| W | Jumlah Pendapatan - Selepas | pendapatan_selepas | numeric | Parsed (removes RM, commas) |
| X | Jumlah Pendapatan - Ulasan | ulasan_pendapatan | text | Comments |
| Y | Peluang Pekerjaan - Sebelum | pekerjaan_sebelum | integer | Employee count |
| Z | Peluang Pekerjaan - Selepas | pekerjaan_selepas | integer | Employee count |
| AA | Peluang Pekerjaan - Ulasan | ulasan_pekerjaan | text | Comments |
| AB | Nilai Aset (Bukan Tunai) - Sebelum | aset_bukan_tunai_sebelum | numeric | Non-cash assets |
| AC | Nilai Aset (Bukan Tunai) - Selepas | aset_bukan_tunai_selepas | numeric | Non-cash assets |
| AD | Nilai Aset (Tunai) - Sebelum | aset_tunai_sebelum | numeric | Cash assets |
| AE | Nilai Aset (Tunai) - Selepas | aset_tunai_selepas | numeric | Cash assets |
| AF | Nilai Aset - Ulasan | ulasan_aset | text | Comments |
| AG | Simpanan Perniagaan - Sebelum | simpanan_sebelum | numeric | Business savings |
| AH | Simpanan Perniagaan - Selepas | simpanan_selepas | numeric | Business savings |
| AI | Simpanan Perniagaan - Ulasan | ulasan_simpanan | text | Comments |
| AJ | Pembayaran Zakat - Sebelum | zakat_sebelum | numeric | Zakat payment |
| AK | Pembayaran Zakat - Selepas | zakat_selepas | numeric | Zakat payment |
| AL | Pembayaran Zakat - Ulasan | ulasan_zakat | text | Comments |
| AM | Penggunaan Digital - Sebelum | digital_sebelum | text[] | Comma-separated → array |
| AN | Penggunaan Digital - Selepas | digital_selepas | text[] | Comma-separated → array |
| AO | Penggunaan Digital - Ulasan | ulasan_digital | text | Comments |
| AP | Jualan dan Pemasaran - Sebelum | online_sales_sebelum | text[] | Comma-separated → array |
| AQ | Jualan dan Pemasaran - Selepas | online_sales_selepas | text[] | Comma-separated → array |
| AR | Jualan dan Pemasaran - Ulasan | ulasan_online_sales | text | Comments |

**Key Features:**

1. **Before/After Metrics**: All financial and digital fields track progress with "Sebelum" (before) and "Selepas" (after) values
2. **Numeric Parsing**: Handles "RM 1,000" format → 1000.00
3. **Array Conversion**: Comma-separated values → PostgreSQL text[] arrays
4. **Banking Facilities**: All stored as Yes/No text (not boolean)
5. **Upward Mobility Levels**: G1, G2, G3, or NIL classification
6. **Duplicate Detection**: Checks by entrepreneur_id + sesi_mentoring

**FK Resolution Logic:**
1. **Entrepreneur**: Lookup by name (case-insensitive match from Column G)
2. **Mentor**: Lookup by email (case-insensitive match from Column B)

**Output:**

```
✅ UM sync complete: 50 total rows, 48 inserted, 0 errors
```

**Error Handling:**

- Rows with missing entrepreneur or mentor are skipped
- FK lookup failures logged to `dual_write_logs`
- Invalid numeric values converted to NULL
- Empty comma-separated lists converted to NULL
- Script continues processing on errors

**Important Notes:**

- This syncs to a **separate table** (`upward_mobility_reports`), not the main `reports` table
- No session creation (UM reports are standalone)
- Fresh sync recommended (INSERT strategy)
- Check for duplicates by entrepreneur + sesi before running full sync

---

### sync-docurl.js (Doc URL Backfill)

Backfills missing `doc_url` values from Google Sheets to Supabase reports table.

**Purpose:**
- Apps Script generates Google Docs 1-2 minutes after form submission
- This script syncs doc_url from Sheets to Supabase for reports missing them
- Useful for catching cases where sync ran before doc generation completed

**Features:**
- ✅ Syncs Bangkit doc URLs from Column BB (DOC_URL)
- ✅ Syncs Maju doc URLs from Column AA (Laporan_Maju_Doc_ID)
- ✅ Dry-run mode by default (safe to run anytime)
- ✅ Only updates NULL values (never overwrites existing)
- ✅ Live mode with --live flag for actual updates
- ✅ Detailed reporting of what would/did update

**Usage:**

```bash
# Dry-run mode (default) - shows what would be updated
npm run sync:docurl

# Live mode - actually updates database
npm run sync:docurl:live

# Or with direct node command
node scripts/sync-docurl.js          # dry-run
node scripts/sync-docurl.js --live   # live mode
```

**How It Works:**

1. **Bangkit Reports:**
   - Queries `reports` table for records where `program='Bangkit'` AND `doc_url IS NULL`
   - Fetches Bangkit sheet Column BB (DOC_URL)
   - For each missing doc_url, checks if sheet has value
   - Updates database if sheet has doc_url

2. **Maju Reports:**
   - Queries `reports` table for records where `program='Maju'` AND `doc_url IS NULL`
   - Fetches LaporanMajuUM sheet Column AA (Laporan_Maju_Doc_ID)
   - For each missing doc_url, checks if sheet has value
   - Updates database if sheet has doc_url

**Output Format:**

```
🔗 Doc URL Backfill Sync
🧪 DRY RUN MODE (use --live to actually update)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BANGKIT (Bangkit Sheet → Column BB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 76
Missing doc_url: 0
✅ All Bangkit reports have doc_url

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MAJU (LaporanMajuUM → Column AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 18
Missing doc_url: 1

📥 Fetching LaporanMajuUM sheet data...

🔍 Checking for doc URLs in sheet...
   [DRY RUN] Would update Row 5: Muhammad Muslim Bin Musa
             URL: https://docs.google.com/document/d/1abc...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bangkit:
  • Total reports: 76
  • Missing doc_url: 0
  • Found in sheet: 0

Maju:
  • Total reports: 18
  • Missing doc_url: 1
  • Found in sheet: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Would update 1 report(s)

💡 Run with --live flag to actually update:
   npm run sync:docurl -- --live
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When to Use:**

1. **After Initial Sync:**
   - Run main sync scripts first (they sync most data)
   - Wait 2-3 minutes for Apps Script to generate docs
   - Run `npm run sync:docurl:live` to backfill doc URLs

2. **Daily Maintenance:**
   - If validation shows missing doc URLs
   - Run in dry-run mode first to see what's missing
   - If Apps Script has generated docs, run in live mode

3. **After Apps Script Issues:**
   - If Apps Script was temporarily broken
   - After fixing, this script backfills missing doc URLs

**Safety Features:**

- **Dry-run by default:** Never updates unless you add `--live`
- **NULL-only updates:** Only updates records where `doc_url IS NULL`
- **Never overwrites:** Existing doc URLs are never modified
- **Row-by-row reporting:** See exactly what's being updated

**Typical Workflow:**

```bash
# 1. Check what's missing (dry-run)
npm run sync:docurl

# 2. Wait for Apps Script if needed (1-2 minutes)

# 3. Run again to check if docs appeared
npm run sync:docurl

# 4. If docs are now in sheets, update database
npm run sync:docurl:live

# 5. Verify with validation
npm run validate:sync
```

**Environment Variables:**

```env
GOOGLE_SHEETS_REPORT_ID=your-spreadsheet-id
GOOGLE_SHEETS_MAJU_REPORT_ID=your-spreadsheet-id  # optional, defaults to GOOGLE_SHEETS_REPORT_ID
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Exit Codes:**
- `0` - Success (updates completed or nothing to update)
- `1` - Fatal error

**Common Scenarios:**

| Scenario | Dry-Run Output | Action |
|----------|---------------|--------|
| All docs present | "All reports have doc_url" | No action needed |
| Missing, not in sheet | "No doc URLs found in sheet" | Wait for Apps Script |
| Missing, found in sheet | "Would update X reports" | Run with --live |
| After live update | "Successfully updated X reports" | Run validation |

---

### validate-sync.js (Daily Data Validation)

Daily validation script to compare Google Sheets vs Supabase data integrity and detect discrepancies.

**Purpose:**
- Post-migration monitoring to ensure dual-write stays in sync
- Early detection of sync failures
- Data consistency verification

**Features:**
- ✅ Row count comparison across all programs
- ✅ Recent submissions check (last 10 rows)
- ✅ Data consistency spot checks (random sampling)
- ✅ Doc URL completeness verification
- ✅ Session integrity checks
- ✅ Detailed issue tracking with severity levels
- ✅ Exit codes for CI/CD integration

**Usage:**

```bash
# Run validation
node scripts/validate-sync.js

# Schedule daily (example cron)
# 0 9 * * * cd /path/to/project && node scripts/validate-sync.js >> logs/validation.log 2>&1
```

**Validation Checks:**

1. **Count Comparison**
   - Bangkit: Bangkit sheet vs `reports WHERE program='Bangkit'`
   - Maju: LaporanMajuUM sheet vs `reports WHERE program='Maju'`
   - UM: UM sheet vs `upward_mobility_reports`
   - Triggers CRITICAL if difference > 5 rows
   - Triggers WARNING if difference 1-5 rows

2. **Recent Submissions (Last 10 Rows)**
   - Fetches last 10 rows from each sheet
   - Verifies each exists in Supabase by `sheets_row_number`
   - Triggers CRITICAL if any recent rows missing
   - Helps catch dual-write failures quickly

3. **Data Consistency Spot Checks**
   - Random sample of 10 records from Supabase
   - Compares key fields against corresponding Sheet rows:
     - Bangkit: `nama_usahawan`, `session_number`, `mia_status`
     - Maju: `nama_mentee`, `session_number`, `mia_status`
     - UM: `upward_mobility_status`
   - Triggers WARNING on field mismatches
   - Helps detect data corruption or manual edits

4. **Doc URL Completeness**
   - Counts reports missing `doc_url` field
   - Lists `sheets_row_number` for backfill
   - Separate counts for Bangkit and Maju
   - Note: UM reports don't require doc_url

5. **Session Integrity**
   - Reports without `session_id` (orphaned reports)
   - Sessions without reports (orphaned sessions)
   - Triggers CRITICAL if >10 orphaned reports
   - Triggers WARNING for orphaned sessions

**Output Format:**

```
🔍 Starting Daily Validation: Google Sheets ↔️ Supabase

Timestamp: 2025-12-29T08:00:00.000Z

======================================================================
  1. COUNT COMPARISON
======================================================================
✅ Bangkit Count: Sheets: 76 | Supabase: 76
✅ Maju Count: Sheets: 18 | Supabase: 18
✅ Upward Mobility Count: Sheets: 6 | Supabase: 6

======================================================================
  2. RECENT SUBMISSIONS CHECK (Last 24h)
======================================================================
✅ Bangkit Recent Submissions: Checked last 10 rows: 0 missing in Supabase
✅ Maju Recent Submissions: Checked last 10 rows: 0 missing in Supabase
✅ UM Recent Submissions: Checked last 10 rows: 0 missing in Supabase

======================================================================
  3. DATA CONSISTENCY SPOT CHECKS
======================================================================
✅ Bangkit Data Consistency: Spot-checked 10 records: 0 mismatches
✅ Maju Data Consistency: Spot-checked 10 records: 0 mismatches
✅ UM Data Consistency: Spot-checked 6 records: 0 mismatches

======================================================================
  4. DOC URL COMPLETENESS
======================================================================
✅ Bangkit Doc URLs: 0 reports missing doc_url
✅ Maju Doc URLs: 0 reports missing doc_url
   ℹ️  UM reports do not require doc_url

======================================================================
  5. SESSION INTEGRITY CHECK
======================================================================
✅ Reports with session_id: 0 reports missing session_id
✅ Orphaned Sessions: 0 sessions without reports

======================================================================
  VALIDATION SUMMARY
======================================================================
Total Checks Passed: 13
Total Issues Found: 0
  • Critical: 0
  • Warnings: 0

======================================================================
✅ ALL VALIDATION CHECKS PASSED - Data is in sync!
======================================================================
```

**Exit Codes:**
- `0` - All checks passed or only warnings
- `1` - Critical issues found or fatal error

**Integration with CI/CD:**

```bash
#!/bin/bash
# daily-validation.sh

# Run validation
node scripts/validate-sync.js

# Check exit code
if [ $? -eq 0 ]; then
  echo "Validation passed"
else
  echo "CRITICAL: Validation failed - check logs!"
  # Send alert (email, Slack, etc.)
fi
```

**Recommended Schedule:**
- Run daily at 9 AM (after business hours submissions)
- Run after major sync operations
- Run before/after dual-write deployment

**Troubleshooting Common Issues:**

| Issue | Severity | Likely Cause | Solution |
|-------|----------|--------------|----------|
| Count mismatch | CRITICAL | Sync script failed | Re-run sync script |
| Recent row missing | CRITICAL | Dual-write not working | Check API endpoints |
| Field mismatch | WARNING | Manual sheet edit | Re-sync specific row |
| Missing doc_url | INFO | Doc generation pending | Run doc backfill script |
| Orphaned sessions | WARNING | Historical data | Safe to ignore if <100 |

---

## Library Modules

### lib/sheets-client.js

Reusable Google Sheets API client.

**Functions:**
- `createSheetsClient()` - Creates authenticated Sheets client
- `getRows(spreadsheetId, sheetName, range)` - Fetches rows as objects

### lib/supabase-client.js

Reusable Supabase database client.

**Functions:**
- `createSupabaseClient()` - Creates authenticated Supabase client
- `upsertRecord(supabase, tableName, data, conflictColumns)` - Upserts a record
- `logDiscrepancy(supabase, discrepancy)` - Logs errors to dual_write_logs

## Troubleshooting

### "GOOGLE_SHEETS_MAPPING_ID environment variable not set"

Add the mapping sheet ID to your `.env` file:
```env
GOOGLE_SHEETS_MAPPING_ID=your-sheet-id-here
```

### "GOOGLE_CREDENTIALS_BASE64 environment variable not found"

Ensure your Google Service Account credentials are base64 encoded in `.env`:
```env
GOOGLE_CREDENTIALS_BASE64=your-base64-credentials
```

### "Failed to upsert entrepreneur/mentor"

Check the error in the script output. Common issues:
- Email format validation
- Missing required database columns
- Unique constraint violations

View all sync errors:
```bash
# Query dual_write_logs table in Supabase
SELECT * FROM dual_write_logs WHERE operation_type = 'sync' ORDER BY created_at DESC;
```

## Development

### Adding New Sync Scripts

1. Create script in `scripts/` directory
2. Import shared libraries from `scripts/lib/`
3. Add npm script to `package.json`
4. Document in this README

### Testing Changes

Always run in test mode first:
```bash
npm run sync:mappings:test
```

Verify results in Supabase dashboard before running full sync.

## Best Practices

1. **Always test first**: Use `--test` flag before full sync
2. **Monitor logs**: Check `dual_write_logs` for discrepancies
3. **Backup data**: Take Supabase snapshot before major syncs
4. **Validate counts**: Compare Google Sheets row count with database counts
5. **Schedule syncs**: Consider using cron/GitHub Actions for automated syncs

## Support

For issues or questions, check:
- Project documentation
- Supabase logs and error messages
- Google Sheets API quotas and limits
