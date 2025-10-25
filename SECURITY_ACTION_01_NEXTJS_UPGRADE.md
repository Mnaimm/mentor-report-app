# Action 1: Upgrade Next.js (CRITICAL)

**Priority:** 🔴 P0 - Do Today
**Time Required:** 1 hour
**Risk Level:** High
**Difficulty:** Easy

---

## 🎯 Goal

Upgrade Next.js from 13.5.6 to 14.2.30+ to patch 6 critical vulnerabilities:
- GHSA-fr5h-rqp8-mj6g: SSRF in Server Actions (CVSS 7.5)
- GHSA-gp8f-8m3g-qvj9: Cache Poisoning (CVSS 7.5)
- GHSA-g77x-44xx-532m: DoS in image optimization (CVSS 5.9)
- And 3 more...

---

## 📋 Prerequisites

- [ ] Git working directory is clean (commit or stash changes)
- [ ] You have backup/can rollback if needed
- [ ] Node.js 18.17+ or 20.10+ installed (you have v22.20.0 ✅)

---

## 🛠️ Step-by-Step Instructions

### Step 1: Check Current Status

```bash
cd /home/user/mentor-report-app

# See current version
npm list next
# Output: next@13.5.6

# Check for vulnerabilities
npm audit | grep next
```

**Expected output:** Should show multiple "high" and "critical" findings.

---

### Step 2: Backup Current State

```bash
# Create a backup branch
git checkout -b backup-before-nextjs-upgrade
git add -A
git commit -m "backup: Before Next.js upgrade"

# Return to your working branch
git checkout claude/security-audit-google-oauth-011CUSK1B682QgFr8UQpieUh
```

---

### Step 3: Upgrade Next.js

```bash
# Upgrade to latest 14.x version
npm install next@14.2.30

# Also upgrade React (Next.js 14 requires React 18.2+, you already have it)
npm install react@latest react-dom@latest
```

**Expected output:**
```
+ next@14.2.30
+ react@18.3.1
+ react-dom@18.3.1
```

---

### Step 4: Review Breaking Changes

Next.js 14 has some breaking changes. Check these files:

#### A. Check `next.config.js`

Your current config should work, but verify:

```bash
cat next.config.js
```

**Potential issues:**
- ✅ You're using Pages Router (no changes needed)
- ✅ Headers config is compatible
- ⚠️ If build fails, may need to update `swcMinify: true` to just remove it (enabled by default in v14)

#### B. Check API routes

Next.js 14 changes how some API routes behave:

```bash
# Verify no usage of deprecated features
grep -r "unstable_" pages/api/
```

**Expected:** Should find no results (you're not using unstable APIs ✅)

---

### Step 5: Test Build

```bash
# Build the application
npm run build
```

**Expected output:** Build completes successfully with no errors.

**Common errors and fixes:**

**Error 1:** `Error: Invalid next.config.js options detected`
```javascript
// Fix: Remove deprecated options in next.config.js
// Remove: swcMinify (enabled by default)
```

**Error 2:** `Module not found: Can't resolve 'next/image'`
```javascript
// Fix: Update image imports
// Old: import Image from 'next/image'
// New: Same (no change needed)
```

**Error 3:** `middleware.js` errors
```javascript
// Your middleware.js is simple and should work fine
// If errors occur, verify it matches this:
export { default } from "next-auth/middleware";
export const config = {
  matcher: ["/", "/laporan-sesi", "/upward-mobility", "/growthwheel"],
};
```

---

### Step 6: Test Development Server

```bash
npm run dev
```

**Then in browser:**
1. Open http://localhost:3000
2. Test login (Google OAuth should work)
3. Navigate to each protected page
4. Submit a test form (use a test mentee if possible)

**✅ Checklist:**
- [ ] Homepage loads
- [ ] Login works
- [ ] Protected pages load after login
- [ ] Forms can be submitted
- [ ] No console errors in browser DevTools

---

### Step 7: Verify Vulnerabilities Fixed

```bash
npm audit
```

**Expected output:**
```
found 0 vulnerabilities
```

Or at least no "high" or "critical" vulnerabilities related to Next.js.

---

### Step 8: Commit Changes

```bash
git add package.json package-lock.json
git commit -m "security: Upgrade Next.js from 13.5.6 to 14.2.30

- Fixes GHSA-fr5h-rqp8-mj6g (SSRF, CVSS 7.5)
- Fixes GHSA-gp8f-8m3g-qvj9 (Cache Poisoning, CVSS 7.5)
- Fixes 4 additional CVEs in Next.js 13.5.x
- All tests passing, no breaking changes detected"
```

---

## 🧪 Testing Checklist

Before marking this action complete, verify:

- [ ] `npm audit` shows 0 high/critical Next.js vulnerabilities
- [ ] Local dev server runs without errors
- [ ] Production build completes (`npm run build`)
- [ ] Login/logout works
- [ ] At least one form submission works
- [ ] No console errors in browser

---

## 🔄 Rollback Instructions

If something breaks:

```bash
# Option 1: Revert the commit
git revert HEAD
npm install

# Option 2: Restore from backup branch
git checkout backup-before-nextjs-upgrade
git checkout -b recovery
npm install

# Option 3: Manual downgrade
npm install next@13.5.6
```

---

## 📊 Success Metrics

**Before:**
- Next.js version: 13.5.6
- npm audit: 6 high/critical vulnerabilities

**After:**
- Next.js version: 14.2.30
- npm audit: 0 high/critical Next.js vulnerabilities

---

## 🐛 Troubleshooting

### Issue: Build fails with "Module not found"

**Solution:** Clear Next.js cache and rebuild:
```bash
rm -rf .next
npm run build
```

---

### Issue: "Invalid hook call" error

**Solution:** Ensure React and React-DOM are the same version:
```bash
npm list react react-dom
# Both should be 18.x.x

# If different, reinstall:
npm install react@18.3.1 react-dom@18.3.1
```

---

### Issue: API routes return 500 errors

**Solution:** Check API route file structure hasn't changed:
```bash
# Verify all API routes are still in pages/api/
ls -la pages/api/

# Check for syntax errors
npm run build 2>&1 | grep "pages/api"
```

---

## ✅ Completion Criteria

Mark this action as complete when:
1. ✅ Next.js upgraded to 14.2.30+
2. ✅ `npm audit` shows 0 high/critical Next.js CVEs
3. ✅ Application builds successfully
4. ✅ Manual testing confirms no regressions
5. ✅ Changes committed to Git

---

## 📝 Next Steps

After completing this action:
- Proceed to **Action 2: Remove OAuth Token from Client Session**
- File: `SECURITY_ACTION_02_OAUTH_FIX.md`

---

**Estimated Time Spent:** _________ minutes
**Issues Encountered:** _________________________________
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Blocked
