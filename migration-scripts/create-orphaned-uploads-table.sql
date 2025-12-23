-- =====================================================
-- CREATE orphaned_uploads TABLE
-- =====================================================
-- Purpose: Track Google Drive files that were uploaded
--          but failed Supabase dual-write
-- Priority: HIGH (from API_AUDIT_PATCH_PLAN.md - HIGH-3)
-- Safe: Non-destructive (CREATE IF NOT EXISTS)
-- =====================================================

-- Create table
CREATE TABLE IF NOT EXISTS orphaned_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL,
  folder_id text,
  file_name text,
  web_view_link text,
  user_email text,
  upload_timestamp timestamptz NOT NULL,
  error_message text,
  status text DEFAULT 'orphaned',
  reconciliation_needed boolean DEFAULT true,
  reconciled_at timestamptz,
  reconciled_by text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orphaned_status
  ON orphaned_uploads(status, reconciliation_needed);

CREATE INDEX IF NOT EXISTS idx_orphaned_timestamp
  ON orphaned_uploads(upload_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_orphaned_user
  ON orphaned_uploads(user_email);

-- Add helpful comment
COMMENT ON TABLE orphaned_uploads IS
  'Tracks Google Drive files that were uploaded but failed Supabase dual-write (HIGH-3 fix)';

COMMENT ON COLUMN orphaned_uploads.file_id IS
  'Google Drive file ID from Drive API';

COMMENT ON COLUMN orphaned_uploads.error_message IS
  'Supabase error that caused the orphaned state';

COMMENT ON COLUMN orphaned_uploads.reconciliation_needed IS
  'Set to false after manual reconciliation';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify the table was created:
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'orphaned_uploads'
ORDER BY ordinal_position;

-- Check for orphaned uploads (after deployment):
-- SELECT * FROM orphaned_uploads WHERE reconciliation_needed = true ORDER BY upload_timestamp DESC LIMIT 10;
