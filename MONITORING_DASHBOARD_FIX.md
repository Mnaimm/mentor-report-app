# Monitoring Dashboard Fix Guide

**Issue:** Monitoring dashboard shows 0 operations even though dual-write is working
**Cause:** Missing `todays_summary` view and `system_health_metrics` table in Supabase
**Status:** ✅ Dual-write is working! Just need to fix monitoring infrastructure

---

## 📊 What's Actually Happening

### ✅ GOOD NEWS: Dual-Write is Working!

From your console logs:
```
✅ Supabase dual-write successful. Record ID: 17a00615-ea8e-4258-8d81-f0d3f4c4aa7c
```

Your MAJU report for **Muhammad Firdaus Bin Mohd Fadzi** was successfully written to:
- ✅ Google Sheets (Row 24)
- ✅ Supabase reports table (Record ID: `17a00615-ea8e-4258-8d81-f0d3f4c4aa7c`)

### ❌ ISSUE: Monitoring Dashboard Can't Display Data

Error in console:
```
Could not find the table 'public.system_health_metrics' in the schema cache
```

The monitoring dashboard is looking for views/tables that don't exist yet.

---

## 🔧 Fix Instructions

### Step 1: Run SQL Setup in Supabase

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/oogrwqxlwyoswyfqgxxi/sql
   - Or navigate to: Your Project → SQL Editor

2. **Run the setup script:**
   - Open file: `sql/setup-monitoring-infrastructure.sql`
   - Copy ALL the SQL code
   - Paste into Supabase SQL Editor
   - Click "Run" button

3. **Verify the view was created:**
   ```sql
   SELECT * FROM public.todays_summary;
   ```

   Expected result: One row with statistics (might be all 0s if no operations logged yet)

---

### Step 2: Check Your Dual-Write Data

Run the queries in `sql/check-dual-write-data.sql` to verify your report:

**Query 1: Check the reports table**
```sql
SELECT
  id,
  program,
  nama_usahawan,
  nama_syarikat,
  session_number,
  sheets_row_number,
  created_at
FROM public.reports
WHERE id = '17a00615-ea8e-4258-8d81-f0d3f4c4aa7c';
```

Expected result:
```
id: 17a00615-ea8e-4258-8d81-f0d3f4c4aa7c
program: Maju
nama_usahawan: Muhammad Firdaus Bin Mohd Fadzi
nama_syarikat: Nadear Creation Empire
session_number: 2
sheets_row_number: 24
```

**Query 2: Check the dual_write_logs table**
```sql
SELECT
  operation_type,
  table_name,
  sheets_success,
  supabase_success,
  user_email,
  timestamp
FROM public.dual_write_logs
WHERE record_id = '17a00615-ea8e-4258-8d81-f0d3f4c4aa7c';
```

Expected result: One row showing both `sheets_success` and `supabase_success` as `true`

---

### Step 3: Restart Dev Server

After creating the database views:

```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

---

### Step 4: Refresh Monitoring Dashboard

1. Open: http://localhost:3000/monitoring
2. Click "🔄 Refresh Now" button
3. The dashboard should now show:
   - ✅ Total Operations: 1 (or more)
   - ✅ Success Rates: 100%
   - ✅ Recent Operations table with your MAJU report

---

## 🔍 Understanding the Error

The monitoring dashboard has three components:

1. **System Health Checks** (Connection tests)
   - ✅ This was working (showing Supabase and Sheets connected)

2. **Operation Statistics** (From `todays_summary` view)
   - ❌ This was failing (view didn't exist)
   - Shows: Total operations, success rates, etc.

3. **Recent Operations** (From `dual_write_logs` table)
   - ❌ This was failing (couldn't query stats from missing view)
   - Shows: Individual operation details

---

## 📋 What the SQL Script Creates

### 1. `todays_summary` VIEW
A real-time view that calculates:
- Total operations today
- Success rates for Sheets and Supabase
- Average response times
- Combined success metrics

### 2. `system_health_metrics` TABLE
Stores historical health check results:
- System status over time
- Connection health for both systems
- Performance metrics

### 3. Helper Functions
- `get_dual_write_stats(start_date, end_date)` - Get stats for date range

---

## 🎯 After the Fix

Once you run the SQL setup, your monitoring dashboard will show:

```
Total Operations: 1
Sheets Success Rate: 100% (1/1)
Supabase Success Rate: 100% (1/1)
Both Systems Success: 100% (1 operations)

Recent Operations:
- INSERT | reports | naemmukhtar@gmail.com | ✓✓ Both Success
  Muhammad Firdaus Bin Mohd Fadzi | Session 2
```

---

## ✅ Quick Verification Checklist

After running the SQL setup:

- [ ] `todays_summary` view exists and returns data
- [ ] `system_health_metrics` table exists
- [ ] Dev server restarted
- [ ] Monitoring dashboard loads without console errors
- [ ] Dashboard shows your MAJU report operation
- [ ] Success rates show 100%
- [ ] Recent Operations table displays data

---

## 🔄 Next Steps

1. **Run the SQL setup now** (Step 1 above)
2. **Verify your data** using the check queries
3. **Restart dev server**
4. **Test monitoring dashboard**
5. **Submit another test report** to see real-time updates

---

## 📝 Note About Your Report

Your actual MAJU report data is **SAFE** in both systems:

- **Google Sheets:** Row 24 in LaporanMaju tab
- **Supabase:** Record `17a00615-ea8e-4258-8d81-f0d3f4c4aa7c` in reports table

This is NOT test data - it's a real production report that was successfully dual-written!

If you want to verify this is working correctly, you can:
1. Check Google Sheets manually (look for row 24)
2. Run the SQL queries to see the Supabase data
3. Compare both to ensure they match

---

## 🆘 If Still Having Issues

If the dashboard still doesn't work after the fix:

1. **Check Supabase logs:**
   - Project → Logs → Select "Postgres Logs"
   - Look for any permission errors

2. **Check browser console:**
   - Open DevTools → Console
   - Look for new error messages

3. **Verify RLS policies:**
   - Make sure `dual_write_logs` table has appropriate policies
   - Or temporarily disable RLS for testing

4. **Check API responses:**
   - Open: http://localhost:3000/api/monitoring/health
   - Open: http://localhost:3000/api/monitoring/stats?period=today
   - Both should return JSON without errors

---

## 🎉 Success Indicators

You'll know everything is working when:

✅ No console errors about missing tables
✅ Monitoring dashboard shows your operation
✅ Stats are calculated correctly
✅ Auto-refresh updates the data every 30 seconds
✅ System health status shows "HEALTHY" (instead of "DEGRADED")
