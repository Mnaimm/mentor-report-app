# RBAC Testing Guide - Role-Based Access Control

## Overview
This guide helps you test the complete RBAC implementation across all pages and roles.

---

## Test Users Setup

Before testing, ensure you have test users in the `user_roles` table with different role combinations:

### Required Test Users:
```sql
-- 1. System Admin (Full Access)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('admin@test.com', 'system_admin', 'system', NOW());

-- 2. Program Coordinator (Admin + Coordinator Access)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('coordinator@test.com', 'program_coordinator', 'system', NOW());

-- 3. Report Admin (Admin Only)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('reportadmin@test.com', 'report_admin', 'system', NOW());

-- 4. Payment Admin (Admin Only)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('paymentadmin@test.com', 'payment_admin', 'system', NOW());

-- 5. Stakeholder ONLY (Read-Only Everywhere)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('stakeholder@test.com', 'stakeholder', 'system', NOW());

-- 6. Stakeholder + Payment Approver (Read-Only Test - Should NOT be read-only)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('yusry@test.com', 'stakeholder', 'system', NOW()),
('yusry@test.com', 'payment_approver', 'system', NOW());

-- 7. Mentor Only (No Admin Access)
INSERT INTO user_roles (email, role, assigned_by, assigned_at) VALUES
('mentor@test.com', 'mentor', 'system', NOW());
```

---

## Test Matrix

### Page Access Matrix

| Role                  | /admin | /coordinator | /monitoring | /superadmin/roles | Read-Only? |
|-----------------------|--------|--------------|-------------|-------------------|------------|
| system_admin          | ✅ Edit | ✅ Edit      | ✅ Edit     | ✅ Access         | ❌         |
| program_coordinator   | ✅ Edit | ✅ Edit      | ❌ Denied   | ❌ Denied         | ❌         |
| report_admin          | ✅ Edit | ❌ Denied    | ❌ Denied   | ❌ Denied         | ❌         |
| payment_admin         | ✅ Edit | ❌ Denied    | ❌ Denied   | ❌ Denied         | ❌         |
| stakeholder (ONLY)    | ✅ View | ✅ View      | ✅ View     | ❌ Denied         | ✅         |
| stakeholder + other   | ✅ Edit | ✅ Edit      | ✅ Edit     | ❌ Denied         | ❌         |
| mentor                | ❌ Denied | ❌ Denied  | ❌ Denied   | ❌ Denied         | N/A        |

---

## Detailed Test Cases

### Test 1: System Admin (admin@test.com)
**Expected: Full access to everything**

#### Test Steps:
1. ✅ Sign in as `admin@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - "Refresh Data" button should be ENABLED
   - NO "View Only" badge
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see coordinator dashboard
   - "Refresh Data" button should be ENABLED
   - "Assign" buttons should be VISIBLE
   - Bulk assignment should WORK
   - NO "View Only" badge
4. ✅ Navigate to `/monitoring`
   - Should see monitoring dashboard
   - "Compare Now" button should be ENABLED
   - "Resolve" buttons on discrepancies should be VISIBLE
   - NO "View Only" badge
5. ✅ Navigate to `/superadmin/roles`
   - Should see role management page
   - Can add/remove roles
   - Can see all users

**Result:** ✅ PASS / ❌ FAIL

---

### Test 2: Program Coordinator (coordinator@test.com)
**Expected: Full access to admin + coordinator, denied monitoring**

#### Test Steps:
1. ✅ Sign in as `coordinator@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - "Refresh Data" button should be ENABLED
   - NO "View Only" badge
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see coordinator dashboard
   - "Refresh Data" button should be ENABLED
   - "Assign" buttons should be VISIBLE
   - NO "View Only" badge
4. ✅ Navigate to `/monitoring`
   - Should see "Access Denied" page
   - Red warning icon
   - "Go Back" and "Sign Out" buttons
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page

**Result:** ✅ PASS / ❌ FAIL

---

### Test 3: Report Admin (reportadmin@test.com)
**Expected: Full access to admin only, denied everything else**

#### Test Steps:
1. ✅ Sign in as `reportadmin@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - "Refresh Data" button should be ENABLED
   - NO "View Only" badge
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see "Access Denied" page
4. ✅ Navigate to `/monitoring`
   - Should see "Access Denied" page
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page

**Result:** ✅ PASS / ❌ FAIL

---

### Test 4: Payment Admin (paymentadmin@test.com)
**Expected: Full access to admin only, denied everything else**

#### Test Steps:
1. ✅ Sign in as `paymentadmin@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - "Refresh Data" button should be ENABLED
   - NO "View Only" badge
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see "Access Denied" page
4. ✅ Navigate to `/monitoring`
   - Should see "Access Denied" page
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page

**Result:** ✅ PASS / ❌ FAIL

---

### Test 5: Stakeholder ONLY (stakeholder@test.com) - READ-ONLY MODE
**Expected: View-only access to admin + coordinator + monitoring**

#### Test Steps:
1. ✅ Sign in as `stakeholder@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - **"View Only" badge should be VISIBLE in top-right**
   - "Refresh Data" button should be DISABLED (grayed out)
   - Tooltip on hover: "View-only access - refresh disabled"
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see coordinator dashboard
   - **"View Only" badge should be VISIBLE in top-right**
   - "Refresh Data" button should be DISABLED
   - "Assign" buttons should be HIDDEN
   - Bulk assignment bar should be HIDDEN
   - "Select All" checkbox should be HIDDEN
   - Yellow info message: "You have view-only access to this dashboard"
4. ✅ Navigate to `/monitoring`
   - Should see monitoring dashboard
   - **"View Only" badge should be VISIBLE in top-right**
   - "Compare Now" button should be DISABLED
   - "Resolve" buttons should be HIDDEN
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page

**Result:** ✅ PASS / ❌ FAIL

---

### Test 6: Stakeholder + Payment Approver (yusry@test.com) - NOT READ-ONLY
**Expected: Full edit access (multi-role user, NOT read-only)**

#### Test Steps:
1. ✅ Sign in as `yusry@test.com`
2. ✅ Navigate to `/admin`
   - Should see admin dashboard
   - "Refresh Data" button should be ENABLED
   - **NO "View Only" badge** (important!)
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see coordinator dashboard
   - "Refresh Data" button should be ENABLED
   - "Assign" buttons should be VISIBLE
   - **NO "View Only" badge** (important!)
4. ✅ Navigate to `/monitoring`
   - Should see monitoring dashboard
   - "Compare Now" button should be ENABLED
   - "Resolve" buttons should be VISIBLE
   - **NO "View Only" badge** (important!)
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page (not system_admin)

**Result:** ✅ PASS / ❌ FAIL

---

### Test 7: Mentor Only (mentor@test.com)
**Expected: Denied access to all admin pages**

#### Test Steps:
1. ✅ Sign in as `mentor@test.com`
2. ✅ Navigate to `/admin`
   - Should see "Access Denied" page
3. ✅ Navigate to `/coordinator/dashboard`
   - Should see "Access Denied" page
4. ✅ Navigate to `/monitoring`
   - Should see "Access Denied" page
5. ✅ Navigate to `/superadmin/roles`
   - Should see "Access Denied" page

**Result:** ✅ PASS / ❌ FAIL

---

## Test 8: Superadmin Role Management Page

### Test 8A: List Users
1. ✅ Sign in as `admin@test.com`
2. ✅ Navigate to `/superadmin/roles`
3. ✅ Verify all test users are displayed
4. ✅ Verify role chips are color-coded
5. ✅ Verify statistics show correct counts

**Result:** ✅ PASS / ❌ FAIL

### Test 8B: Add Role
1. ✅ Click "+ Add Role" button
2. ✅ Enter email: `stakeholder@test.com`
3. ✅ Select role: `payment_approver`
4. ✅ Click "Add Role"
5. ✅ Verify success message
6. ✅ Verify `stakeholder@test.com` now has 2 roles
7. ✅ Sign in as `stakeholder@test.com` and verify they are NO LONGER read-only

**Result:** ✅ PASS / ❌ FAIL

### Test 8C: Remove Role (Normal)
1. ✅ Find user with multiple roles (e.g., `yusry@test.com`)
2. ✅ Click ✕ on one role chip
3. ✅ Confirm in dialog
4. ✅ Verify success message
5. ✅ Verify role is removed from user

**Result:** ✅ PASS / ❌ FAIL

### Test 8D: Remove Role (Last Role Prevention)
1. ✅ Find user with only 1 role (e.g., `mentor@test.com`)
2. ✅ Try to click ✕ on their only role
3. ✅ Verify error message: "Cannot remove the last role from a user"

**Result:** ✅ PASS / ❌ FAIL

### Test 8E: Remove Last System Admin Prevention
1. ✅ Ensure there's only 1 user with `system_admin` role
2. ✅ Try to remove `system_admin` role from that user
3. ✅ Verify error message: "Cannot remove the last system_admin role"

**Result:** ✅ PASS / ❌ FAIL

### Test 8F: Search and Filter
1. ✅ Enter search query (e.g., "stakeholder")
2. ✅ Verify only matching users are shown
3. ✅ Clear search and verify all users return
4. ✅ Select role filter (e.g., "System Admin")
5. ✅ Verify only users with that role are shown

**Result:** ✅ PASS / ❌ FAIL

---

## Test 9: API Endpoint Testing (Optional - Manual API Testing)

### Test 9A: GET /api/superadmin/list-users
```bash
# Should succeed for system_admin
curl -X GET http://localhost:3000/api/superadmin/list-users \
  -H "Cookie: next-auth.session-token=<admin_session_token>"

# Should fail (403) for non-admin
curl -X GET http://localhost:3000/api/superadmin/list-users \
  -H "Cookie: next-auth.session-token=<mentor_session_token>"
```

**Result:** ✅ PASS / ❌ FAIL

### Test 9B: POST /api/superadmin/add-user-role
```bash
# Should succeed for system_admin
curl -X POST http://localhost:3000/api/superadmin/add-user-role \
  -H "Cookie: next-auth.session-token=<admin_session_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "mentor"}'

# Should fail (403) for non-admin
curl -X POST http://localhost:3000/api/superadmin/add-user-role \
  -H "Cookie: next-auth.session-token=<coordinator_session_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "mentor"}'
```

**Result:** ✅ PASS / ❌ FAIL

### Test 9C: DELETE /api/superadmin/remove-user-role
```bash
# Should succeed for system_admin
curl -X DELETE http://localhost:3000/api/superadmin/remove-user-role \
  -H "Cookie: next-auth.session-token=<admin_session_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "mentor"}'

# Should fail (403) for non-admin
curl -X DELETE http://localhost:3000/api/superadmin/remove-user-role \
  -H "Cookie: next-auth.session-token=<coordinator_session_token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "mentor"}'
```

**Result:** ✅ PASS / ❌ FAIL

---

## Test 10: Edge Cases

### Test 10A: Unauthenticated User
1. ✅ Sign out completely
2. ✅ Navigate to `/admin` - should redirect to sign-in
3. ✅ Navigate to `/coordinator/dashboard` - should redirect to sign-in
4. ✅ Navigate to `/monitoring` - should redirect to sign-in
5. ✅ Navigate to `/superadmin/roles` - should redirect to sign-in

**Result:** ✅ PASS / ❌ FAIL

### Test 10B: Auto-Created Mentor Role
1. ✅ Sign in with a completely new Google account (not in user_roles table)
2. ✅ Check Supabase `user_roles` table
3. ✅ Verify new user was auto-created with `mentor` role
4. ✅ Verify they are denied access to admin pages

**Result:** ✅ PASS / ❌ FAIL

### Test 10C: Case Insensitivity
1. ✅ Add role with email: `Test@Example.COM`
2. ✅ Verify it's stored as lowercase: `test@example.com`
3. ✅ Sign in as `TEST@EXAMPLE.COM`
4. ✅ Verify roles are correctly retrieved

**Result:** ✅ PASS / ❌ FAIL

---

## Summary Checklist

After completing all tests, verify:

- [ ] All 7 test users can sign in
- [ ] system_admin has full access everywhere
- [ ] program_coordinator can access admin + coordinator only
- [ ] report_admin can access admin only
- [ ] payment_admin can access admin only
- [ ] stakeholder (ONLY) has read-only mode with badge
- [ ] stakeholder + other role has FULL edit access (NOT read-only)
- [ ] mentor is denied access to all admin pages
- [ ] AccessDenied component shows properly
- [ ] ReadOnlyBadge shows only for stakeholder-only users
- [ ] All edit buttons/actions are disabled for read-only users
- [ ] Superadmin role management page works correctly
- [ ] Cannot remove last role from user
- [ ] Cannot remove last system_admin from system
- [ ] All API endpoints have proper authorization
- [ ] Unauthenticated users are redirected to sign-in

---

## Troubleshooting

### Issue: User not getting expected access
**Solution:**
```sql
-- Check user's roles in Supabase
SELECT * FROM user_roles WHERE email = 'user@test.com';

-- Check lib/auth.js isReadOnly() logic
-- User is read-only ONLY if they have EXACTLY ONE role: stakeholder
```

### Issue: Read-only badge not showing
**Solution:**
- Check browser console for errors
- Verify `isReadOnlyUser` prop is being passed correctly
- Check getServerSideProps is calling `isReadOnly()`

### Issue: API endpoints returning 401/403
**Solution:**
- Clear browser cookies and sign in again
- Check session is valid: `await getSession({ req })`
- Verify user has `system_admin` role in database

---

## Testing Complete! ✅

Once all tests pass, your RBAC implementation is production-ready.

**Next Steps:**
1. Deploy to staging environment
2. Test with real user accounts
3. Monitor audit logs in `sync_operations` table
4. Document for team training
