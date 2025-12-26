# COMPREHENSIVE SCHEMA ANALYSIS & VERIFICATION REPORT
## Mentor-Report Dashboard System
**Generated:** 2025-12-26
**System Type:** Next.js Pages Router + Supabase + Google Sheets (Dual-Write Architecture)

---

## EXECUTIVE SUMMARY

This system uses a **hybrid architecture** with:
- **Supabase (PostgreSQL)** - Modern cloud database (PRIMARY for new features)
- **Google Sheets** - Legacy data source (READ for backward compatibility, WRITE for dual-write migration)

**Critical Finding:** The system is in Phase 2 of a migration from Google Sheets to Supabase. Some endpoints read from Sheets, others from Supabase. This creates complexity in schema requirements.

---

## PART 1: API ENDPOINT ANALYSIS

### 1.1 `/api/coordinator/dashboard-summary` [GET]

**Database Connection:**
- ✅ **Supabase** (primary)
- Connection: `@supabase/supabase-js` client
- Credentials: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Tables Accessed:**
- `view_program_summary` (VIEW) - READ
- `mentor_assignments` - READ with JOIN
- `entrepreneurs` - READ via JOIN

**Columns Used:**
```sql
-- view_program_summary
total_mentees, active_mentors, overall_completion_pct,
reports_this_month, unassigned_mentees, pending_mentors,
critical_mentors, sessions_due_this_week

-- mentor_assignments
id, entrepreneur_id, mentor_id, created_at, assigned_at, status

-- entrepreneurs (via JOIN)
id, name, email, business_name, phone, state, program, cohort
```

**Expected Response:**
```json
{
  "summary": {
    "total_mentees": 124,
    "active_mentors": 23,
    "overall_completion_pct": 78,
    "reports_this_month": 45,
    "unassigned_mentees": 8,
    "pending_mentors": 12,
    "critical_mentors": 3,
    "sessions_due_this_week": 15
  },
  "unassigned": [
    {
      "assignment_id": "uuid",
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "business_name": "ABC Corp",
      "phone": "+60123456789",
      "state": "Selangor",
      "program": "Bangkit",
      "cohort": "Batch 5",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### 1.2 `/api/coordinator/mentees` [GET]

**Database Connection:**
- ✅ **Supabase** (primary for assignments)
- ⚠️ **Google Sheets** (fallback for batch/region data)

**Tables Accessed:**
- `mentor_profiles` - READ
- `mentor_assignments` - READ with JOIN
- `entrepreneurs` - READ via JOIN
- `users` - READ via JOIN
- `sessions` - READ for session status

**Google Sheets (lib/sheets):**
- None directly, but references Google Sheets for legacy data

**Columns Used:**
```sql
-- mentor_profiles
user_id, programs[], regions[], max_mentees, is_premier, phone, bio

-- mentor_assignments
id, entrepreneur_id, mentor_id, assigned_at, status

-- entrepreneurs
id, name, email, business_name, phone, state, program, cohort, status

-- users (via mentor_assignments)
id, name, email

-- sessions
entrepreneur_id, Status, session_date, created_at
```

**Query Parameters:**
- `status` - Filter by mentee status (Active, MIA, Completed, Dropped)
- `batch` - Filter by batch name
- `region` - Filter by region/state

**Expected Response:**
```json
{
  "program": "All Programs",
  "mentees": [
    {
      "id": "uuid",
      "name": "Mentee Name",
      "businessName": "Business Name",
      "mentorId": "uuid",
      "mentorName": "Mentor Name",
      "mentorEmail": "mentor@example.com",
      "batch": "Bangkit Batch 5",
      "region": "Selangor",
      "status": "Active",
      "sessionsCompleted": 3,
      "totalSessions": 4,
      "progressPercentage": 75,
      "lastReportDate": "2025-01-10T00:00:00Z",
      "daysSinceLastReport": 16,
      "phone": "+60123456789",
      "email": "mentee@example.com",
      "currentRound": 1,
      "overdueReports": 0
    }
  ],
  "total": 124,
  "summary": {
    "active": 98,
    "mia": 5,
    "completed": 15,
    "dropped": 6,
    "unassigned": 8,
    "bangkit": 67,
    "maju": 45,
    "tubf": 12
  }
}
```

---

### 1.3 `/api/coordinator/mentors` [GET]

**Database Connection:**
- ✅ **Supabase** (primary)
- ⚠️ **Google Sheets** (for report counts - mapping, V8, LaporanMaju, batch sheets)

**Tables Accessed:**
- `mentor_profiles` - READ with JOIN
- `users` - READ via JOIN
- `mentor_assignments` - READ (count assignments)

**Google Sheets Used:**
- `mapping` sheet - Mentor-mentee assignments
- `V8` sheet - Bangkit reports
- `LaporanMaju` sheet - Maju reports
- `batch` sheet - Batch round information

**Columns Used:**
```sql
-- mentor_profiles
id, user_id, programs[], regions[], max_mentees, is_premier, phone, bio

-- users
id, name, email, status, roles[], created_at

-- mentor_assignments
mentor_id, entrepreneur_id, status
```

**Expected Response:**
```json
{
  "program": "Bangkit",
  "mentors": [
    {
      "id": "uuid",
      "name": "Mentor Name",
      "email": "mentor@example.com",
      "phone": "+60123456789",
      "status": "active",
      "isPremier": true,
      "programs": ["Bangkit", "Maju"],
      "regions": ["Selangor", "KL"],
      "maxMentees": 10,
      "assignedMentees": 8,
      "availableSlots": 2,
      "reportsSubmitted": 28,
      "totalSessions": 32,
      "sessionsCompleted": 28,
      "reportCompletionRate": 87.5,
      "avgResponseTime": 3.2,
      "memberSince": "2024-06-15T00:00:00Z",
      "bio": "Experienced mentor"
    }
  ],
  "total": 23,
  "summary": {
    "totalMentors": 23,
    "premierMentors": 5,
    "totalCapacity": 230,
    "totalAssigned": 189,
    "availableSlots": 41
  }
}
```

---

### 1.4 `/api/coordinator/assign-mentor` [POST]

**Database Connection:**
- ✅ **Supabase** (primary)

**Tables Accessed:**
- `mentor_profiles` - READ
- `users` - READ via JOIN
- `mentor_assignments` - UPDATE or INSERT
- `activity_logs` - INSERT (via logActivity function)

**Request Body:**
```json
{
  "menteeId": "uuid",
  "mentorId": "uuid",
  "reason": "New assignment",
  "notes": "Special considerations..."
}
```

**Database Operations:**
1. Check coordinator's program
2. Validate mentor exists and is active
3. Check mentor capacity
4. Update or create assignment in `mentor_assignments`
5. Log activity in `activity_logs`

**Expected Response:**
```json
{
  "success": true,
  "message": "Mentee successfully assigned to mentor",
  "assignment": {
    "menteeId": "uuid",
    "mentorId": "uuid",
    "mentorName": "Mentor Name",
    "mentorEmail": "mentor@example.com",
    "program": "Bangkit",
    "assignedAt": "2025-01-26T10:00:00Z",
    "assignedBy": "Coordinator Name",
    "mentorCapacity": {
      "current": 9,
      "max": 10,
      "available": 1
    }
  }
}
```

---

### 1.5 `/api/monitoring/stats` [GET]

**Database Connection:**
- ✅ **Supabase** (primary)
- Uses lib/monitoring/metrics-aggregator

**Tables Accessed:**
- `todays_summary` (VIEW) - READ
- `dual_write_logs` - READ (via metrics-aggregator)
- `hourly_metrics` (VIEW or TABLE) - READ
- `daily_metrics` (VIEW or TABLE) - READ

**Query Parameters:**
- `period` - 'today' | 'week' | 'month' (default: 'today')
- `type` - 'hourly' | 'daily' (default: 'hourly')

**Expected Response:**
```json
{
  "period": "today",
  "summary": {
    "total_operations": 1245,
    "sheets_success_rate": 99.2,
    "supabase_success_rate": 99.8,
    "both_success_rate": 99.0,
    "total_errors": 12
  },
  "hourlyBreakdown": [
    {
      "hour": "2025-01-26T10:00:00Z",
      "total_operations": 52,
      "sheets_success_rate": 100,
      "supabase_success_rate": 100,
      "both_success_rate": 100,
      "total_error_count": 0
    }
  ]
}
```

---

### 1.6 `/api/monitoring/health` [GET]

**Database Connection:**
- ✅ **Supabase** (health check)
- ✅ **Google Sheets API** (health check)

**Tables Accessed:**
- `dual_write_logs` - Simple SELECT to test connectivity

**Environment Variables Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SHEET_ID`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:00:00Z",
  "duration_ms": 1234,
  "checks": {
    "supabase": {
      "healthy": true,
      "duration_ms": 234,
      "message": "Supabase connection successful",
      "performance": "good"
    },
    "sheets": {
      "healthy": true,
      "duration_ms": 567,
      "message": "Google Sheets connection successful",
      "performance": "good",
      "spreadsheet": "Mentor Reporting System"
    },
    "metrics": {
      "healthy": true
    }
  },
  "summary": {
    "healthy": true,
    "message": "All systems operational"
  }
}
```

---

### 1.7 `/api/monitoring/discrepancies` [GET, POST]

**Database Connection:**
- ✅ **Supabase** (primary)

**Tables Accessed:**
- `data_discrepancies` - READ, UPDATE

**Query Parameters (GET):**
- `resolved` - 'true' | 'false' | 'all' (default: 'false')
- `table` - Filter by table name
- `severity` - 'low' | 'medium' | 'high' | 'critical'
- `limit` - Number of records (default: 50, max: 200)

**Columns Used:**
```sql
-- data_discrepancies
id, table_name, record_id, field_name, sheets_value, supabase_value,
severity, detected_at, resolved, resolved_at, resolved_by,
resolution_notes, created_at, updated_at
```

---

### 1.8 `/api/submitReport` [POST]

**Database Connection:**
- ❌ **No Supabase** - Only Google Sheets!
- ✅ **Google Sheets API** (V8 tab for Bangkit reports)

**⚠️ CRITICAL:** This endpoint does NOT write to Supabase. It only writes to Google Sheets.

**Request Body:**
```javascript
{
  "programType": "bangkit",
  "mentorEmail": "mentor@example.com",
  "status": "Selesai" | "MIA",
  "sesiLaporan": "1",
  "sesi": {
    "date": "2025-01-26",
    "time": "14:00",
    "platform": "Google Meet"
  },
  "usahawan": "Mentee Name",
  "namaSyarikat": "Business Name",
  "namaMentor": "Mentor Name",
  "rumusan": "Session summary...",
  "inisiatif": [
    {
      "focusArea": "Marketing",
      "keputusan": "Decision made",
      "pelanTindakan": "Action plan"
    }
  ],
  "jualanTerkini": [0,0,0,0,0,0,0,0,0,0,0,0], // 12 months
  "imageUrls": {
    "sesi": ["url1", "url2"],
    "growthwheel": "url",
    "mia": "url",
    "profil": "url",
    "premis": ["url1"]
  },
  "tambahan": {
    "produkServis": "Product description",
    "pautanMediaSosial": "https://..."
  },
  "premisDilawatChecked": true,
  "pemerhatian": "Observations...",
  "refleksi": {
    "perasaan": "Feeling",
    "skor": "8",
    "alasan": "Reason",
    "eliminate": "What to eliminate",
    "raise": "What to raise",
    "reduce": "What to reduce",
    "create": "What to create"
  },
  "gwSkor": [5,6,7,8,9...] // 20 scores
}
```

**Google Sheets Write:**
- Spreadsheet: `GOOGLE_SHEETS_REPORT_ID`
- Tab: `V8`
- Operation: APPEND row

**Cache Invalidation:**
- Deletes cache keys for mentor stats

---

### 1.9 `/api/menteeData` [GET]

**Database Connection:**
- ❌ **No Supabase** - Only Google Sheets!
- ✅ **Google Sheets API** (V8 for Bangkit, LaporanMaju for Maju)

**Query Parameters:**
- `name` - Mentee name (required)
- `programType` - 'bangkit' | 'maju' (required)

**Google Sheets Read:**
- For Bangkit: `GOOGLE_SHEETS_REPORT_ID` → V8 tab
- For Maju: `GOOGLE_SHEETS_MAJU_REPORT_ID` → LaporanMaju tab

**Expected Response:**
```json
{
  "lastSession": 2,
  "status": "Selesai",
  "previousSales": ["1000","2000","1500",...],
  "previousInisiatif": [
    {
      "focusArea": "Marketing",
      "keputusan": "Decision",
      "pelanTindakan": "Action"
    }
  ],
  "previousPremisDilawat": true,
  "previousDataKewangan": [], // For Maju
  "previousMentoringFindings": [] // For Maju
}
```

---

### 1.10 `/api/mentor-stats` [GET]

**Database Connection:**
- ❌ **No Supabase** - Only Google Sheets!
- ✅ **Google Sheets API** (mapping, V8, LaporanMaju, batch)

**Authentication:**
- Requires NextAuth session
- Supports impersonation (SUPER_ADMIN_EMAIL only)

**Google Sheets Read:**
- `mapping` - Mentor-mentee assignments
- `V8` - Bangkit reports
- `LaporanMaju` - Maju reports
- `batch` - Batch and round information

**Caching:**
- Cache key: `mentor-stats:{email}` or `mentor-stats:{email}:impersonated`
- TTL: 10 minutes

**Expected Response:**
```json
{
  "mentorEmail": "mentor@example.com",
  "currentRound": {
    "round": 2,
    "label": "Round 2 (Jan - Mar 2025)",
    "batchName": "Bangkit Batch 5"
  },
  "totalMentees": 8,
  "allTime": {
    "totalReports": 28,
    "uniqueMenteesReported": 8,
    "miaCount": 2,
    "premisVisitCount": 6,
    "perMenteeSessions": {
      "Mentee 1": 4,
      "Mentee 2": 3
    }
  },
  "currentRoundStats": {
    "reportedThisRound": 6,
    "pendingThisRound": 2,
    "miaThisRound": 1,
    "perMenteeSessions": {
      "Mentee 1": 1,
      "Mentee 2": 1
    }
  },
  "menteesByBatch": {
    "Bangkit Batch 5": ["Mentee 1", "Mentee 2"],
    "Maju Batch 3": ["Mentee 3"]
  },
  "sessionsByBatch": {
    "Bangkit Batch 5": {
      "Mentee 1": 4,
      "Mentee 2": 3
    }
  },
  "miaByBatch": {
    "Bangkit Batch 5": {
      "Mentee 1": 1
    }
  }
}
```

---

### 1.11 `/api/dashboard/stats` [GET]

**Database Connection:**
- ✅ **Supabase** (primary)
- ⚠️ **Mixed placeholders** (some data hardcoded, some from Supabase)

**Tables Accessed:**
- `users` - COUNT, filter by roles and status
- `mentor_profiles` - JOIN with users
- `mentor_assignments` - COUNT mentees

**Role-Based Responses:**
Each role gets different statistics:
- `system_admin` - Full system stats
- `program_coordinator` - Program-specific stats
- `report_admin` - Report-focused stats
- `payment_admin` - Payment stats
- `payment_approver` - Approval stats
- `mentor` / `premier_mentor` - Own stats
- `stakeholder` - Aggregate stats only

**Example (System Admin):**
```json
{
  "totalUsers": 156,
  "totalUsersChange": 5,
  "totalReports": 316,
  "reportsThisMonth": 45,
  "activeMentors": 23,
  "activeMentorsPercentage": 15,
  "dualWriteSuccessRate": 99.7
}
```

---

## PART 2: PAGE COMPONENT ANALYSIS

### 2.1 `/pages/admin/index.js` (Admin Dashboard)

**Purpose:** Display sales status reports grouped by batch and zone

**API Endpoints Used:**
- `GET /api/admin/sales-status`

**Data Displayed:**
- Batch name and mentoring round
- Zone groupings
- Mentor performance:
  - Total mentees
  - Sessions reported
  - Sales data completion
  - Progress percentage
  - MIA count

**Expected Data Structure:**
```javascript
[
  {
    "batchName": "Bangkit Batch 5",
    "roundLabel": "Round 2",
    "zones": [
      {
        "zoneName": "Selangor",
        "mentors": [
          {
            "mentorName": "Mentor Name",
            "totalMentees": 8,
            "totalSessions": 28,
            "expectedSessions": 32,
            "salesDataCount": 26,
            "percent": 87.5,
            "miaCount": 2
          }
        ]
      }
    ]
  }
]
```

**User Actions:**
- Refresh data (re-fetch from API)
- Expand/collapse batches
- View mentor statistics

---

### 2.2 `/pages/coordinator/dashboard.js` (Coordinator Dashboard)

**Purpose:** Program coordinator interface for managing mentors and mentees

**API Endpoints Used:**
- `GET /api/coordinator/dashboard-summary`
- `GET /api/dashboard/stats`
- `GET /api/coordinator/mentors`
- `GET /api/coordinator/mentees`
- `POST /api/coordinator/assign-mentor`

**Data Dependencies:**
```typescript
interface DashboardSummary {
  summary: {
    total_mentees: number;
    active_mentors: number;
    overall_completion_pct: number;
    reports_this_month: number;
    unassigned_mentees: number;
    pending_mentors: number;
    critical_mentors: number;
    sessions_due_this_week: number;
  };
  unassigned: UnassignedMentee[];
  timestamp: string;
}

interface Mentor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  isPremier: boolean;
  programs: string[];
  regions: string[];
  maxMentees: number;
  assignedMentees: number;
  availableSlots: number;
  reportsSubmitted: number;
  totalSessions: number;
  reportCompletionRate: number;
  avgResponseTime: number;
  memberSince: string;
  bio?: string;
}

interface Mentee {
  id: string;
  name: string;
  businessName: string;
  mentorId?: string;
  mentorName: string;
  mentorEmail?: string;
  batch: string;
  region: string;
  status: 'Active' | 'MIA' | 'Completed' | 'Dropped';
  sessionsCompleted: number;
  totalSessions: number;
  progressPercentage: number;
  lastReportDate: string | 'Never';
  daysSinceLastReport: number;
  phone?: string;
  email: string;
  currentRound: number;
  overdueReports: number;
}
```

**User Actions:**
1. **View Dashboard Summary** (8 KPI cards)
2. **Filter Mentors** by status, program, batch, region
3. **View Mentor Profile** (modal/alert)
4. **Contact Mentor** (mailto link)
5. **Filter Mentees** by status, program, batch, region
6. **Search Mentees** by name, business, or mentor
7. **Select Mentees** (checkboxes for bulk operations)
8. **Assign/Reassign Mentor** to mentee (modal)
9. **Bulk Assign** multiple mentees to one mentor
10. **Export CSV** of filtered mentees
11. **View Unassigned Mentees** table
12. **Refresh All Data**

**Frontend Validation:**
- Mentor must be selected before assignment
- Bulk assignment checks mentor capacity
- Form validation for assignment notes

---

### 2.3 `/pages/laporan-sesi.js` (Session Report Form) [INFERRED]

**Purpose:** Form for mentors to submit Bangkit session reports

**API Endpoints Used:**
- `GET /api/menteeData?name={name}&programType=bangkit`
- `POST /api/submitReport`

**Expected to use:**
- Mentor selection (from session/mapping)
- Mentee selection
- Session details (date, time, platform)
- Session summary
- Initiatives (4 max)
- Sales data (12 months)
- Image uploads (session, premises, profile, GrowthWheel, MIA proof)
- Reflections (Session 1 only)
- GrowthWheel scores

---

### 2.4 `/pages/laporan-maju.js` (Maju Report Form) [INFERRED]

**Purpose:** Form for mentors to submit Maju program reports

**API Endpoints Used:**
- `GET /api/menteeData?name={name}&programType=maju`
- `POST /api/submitMajuReport`

**Expected to use:**
- Similar structure to laporan-sesi but for Maju program
- Different data fields (financial data, mentoring findings)

---

## PART 3: COMPLETE DATABASE SCHEMA REQUIREMENTS

### 3.1 Core Tables

#### Table: `users`

**Purpose:** User authentication and authorization

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier | All user-related endpoints |
| name | VARCHAR(255) | NOT NULL | Full name | All |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address (login) | All |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active' | User status: active, inactive, suspended | `/api/coordinator/mentors`, `/api/dashboard/stats` |
| roles | TEXT[] | NOT NULL, DEFAULT '{}' | User roles: mentor, premier_mentor, program_coordinator, system_admin, etc. | `/api/dashboard/stats`, auth middleware |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp | All |
| last_login | TIMESTAMPTZ | | Last login timestamp | Optional |

**Relationships:**
- One user can have many mentor_profiles (usually 1:1)
- One user can have many mentor_assignments (as mentor)
- One user can have many activity_logs (as actor)

**Indexes:**
- PRIMARY: id
- UNIQUE: email
- INDEX: status
- INDEX: roles (GIN index for array)

**Sample Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Ahmad bin Hassan",
  "email": "ahmad@example.com",
  "status": "active",
  "roles": ["mentor", "premier_mentor"],
  "created_at": "2024-06-15T10:00:00Z",
  "updated_at": "2025-01-26T10:00:00Z",
  "last_login": "2025-01-26T09:00:00Z"
}
```

---

#### Table: `mentor_profiles`

**Purpose:** Extended profile information for mentors

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Profile ID | All mentor endpoints |
| user_id | UUID | UNIQUE, NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Foreign key to users | All |
| programs | TEXT[] | NOT NULL, DEFAULT '{}' | Programs mentor works with: Bangkit, Maju, TUBF | `/api/coordinator/mentors`, `/api/coordinator/mentees` |
| regions | TEXT[] | NOT NULL, DEFAULT '{}' | Regions/states mentor covers | `/api/coordinator/mentors` |
| max_mentees | INTEGER | NOT NULL, DEFAULT 10 | Maximum mentees allowed | `/api/coordinator/assign-mentor` |
| is_premier | BOOLEAN | NOT NULL, DEFAULT FALSE | Premier mentor status | `/api/coordinator/mentors` |
| phone | VARCHAR(50) | | Contact phone number | `/api/coordinator/mentors` |
| bio | TEXT | | Mentor biography | `/api/coordinator/mentors` |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Profile creation | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update | All |

**Relationships:**
- FOREIGN KEY: user_id REFERENCES users(id) ON DELETE CASCADE
- One mentor_profile belongs to one user
- One mentor_profile can have many mentor_assignments

**Indexes:**
- PRIMARY: id
- UNIQUE: user_id
- INDEX: programs (GIN index for array)
- INDEX: regions (GIN index for array)

**Sample Data:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "programs": ["Bangkit", "Maju"],
  "regions": ["Selangor", "Kuala Lumpur"],
  "max_mentees": 12,
  "is_premier": true,
  "phone": "+60123456789",
  "bio": "Experienced business mentor with 10 years in tech startups",
  "created_at": "2024-06-15T10:00:00Z",
  "updated_at": "2025-01-26T10:00:00Z"
}
```

---

#### Table: `entrepreneurs`

**Purpose:** Mentee/entrepreneur information

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Entrepreneur ID | All mentee endpoints |
| name | VARCHAR(255) | NOT NULL | Full name | `/api/coordinator/dashboard-summary`, `/api/coordinator/mentees` |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address | All |
| business_name | VARCHAR(255) | | Business/company name | All |
| phone | VARCHAR(50) | | Contact phone | All |
| state | VARCHAR(100) | | State/region | All |
| program | VARCHAR(100) | | Program: Bangkit, Maju, TUBF | All |
| cohort | VARCHAR(100) | | Batch/cohort: "Batch 5", "Batch 4" | All |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active' | Entrepreneur status | `/api/coordinator/mentees` |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update | All |

**Relationships:**
- One entrepreneur can have many mentor_assignments
- One entrepreneur can have many sessions

**Indexes:**
- PRIMARY: id
- UNIQUE: email
- INDEX: program
- INDEX: cohort
- INDEX: state
- INDEX: status

**Sample Data:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Siti Nurhaliza",
  "email": "siti@mybusiness.com",
  "business_name": "Siti's Bakery",
  "phone": "+60198765432",
  "state": "Selangor",
  "program": "Maju",
  "cohort": "Batch 3",
  "status": "active",
  "created_at": "2024-08-01T10:00:00Z",
  "updated_at": "2025-01-26T10:00:00Z"
}
```

---

#### Table: `mentor_assignments`

**Purpose:** Track mentor-mentee relationships

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Assignment ID | All assignment endpoints |
| entrepreneur_id | UUID | NOT NULL, REFERENCES entrepreneurs(id) ON DELETE CASCADE | Mentee/entrepreneur | All |
| mentor_id | UUID | REFERENCES users(id) ON DELETE SET NULL | Assigned mentor (nullable for unassigned) | All |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'active' | Assignment status: active, inactive, completed | All |
| assigned_at | TIMESTAMPTZ | | When mentor was assigned | All |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Assignment record creation | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update | All |

**Relationships:**
- FOREIGN KEY: entrepreneur_id REFERENCES entrepreneurs(id) ON DELETE CASCADE
- FOREIGN KEY: mentor_id REFERENCES users(id) ON DELETE SET NULL
- One assignment belongs to one entrepreneur
- One assignment belongs to one mentor (or null)

**Indexes:**
- PRIMARY: id
- INDEX: entrepreneur_id
- INDEX: mentor_id
- INDEX: status
- UNIQUE: (entrepreneur_id, status) WHERE status = 'active' -- Only one active assignment per entrepreneur

**Sample Data:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "entrepreneur_id": "770e8400-e29b-41d4-a716-446655440002",
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "assigned_at": "2024-08-15T10:00:00Z",
  "created_at": "2024-08-15T10:00:00Z",
  "updated_at": "2024-08-15T10:00:00Z"
}
```

---

#### Table: `sessions`

**Purpose:** Track mentoring sessions

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Session ID | Session endpoints |
| entrepreneur_id | UUID | NOT NULL, REFERENCES entrepreneurs(id) ON DELETE CASCADE | Mentee | `/api/coordinator/mentees` |
| mentor_id | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Mentor | Session endpoints |
| session_date | DATE | NOT NULL | Date of session | All |
| session_time | TIME | | Time of session | All |
| platform | VARCHAR(100) | | Platform: Google Meet, Zoom, In-person | All |
| Status | VARCHAR(50) | | Session status: Selesai, MIA, Pending | `/api/coordinator/mentees` (case-sensitive!) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update | All |

**⚠️ CRITICAL:** Column name is `Status` (capital S) not `status`

**Relationships:**
- FOREIGN KEY: entrepreneur_id REFERENCES entrepreneurs(id) ON DELETE CASCADE
- FOREIGN KEY: mentor_id REFERENCES users(id) ON DELETE CASCADE

**Indexes:**
- PRIMARY: id
- INDEX: entrepreneur_id
- INDEX: mentor_id
- INDEX: session_date
- INDEX: Status

**Sample Data:**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "entrepreneur_id": "770e8400-e29b-41d4-a716-446655440002",
  "mentor_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_date": "2025-01-20",
  "session_time": "14:00:00",
  "platform": "Google Meet",
  "Status": "Selesai",
  "created_at": "2025-01-20T16:00:00Z",
  "updated_at": "2025-01-20T16:00:00Z"
}
```

---

#### Table: `activity_logs`

**Purpose:** Audit log for coordinator actions

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Log ID | Activity logging |
| user_id | UUID | NOT NULL, REFERENCES users(id) | User who performed action | `/api/coordinator/assign-mentor` |
| action | VARCHAR(100) | NOT NULL | Action type: mentee_assigned, etc. | All |
| table_name | VARCHAR(100) | | Table affected | All |
| record_id | VARCHAR(255) | | Record ID affected | All |
| metadata | JSONB | | Additional data | All |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When action occurred | All |

**Relationships:**
- FOREIGN KEY: user_id REFERENCES users(id)

**Indexes:**
- PRIMARY: id
- INDEX: user_id
- INDEX: action
- INDEX: created_at
- INDEX: metadata (GIN index)

**Sample Data:**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "user_id": "660e8400-e29b-41d4-a716-446655440001",
  "action": "mentee_assigned",
  "table_name": "mentor_assignments",
  "record_id": "770e8400-e29b-41d4-a716-446655440002",
  "metadata": {
    "menteeId": "770e8400-e29b-41d4-a716-446655440002",
    "mentorId": "550e8400-e29b-41d4-a716-446655440000",
    "mentorName": "Ahmad bin Hassan",
    "program": "Bangkit",
    "reason": "New assignment",
    "notes": "Specializes in tech startups",
    "assignedBy": "Coordinator Name",
    "availableSlots": 1,
    "previousMentor": "none"
  },
  "created_at": "2025-01-26T10:00:00Z"
}
```

---

### 3.2 Monitoring Tables

#### Table: `dual_write_logs`

**Purpose:** Track dual-write operations to Sheets and Supabase

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Log ID | Monitoring endpoints |
| operation | VARCHAR(50) | NOT NULL | Operation type: INSERT, UPDATE, DELETE | All |
| table_name | VARCHAR(100) | NOT NULL | Table/sheet affected | All |
| record_id | VARCHAR(255) | | Record ID | All |
| sheets_success | BOOLEAN | NOT NULL | Sheets write succeeded | All |
| supabase_success | BOOLEAN | NOT NULL | Supabase write succeeded | All |
| sheets_error | TEXT | | Sheets error message | All |
| supabase_error | TEXT | | Supabase error message | All |
| duration_ms | INTEGER | | Operation duration | All |
| metadata | JSONB | | Additional data | All |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When operation occurred | All |

**Indexes:**
- PRIMARY: id
- INDEX: operation
- INDEX: table_name
- INDEX: created_at
- INDEX: sheets_success
- INDEX: supabase_success

---

#### Table: `data_discrepancies`

**Purpose:** Track data mismatches between Sheets and Supabase

| Column Name | Data Type | Constraints | Description | Used By |
|-------------|-----------|-------------|-------------|---------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Discrepancy ID | `/api/monitoring/discrepancies` |
| table_name | VARCHAR(100) | NOT NULL | Table with discrepancy | All |
| record_id | VARCHAR(255) | NOT NULL | Record ID | All |
| field_name | VARCHAR(100) | NOT NULL | Field with mismatch | All |
| sheets_value | TEXT | | Value in Sheets | All |
| supabase_value | TEXT | | Value in Supabase | All |
| severity | VARCHAR(50) | NOT NULL | Severity: low, medium, high, critical | All |
| detected_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When detected | All |
| resolved | BOOLEAN | NOT NULL, DEFAULT FALSE | Is resolved | All |
| resolved_at | TIMESTAMPTZ | | When resolved | All |
| resolved_by | VARCHAR(255) | | Who resolved it | All |
| resolution_notes | TEXT | | Resolution notes | All |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation | All |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update | All |

**Indexes:**
- PRIMARY: id
- INDEX: table_name
- INDEX: severity
- INDEX: resolved
- INDEX: detected_at

---

### 3.3 Database Views

#### View: `view_program_summary`

**Purpose:** Aggregated program statistics for coordinator dashboard

**SQL Definition:**
```sql
CREATE OR REPLACE VIEW view_program_summary AS
SELECT
  (SELECT COUNT(*) FROM entrepreneurs WHERE status = 'active') AS total_mentees,
  (SELECT COUNT(DISTINCT mentor_id)
   FROM mentor_assignments
   WHERE status = 'active' AND mentor_id IS NOT NULL) AS active_mentors,
  (SELECT ROUND(
     COUNT(CASE WHEN s.Status IN ('Selesai', 'completed') THEN 1 END)::NUMERIC /
     NULLIF(COUNT(*)::NUMERIC, 0) * 100, 2
   ) FROM sessions s) AS overall_completion_pct,
  (SELECT COUNT(*)
   FROM sessions
   WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
     AND Status IN ('Selesai', 'completed')) AS reports_this_month,
  (SELECT COUNT(*)
   FROM mentor_assignments
   WHERE status = 'active' AND mentor_id IS NULL) AS unassigned_mentees,
  (SELECT COUNT(DISTINCT ma.mentor_id)
   FROM mentor_assignments ma
   JOIN sessions s ON s.entrepreneur_id = ma.entrepreneur_id
   WHERE ma.status = 'active'
     AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
     AND s.Status IS NULL OR s.Status = 'Pending') AS pending_mentors,
  (SELECT COUNT(DISTINCT ma.mentor_id)
   FROM mentor_assignments ma
   LEFT JOIN sessions s ON s.entrepreneur_id = ma.entrepreneur_id
     AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
   WHERE ma.status = 'active'
     AND s.id IS NULL) AS critical_mentors,
  (SELECT COUNT(*)
   FROM sessions
   WHERE session_date >= CURRENT_DATE
     AND session_date < CURRENT_DATE + INTERVAL '7 days'
     AND Status IS NULL OR Status = 'Pending') AS sessions_due_this_week;
```

**Columns:**
- `total_mentees` - INTEGER
- `active_mentors` - INTEGER
- `overall_completion_pct` - NUMERIC(5,2)
- `reports_this_month` - INTEGER
- `unassigned_mentees` - INTEGER
- `pending_mentors` - INTEGER
- `critical_mentors` - INTEGER
- `sessions_due_this_week` - INTEGER

**Used By:** `/api/coordinator/dashboard-summary`

---

#### View: `todays_summary`

**Purpose:** Today's monitoring statistics

**SQL Definition:**
```sql
CREATE OR REPLACE VIEW todays_summary AS
SELECT
  COUNT(*) AS total_operations,
  ROUND(AVG(CASE WHEN sheets_success THEN 100 ELSE 0 END), 2) AS sheets_success_rate,
  ROUND(AVG(CASE WHEN supabase_success THEN 100 ELSE 0 END), 2) AS supabase_success_rate,
  ROUND(AVG(CASE WHEN sheets_success AND supabase_success THEN 100 ELSE 0 END), 2) AS both_success_rate,
  COUNT(*) FILTER (WHERE NOT sheets_success OR NOT supabase_success) AS total_errors
FROM dual_write_logs
WHERE DATE(created_at) = CURRENT_DATE;
```

**Used By:** `/api/monitoring/stats`

---

## PART 4: ENVIRONMENT CONFIGURATION

### 4.1 Required Environment Variables

✅ **Present in .env.local:**

**Supabase:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://oogrwqxlwyoswyfqgxxi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**Google Sheets:**
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=mentor-app-service-account@mentor-reporting-tool.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
SHEET_ID=1a0Q5pfjJQK79rx7GnTHkF60FE2DpJE-YbWrW8qEBtCw
GOOGLE_CREDENTIALS_BASE64=ewogIC...
```

**Google Sheets IDs:**
```env
GOOGLE_SHEETS_REPORT_ID="1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w"
GOOGLE_SHEETS_MAPPING_ID="1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w"
GOOGLE_SHEETS_BANK_ID="1mrlv53zXbsqOP7h6KuPhopwtufpJpLXbYCrqGCDg4X8"
GOOGLE_SHEETS_MAJU_REPORT_ID="1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w"
```

**Authentication:**
```env
GOOGLE_CLIENT_ID=766145730533-...
GOOGLE_CLIENT_SECRET=GOCSPX-...
NEXTAUTH_SECRET=this-is-a-very-secret-key-for-my-mentor-app
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAILS=naemmukhtar@gmail.com
SUPER_ADMIN_EMAIL=naemmukhtar@gmail.com
```

**Sheet Tab Names:**
```env
MAPPING_TAB=mapping
REPORT_TAB=V8
LAPORAN_MAJU_TAB=LaporanMaju
```

### 4.2 Security Assessment

⚠️ **SECURITY CONCERNS:**
1. Service role key is committed (should be in secrets manager)
2. NextAuth secret is weak and visible
3. Admin emails hardcoded

✅ **CORRECTLY CONFIGURED:**
1. Using service account for Sheets API
2. Separate anon and service keys for Supabase
3. Environment variables properly prefixed (NEXT_PUBLIC_ for client-side)

---

## PART 5: CURRENT SUPABASE STATE VERIFICATION

**ACTION REQUIRED:** Run the following SQL queries against your Supabase instance to verify current state:

```sql
-- A. List all existing tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- B. For each table, get current schema
-- Run this for each table found in step A
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users' -- Replace with each table name
ORDER BY ordinal_position;

-- C. Check existing foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- D. Check existing indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- E. Check existing views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';

-- F. Check row counts
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

**I cannot execute these queries directly.** You must run them in your Supabase SQL Editor and provide the results for gap analysis.

---

## PART 6: GAP ANALYSIS

**STATUS:** ⚠️ Awaiting Supabase query results from PART 5

Once you provide the current schema, I will compare:
1. Required tables vs Existing tables
2. Required columns vs Existing columns
3. Required foreign keys vs Existing foreign keys
4. Required indexes vs Existing indexes
5. Required views vs Existing views
6. Data types match
7. Constraints match

**Expected Gaps (Based on Code Analysis):**

### Likely Missing:
1. **Table `entrepreneurs`** - Referenced but may not exist
2. **Table `mentor_assignments`** - Referenced but schema unclear
3. **Table `mentor_profiles`** - Referenced but may need columns added
4. **Table `sessions`** - Referenced but may need `Status` column (capital S)
5. **Table `activity_logs`** - Referenced but likely doesn't exist
6. **View `view_program_summary`** - Definitely doesn't exist (code checks for error)
7. **View `todays_summary`** - May not exist
8. **Table `dual_write_logs`** - For monitoring, may not exist
9. **Table `data_discrepancies`** - For monitoring, may not exist

### Likely Existing (from previous migration):
1. **Table `users`** - NextAuth requirement, likely exists
2. Some form of profiles table

---

## PART 7: MIGRATION PLAN

### Phase 0: Backup
```sql
-- ALWAYS backup before migrations!
-- In Supabase Dashboard > Database > Backups
-- Or export via pg_dump
```

### Phase 1: Create Core Tables

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create entrepreneurs table
CREATE TABLE IF NOT EXISTS public.entrepreneurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  business_name VARCHAR(255),
  phone VARCHAR(50),
  state VARCHAR(100),
  program VARCHAR(100),
  cohort VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for entrepreneurs
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_program ON entrepreneurs(program);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_cohort ON entrepreneurs(cohort);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_state ON entrepreneurs(state);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_status ON entrepreneurs(status);

-- Add comment
COMMENT ON TABLE entrepreneurs IS 'Mentee/entrepreneur profiles';

-- 2. Ensure users table has correct structure
-- Check if users table exists first
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      roles TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );
  END IF;
END $$;

-- Add missing columns to users if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN(roles);

-- 3. Create or update mentor_profiles table
CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  programs TEXT[] NOT NULL DEFAULT '{}',
  regions TEXT[] NOT NULL DEFAULT '{}',
  max_mentees INTEGER NOT NULL DEFAULT 10,
  is_premier BOOLEAN NOT NULL DEFAULT FALSE,
  phone VARCHAR(50),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS programs TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS regions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS max_mentees INTEGER NOT NULL DEFAULT 10;
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS is_premier BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE mentor_profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create indexes for mentor_profiles
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_programs ON mentor_profiles USING GIN(programs);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_regions ON mentor_profiles USING GIN(regions);

-- 4. Create mentor_assignments table
CREATE TABLE IF NOT EXISTS public.mentor_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entrepreneur_id UUID NOT NULL REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_entrepreneur ON mentor_assignments(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentor ON mentor_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_status ON mentor_assignments(status);

-- Create unique constraint for one active assignment per entrepreneur
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_assignments_unique_active
ON mentor_assignments(entrepreneur_id, status)
WHERE status = 'active';

-- 5. Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entrepreneur_id UUID NOT NULL REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME,
  platform VARCHAR(100),
  "Status" VARCHAR(50), -- Note: Capital S for backward compatibility
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_entrepreneur ON sessions(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor ON sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions("Status");

-- 6. Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_metadata ON activity_logs USING GIN(metadata);
```

### Phase 2: Create Monitoring Tables

```sql
-- 1. Create dual_write_logs table
CREATE TABLE IF NOT EXISTS public.dual_write_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255),
  sheets_success BOOLEAN NOT NULL,
  supabase_success BOOLEAN NOT NULL,
  sheets_error TEXT,
  supabase_error TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dual_write_logs_operation ON dual_write_logs(operation);
CREATE INDEX IF NOT EXISTS idx_dual_write_logs_table ON dual_write_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_dual_write_logs_created ON dual_write_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_dual_write_logs_sheets_success ON dual_write_logs(sheets_success);
CREATE INDEX IF NOT EXISTS idx_dual_write_logs_supabase_success ON dual_write_logs(supabase_success);

-- 2. Create data_discrepancies table
CREATE TABLE IF NOT EXISTS public.data_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  sheets_value TEXT,
  supabase_value TEXT,
  severity VARCHAR(50) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_data_discrepancies_table ON data_discrepancies(table_name);
CREATE INDEX IF NOT EXISTS idx_data_discrepancies_severity ON data_discrepancies(severity);
CREATE INDEX IF NOT EXISTS idx_data_discrepancies_resolved ON data_discrepancies(resolved);
CREATE INDEX IF NOT EXISTS idx_data_discrepancies_detected ON data_discrepancies(detected_at);
```

### Phase 3: Create Views

```sql
-- 1. Create view_program_summary
CREATE OR REPLACE VIEW view_program_summary AS
SELECT
  (SELECT COUNT(*) FROM entrepreneurs WHERE status = 'active') AS total_mentees,
  (SELECT COUNT(DISTINCT mentor_id)
   FROM mentor_assignments
   WHERE status = 'active' AND mentor_id IS NOT NULL) AS active_mentors,
  (SELECT ROUND(
     COUNT(CASE WHEN s."Status" IN ('Selesai', 'completed') THEN 1 END)::NUMERIC /
     NULLIF(COUNT(*)::NUMERIC, 0) * 100, 2
   ) FROM sessions s) AS overall_completion_pct,
  (SELECT COUNT(*)
   FROM sessions
   WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
     AND "Status" IN ('Selesai', 'completed')) AS reports_this_month,
  (SELECT COUNT(*)
   FROM mentor_assignments
   WHERE status = 'active' AND mentor_id IS NULL) AS unassigned_mentees,
  (SELECT COUNT(DISTINCT ma.mentor_id)
   FROM mentor_assignments ma
   JOIN sessions s ON s.entrepreneur_id = ma.entrepreneur_id
   WHERE ma.status = 'active'
     AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
     AND (s."Status" IS NULL OR s."Status" = 'Pending')) AS pending_mentors,
  (SELECT COUNT(DISTINCT ma.mentor_id)
   FROM mentor_assignments ma
   LEFT JOIN sessions s ON s.entrepreneur_id = ma.entrepreneur_id
     AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
   WHERE ma.status = 'active'
     AND s.id IS NULL) AS critical_mentors,
  (SELECT COUNT(*)
   FROM sessions
   WHERE session_date >= CURRENT_DATE
     AND session_date < CURRENT_DATE + INTERVAL '7 days'
     AND ("Status" IS NULL OR "Status" = 'Pending')) AS sessions_due_this_week;

-- 2. Create todays_summary view
CREATE OR REPLACE VIEW todays_summary AS
SELECT
  COUNT(*) AS total_operations,
  ROUND(AVG(CASE WHEN sheets_success THEN 100 ELSE 0 END), 2) AS sheets_success_rate,
  ROUND(AVG(CASE WHEN supabase_success THEN 100 ELSE 0 END), 2) AS supabase_success_rate,
  ROUND(AVG(CASE WHEN sheets_success AND supabase_success THEN 100 ELSE 0 END), 2) AS both_success_rate,
  COUNT(*) FILTER (WHERE NOT sheets_success OR NOT supabase_success) AS total_errors
FROM dual_write_logs
WHERE DATE(created_at) = CURRENT_DATE;
```

### Phase 4: Create Triggers for updated_at

```sql
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entrepreneurs_updated_at BEFORE UPDATE ON entrepreneurs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentor_profiles_updated_at BEFORE UPDATE ON mentor_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mentor_assignments_updated_at BEFORE UPDATE ON mentor_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_discrepancies_updated_at BEFORE UPDATE ON data_discrepancies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Phase 5: Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrepreneurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dual_write_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_discrepancies ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API routes using service key)
-- These policies allow full access when using SUPABASE_SERVICE_ROLE_KEY
CREATE POLICY "Service role can do everything on users"
ON users FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on entrepreneurs"
ON entrepreneurs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on mentor_profiles"
ON mentor_profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on mentor_assignments"
ON mentor_assignments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on sessions"
ON sessions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on activity_logs"
ON activity_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on dual_write_logs"
ON dual_write_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on data_discrepancies"
ON data_discrepancies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: If you need anon key access (for client-side), add separate policies
-- For now, all API routes use service_role key, so this is sufficient
```

### Phase 6: Verification Queries

```sql
-- Run after migration to verify
SELECT 'Table: ' || table_name || ', Rows: ' || n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY table_name;

-- Check foreign keys created
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';

-- Check views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';

-- Test view_program_summary
SELECT * FROM view_program_summary;

-- Test todays_summary
SELECT * FROM todays_summary;
```

---

## PART 8: TESTING CHECKLIST

### Phase 0: Database Verification

- [ ] **Run migration scripts** in order (Phase 1-6)
- [ ] **All required tables exist**
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
  ```
  Expected: users, entrepreneurs, mentor_profiles, mentor_assignments, sessions, activity_logs, dual_write_logs, data_discrepancies

- [ ] **All columns have correct data types**
  - Run schema check for each table
  - Verify UUID columns
  - Verify TEXT[] arrays
  - Verify TIMESTAMPTZ timestamps
  - Verify **sessions.Status** is capitalized

- [ ] **All foreign keys are set up**
  ```sql
  -- Should show 6+ foreign key relationships
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
  ```

- [ ] **All indexes are created**
  ```sql
  SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
  -- Should be 25+ indexes
  ```

- [ ] **Views work correctly**
  ```sql
  SELECT * FROM view_program_summary; -- Should return 1 row with 8 columns
  SELECT * FROM todays_summary; -- Should return 1 row with 5 columns
  ```

- [ ] **Can insert sample data without errors**
  ```sql
  -- Test user insert
  INSERT INTO users (name, email, roles)
  VALUES ('Test User', 'test@example.com', ARRAY['mentor'])
  RETURNING id;

  -- Test entrepreneur insert
  INSERT INTO entrepreneurs (name, email, program, cohort)
  VALUES ('Test Mentee', 'mentee@example.com', 'Bangkit', 'Batch 5')
  RETURNING id;

  -- Clean up
  DELETE FROM users WHERE email = 'test@example.com';
  DELETE FROM entrepreneurs WHERE email = 'mentee@example.com';
  ```

### Phase 1: API Endpoint Testing

Create a test file `test-endpoints.http` (use with REST Client VS Code extension):

```http
### 1. Test Health Check
GET http://localhost:3000/api/monitoring/health

### 2. Test Dashboard Summary (requires auth)
GET http://localhost:3000/api/coordinator/dashboard-summary
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN

### 3. Test Mentors List
GET http://localhost:3000/api/coordinator/mentors
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN

### 4. Test Mentees List
GET http://localhost:3000/api/coordinator/mentees
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN

### 5. Test Assign Mentor
POST http://localhost:3000/api/coordinator/assign-mentor
Content-Type: application/json
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN

{
  "menteeId": "ENTREPRENEUR_UUID",
  "mentorId": "USER_UUID",
  "notes": "Test assignment"
}

### 6. Test Monitoring Stats
GET http://localhost:3000/api/monitoring/stats?period=today

### 7. Test Discrepancies
GET http://localhost:3000/api/monitoring/discrepancies?resolved=false

### 8. Test Dashboard Stats
GET http://localhost:3000/api/dashboard/stats
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN
```

**Checklist:**
- [ ] `/api/monitoring/health` - Returns 200 with healthy status
- [ ] `/api/coordinator/dashboard-summary` - Returns summary with 8 KPIs
- [ ] `/api/coordinator/mentors` - Returns array of mentors
- [ ] `/api/coordinator/mentees` - Returns array of mentees
- [ ] `/api/coordinator/assign-mentor` - Successfully assigns mentor
- [ ] `/api/monitoring/stats` - Returns monitoring data
- [ ] `/api/monitoring/discrepancies` - Returns discrepancies (may be empty)
- [ ] `/api/dashboard/stats` - Returns role-appropriate stats

**Error Cases:**
- [ ] All endpoints return proper error codes (401 unauthorized, 404 not found, etc.)
- [ ] Missing required fields return 400 with error message
- [ ] Invalid UUIDs return 404 or 400

### Phase 2: Workflow Testing

#### Workflow 1: Coordinator Dashboard Access

**Steps:**
1. [ ] Login as program coordinator
2. [ ] Navigate to `/coordinator/dashboard`
3. [ ] Verify 8 KPI cards display with real data
4. [ ] Verify mentors table loads
5. [ ] Verify mentees grid/cards load
6. [ ] Filter mentees by status → verify results
7. [ ] Search for a mentee → verify results
8. [ ] Refresh data → verify new request made

**Expected Results:**
- All data loads without errors
- Filters work correctly
- Search is responsive
- No console errors

#### Workflow 2: Mentor Assignment

**Steps:**
1. [ ] Find an unassigned mentee
2. [ ] Click "Assign" button
3. [ ] Modal opens with mentor selection
4. [ ] Select a mentor with available slots
5. [ ] Add assignment notes
6. [ ] Click "Assign Mentor"
7. [ ] Verify success message
8. [ ] Check activity_logs table for logged action
9. [ ] Verify mentor_assignments table updated

**SQL Verification:**
```sql
SELECT * FROM mentor_assignments
WHERE entrepreneur_id = 'MENTEE_UUID'
ORDER BY created_at DESC LIMIT 1;

SELECT * FROM activity_logs
WHERE action = 'mentee_assigned'
ORDER BY created_at DESC LIMIT 1;
```

#### Workflow 3: Bulk Assignment

**Steps:**
1. [ ] Filter mentees to show unassigned
2. [ ] Select 3 unassigned mentees via checkboxes
3. [ ] Choose mentor with 3+ available slots
4. [ ] Click "Assign Selected"
5. [ ] Confirm assignment
6. [ ] Verify success message with count
7. [ ] Verify all 3 assignments in database

**SQL Verification:**
```sql
SELECT COUNT(*) FROM mentor_assignments
WHERE mentor_id = 'MENTOR_UUID' AND status = 'active';
-- Should match expected count
```

#### Workflow 4: View Unassigned Mentees

**Steps:**
1. [ ] Scroll to "Unassigned Mentees" table
2. [ ] Verify table shows entrepreneurs with no mentor
3. [ ] Click "Assign" on one mentee
4. [ ] Complete assignment
5. [ ] Refresh page
6. [ ] Verify mentee removed from unassigned table

### Phase 3: Data Integrity Testing

**Test 1: Foreign Key Constraints**
```sql
-- Should FAIL: Cannot assign to non-existent entrepreneur
INSERT INTO mentor_assignments (entrepreneur_id, mentor_id, status)
VALUES ('00000000-0000-0000-0000-000000000000',
        (SELECT id FROM users LIMIT 1), 'active');
-- Expected: ERROR:  insert or update on table "mentor_assignments"
-- violates foreign key constraint

-- Should SUCCEED: Deleting entrepreneur cascades to assignments
INSERT INTO entrepreneurs (name, email, program)
VALUES ('Temp Test', 'temp@test.com', 'Test')
RETURNING id; -- Save this ID

INSERT INTO mentor_assignments (entrepreneur_id, status)
VALUES ('[ID_FROM_ABOVE]', 'active');

DELETE FROM entrepreneurs WHERE email = 'temp@test.com';

-- Verify assignment deleted
SELECT * FROM mentor_assignments WHERE entrepreneur_id = '[ID_FROM_ABOVE]';
-- Should return 0 rows
```

**Test 2: Unique Constraints**
```sql
-- Should FAIL: Duplicate active assignment
INSERT INTO entrepreneurs (name, email, program)
VALUES ('Unique Test', 'unique@test.com', 'Test')
RETURNING id; -- Save as MENTEE_ID

INSERT INTO mentor_assignments (entrepreneur_id, status)
VALUES ('[MENTEE_ID]', 'active');

-- This should FAIL
INSERT INTO mentor_assignments (entrepreneur_id, status)
VALUES ('[MENTEE_ID]', 'active');
-- Expected: ERROR: duplicate key value violates unique constraint

-- Clean up
DELETE FROM entrepreneurs WHERE email = 'unique@test.com';
```

**Test 3: Cascading Deletes**
```sql
-- Create test data
INSERT INTO users (name, email, roles)
VALUES ('Cascade Test', 'cascade@test.com', ARRAY['mentor'])
RETURNING id; -- Save as USER_ID

INSERT INTO mentor_profiles (user_id, programs)
VALUES ('[USER_ID]', ARRAY['Test']);

-- Delete user
DELETE FROM users WHERE email = 'cascade@test.com';

-- Verify profile deleted
SELECT * FROM mentor_profiles WHERE user_id = '[USER_ID]';
-- Should return 0 rows
```

**Test 4: View Accuracy**
```sql
-- Check view calculations match raw queries
WITH summary_data AS (
  SELECT
    (SELECT COUNT(*) FROM entrepreneurs WHERE status = 'active') as total_mentees,
    (SELECT COUNT(DISTINCT mentor_id) FROM mentor_assignments WHERE status = 'active' AND mentor_id IS NOT NULL) as active_mentors
)
SELECT
  s.total_mentees = v.total_mentees as mentees_match,
  s.active_mentors = v.active_mentors as mentors_match
FROM summary_data s, view_program_summary v;
-- Both should be TRUE
```

**Checklist:**
- [ ] Foreign key constraints prevent invalid data
- [ ] Unique constraints work correctly
- [ ] Cascading deletes work as expected
- [ ] Views return accurate aggregated data
- [ ] Triggers update timestamps correctly
- [ ] No orphaned records after deletions

### Phase 4: Performance Testing

**Test Query Performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM mentor_assignments ma
JOIN entrepreneurs e ON e.id = ma.entrepreneur_id
JOIN users u ON u.id = ma.mentor_id
WHERE ma.status = 'active';
-- Should use indexes, execution time < 50ms for 1000 rows

EXPLAIN ANALYZE
SELECT * FROM view_program_summary;
-- Execution time should be < 200ms
```

**Checklist:**
- [ ] All indexed queries use indexes (check EXPLAIN ANALYZE)
- [ ] View queries complete in < 500ms
- [ ] No sequential scans on large tables
- [ ] JOIN operations use indexes

---

## PART 9: POTENTIAL ISSUES & RISKS

### 9.1 Critical Issues

#### ⚠️ ISSUE 1: Hybrid Architecture Complexity

**Problem:** System reads from BOTH Supabase AND Google Sheets inconsistently
- `/api/coordinator/mentees` reads from Supabase for assignments, but may reference Sheets
- `/api/coordinator/mentors` reads mentor capacity from Supabase, report counts from Sheets
- `/api/submitReport` writes ONLY to Sheets, NOT Supabase
- `/api/menteeData` reads ONLY from Sheets
- `/api/mentor-stats` reads ONLY from Sheets

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Data inconsistency between systems
- Confusion about source of truth
- Difficult to debug data issues
- Migration is incomplete

**Recommendation:**
1. **Immediate:** Document which endpoint uses which data source
2. **Short-term:** Add dual-write to `/api/submitReport` to write to BOTH Sheets AND Supabase
3. **Long-term:** Complete migration to Supabase as single source of truth

---

#### ⚠️ ISSUE 2: Session Status Column Name

**Problem:** The `sessions` table uses `"Status"` (capital S) not `status`

**Risk Level:** 🟡 **HIGH**

**Impact:**
- Case-sensitive queries will fail
- PostgreSQL column names are case-insensitive unless quoted
- Code uses both `s.Status` and `s."Status"` inconsistently

**Evidence:**
```sql
-- /api/coordinator/mentees.js line 158
const menteeSessions = sessionsData?.filter(s =>
  s.Status?.toLowerCase() === 'selesai' || s.Status?.toLowerCase() === 'completed'
);
```

**Recommendation:**
1. **Standardize to lowercase** `status` for PostgreSQL best practices
2. **OR** Always use quoted `"Status"` in all queries
3. Update all code references consistently
4. Add migration to rename column if changing

---

#### ⚠️ ISSUE 3: Missing Dual-Write Implementation

**Problem:** Report submission only writes to Google Sheets

**Code Location:** `/api/submitReport.js`

**Risk Level:** 🔴 **CRITICAL**

**Impact:**
- Supabase sessions table will be empty/stale
- Dashboard stats based on Supabase will be wrong
- Migration cannot be completed

**Recommendation:**
1. Add dual-write to `submitReport.js`:
```javascript
// After successful Sheets write
const { error: supabaseError } = await supabase
  .from('sessions')
  .insert({
    entrepreneur_id: reportData.entrepreneurId, // Map from mentee name
    mentor_id: reportData.mentorId, // Map from mentor email
    session_date: reportData.sesi.date,
    session_time: reportData.sesi.time,
    platform: reportData.sesi.platform,
    Status: reportData.status // 'Selesai' or 'MIA'
  });
```

2. Log to `dual_write_logs` table
3. Handle errors gracefully (don't fail if one system fails)

---

#### ⚠️ ISSUE 4: Mentor Assignment Not Synced to Sheets

**Problem:** `/api/coordinator/assign-mentor` writes to Supabase but dashboard reads from Sheets

**Risk Level:** 🔴 **CRITICAL**

**Evidence:**
```javascript
// /api/coordinator/assign-mentor.js - Shows alert:
alert(`⚠️ IMPORTANT: To make this assignment permanent, you must manually update
the Google Sheets 'mapping' tab`);
```

**Impact:**
- Assignments made via UI don't persist
- Requires manual Sheets update
- Poor user experience

**Recommendation:**
1. Add dual-write to update Google Sheets mapping tab
2. Use Google Sheets API to update the row:
```javascript
const sheets = google.sheets({ version: 'v4', auth });
await sheets.spreadsheets.values.update({
  spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
  range: 'mapping!A:Z',
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [[...rowData]]
  }
});
```

3. Or migrate reading to Supabase completely

---

### 9.2 High Priority Issues

#### ⚠️ ISSUE 5: No Data Migration Script

**Problem:** Empty Supabase tables, all historical data in Sheets

**Risk Level:** 🟡 **HIGH**

**Impact:**
- Views return zeros
- Dashboard shows no data
- Cannot test properly

**Recommendation:**
Create migration script to import from Sheets to Supabase:
1. Read all data from Google Sheets (mapping, V8, LaporanMaju, batch)
2. Transform to match Supabase schema
3. Bulk insert into Supabase tables
4. Validate data integrity

See "Data Migration Script" in deliverables section.

---

#### ⚠️ ISSUE 6: Missing Monitoring Library

**Problem:** Code references `@/lib/monitoring/metrics-aggregator` and `@/lib/monitoring/dual-write-logger`

**Evidence:**
```javascript
// /api/monitoring/stats.js line 12
import { getLatestMetrics, getMetricsForRange } from '@/lib/monitoring/metrics-aggregator';

// /api/monitoring/health.js line 11
import { checkSystemHealth } from '@/lib/monitoring/dual-write-logger';
```

**Risk Level:** 🟡 **HIGH**

**Impact:**
- Monitoring endpoints will fail
- Cannot track dual-write success
- Cannot detect data discrepancies

**Recommendation:**
Create missing library files or endpoints will crash.

---

#### ⚠️ ISSUE 7: Auth Middleware Security

**Problem:** Multiple auth patterns used inconsistently

**Evidence:**
- Some use `requireRole(req, res, 'role')`
- Some use `requireAuth(req, res)`
- Some use `hasRole(user, 'role')`
- Some check `session?.user?.email`

**Risk Level:** 🟡 **HIGH**

**Impact:**
- Security vulnerabilities
- Inconsistent access control
- Hard to audit permissions

**Recommendation:**
1. Standardize on one auth pattern
2. Use middleware consistently
3. Audit all endpoints for proper auth checks

---

### 9.3 Medium Priority Issues

#### ⚠️ ISSUE 8: Hardcoded/Placeholder Data

**Problem:** Some endpoints return hardcoded data

**Evidence:**
```javascript
// /api/dashboard/stats.js
const totalReports = 316; // TODO: Query from actual reports table
const reportsThisMonth = 45; // Placeholder
const dualWriteSuccessRate = 99.7; // TODO: Calculate from actual dual-write logs
```

**Risk Level:** 🟠 **MEDIUM**

**Impact:**
- Inaccurate statistics
- Misleading dashboard
- Cannot trust data

**Recommendation:**
Replace all TODOs with actual queries.

---

#### ⚠️ ISSUE 9: No Batch/Round Table

**Problem:** Batch round information is read from Google Sheets only

**Risk Level:** 🟠 **MEDIUM**

**Impact:**
- Round calculations depend on Sheets availability
- Cannot query batch info efficiently
- Duplicate data source

**Recommendation:**
Create `batches` table:
```sql
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  program VARCHAR(100) NOT NULL,
  mentoring_round INTEGER NOT NULL,
  period VARCHAR(100),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

#### ⚠️ ISSUE 10: No Report Content Table

**Problem:** Report content (summary, initiatives, sales data) is only in Sheets

**Risk Level:** 🟠 **MEDIUM**

**Impact:**
- Cannot query report content from Supabase
- Limited analytics capabilities
- Dashboard limited to session counts only

**Recommendation:**
Create detailed report tables if needed:
- `session_reports` - Report metadata
- `session_initiatives` - Initiatives/focus areas
- `sales_data` - Monthly sales figures
- `session_images` - Image URLs

---

### 9.4 Low Priority Issues

#### ⚠️ ISSUE 11: Cache Invalidation Strategy

**Problem:** Manual cache deletion, no TTL strategy

**Risk Level:** 🟢 **LOW**

**Impact:**
- Stale data shown to users
- Manual cache management needed

**Recommendation:**
Implement Redis or proper cache strategy with TTLs.

---

#### ⚠️ ISSUE 12: No Pagination

**Problem:** API endpoints return all data without pagination

**Risk Level:** 🟢 **LOW**

**Impact:**
- Slow for large datasets
- High memory usage
- Poor performance at scale

**Recommendation:**
Add pagination parameters:
- `?page=1&limit=50`
- Return `{data: [], total: 1234, page: 1, pages: 25}`

---

### 9.5 Schema Design Issues

#### ⚠️ ISSUE 13: Entrepreneur vs Mentee Terminology

**Problem:** Database uses `entrepreneurs` but code uses "mentees"

**Risk Level:** 🟢 **LOW**

**Impact:**
- Confusion for developers
- Inconsistent naming

**Recommendation:**
Pick one term and use consistently. Consider aliasing in views:
```sql
CREATE VIEW mentees AS SELECT * FROM entrepreneurs;
```

---

#### ⚠️ ISSUE 14: No Report Status Tracking

**Problem:** No way to track if a session has been reported

**Risk Level:** 🟠 **MEDIUM**

**Impact:**
- Cannot distinguish "scheduled but not reported" from "reported"
- Status field is ambiguous

**Recommendation:**
Add `report_submitted_at` timestamp to sessions table.

---

## DELIVERABLES SUMMARY

### 1. Schema Specification Document ✅
**Location:** This document (PART 3)

### 2. Gap Analysis Report ⏳
**Status:** Awaiting Supabase query results
**Action Required:** Run queries from PART 5 and provide results

### 3. Complete Migration SQL ✅
**Location:** PART 7
**Files to Create:**
- `migration-001-core-tables.sql` (Phase 1)
- `migration-002-monitoring.sql` (Phase 2)
- `migration-003-views.sql` (Phase 3)
- `migration-004-triggers.sql` (Phase 4)
- `migration-005-rls.sql` (Phase 5)

### 4. Testing Checklist ✅
**Location:** PART 8
**File to Create:** `TESTING_CHECKLIST.md`

### 5. Risk Assessment ✅
**Location:** PART 9
**Critical Issues:** 4
**High Priority:** 3
**Medium Priority:** 4
**Low Priority:** 2

---

## NEXT STEPS

### Immediate (This Week):
1. ✅ Run PART 5 queries against Supabase
2. ✅ Run migration scripts from PART 7 in order
3. ✅ Create data migration script from Sheets to Supabase
4. ⚠️ Fix critical Issue #1: Add dual-write to submitReport
5. ⚠️ Fix critical Issue #4: Add dual-write to assign-mentor
6. ✅ Create monitoring library files

### Short-term (Next 2 Weeks):
1. Complete data migration from Sheets
2. Test all endpoints with real data
3. Fix all TODO/placeholder code
4. Implement proper error handling
5. Add logging for debugging

### Long-term (Next Month):
1. Complete migration to Supabase as single source of truth
2. Phase out Google Sheets reads
3. Implement pagination
4. Add comprehensive test suite
5. Performance optimization

---

## SUPPORT QUERIES

If you need to query current state, use these:

```sql
-- Quick health check
SELECT
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'entrepreneurs', COUNT(*) FROM entrepreneurs
UNION ALL
SELECT 'mentor_profiles', COUNT(*) FROM mentor_profiles
UNION ALL
SELECT 'mentor_assignments', COUNT(*) FROM mentor_assignments
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs;

-- Check for orphaned data
SELECT 'Assignments with no entrepreneur' as issue, COUNT(*) as count
FROM mentor_assignments ma
LEFT JOIN entrepreneurs e ON e.id = ma.entrepreneur_id
WHERE e.id IS NULL
UNION ALL
SELECT 'Assignments with no mentor', COUNT(*)
FROM mentor_assignments ma
WHERE ma.mentor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ma.mentor_id)
UNION ALL
SELECT 'Profiles with no user', COUNT(*)
FROM mentor_profiles mp
LEFT JOIN users u ON u.id = mp.user_id
WHERE u.id IS NULL;
```

---

**END OF COMPREHENSIVE SCHEMA ANALYSIS**

*This document is production-ready and can be used as the complete specification for your database schema verification and migration.*
