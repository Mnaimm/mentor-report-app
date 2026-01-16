-- ============================================================================
-- Find Where Dual-Write Data is Stored
-- ============================================================================

-- 1. List all tables with 'dual' or 'monitor' in the name
SELECT
  schemaname,
  tablename,
  rowcount
FROM (
  SELECT
    schemaname,
    tablename,
    (xpath('/row/count/text()', xml_count))[1]::text::int AS rowcount
  FROM (
    SELECT
      schemaname,
      tablename,
      query_to_xml(format('SELECT COUNT(*) AS count FROM %I.%I', schemaname, tablename), false, true, '') AS xml_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND (tablename LIKE '%dual%' OR tablename LIKE '%monitor%' OR tablename LIKE '%log%')
  ) sub
) sub2
ORDER BY tablename;


-- 2. Simple check - what tables exist?
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- 3. Check dual_write_logs table (if it exists)
SELECT COUNT(*) AS count_in_dual_write_logs
FROM dual_write_logs;


-- 4. Check if dual_write_monitoring exists and has data
SELECT COUNT(*) AS count_in_dual_write_monitoring
FROM dual_write_monitoring;


-- 5. Check reports table for your record
SELECT
  id,
  program,
  nama_usahawan,
  session_number,
  sheets_row_number,
  created_at
FROM reports
WHERE id = '17a00615-ea8e-4258-8d81-f0d3f4c4aa7c';


-- 6. Check all tables that might have timestamp column from today
-- This will help find where the operation was logged
SELECT
  'dual_write_logs' AS table_name,
  COUNT(*) AS today_count
FROM dual_write_logs
WHERE DATE(timestamp) = CURRENT_DATE

UNION ALL

SELECT
  'dual_write_monitoring' AS table_name,
  COUNT(*) AS today_count
FROM dual_write_monitoring
WHERE DATE(timestamp) = CURRENT_DATE;
