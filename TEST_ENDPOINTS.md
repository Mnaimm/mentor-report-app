# QUICK API ENDPOINT TESTING GUIDE

## ✅ FIXED!

I've created the missing `lib/auth-middleware.js` file that was causing your 404 errors.

---

## NEXT STEPS

### 1. Restart Your Dev Server

If your dev server is running, stop it (Ctrl+C) and restart:

```bash
npm run dev
```

You should now see successful compilation instead of errors.

### 2. Test Endpoints (In Order)

#### Test 1: Health Check (No Auth Required)

**Browser:** Open http://localhost:3000/api/monitoring/health

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/health"
```

**Expected:** JSON response with `"status": "healthy"`

---

#### Test 2: Test Environment Variables

**Browser:** Open http://localhost:3000/api/test-env

**Expected:** Should show which env vars are SET or MISSING

---

#### Test 3: Get Session Token (For Protected Routes)

1. **Open browser:** http://localhost:3000
2. **Sign in** with Google
3. **Open DevTools** (Press F12)
4. **Go to:** Application tab → Cookies → http://localhost:3000
5. **Copy value** of `next-auth.session-token`

Save this token - you'll need it for the next tests!

---

#### Test 4: Dashboard Summary (Requires Auth)

**PowerShell** (replace YOUR_TOKEN with actual token):
```powershell
$token = "YOUR_SESSION_TOKEN_HERE"
$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/coordinator/dashboard-summary" -Headers $headers
```

**Expected Results:**

✅ **If you have coordinator role:**
```json
{
  "summary": {
    "total_mentees": 0,
    "active_mentors": 0,
    ...
  },
  "unassigned": [],
  "timestamp": "..."
}
```

❌ **If you don't have coordinator role:**
```json
{
  "error": "Access denied - Required role: program_coordinator"
}
```

**Fix:** Add role to your user in Supabase:
```sql
-- Run in Supabase SQL Editor
UPDATE users
SET roles = ARRAY['program_coordinator']
WHERE email = 'your-email@example.com';
```

---

#### Test 5: Monitoring Stats (No Auth)

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/stats?period=today"
```

**Expected:** Statistics about dual-write operations

---

#### Test 6: List Mentors (Requires Auth + Coordinator Role)

**PowerShell:**
```powershell
$token = "YOUR_SESSION_TOKEN_HERE"
$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/coordinator/mentors" -Headers $headers
```

**Expected:** Array of mentors (may be empty if database is empty)

---

#### Test 7: List Mentees (Requires Auth + Coordinator Role)

**PowerShell:**
```powershell
$token = "YOUR_SESSION_TOKEN_HERE"
$headers = @{
    "Cookie" = "next-auth.session-token=$token"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/coordinator/mentees" -Headers $headers
```

**Expected:** Array of mentees (may be empty if database is empty)

---

## TROUBLESHOOTING

### Issue: Still getting 404 errors

**Solution:**
1. Make sure dev server restarted after creating auth-middleware.js
2. Check terminal for compilation errors
3. Delete .next folder and restart:
   ```powershell
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

---

### Issue: "User not found in database"

**Cause:** Your user exists in NextAuth but not in Supabase users table

**Solution:** Create your user:
```sql
-- Run in Supabase SQL Editor
INSERT INTO users (name, email, roles)
VALUES (
  'Your Name',
  'your-email@example.com',
  ARRAY['program_coordinator', 'mentor']
);
```

---

### Issue: "Table 'users' does not exist"

**Cause:** Database migrations haven't been run

**Solution:** Run the migration scripts from `COMPREHENSIVE_SCHEMA_ANALYSIS.md` PART 7

---

### Issue: "view_program_summary does not exist"

**Cause:** Database views haven't been created

**Solution:** Run Phase 3 migration from schema analysis document

---

## COMPLETE ENDPOINT LIST

### ✅ Public Endpoints (No Auth):
- `GET /api/monitoring/health` - System health check
- `GET /api/monitoring/stats?period=today` - Monitoring statistics
- `GET /api/test-env` - Environment variable check

### 🔒 Protected Endpoints (Requires Auth):
- `GET /api/mentor-stats` - Mentor's own statistics
- `GET /api/menteeData?name=X&programType=bangkit` - Mentee data from Sheets

### 🔐 Coordinator Endpoints (Requires program_coordinator role):
- `GET /api/coordinator/dashboard-summary` - 8 KPI cards
- `GET /api/coordinator/mentees` - List all mentees
- `GET /api/coordinator/mentors` - List all mentors
- `POST /api/coordinator/assign-mentor` - Assign mentor to mentee

### 🔐 Dashboard Endpoints (Requires specific roles):
- `GET /api/dashboard/stats` - Role-specific statistics
- `GET /api/dashboard/program-breakdown` - Program breakdown
- `GET /api/dashboard/recent-activity` - Recent activity
- `GET /api/dashboard/reports-by-status` - Reports by status
- `GET /api/dashboard/system-health` - System health

### 🔐 Admin Endpoints (Requires admin):
- `GET /api/admin/sales-status` - Sales status by batch

---

## SUCCESS CRITERIA

✅ Your endpoints are working when:

1. **Health check returns 200** - Server is running
2. **No compilation errors** in terminal
3. **Auth endpoints return 401** when not signed in (correct behavior)
4. **After signing in**, protected endpoints return data or role errors
5. **No 404 errors** - All routes are recognized

---

## POSTMAN COLLECTION (Alternative to PowerShell)

If you prefer using Postman:

1. **Create new request**
2. **Set URL:** http://localhost:3000/api/monitoring/health
3. **Method:** GET
4. **Send**

For authenticated requests:
1. **Go to:** Headers tab
2. **Add header:**
   - Key: `Cookie`
   - Value: `next-auth.session-token=YOUR_TOKEN`
3. **Send**

---

## VISUAL STUDIO CODE REST CLIENT

Create a file `test-api.http`:

```http
### Health Check
GET http://localhost:3000/api/monitoring/health

### Dashboard Summary (replace token)
GET http://localhost:3000/api/coordinator/dashboard-summary
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN

### Monitoring Stats
GET http://localhost:3000/api/monitoring/stats?period=today

### List Mentors (replace token)
GET http://localhost:3000/api/coordinator/mentors
Cookie: next-auth.session-token=YOUR_SESSION_TOKEN
```

Install "REST Client" extension in VS Code, then click "Send Request" above each request.

---

## READY TO TEST!

1. ✅ Missing file created
2. ✅ All endpoints should now work
3. ✅ Just need to restart dev server
4. ✅ Then test in order above

**Questions?** Check the full `API_TROUBLESHOOTING_GUIDE.md` for detailed diagnostics.
