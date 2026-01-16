-- ============================================================================
-- Fix: Point View to Correct Table (dual_write_monitoring)
-- ============================================================================
-- The issue: Code writes to 'dual_write_monitoring'
--            View reads from 'dual_write_logs'
-- Solution: Update view to use the correct table name
-- ============================================================================

-- Step 1: Drop the old view
DROP VIEW IF EXISTS public.todays_summary CASCADE;

-- Step 2: Recreate view pointing to the CORRECT table: dual_write_monitoring
CREATE VIEW public.todays_summary AS
SELECT
  COUNT(*) AS total_operations,

  -- Calculate sheets metrics (note: dual_write_monitoring doesn't have sheets_success column)
  -- We'll use status='success' as proxy for now
  COUNT(*) FILTER (WHERE status = 'success') AS sheets_success_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS sheets_success_rate,
  NULL::numeric AS avg_sheets_duration_ms,  -- Not tracked in dual_write_monitoring

  -- Supabase metrics (all operations are TO supabase)
  COUNT(*) FILTER (WHERE status = 'success') AS supabase_success_count,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS supabase_success_rate,
  NULL::numeric AS avg_supabase_duration_ms,  -- Not tracked in dual_write_monitoring

  -- Combined metrics
  COUNT(*) FILTER (WHERE status = 'success') AS both_success_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS both_failed_count,
  0::bigint AS sheets_only_success_count,  -- Not applicable
  0::bigint AS supabase_only_success_count,  -- Not applicable

  ROUND(
    (COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS both_success_rate

FROM public.dual_write_monitoring
WHERE DATE(timestamp) = CURRENT_DATE;

-- Step 3: Grant permissions
GRANT SELECT ON public.todays_summary TO authenticated;
GRANT SELECT ON public.todays_summary TO anon;

-- Step 4: Test the view
SELECT
  total_operations,
  sheets_success_rate,
  supabase_success_rate,
  both_success_rate
FROM public.todays_summary;

-- Expected result: Should show 1 operation with 100% success rates

-- ============================================================================
-- Step 5: Verify the data is actually there
SELECT
  operation_type,
  table_name,
  record_id,
  google_sheets_row,
  status,
  timestamp,
  metadata
FROM public.dual_write_monitoring
WHERE DATE(timestamp) = CURRENT_DATE
ORDER BY timestamp DESC;

-- Expected: Your MAJU report operation should appear here
-- ============================================================================
