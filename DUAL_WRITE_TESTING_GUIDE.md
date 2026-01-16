# Dual-Write Testing Guide
**Date:** 2026-01-15
**Status:** Ready for Local Testing

---

## ✅ Pre-Test Setup Complete

- [x] `dual_write_monitoring` table created in Supabase
- [x] Fixed `submitReport.js` to use `reports` table
- [x] Fixed `submitMajuReport.js` to use `reports` table
- [x] Verified `submit-upward-mobility.js` uses correct `upward_mobility_reports` table
- [x] Updated payload mappings to match actual schema

---

## 🎯 Quick Test Flow

### **Test 1: Bangkit Report (5 minutes)**

```bash
# 1. Start dev server
npm run dev

# 2. Open browser: http://localhost:3000

# 3. Login as mentor

# 4. Navigate to Bangkit report form

# 5. Fill minimum required fields:
   Nama Usahawan: TEST DUAL WRITE
   Nama Syarikat: TEST COMPANY
   Sesi: 1
   Tarikh: [today]
   Mod Sesi: Face to Face

   Inisiatif #1:
   - Fokus Area: Marketing
   - Keputusan: Test result
   - Pelan Tindakan: Test action

   Rumusan: Test dual write functionality

# 6. Submit form

# 7. Check browser console:
   ✅ Look for: "📊 Starting Supabase dual-write..."
   ✅ Look for: "✅ Supabase dual-write successful. Record ID: ..."

   OR

   ❌ If error: "⚠️ Supabase dual-write failed (non-blocking): ..."
   (Note: Form should still succeed even if Supabase fails!)
```

---

### **Test 2: Verify Data in Supabase**

```sql
-- Query 1: Check if report was inserted
SELECT
  id,
  program,
  nama_usahawan,
  nama_syarikat,
  session_number,
  sheets_row_number,
  source,
  created_at
FROM reports
WHERE nama_usahawan = 'TEST DUAL WRITE'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: 1 row with your test data

-- Query 2: Check monitoring log
SELECT
  status,
  table_name,
  google_sheets_row,
  error_message,
  metadata,
  timestamp
FROM dual_write_monitoring
ORDER BY timestamp DESC
LIMIT 1;

-- Expected: status = 'success', table_name = 'reports'
```

---

### **Test 3: Verify Data in Google Sheets**

1. Open Google Sheets (Bangkit spreadsheet from env var)
2. Go to "V8" tab
3. Find row with "TEST DUAL WRITE"
4. Note the row number
5. Compare with `sheets_row_number` in Supabase

**Expected:** Row numbers should match!

---

### **Test 4: Error Handling Test**

```bash
# 1. Temporarily break Supabase connection
# Edit .env.local:
SUPABASE_SERVICE_ROLE_KEY=invalid-key-test

# 2. Restart dev server
npm run dev

# 3. Submit another test report with:
   Nama Usahawan: TEST ERROR HANDLING

# 4. Check browser console:
   ✅ "⚠️ Supabase dual-write failed (non-blocking): ..."
   ✅ Form should STILL succeed!

# 5. Verify Google Sheets:
   ✅ Row should exist in Sheets

# 6. Verify Supabase:
   ❌ No row with "TEST ERROR HANDLING"

# 7. Check dual_write_monitoring:
   ✅ Should have status = 'failed'
   ✅ Should have error_message

# 8. Restore correct key
SUPABASE_SERVICE_ROLE_KEY=your-real-key

# 9. Restart dev server
```

---

## 📋 Success Checklist

### Happy Path (Both Systems Working):
- [ ] Form submits successfully
- [ ] Console shows "✅ Supabase dual-write successful"
- [ ] Data appears in Google Sheets
- [ ] Data appears in Supabase `reports` table
- [ ] `dual_write_monitoring` shows status='success'
- [ ] `sheets_row_number` matches actual Sheets row
- [ ] All JSONB fields properly stored (inisiatif, refleksi, image_urls)

### Error Handling (Supabase Down):
- [ ] Form still submits successfully
- [ ] Console shows "⚠️ Supabase dual-write failed (non-blocking)"
- [ ] Data appears in Google Sheets
- [ ] Data does NOT appear in Supabase
- [ ] `dual_write_monitoring` shows status='failed' with error message
- [ ] User never sees an error (non-blocking!)

---

## 🔍 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| `column "X" does not exist` | Wrong column name | Double-check payload against `reports` schema |
| `null value in column "X" violates not-null constraint` | Missing required field | Add field to payload or make column nullable |
| `insert violates foreign key constraint` | Missing referenced record | Create mentor/entrepreneur records first |
| Form fails completely | Sheets write error | Check Google credentials |
| No dual-write attempt | Code not reached | Check if in production mode vs dev |

---

## 🧹 Cleanup After Testing

```sql
-- Delete test data from Supabase
DELETE FROM reports WHERE nama_usahawan LIKE 'TEST%';

-- Delete test monitoring logs
DELETE FROM dual_write_monitoring WHERE metadata->>'mentee_name' LIKE 'TEST%';

-- Verify cleanup
SELECT COUNT(*) FROM reports WHERE nama_usahawan LIKE 'TEST%';
-- Expected: 0
```

**Google Sheets:**
- Manually delete test rows from V8 tab

---

## 📊 What Gets Written Where

### Google Sheets (PRIMARY - Always):
- ✅ All 100+ columns mapped from form
- ✅ Row number captured
- ✅ Apps Script generates DOC_URL later

### Supabase `reports` Table (SECONDARY - Dual Write):
- ✅ program = 'Bangkit' or 'Maju'
- ✅ nama_usahawan, nama_syarikat, session_number
- ✅ inisiatif (JSONB array)
- ✅ refleksi (JSONB object)
- ✅ image_urls (JSONB object)
- ✅ sheets_row_number (links to Sheets)
- ✅ source = 'web_form'
- ✅ status = 'submitted'
- ✅ payment_status = 'pending'

### Supabase `dual_write_monitoring` Table:
- ✅ source_system = 'google_sheets'
- ✅ target_system = 'supabase'
- ✅ operation_type = 'insert'
- ✅ table_name = 'reports'
- ✅ status = 'success' or 'failed'
- ✅ error_message (if failed)
- ✅ metadata (mentor, mentee, session info)

---

## 🎯 Expected Console Output

### Success:
```
✅ Data saved to row 123. Document will be generated automatically.
📊 Starting Supabase dual-write for Bangkit session report...
✅ Supabase dual-write successful. Record ID: 550e8400-e29b-41d4-a716-446655440000
🗑️ Cache invalidated for mentor: mentor@example.com
```

### Failure (Non-Blocking):
```
✅ Data saved to row 124. Document will be generated automatically.
📊 Starting Supabase dual-write for Bangkit session report...
⚠️ Supabase dual-write failed (non-blocking): Invalid API key
⚠️ Failed to log to dual_write_monitoring: Invalid API key
🗑️ Cache invalidated for mentor: mentor@example.com
```

**Note:** User still sees success message either way!

---

## ✅ Ready to Test!

Your dual-write implementation is now:
- ✅ Using correct table names (`reports`, `upward_mobility_reports`)
- ✅ Using correct column names (matches actual schema)
- ✅ Non-blocking (won't break user experience)
- ✅ Fully monitored (dual_write_monitoring table)

**Start with Test 1, then verify with Test 2 & 3!**
