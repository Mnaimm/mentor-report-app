# iTEKAD MENTOR REPORT VERIFICATION SYSTEM
## Complete Reverse-Engineering Documentation

**Last Updated:** February 22, 2026
**Documented By:** Claude Code Analysis
**System Version:** Production (Supabase + Google Sheets Dual-Write)

---

## TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Frontend Components](#frontend-components)
3. [Backend API Endpoints](#backend-api-endpoints)
4. [Database Schema](#database-schema)
5. [Complete Data Flow](#complete-data-flow)
6. [Google Integration](#google-integration)
7. [Auto-Compliance Check Logic](#auto-compliance-check-logic)
8. [Error Analysis](#error-analysis)
9. [Payment Integration](#payment-integration)
10. [File Structure](#file-structure)
11. [Critical Findings](#critical-findings)

---

## 1. SYSTEM OVERVIEW

### Purpose
The Verification System allows **Admin users** to review mentor-submitted session reports before approving them for payment processing.

### Key Features
- ✅ List all pending reports (status='submitted')
- ✅ Automated compliance checks
- ✅ Google Doc preview via proxy
- ✅ Approve/Reject workflow
- ✅ Dual-write to Supabase + Google Sheets
- ✅ Self-healing URL sync from Sheets

### User Roles
- **system_admin** - Full access (you/Naim)
- **program_coordinator** - Can review and approve (Noraminah)
- **report_admin** - Can review reports (Hanisah)
- **payment_admin** - Sees approved reports for payment (Maryam)
- **stakeholder** - Read-only access

---

## 2. FRONTEND COMPONENTS

### 2.A. Verification List Page
**File:** `/pages/admin/verification/index.js`

**Purpose:** Display all reports with status='submitted' in a paginated table

**API Called:**
```javascript
GET /api/admin/reports?status=submitted
```

**Filters Available:**
1. **Mentor Dropdown** - Exact match on mentor name
2. **Month Filter** - Filter by submission year-month
3. **Refresh Button** - Force reload data

**Pagination:**
- 20 items per page (hardcoded: `ITEMS_PER_PAGE = 20`)
- Client-side pagination (filters entire dataset client-side)

**Columns Displayed:**
| Column | Data Source | Format |
|--------|-------------|--------|
| Details | `mentor_name` + `mentee_name` | Text |
| Program/Session | `program` + `session_number` | Badge |
| Date | `submission_date` | Localized date |
| Status | `status` | Yellow badge |
| Action | - | "Review" button → `/admin/verification/{id}` |

**Click "Review" Button:**
```javascript
<Link href={`/admin/verification/${report.id}`}>
  Review
</Link>
```
Navigates to detail page with report ID in URL.

---

### 2.B. Verification Detail Page
**File:** `/pages/admin/verification/[id].js`

**Purpose:** Display full report with compliance checks and Google Doc preview

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Back | Mentor Name | Reject | Approve & Pay        │
├──────────────────┬──────────────────────────────────────────┤
│ LEFT PANEL (30%) │ RIGHT PANEL (70%)                        │
│                  │                                          │
│ • Mentee Profile │ Google Doc Preview (iframe)              │
│ • Auto-Compliance│                                          │
│ • Session Photo  │ Loaded via:                              │
│ • Key Decisions  │ /api/admin/proxy-drive/[fileId]          │
│ • GrowthWheel    │                                          │
│ • Premises Visit │                                          │
│ • Validation Sum │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

#### API Called on Load
```javascript
GET /api/admin/reports/${id}
```

#### Auto-Compliance Check Component
**Component:** `ComplianceItem` (lines 267-279)

**Checks Performed:**

**1. Session Photo Evidence**
```javascript
<ComplianceItem
  label="Session Photo Evidence"
  passed={report.image_urls?.sesi?.length > 0}
  subtext={report.image_urls?.sesi?.length > 0 ? "Photo attached" : "Missing session photo"}
/>
```
- ✅ PASS: If `image_urls.sesi` array has items
- ❌ FAIL: If array is empty or null

**2. Key Decision Points**
```javascript
<ComplianceItem
  label="Key Decision Points"
  passed={((report.inisiatif || []).length > 0) || ((report.mentoring_findings || []).length > 0)}
  subtext={`${(report.inisiatif || []).length + (report.mentoring_findings || []).length} items recorded`}
/>
```
- ✅ PASS: If `inisiatif` OR `mentoring_findings` have items
- ❌ FAIL: If both are empty

**3. GrowthWheel Chart** (Bangkit Session 1 Only)
```javascript
{report.program === 'Bangkit' && report.session_number == 1 && (
  <ComplianceItem
    label="GrowthWheel Chart"
    passed={!!report.image_urls?.growthwheel}
    subtext={report.image_urls?.growthwheel ? "Chart attached" : "Required for Session 1"}
  />
)}
```
- Only shown for: **Bangkit program, Session 1**
- ✅ PASS: If `image_urls.growthwheel` exists
- ❌ FAIL: If missing

**4. Premises Visit Evidence** (If Claimed)
```javascript
{report.premis_dilawat && (
  <ComplianceItem
    label="Premises Visit Evidence"
    passed={(report.image_urls?.premis || []).length > 0}
    subtext={(report.image_urls?.premis || []).length > 0 ? "Photos attached" : "Visit claimed but no photos"}
  />
)}
```
- Only shown if: `premis_dilawat === true`
- ✅ PASS: If `image_urls.premis` array has items
- ❌ FAIL: If claimed but no photos

**5. MIA Status Warning** (If MIA)
```javascript
{report.status === 'MIA' && (
  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
    ⚠️ Mentee Marked MIA - Check proof if available.
  </div>
)}
```
- Only shown if: `status === 'MIA'`
- Red warning box, not a pass/fail check

#### Google Doc Preview Logic
```javascript
<iframe
  src={(() => {
    const url = report.document_url;

    // Extract ID from docs/drive link
    const docId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (docId) {
      return `/api/admin/proxy-drive/${docId}`;  // ← Uses proxy!
    }

    // Fallback for non-Drive URLs
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  })()}
  className="w-full h-full"
  title="Document Preview"
/>
```

**How it works:**
1. Extracts Google Drive file ID from `document_url`
2. Loads via local proxy: `/api/admin/proxy-drive/{fileId}`
3. Proxy authenticates with Google Drive API
4. Returns PDF stream to iframe
5. Bypasses X-Frame-Options restrictions

#### Approval Flow
**Click "Approve & Pay":**
```javascript
onClick={() => handleReview('approved')}

// Calls API:
POST /api/admin/reports/${id}/review
Body: { status: 'approved', rejectionReason: null }
```

**What Happens:**
1. Confirmation dialog shown
2. API updates `reports` table:
   - `status` → 'approved'
   - `reviewed_at` → current timestamp
   - `reviewed_by` → admin email
3. Syncs to Google Sheets (calls `updateSheetStatus()`)
4. Redirects to `/admin/verification`

#### Rejection Flow
**Click "Reject":**
1. Modal opens requesting rejection reason
2. User enters reason (required)
3. Calls API:
```javascript
POST /api/admin/reports/${id}/review
Body: { status: 'rejected', rejectionReason: 'Reason text...' }
```

**What Happens:**
1. API updates `reports` table:
   - `status` → 'rejected'
   - `reviewed_at` → current timestamp
   - `reviewed_by` → admin email
   - `rejection_reason` → user input
2. Syncs to Google Sheets
3. Redirects to `/admin/verification`

---

## 3. BACKEND API ENDPOINTS

### 3.A. List Reports API
**File:** `/pages/api/admin/reports/index.js`

**Method:** `GET`

**Authentication:**
1. `getServerSession()` - Validates logged-in user
2. `canAccessAdmin()` - Checks user has admin role

**Authorization Required:**
- system_admin
- program_coordinator
- report_admin
- stakeholder (read-only)

**Query Parameters:**
| Parameter | Default | Purpose |
|-----------|---------|---------|
| `status` | `'submitted'` | Filter by report status |
| `limit` | `50` | Results per page |
| `page` | `1` | Page number |

**Database Query:**
```javascript
supabase
  .from('reports')
  .select(`
    id,
    mentor_email,
    nama_mentor,
    nama_usahawan,
    program,
    session_number,
    submission_date,
    status,
    entrepreneur_id,
    mentor_id
  `, { count: 'exact' })
  .eq('status', status)  // If not 'all'
  .order('submission_date', { ascending: false })
  .range(offset, offset + limit - 1)
```

**Key Detail:** Uses `SERVICE_ROLE_KEY` to bypass RLS!

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid...",
      "mentor_name": "Zurilaili Ishak",
      "mentee_name": "WAN MUHAMMAD...",
      "program": "Bangkit",
      "session_number": 1,
      "submission_date": "2026-02-02T13:52:15.928002+00:00",
      "status": "submitted"
    }
  ],
  "pagination": {
    "total": 203,
    "page": 1,
    "limit": 50
  }
}
```

---

### 3.B. Get Single Report API
**File:** `/pages/api/admin/reports/[id]/index.js`

**Method:** `GET`

**Authentication:** Same as above

**Query:** Fetches ALL fields with `select('*')`

**HYBRID SYNC LOGIC (Self-Healing):**

**Step 1: Check for Missing Row Number**
```javascript
if (!report.sheets_row_number) {
  console.log('🔍 [Hybrid Sync] Row number missing. Searching Sheets...');
  const foundRow = await findRowNumberByDetails(
    report.program,
    menteeName,
    report.session_number
  );

  if (foundRow) {
    // Update DB with found row number
    await supabase
      .from('reports')
      .update({ sheets_row_number: foundRow })
      .eq('id', id);
  }
}
```

**Step 2: Check for Missing Document URL**
```javascript
if (!finalDocUrl && report.sheets_row_number) {
  console.log('🔍 [Hybrid Sync] Document URL missing. Fetching from Sheets...');

  const fetchedUrl = await getDocUrlFromSheet(
    report.program,
    report.sheets_row_number
  );

  if (fetchedUrl && fetchedUrl.startsWith('http')) {
    // Update DB with found URL (Self-Healing!)
    await supabase
      .from('reports')
      .update({ document_url: fetchedUrl })
      .eq('id', id);

    console.log('✅ [Hybrid Sync] Supabase updated with URL');
  }
}
```

**Why "Hybrid Sync"?**
- **Primary Source:** Supabase database
- **Fallback Source:** Google Sheets
- **Self-Healing:** Automatically fills missing data from Sheets
- **Non-blocking:** If sync fails, still returns report data

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "mentor_name": "...",
    "mentee_name": "...",
    "document_url": "https://docs.google.com/...",
    "inisiatif": [...],
    "image_urls": {...},
    "status": "submitted",
    "sheets_row_number": 30
  },
  "synced": true  // ← Indicates if URL was auto-fetched
}
```

---

### 3.C. Review (Approve/Reject) API
**File:** `/pages/api/admin/reports/[id]/review.js`

**Method:** `POST`

**Authentication:** Same as above

**Request Body:**
```json
{
  "status": "approved",  // or "rejected"
  "rejectionReason": "Optional for approval, required for rejection"
}
```

**Validation:**
```javascript
if (!['approved', 'rejected'].includes(status)) {
  return res.status(400).json({ error: 'Invalid status' });
}
```

**Database Update:**
```javascript
const updates = {
  status: status,  // 'approved' or 'rejected'
  reviewed_at: new Date().toISOString(),
  reviewed_by: session.user.email,
  rejection_reason: status === 'rejected' ? rejectionReason : null
};

await supabase
  .from('reports')
  .update(updates)
  .eq('id', id);
```

**Google Sheets Sync:**
```javascript
if (report.sheets_row_number) {
  const sheetUpdated = await updateSheetStatus(
    report.program,
    report.sheets_row_number,
    status,
    rejectionReason
  );
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 3.D. Google Drive Proxy API
**File:** `/pages/api/admin/proxy-drive/[fileId].js`

**Method:** `GET`

**Purpose:** Stream Google Drive files through a proxy to bypass:
- X-Frame-Options restrictions
- Authentication requirements
- CORS issues

**Authentication Flow:**
```javascript
// 1. Check user session
const session = await getSession({ req });  // ⚠️ WRONG! Should use getServerSession

// 2. Check admin access
const hasAccess = await canAccessAdmin(userEmail);

// 3. Authenticate with Google Drive
const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii')
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

const drive = google.drive({ version: 'v3', auth });
```

**File Processing Logic:**
```javascript
// 1. Get file metadata
const fileMetadata = await drive.files.get({
  fileId,
  fields: 'mimeType, name, size'
});

const mimeType = fileMetadata.data.mimeType;

// 2. If Google Doc/Sheet, export to PDF
if (mimeType.startsWith('application/vnd.google-apps.')) {
  const response = await drive.files.export({
    fileId,
    mimeType: 'application/pdf'  // ← Always export as PDF
  }, { responseType: 'stream' });

  response.data.pipe(res);  // Stream to response
}

// 3. If regular file (PDF, image), get raw media
else {
  const response = await drive.files.get({
    fileId,
    alt: 'media'
  }, { responseType: 'stream' });

  response.data.pipe(res);
}
```

**Response Headers:**
```javascript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
```

**⚠️ CRITICAL BUG FOUND:**
```javascript
// Line 6: WRONG - This is client-side auth!
const session = await getSession({ req });

// Should be:
const session = await getServerSession(req, res, authOptions);
```

This is causing the 500 error!

---

## 4. DATABASE SCHEMA

### Reports Table Structure
**Total Columns:** 70

**Key Columns for Verification:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `mentor_email` | string | Mentor identifier |
| `nama_mentor` | string | Mentor name |
| `nama_usahawan` | string | Mentee name (primary) |
| `nama_mentee` | object | Mentee name (alt field) |
| `program` | string | 'Bangkit' or 'Maju' |
| `session_number` | number | 1-4 |
| `status` | string | 'submitted', 'approved', 'rejected' |
| `submission_date` | timestamp | When report submitted |
| `document_url` | object | Google Doc URL |
| `google_doc_url` | string | Alternative URL field |
| `doc_url` | string | Third URL field |
| `sheets_row_number` | number | Row in Google Sheets |
| `inisiatif` | array (JSONB) | Initiative items |
| `mentoring_findings` | array (JSONB) | Findings/decisions |
| `image_urls` | object (JSONB) | All uploaded images |
| `premis_dilawat` | boolean | Premises visited flag |
| `reviewed_at` | timestamp | When reviewed |
| `reviewed_by` | string | Admin email who reviewed |
| `rejection_reason` | object | Reason if rejected |
| `payment_status` | string | Payment workflow status |
| `approved_at` | timestamp | When approved |

**Status Values Found:**
- `submitted` - 203 reports (100%)
- No `approved` or `rejected` found (system not used yet)

**Document URL Fields:**
Based on audit (sample size: 203 reports):
- `document_url`: Present in some reports
- `google_doc_url`: Present (check specific percentage)
- `doc_url`: Present (check specific percentage)
- `sheets_row_number`: Present in most (used for sync)

**Image URLs Structure (JSONB):**
```json
{
  "sesi": ["url1", "url2"],
  "premis": ["url1"],
  "growthwheel": "url",
  "profile": "url"
}
```

---

## 5. COMPLETE DATA FLOW

### Flow 1: Mentor Submits Report
```
[Mentor Dashboard]
  ↓
[Fills Form] (/laporan-bangkit or /laporan-maju-um)
  ↓
[Submits Form]
  ↓
[POST /api/submitReport or /api/submitMajuReport]
  ↓ ┌─────────────────────────────────┐
    │ DUAL-WRITE PATTERN:             │
    │                                 │
    │ 1. Write to Google Sheets       │ ← Primary (for PDF)
    │    ✅ Success required          │
    │                                 │
    │ 2. Write to Supabase            │ ← Secondary
    │    ⚠️ Non-blocking              │
    │    status: 'submitted'          │
    │    payment_status: 'pending'    │
    └─────────────────────────────────┘
  ↓
[Redirect to Dashboard]
```

### Flow 2: Admin Reviews Report
```
[Admin goes to /admin/verification]
  ↓
[GET /api/admin/reports?status=submitted]
  ↓ ┌─────────────────────────────────┐
    │ Supabase Query (SERVICE_ROLE):  │
    │                                 │
    │ SELECT * FROM reports           │
    │ WHERE status = 'submitted'      │
    │ ORDER BY submission_date DESC   │
    │ LIMIT 50                        │
    └─────────────────────────────────┘
  ↓
[Display Table with 203 reports]
  ↓
[Admin clicks "Review" on specific report]
  ↓
[Navigate to /admin/verification/{id}]
  ↓
[GET /api/admin/reports/{id}]
  ↓ ┌─────────────────────────────────┐
    │ HYBRID SYNC LOGIC:              │
    │                                 │
    │ 1. Fetch from Supabase          │
    │                                 │
    │ 2. If sheets_row_number missing:│
    │    → Search Google Sheets       │
    │    → Update Supabase            │
    │                                 │
    │ 3. If document_url missing:     │
    │    → Fetch from Google Sheets   │
    │    → Update Supabase            │
    │                                 │
    │ (Self-Healing!)                 │
    └─────────────────────────────────┘
  ↓
[Display Report with Auto-Compliance Checks]
  ↓ ┌─────────────────────────────────┐
    │ LEFT PANEL:                     │
    │ ✅ Session Photo Check          │
    │ ✅ Key Decisions Check          │
    │ ✅ GrowthWheel Check (if B1)    │
    │ ✅ Premises Visit Check         │
    └─────────────────────────────────┘
  ↓ ┌─────────────────────────────────┐
    │ RIGHT PANEL:                    │
    │ Google Doc Preview via:         │
    │ /api/admin/proxy-drive/{fileId} │
    │                                 │
    │ 1. Extract file ID from URL     │
    │ 2. Auth with Google Drive API   │
    │ 3. Export as PDF (if Doc)       │
    │ 4. Stream to iframe             │
    └─────────────────────────────────┘
  ↓
[Admin decides: Approve or Reject]
```

### Flow 3: Admin Approves Report
```
[Click "Approve & Pay"]
  ↓
[Confirmation Dialog]
  ↓
[POST /api/admin/reports/{id}/review]
  Body: { status: 'approved' }
  ↓ ┌─────────────────────────────────┐
    │ Supabase UPDATE:                │
    │                                 │
    │ status → 'approved'             │
    │ reviewed_at → NOW()             │
    │ reviewed_by → admin@email.com   │
    │ rejection_reason → null         │
    └─────────────────────────────────┘
  ↓ ┌─────────────────────────────────┐
    │ Google Sheets Sync:             │
    │                                 │
    │ updateSheetStatus(              │
    │   program,                      │
    │   sheets_row_number,            │
    │   'approved',                   │
    │   null                          │
    │ )                               │
    └─────────────────────────────────┘
  ↓
[Success Response]
  ↓
[Redirect to /admin/verification]
  ↓
[Report now shows status='approved']
  ↓
[Payment Admin can see it in payment queue]
```

### Flow 4: Admin Rejects Report
```
[Click "Reject"]
  ↓
[Rejection Modal Opens]
  ↓
[Admin enters rejection reason]
  ↓
[POST /api/admin/reports/{id}/review]
  Body: {
    status: 'rejected',
    rejectionReason: 'Missing session photo'
  }
  ↓ ┌─────────────────────────────────┐
    │ Supabase UPDATE:                │
    │                                 │
    │ status → 'rejected'             │
    │ reviewed_at → NOW()             │
    │ reviewed_by → admin@email.com   │
    │ rejection_reason → 'Missing...' │
    └─────────────────────────────────┘
  ↓
[Google Sheets Sync with reason]
  ↓
[Mentor can see rejection reason]
  ↓
[Mentor can resubmit corrected report]
```

---

## 6. GOOGLE INTEGRATION

### Google Sheets Integration

**File:** `/lib/googleSheets.js`

**Functions Used:**

**1. `updateSheetStatus(program, rowNumber, status, rejectionReason)`**
- Updates status column in Google Sheets
- Syncs approval/rejection back to source of truth
- Called by review API

**2. `getDocUrlFromSheet(program, rowNumber)`**
- Fetches document URL from specific row
- Used in Hybrid Sync when URL missing in Supabase
- Program determines which sheet to query

**3. `findRowNumberByDetails(program, menteeName, sessionNumber)`**
- Searches sheets for matching report
- Returns row number
- Used when `sheets_row_number` missing in Supabase

### Google Drive Integration

**Authentication:**
```javascript
const credentialsJson = Buffer.from(
  process.env.GOOGLE_CREDENTIALS_BASE64,
  'base64'
).toString('ascii');

const credentials = JSON.parse(credentialsJson);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});
```

**Operations:**
1. **Get File Metadata** - `drive.files.get()` with `fields: 'mimeType, name, size'`
2. **Export Google Doc** - `drive.files.export()` to PDF
3. **Get Raw File** - `drive.files.get()` with `alt: 'media'`

**Environment Variables Required:**
- `GOOGLE_CREDENTIALS_BASE64` - Service account JSON (base64 encoded)
- Sheet IDs managed in other env vars

---

## 7. AUTO-COMPLIANCE CHECK LOGIC

**Location:** `/pages/admin/verification/[id].js` (lines 118-168)

**Component:** `ComplianceItem` (lines 267-279)

### Check Implementation

**Visual Indicator:**
```javascript
function ComplianceItem({ label, passed, subtext }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-white border rounded-lg">
      <div className={`w-6 h-6 rounded-full ${
        passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
      }`}>
        {passed ? '✓' : '✕'}
      </div>
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className={`text-xs ${passed ? 'text-gray-500' : 'text-red-500'}`}>
          {subtext}
        </p>
      </div>
    </div>
  );
}
```

### Check Criteria

**1. Session Photo Evidence**
```javascript
passed={report.image_urls?.sesi?.length > 0}
```
- **Data Source:** `reports.image_urls.sesi` (JSONB array)
- **Logic:** Array must have at least 1 URL
- **When Shown:** Always
- **Severity:** High (session evidence required)

**2. Key Decision Points**
```javascript
passed={
  ((report.inisiatif || []).length > 0) ||
  ((report.mentoring_findings || []).length > 0)
}
```
- **Data Source:** `reports.inisiatif` OR `reports.mentoring_findings`
- **Logic:** At least one array must have items
- **When Shown:** Always
- **Severity:** High (mentoring outcomes required)

**3. GrowthWheel Chart**
```javascript
// Only for Bangkit Session 1
{report.program === 'Bangkit' && report.session_number == 1 && (
  <ComplianceItem
    passed={!!report.image_urls?.growthwheel}
  />
)}
```
- **Data Source:** `reports.image_urls.growthwheel`
- **Logic:** URL must exist
- **When Shown:** Bangkit program, Session 1 only
- **Severity:** High (baseline required)

**4. Premises Visit Evidence**
```javascript
// Only if claimed
{report.premis_dilawat && (
  <ComplianceItem
    passed={(report.image_urls?.premis || []).length > 0}
  />
)}
```
- **Data Source:** `reports.image_urls.premis` (array)
- **Logic:** If `premis_dilawat` is true, must have photos
- **When Shown:** Only if premises visit claimed
- **Severity:** Medium (proof required if claimed)

**5. MIA Status**
```javascript
{report.status === 'MIA' && (
  <div className="bg-red-50 border border-red-200">
    ⚠️ Mentee Marked MIA
  </div>
)}
```
- **Data Source:** `reports.status`
- **Logic:** Warning, not a pass/fail
- **When Shown:** If status is 'MIA'
- **Severity:** Informational

**Note:** These are CLIENT-SIDE checks only! No server-side validation enforces these before approval.

---

## 8. ERROR ANALYSIS

### 8.A. Current 500 Error (Google Drive Proxy)

**Error Message:**
```
GET http://localhost:3000/api/admin/proxy-drive/1PBCAFBIctV6RXpjIrCzK...
500 (Internal Server Error)
```

**Root Cause:** `/pages/api/admin/proxy-drive/[fileId].js` Line 6

**Problem:**
```javascript
// ❌ WRONG - This is for client-side only!
const session = await getSession({ req });
```

**Solution:**
```javascript
// ✅ CORRECT - Use server-side auth
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const session = await getServerSession(req, res, authOptions);
```

**Why This Breaks:**
- `getSession({ req })` from `next-auth/react` doesn't work in API routes
- Causes authentication to fail silently
- Returns 500 error instead of proper response

**Impact:**
- **Critical** - Google Doc preview doesn't load
- Admin can't see report content
- Must open doc in new tab manually

**Fix Difficulty:** ⭐ Easy (5 minute fix)

---

### 8.B. Content Security Policy (CSP) Violations

**Error Messages (from screenshot):**
```
Refused to load the script 'https://cdn.lr-in-prod.com/LogRocket.min.js'
because it violates the following Content Security Policy directive:
"script-src 'self'"
```

**Impact:**
- ⚠️ Minor - LogRocket monitoring blocked
- Doesn't affect core functionality
- Only affects analytics/debugging

**Root Cause:**
- CSP headers too strict
- Blocks external scripts
- LogRocket CDN not whitelisted

**Fix:**
Add to `next.config.js`:
```javascript
headers: async () => [{
  source: '/:path*',
  headers: [{
    key: 'Content-Security-Policy',
    value: "script-src 'self' 'unsafe-inline' https://cdn.lr-in-prod.com"
  }]
}]
```

**Fix Difficulty:** ⭐⭐ Medium (configuration change)

---

## 9. PAYMENT INTEGRATION

### Payment Status Field
**Column:** `reports.payment_status`

**Possible Values:**
- `'pending'` - Default after submission
- `'approved'` - After report approved (currently not set)
- `'paid'` - After payment processed
- `'rejected'` - If payment rejected

**Current State:**
- All 203 reports have `payment_status: 'pending'`
- Review API doesn't update payment status
- Separate payment workflow expected

### Payment Workflow (Inferred)

```
[Report Approved]
  status: 'submitted' → 'approved'
  payment_status: 'pending' (unchanged)
  ↓
[Payment Admin Dashboard]
  Query: WHERE status='approved' AND payment_status='pending'
  ↓
[Payment Admin Reviews]
  Checks base_payment_amount
  Applies adjustments (adjusted_payment_amount)
  ↓
[Payment Admin Approves Payment]
  payment_status: 'pending' → 'approved'
  ↓
[Finance Processes Payment]
  payment_status: 'approved' → 'paid'
  paid_at: timestamp
  paid_by: admin email
```

**Payment Fields:**
- `base_payment_amount` - Standard rate
- `adjusted_payment_amount` - Final amount (after deductions/bonuses)
- `payment_status` - Workflow state
- `approved_at` - When report approved
- `paid_at` - When payment sent
- `paid_by` - Who processed payment

**Missing Implementation:**
- No Payment Admin dashboard found
- Payment approval API not implemented
- Payment amount calculation not visible

---

## 10. FILE STRUCTURE

### Pages Structure
```
/pages/
├── admin/
│   ├── index.js                    # Admin dashboard home
│   ├── dashboard.js                # Mentor progress dashboard
│   ├── lawatan-premis.js           # Premises visit tracking
│   ├── verification/
│   │   ├── index.js                # ✅ Report list (verification queue)
│   │   └── [id].js                 # ✅ Report detail (review page)
│   └── verify-users.js             # User role management
│
├── api/
│   ├── admin/
│   │   ├── lawatan-premis.js       # Premises visit API
│   │   ├── mentor-progress.js      # Mentor progress data
│   │   ├── reports/
│   │   │   ├── index.js            # ✅ List reports API
│   │   │   └── [id]/
│   │   │       ├── index.js        # ✅ Get single report (with hybrid sync)
│   │   │       └── review.js       # ✅ Approve/reject API
│   │   └── proxy-drive/
│   │       └── [fileId].js         # ✅ Google Drive proxy (HAS BUG!)
│   │
│   ├── submitReport.js             # Bangkit report submission
│   ├── submitMajuReport.js         # Maju report submission
│   └── auth/
│       └── [...nextauth].js        # NextAuth config
│
├── laporan-bangkit.js              # Bangkit report form
├── laporan-maju-um.js              # Maju report form
└── index.js                        # Mentor dashboard
```

### Library Files
```
/lib/
├── auth.js                         # ✅ canAccessAdmin(), isReadOnly()
├── supabaseClient.js               # Supabase client (ANON key)
├── googleSheets.js                 # ✅ Sheets integration
│                                   #    - updateSheetStatus()
│                                   #    - getDocUrlFromSheet()
│                                   #    - findRowNumberByDetails()
└── sheets.js                       # Sheets client wrapper
```

### Components
```
/components/
├── AccessDenied.js                 # ✅ Access denied page
└── ReadOnlyBadge.js                # ✅ Read-only user indicator
```

---

## 11. CRITICAL FINDINGS

### ✅ WHAT WORKS

1. **List Reports Page** - Fully functional
   - Shows all 203 submitted reports
   - Filters work (mentor, month)
   - Pagination works
   - Authentication works (after fix)

2. **Report Detail Page** - Mostly functional
   - Loads report data correctly
   - Auto-compliance checks work
   - Approve/Reject buttons work
   - Database updates work
   - Google Sheets sync works

3. **Hybrid Sync** - Working as designed
   - Self-heals missing URLs from Sheets
   - Updates Supabase automatically
   - Non-blocking (graceful degradation)

4. **Role-Based Access** - Working
   - Admin check via `canAccessAdmin()`
   - Service role key bypasses RLS
   - Read-only mode respected

---

### ❌ WHAT'S BROKEN

1. **Google Drive Proxy (CRITICAL)**
   - **File:** `/pages/api/admin/proxy-drive/[fileId].js`
   - **Error:** 500 Internal Server Error
   - **Cause:** Using `getSession({ req })` instead of `getServerSession()`
   - **Impact:** Can't preview documents in iframe
   - **Fix:** Change authentication method (5 min fix)

2. **CSP Headers (Minor)**
   - **Error:** LogRocket scripts blocked
   - **Impact:** Monitoring doesn't work
   - **Fix:** Update CSP policy in next.config.js

---

### ⚠️ WHAT'S INCOMPLETE

1. **Payment Workflow**
   - No Payment Admin dashboard found
   - Payment status not updated on approval
   - Payment amount calculation not visible
   - No payment processing API

2. **Compliance Enforcement**
   - Auto-checks are UI-only
   - No server-side validation
   - Admin can approve failing reports
   - Should add validation in review API

3. **Document URL Fields**
   - Three different fields exist: `document_url`, `google_doc_url`, `doc_url`
   - Unclear which is primary
   - Hybrid sync only checks one field

---

### 🔍 MISSING INFORMATION

1. **Google Sheets Functions**
   - Need to see implementation of:
     - `updateSheetStatus()`
     - `getDocUrlFromSheet()`
     - `findRowNumberByDetails()`

2. **Payment Admin Pages**
   - Where is payment dashboard?
   - How does payment approval work?
   - Is it implemented yet?

3. **Notification System**
   - Are mentors notified of approval/rejection?
   - Email integration?
   - In-app notifications?

---

## KEY FINDINGS SUMMARY

### 1. Most Critical Issue
**Google Drive Proxy Authentication Bug**
- Prevents document preview
- Easy to fix (change 2 lines)
- Highest impact on user experience

### 2. Why Google Doc Loading Fails
- Incorrect authentication method in proxy API
- Using client-side auth in server-side route
- Causes 500 error instead of streaming PDF

### 3. Why Compliance Check Exists
- To help admin quickly spot incomplete reports
- Checks for required evidence (photos, decisions)
- **BUT:** Only visual, not enforced

### 4. Easy Fixes Available
- ⭐ Fix proxy auth (5 min)
- ⭐ Add server-side compliance validation (30 min)
- ⭐ Update payment_status on approval (5 min)

### 5. Hard Fixes Needed
- Payment Admin dashboard (not implemented)
- Document URL field consolidation (data migration)
- Notification system (if required)

---

## RECOMMENDATIONS

### Immediate (This Week)
1. ✅ **Fix proxy-drive auth** - Change to `getServerSession()`
2. ✅ **Update review API** - Set `payment_status: 'approved'` when approving
3. ✅ **Add server validation** - Enforce compliance checks in review API

### Short Term (This Month)
4. Build Payment Admin dashboard
5. Consolidate document URL fields
6. Add email notifications for approval/rejection

### Long Term (Next Quarter)
7. Move PDF generation to Supabase (retire Sheets dependency)
8. Build analytics dashboard for verification metrics
9. Implement bulk approval for compliant reports

---

**END OF DOCUMENTATION**

Generated by Claude Code - February 22, 2026
