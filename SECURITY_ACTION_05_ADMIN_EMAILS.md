# Action 5: Remove NEXT_PUBLIC Admin Emails (CRITICAL)

**Priority:** 🔴 P0 - Do in First Week
**Time Required:** 2 hours
**Risk Level:** Medium (information disclosure)
**Difficulty:** Medium

---

## 🎯 Goal

Remove admin email list and super admin email from client-side bundle to prevent:
- Targeted phishing attacks against admins
- Social engineering
- Admin account enumeration
- Reconnaissance for privilege escalation attacks

**Current Issues:**
1. `NEXT_PUBLIC_ADMIN_EMAILS` exposed in client bundle
2. `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` exposed in client bundle
3. Client-side admin checks (insecure - can be bypassed)

---

## 🔍 Current Exposure

**Try this yourself:**
```bash
# Build the app
npm run build

# Search for admin emails in client bundle
grep -r "admin.*email" .next/static/chunks/pages/*.js

# You'll find your admin emails in the JavaScript!
```

**Anyone can:**
1. View page source
2. Search for "admin"
3. Find the email list
4. Target those users with phishing

---

## 📋 Prerequisites

- [ ] Actions 1-4 completed
- [ ] You have access to Vercel dashboard
- [ ] Backup committed

---

## 🛠️ Step-by-Step Instructions

### Step 1: Find All Uses of NEXT_PUBLIC Admin Variables

```bash
cd /home/user/mentor-report-app

# Search for NEXT_PUBLIC_ADMIN_EMAILS
grep -rn "NEXT_PUBLIC_ADMIN_EMAILS" pages/ components/ lib/

# Search for NEXT_PUBLIC_SUPER_ADMIN_EMAIL
grep -rn "NEXT_PUBLIC_SUPER_ADMIN_EMAIL" pages/ components/ lib/
```

**Expected findings (from audit):**
- `pages/laporan-sesi.js:187`
- `pages/upward-mobility.js:183`
- `pages/laporan-maju.js:103`
- `components/UserSwitcher.js:14`
- `lib/auth.js:12` (fallback, ok)

---

### Step 2: Fix lib/auth.js (Already Secure)

Check `lib/auth.js`:

```bash
cat lib/auth.js
```

**Current code (lines 11-12):**
```javascript
const adminEmails = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;
```

**This is GOOD** - it tries server-side first, falls back to public.

**Action:** Update to remove fallback:

```javascript
// BEFORE:
const adminEmails = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;

// AFTER:
const adminEmails = process.env.ADMIN_EMAILS;
if (!adminEmails) {
  console.error('CRITICAL: ADMIN_EMAILS environment variable not set');
  return false;
}
```

---

### Step 3: Fix pages/laporan-sesi.js

**Current code (line 187):**
```javascript
const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);
```

**Problem:** This runs on the client, exposing admin emails.

**Solution:** Move admin check to server-side.

**Option A: Remove client-side admin check entirely**

If you don't need to show different UI to admins on this page:

```javascript
// REMOVE this line:
const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);

// REMOVE any code that uses isAdmin
// Example:
{isAdmin && <button>Admin Only Feature</button>}
```

---

**Option B: Check admin status via API**

If you need to show admin-only UI:

1. **Create API route to check admin status:**

```bash
# Create new file
nano pages/api/check-admin.js
```

```javascript
// pages/api/check-admin.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { isAdmin } from "../../lib/auth";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ isAdmin: false });
  }

  return res.json({
    isAdmin: isAdmin(session.user.email)
  });
}
```

2. **Update laporan-sesi.js to use API:**

```javascript
// pages/laporan-sesi.js
import { useState, useEffect } from 'react';

export default function LaporanSesi() {
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      fetch('/api/check-admin')
        .then(r => r.json())
        .then(data => setIsAdmin(data.isAdmin))
        .catch(() => setIsAdmin(false));
    }
  }, [session]);

  // Rest of component...
  // Now you can use isAdmin state
}
```

---

### Step 4: Fix pages/upward-mobility.js

**Same as Step 3.** Apply the same fix:

**Current code (line 183):**
```javascript
const isAdmin = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').includes(session?.user?.email);
```

**Replace with:**
```javascript
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  if (session) {
    fetch('/api/check-admin')
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false));
  }
}, [session]);
```

---

### Step 5: Fix pages/laporan-maju.js

**Current code (line 103):**
```javascript
const isAdmin = session?.user?.email && process.env.NEXT_PUBLIC_ADMIN_EMAILS?.includes(session.user.email);
```

**Replace with same API approach:**
```javascript
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  if (session) {
    fetch('/api/check-admin')
      .then(r => r.json())
      .then(data => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false));
  }
}, [session]);
```

---

### Step 6: Fix components/UserSwitcher.js (Super Admin)

**Current code (line 14):**
```javascript
const canImpersonate = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL?.toLowerCase() ===
  session?.user?.email?.toLowerCase();
```

**Solution:** Move to API route.

1. **Create super admin check API:**

```bash
nano pages/api/check-super-admin.js
```

```javascript
// pages/api/check-super-admin.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { canImpersonate } from "../../lib/impersonation";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ canImpersonate: false });
  }

  return res.json({
    canImpersonate: canImpersonate(session.user.email)
  });
}
```

2. **Update UserSwitcher.js:**

```javascript
// components/UserSwitcher.js
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function UserSwitcher() {
  const { data: session } = useSession();
  const [canImpersonate, setCanImpersonate] = useState(false);

  useEffect(() => {
    if (session) {
      fetch('/api/check-super-admin')
        .then(r => r.json())
        .then(data => setCanImpersonate(data.canImpersonate))
        .catch(() => setCanImpersonate(false));
    }
  }, [session]);

  if (!canImpersonate) return null;

  // Rest of component...
}
```

---

### Step 7: Update Environment Variables

**In Vercel Dashboard:**

1. Go to Settings → Environment Variables

2. **Add new server-side variables** (if not exist):
   - Name: `ADMIN_EMAILS`
   - Value: `admin1@example.com,admin2@example.com`
   - Environment: Production, Preview, Development

   - Name: `SUPER_ADMIN_EMAIL`
   - Value: `superadmin@example.com`
   - Environment: Production, Preview, Development

3. **Remove old public variables:**
   - Find `NEXT_PUBLIC_ADMIN_EMAILS` → Delete
   - Find `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` → Delete

4. **Redeploy:**
   - Vercel will auto-redeploy when env vars change

---

### Step 8: Update Local .env.local

```bash
nano .env.local
```

**Remove these lines:**
```bash
# DELETE:
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_SUPER_ADMIN_EMAIL=superadmin@example.com
```

**Add these lines:**
```bash
# Server-side only (not in client bundle)
ADMIN_EMAILS=admin1@example.com,admin2@example.com
SUPER_ADMIN_EMAIL=superadmin@example.com
```

---

### Step 9: Test Locally

```bash
# Restart dev server (to reload env vars)
npm run dev
```

**Test admin functionality:**

1. Login as regular user
   - Should NOT see admin features
   - `/api/check-admin` returns `{isAdmin: false}`

2. Login as admin user (use email from ADMIN_EMAILS)
   - SHOULD see admin features
   - `/api/check-admin` returns `{isAdmin: true}`

3. Login as super admin
   - Should see impersonation UI
   - `/api/check-super-admin` returns `{canImpersonate: true}`

---

### Step 10: Verify Client Bundle Clean

```bash
# Build for production
npm run build

# Search for admin emails in bundle (should find NOTHING)
grep -r "admin.*@" .next/static/chunks/ || echo "✅ No admin emails found"

# Search for NEXT_PUBLIC_ADMIN
grep -r "NEXT_PUBLIC_ADMIN" .next/static/chunks/ || echo "✅ No NEXT_PUBLIC_ADMIN found"
```

**Expected:** Both commands should show "✅" message.

---

### Step 11: Commit Changes

```bash
git add pages/laporan-sesi.js \
        pages/upward-mobility.js \
        pages/laporan-maju.js \
        components/UserSwitcher.js \
        lib/auth.js \
        pages/api/check-admin.js \
        pages/api/check-super-admin.js

git commit -m "security: Remove admin emails from client-side bundle

- Moved NEXT_PUBLIC_ADMIN_EMAILS to server-side ADMIN_EMAILS
- Moved NEXT_PUBLIC_SUPER_ADMIN_EMAIL to server-side SUPER_ADMIN_EMAIL
- Created /api/check-admin endpoint for server-side admin verification
- Created /api/check-super-admin for impersonation checks
- Updated all pages to use API for admin checks instead of client-side env vars

- Prevents admin email enumeration via client bundle
- Prevents targeted phishing attacks
- Removes reconnaissance vector for privilege escalation

Files changed:
- lib/auth.js: Remove NEXT_PUBLIC fallback
- pages/laporan-sesi.js: Use API for admin check
- pages/upward-mobility.js: Use API for admin check
- pages/laporan-maju.js: Use API for admin check
- components/UserSwitcher.js: Use API for super admin check
- pages/api/check-admin.js: New server-side admin verification
- pages/api/check-super-admin.js: New super admin verification

Fixes: Admin email exposure in client bundle"
```

---

## 🧪 Testing Checklist

**As Regular User:**
- [ ] Login works
- [ ] Admin-only features NOT visible
- [ ] `/api/check-admin` returns `{isAdmin: false}`

**As Admin User:**
- [ ] Login works
- [ ] Admin-only features ARE visible
- [ ] `/api/check-admin` returns `{isAdmin: true}`
- [ ] Can access admin pages

**As Super Admin:**
- [ ] Login works
- [ ] User switcher/impersonation UI visible
- [ ] `/api/check-super-admin` returns `{canImpersonate: true}`

**In Production Bundle:**
- [ ] `grep` finds no admin emails in `.next/static/`
- [ ] No `NEXT_PUBLIC_ADMIN` references in bundle

---

## 🔄 Rollback Instructions

```bash
# Revert changes
git revert HEAD

# Restore env vars in Vercel
# Add back: NEXT_PUBLIC_ADMIN_EMAILS
# Add back: NEXT_PUBLIC_SUPER_ADMIN_EMAIL
```

---

## 📊 Success Metrics

**Before:**
```bash
grep -r "admin.*@example.com" .next/static/
# Found: admin1@example.com, admin2@example.com in bundle
```

**After:**
```bash
grep -r "admin.*@example.com" .next/static/
# Found: 0 results ✅
```

---

## 🐛 Troubleshooting

### Issue: "ADMIN_EMAILS not set" error in logs

**Cause:** Server-side env var not configured.

**Solution:**
```bash
# Verify in Vercel:
vercel env ls

# Should show ADMIN_EMAILS (not NEXT_PUBLIC_ADMIN_EMAILS)

# Pull locally:
vercel env pull .env.local
```

---

### Issue: Admin features not showing for admin users

**Cause:** Email mismatch or API not returning correct status.

**Debug:**
```bash
# Check API response
curl http://localhost:3000/api/check-admin \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Check server logs for isAdmin() calls
npm run dev
# Watch logs for "Admin check for ..."
```

---

### Issue: Infinite re-renders in useEffect

**Cause:** Missing dependency or incorrect dependency array.

**Solution:**
```javascript
// Make sure dependency array includes session
useEffect(() => {
  if (session) {
    // fetch...
  }
}, [session]); // ✅ session in dependencies
```

---

## ✅ Completion Criteria

1. ✅ All `NEXT_PUBLIC_ADMIN_EMAILS` removed from code
2. ✅ All `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` removed from code
3. ✅ API endpoints created for server-side checks
4. ✅ Vercel env vars updated (NEXT_PUBLIC deleted, server-side added)
5. ✅ Client bundle contains no admin emails
6. ✅ Admin functionality still works
7. ✅ Changes committed

---

## 📝 Next Steps

After completing this action:
- **Week 1 Complete!** 🎉
- Proceed to **Action 6: Add Rate Limiting**
- File: `SECURITY_ACTION_06_RATE_LIMITING.md`

---

**Estimated Time Spent:** _________ minutes
**Issues Encountered:** _________________________________
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Blocked
