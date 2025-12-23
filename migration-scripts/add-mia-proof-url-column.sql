-- Migration: Add mia_proof_url column to reports table
-- Task: 1.3.1
-- Date: 2025-01-24
-- Description: Add column to store MIA proof screenshot URL (Maju only)

-- Add the column
ALTER TABLE reports ADD COLUMN IF NOT EXISTS mia_proof_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN reports.mia_proof_url IS 'URL to MIA proof screenshot (Maju only)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'reports' AND column_name = 'mia_proof_url';

-- Expected output:
-- column_name    | data_type | is_nullable | column_default
-- ---------------+-----------+-------------+---------------
-- mia_proof_url  | text      | YES         | null
