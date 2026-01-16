-- ============================================================================
-- Check Dual-Write Data for Muhammad Firdaus Bin Mohd Fadzi
-- ============================================================================

-- 1. Check if the report was written to the reports table
SELECT
  id,
  program,
  nama_usahawan AS mentee_name,
  nama_syarikat AS company_name,
  session_number,
  sheets_row_number,
  tarikh_report AS report_date,
  status,
  source,
  created_at,
  updated_at
FROM public.reports
WHERE id = '17a00615-ea8e-4258-8d81-f0d3f4c4aa7c'
   OR nama_usahawan = 'Muhammad Firdaus Bin Mohd Fadzi'
ORDER BY created_at DESC;

-- Expected: 1 row with your MAJU report


-- ============================================================================
-- 2. Check the dual_write_logs table for this operation
SELECT
  id,
  operation_type,
  table_name,
  record_id,
  sheets_success,
  sheets_duration_ms,
  sheets_error,
  supabase_success,
  supabase_duration_ms,
  supabase_error,
  user_email,
  program,
  timestamp,
  metadata
FROM public.dual_write_logs
WHERE record_id = '17a00615-ea8e-4258-8d81-f0d3f4c4aa7c'
   OR metadata->>'mentee_name' LIKE '%Firdaus%'
ORDER BY timestamp DESC;

-- Expected: 1 row showing the dual-write operation


-- ============================================================================
-- 3. Check all dual-write logs for today
SELECT
  operation_type,
  table_name,
  sheets_success,
  supabase_success,
  user_email,
  program,
  timestamp
FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE
ORDER BY timestamp DESC;

-- Expected: All operations from today


-- ============================================================================
-- 4. Get summary statistics for today
SELECT
  COUNT(*) AS total_operations,
  COUNT(*) FILTER (WHERE sheets_success) AS sheets_success,
  COUNT(*) FILTER (WHERE supabase_success) AS supabase_success,
  COUNT(*) FILTER (WHERE sheets_success AND supabase_success) AS both_success,
  AVG(sheets_duration_ms) AS avg_sheets_ms,
  AVG(supabase_duration_ms) AS avg_supabase_ms
FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE;


-- ============================================================================
-- 5. Check for any errors in dual-write operations
SELECT
  id,
  operation_type,
  table_name,
  record_id,
  CASE
    WHEN NOT sheets_success THEN sheets_error
    WHEN NOT supabase_success THEN supabase_error
    ELSE 'No error'
  END AS error_message,
  timestamp
FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE
  AND (sheets_success = false OR supabase_success = false)
ORDER BY timestamp DESC;

-- Expected: No rows if everything is working correctly


-- ============================================================================
-- 6. Verify the MAJU report details with JSONB fields
SELECT
  id,
  program,
  nama_usahawan,
  nama_syarikat,
  session_number,
  inisiatif,          -- JSONB array
  refleksi,           -- JSONB object
  cadangan_mentor,    -- Text
  status_mia,         -- Text
  tarikh_report,
  created_at
FROM public.reports
WHERE nama_usahawan = 'Muhammad Firdaus Bin Mohd Fadzi'
ORDER BY created_at DESC
LIMIT 1;


-- ============================================================================
-- 7. Check Google Sheets row number mapping
SELECT
  nama_usahawan,
  session_number,
  sheets_row_number,
  created_at
FROM public.reports
WHERE nama_usahawan = 'Muhammad Firdaus Bin Mohd Fadzi';

-- The sheets_row_number should be 24 (from your logs)
