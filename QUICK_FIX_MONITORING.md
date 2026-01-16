# Quick Fix: Monitoring Dashboard

**Error:** `cannot drop columns from view`
**Cause:** The `todays_summary` view already exists with different structure
**Solution:** Drop and recreate the view

---

## 🚀 Quick Fix (2 Steps)

### Step 1: Run the Fix Script in Supabase

1. **Open Supabase SQL Editor:**
   - URL: https://supabase.com/dashboard/project/oogrwqxlwyoswyfqgxxi/sql

2. **Copy & paste this entire script:**
   - File: `sql/fix-monitoring-views.sql`
   - Click **RUN**

This script will:
- Drop the old `todays_summary` view
- Create the new view with correct columns
- Create `system_health_metrics` table
- Grant proper permissions
- Test the view

### Step 2: Restart Your Dev Server

```bash
# Press Ctrl+C to stop
npm run dev
```

Then refresh: http://localhost:3000/monitoring

---

## 🔍 If You Want to Diagnose First

Before running the fix, you can check what's currently in your database:

**Run this script:** `sql/check-existing-schema.sql`

This will show you:
- Current structure of `todays_summary` view
- Structure of `dual_write_logs` table
- All views in your database
- Sample data from your recent operation

---

## ✅ Expected Results After Fix

Once you run the fix script, you should see:

**In SQL Editor output:**
```
total_operations: 1
sheets_success_rate: 100.00
supabase_success_rate: 100.00
both_success_rate: 100.00
avg_sheets_duration_ms: ~1200
avg_supabase_duration_ms: ~450
```

**In Monitoring Dashboard:**
```
System Health: HEALTHY ✓
Total Operations: 1
Sheets Success Rate: 100%
Supabase Success Rate: 100%
Both Systems Success: 100%

Recent Operations:
INSERT | reports | naemmukhtar@gmail.com
Muhammad Firdaus Bin Mohd Fadzi | Session 2
✓✓ Both Success
```

---

## 🆘 If Still Having Issues

### Issue 1: Permission Error
```
ERROR: permission denied for table dual_write_logs
```

**Fix:** Add RLS policy or disable RLS temporarily:
```sql
ALTER TABLE public.dual_write_logs DISABLE ROW LEVEL SECURITY;
```

### Issue 2: View Still Not Working
```
ERROR: relation "dual_write_logs" does not exist
```

**This means the dual_write_logs table doesn't exist!**

Check if it's actually `dual_write_monitoring` instead:
```sql
-- Check which table exists
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%dual%';
```

If it shows `dual_write_monitoring` instead of `dual_write_logs`, you need to update the view to use the correct table name.

### Issue 3: No Data Showing

**Check if data exists:**
```sql
SELECT COUNT(*) FROM dual_write_logs;
```

If it returns 0, the dual-write logger might not be writing to this table.

**Check the actual table name being used:**
```sql
-- From your submitMajuReport.js logs, check what table it writes to
SELECT * FROM dual_write_monitoring ORDER BY timestamp DESC LIMIT 1;
```

---

## 🔧 Alternative: Simple Manual Fix

If the script doesn't work, run these commands **one by one**:

```sql
-- 1. Drop the old view
DROP VIEW IF EXISTS public.todays_summary CASCADE;

-- 2. Create new view
CREATE VIEW public.todays_summary AS
SELECT
  COUNT(*) AS total_operations,
  COUNT(*) FILTER (WHERE sheets_success = true) AS sheets_success_count,
  ROUND((COUNT(*) FILTER (WHERE sheets_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS sheets_success_rate,
  COUNT(*) FILTER (WHERE supabase_success = true) AS supabase_success_count,
  ROUND((COUNT(*) FILTER (WHERE supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS supabase_success_rate,
  COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = true) AS both_success_count,
  ROUND((COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) AS both_success_rate,
  ROUND(AVG(sheets_duration_ms) FILTER (WHERE sheets_duration_ms IS NOT NULL), 0) AS avg_sheets_duration_ms,
  ROUND(AVG(supabase_duration_ms) FILTER (WHERE supabase_duration_ms IS NOT NULL), 0) AS avg_supabase_duration_ms,
  COUNT(*) FILTER (WHERE sheets_success = false AND supabase_success = false) AS both_failed_count,
  COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = false) AS sheets_only_success_count,
  COUNT(*) FILTER (WHERE sheets_success = false AND supabase_success = true) AS supabase_only_success_count
FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE;

-- 3. Test it
SELECT * FROM public.todays_summary;

-- 4. Grant permissions
GRANT SELECT ON public.todays_summary TO authenticated;
GRANT SELECT ON public.todays_summary TO anon;
```

---

## 📊 What If Table Name is Different?

Your logs show the dual-write is working, but the monitoring might be looking at the wrong table.

**Check your lib/monitoring/dual-write-logger.js:**

It should be writing to either:
- `dual_write_logs` (what the view expects), OR
- `dual_write_monitoring` (what might actually exist)

**To check:**
```sql
-- See which tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND (tablename LIKE '%dual%' OR tablename LIKE '%monitor%');
```

If the table is named `dual_write_monitoring`, update the view:
```sql
DROP VIEW IF EXISTS public.todays_summary;

CREATE VIEW public.todays_summary AS
SELECT
  COUNT(*) AS total_operations,
  -- ... (same columns as above)
FROM public.dual_write_monitoring  -- Changed from dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE;
```

---

## 🎯 TL;DR

**Just run:** `sql/fix-monitoring-views.sql` in Supabase SQL Editor

**Then:** Restart dev server and refresh dashboard

**Done!** ✅
