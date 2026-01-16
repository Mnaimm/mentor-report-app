-- ============================================================================
-- Fix Monitoring Views - Drop and Recreate
-- ============================================================================
-- This script drops the existing view and recreates it with correct structure
-- ============================================================================

-- Step 1: Drop the existing view (if it exists)
DROP VIEW IF EXISTS public.todays_summary CASCADE;

-- Step 2: Recreate the view with correct columns
CREATE VIEW public.todays_summary AS
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

-- Step 3: Create system_health_metrics table (if it doesn't exist)
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

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_system_health_checked_at
ON public.system_health_metrics(checked_at DESC);

-- Step 4: Grant permissions
GRANT SELECT ON public.todays_summary TO authenticated;
GRANT SELECT ON public.todays_summary TO anon;
GRANT SELECT ON public.system_health_metrics TO authenticated;
GRANT ALL ON public.system_health_metrics TO service_role;

-- Step 5: Test the view
SELECT
  total_operations,
  sheets_success_rate,
  supabase_success_rate,
  both_success_rate,
  avg_sheets_duration_ms,
  avg_supabase_duration_ms
FROM public.todays_summary;

-- ============================================================================
-- Done! The view has been recreated
-- ============================================================================
