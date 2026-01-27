# HANDOFF TO CLAUDE CODE

## 🎯 Mission

Create 7 production-ready sync scripts to migrate data from Google Sheets to Supabase database.

---

## 📊 Data Source Overview

**8 Google Sheets Tabs:**
- batch (37 rows) → batches + batch_rounds
- mapping (204 rows) → mentors + entrepreneurs + assignments
- All-M (69 rows) → new entrepreneurs + assignments
- Bangkit (105 rows) → sessions + reports + UM reports
- LaporanMajuUM (28 rows) → sessions + reports + UM reports
- UM (23 rows) → standalone UM reports
- ~~V8~~ (skip - duplicate of Bangkit)
- ~~LaporanMaju~~ (skip - duplicate of LaporanMajuUM)

**Total:** ~800+ database records to create

---

## 📁 Files Already Created

In `/home/claude/sync-package/`:
- ✅ README_FOR_CLAUDE_CODE.md
- ✅ 00-SETUP_INSTRUCTIONS.md
- ✅ package.json

Also available:
- ✅ COMPLETE_MAPPING_FINAL.md (complete column mappings)
- ✅ EXACT_COLUMN_MAPPING.md (detailed field mappings)
- ✅ FINAL_SYNC_PLAN.md (execution strategy)

---

## 🎯 Scripts to Create

### Script 1: 01-sync-batches.js
**Input:** `sync-data/batch.json` (37 rows)
**Output:** batches + batch_rounds tables
**Columns:**
```
batch.json:
- Batch → batches.batch_name
- Mentoring Round → batch_rounds.round_number  
- Period → description
- Start Month → batch_rounds.start_date
- End Month → batch_rounds.end_date
- Notes → batches.description
```
**Logic:**
- Parse "Batch" column to determine program (Bangkit/Maju)
- Create batch record if not exists
- Create batch_round record for each row
- Link round to batch via batch_id

---

### Script 2: 02-sync-mapping.js
**Input:** `sync-data/mapping.json` (204 rows)
**Output:** mentors + entrepreneurs + mentor_assignments
**Columns:**
```
mapping.json:
- Mentor → mentors.name
- Mentor_Email → mentors.email
- Mentee → entrepreneurs.name
- Nama Syarikat → entrepreneurs.business_name
- Batch → entrepreneurs.batch + lookup batches table
- Zon → entrepreneurs.zone
- Alamat → parse to state/district
- no Telefon → entrepreneurs.phone
- Folder_ID → entrepreneurs.folder_id
- EMAIL → entrepreneurs.email
- JENIS BISNES → entrepreneurs.business_type
```
**Logic:**
1. Extract unique mentors by email → insert to mentors table
2. Extract entrepreneurs (if not in DB) → insert to entrepreneurs table
3. Create assignments: lookup mentor_id + entrepreneur_id + batch_id → insert to mentor_assignments

---

### Script 3: 03-sync-batch-7.js
**Input:** `sync-data/all-m.json` (69 rows)
**Output:** entrepreneurs + mentor_assignments
**Columns:**
```
all-m.json:
- NAME OF BUSINESS → entrepreneurs.business_name
- NAME OF BUSINESS OWNER → entrepreneurs.name
- Mentor → lookup for assignment
- STATE → entrepreneurs.state
- CONTACT NO → entrepreneurs.phone
- EMAIL ADDRESS → entrepreneurs.email
- BUSINESS SEGMENTATION → entrepreneurs.business_type
- Program → entrepreneurs.program (should be "Maju")
```
**Hardcode:**
- batch: "Batch 7"
- program: "Maju" (or from Program column)
- status: "active"

**Logic:**
1. Insert 69 entrepreneurs
2. Lookup mentor by name from "Mentor" column
3. Create 69 assignments

---

### Script 4: 04-sync-bangkit-reports.js
**Input:** `sync-data/bangkit.json` (105 rows)
**Output:** sessions + reports + upward_mobility_reports
**Complex Columns:**
```
bangkit.json:
- Emai (Column B) → lookup mentor
- Nama Usahawan (Column H) → lookup entrepreneur
- Sesi Laporan (Column D) → session_number
- Tarikh Sesi (Column E) → session_date
- Mod Sesi (Column G) → mod_sesi
- Nama Bisnes (Column I) → nama_bisnes

// Convert to JSONB:
- Fokus Area 1-4 + Keputusan + Tindakan → mentoring_findings (JSONB)
- Jualan Jan-Dis → jualan_terkini (JSONB array)
- GW_Skor_1-20 → gw_skor (JSONB array)
- Refleksi_* columns → refleksi (JSONB)

// UM columns (BC-CB):
- UM_STATUS_PENGLIBATAN → um.status_penglibatan
- UM_PENDAPATAN_SEMASA → um.pendapatan_semasa
- UM_PEKERJA_SEMASA → um.pekerja_semasa
// ... all UM fields
```

**Logic:**
1. For each row, create 3 records:
   - sessions record
   - reports record (link to session_id)
   - upward_mobility_reports record (if UM columns have data)

**Special Handling:**
- Parse "Fokus Area 1-4" + "Keputusan 1-4" + "Cadangan Tindakan 1-4" into structured JSONB
- Convert 12 monthly sales columns into array: `[{month: "Jan", sales: 5000}, ...]`
- Convert GW_Skor_1-20 into array: `[score1, score2, ...]`

---

### Script 5: 05-sync-maju-reports.js
**Input:** `sync-data/laporanmaju.json` (28 rows)
**Output:** sessions + reports + upward_mobility_reports
**Clean Columns (already structured):**
```
laporanmaju.json:
- EMAIL_MENTOR → lookup mentor
- NAMA_MENTEE → lookup entrepreneur
- TARIKH_SESI → session_date
- SESI_NUMBER → session_number
- MOD_SESI → mod_sesi
- DATA_KEWANGAN_BULANAN_JSON → parse JSON → data_kewangan_bulanan
- MENTORING_FINDINGS_JSON → parse JSON → mentoring_findings
- URL_GAMBAR_*_JSON → parse JSON → image_urls

// UM columns (AE-BF):
- UM_STATUS_PENGLIBATAN → um.status_penglibatan
- UM_PENDAPATAN_SEMASA → um.pendapatan_semasa
// ... all UM fields
```

**Logic:**
1. For each row, create 3 records:
   - sessions record
   - reports record
   - upward_mobility_reports record (if UM columns have data)

**Special Handling:**
- Parse `*_JSON` columns from JSON strings
- Much cleaner than Bangkit (already structured!)

---

### Script 6: 06-sync-um-standalone.js
**Input:** `sync-data/um.json` (23 rows)
**Output:** upward_mobility_reports
**Columns:**
```
um.json:
- Email Address → lookup mentor
- Nama Penuh Usahawan → lookup entrepreneur
- Program → um.program
- Batch → um.batch
- Sesi Mentoring → um.sesi_mentoring
- Jenis Perniagaan → um.jenis_perniagaan
- Status Penglibatan → um.status_penglibatan
- Upward Mobility Status → um.upward_mobility_status
- Jumlah Pendapatan (Sebelum) → um.pendapatan_sebelum
- Jumlah Pendapatan (Selepas) → um.pendapatan_selepas
- Peluang Pekerjaan (Sebelum) → um.pekerjaan_sebelum
- Peluang Pekerjaan (Selepas) → um.pekerjaan_selepas
// ... all before/after metrics
- Penggunaan Digital (Sebelum/Selepas) → um.digital_sebelum/selepas (ARRAY)
- Jualan Online (Sebelum/Selepas) → um.online_sales_sebelum/selepas (ARRAY)
```

**Note:** Columns 1-44 are actual form questions, columns 45-62 appear to be duplicates (ignore)

**Logic:**
- Create standalone UM report for each row
- Check for duplicates with embedded UM reports (by mentor + entrepreneur + sesi)

---

### Script 7: 07-master-sync.js (Orchestrator)
**Purpose:** Run all 6 scripts in correct order

```javascript
async function main() {
  console.log('Starting master sync...');
  
  // Phase 1: Foundation
  await runScript('01-sync-batches.js');
  await runScript('02-sync-mapping.js');
  await runScript('03-sync-batch-7.js');
  
  // Phase 2: Session Reports
  await runScript('04-sync-bangkit-reports.js');
  await runScript('05-sync-maju-reports.js');
  
  // Phase 3: UM Reports
  await runScript('06-sync-um-standalone.js');
  
  // Summary
  generateFinalReport();
}
```

**Features:**
- Run scripts in sequence
- Handle errors (continue or stop based on severity)
- Aggregate results from all scripts
- Generate final summary report
- Log to file: `master-sync-results.json`

---

## 🔧 Script Requirements

**All scripts must have:**

1. **DRY_RUN mode** (true by default)
2. **Duplicate checking** (don't insert if exists)
3. **Error handling** with detailed logging
4. **Progress logging** (every 10 rows)
5. **Result summary** (success/skipped/failed counts)
6. **Error file output** (`sync-errors.json`)
7. **Rate limiting** (100ms delay every 10 rows)

**Script Template:**
```javascript
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = true;

async function sync() {
  const data = JSON.parse(fs.readFileSync('sync-data/[filename].json'));
  const results = { success: 0, skipped: 0, failed: 0, errors: [] };
  
  for (let i = 0; i < data.length; i++) {
    // Process row
    // Check duplicates
    // Insert if DRY_RUN=false
    // Log progress
  }
  
  return results;
}

sync();
```

---

## 📋 Key Database Tables

**Schemas you'll work with:**

```typescript
// mentors
{
  id: uuid (auto)
  name: varchar (required)
  email: varchar (required, unique)
  phone: varchar
  region: enum (region_type)
  program: enum (program_type)
  status: varchar (default 'active')
}

// entrepreneurs
{
  id: uuid (auto)
  name: varchar (required)
  email: varchar
  business_name: varchar
  phone: varchar
  program: enum (program_type, required)
  batch: varchar
  region: enum (region_type)
  zone: varchar
  state: varchar
  district: varchar
  business_type: varchar
  folder_id: varchar
  status: varchar (default 'active')
}

// mentor_assignments
{
  id: uuid (auto)
  mentor_id: uuid (fk mentors)
  entrepreneur_id: uuid (fk entrepreneurs)
  batch_id: uuid (fk batches)
  status: enum (default 'active')
  assigned_at: timestamp (default now)
}

// sessions
{
  id: uuid (auto)
  mentor_id: uuid (fk mentors)
  entrepreneur_id: uuid (fk entrepreneurs)
  program: enum
  batch_id: uuid (fk batches)
  session_date: date
  session_number: integer
  mod_sesi: varchar
  // ... many more fields
  source: varchar (use 'google_sheets_sync')
}

// reports
{
  id: uuid (auto)
  session_id: uuid (fk sessions)
  mentor_id: uuid (fk mentors)
  entrepreneur_id: uuid (fk entrepreneurs)
  program: enum
  // Many JSONB fields:
  data_kewangan_bulanan: jsonb
  mentoring_findings: jsonb
  jualan_terkini: jsonb
  gw_skor: jsonb
  refleksi: jsonb
  image_urls: jsonb
  // ... many text fields
  source: varchar (use 'google_sheets_sync')
}

// upward_mobility_reports
{
  id: uuid (auto)
  mentor_id: uuid (fk mentors)
  entrepreneur_id: uuid (fk entrepreneurs)
  program: text
  batch: text
  sesi_mentoring: text
  // Many numeric fields:
  pendapatan_sebelum: numeric
  pendapatan_selepas: numeric
  pendapatan_semasa: numeric
  pekerjaan_sebelum: integer
  pekerjaan_selepas: integer
  // ... many more metrics
  // Array fields:
  digital_sebelum: array
  digital_selepas: array
  online_sales_sebelum: array
  online_sales_selepas: array
}
```

---

## 🎯 Success Criteria

After all scripts run:
- [x] ~30 mentors total
- [x] 269 entrepreneurs (200 + 69)
- [x] 273 assignments (204 + 69)
- [x] 133 sessions
- [x] 133 reports
- [x] ~156 UM reports
- [x] All source = 'google_sheets_sync'
- [x] No duplicate records
- [x] sync-errors.json is empty or only has acceptable skips

---

## 📚 Reference Documents

Available in `/home/claude/sync-package/` and `/home/claude/`:
- COMPLETE_MAPPING_FINAL.md - Complete column mappings
- EXACT_COLUMN_MAPPING.md - Detailed field-by-field mappings
- FINAL_SYNC_PLAN.md - Execution strategy and rationale

---

## 🚀 Ready to Code!

Create all 7 scripts following the requirements above.

Focus on:
1. **Correctness** - Map columns correctly
2. **Safety** - DRY_RUN mode, duplicate checking
3. **Robustness** - Error handling, detailed logging
4. **Clarity** - Clean code, good comments

Good luck! 🎯
