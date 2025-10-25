# Action 3: Fix CORS Policy (CRITICAL)

**Priority:** 🔴 P0 - Do Today
**Time Required:** 15 minutes
**Risk Level:** High
**Difficulty:** Easy

---

## 🎯 Goal

Fix CORS policy to prevent Cross-Site Request Forgery (CSRF) attacks.

**Current Issue:**
```javascript
// next.config.js:36
{ key: 'Access-Control-Allow-Origin', value: '*' } // ❌ Allows ANY website to call your API!
```

This means **any malicious website** can make authenticated requests to your API on behalf of logged-in users.

---

## 🔍 Attack Scenario (What Could Happen)

1. User logs into your app: `mentor-report-app.vercel.app`
2. User (still logged in) visits evil site: `evil-hacker.com`
3. `evil-hacker.com` contains JavaScript that calls your API:
   ```javascript
   fetch('https://mentor-report-app.vercel.app/api/submitReport', {
     method: 'POST',
     credentials: 'include', // Sends your cookies!
     body: JSON.stringify({ /* malicious data */ })
   })
   ```
4. Because CORS is `*`, the browser allows this request
5. Your API accepts it (user is authenticated via cookies)
6. Attacker submits fake reports, deletes data, etc.

**With proper CORS:** Step 4 would fail - browser blocks the request.

---

## 📋 Prerequisites

- [ ] Actions 1 & 2 completed
- [ ] You know your production domain(s)
- [ ] Backup committed

---

## 🛠️ Step-by-Step Instructions

### Step 1: Review Current CORS Config

```bash
# View current config
cat next.config.js | grep -A3 "Access-Control"
```

**Current code (lines 36-38):**
```javascript
{ key: 'Access-Control-Allow-Origin', value: '*' },
{ key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
{ key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
```

---

### Step 2: Determine Your Allowed Origins

**Questions to answer:**

1. **Do you need CORS at all?**
   - If your frontend and API are on the SAME domain (e.g., both on `mentor-report-app.vercel.app`), you likely don't need CORS headers at all!
   - Next.js apps typically don't need CORS for same-origin requests.

2. **Do you have multiple domains?**
   - Production: `mentor-report-app.vercel.app`
   - Staging: `staging-mentor-app.vercel.app`
   - Local dev: `localhost:3000`

**Recommendation:** **Remove CORS headers entirely** (most secure option for same-origin apps).

**Alternative:** If you need CORS (e.g., calling API from a different subdomain), whitelist specific origins only.

---

### Step 3: Option A - Remove CORS Headers (Recommended)

Edit `next.config.js`:

```bash
nano next.config.js
# or
code next.config.js
```

**Find lines 36-38:**
```javascript
// Your existing CORS headers (keep if you need them)
{ key: 'Access-Control-Allow-Origin', value: '*' },
{ key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
{ key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
```

**Replace with a comment:**
```javascript
// CORS headers removed - not needed for same-origin requests
// If you need to call API from different domain, use Option B below
```

**Full updated headers section:**
```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

        // CORS headers removed - not needed for same-origin requests
      ]
    }
  ];
}
```

Save the file.

---

### Step 4: Option B - Whitelist Specific Origins (If CORS Needed)

**Only use this if you NEED to call your API from a different domain.**

Edit `next.config.js`:

```javascript
async headers() {
  // Define allowed origins
  const allowedOrigins = [
    'https://mentor-report-app.vercel.app', // Production
    'https://staging-mentor-app.vercel.app', // Staging (if exists)
  ];

  // Add localhost in development only
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
  }

  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

        // CORS: Allow only specific origins
        {
          key: 'Access-Control-Allow-Origin',
          value: allowedOrigins.join(', ')
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, POST, PUT, DELETE, OPTIONS'
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization'
        },
      ]
    }
  ];
}
```

**Note:** This approach has limitations. For production, consider using middleware to check `Origin` header dynamically.

---

### Step 5: Add Dynamic Origin Checking (Advanced, Option C)

**Use this if you need more sophisticated CORS handling.**

Create `middleware.js` (you already have one, so extend it):

```bash
# Backup current middleware
cp middleware.js middleware.js.backup

# Edit middleware
nano middleware.js
```

**Replace with:**
```javascript
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req) {
  const { pathname, origin } = req.nextUrl;

  // Handle CORS for API routes only
  if (pathname.startsWith('/api/')) {
    const allowedOrigins = [
      'https://mentor-report-app.vercel.app',
      'https://staging-mentor-app.vercel.app',
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
    ];

    const requestOrigin = req.headers.get('origin');

    // Handle preflight (OPTIONS) requests
    if (req.method === 'OPTIONS') {
      if (allowedOrigins.includes(requestOrigin)) {
        return new NextResponse(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': requestOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }
      return new NextResponse(null, { status: 403 });
    }

    // For actual requests, check origin
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      return new NextResponse('CORS policy violation', { status: 403 });
    }
  }

  // Continue with NextAuth protection for pages
  const token = await getToken({ req });
  const isAuthPage = pathname.startsWith('/api/auth');

  if (!token && !isAuthPage && (
    pathname === '/' ||
    pathname.startsWith('/laporan-sesi') ||
    pathname.startsWith('/upward-mobility') ||
    pathname.startsWith('/growthwheel')
  )) {
    return NextResponse.redirect(new URL('/api/auth/signin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/laporan-sesi', '/upward-mobility', '/growthwheel', '/api/:path*'],
};
```

**Note:** This is the most secure option but requires more testing.

---

### Step 6: Test CORS Policy

```bash
# Start dev server
npm run dev
```

**Test 1: Same-origin requests (should work)**

In browser console on http://localhost:3000:
```javascript
fetch('/api/mentor-stats', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
// Should work (returns data or 401 if not logged in)
```

**Test 2: Cross-origin requests (should be blocked)**

Create a test HTML file on your desktop:
```html
<!-- test-cors.html -->
<!DOCTYPE html>
<html>
<body>
<script>
fetch('http://localhost:3000/api/mentor-stats', {
  credentials: 'include',
  mode: 'cors'
})
.then(r => r.json())
.then(console.log)
.catch(err => console.error('Blocked!', err));
</script>
</body>
</html>
```

Open this file directly (file:/// protocol) in browser.

**Expected with Option A (no CORS):** Request blocked, error in console
**Expected with Option B/C (whitelisted origins):** Request blocked (file:// not in whitelist)

---

### Step 7: Test Production Deploy

If using Option A (removed CORS), your app should still work normally because:
- Frontend and API are same-origin
- Browser doesn't enforce CORS for same-origin requests

**Test on Vercel preview:**
1. Push changes to GitHub
2. Wait for Vercel preview deploy
3. Test login, form submission, data fetching
4. All should work normally

---

### Step 8: Commit Changes

```bash
git add next.config.js
# Or if you modified middleware:
git add middleware.js

git commit -m "security: Fix CORS policy - remove wildcard access

- Removed Access-Control-Allow-Origin: * (allowed any site to call API)
- [Option A] Removed CORS headers entirely (same-origin only)
  OR
- [Option B] Whitelisted specific origins only
  OR
- [Option C] Added dynamic origin checking in middleware

- Prevents CSRF attacks from malicious websites
- Same-origin requests still work normally

Fixes: CORS wildcard vulnerability"
```

---

## 🧪 Testing Checklist

- [ ] Dev server starts without errors
- [ ] Login works
- [ ] Form submissions work
- [ ] API calls from your app work
- [ ] API calls from external domains are blocked (test with test-cors.html)

---

## 🔄 Rollback Instructions

```bash
# Revert changes
git revert HEAD

# Or manually restore:
{ key: 'Access-Control-Allow-Origin', value: '*' }
```

---

## 📊 Success Metrics

**Before:**
```bash
# From evil-website.com:
fetch('https://mentor-report-app.vercel.app/api/submitReport')
# ❌ Works (CSRF attack possible)
```

**After:**
```bash
# From evil-website.com:
fetch('https://mentor-report-app.vercel.app/api/submitReport')
# ✅ Blocked by browser (CORS error)
```

---

## 🐛 Troubleshooting

### Issue: API calls return CORS errors in production

**Cause:** You removed CORS but actually need it.

**Solution:** Use Option B or C to whitelist your production domain.

---

### Issue: Can't login (redirect loop)

**Cause:** Middleware misconfigured.

**Solution:** Verify middleware matcher doesn't block auth routes:
```javascript
matcher: ['/api/:path*', '/', '/protected-page']
// Don't include /api/auth/* explicitly
```

---

## ✅ Completion Criteria

1. ✅ CORS wildcard (`*`) removed
2. ✅ Same-origin requests work
3. ✅ Cross-origin requests blocked (or whitelisted only)
4. ✅ All user flows tested
5. ✅ Changes committed

---

## 📝 Next Steps

After completing this action:
- Proceed to **Action 4: Scan for Leaked Secrets**
- File: `SECURITY_ACTION_04_SECRET_SCAN.md`

---

**Estimated Time Spent:** _________ minutes
**Issues Encountered:** _________________________________
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Blocked
