-- ============================================================================
-- Dual-Write Monitoring Infrastructure Setup
-- ============================================================================
-- This script creates all necessary tables and views for the monitoring dashboard
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Create todays_summary view
-- This view provides real-time statistics for today's operations
-- ============================================================================
CREATE OR REPLACE VIEW public.todays_summary AS
SELECT
  COUNT(*) AS total_operations,

  -- Sheets metrics
  COUNT(*) FILTER (WHERE sheets_success = true) AS sheets_success_count,
  ROUND(
    (COUNT(*) FILTER (WHERE sheets_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS sheets_success_rate,
  ROUND(AVG(sheets_duration_ms) FILTER (WHERE sheets_duration_ms IS NOT NULL), 0) AS avg_sheets_duration_ms,

  -- Supabase metrics
  COUNT(*) FILTER (WHERE supabase_success = true) AS supabase_success_count,
  ROUND(
    (COUNT(*) FILTER (WHERE supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS supabase_success_rate,
  ROUND(AVG(supabase_duration_ms) FILTER (WHERE supabase_duration_ms IS NOT NULL), 0) AS avg_supabase_duration_ms,

  -- Combined metrics
  COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = true) AS both_success_count,
  COUNT(*) FILTER (WHERE sheets_success = false AND supabase_success = false) AS both_failed_count,
  COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = false) AS sheets_only_success_count,
  COUNT(*) FILTER (WHERE sheets_success = false AND supabase_success = true) AS supabase_only_success_count,

  ROUND(
    (COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS both_success_rate

FROM public.dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE;

COMMENT ON VIEW public.todays_summary IS 'Real-time statistics for dual-write operations today';


-- ============================================================================
-- 2. Create system_health_metrics table (optional but recommended)
-- This table can store historical health check results
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Timestamp
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Overall status
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'error'

  -- Supabase health
  supabase_healthy BOOLEAN,
  supabase_duration_ms INTEGER,
  supabase_error TEXT,

  -- Google Sheets health
  sheets_healthy BOOLEAN,
  sheets_duration_ms INTEGER,
  sheets_error TEXT,

  -- Metrics health
  metrics_healthy BOOLEAN,
  metrics_message TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_health_checked_at
ON public.system_health_metrics(checked_at DESC);

COMMENT ON TABLE public.system_health_metrics IS 'Historical system health check results';


-- ============================================================================
-- 3. Verify existing tables
-- ============================================================================

-- Check if dual_write_logs table exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'dual_write_logs'
  ) THEN
    RAISE NOTICE 'WARNING: dual_write_logs table does not exist! Create it first.';
  ELSE
    RAISE NOTICE 'OK: dual_write_logs table exists';
  END IF;
END
$$;


-- ============================================================================
-- 4. Grant permissions (if using RLS)
-- ============================================================================

-- Allow authenticated users to read from views
GRANT SELECT ON public.todays_summary TO authenticated;
GRANT SELECT ON public.system_health_metrics TO authenticated;

-- Allow service role to write health metrics
GRANT ALL ON public.system_health_metrics TO service_role;


-- ============================================================================
-- 5. Test the view
-- ============================================================================

-- Test query to verify todays_summary view works
SELECT
  total_operations,
  sheets_success_rate,
  supabase_success_rate,
  both_success_rate,
  avg_sheets_duration_ms,
  avg_supabase_duration_ms
FROM public.todays_summary;

-- Expected result: Should return one row with statistics for today
-- If no operations today, all counts will be 0


-- ============================================================================
-- 6. Optional: Create helper functions
-- ============================================================================

-- Function to get statistics for a specific date range
CREATE OR REPLACE FUNCTION public.get_dual_write_stats(
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_operations BIGINT,
  sheets_success_rate NUMERIC,
  supabase_success_rate NUMERIC,
  both_success_rate NUMERIC,
  avg_sheets_duration_ms NUMERIC,
  avg_supabase_duration_ms NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COUNT(*) AS total_operations,

    ROUND(
      (COUNT(*) FILTER (WHERE sheets_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS sheets_success_rate,

    ROUND(
      (COUNT(*) FILTER (WHERE supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS supabase_success_rate,

    ROUND(
      (COUNT(*) FILTER (WHERE sheets_success = true AND supabase_success = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
      2
    ) AS both_success_rate,

    ROUND(AVG(sheets_duration_ms) FILTER (WHERE sheets_duration_ms IS NOT NULL), 0) AS avg_sheets_duration_ms,
    ROUND(AVG(supabase_duration_ms) FILTER (WHERE supabase_duration_ms IS NOT NULL), 0) AS avg_supabase_duration_ms

  FROM public.dual_write_logs
  WHERE DATE(timestamp) BETWEEN start_date AND end_date;
$$;

COMMENT ON FUNCTION public.get_dual_write_stats IS 'Get dual-write statistics for a date range';


-- ============================================================================
-- Done!
-- ============================================================================
-- Run the test query above to verify everything works
-- Then restart your Next.js dev server and refresh the monitoring dashboard
-- ============================================================================
