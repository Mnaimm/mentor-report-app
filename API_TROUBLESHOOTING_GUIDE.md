# API ENDPOINTS TROUBLESHOOTING GUIDE
**Generated:** 2025-12-26
**Issue:** Getting 404 errors on all API endpoints

---

## DIAGNOSIS SUMMARY

### ✅ What's Working:
1. **Next.js Version:** 13.5.6 (Pages Router)
2. **Project Structure:** Using `/pages/api/` (correct for Pages Router)
3. **API Files:** All files exist and are named correctly (`.js` files)
4. **Build Directory:** `.next` exists (project has been built)
5. **Dependencies:** Supabase packages installed
6. **Monitoring Libraries:** All exist in `lib/monitoring/`

### ❌ CRITICAL ISSUE FOUND:

**Missing File:** `lib/auth-middleware.js`

**Impact:** All coordinator and dashboard API routes import this file and will crash:
- `/api/coordinator/dashboard-summary.js` - Line 2
- `/api/coordinator/mentees.js` - Line 2
- `/api/coordinator/mentors.js` - Line 2
- `/api/coordinator/assign-mentor.js` - Line 2
- `/api/dashboard/stats.js` - Line 2

**This is why you're getting 404 errors!** Next.js is failing to compile these routes because the import fails.

---

## PROJECT STRUCTURE ANALYSIS

### Router Type: **PAGES ROUTER** ✅
- Next.js 13.5.6 (supports both, you're using Pages Router)
- API routes are in `/pages/api/`
- No `/app` directory

### API Directory Tree:
```
pages/api/
├── admin/
│   └── sales-status.js ✅
├── auth/
│   └── [...nextauth].js ✅
├── cache/
│   └── refresh.js ✅
├── coordinator/
│   ├── assign-mentor.js ❌ (imports missing auth-middleware)
│   ├── dashboard-summary.js ❌ (imports missing auth-middleware)
│   ├── mentees.js ❌ (imports missing auth-middleware)
│   └── mentors.js ❌ (imports missing auth-middleware)
├── cron/
│   └── sync-doc-urls.js ✅
├── dashboard/
│   ├── program-breakdown.js ✅
│   ├── recent-activity.js ✅
│   ├── reports-by-status.js ✅
│   ├── stats.js ❌ (imports missing auth-middleware)
│   └── system-health.js ✅
├── debug/
│   └── recent-submissions.js ✅
├── mentor/
│   └── my-dashboard.js ✅
├── monitoring/
│   ├── compare-now.js ✅
│   ├── discrepancies.js ✅
│   ├── health.js ✅
│   ├── log-dual-write.js ✅
│   ├── recent-operations.js ✅
│   └── stats.js ✅
├── debug-report-emails.js ✅
├── frameworkBank.js ✅
├── laporanMajuData.js ✅
├── mapping.js ✅
├── menteeData.js ✅
├── mentor-stats.js ✅
├── submitMajuReport.js ✅
├── submitReport.js ✅
├── submit-upward-mobility.js ✅
├── test-env.js ✅
├── test-upload-routing.js ✅
├── upload-image.js ✅
└── upload-proxy.js ✅
```

### Library Files:
```
lib/
├── monitoring/
│   ├── dual-write-logger.js ✅
│   ├── error-formatter.js ✅
│   └── metrics-aggregator.js ✅
├── auth.js ✅
├── data-utils.js ✅
├── impersonation.js ✅
├── sheets.js ✅
├── simple-cache.js ✅
└── auth-middleware.js ❌ MISSING!
```

---

## SOLUTION: Create Missing auth-middleware.js

The file needs to export these functions:
- `requireAuth(req, res)` - Check if user is authenticated
- `requireRole(req, res, role)` - Check if user has specific role
- `hasRole(user, role)` - Check if user object has role
- `logActivity(userId, action, table, recordId, metadata)` - Log coordinator actions

### Create the file:

**File:** `lib/auth-middleware.js`

```javascript
// lib/auth-middleware.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Require user to be authenticated
 * Returns { user, error, status, message }
 */
export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return {
      error: true,
      status: 401,
      message: 'Unauthorized - Please sign in'
    };
  }

  return {
    error: false,
    user: session.user
  };
}

/**
 * Require user to have a specific role
 * Returns { user, error, status, message }
 */
export async function requireRole(req, res, requiredRole) {
  const authResult = await requireAuth(req, res);

  if (authResult.error) {
    return authResult;
  }

  const { user } = authResult;

  // Get user's roles from database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('roles')
    .eq('email', user.email)
    .single();

  if (dbError || !dbUser) {
    return {
      error: true,
      status: 403,
      message: 'User not found in database'
    };
  }

  const userRoles = dbUser.roles || [];

  // Check if user has required role
  if (!userRoles.includes(requiredRole)) {
    return {
      error: true,
      status: 403,
      message: `Access denied - Required role: ${requiredRole}`
    };
  }

  return {
    error: false,
    user: {
      ...user,
      roles: userRoles
    }
  };
}

/**
 * Check if user object has a specific role
 * Used in dashboard/stats.js
 */
export function hasRole(user, role) {
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
}

/**
 * Log coordinator activity
 * Used in coordinator/assign-mentor.js
 */
export async function logActivity(userId, action, tableName, recordId, metadata) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action,
        table_name: tableName,
        record_id: recordId,
        metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log activity:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Activity logging error:', err);
    return false;
  }
}
```

---

## STEP-BY-STEP FIX

### Step 1: Create the Missing File

**Option A - Using Command Line:**
```bash
cd C:\Users\MyLenovo\Downloads\mentor-report
```

Then create the file manually or copy the content above into `lib/auth-middleware.js`

**Option B - Using PowerShell:**
```powershell
cd C:\Users\MyLenovo\Downloads\mentor-report
New-Item -Path "lib\auth-middleware.js" -ItemType File -Force
# Then paste the content above into the file
```

### Step 2: Install Missing Dependencies

Check if @supabase/supabase-js is installed:
```bash
npm list @supabase/supabase-js
```

If not installed:
```bash
npm install @supabase/supabase-js
```

### Step 3: Clear Next.js Build Cache

```bash
# Delete .next directory
rm -rf .next

# Or on Windows PowerShell:
Remove-Item -Recurse -Force .next
```

### Step 4: Rebuild and Start Dev Server

```bash
npm run dev
```

### Step 5: Verify Server Started

You should see:
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

If you see compilation errors, they will show in the terminal.

---

## CORRECT API ENDPOINT URLs

Based on your **Pages Router** setup, here are the correct URLs:

### Coordinator Endpoints:
```
GET  http://localhost:3000/api/coordinator/dashboard-summary
GET  http://localhost:3000/api/coordinator/mentees
GET  http://localhost:3000/api/coordinator/mentors
POST http://localhost:3000/api/coordinator/assign-mentor
```

### Monitoring Endpoints:
```
GET  http://localhost:3000/api/monitoring/health
GET  http://localhost:3000/api/monitoring/stats
GET  http://localhost:3000/api/monitoring/discrepancies
GET  http://localhost:3000/api/monitoring/recent-operations
POST http://localhost:3000/api/monitoring/log-dual-write
GET  http://localhost:3000/api/monitoring/compare-now
```

### Dashboard Endpoints:
```
GET http://localhost:3000/api/dashboard/stats
GET http://localhost:3000/api/dashboard/program-breakdown
GET http://localhost:3000/api/dashboard/recent-activity
GET http://localhost:3000/api/dashboard/reports-by-status
GET http://localhost:3000/api/dashboard/system-health
```

### Other Endpoints:
```
GET  http://localhost:3000/api/mentor-stats
GET  http://localhost:3000/api/menteeData
POST http://localhost:3000/api/submitReport
POST http://localhost:3000/api/submitMajuReport
GET  http://localhost:3000/api/admin/sales-status
```

---

## TESTING COMMANDS

### Test 1: Health Check (No Auth Required)
```bash
curl http://localhost:3000/api/monitoring/health
```

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/monitoring/health" -Method GET
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:00:00Z",
  "checks": {
    "supabase": { "healthy": true },
    "sheets": { "healthy": true }
  }
}
```

---

### Test 2: Dashboard Summary (Requires Auth)

**First, get your session cookie:**
1. Open http://localhost:3000 in browser
2. Sign in
3. Open DevTools (F12) → Application → Cookies
4. Copy the `next-auth.session-token` value

**Then test with curl:**
```bash
curl http://localhost:3000/api/coordinator/dashboard-summary \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

**PowerShell:**
```powershell
$session = "YOUR_SESSION_TOKEN"
Invoke-WebRequest -Uri "http://localhost:3000/api/coordinator/dashboard-summary" `
  -Method GET `
  -Headers @{Cookie="next-auth.session-token=$session"}
```

**Expected Response:**
```json
{
  "summary": {
    "total_mentees": 0,
    "active_mentors": 0,
    "overall_completion_pct": 0,
    ...
  },
  "unassigned": [],
  "timestamp": "2025-01-26T10:00:00Z"
}
```

---

### Test 3: Monitoring Stats (No Auth Required)
```bash
curl "http://localhost:3000/api/monitoring/stats?period=today"
```

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/monitoring/stats?period=today" -Method GET
```

---

### Test 4: Assign Mentor (POST with Auth)

**curl:**
```bash
curl -X POST http://localhost:3000/api/coordinator/assign-mentor \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "menteeId": "ENTREPRENEUR_UUID",
    "mentorId": "USER_UUID",
    "notes": "Test assignment"
  }'
```

**PowerShell:**
```powershell
$session = "YOUR_SESSION_TOKEN"
$body = @{
  menteeId = "ENTREPRENEUR_UUID"
  mentorId = "USER_UUID"
  notes = "Test assignment"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/coordinator/assign-mentor" `
  -Method POST `
  -Headers @{
    "Content-Type"="application/json"
    "Cookie"="next-auth.session-token=$session"
  } `
  -Body $body
```

---

## COMMON ERRORS AND SOLUTIONS

### Error: "Module not found: Can't resolve '../../../lib/auth-middleware'"

**Cause:** The auth-middleware.js file doesn't exist

**Solution:** Create the file as shown in Step 1 above

---

### Error: "Cannot find module '@supabase/supabase-js'"

**Cause:** Supabase package not installed

**Solution:**
```bash
npm install @supabase/supabase-js
```

---

### Error: "getServerSession is not a function"

**Cause:** next-auth version mismatch

**Solution:**
```bash
npm install next-auth@^4.24.11
```

---

### Error: 401 Unauthorized

**Cause:** Missing or invalid session token

**Solutions:**
1. Make sure you're signed in at http://localhost:3000
2. Check session token is copied correctly
3. Session token may have expired - sign in again

---

### Error: 403 Access Denied - Required role

**Cause:** Your user doesn't have the required role in database

**Solution:** Add role to your user:
```sql
-- In Supabase SQL Editor
UPDATE users
SET roles = ARRAY['program_coordinator']
WHERE email = 'your-email@example.com';
```

---

### Error: "view_program_summary does not exist"

**Cause:** Database views haven't been created yet

**Solution:** Run the migration scripts from PART 7 of the schema analysis document

---

## VERIFICATION CHECKLIST

- [ ] **File Created:** `lib/auth-middleware.js` exists
- [ ] **Dependencies Installed:** @supabase/supabase-js is in node_modules
- [ ] **Build Cleared:** .next directory deleted
- [ ] **Server Running:** `npm run dev` shows no errors
- [ ] **Port Active:** Can access http://localhost:3000
- [ ] **Auth Working:** Can sign in via browser
- [ ] **Health Check:** `/api/monitoring/health` returns 200
- [ ] **Protected Routes:** Dashboard endpoints require auth
- [ ] **Database Ready:** Supabase tables exist (run migrations if needed)

---

## NEXT.JS PAGES ROUTER - URL PATTERNS

For **Pages Router** (your setup), the pattern is:

```
File Path                              →  URL
pages/api/health.js                    →  /api/health
pages/api/users/[id].js                →  /api/users/:id
pages/api/coordinator/mentees.js       →  /api/coordinator/mentees
pages/api/monitoring/stats.js          →  /api/monitoring/stats
```

**NOT** App Router patterns like:
```
app/api/health/route.ts                →  /api/health
```

You're using the correct pattern! ✅

---

## DEBUGGING TIPS

### Check Server Logs

When you run `npm run dev`, watch the terminal for:

**Good:**
```
ready - started server on 0.0.0.0:3000
event - compiled client and server successfully
```

**Bad:**
```
error - ./pages/api/coordinator/dashboard-summary.js
Module not found: Can't resolve '../../../lib/auth-middleware'
```

### Enable Verbose Logging

Add to your API routes for debugging:
```javascript
export default async function handler(req, res) {
  console.log('🔵 API Route Hit:', req.url);
  console.log('🔵 Method:', req.method);
  console.log('🔵 Headers:', req.headers);

  // ... rest of your code
}
```

### Check Environment Variables

Create a test endpoint:
```javascript
// pages/api/test-env.js
export default function handler(req, res) {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    nextAuthSecret: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING'
  });
}
```

Test: http://localhost:3000/api/test-env

---

## PRODUCTION DEPLOYMENT NOTES

When deploying to Vercel/production:

1. **Environment Variables:** Make sure all env vars are set in Vercel dashboard
2. **Build Command:** `npm run build` should succeed
3. **API Routes:** Same URLs work in production
4. **CORS:** Already configured in next.config.js
5. **Auth:** Update NEXTAUTH_URL to production domain

---

## SUMMARY

**Root Cause:** Missing `lib/auth-middleware.js` file causes compilation errors for 5 API routes

**Fix:** Create the file with the code provided above

**After Fix:** All API routes should work correctly

**Test Order:**
1. Health check (no auth) → verify server works
2. Monitoring stats (no auth) → verify database connection
3. Dashboard summary (with auth) → verify auth system
4. Assign mentor (POST with auth) → verify writes work

**Need Help?** Check the server terminal logs for specific error messages.

---

**Created:** 2025-12-26
**Status:** Ready to implement
**Estimated Fix Time:** 5 minutes
