# System Audit - April 26

## 1. System Architecture

```text
Frontend pages
  /laporan-bangkit        -> /api/submitBangkit
  /laporan-maju-um        -> /api/submitMajuReportum
  /laporan-sesi           -> /api/submitReport          (legacy Bangkit flow)
  /laporan-maju           -> /api/submitMajuReport      (legacy Maju flow)
  /upward-mobility        -> /api/submit-upward-mobility

Uploads
  frontend -> /api/upload-image -> Google Drive folder from mapping sheet

Write path today
  Current Bangkit/Maju pages -> Supabase + Google Sheets dual write
  Legacy pages / standalone UM -> Google Sheets + Supabase dual write

Read path today
  Mentor-facing dashboards/forms -> mostly Google Sheets
  Admin/report/payment/progress -> mostly Supabase
```

Core integration files:

- [lib/supabaseAdmin.js](./lib/supabaseAdmin.js)
- [lib/supabaseClient.js](./lib/supabaseClient.js)
- [lib/sheets.js](./lib/sheets.js)
- [lib/googleSheets.js](./lib/googleSheets.js)
- [lib/mia.js](./lib/mia.js)

External integrations found in code:

- Google Sheets via `googleapis` in [lib/sheets.js](./lib/sheets.js), [lib/googleSheets.js](./lib/googleSheets.js), and multiple API routes under [pages/api](./pages/api)
- Google Drive uploads in [pages/api/upload-image.js](./pages/api/upload-image.js)
- Google Apps Script / GAS PDF regeneration in [pages/api/admin/reports/[id]/review.js](./pages/api/admin/reports/[id]/review.js)
- Supabase PostgreSQL via [lib/supabaseAdmin.js](./lib/supabaseAdmin.js) and [lib/supabaseClient.js](./lib/supabaseClient.js)

## 2. Submission Flows

### Current Bangkit submission

- Endpoint: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
- Frontend caller: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
- Incoming data includes:
  - `entrepreneur_id`
  - `usahawan`, `namaSyarikat`
  - `mentorEmail`, `emailUsahawan`
  - session fields like `sesiLaporan`, `jenisSesi`, `tarikhSesi`, `fokusSesi`
  - arrays such as `inisiatifGrowthWheel`, `inisiatifPemerkasaan`, `jualanTerkini`
  - `gwScore`, `refleksiMentor`
  - `imageUrls`
  - MIA fields
  - `UPWARD_MOBILITY_JSON`
- Frontend builds the payload in [pages/laporan-bangkit.js](./pages/laporan-bangkit.js) and uploads images first through [pages/api/upload-image.js](./pages/api/upload-image.js).
- Writes:
  - optional insert to `mia_requests` using mapper logic from [lib/mia.js](./lib/mia.js)
  - insert to `reports` in Supabase
  - append to Bangkit Google Sheet
  - optional append to UM Google Sheet
  - optional insert to `upward_mobility_reports`
  - logs to `dual_write_logs` and `dual_write_monitoring`
- Transformations / mapping:
  - sheet row mapper `mapBangkitDataToSheetRow` inside [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
  - entrepreneur resolution order: `entrepreneur_id` -> `emailUsahawan` -> `usahawan`
  - mentor resolution by normalized email
  - JSON / array fields normalized before DB insert
  - payment amount derived from MIA status and visit flag

### Current Maju submission

- Endpoint: [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js)
- Frontend caller: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
- Incoming data includes:
  - `entrepreneur_id`
  - `EMAIL_MENTOR`
  - `NAMA_MENTEE`
  - `emel`
  - business and session fields
  - `Folder_ID`
  - image URL arrays such as `URL_GAMBAR_PREMIS_JSON`, `URL_GAMBAR_SESI_JSON`, `URL_GAMBAR_GW360`
  - `imageUrls.mia`
  - MIA fields
  - `UPWARD_MOBILITY_JSON`
- Frontend builds the payload in [pages/laporan-maju-um.js](./pages/laporan-maju-um.js) and uploads images first through [pages/api/upload-image.js](./pages/api/upload-image.js).
- Writes:
  - append to `LaporanMajuUM` Google Sheet
  - optional append to shared UM Google Sheet
  - non-blocking insert to `reports` in Supabase
  - optional insert to `upward_mobility_reports`
  - optional insert to `mia_requests`
  - logs to `dual_write_monitoring`
- Transformations / mapping:
  - sheet row mapper `mapMajuDataToSheetRow` inside [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js)
  - entrepreneur resolution order: `entrepreneur_id` -> `emel`
  - mentor resolution by `EMAIL_MENTOR`
  - UM payload is normalized and type-converted before insert into `upward_mobility_reports`

### Legacy Bangkit submission

- Endpoint: [pages/api/submitReport.js](./pages/api/submitReport.js)
- Frontend caller: [pages/laporan-sesi.js](./pages/laporan-sesi.js)
- Incoming data: Bangkit session payload
- Writes:
  - append to Bangkit Google Sheet first
  - then non-blocking insert to `reports`
  - logs to `dual_write_monitoring`
- Transformations / mapping:
  - `mapDataToRow` inside [pages/api/submitReport.js](./pages/api/submitReport.js)
  - mentor lookup by email before DB insert

### Legacy Maju submission

- Endpoint: [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
- Frontend caller: [pages/laporan-maju.js](./pages/laporan-maju.js)
- Intended writes:
  - insert to `reports`
  - append to Maju Google Sheet
  - log dual-write status
- Transformations / mapping:
  - `mapMajuDataToSheetRow` inside [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
- Audit note:
  - this file calls `supabase.from(...)` but imports `supabaseAdmin`, not `supabase`
  - based on the file itself, this route appears broken or stale

### Standalone Upward Mobility submission

- Endpoint: [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js)
- Frontend caller: [pages/upward-mobility.js](./pages/upward-mobility.js)
- Incoming data:
  - mentor/mentee metadata
  - `UPWARD_MOBILITY_JSON`
- Writes:
  - append to UM Google Sheet
  - then insert to `upward_mobility_reports`
- Transformations / mapping:
  - parses `UPWARD_MOBILITY_JSON`
  - maps current-state UM fields into legacy sheet columns

### Image upload helper

- Endpoint: [pages/api/upload-image.js](./pages/api/upload-image.js)
- Used by:
  - [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
  - [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
- Incoming data:
  - multipart file upload
  - `folderId`
- Writes:
  - Google Drive only
- Transformation:
  - returns public file links used later in report payloads

## 3. Read Flows

### Mentor dashboard on `/`

- Frontend: [pages/index.js](./pages/index.js)
- Endpoint: [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
- Reads from:
  - Google Sheets `mapping`
  - Google Sheets `Bangkit`
  - Google Sheets `batch`
  - optional Google Sheets `LaporanMajuUM`
- Business logic:
  - maps mentor to mentees by email
  - determines active period from batch data
  - calculates counts per batch
  - merges Bangkit and Maju sessions
  - computes MIA totals and premises visit counts
- This is a dashboard read path driven by Sheets, not Supabase.

### Alternate mentor dashboard

- Frontend: [pages/mentor/dashboard.js](./pages/mentor/dashboard.js)
- Endpoint: [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
- Reads from:
  - Supabase: `users`, `batch_rounds`, `payment_requests`, `reports`
  - Google Sheets: mentor assignment and session history data
- Business logic:
  - sequential-session validation
  - due-date calculation
  - per-mentee session status
  - revision count and payment summaries
- This is a hybrid read endpoint.

### Bangkit form prefill / historical context

- Endpoint: [pages/api/mapping.js](./pages/api/mapping.js)
- Called by: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
- Reads from:
  - Google Sheets mapping sheet
  - additional report sheet range for legacy status context
- Returns:
  - mentor/mentee assignment records
  - entrepreneur metadata such as folder id and emails

- Endpoint: [pages/api/menteeData.js](./pages/api/menteeData.js)
- Called by: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
- Reads from:
  - Google Sheets Bangkit or Maju tabs depending on `programType`
- Business logic:
  - dynamic header mapping
  - sort by latest session
  - parse JSON fields from sheet cells
  - return previous session context such as initiatives, sales, visit data and MIA state

### Maju form prefill / historical context

- Endpoint: [pages/api/mapping.js](./pages/api/mapping.js)
- Called by: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
- Reads from:
  - Google Sheets mapping sheet

- Endpoint: [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
- Called by: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
- Reads from:
  - Google Sheets `LaporanMajuUM`
  - Google Sheets mapping sheet
- Business logic:
  - compute next session number
  - detect MIA state
  - parse previous JSON fields
  - merge in folder id, mentee email, batch and business metadata from mapping

### Revision prefill

- Endpoint: [pages/api/reports/[id].js](./pages/api/reports/[id].js)
- Called by:
  - [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
  - [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
- Reads from:
  - Supabase `reports`
- Purpose:
  - load an existing report for revision editing

### Admin report list

- Endpoint: [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)
- Reads from:
  - Supabase `reports`
  - join to `entrepreneurs`
  - join to `mentors`
- Business logic:
  - status filtering
  - pagination
  - output normalization using fallback fields such as `nama_usahawan || nama_mentee`

### Admin overview stats

- Endpoint: [pages/api/admin/overview-stats.js](./pages/api/admin/overview-stats.js)
- Reads from:
  - Supabase `reports`
  - Supabase `mia_requests`
  - Supabase `payment_batches`
- Business logic:
  - counts pending verification, open MIA, unpaid approved, active payment batches

### Admin progress

- Endpoint: [pages/api/admin/progress.js](./pages/api/admin/progress.js)
- Reads from:
  - Supabase `mentor_assignments`
  - Supabase `batch_rounds`
  - Supabase `reports`
  - Supabase `mentors`
  - Supabase `entrepreneurs`
- Business logic:
  - expected-vs-submitted report matrix
  - mentor / entrepreneur / round grouping
  - missing report detection

### Mentor entrepreneur directory

- Endpoint: [pages/api/getMentorEntrepreneurs.js](./pages/api/getMentorEntrepreneurs.js)
- Reads from:
  - Supabase `mentors`
  - Supabase `mentor_assignments`
  - Supabase `entrepreneurs`
  - Supabase `batches`
  - Supabase `dual_write_monitoring`
- Purpose:
  - fetch mentor-linked entrepreneur records and recent sync state

## 4. Source of Truth

### Clear answer

The system is **hybrid**. There is no single consistent source of truth across all flows.

### Why

Actual writes are inconsistent:

- [pages/api/submitBangkit.js](./pages/api/submitBangkit.js) writes to Supabase `reports` first, then Google Sheets
- [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js) writes to Google Sheets first, then Supabase `reports`
- [pages/api/submitReport.js](./pages/api/submitReport.js) is Google Sheets first
- [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js) is Google Sheets first

Actual reads are also split:

- Mentor dashboards and form-prefill endpoints still read mostly from Google Sheets:
  - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
  - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
  - [pages/api/mapping.js](./pages/api/mapping.js)
  - [pages/api/menteeData.js](./pages/api/menteeData.js)
  - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
- Admin/report/progress/payment endpoints read mostly from Supabase:
  - [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)
  - [pages/api/admin/overview-stats.js](./pages/api/admin/overview-stats.js)
  - [pages/api/admin/progress.js](./pages/api/admin/progress.js)

Operationally, this means:

- Supabase is the effective source of truth for admin workflows
- Google Sheets is still the effective source of truth for much of mentor-facing reporting history and dashboard logic

So the real answer is not “Sheets” or “Supabase” globally. It is a split hybrid architecture with conflicting authorities depending on which screen or endpoint is used.

## 5. Full Lifecycle of One Submission

### Example: current Bangkit flow

#### Frontend

- Page: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
- Reads mapping data from [pages/api/mapping.js](./pages/api/mapping.js)
- Reads prior session context from [pages/api/menteeData.js](./pages/api/menteeData.js)
- Uploads session images to Google Drive through [pages/api/upload-image.js](./pages/api/upload-image.js)
- Builds the final payload with:
  - entrepreneur / mentor identity
  - business and session fields
  - image URLs
  - optional MIA data
  - optional `UPWARD_MOBILITY_JSON`
- Submits to [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)

#### API

- Route: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
- Optional MIA request insert into `mia_requests`
- Resolve `entrepreneur_id` and `mentor_id`
- Insert canonical report row into Supabase `reports`
- Append the report to Bangkit Google Sheet
- Update `reports.sheets_row_number`
- If UM data is present:
  - append to UM Google Sheet
  - insert into `upward_mobility_reports`
- Log sync state

#### Storage

- Google Drive stores uploaded images via [pages/api/upload-image.js](./pages/api/upload-image.js)
- Supabase stores report row in `reports`
- Google Sheets stores appended Bangkit row
- Optional UM data lands in both UM Google Sheet and `upward_mobility_reports`

#### Dashboard read-back

- Home dashboard page: [pages/index.js](./pages/index.js)
- Fetches [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
- That endpoint reads Bangkit data from Google Sheets, not from Supabase

### Lifecycle consequence

One Bangkit submission can be successfully inserted into Supabase but still fail to appear in the mentor dashboard if the Google Sheets append fails, because the dashboard read path is sheet-based.

## 6. Key Problems

- Multiple live submission flows exist for the same domains:
  - current Bangkit: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
  - legacy Bangkit: [pages/api/submitReport.js](./pages/api/submitReport.js)
  - current Maju: [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js)
  - legacy Maju: [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
  - standalone UM: [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js)

- Dashboard reads are inconsistent with the project rule in `AGENTS.md` that says dashboards should not read Google Sheets:
  - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
  - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)

- Form-prefill and historical session logic are still sheet-based, so mentor UX depends on Google Sheets:
  - [pages/api/mapping.js](./pages/api/mapping.js)
  - [pages/api/menteeData.js](./pages/api/menteeData.js)
  - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)

- `lib/sheets.js` always reads from `GOOGLE_SHEETS_REPORT_ID`, regardless of sheet name:
  - [lib/sheets.js](./lib/sheets.js)
- That creates risk for Maju reads if Maju data is actually stored in a different spreadsheet.

- Maju revision sheet sync appears wrong:
  - [pages/api/admin/reports/[id]/revise.js](./pages/api/admin/reports/[id]/revise.js)
- The file detects program context but the sheet update path is still hardcoded to the Bangkit spreadsheet/tab.

- Legacy Maju submit route appears broken:
  - [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
- It references `supabase.from(...)` without importing `supabase`.

- Dual-write logging is duplicated across different tables / patterns:
  - `dual_write_logs`
  - `dual_write_monitoring`
- Different endpoints use different logging conventions, which makes failure analysis harder.

- Data model naming is inconsistent inside `reports`:
  - readers fall back between `nama_usahawan` and `nama_mentee`
  - Bangkit and Maju payloads use different source field names
- Example reader using fallback:
  - [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)

- Some dashboard/monitoring endpoints are not fully backed by live production logic:
  - [pages/api/dashboard/stats.js](./pages/api/dashboard/stats.js)
  - [pages/api/dashboard/system-health.js](./pages/api/dashboard/system-health.js)
  - [pages/api/monitoring/compare-now.js](./pages/api/monitoring/compare-now.js)

## 7. Recommendations

- Pick one runtime source of truth for reports and UM data.
  - Based on the existing admin architecture, Supabase is the practical candidate.
  - Keep Google Sheets as a projection / compatibility layer for legacy workflows and PDF generation until that dependency is removed.

- Standardize submission handlers.
  - Route all Bangkit submissions through one API path.
  - Route all Maju submissions through one API path.
  - Deprecate legacy pages and endpoints once replacement coverage is confirmed.

- Move mentor dashboards and form-prefill reads to Supabase.
  - Priority targets:
    - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
    - [pages/api/mapping.js](./pages/api/mapping.js)
    - [pages/api/menteeData.js](./pages/api/menteeData.js)
    - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)

- Fix the Maju revision sync bug in [pages/api/admin/reports/[id]/revise.js](./pages/api/admin/reports/[id]/revise.js).
  - The route should update the correct spreadsheet and tab based on program.

- Repair or remove [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js).
  - Leaving a referenced but apparently broken endpoint in production code is operational risk.

- Consolidate dual-write observability.
  - Use one logging helper and one monitoring table shape for all submission routes.
  - That will make failures easier to reconcile and backfill.

- Normalize `reports` field conventions.
  - Standardize entrepreneur / mentor naming fields.
  - Keep compatibility mapping at the API boundary rather than in every reader.

- Audit every Google Sheets read that is currently powering runtime UX.
  - The current architecture still has sheet-driven mentor behavior, which means sync failure can cause user-visible divergence even when Supabase write succeeds.
