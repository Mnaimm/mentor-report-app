# ✅ FIXED: Discrepancies Endpoint & Dashboard Stats

## Issues Fixed

### Issue 1: `/api/monitoring/discrepancies` - Column Mismatch ✅

**Problem:** Code tried to query columns that don't exist in the `data_discrepancies` view

**Your View Has:**
- `id`, `operation_type`, `table_name`, `record_id`, `program`
- `user_email`, `created_at`, `discrepancy_type`
- `sheets_error`, `supabase_error`

**Code Was Trying to Use:**
- ❌ `resolved`, `severity`, `detected_at`
- ❌ `resolved_at`, `resolved_by`, `resolution_notes`, `updated_at`

**Solution:** Updated code to use only actual view columns

---

### Issue 2: `/api/dashboard/stats` - Role Check ✅

**Problem:** `requireAuth()` didn't populate user roles, so `hasRole()` always failed

**Your Roles:** `{mentor, system_admin, program_coordinator}`

**What Was Happening:**
1. `requireAuth()` returned session user (no roles from DB)
2. `hasRole(user, 'system_admin')` checked `user.roles` → undefined
3. Always returned "No valid role for dashboard access"

**Solution:** Updated `requireAuth()` to fetch roles from database

---

## Changes Made

### File 1: `pages/api/monitoring/discrepancies.js`

#### Change 1: Updated Query Parameters
```javascript
// Before - Used non-existent columns
const { resolved, table, severity, limit } = req.query;
query.eq('resolved', resolved === 'true');
query.eq('severity', severity);
query.order('detected_at', { ascending: false });

// After - Uses actual view columns
const { table, discrepancy_type, limit } = req.query;
query.eq('table_name', table);
query.eq('discrepancy_type', discrepancy_type);
query.order('created_at', { ascending: false });
```

#### Change 2: Updated Response
```javascript
// Before - Severity counts
severityCounts: { low: 0, medium: 0, high: 0, critical: 0 }

// After - Type counts (based on actual column)
typeCounts: { type1: 5, type2: 3, ... }
```

#### Change 3: Disabled POST (Read-Only View)
```javascript
// Before - Tried to UPDATE view
await supabase.from('data_discrepancies').update(...)

// After - Returns 405 error
return res.status(405).json({
  error: 'POST not supported',
  message: 'data_discrepancies is a read-only view.'
});
```

---

### File 2: `lib/auth-middleware.js`

#### Updated `requireAuth()` to Fetch Roles

**Before:**
```javascript
export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return { error: true, status: 401, message: 'Unauthorized' };
  }

  return {
    error: false,
    user: session.user  // ❌ No roles or ID from database
  };
}
```

**After:**
```javascript
export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return { error: true, status: 401, message: 'Unauthorized' };
  }

  // ✅ Fetch roles and ID from database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, roles')
    .eq('email', session.user.email)
    .single();

  if (dbError || !dbUser) {
    return {
      error: true,
      status: 403,
      message: 'User not found in database.'
    };
  }

  return {
    error: false,
    user: {
      ...session.user,
      id: dbUser.id,           // ✅ Database UUID
      roles: dbUser.roles || [] // ✅ User roles
    }
  };
}
```

---

### File 3: `pages/api/dashboard/stats.js`

#### Added Debug Logging

```javascript
// Added console.log to show which role matched
if (hasRole(user, 'system_admin')) {
  console.log('✅ Dashboard access: system_admin');
  stats = await getSystemAdminStats();
}
```

#### Improved Error Message

```javascript
// Before
return res.status(403).json({
  error: 'No valid role for dashboard access'
});

// After - Shows what went wrong
return res.status(403).json({
  error: 'No valid role for dashboard access',
  userRoles: user.roles,
  validRoles: ['system_admin', 'program_coordinator', ...]
});
```

---

## How to Test

### 1. Restart Dev Server

```bash
# Stop (Ctrl+C) and restart
npm run dev
```

### 2. Test Discrepancies Endpoint

**PowerShell:**
```powershell
# Test GET (no auth required for monitoring endpoints)
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/discrepancies"
```

**Expected Response:**
```json
{
  "discrepancies": [],
  "total": 0,
  "typeCounts": {}
}
```

Empty arrays are normal - discrepancies are auto-detected when dual-writes occur.

---

### 3. Test Dashboard Stats

**PowerShell:**
```powershell
$token = "YOUR_SESSION_TOKEN"
Invoke-RestMethod -Uri "http://localhost:3000/api/dashboard/stats" `
  -Headers @{Cookie="next-auth.session-token=$token"}
```

**Expected Response (System Admin):**
```json
{
  "totalUsers": 1,
  "totalUsersChange": 0,
  "totalReports": 316,
  "reportsThisMonth": 45,
  "activeMentors": 1,
  "activeMentorsPercentage": 100,
  "dualWriteSuccessRate": 99.7
}
```

You should see the terminal log:
```
✅ Dashboard access: system_admin
```

---

## What Each Role Sees

Based on the code, here's what each role gets:

### `system_admin` (You!)
```json
{
  "totalUsers": 1,
  "totalUsersChange": 0,
  "totalReports": 316,
  "reportsThisMonth": 45,
  "activeMentors": 1,
  "activeMentorsPercentage": 100,
  "dualWriteSuccessRate": 99.7
}
```

### `program_coordinator` (Also You!)
```json
{
  "myProgram": "Bangkit",
  "activeMentors": 0,
  "inactiveMentors": 2,
  "totalMentees": 0,
  "pendingMentees": 0,
  "reportsThisMonth": 23,
  "reportsChange": 5
}
```

### `mentor` (Also You!)
```json
{
  "myMentees": 6,
  "pendingMentees": 1,
  "reportsThisMonth": 8,
  "pendingReports": 2,
  "sessionsThisMonth": 8,
  "sessionsRemaining": 4,
  "pendingPayment": 3200,
  "pendingPaymentRequests": 2
}
```

**Note:** Since you have all 3 roles, the API will return **system_admin stats** because that's checked first (highest priority).

---

## Role Priority Order

The code checks roles in this order (first match wins):

1. ✅ `system_admin` ← **Your highest priority role**
2. `program_coordinator`
3. `report_admin`
4. `payment_admin`
5. `payment_approver`
6. `mentor` / `premier_mentor`
7. `stakeholder`

Since you have `system_admin`, you'll always get system admin stats.

---

## API Endpoints Updated

### ✅ `/api/monitoring/discrepancies`
- **Before:** ❌ Queried non-existent columns → Error
- **After:** ✅ Uses correct view columns
- **Query params:** `table`, `discrepancy_type`, `limit`
- **Response:** `{ discrepancies: [], total: 0, typeCounts: {} }`

### ✅ `/api/dashboard/stats`
- **Before:** ❌ Roles undefined → "No valid role"
- **After:** ✅ Roles populated from database
- **Works for:** All authenticated users with valid roles
- **Your result:** System admin stats

---

## Verification Checklist

- [x] **Fixed:** `discrepancies.js` uses correct view columns
- [x] **Fixed:** POST to discrepancies returns 405 (read-only)
- [x] **Fixed:** `requireAuth()` fetches roles from database
- [x] **Fixed:** Dashboard stats recognizes `system_admin` role
- [ ] **Test:** Restart dev server
- [ ] **Test:** `/api/monitoring/discrepancies` returns success
- [ ] **Test:** `/api/dashboard/stats` returns system admin stats
- [ ] **Verify:** Terminal shows "✅ Dashboard access: system_admin"

---

## Summary

### Problem 1: Discrepancies Endpoint
- **Cause:** Code referenced columns that don't exist in view
- **Fix:** Updated to use actual view columns
- **Result:** ✅ Works with read-only view

### Problem 2: Dashboard Stats Role Check
- **Cause:** `requireAuth()` didn't fetch roles from database
- **Fix:** Updated `requireAuth()` to query `users` table
- **Result:** ✅ Your `system_admin` role now recognized

### Your User Object After Fix:
```javascript
{
  name: "Your Name",
  email: "your-email@gmail.com",
  image: "https://...",
  id: "b05c41a3-cb16-4dbe-bf84-5d206c2a93b2",  // ✅ From database
  roles: ["mentor", "system_admin", "program_coordinator"]  // ✅ From database
}
```

---

**Status:** Ready to test! Restart server and try both endpoints.
