# Migration Instructions: Add Verification, Payment & Revision Columns

**Migration Name:** `add_verification_payment_revision_columns`
**Date:** February 26, 2026
**Project:** oogrwqxlwyoswyfqgxxi

## Overview

This migration adds columns for:
- Report verification and revision workflow
- Payment batch approval tracking
- Audit trail for report revisions

## Changes Summary

### Reports Table (7 new columns)
- `verification_nota` (TEXT) - Admin verification notes
- `revision_count` (INTEGER) - Number of revision requests
- `revision_reason` (TEXT[]) - Array of revision reasons
- `revision_notes` (TEXT) - Additional revision notes
- `revision_requested_by` (TEXT) - Email of requesting admin
- `revision_requested_at` (TIMESTAMPTZ) - When revision was requested
- `revised_at` (TIMESTAMPTZ) - When mentor completed revision

### Payment_Batches Table (2 new columns)
- `approved_by` (TEXT) - Email of approving admin
- `approved_at` (TIMESTAMP) - When batch was approved

### New Table: report_revisions
Audit trail table for tracking all report revision history.

---

## MANUAL STEPS (REQUIRED)

Since the Supabase CLI automated migration failed due to authentication, please follow these manual steps:

### Step 1: Open Supabase SQL Editor

Go to: **https://app.supabase.com/project/oogrwqxlwyoswyfqgxxi/sql/new**

### Step 2: Copy the SQL

Copy the entire SQL from the file:
```
supabase/migrations/20260226000000_add_verification_payment_revision_columns.sql
```

Or copy directly from here:

```sql
-- Migration: Add verification, payment, and revision tracking columns
-- Date: 2026-02-26
-- Description: Adds columns for report verification, payment approval tracking, and revision workflow

-- On reports table: verification + payment columns + revision tracking
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS verification_nota TEXT,
  ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_reason TEXT[],
  ADD COLUMN IF NOT EXISTS revision_notes TEXT,
  ADD COLUMN IF NOT EXISTS revision_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revised_at TIMESTAMPTZ;

-- On payment_batches table: approval tracking
ALTER TABLE payment_batches
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Audit table for revision history (optional but recommended)
CREATE TABLE IF NOT EXISTS report_revisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        UUID REFERENCES reports(id),
  revision_number  INTEGER,
  status_before    TEXT,
  status_after     TEXT,
  changed_by       TEXT,
  changed_at       TIMESTAMPTZ DEFAULT NOW(),
  revision_reasons TEXT[],
  revision_notes   TEXT
);

-- Create index on report_id for faster revision history lookups
CREATE INDEX IF NOT EXISTS idx_report_revisions_report_id ON report_revisions(report_id);

-- Comments for documentation
COMMENT ON COLUMN reports.verification_nota IS 'Verification notes from admin during report review';
COMMENT ON COLUMN reports.revision_count IS 'Number of times this report has been sent back for revision';
COMMENT ON COLUMN reports.revision_reason IS 'Array of reasons why revision was requested';
COMMENT ON COLUMN reports.revision_notes IS 'Additional notes about the revision request';
COMMENT ON COLUMN reports.revision_requested_by IS 'Email of admin who requested revision';
COMMENT ON COLUMN reports.revision_requested_at IS 'Timestamp when revision was requested';
COMMENT ON COLUMN reports.revised_at IS 'Timestamp when mentor completed the revision';

COMMENT ON COLUMN payment_batches.approved_by IS 'Email of admin who approved the payment batch';
COMMENT ON COLUMN payment_batches.approved_at IS 'Timestamp when payment batch was approved';

COMMENT ON TABLE report_revisions IS 'Audit trail for report revisions and status changes';
```

### Step 3: Execute the SQL

1. Paste the SQL into the Supabase SQL Editor
2. Click **"Run"** button (or press Ctrl/Cmd + Enter)
3. Wait for success message

### Step 4: Verify Migration

After running the SQL, verify it worked by running this verification script:

```bash
node scripts/verify-migration.js
```

You should see:
```
✅ MIGRATION SUCCESSFUL - All columns verified!
```

---

## Alternative Verification (SQL Query)

You can also verify directly in Supabase SQL Editor by running:

```sql
-- Check reports table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reports'
AND column_name IN (
  'verification_nota',
  'revision_count',
  'revision_reason',
  'revision_notes',
  'revision_requested_by',
  'revision_requested_at',
  'revised_at'
)
ORDER BY column_name;

-- Check payment_batches table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payment_batches'
AND column_name IN ('approved_by', 'approved_at')
ORDER BY column_name;

-- Check report_revisions table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'report_revisions';
```

Expected results:
- 7 rows for reports table
- 2 rows for payment_batches table
- 1 row for report_revisions table

---

## Troubleshooting

### Error: "column already exists"
This is fine - it means the column was already added. The migration uses `IF NOT EXISTS` to be idempotent.

### Error: "permission denied"
Make sure you're logged in as a user with admin privileges in Supabase Dashboard.

### Verification script shows columns missing
Run the migration SQL again - it's safe to run multiple times.

---

## Files Created

```
supabase/
└── migrations/
    └── 20260226000000_add_verification_payment_revision_columns.sql

scripts/
├── run-migration.js          (automated attempt - failed due to auth)
├── run-migration-direct.js   (automated attempt - failed due to auth)
└── verify-migration.js       (verification script - use this!)

MIGRATION_INSTRUCTIONS.md     (this file)
```

---

## Next Steps After Migration

Once the migration is complete:

1. Update API routes to use new columns:
   - `/api/admin/verifyReport` - set `verification_nota`
   - `/api/admin/requestRevision` - set `revision_*` columns
   - `/api/admin/approvePaymentBatch` - set `approved_by`, `approved_at`

2. Update admin UI to display:
   - Revision history
   - Verification notes
   - Payment approval status

3. Test revision workflow:
   - Admin requests revision
   - Mentor receives notification
   - Mentor updates report
   - Audit trail is logged

---

## Status Workflow After Migration

The new columns support this enhanced workflow:

```
submitted → (admin review) → approved OR revision_requested
revision_requested → (mentor revises) → submitted (revision_count++)
approved → (payment review) → approved_for_payment
```

All status changes should be logged to `report_revisions` table for audit trail.

---

**Questions?** Contact system admin or check logs in `scripts/verify-migration.js`
