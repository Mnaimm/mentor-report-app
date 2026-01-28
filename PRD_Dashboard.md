# PRD: Mentor Dashboard System
**Product Requirements Document**  
**Date:** January 25, 2026  
**Version:** 1.0  
**Status:** Current State Documentation

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Data Sources](#data-sources)
4. [Business Logic](#business-logic)
5. [User Interface Components](#user-interface-components)
6. [Known Risks & Technical Debt](#known-risks--technical-debt)
7. [Critical Dependencies](#critical-dependencies)
8. [API Contracts](#api-contracts)

---

## System Overview

### Purpose
The Mentor Dashboard provides mentors with a comprehensive view of their assigned mentees, tracking session progress, due dates, and Upward Mobility (UM) form submissions across different batches and programs (Bangkit, Maju, TUBF).

### Key Features
- Real-time session progress tracking
- Due date monitoring with urgency-based alerts
- Upward Mobility form tracking (Sessions 2 & 4)
- MIA (Missing In Action) status detection
- Multi-batch, multi-program support
- Filtering and sorting capabilities
- Direct navigation to reporting forms

### Users
- **Primary:** Mentors managing 1-20 mentees
- **Secondary:** Admin users viewing overview statistics

---

## Architecture

### System Components

```
┌──────────────────────────────────────────────────────┐
│                    USER INTERFACE                    │
├──────────────────────────────────────────────────────┤
│  /                     │  /mentor/dashboard          │
│  (index.js)            │  (dashboard.js)             │
│  ├─ Landing Page       │  ├─ Mentee Cards            │
│  ├─ Overview Stats     │  ├─ Filters & Search        │
│  ├─ Batch Summaries    │  ├─ Sort Options            │
│  └─ UM Tracking        │  └─ Action Buttons          │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                    API LAYER                         │
├──────────────────────────────────────────────────────┤
│  /api/mentor-stats     │  /api/mentor/my-dashboard   │
│  (All mentors)         │  (Single mentor)            │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────┐
│                   DATA SOURCES                       │
├──────────────────────────────────────────────────────┤
│  Supabase PostgreSQL   │  Google Sheets              │
│  ├─ users              │  ├─ V8 (Bangkit)            │
│  ├─ entrepreneurs      │  ├─ LaporanMajuUM (Maju)      │
│  ├─ mentor_assignments │  └─ UM (Separate sheet)     │
│  └─ batch_rounds       │                             │
└──────────────────────────────────────────────────────┘
```

### Page Roles

| File | Type | Purpose | Audience |
|------|------|---------|----------|
| `pages/index.js` | React Page | Landing + Admin Overview | All users |
| `pages/mentor/dashboard.js` | React Page | Personal Mentor Dashboard | Individual mentors |
| `pages/api/mentor/my-dashboard.js` | API Endpoint | Data processing & aggregation | Backend only |
| `pages/api/mentor-stats.js` | API Endpoint | Overview statistics | Backend only |

---

## Data Sources

### 1. Supabase Database (PostgreSQL)

#### Table: `users`
**Purpose:** Mentor authentication and identity
```sql
- id (UUID, PK)
- name (TEXT)
- email (TEXT, UNIQUE)
- role (TEXT)
```

#### Table: `entrepreneurs`
**Purpose:** Mentee master data
```sql
- id (UUID, PK)
- name (TEXT)              -- CRITICAL: Used for exact matching with sheets
- email (TEXT)
- business_name (TEXT)
- phone (TEXT)
- state (TEXT)
- program (TEXT)           -- e.g., "Bangkit", "Maju", "TUBF"
- cohort (TEXT)            -- e.g., "Batch 5"
- status (TEXT)
```

#### Table: `mentor_assignments`
**Purpose:** Mentor-mentee relationships
```sql
- id (UUID, PK)
- mentor_id (UUID, FK → users.id)
- entrepreneur_id (UUID, FK → entrepreneurs.id)
- status (TEXT)            -- "active", "inactive"
- assigned_at (TIMESTAMP)
```

#### Table: `batch_rounds`
**Purpose:** Defines batch structure, rounds, and due dates
```sql
- id (UUID, PK)
- batch_name (TEXT)        -- e.g., "Batch 5 Bangkit"
- round_name (TEXT)        -- e.g., "Mentoring 2"
- round_number (INTEGER)   -- 1, 2, 3, 4, etc.
- start_month (DATE)       -- Round start date
- end_month (DATE)         -- Round end date (used for due date)
- period_label (TEXT)      -- e.g., "Feb - Mar 2026"
- program (TEXT)           -- "Bangkit", "Maju"
- notes (TEXT)
```

**CRITICAL MATCHING RULE:**
```javascript
// Must match:
entrepreneurs.cohort ↔ batch_rounds.batch_name
entrepreneurs.program ↔ batch_rounds.program

// Example:
entrepreneurs: { cohort: "Batch 5", program: "Bangkit" }
batch_rounds: { batch_name: "Batch 5 Bangkit", program: "Bangkit" }
```

---

### 2. Google Sheets (SOURCE OF TRUTH for sessions)

#### Sheet: V8 (Bangkit Reports)
**Sheet ID:** From `GOOGLE_SHEET_ID` env variable  
**Tab Name:** `V8`

**Critical Columns:**
| Column | Data Type | Purpose | Example |
|--------|-----------|---------|---------|
| `Nama Usahawan` | TEXT | Mentee identifier | "Ahmad bin Ali" |
| `Sesi Laporan` | TEXT | Session label | "Sesi #2 (Round 1)" |
| `Status Sesi` | TEXT | Completion status | "Selesai", "MIA" |
| `Tarikh Sesi` | DATE | Session date | "2026-01-20" |

**Status Values:**
- `"Selesai"` or `"completed"` = Session completed ✅
- `"MIA"` = Mentee missing ❌
- Other values = Not completed ⏳

---

#### Sheet: LaporanMaju (Maju Reports)
**Sheet ID:** Same as V8  
**Tab Name:** `LaporanMaju`

**Critical Columns:**
| Column | Data Type | Purpose | Example |
|--------|-----------|---------|---------|
| `NAMA_MENTEE` | TEXT | Mentee identifier | "Ahmad bin Ali" |
| `SESI_NUMBER` | INTEGER | Session number | 2 |
| `MIA_STATUS` | TEXT | Completion status | "Tidak MIA", "MIA" |
| `TARIKH_SESI` | DATE | Session date | "2026-01-20" |

**Status Values:**
- `"Tidak MIA"` or contains `"Tidak"` = Session completed ✅
- `"MIA"` = Mentee missing ❌

---

#### Sheet: UM (Upward Mobility Forms)
**Sheet ID:** From `GOOGLE_SHEET_ID_UM` env variable  
**Tab Name:** `UM`

**Critical Columns:**
| Column | Data Type | Purpose | Example |
|--------|-----------|---------|---------|
| `Batch.` | TEXT | Batch identifier | "Batch 5 Bangkit" |
| `Nama Penuh Usahawan.` | TEXT | Mentee identifier | "Ahmad bin Ali" |
| `Sesi Mentoring.` | TEXT | Session number | "Mentoring 2", "Sesi #2" |

**Composite Key Format:**
```javascript
`${batch}-${sessionNumber}-${menteeName}`
// Example: "Batch 5 Bangkit-2-Ahmad bin Ali"
```

---

## Business Logic

### 1. Session Counting Algorithm

#### Loading Sessions
```javascript
// Step 1: Filter sheets by exact name match
const menteeSessions = sheetRows.filter(row => {
  const rowMenteeName = (row['Nama Usahawan'] || row['NAMA_MENTEE']).trim();
  return rowMenteeName === entrepreneur.name; // EXACT MATCH REQUIRED
});

// Step 2: Sort chronologically by date
menteeSessions.sort((a, b) => {
  const dateA = new Date(a.sessionDate || '1970-01-01');
  const dateB = new Date(b.sessionDate || '1970-01-01');
  return dateA - dateB;
});

// Step 3: Extract session numbers
sessionsWithNumbers = menteeSessions.map((s, index) => {
  // Try regex extraction first
  const match = s.sessionLabel?.match(/Sesi\s*#?(\d+)/i);
  let sessionNum = match ? parseInt(match[1]) : (index + 1);
  
  return {
    ...s,
    calculatedSessionNumber: sessionNum
  };
});
```

#### Completion Detection
```javascript
function isSessionCompleted(session) {
  const status = (session.status || '').toLowerCase();
  
  if (session.programType === 'maju') {
    // Maju: Completed if NOT MIA
    return status !== 'mia' && status.includes('tidak');
  } else {
    // Bangkit: Completed if explicitly marked
    return status === 'selesai' || status === 'completed';
  }
}
```

---

### 2. Progress Calculation

#### Current Round Progress
```javascript
// Find the session matching current round number
const currentRoundSession = sessionsWithNumbers.find(s => 
  s.calculatedSessionNumber == currentRoundNum && 
  isSessionCompleted(s)
);

// Progress metrics
const reportsThisRound = currentRoundSession ? 1 : 0;
const expectedReportsThisRound = 1; // HARDCODED: 1 session per round

// Display: "1/1" (completed) or "0/1" (pending)
```

#### All Sessions Count
```javascript
const totalSessions = menteeSessions.length; // All rows (including MIA)
const completedSessions = menteeSessions.filter(isSessionCompleted).length;

// Display: "3/5" (3 completed out of 5 total)
```

---

### 3. Status Determination Logic

```javascript
function calculateMenteeStatus(mentee, sessions, dueDate) {
  // Priority 1: MIA check
  const hasMIA = sessions.some(s => s.status === 'MIA');
  if (hasMIA) return 'mia';
  
  // Priority 2: No sessions at all
  if (sessions.length === 0) return 'pending_first_session';
  
  // Priority 3: Completed this round
  if (reportsThisRound >= expectedReportsThisRound) return 'on_track';
  
  // Priority 4: Check due date
  if (dueDate) {
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'due_soon';
    return 'pending';
  }
  
  return 'pending';
}
```

**Status Hierarchy (Priority Order):**
1. 🔴 **MIA** - Any MIA session exists
2. ⚪ **Pending First Session** - No sessions submitted yet
3. 🟢 **On Track** - Current round completed
4. 🔴 **Overdue** - Past due date, round incomplete
5. 🟡 **Due Soon** - Within 7 days of due date
6. ⏳ **Pending** - Has time remaining

---

### 4. Due Date Calculation

```javascript
function calculateDueDate(batch, program) {
  // Step 1: Find matching batch_rounds entry
  const batchInfo = batch_rounds.find(b => 
    b.batch_name === batch && 
    b.program === program &&
    isCurrentlyActive(b.start_month, b.end_month)
  );
  
  if (!batchInfo) return null;
  
  // Step 2: Extract end_month (format: "2026-02" or "2026-02-28")
  const [year, month] = batchInfo.end_month.split('-');
  
  // Step 3: Return last day of end month
  const dueDate = new Date(year, month, 0); // Day 0 = last day of previous month
  
  return dueDate;
}
```

**Example:**
- `end_month = "2026-02"` → Due: February 28, 2026
- `end_month = "2026-02-15"` → Due: February 28, 2026 (ignores day)

---

### 5. Upward Mobility (UM) Tracking

#### When UM is Checked
```javascript
const UM_SESSIONS = [2, 4]; // HARDCODED: Only Sessions 2 and 4

function shouldCheckUM(currentRoundNumber) {
  return UM_SESSIONS.includes(parseInt(currentRoundNumber));
}
```

#### UM Submission Detection
```javascript
function checkUMSubmission(mentee, sessionNumber) {
  // CRITICAL: Only check if session report is submitted
  const sessionReportSubmitted = hasSubmittedSession(mentee, sessionNumber);
  if (!sessionReportSubmitted) {
    return null; // Don't check UM yet
  }
  
  // Build composite key
  const fullBatchName = batchInfo?.batch || mentee.cohort;
  const umKey = `${fullBatchName}-${sessionNumber}-${mentee.name.trim()}`;
  
  // Check if exists in UM submissions map
  const isSubmitted = umSubmissions.has(umKey);
  
  return {
    session: sessionNumber,
    status: isSubmitted ? 'submitted' : 'pending',
    message: `UM ${isSubmitted ? 'Submitted' : 'Pending'} (Session ${sessionNumber})`
  };
}
```

#### UM Logic Flow
```
Session Report Submitted?
  ├─ NO → Don't show UM badge
  └─ YES → Is Session 2 or 4?
      ├─ NO → Don't check UM
      └─ YES → Check UM sheet
          ├─ Found → Show green badge "✅ UM Submitted"
          └─ Not Found → Show purple badge "⚠️ UM Pending"
```

---

### 6. MIA Handling

#### Detection
```javascript
function hasMIASession(sessions) {
  return sessions.some(s => {
    const status = (s.status || '').toUpperCase();
    return status === 'MIA';
  });
}
```

#### Impact on Metrics

| Metric | MIA Session Impact |
|--------|-------------------|
| **Total Sessions** | ✅ COUNTED (included in total) |
| **Completed Sessions** | ❌ NOT COUNTED (excluded from completed) |
| **This Round Progress** | ❌ Shows 0/1 if MIA this round |
| **Overall Status** | 🔴 Forces status to "MIA" |
| **Due Date Warning** | ⚠️ Still shown, but overridden by MIA badge |

#### Example Calculation
```
Mentee has 5 sessions:
- Session 1: Selesai ✅
- Session 2: MIA ❌
- Session 3: Selesai ✅
- Session 4: Pending ⏳
- Session 5: Not submitted

Result:
- Total Sessions: 4 (rows in sheet)
- Completed Sessions: 2 (only Selesai)
- Display: "2/4"
- Overall Status: "MIA" (overrides everything)
```

---

## User Interface Components

### 1. Dashboard Page (`/mentor/dashboard`)

#### Features
- **Summary Panel**
  - Total mentees
  - On track count
  - Overdue count
  - UM pending count

- **Filters**
  - Status: All, On Track, Due Soon, Overdue, MIA, Pending First Session
  - Batch: All, Batch 1, Batch 2, etc.
  - Program: All, Bangkit, Maju, TUBF
  - Search: Name, business name, email

- **Sort Options**
  - 🔥 Urgency (default)
  - 📅 Due Date
  - 📦 Batch
  - 🔤 Name
  - 📊 Progress

- **Batch Grouping**
  - Toggle to group mentees by batch
  - Sticky batch headers
  - Count per batch

#### Urgency Sort Algorithm
```javascript
function getUrgencyScore(mentee) {
  if (mentee.status === 'overdue') return 1000;
  if (mentee.status === 'due_soon') return 500;
  if (mentee.umStatus?.status === 'pending') return 300;
  if (mentee.status === 'on_track') return 10;
  if (mentee.status === 'pending_first_session') return 5;
  return 0;
}

// Sort: Higher score = More urgent = Appears first
mentees.sort((a, b) => {
  const scoreA = getUrgencyScore(a);
  const scoreB = getUrgencyScore(b);
  return scoreB - scoreA; // Descending
});
```

---

### 2. MenteeCard Component

#### Visual Priority System

```
┌─────────────────────────────────────────┐
│ 🔴 OVERDUE                      [Badge]│ ← Red left border
│                                         │
│ Ahmad bin Ali                           │
│ Ahmad's Tech Startup                    │
│ [Bangkit] [Batch 5]                    │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Feb - Mar 2026                   │   │ ← Current round
│ │ This Round: 0/1                  │   │
│ │ Overdue by 3 days               │   │
│ └─────────────────────────────────┘   │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ ⚠️ Upward Mobility Form          │   │ ← UM badge (if applicable)
│ │ Session 2: Not Submitted        │   │
│ └─────────────────────────────────┘   │
│                                         │
│ All Sessions: 1/2                      │
│ Last Session: Jan 15, 2026             │
│                                         │
│ [📝 Submit Session Report]            │ ← Primary action
│ [📋 Submit UM Form (Session 2)]       │ ← UM action (if pending)
│ [View Details] [📧 Email]             │ ← Secondary actions
└─────────────────────────────────────────┘
```

#### Border Colors by Status
- 🔴 Red: Overdue, MIA
- 🟡 Yellow: Due Soon
- 🟣 Purple: UM Pending (no other issues)
- 🟢 Green: On Track
- ⚪ Gray: Pending First Session

#### Conditional Action Buttons
```javascript
// Show "Submit Session Report" button if:
- status === 'overdue' OR
- status === 'due_soon' OR
- status === 'pending_first_session'

// Show "Submit UM Form" button if:
- umStatus.status === 'pending'

// Always show:
- "View Details" button
- "Email" button
```

---

## Known Risks & Technical Debt

### 🔴 CRITICAL RISKS

#### 1. Name-Based Matching Fragility
**Location:** `my-dashboard.js` lines 299-317

**Issue:**
```javascript
const rowMenteeName = (row['Nama Usahawan'] || '').trim();
return rowMenteeName === mentee.name; // EXACT MATCH REQUIRED
```

**Failure Scenarios:**
- Typo in either Supabase or Google Sheets → No sessions load
- Name changes in one system but not the other → Data loss
- Extra spaces, different casing → Match fails
- Special characters (e.g., "Ahmad bin Ali" vs "Ahmad Bin Ali")

**Impact:** Sessions show 0/0, progress appears incomplete

**Mitigation:**
- ⚠️ Manual validation required
- Consider implementing fuzzy matching
- Add data validation scripts
- Centralize name management

---

#### 2. UM Batch Name Mismatch
**Location:** `my-dashboard.js` lines 467-469

**Issue:**
```javascript
const fullBatchName = batchInfo?.batch || menteeBatch;
const umKey = `${fullBatchName}-${currentRoundNumStr}-${entrepreneur.name.trim()}`;
```

**Problem:**
- `batch_rounds.batch_name` = `"Batch 5 Bangkit"` (full name)
- `entrepreneurs.cohort` = `"Batch 5"` (short name)
- UM sheet `Batch.` column might use either format

**Result:** UM forms marked as "pending" even when submitted

**Mitigation:**
- Standardize batch naming across all systems
- Add batch name normalization function
- Document exact format requirements

---

#### 3. Session Number Extraction Fragility
**Location:** `my-dashboard.js` lines 331-345

**Issue:**
```javascript
const match = s.sessionLabel.match(/Sesi\s*#?(\d+)/i);
```

**Risks:**
- Regex assumes "Sesi #N" format
- If format changes (e.g., "Session 2", "Round 2"), extraction fails
- Falls back to chronological index (could assign wrong numbers)

**Example Failure:**
```
Sheet: "Session 2" → No match → Uses index → Wrong number
Sheet: "Sesi 10 and 11" → Extracts "10" → Misses "11"
```

**Mitigation:**
- Standardize session label format in sheets
- Add multiple regex patterns
- Validate session numbers after extraction

---

### 🟡 MEDIUM RISKS

#### 4. Hardcoded Values

**Expected Reports Per Round**
```javascript
const expectedReportsThisRound = 1; // Line 391
```
**Risk:** If batch structure changes to 2+ sessions per round, code must be updated

**UM Session Numbers**
```javascript
if (currentRoundNumStr === '2' || currentRoundNumStr === '4') // Line 451
```
**Risk:** Cannot configure per-batch or per-program UM requirements

**Mitigation:** Move to configuration table or environment variables

---

#### 5. Date Parsing Assumptions
**Location:** `my-dashboard.js` lines 318-324

**Issue:**
```javascript
const dateA = new Date(a.sessionDate || '1970-01-01');
```

**Risks:**
- Assumes parseable date format
- Defaults to 1970 if missing (causes wrong sort order)
- Timezone issues with date comparisons

**Mitigation:**
- Add date format validation
- Handle missing dates explicitly
- Use UTC for all date comparisons

---

#### 6. Loose Batch Matching
**Location:** `my-dashboard.js` lines 76-96

**Issue:**
```javascript
const batchMatch = b.batch_name === batchName || 
                   b.batch_name?.includes(batchName) || 
                   batchName?.includes(b.batch_name);
```

**Risk:** False positives (e.g., "Batch 5" matches "Batch 50")

**Mitigation:** Use exact matching after name standardization

---

### 🟢 LOW RISKS

#### 7. Missing Error Handling
- No retry logic for Google Sheets API failures
- Silent failures when UM sheet not configured
- No validation that session dates are chronological

#### 8. Performance Concerns
- Loads ALL sheets rows on every request (no pagination)
- O(n²) filtering (mentees × sheet rows)
- No caching of batch_rounds data

---

## Critical Dependencies

### Environment Variables
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
GOOGLE_SHEET_ID=xxx            # For Bangkit and LaporanMajuUM sheets
GOOGLE_SHEET_ID_UM=xxx         # For UM forms sheet
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_PRIVATE_KEY=xxx

# Optional
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx
```

### Google Sheets API Permissions
- Service account must have **Viewer** access to all sheets
- Sheets must be shared with service account email
- Required scopes: `https://www.googleapis.com/auth/spreadsheets.readonly`

### Database Constraints
- `batch_rounds` must have entries for all active batches
- `mentor_assignments.status = 'active'` for visible mentees
- `entrepreneurs.name` must EXACTLY match sheet names

---

## API Contracts

### GET `/api/mentor/my-dashboard`

#### Authentication
- Requires: Next-Auth session
- Authorization: Mentor role (any authenticated user)

#### Request
```http
GET /api/mentor/my-dashboard HTTP/1.1
Cookie: next-auth.session-token=xxx
```

#### Response Schema
```typescript
{
  mentor: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    totalMentees: number;
    onTrack: number;
    dueSoon: number;
    overdue: number;
    mia: number;
    pendingFirstSession: number;
    umPending: number;
    needsAction: number;          // overdue + due_soon + umPending
    totalSessions: number;
    completedSessions: number;
  };
  mentees: Array<{
    id: string;
    name: string;
    email: string;
    businessName: string;
    phone: string;
    region: string;
    program: string;              // "Bangkit", "Maju", "TUBF"
    batch: string;                // "Batch 5"
    currentRound: string;         // "Mentoring 2"
    currentRoundNumber: number;   // 2
    status: "on_track" | "due_soon" | "overdue" | "mia" | "pending_first_session" | "pending";
    totalSessions: number;        // All sessions (including MIA)
    completedSessions: number;    // Completed only (excluding MIA)
    reportsThisRound: number;     // 0 or 1
    expectedReportsThisRound: number; // 1
    lastSessionDate: string | null;   // ISO date
    roundDueDate: string | null;      // ISO date (YYYY-MM-DD)
    daysUntilDue: number | null;
    assignedAt: string;           // ISO timestamp
    batchPeriod: string;          // "Feb - Mar 2026"
    umStatus: {
      session: string;            // "2" or "4"
      status: "pending" | "submitted";
      message: string;
    } | null;
  }>;
  timestamp: string;              // ISO timestamp
}
```

#### Status Codes
- `200` - Success
- `401` - Unauthorized (no session)
- `404` - User not found
- `500` - Server error

#### Error Response
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

---

## Data Integrity Rules

### MUST MAINTAIN
1. **Name Consistency**
   - `entrepreneurs.name` MUST exactly match Google Sheets names
   - No typos, extra spaces, or case differences

2. **Batch Naming**
   - `batch_rounds.batch_name` format: `"Batch {N} {Program}"`
   - Example: `"Batch 5 Bangkit"`, `"Batch 3 Maju"`

3. **Session Labels**
   - Bangkit: `"Sesi #{N} (Round {M})"`
   - Maju: Numeric `SESI_NUMBER` column

4. **Status Values**
   - Bangkit: `"Selesai"` (completed), `"MIA"` (missing)
   - Maju: `"Tidak MIA"` (completed), `"MIA"` (missing)

5. **Date Formats**
   - All dates: ISO format `YYYY-MM-DD`
   - No timezone conversions in sheets

---

## Future Considerations

### Recommended Improvements
1. **Data Validation Layer**
   - Add fuzzy name matching
   - Validate sheet structure before processing
   - Alert on data mismatches

2. **Caching Strategy**
   - Cache Google Sheets data (5-15 min TTL)
   - Cache batch_rounds lookups
   - Implement incremental sheet reading

3. **Configuration Management**
   - Move hardcoded values to database
   - Per-batch UM session configuration
   - Flexible reports-per-round setting

4. **Error Recovery**
   - Retry logic for API failures
   - Graceful degradation when sheets unavailable
   - User-friendly error messages

5. **Monitoring & Alerts**
   - Track name mismatch rates
   - Alert on missing batch_rounds entries
   - Monitor API response times

6. **Testing**
   - Unit tests for session counting logic
   - Integration tests for sheet parsing
   - Edge case handling (empty dates, missing data)

---

## Glossary

- **Mentee / Entrepreneur / Usahawan**: Person receiving mentoring
- **Session / Sesi**: Individual mentoring meeting
- **Round / Mentoring**: Period defined by batch_rounds (usually 1 month)
- **MIA**: Missing In Action (mentee did not attend)
- **UM**: Upward Mobility form (required after Sessions 2 & 4)
- **Batch**: Cohort of mentees (e.g., "Batch 5")
- **Program**: Mentoring program type (Bangkit, Maju, TUBF)
- **This Round**: Current active round for the batch
- **All Sessions**: Total historical sessions across all rounds

---

**Document Owner:** Development Team  
**Last Updated:** January 25, 2026  
**Next Review:** February 2026
