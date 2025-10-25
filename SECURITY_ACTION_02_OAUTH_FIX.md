# Action 2: Remove OAuth Token from Client Session (CRITICAL)

**Priority:** 🔴 P0 - Do Today
**Time Required:** 30 minutes
**Risk Level:** High
**Difficulty:** Easy

---

## 🎯 Goal

Remove Google OAuth access tokens from client-side session to prevent token theft via:
- Browser DevTools inspection
- XSS attacks
- Browser extensions
- Malicious client-side JavaScript

**Current Issue:**
```javascript
// pages/api/auth/[...nextauth].js:22
session.accessToken = token.accessToken; // ❌ Exposed to client!
```

---

## 🔍 Why This Matters

**Current Risk:**
1. Anyone can open browser DevTools → Application → Cookies
2. Find NextAuth session token
3. Decode the JWT (it's not encrypted, just signed)
4. Extract Google access token
5. Use it to make Google API calls as the user

**Proof (try this yourself):**
```javascript
// In browser console on your app:
console.log(session.accessToken); // Prints the access token 😱
```

---

## 📋 Prerequisites

- [ ] Action 1 (Next.js upgrade) completed
- [ ] You understand: access tokens will still work server-side
- [ ] Backup committed (or use Action 1 backup branch)

---

## 🛠️ Step-by-Step Instructions

### Step 1: Review Current Code

```bash
# View the current implementation
cat pages/api/auth/[...nextauth].js
```

**Current code (lines 12-25):**
```javascript
callbacks: {
  async jwt({ token, account }) {
    // Persist the OAuth access_token to the token right after signin
    if (account) {
      token.accessToken = account.access_token;
    }
    return token;
  },
  async session({ session, token, user }) {
    // Send properties to the client, like an access_token from a provider.
    session.accessToken = token.accessToken; // ❌ THIS IS THE PROBLEM
    return session;
  },
},
```

---

### Step 2: Remove Token from Client Session

Edit the file:

```bash
# Open in editor (replace with your preferred editor)
nano pages/api/auth/[...nextauth].js
# or
code pages/api/auth/[...nextauth].js
```

**Find this section (lines 20-24):**
```javascript
async session({ session, token, user }) {
  // Send properties to the client, like an access_token from a provider.
  session.accessToken = token.accessToken;
  return session;
},
```

**Replace with:**
```javascript
async session({ session, token, user }) {
  // Access token is kept server-side only for security.
  // It's available in the JWT token when using getServerSession()
  // but never sent to the client.
  return session;
},
```

**Full updated file should look like:**
```javascript
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token, user }) {
      // Access token is kept server-side only for security.
      // It's available in the JWT token when using getServerSession()
      // but never sent to the client.
      return session;
    },
  },
});
```

Save the file.

---

### Step 3: Verify No Client-Side Code Uses Access Token

Check if any client-side code tries to use the access token:

```bash
# Search for any client-side usage
grep -r "session\.accessToken" pages/ components/ --exclude-dir=api

# Search for session?.accessToken pattern
grep -r "session\?\.accessToken" pages/ components/ --exclude-dir=api
```

**Expected:** Should find no results (good!) or only in API routes (acceptable).

**If you find client-side usage:** You'll need to refactor those calls to use an API route instead.

---

### Step 4: Test Locally

```bash
# Start dev server
npm run dev
```

**Testing steps:**

1. **Open browser to** http://localhost:3000
2. **Login** with your Google account
3. **Open DevTools** (F12 or right-click → Inspect)
4. **Console tab**, type:
   ```javascript
   import { useSession } from "next-auth/react"
   const { data: session } = useSession()
   console.log(session)
   ```

   **Alternative (easier):** Just open React DevTools and find any component that uses `useSession()`, inspect the `session` object.

5. **Verify:** The session object should contain:
   - ✅ `session.user.name`
   - ✅ `session.user.email`
   - ✅ `session.user.image`
   - ❌ NO `session.accessToken` (should be undefined)

---

### Step 5: Verify Server-Side Still Works

The access token is still available server-side. Test this:

```bash
# Check if API routes can still access it
grep -A5 "getServerSession" pages/api/mentor-stats.js
```

**Expected:** Server-side code using `getServerSession()` can still access `token.accessToken` if needed, but we're not using it directly (we use service account instead - which is better!).

**Your app uses service account for Google Sheets, not user OAuth tokens**, so this change should have ZERO functional impact.

---

### Step 6: Test Key Functionality

Test the main user flows:

- [ ] Login works
- [ ] Logout works
- [ ] Can view mentee list (tests API auth)
- [ ] Can submit a report (tests write permissions)
- [ ] Can view mentor stats (tests data fetching)

**All should work normally because:**
- NextAuth session authentication still works (checked via `getServerSession()`)
- Google Sheets API uses service account, not user tokens

---

### Step 7: Commit Changes

```bash
git add pages/api/auth/[...nextauth].js
git commit -m "security: Remove OAuth access token from client session

- Access token no longer exposed to browser/DevTools
- Prevents token theft via XSS or malicious extensions
- Server-side auth still works via getServerSession()
- No functional impact (app uses service account for Sheets API)

Fixes: OAuth token exposure vulnerability"
```

---

## 🧪 Testing Checklist

- [ ] Login/logout works
- [ ] `session.accessToken` is undefined in browser DevTools
- [ ] API routes still authenticate correctly
- [ ] Form submissions work
- [ ] No console errors

---

## 🔄 Rollback Instructions

If something breaks (unlikely):

```bash
# Revert the commit
git revert HEAD

# Or manually restore the old callback:
async session({ session, token, user }) {
  session.accessToken = token.accessToken;
  return session;
}
```

---

## 📊 Success Metrics

**Before:**
```javascript
// In browser console:
console.log(session.accessToken)
// Output: "ya29.a0AfB_..." (actual Google token exposed!)
```

**After:**
```javascript
// In browser console:
console.log(session.accessToken)
// Output: undefined ✅
```

---

## 🐛 Troubleshooting

### Issue: "session is undefined" in browser

**Cause:** You're checking too early, before auth loads.

**Solution:** Make sure you're checking in an authenticated page:
```javascript
// In a component wrapped with auth:
const { data: session, status } = useSession()
if (status === "loading") return "Loading..."
console.log(session) // Now check
```

---

### Issue: API route returns 401 Unauthorized

**Cause:** Server-side auth might be broken.

**Solution:** Verify `getServerSession` is imported correctly:
```javascript
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

// In API route:
const session = await getServerSession(req, res, authOptions);
```

---

### Issue: Users complain they can't access something

**This shouldn't happen**, but if it does:

1. Check if any client-side code was trying to use `session.accessToken` directly
2. Refactor to use API route instead
3. Or temporarily rollback this change while you refactor

---

## ✅ Completion Criteria

Mark this action as complete when:

1. ✅ `session.accessToken` removed from callback
2. ✅ Browser DevTools shows no access token in session
3. ✅ Login/logout works
4. ✅ All main user flows tested and working
5. ✅ Changes committed

---

## 💡 Understanding What We Did

**Before:**
- NextAuth JWT token contained: `{user: {...}, accessToken: "ya29..."}`
- This JWT was sent to client in a cookie
- Client could decode JWT and see the access token
- ⚠️ Risk: XSS attack could steal the token

**After:**
- NextAuth JWT token still contains: `{user: {...}, accessToken: "ya29..."}` on SERVER
- But when sending session to CLIENT, we don't include accessToken
- Client sees: `{user: {...}}` only
- ✅ Access token stays server-side only

**Key insight:** The token is still in the JWT on the server (for server-side use if needed), but we don't send it to the browser.

---

## 📝 Next Steps

After completing this action:
- Proceed to **Action 3: Fix CORS Policy**
- File: `SECURITY_ACTION_03_CORS_FIX.md`

---

**Estimated Time Spent:** _________ minutes
**Issues Encountered:** _________________________________
**Status:** ⬜ Not Started | ⬜ In Progress | ⬜ Complete | ⬜ Blocked
