# iTEKAD Mentor Portal — Development Guide

**Last Updated:** March 2026  
**Project:** iTEKAD Mentor Reporting System  
**Philosophy:** Vibe coding with AI tools — focus human energy on business logic and architecture

---

## Quick Context

**What:** Next.js web app for Malaysian entrepreneur mentorship programs (iTEKAD Bangkit & Maju)  
**Why:** Replace slow Google Forms with real-time reporting, historical context, and data analytics  
**How:** Dual-write architecture — Supabase PostgreSQL is now the primary source of truth; Google Sheets is legacy (kept for PDF generation via Apps Script)

**Programs:**
- **iTEKAD Bangkit** — 4-session entry-level entrepreneurship program
- **iTEKAD Maju** — 4-session advanced business growth program
- **TUBF** — standby program

**Stakeholders:**
- 100+ volunteer mentors submit session reports
- 400+ entrepreneurs (mentees) tracked across programs
- Noraminah (program_coordinator) — assigns mentors, approves reports
- Maryam (payment_admin) — processes mentor payments
- Hanisah (report_admin) — handles admin tasks
- Naim (system_admin) — portal owner and developer

**Current active batches (March 2026):**
- Batch 7 Bangkit (latest)
- Batch 6 Bangkit
- Batch 6 Maju

---

## Tech Stack

**Frontend:**
- Next.js 13.5.6 (Pages Router — NOT App Router)
- React 18.2.0 + Tailwind CSS
- NextAuth.js (Google OAuth)
- SWR for data fetching
- Recharts for GrowthWheel visualizations

**Backend:**
- Next.js API routes (serverless)
- Supabase PostgreSQL — project ID: `oogrwqxlwyoswyfqgxxi`
- Google Sheets API (legacy, PDF generation only)
- Google Drive API (file storage)
- Vercel deployment

**Key Dependencies:**
```json
{
  "@supabase/supabase-js": "^2.89.0",
  "googleapis": "^156.0.0",
  "next-auth": "^4.24.11",
  "formidable": "^3.5.4"
}
```

---

## CRITICAL RULES — Read Every Session

### 1. Always use supabaseAdmin for ALL server-side operations

```javascript
import supabaseAdmin from '../../lib/supabaseAdmin'; // adjust relative path per file depth
```

**Never** use the regular `supabase` client on the server. NextAuth returns `auth.uid() = NULL` which breaks RLS. Every API route and `getServerSideProps` MUST use `supabaseAdmin` (service role key, bypasses RLS).

### 2. Standard auth pattern for every admin page

```javascript
import { getSession } from 'next-auth/react';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };
  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);
  if (!hasAccess) return { props: { accessDenied: true, userEmail } };
  const isReadOnlyUser = await isReadOnly(userEmail);
  return { props: { userEmail, isReadOnlyUser } };
}
```

Every API route must also validate session and return 401 if not authenticated/authorised.

### 3. isReadOnlyUser disables all writes

When `isReadOnlyUser` is true, disable all write buttons (add, edit, retire, approve, etc.) with `cursor-not-allowed` styling. Always show `<ReadOnlyBadge />` at page top.

### 4. Google Sheets sync is fire-and-forget

Wrap all Sheets sync in try/catch. Never let a Sheets failure block a DB operation or return an error to the user. Log errors to console only. DB is source of truth.

### 5. No inline `--` SQL comments inside template literals with dynamic values

If a template literal contains dynamic values (mentor names, emails, etc.), do not use `--` SQL comments inside the string — they will break queries if a value contains `--`.

### 6. Always cast enum values explicitly in SQL

```sql
$region::region_type
$program::program_type
'mentor'::user_role
```

### 7. Validate all UUIDs/IDs before DB calls

Check that any UUID or ID received from the frontend is a non-empty string before using it in a query.

### 8. Read before write — audit before change

For any backfill, migration, or data fix script: always run a SELECT first to confirm affected rows, then run the UPDATE/INSERT/DELETE. Never fire a write blind.

---

## Dual-Write Architecture

Supabase is now primary. Google Sheets is kept only for Apps Script PDF generation.

```javascript
// In API handlers (submitReport.js, submitMajuReport.js)

// Step 1: Write to Supabase (PRIMARY — blocking)
try {
  const { data, error } = await supabaseAdmin.from('reports').insert(transformedData);
  if (error) throw error;
} catch (error) {
  console.error('❌ Supabase write failed:', error);
  return res.status(500).json({ error: 'Failed to save report' });
}

// Step 2: Write to Google Sheets (SECONDARY — non-blocking, for PDF generation)
try {
  await appendToGoogleSheet(data);
  console.log('✅ Sheets write successful');
} catch (error) {
  // Log failure but DON'T block the response
  await logDualWriteFailure('bangkit_report', recordId, error);
  console.error('⚠️ Sheets write failed (non-blocking):', error);
}

return res.status(200).json({ 
  success: true, 
  message: 'Report submitted. PDF will generate in 1-2 minutes.' 
});
```

**Current State (March 2026):**
- ✅ Dual-write working for all report types
- ✅ Supabase is source of truth for all dashboards and admin pages
- ✅ `sheets_row_number` deduplication and `submission_date` backfill complete (169+ records)
- ⚠️ Google Sheets still used for PDF generation via Apps Script
- 🔜 Future: Migrate PDF gen to Supabase, retire Sheets

---

## Database Schema — Verified March 2026

**Supabase project ID:** `oogrwqxlwyoswyfqgxxi`

### Enum Types

```
region_type:
  Penang, Kedah, Perlis, Perak, Selangor, Kuala Lumpur,
  Negeri Sembilan, Melaka, Johor, Pahang, Terengganu,
  Kelantan, Sabah, Sarawak, Labuan

program_type:
  Bangkit, Maju, TUBF, iTEKAD, Upward Mobility

assignment_status:
  active | completed | transferred | dropped

user_role:
  mentor | premier_mentor | program_coordinator |
  report_admin | payment_admin | payment_approver |
  system_admin | stakeholder
```

### Tables

**`reports`** — THE one and only report table (there is no `bangkit_reports` table)
- `id` uuid, `mentor_id` uuid, `entrepreneur_id` uuid
- `program` (program_type), `session_number` int, `session_date` date
- `status`: `'submitted'` | `'approved'`
- `payment_status`: `'pending'` | `'approved_for_payment'` | `'paid'`
- `payment_batch_id` uuid → payment_batches
- `mia_status`, `mia_reason`, `mia_proof_url`
- `gw_skor` jsonb, `image_urls` jsonb, `inisiatif` jsonb
- `jualan_terkini` jsonb, `data_kewangan_bulanan` jsonb
- `submission_date` timestamptz, `sheets_row_number` int
- `reviewed_at`, `reviewed_by`, `rejection_reason`
- `revision_count`, `revision_reason` (ARRAY), `revision_notes`
- `revision_requested_by`, `revision_requested_at`, `revised_at`
- `verification_nota`, `doc_url`, `folder_id`, `source`
- `nama_mentor`, `nama_mentee`, `mentor_email` (denormalised for Sheets compat)

> ⚠️ There is NO `verification_status` column. Use `status = 'submitted'` for pending verification.

**`mentors`**
- `id` uuid, `name`, `email`, `phone`
- `region` (region_type enum — single value, NOT an array)
- `program` (program_type enum — single value, NOT an array)
- `status`: `'active'` | `'inactive'`
- `ic_number`, `address`, `state`, `bank_account`, `emergency_contact`

**`mentor_profiles`** — extended mentor info, linked to `users`
- `id`, `user_id` (→ users.id)
- `phone`, `bank_name`, `bank_account`
- `programs` (ARRAY), `regions` (ARRAY) — note: arrays here, unlike `mentors` table
- `max_mentees` int, `is_premier` bool, `bio`

**`mentor_assignments`**
- `id` uuid, `mentor_id` uuid, `entrepreneur_id` uuid, `batch_id` uuid
- `status` (assignment_status): `active` | `completed` | `transferred` | `dropped`
- `is_active` boolean
- **Always use BOTH conditions for active assignments:**
  ```sql
  WHERE ma.status = 'active' AND ma.is_active = true
  ```
- `transferred_to` uuid, `audit_log` jsonb, `notes`

**`entrepreneurs`**
- `id` uuid, `name`, `email`, `phone`, `business_name`
- `region` (region_type), `zone`, `state`, `district`
- `program` (program_type), `batch`, `cohort`, `status`
- `folder_id`, `financing_amount`, `grant_amount`, `disbursement_date`
- `owner_name`, `owner_name_secondary`, `age`, `address`

**`batches`**
- `id` uuid, `batch_name`, `program` (program_type), `batch_number` int
- `status`: `'active'` | `'completed'`
- `expected_sessions` int (default 4)
- `start_date`, `end_date` date (currently NULL for most batches)

**`batch_rounds`**
- `batch_id` uuid, `description`, `start_date`, `end_date`, `status`
- `round_number`, `round_name`, `period_label`, `start_month`, `end_month`

**`payment_batches`**
- `id` uuid, `batch_name`, `status`: `'pending'` | `'approved'` | `'paid'`
- `total_amount` numeric, `total_reports` int, `payment_date`
- `created_by`, `approved_by`, `paid_by` (all text/email)
- `notes`

> ⚠️ There is NO `'verified'` status in payment_batches. Use `status != 'paid'` for active batches.

**`payment_batch_items`**
- `id`, `batch_id`, `report_id`, `mentor_id`
- `base_amount`, `adjusted_amount`, `adjustment_reason`

**`mia_requests`**
- `id`, `mentor_id`, `mentee_id` (text), `program`, `batch`, `session_number`
- `status`: `'pending'` | `'approved'` | `'rejected'`
- `proof_whatsapp_url`, `proof_email_url`, `proof_call_url`
- `alasan`, `report_id`, `admin_id`, `admin_name`
- `requested_at`, `approved_at`, `bimb_contacted_at`
- `mentor_name`, `mentee_name`, `mentee_company`, `mentee_phone`

**`users`**
- `id` uuid, `email`, `name`, `google_id`
- `roles` (ARRAY), `status`

**`user_roles`**
- `id` uuid, `email`, `role` (user_role enum)
- `assigned_by`, `assigned_at`, `updated_at`

**`report_revisions`** — revision history per report

**`upward_mobility_reports`** — separate table for UM assessments

**`dual_write_logs` / `dual_write_monitoring`** — Sheets sync audit log

**`activity_logs`** — general audit trail

> ⚠️ DEPRECATED / DOES NOT EXIST: `mentor_mentee_mapping`, `bangkit_reports`  
> All report data lives in `reports`. All assignment data lives in `mentor_assignments`.

---

## Business Logic

### Report status flow
```
submitted → approved (admin: /admin/verification)
          → rejected  (with rejection_reason — mentor must fix and resubmit)
          → revision_requested (mentor resubmits, increments revision_count)
```

### Payment flow
```
reports.payment_status:   pending → approved_for_payment → paid
payment_batches.status:   pending → approved → paid
```
Reports are grouped into payment batches via `payment_batch_items`.

### Mentor retire rules
1. Cannot retire if active mentees > 0 (check `mentor_assignments WHERE status='active' AND is_active=true`)
2. Must reassign all mentees first via `/admin/reassign-mentor`
3. On retire: `UPDATE mentors SET status='inactive'` + `DELETE FROM user_roles WHERE role='mentor'`
4. Do NOT delete or modify the `users` table record on retire
5. Historical reports must remain intact

### MIA flow (3-proof)
1. Mentor submits MIA request with 3 proofs: WhatsApp screenshot, email, call log
2. Admin reviews in `/admin/mia`
3. `mia_requests.status`: `pending` → `approved` | `rejected`

### Active assignment query pattern
```sql
-- Always use BOTH conditions
WHERE ma.status = 'active' AND ma.is_active = true
```

### Google Sheets row lookup for sync
When syncing reassignments back to Sheets, always look up rows by **entrepreneur email** — never by mentor name (one mentor appears in many rows).

---

## Pages & Modules

| Route | Purpose | Status |
|---|---|---|
| `/` | Mentor dashboard (homepage) | ✅ Built |
| `/laporan-bangkit` | Bangkit report form | ✅ Built |
| `/laporan-maju-um` | Maju report form (with UM) | ✅ Built |
| `/growthwheel` | GrowthWheel 360° assessment | ✅ Built |
| `/admin/index.js` | Admin command center — stat overview + quick nav | 🔨 Rebuilding |
| `/admin/dashboard` | Charts and analytics | ✅ Built |
| `/admin/progress` | Missing report tracker + mentor accountability | ✅ Built |
| `/admin/verification` | Report review and approval workflow | ✅ Built |
| `/admin/payment-review` | Payment batch management | ✅ Built |
| `/admin/mia` | MIA 3-proof approval workflow | ✅ Built |
| `/admin/lawatan-premis` | HQ premises visit tracking | ✅ Built |
| `/admin/direktori-usahawan` | Entrepreneur directory | ✅ Built |
| `/admin/mentors` | Mentor management (add/edit/retire) | 🔨 Building |
| `/admin/reassign-mentor` | Mentee reassignment wizard (4-step) | 🔨 Building |
| `/monitoring` | Dual-write monitoring | ✅ Built |
| `/superadmin/roles` | Role management (system_admin only) | ✅ Built |

---

## Key Files

```
pages/
├── index.js                          # Mentor dashboard (homepage)
├── laporan-bangkit.js                # Bangkit report form
├── laporan-maju-um.js                # Maju report form (with UM)
├── growthwheel.js                    # GrowthWheel 360° assessment
├── admin/
│   ├── index.js                      # 🔨 Admin command center (rebuilding)
│   ├── dashboard.js                  # Charts & analytics
│   ├── progress.js                   # Missing report tracker
│   ├── verification.js               # ⭐ Reference for auth pattern + Tailwind style
│   ├── payment-review.js             # Payment batch management
│   ├── mia.js                        # MIA approval workflow
│   ├── lawatan-premis.js             # HQ visit tracking
│   ├── direktori-usahawan.js         # Entrepreneur directory
│   ├── mentors.js                    # 🔨 Mentor management (building)
│   └── reassign-mentor.js            # 🔨 Reassignment wizard (building)
└── api/
    ├── submitReport.js               # 🔥 Bangkit dual-write handler
    ├── submitMajuReport.js           # 🔥 Maju dual-write handler
    ├── admin/
    │   ├── overview-stats.js         # 🔨 New: command center stats (building)
    │   ├── sales-status.js           # Legacy batch status table
    │   ├── mentors.js                # 🔨 New: mentor CRUD API (building)
    │   └── reassign-mentor.js        # 🔨 New: reassignment API (building)
    ├── getMentorReports.js           # Fetch reports for mentor
    ├── mapping.js                    # Mentor-mentee assignments
    └── uploadImage.js                # Google Drive image upload

lib/
├── auth.js                           # 🔥 RBAC — canAccessAdmin, isReadOnly
├── supabaseAdmin.js                  # 🔥 Service role client (use this server-side)
├── supabaseClient.js                 # Public client (client-side only)
├── mia.js                            # Shared MIA helpers
└── googleSheets.js                   # Google Sheets API wrapper

scripts/
├── sync-mappings.js                  # Sync mentor-mentee data
├── sync-bangkit-reports.js           # Backfill Bangkit to Supabase
├── sync-maju-reports.js              # Backfill Maju to Supabase
└── sync-docurl.js                    # Sync PDF URLs from Sheets
```

---

## Role-Based Access Control (RBAC)

```javascript
// In API routes — use canAccessAdmin for admin pages
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';

// Roles that canAccessAdmin returns true for:
// system_admin, program_coordinator, report_admin, payment_admin, payment_approver

// isReadOnly returns true for: stakeholder, report_admin (read-only tier)
```

**Role reference:**

| Role | Access |
|---|---|
| `mentor` | Submit reports, view own dashboard |
| `system_admin` | Full access (Naim) |
| `program_coordinator` | Assign mentors, approve reports (Noraminah) |
| `report_admin` | Report management (Hanisah) |
| `payment_admin` | Payment processing (Maryam) |
| `payment_approver` | Approve payment batches |
| `premier_mentor` | Elevated mentor (also in user_roles) |
| `stakeholder` | Read-only dashboard access |

---

## Common Mistakes & Fixes

### 1. ❌ Using regular supabase client server-side
```javascript
// ❌ WRONG — breaks with RLS
import supabase from '../../lib/supabaseClient';

// ✅ CORRECT — bypasses RLS
import supabaseAdmin from '../../lib/supabaseAdmin';
```

### 2. ❌ Querying non-existent tables
```javascript
// ❌ WRONG — these tables don't exist
supabaseAdmin.from('bangkit_reports')
supabaseAdmin.from('mentor_mentee_mapping')

// ✅ CORRECT
supabaseAdmin.from('reports')
supabaseAdmin.from('mentor_assignments')
```

### 3. ❌ Using wrong status column for verification
```javascript
// ❌ WRONG — no such column
WHERE verification_status = 'pending'

// ✅ CORRECT
WHERE status = 'submitted'
```

### 4. ❌ Using wrong status for "payments ready"
```sql
-- ❌ WRONG — 'verified' doesn't exist in payment_batches
WHERE payment_batches.status = 'verified'

-- ✅ CORRECT
WHERE payment_batches.status != 'paid'
-- or specifically: WHERE payment_batches.status = 'approved'
```

### 5. ❌ Forgetting to use both active assignment conditions
```sql
-- ❌ WRONG — incomplete
WHERE mentor_id = $id AND is_active = true

-- ✅ CORRECT
WHERE mentor_id = $id AND status = 'active' AND is_active = true
```

### 6. ❌ Not casting enum values in SQL
```sql
-- ❌ WRONG — will fail type check
INSERT INTO mentors (region, program) VALUES ($region, $program)

-- ✅ CORRECT
INSERT INTO mentors (region, program) VALUES ($region::region_type, $program::program_type)
```

### 7. ❌ Letting Sheets failure block DB writes
```javascript
// ❌ WRONG — Sheets error kills the whole request
await appendToGoogleSheet(data);
await supabaseAdmin.from('reports').insert(data);

// ✅ CORRECT — Sheets is non-blocking
try { await appendToGoogleSheet(data); } catch(e) { console.error('⚠️ Sheets:', e); }
```

### 8. ❌ Querying Sheets for dashboard data
```javascript
// ❌ WRONG — 2-10 seconds per query
const data = await fetchFromGoogleSheets();

// ✅ CORRECT — milliseconds
const { data } = await supabaseAdmin.from('reports').select('*');
```

### 9. ❌ Wrong image folder structure
```javascript
// ✅ CORRECT folder structure
`Mentor_${mentorName}/Mentee_${menteeName}/Session_${sessionNum}/`  // session images
`Mentor_${mentorName}/MIA_Images/`                                  // MIA images (separate!)
`Mentor_${mentorName}/Mentee_${menteeName}/Profile/`                // profile (Sesi 1 only)
```

### 10. ❌ Finding Sheets rows by mentor name
```javascript
// ❌ WRONG — mentor name appears in many rows
rows.find(r => r.mentorName === mentorName)

// ✅ CORRECT — entrepreneur email is unique per row
rows.find(r => r.entrepreneurEmail === entrepreneurEmail)
```

---

## API Route Standard Pattern

```javascript
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../../../lib/auth';
import supabaseAdmin from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  // 1. Auth
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Input validation
  const { field1, field2 } = req.body;
  if (!field1 || !field2) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 4. Business logic
  try {
    // ... use supabaseAdmin for all DB calls
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

## Client-Side Data Fetching

```javascript
// Use SWR for caching
import useSWR from 'swr';
const fetcher = (url) => fetch(url).then(r => r.json());

const { data, error, mutate } = useSWR('/api/getData', fetcher);

// After a mutation, refresh:
mutate();
// Or refresh multiple:
mutate('/api/getMentorReports');
mutate('/api/getDashboardStats');
```

---

## File Uploads

```javascript
// Use formidable to parse multipart/form-data
export const config = { api: { bodyParser: false } };
import formidable from 'formidable';
const form = formidable({ multiples: true });
const [fields, files] = await form.parse(req);
```

---

## Environment Variables

```bash
# Google Service Account (Base64 encoded JSON)
GOOGLE_CREDENTIALS_BASE64=eyJ0eXBlIjoi...

# Google Sheets IDs
GOOGLE_SHEETS_REPORT_ID=...          # Bangkit reports
GOOGLE_SHEETS_MAJU_REPORT_ID=...     # Maju reports
GOOGLE_SHEETS_MAPPING_ID=...         # Mentor-mentee mapping
GOOGLE_SHEETS_UM_ID=...              # Upward Mobility standalone

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://oogrwqxlwyoswyfqgxxi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...    # Client-side (public)
SUPABASE_SERVICE_ROLE_KEY=...        # Server-side (bypasses RLS — keep secret)

# NextAuth
NEXTAUTH_URL=https://mentor.startlah.my
NEXTAUTH_SECRET=...                  # openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Monitoring (optional)
NEXT_PUBLIC_LOGROCKET_ID=xxx/project-name
```

---

## Development Commands

```bash
npm run dev                    # Start dev server (localhost:3000)

npm run sync:mappings:test     # Preview mentor-mentee sync
npm run sync:mappings          # Run mentor-mentee sync
npm run sync:bangkit:test      # Preview Bangkit report sync
npm run sync:bangkit           # Backfill Bangkit reports
npm run sync:maju:test         # Preview Maju report sync
npm run sync:maju              # Backfill Maju reports
npm run sync:docurl:live       # Sync PDF URLs from Sheets

npm run sync:validate          # Check environment setup
npm run validate:sync          # Verify data integrity

npm run build                  # Build for production
npm start                      # Start production server
```

---

## Debugging Workflow

1. Check Vercel deployment logs
2. Check `dual_write_monitoring` table for sync issues
3. Check LogRocket for user session replay
4. Check Google Sheets service account permissions
5. Check Supabase database logs
6. Review existing code patterns in similar files — `/pages/admin/verification.js` is the best reference

```javascript
// Troubleshooting checklist
1. Auth:       Is user logged in? Check NextAuth session
2. Role:       Does user have correct role? Check user_roles table
3. RLS:        Are you using supabaseAdmin (not supabaseClient) server-side?
4. Validation: Are all required fields filled?
5. Enum cast:  Are enum values explicitly cast in SQL?
6. Sheets:     Is Google Sheets accessible? Check service account permissions
7. Logs:       Check Vercel logs, LogRocket, console output
```

---

## Changelog (Recent Fixes)

### March 2026
- ✅ Schema verified: `reports` is the only report table (no `bangkit_reports`)
- ✅ Confirmed: `payment_batches.status` values are `pending | approved | paid` (no `verified`)
- ✅ Confirmed: No `verification_status` column — use `reports.status = 'submitted'`
- ✅ `sheets_row_number` deduplication complete (169+ Bangkit records)
- ✅ `submission_date` backfill complete
- ✅ Enum types confirmed: `region_type` (15 states), `program_type` (5 values), `user_role` (8 values)
- 🔨 Building: `/admin/index.js` command center
- 🔨 Building: `/admin/mentors.js` mentor management
- 🔨 Building: `/admin/reassign-mentor.js` reassignment wizard
- 🔨 Building: `/api/admin/overview-stats.js`

### February 2026
- ✅ Fixed: MIA images now go to separate folder (not session folder)
- ✅ Fixed: Dual-write monitoring now logs all operations
- ✅ Fixed: Mentor dropdown now shows correct mentee list per program
- ✅ Fixed: RLS violations in submitBangkit.js — switched to supabaseAdmin
- ✅ Fixed: Backfilled 23+ missing reports caused by mentor_id NOT NULL constraint bug
- ✅ Fixed: Swapped entrepreneur_id pairs via constraint-drop/UPDATE/recreate pattern

---

## Development Philosophy: Vibe Coding

Leverage AI tools (Claude Code, Codex CLI) for boilerplate, pattern replication, refactoring, and documentation. Focus human energy on:
- Business logic correctness
- Architecture decisions
- Data integrity validation
- User experience optimisation
- Code review and quality

**Workflow:**
1. Draft precise prompt (with schema facts, constraints, file references)
2. AI generates first draft
3. Review, test, refine
4. Document fixes in changelog above
5. Iterate

---

**Remember:** This system serves real mentors helping real entrepreneurs. Data accuracy and reliability are critical. When in doubt — read first, write second, test thoroughly.

**Reference:** `/pages/admin/verification.js` is the gold standard for admin page patterns.
