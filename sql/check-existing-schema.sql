-- ============================================================================
-- Check Existing Schema - Diagnostics
-- ============================================================================
-- Run these queries to see what's currently in your database
-- ============================================================================

-- 1. Check if todays_summary view exists and its structure
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'todays_summary'
ORDER BY ordinal_position;

-- Expected: List of columns in the existing view


-- ============================================================================
-- 2. Check if dual_write_logs table exists and its structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dual_write_logs'
ORDER BY ordinal_position;

-- Expected: List of columns including:
-- - operation_type, table_name, record_id
-- - sheets_success, sheets_duration_ms, sheets_error
-- - supabase_success, supabase_duration_ms, supabase_error
-- - user_email, batch_name, program, metadata, timestamp


-- ============================================================================
-- 3. List all views in the public schema
SELECT
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;


-- ============================================================================
-- 4. Check if system_health_metrics table exists
SELECT EXISTS (
  SELECT FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename = 'system_health_metrics'
) AS table_exists;


-- ============================================================================
-- 5. Count today's operations (if dual_write_logs exists)
SELECT COUNT(*) AS operations_today
FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE;


-- ============================================================================
-- 6. Sample data from dual_write_logs (your recent operation)
SELECT
  operation_type,
  table_name,
  record_id,
  sheets_success,
  supabase_success,
  user_email,
  program,
  timestamp
FROM public.dual_write_logs
ORDER BY timestamp DESC
LIMIT 5;

-- Expected: Should show your MAJU report operation
