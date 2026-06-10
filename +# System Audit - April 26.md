 +# System Audit - April 26
      2 +
      3 +## 1. System Architecture
      4 +
      5 +```text
      6 +Frontend pages
      7 +  /laporan-bangkit        -> /api/submitBangkit
      8 +  /laporan-maju-um        -> /api/submitMajuReportum
      9 +  /laporan-sesi           -> /api/submitReport          (legacy Bangkit flow)
     10 +  /laporan-maju           -> /api/submitMajuReport      (legacy Maju flow)
     11 +  /upward-mobility        -> /api/submit-upward-mobility
     12 +
     13 +Uploads
     14 +  frontend -> /api/upload-image -> Google Drive folder from mapping sheet
     15 +
     16 +Write path today
     17 +  Current Bangkit/Maju pages -> Supabase + Google Sheets dual write
     18 +  Legacy pages / standalone UM -> Google Sheets + Supabase dual write
     19 +
     20 +Read path today
     21 +  Mentor-facing dashboards/forms -> mostly Google Sheets
     22 +  Admin/report/payment/progress -> mostly Supabase
     23 +```
     24 +
     25 +Core integration files:
     26 +
     27 +- [lib/supabaseAdmin.js](./lib/supabaseAdmin.js)
     28 +- [lib/supabaseClient.js](./lib/supabaseClient.js)
     29 +- [lib/sheets.js](./lib/sheets.js)
     30 +- [lib/googleSheets.js](./lib/googleSheets.js)
     31 +- [lib/mia.js](./lib/mia.js)
     32 +
     33 +External integrations found in code:
     34 +
     35 +- Google Sheets via `googleapis` in [lib/sheets.js](./lib/sheets.js), [lib/googleSheets.js](./lib/googleSheets.
         js), and multiple API routes under [pages/api](./pages/api)
     36 +- Google Drive uploads in [pages/api/upload-image.js](./pages/api/upload-image.js)
     37 +- Google Apps Script / GAS PDF regeneration in [pages/api/admin/reports/[id]/review.js](./pages/api/admin/repor
         ts/[id]/review.js)
     38 +- Supabase PostgreSQL via [lib/supabaseAdmin.js](./lib/supabaseAdmin.js) and [lib/supabaseClient.js](./lib/supa
         baseClient.js)
     39 +
     40 +## 2. Submission Flows
     41 +
     42 +### Current Bangkit submission
     43 +
     44 +- Endpoint: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
     45 +- Frontend caller: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
     46 +- Incoming data includes:
     47 +  - `entrepreneur_id`
     48 +  - `usahawan`, `namaSyarikat`
     49 +  - `mentorEmail`, `emailUsahawan`
     50 +  - session fields like `sesiLaporan`, `jenisSesi`, `tarikhSesi`, `fokusSesi`
     51 +  - arrays such as `inisiatifGrowthWheel`, `inisiatifPemerkasaan`, `jualanTerkini`
     52 +  - `gwScore`, `refleksiMentor`
     53 +  - `imageUrls`
     54 +  - MIA fields
     55 +  - `UPWARD_MOBILITY_JSON`
     56 +- Frontend builds the payload in [pages/laporan-bangkit.js](./pages/laporan-bangkit.js) and uploads images firs
         t through [pages/api/upload-image.js](./pages/api/upload-image.js).
     57 +- Writes:
     58 +  - optional insert to `mia_requests` using mapper logic from [lib/mia.js](./lib/mia.js)
     59 +  - insert to `reports` in Supabase
     60 +  - append to Bangkit Google Sheet
     61 +  - optional append to UM Google Sheet
     62 +  - optional insert to `upward_mobility_reports`
     63 +  - logs to `dual_write_logs` and `dual_write_monitoring`
     64 +- Transformations / mapping:
     65 +  - sheet row mapper `mapBangkitDataToSheetRow` inside [pages/api/submitBangkit.js](./pages/api/submitBangkit.j
         s)
     66 +  - entrepreneur resolution order: `entrepreneur_id` -> `emailUsahawan` -> `usahawan`
     67 +  - mentor resolution by normalized email
     68 +  - JSON / array fields normalized before DB insert
     69 +  - payment amount derived from MIA status and visit flag
     70 +
     71 +### Current Maju submission
     72 +
     73 +- Endpoint: [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js)
     74 +- Frontend caller: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
     75 +- Incoming data includes:
     76 +  - `entrepreneur_id`
     77 +  - `EMAIL_MENTOR`
     78 +  - `NAMA_MENTEE`
     79 +  - `emel`
     80 +  - business and session fields
     81 +  - `Folder_ID`
     82 +  - image URL arrays such as `URL_GAMBAR_PREMIS_JSON`, `URL_GAMBAR_SESI_JSON`, `URL_GAMBAR_GW360`
     83 +  - `imageUrls.mia`
     84 +  - MIA fields
     85 +  - `UPWARD_MOBILITY_JSON`
     86 +- Frontend builds the payload in [pages/laporan-maju-um.js](./pages/laporan-maju-um.js) and uploads images firs
         t through [pages/api/upload-image.js](./pages/api/upload-image.js).
     87 +- Writes:
     88 +  - append to `LaporanMajuUM` Google Sheet
     89 +  - optional append to shared UM Google Sheet
     90 +  - non-blocking insert to `reports` in Supabase
     91 +  - optional insert to `upward_mobility_reports`
     92 +  - optional insert to `mia_requests`
     93 +  - logs to `dual_write_monitoring`
     94 +- Transformations / mapping:
     95 +  - sheet row mapper `mapMajuDataToSheetRow` inside [pages/api/submitMajuReportum.js](./pages/api/submitMajuRep
         ortum.js)
     96 +  - entrepreneur resolution order: `entrepreneur_id` -> `emel`
     97 +  - mentor resolution by `EMAIL_MENTOR`
     98 +  - UM payload is normalized and type-converted before insert into `upward_mobility_reports`
     99 +
    100 +### Legacy Bangkit submission
    101 +
    102 +- Endpoint: [pages/api/submitReport.js](./pages/api/submitReport.js)
    103 +- Frontend caller: [pages/laporan-sesi.js](./pages/laporan-sesi.js)
    104 +- Incoming data: Bangkit session payload
    105 +- Writes:
    106 +  - append to Bangkit Google Sheet first
    107 +  - then non-blocking insert to `reports`
    108 +  - logs to `dual_write_monitoring`
    109 +- Transformations / mapping:
    110 +  - `mapDataToRow` inside [pages/api/submitReport.js](./pages/api/submitReport.js)
    111 +  - mentor lookup by email before DB insert
    112 +
    113 +### Legacy Maju submission
    114 +
    115 +- Endpoint: [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
    116 +- Frontend caller: [pages/laporan-maju.js](./pages/laporan-maju.js)
    117 +- Intended writes:
    118 +  - insert to `reports`
    119 +  - append to Maju Google Sheet
    120 +  - log dual-write status
    121 +- Transformations / mapping:
    122 +  - `mapMajuDataToSheetRow` inside [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
    123 +- Audit note:
    124 +  - this file calls `supabase.from(...)` but imports `supabaseAdmin`, not `supabase`
    125 +  - based on the file itself, this route appears broken or stale
    126 +
    127 +### Standalone Upward Mobility submission
    128 +
    129 +- Endpoint: [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js)
    130 +- Frontend caller: [pages/upward-mobility.js](./pages/upward-mobility.js)
    131 +- Incoming data:
    132 +  - mentor/mentee metadata
    133 +  - `UPWARD_MOBILITY_JSON`
    134 +- Writes:
    135 +  - append to UM Google Sheet
    136 +  - then insert to `upward_mobility_reports`
    137 +- Transformations / mapping:
    138 +  - parses `UPWARD_MOBILITY_JSON`
    139 +  - maps current-state UM fields into legacy sheet columns
    140 +
    141 +### Image upload helper
    142 +
    143 +- Endpoint: [pages/api/upload-image.js](./pages/api/upload-image.js)
    144 +- Used by:
    145 +  - [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
    146 +  - [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
    147 +- Incoming data:
    148 +  - multipart file upload
    149 +  - `folderId`
    150 +- Writes:
    151 +  - Google Drive only
    152 +- Transformation:
    153 +  - returns public file links used later in report payloads
    154 +
    155 +## 3. Read Flows
    156 +
    157 +### Mentor dashboard on `/`
    158 +
    159 +- Frontend: [pages/index.js](./pages/index.js)
    160 +- Endpoint: [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    161 +- Reads from:
    162 +  - Google Sheets `mapping`
    163 +  - Google Sheets `Bangkit`
    164 +  - Google Sheets `batch`
    165 +  - optional Google Sheets `LaporanMajuUM`
    166 +- Business logic:
    167 +  - maps mentor to mentees by email
    168 +  - determines active period from batch data
    169 +  - calculates counts per batch
    170 +  - merges Bangkit and Maju sessions
    171 +  - computes MIA totals and premises visit counts
    172 +- This is a dashboard read path driven by Sheets, not Supabase.
    173 +
    174 +### Alternate mentor dashboard
    175 +
    176 +- Frontend: [pages/mentor/dashboard.js](./pages/mentor/dashboard.js)
    177 +- Endpoint: [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
    178 +- Reads from:
    179 +  - Supabase: `users`, `batch_rounds`, `payment_requests`, `reports`
    180 +  - Google Sheets: mentor assignment and session history data
    181 +- Business logic:
    182 +  - sequential-session validation
    183 +  - due-date calculation
    184 +  - per-mentee session status
    185 +  - revision count and payment summaries
    186 +- This is a hybrid read endpoint.
    187 +
    188 +### Bangkit form prefill / historical context
    189 +
    190 +- Endpoint: [pages/api/mapping.js](./pages/api/mapping.js)
    191 +- Called by: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
    192 +- Reads from:
    193 +  - Google Sheets mapping sheet
    194 +  - additional report sheet range for legacy status context
    195 +- Returns:
    196 +  - mentor/mentee assignment records
    197 +  - entrepreneur metadata such as folder id and emails
    198 +
    199 +- Endpoint: [pages/api/menteeData.js](./pages/api/menteeData.js)
    200 +- Called by: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
    201 +- Reads from:
    202 +  - Google Sheets Bangkit or Maju tabs depending on `programType`
    203 +- Business logic:
    204 +  - dynamic header mapping
    205 +  - sort by latest session
    206 +  - parse JSON fields from sheet cells
    207 +  - return previous session context such as initiatives, sales, visit data and MIA state
    208 +
    209 +### Maju form prefill / historical context
    210 +
    211 +- Endpoint: [pages/api/mapping.js](./pages/api/mapping.js)
    212 +- Called by: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
    213 +- Reads from:
    214 +  - Google Sheets mapping sheet
    215 +
    216 +- Endpoint: [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
    217 +- Called by: [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
    218 +- Reads from:
    219 +  - Google Sheets `LaporanMajuUM`
    220 +  - Google Sheets mapping sheet
    221 +- Business logic:
    222 +  - compute next session number
    223 +  - detect MIA state
    224 +  - parse previous JSON fields
    225 +  - merge in folder id, mentee email, batch and business metadata from mapping
    226 +
    227 +### Revision prefill
    228 +
    229 +- Endpoint: [pages/api/reports/[id].js](./pages/api/reports/[id].js)
    230 +- Called by:
    231 +  - [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
    232 +  - [pages/laporan-maju-um.js](./pages/laporan-maju-um.js)
    233 +- Reads from:
    234 +  - Supabase `reports`
    235 +- Purpose:
    236 +  - load an existing report for revision editing
    237 +
    238 +### Admin report list
    239 +
    240 +- Endpoint: [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)
    241 +- Reads from:
    242 +  - Supabase `reports`
    243 +  - join to `entrepreneurs`
    244 +  - join to `mentors`
    245 +- Business logic:
    246 +  - status filtering
    247 +  - pagination
    248 +  - output normalization using fallback fields such as `nama_usahawan || nama_mentee`
    249 +
    250 +### Admin overview stats
    251 +
    252 +- Endpoint: [pages/api/admin/overview-stats.js](./pages/api/admin/overview-stats.js)
    253 +- Reads from:
    254 +  - Supabase `reports`
    255 +  - Supabase `mia_requests`
    256 +  - Supabase `payment_batches`
    257 +- Business logic:
    258 +  - counts pending verification, open MIA, unpaid approved, active payment batches
    259 +
    260 +### Admin progress
    261 +
    262 +- Endpoint: [pages/api/admin/progress.js](./pages/api/admin/progress.js)
    263 +- Reads from:
    264 +  - Supabase `mentor_assignments`
    265 +  - Supabase `batch_rounds`
    266 +  - Supabase `reports`
    267 +  - Supabase `mentors`
    268 +  - Supabase `entrepreneurs`
    269 +- Business logic:
    270 +  - expected-vs-submitted report matrix
    271 +  - mentor / entrepreneur / round grouping
    272 +  - missing report detection
    273 +
    274 +### Mentor entrepreneur directory
    275 +
    276 +- Endpoint: [pages/api/getMentorEntrepreneurs.js](./pages/api/getMentorEntrepreneurs.js)
    277 +- Reads from:
    278 +  - Supabase `mentors`
    279 +  - Supabase `mentor_assignments`
    280 +  - Supabase `entrepreneurs`
    281 +  - Supabase `batches`
    282 +  - Supabase `dual_write_monitoring`
    283 +- Purpose:
    284 +  - fetch mentor-linked entrepreneur records and recent sync state
    285 +
    286 +## 4. Source of Truth
    287 +
    288 +### Clear answer
    289 +
    290 +The system is **hybrid**. There is no single consistent source of truth across all flows.
    291 +
    292 +### Why
    293 +
    294 +Actual writes are inconsistent:
    295 +
    296 +- [pages/api/submitBangkit.js](./pages/api/submitBangkit.js) writes to Supabase `reports` first, then Google Sh
         eets
    297 +- [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js) writes to Google Sheets first, then Supa
         base `reports`
    298 +- [pages/api/submitReport.js](./pages/api/submitReport.js) is Google Sheets first
    299 +- [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js) is Google Sheets first
    300 +
    301 +Actual reads are also split:
    302 +
    303 +- Mentor dashboards and form-prefill endpoints still read mostly from Google Sheets:
    304 +  - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    305 +  - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
    306 +  - [pages/api/mapping.js](./pages/api/mapping.js)
    307 +  - [pages/api/menteeData.js](./pages/api/menteeData.js)
    308 +  - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
    309 +- Admin/report/progress/payment endpoints read mostly from Supabase:
    310 +  - [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)
    311 +  - [pages/api/admin/overview-stats.js](./pages/api/admin/overview-stats.js)
    312 +  - [pages/api/admin/progress.js](./pages/api/admin/progress.js)
    313 +
    314 +Operationally, this means:
    315 +
    316 +- Supabase is the effective source of truth for admin workflows
    317 +- Google Sheets is still the effective source of truth for much of mentor-facing reporting history and dashboar
         d logic
    318 +
    319 +So the real answer is not “Sheets” or “Supabase” globally. It is a split hybrid architecture with conflicting a
         uthorities depending on which screen or endpoint is used.
    320 +
    321 +## 5. Full Lifecycle of One Submission
    322 +
    323 +### Example: current Bangkit flow
    324 +
    325 +#### Frontend
    326 +
    327 +- Page: [pages/laporan-bangkit.js](./pages/laporan-bangkit.js)
    328 +- Reads mapping data from [pages/api/mapping.js](./pages/api/mapping.js)
    329 +- Reads prior session context from [pages/api/menteeData.js](./pages/api/menteeData.js)
    330 +- Uploads session images to Google Drive through [pages/api/upload-image.js](./pages/api/upload-image.js)
    331 +- Builds the final payload with:
    332 +  - entrepreneur / mentor identity
    333 +  - business and session fields
    334 +  - image URLs
    335 +  - optional MIA data
    336 +  - optional `UPWARD_MOBILITY_JSON`
    337 +- Submits to [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
    338 +
    339 +#### API
    340 +
    341 +- Route: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
    342 +- Optional MIA request insert into `mia_requests`
    343 +- Resolve `entrepreneur_id` and `mentor_id`
    344 +- Insert canonical report row into Supabase `reports`
    345 +- Append the report to Bangkit Google Sheet
    346 +- Update `reports.sheets_row_number`
    347 +- If UM data is present:
    348 +  - append to UM Google Sheet
    349 +  - insert into `upward_mobility_reports`
    350 +- Log sync state
    351 +
    352 +#### Storage
    353 +
    354 +- Google Drive stores uploaded images via [pages/api/upload-image.js](./pages/api/upload-image.js)
    355 +- Supabase stores report row in `reports`
    356 +- Google Sheets stores appended Bangkit row
    357 +- Optional UM data lands in both UM Google Sheet and `upward_mobility_reports`
    358 +
    359 +#### Dashboard read-back
    360 +
    361 +- Home dashboard page: [pages/index.js](./pages/index.js)
    362 +- Fetches [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    363 +- That endpoint reads Bangkit data from Google Sheets, not from Supabase
    364 +
    365 +### Lifecycle consequence
    366 +
    367 +One Bangkit submission can be successfully inserted into Supabase but still fail to appear in the mentor dashbo
         ard if the Google Sheets append fails, because the dashboard read path is sheet-based.
    368 +
    369 +## 6. Key Problems
    370 +
    371 +- Multiple live submission flows exist for the same domains:
    372 +  - current Bangkit: [pages/api/submitBangkit.js](./pages/api/submitBangkit.js)
    373 +  - legacy Bangkit: [pages/api/submitReport.js](./pages/api/submitReport.js)
    374 +  - current Maju: [pages/api/submitMajuReportum.js](./pages/api/submitMajuReportum.js)
    375 +  - legacy Maju: [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
    376 +  - standalone UM: [pages/api/submit-upward-mobility.js](./pages/api/submit-upward-mobility.js)
    377 +
    378 +- Dashboard reads are inconsistent with the project rule in `AGENTS.md` that says dashboards should not read Go
         ogle Sheets:
    379 +  - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    380 +  - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
    381 +
    382 +- Form-prefill and historical session logic are still sheet-based, so mentor UX depends on Google Sheets:
    383 +  - [pages/api/mapping.js](./pages/api/mapping.js)
    384 +  - [pages/api/menteeData.js](./pages/api/menteeData.js)
    385 +  - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
    386 +
    387 +- `lib/sheets.js` always reads from `GOOGLE_SHEETS_REPORT_ID`, regardless of sheet name:
    388 +  - [lib/sheets.js](./lib/sheets.js)
    389 +- That creates risk for Maju reads if Maju data is actually stored in a different spreadsheet.
    390 +
    391 +- Maju revision sheet sync appears wrong:
    392 +  - [pages/api/admin/reports/[id]/revise.js](./pages/api/admin/reports/[id]/revise.js)
    393 +- The file detects program context but the sheet update path is still hardcoded to the Bangkit spreadsheet/tab.
    394 +
    395 +- Legacy Maju submit route appears broken:
    396 +  - [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js)
    397 +- It references `supabase.from(...)` without importing `supabase`.
    398 +
    399 +- Dual-write logging is duplicated across different tables / patterns:
    400 +  - `dual_write_logs`
    401 +  - `dual_write_monitoring`
    402 +- Different endpoints use different logging conventions, which makes failure analysis harder.
    403 +
    404 +- Data model naming is inconsistent inside `reports`:
    405 +  - readers fall back between `nama_usahawan` and `nama_mentee`
    406 +  - Bangkit and Maju payloads use different source field names
    407 +- Example reader using fallback:
    408 +  - [pages/api/admin/reports/index.js](./pages/api/admin/reports/index.js)
    409 +
    410 +- Some dashboard/monitoring endpoints are not fully backed by live production logic:
    411 +  - [pages/api/dashboard/stats.js](./pages/api/dashboard/stats.js)
    412 +  - [pages/api/dashboard/system-health.js](./pages/api/dashboard/system-health.js)
    413 +  - [pages/api/monitoring/compare-now.js](./pages/api/monitoring/compare-now.js)
    414 +
    415 +## 7. Recommendations
    416 +
    417 +- Pick one runtime source of truth for reports and UM data.
    418 +  - Based on the existing admin architecture, Supabase is the practical candidate.
    419 +  - Keep Google Sheets as a projection / compatibility layer for legacy workflows and PDF generation until that
          dependency is removed.
    420 +
    421 +- Standardize submission handlers.
    422 +  - Route all Bangkit submissions through one API path.
    423 +  - Route all Maju submissions through one API path.
    424 +  - Deprecate legacy pages and endpoints once replacement coverage is confirmed.
    425 +
    426 +- Move mentor dashboards and form-prefill reads to Supabase.
    427 +  - Priority targets:
    428 +    - [pages/api/mentor-stats.js](./pages/api/mentor-stats.js)
    429 +    - [pages/api/mentor/my-dashboard.js](./pages/api/mentor/my-dashboard.js)
    430 +    - [pages/api/mapping.js](./pages/api/mapping.js)
    431 +    - [pages/api/menteeData.js](./pages/api/menteeData.js)
    432 +    - [pages/api/laporanMajuData.js](./pages/api/laporanMajuData.js)
    433 +
    434 +- Fix the Maju revision sync bug in [pages/api/admin/reports/[id]/revise.js](./pages/api/admin/reports/[id]/rev
         ise.js).
    435 +  - The route should update the correct spreadsheet and tab based on program.
    436 +
    437 +- Repair or remove [pages/api/submitMajuReport.js](./pages/api/submitMajuReport.js).
    438 +  - Leaving a referenced but apparently broken endpoint in production code is operational risk.
    439 +
    440 +- Consolidate dual-write observability.
    441 +  - Use one logging helper and one monitoring table shape for all submission routes.
    442 +  - That will make failures easier to reconcile and backfill.
    443 +
    444 +- Normalize `reports` field conventions.
    445 +  - Standardize entrepreneur / mentor naming fields.
    446 +  - Keep compatibility mapping at the API boundary rather than in every reader.
    447 +
    448 +- Audit every Google Sheets read that is currently powering runtime UX.
    449 +  - The current architecture still has sheet-driven mentor behavior, which means sync failure can cause user-vi
         sible divergence even when Supabase write succeeds.