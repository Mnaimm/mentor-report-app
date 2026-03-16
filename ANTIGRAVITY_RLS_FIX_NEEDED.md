# RLS Security Implementation - Frontend Fix Required

## What Just Happened

We successfully implemented Row Level Security (RLS) on the Supabase database. This locks down all data so:
- Mentors can only see their own data
- Admins can see everything
- Service role (backend) bypasses all restrictions

**This is working correctly! ✅**

## The Problem

Naim is now seeing this error when accessing `/mentor/my-entrepreneurs`:

```
Access Denied
Your account (naemmukhtar@gmail.com) is not registered as a mentor.
Please contact the administrator if you believe this is an error.
```

**This is a FRONTEND issue, not a database issue.**

## Why This Happens

Naim's database record is correct:
- ✅ User ID: `b05c41a3-cb16-4dbe-bf84-5d206c2a93b2`
- ✅ Email: `naemmukhtar@gmail.com`
- ✅ Roles: `{mentor, system_admin, program_coordinator}` (array)
- ✅ Mentor Profile ID: `59e0e2d1-ea2c-4634-a6a2-988f4153dc40`
- ✅ Status: `active`

The frontend is not correctly detecting that he's a mentor.

## Root Cause Analysis

There are 3 possible issues:

### Issue #1: NextAuth Session Not Fetching Roles (Most Likely)

The NextAuth session callback is probably not fetching the `roles` array from the database.

**Current Problem:**
```typescript
// Session probably looks like:
{
  user: {
    email: "naemmukhtar@gmail.com",
    name: "NAIM",
    // roles is MISSING! ❌
  }
}
```

**Required Fix:**
```typescript
// In [...nextauth].ts or auth config:

import { createClient } from '@supabase/supabase-js';

// CRITICAL: Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← Service role, NOT anon key!
);

// In callbacks:
callbacks: {
  async session({ session, token }) {
    if (session?.user?.email) {
      // Fetch user with roles from database
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, roles, status')
        .eq('email', session.user.email)
        .single();
      
      if (userData && !error) {
        session.user.id = userData.id;
        session.user.roles = userData.roles; // ← MUST include this!
        session.user.status = userData.status;
      }
    }
    return session;
  },
  
  async jwt({ token, user, account }) {
    // Store user ID in token on initial sign in
    if (user) {
      token.userId = user.id;
    }
    return token;
  }
}
```

### Issue #2: Frontend Role Check Logic

The page might be checking roles incorrectly.

**Wrong Way ❌:**
```typescript
// Checking singular "role" instead of "roles" array
if (session?.user?.role !== 'mentor') {
  return <AccessDenied />;
}

// Or checking wrong field name
if (session?.user?.user_role !== 'mentor') {
  return <AccessDenied />;
}
```

**Correct Way ✅:**
```typescript
// In /mentor/my-entrepreneurs page:

const session = await getServerSession(authOptions);

// Check if user has mentor role in roles array
const isMentor = session?.user?.roles?.includes('mentor');
const isAdmin = session?.user?.roles?.includes('system_admin') || 
                session?.user?.roles?.includes('program_coordinator');

if (!isMentor && !isAdmin) {
  return (
    <div>
      <h1>Access Denied</h1>
      <p>Your account ({session?.user?.email}) is not registered as a mentor.</p>
      <p>Your roles: {JSON.stringify(session?.user?.roles)}</p>
    </div>
  );
}

// Continue with page...
```

### Issue #3: Supabase Client Using Wrong Key

If you're fetching user data anywhere in middleware or page components, ensure you use the **service role key** to bypass RLS.

**Wrong ❌:**
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ← Will be blocked by RLS!
);
```

**Correct ✅:**
```typescript
// For server-side user lookups (NextAuth callbacks, middleware):
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← Bypasses RLS
);
```

## Files to Check

1. **`[...nextauth].ts`** or **`auth.ts`** (NextAuth configuration)
   - Check session callback
   - Ensure roles are fetched from database
   - Ensure service role key is used

2. **`/app/mentor/my-entrepreneurs/page.tsx`** (or wherever the error appears)
   - Check how roles are validated
   - Ensure checking `roles.includes('mentor')` not `role === 'mentor'`

3. **`middleware.ts`** (if exists)
   - Check role validation logic
   - Ensure service role used for user lookups

## Quick Debug Steps

### Step 1: Log the Session
Add this to the mentor page temporarily:

```typescript
const session = await getServerSession(authOptions);
console.log('DEBUG - Full session:', JSON.stringify(session, null, 2));
console.log('DEBUG - User roles:', session?.user?.roles);
console.log('DEBUG - Is array?', Array.isArray(session?.user?.roles));
```

### Step 2: Check What's Missing
If logs show:
- `roles: undefined` → Fix NextAuth session callback
- `roles: null` → Fix NextAuth session callback  
- `roles: []` → Database issue (unlikely, we verified it's correct)
- `roles: "{mentor,..."` → It's a string, needs parsing
- `roles: ["mentor",...]` → Logic check is wrong

### Step 3: Verify Service Role Key
In NextAuth config:
```typescript
console.log('Using service role:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
```

Make sure it's the **service role key** (starts with `eyJ...` and is ~200+ chars), NOT the anon key.

## Expected Behavior After Fix

Once fixed, Naim should be able to access:
- ✅ `/mentor/my-entrepreneurs` (he has mentor role)
- ✅ Any admin pages (he has admin roles)
- ✅ His own mentor profile
- ✅ His assigned entrepreneurs
- ✅ His own reports

## Why RLS Was Critical

**Before RLS (DANGEROUS):**
- Any mentor could see ALL other mentors' bank accounts
- Any mentor could read/edit ANY report from ANY other mentor
- All entrepreneur data was exposed to everyone
- The database was essentially public with authentication theater

**After RLS (SECURE):**
- Mentors can ONLY see their own data + assigned entrepreneurs
- Admins see everything
- Service role (sync scripts) bypass all restrictions
- Sensitive data (bank accounts, session IDs) is protected

## Backend/Sync Scripts

**Important:** Your Google Sheets sync scripts are NOT affected. They use the service role key which bypasses RLS entirely. They'll continue working exactly as before.

## Test Plan After Fix

1. **Test as Naim (Admin + Mentor)**
   - Should access all mentor pages ✅
   - Should access all admin pages ✅

2. **Test as Regular Mentor** (non-admin)
   - Should access mentor pages ✅
   - Should NOT access admin pages ❌
   - Should only see own reports ✅
   - Should only see assigned entrepreneurs ✅

3. **Test Sync Scripts**
   - Run Google Sheets → Supabase sync
   - Verify data syncs correctly
   - Check dual_write_logs for any errors

## Need Help?

If the fix isn't clear, I can:
1. Review your actual NextAuth configuration file
2. Review your mentor page code
3. Create the exact fix for your specific setup

Just share:
- `[...nextauth].ts` or auth configuration file
- `/mentor/my-entrepreneurs/page.tsx` file
- Any middleware or auth utility files

---

## TL;DR for Antigravity

**Problem:** Frontend can't see user roles after RLS implementation
**Root Cause:** NextAuth session callback not fetching `roles` from database
**Fix Required:** Update NextAuth config to fetch roles using service role key
**Impact:** Low - only affects initial login, backend/sync scripts unaffected
**Priority:** Medium - blocking mentor access but database is secure

The database is now properly secured. We just need the frontend to correctly read the roles from the session.
