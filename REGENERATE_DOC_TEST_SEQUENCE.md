# Regenerate Doc - Comprehensive Test Sequence

## Test Objective
Verify that revised reports trigger automatic PDF regeneration when approved, for both Bangkit and Maju programs, with proper dual-write to both Sheets and Supabase.

---

## Pre-Test Checklist

### 1. Environment Setup
- [ ] `BANGKIT_GAS_URL` added to `.env.local` and Vercel
- [ ] `MAJU_GAS_URL` added to `.env.local` and Vercel
- [ ] Both GAS scripts updated with `regenerateDoc` action
- [ ] Both GAS scripts deployed as web apps
- [ ] `review.js` updated with regeneration logic
- [ ] Application redeployed to Vercel (if testing production)

### 2. Test Data Preparation
- [ ] Identified test Bangkit report row (has `sheets_row_number`)
- [ ] Identified test Maju report row (has `sheets_row_number`)
- [ ] Both test rows have valid existing PDFs
- [ ] Both test reports exist in Supabase `reports` table

---

## Test Sequence 1: Bangkit Program

### Step 1.1: Verify Initial State (Bangkit)

**Google Sheets:**
```
1. Open Bangkit tab in Google Sheets
2. Find test row (e.g., row 155)
3. Note current DOC_URL value: ____________________
4. Note Status value: ____________________
```

**Supabase:**
```sql
-- Run in Supabase SQL Editor
SELECT
  id,
  program,
  mentor_email,
  mentee_name,
  session_number,
  status,
  revision_count,
  sheets_row_number,
  doc_url,
  created_at,
  updated_at
FROM reports
WHERE program LIKE '%Bangkit%'
  AND sheets_row_number = 155  -- Change to your test row
LIMIT 1;
```

**Record values:**
- Report ID: ____________________
- Current status: ____________________
- Current revision_count: ____________________
- Current doc_url: ____________________

**Google Drive:**
```
1. Navigate to mentee's folder
2. Go to Sesi X subfolder
3. Count existing PDFs: ______ (should be 1)
4. Note PDF filename: ____________________
```

---

### Step 1.2: Simulate Revision Request (Bangkit)

**Option A: Via SQL (Quick test)**
```sql
-- Run in Supabase SQL Editor
UPDATE reports
SET
  status = 'review_requested',
  revision_count = 1,
  revision_reason = ARRAY['Testing PDF regeneration'],
  revision_notes = 'Test scenario for regenerateDoc functionality',
  revision_requested_by = 'admin@test.com',
  revision_requested_at = NOW(),
  updated_at = NOW()
WHERE id = 'YOUR_REPORT_ID_HERE';  -- From Step 1.1

-- Verify update
SELECT id, status, revision_count, revision_reason
FROM reports
WHERE id = 'YOUR_REPORT_ID_HERE';
```

**Option B: Via Admin UI (Real workflow)**
```
1. Login as admin
2. Go to /admin/reports
3. Find the test report
4. Click "Request Revision"
5. Select reason: "Other"
6. Add notes: "Testing PDF regeneration"
7. Submit
```

**Verify:**
- [ ] Report status = 'review_requested'
- [ ] revision_count = 1
- [ ] revision_requested_at is set

---

### Step 1.3: Approve Report (Trigger Regeneration)

**Via Admin UI:**
```
1. Still logged in as admin
2. Go to /admin/reports
3. Filter by status: "Review Requested"
4. Find your test report
5. Click "Review"
6. Click "Approve"
```

**Monitor Console Logs (Vercel/Local):**
```
Expected logs:
✅ Report [ID] status updated to 'approved' in Supabase
🔄 Report has revision_count=1, triggering PDF regeneration...
🚀 Calling BANGKIT GAS regenerateDoc for row 155
✅ PDF regenerated successfully: [NEW_DOC_ID]
✅ Updated doc_url in Supabase
```

---

### Step 1.4: Verify Results (Bangkit)

**Google Sheets:**
```
1. Refresh Bangkit tab
2. Check test row DOC_URL column (BB)
   - [ ] DOC_URL is updated to new document
   - [ ] New URL is different from Step 1.1
3. Check Status column (BA)
   - [ ] Status shows "DONE - [NEW_TIMESTAMP]"
```

**Supabase:**
```sql
-- Verify report updated
SELECT
  id,
  status,
  revision_count,
  doc_url,
  approved_at,
  reviewed_by,
  payment_status
FROM reports
WHERE id = 'YOUR_REPORT_ID_HERE';
```

**Checklist:**
- [ ] status = 'approved'
- [ ] revision_count = 1 (unchanged)
- [ ] doc_url = NEW URL (different from Step 1.1)
- [ ] approved_at is set
- [ ] payment_status = 'approved_for_payment'

**Dual Write Logs:**
```sql
-- Check regeneration log
SELECT
  operation_type,
  supabase_success,
  sheets_success,
  sheets_error,
  metadata,
  created_at
FROM dual_write_logs
WHERE record_id = 'YOUR_REPORT_ID_HERE'
  AND operation_type = 'pdf_regenerate'
ORDER BY created_at DESC
LIMIT 1;
```

**Checklist:**
- [ ] Entry exists with operation_type = 'pdf_regenerate'
- [ ] supabase_success = true
- [ ] sheets_success = true
- [ ] metadata contains revision_count, new_doc_id, trigger

**Google Drive:**
```
1. Navigate to mentee's folder
2. Go to Sesi X subfolder
3. Count PDFs: ______ (should be 2)
4. Compare filenames:
   - Old PDF: ________________________
   - New PDF: ________________________
5. Verify new PDF has later timestamp
```

**Checklist:**
- [ ] 2 PDFs exist in folder
- [ ] Old PDF is still present (orphaned, not deleted)
- [ ] New PDF has newer timestamp in filename
- [ ] New PDF can be opened and contains correct data

---

## Test Sequence 2: Maju Program

### Step 2.1: Verify Initial State (Maju)

**Google Sheets:**
```
1. Open LaporanMajuUM tab in Google Sheets
2. Find test row (e.g., row 25)
3. Note current Laporan_Maju_Doc_ID value: ____________________
```

**Supabase:**
```sql
-- Run in Supabase SQL Editor
SELECT
  id,
  program,
  mentor_email,
  mentee_name,
  session_number,
  status,
  revision_count,
  sheets_row_number,
  doc_url,
  created_at,
  updated_at
FROM reports
WHERE program LIKE '%Maju%'
  AND sheets_row_number = 25  -- Change to your test row
LIMIT 1;
```

**Record values:**
- Report ID: ____________________
- Current status: ____________________
- Current revision_count: ____________________
- Current doc_url: ____________________

**Google Drive:**
```
1. Navigate to Maju mentee's folder
2. Go to Sesi X subfolder
3. Count existing PDFs: ______ (should be 1)
4. Note PDF filename: ____________________
```

---

### Step 2.2: Simulate Revision Request (Maju)

```sql
-- Run in Supabase SQL Editor
UPDATE reports
SET
  status = 'review_requested',
  revision_count = 1,
  revision_reason = ARRAY['Testing Maju PDF regeneration'],
  revision_notes = 'Test scenario for Maju regenerateDoc functionality',
  revision_requested_by = 'admin@test.com',
  revision_requested_at = NOW(),
  updated_at = NOW()
WHERE id = 'YOUR_MAJU_REPORT_ID_HERE';  -- From Step 2.1

-- Verify update
SELECT id, status, revision_count, revision_reason
FROM reports
WHERE id = 'YOUR_MAJU_REPORT_ID_HERE';
```

**Verify:**
- [ ] Report status = 'review_requested'
- [ ] revision_count = 1

---

### Step 2.3: Approve Report (Trigger Maju Regeneration)

**Via Admin UI:**
```
1. Go to /admin/reports
2. Filter by status: "Review Requested"
3. Find your Maju test report
4. Click "Review"
5. Click "Approve"
```

**Monitor Console Logs:**
```
Expected logs:
✅ Report [ID] status updated to 'approved' in Supabase
🔄 Report has revision_count=1, triggering PDF regeneration...
🚀 Calling MAJU GAS regenerateDoc for row 25
✅ PDF regenerated successfully: [NEW_DOC_ID]
✅ Updated doc_url in Supabase
```

---

### Step 2.4: Verify Results (Maju)

**Google Sheets:**
```
1. Refresh LaporanMajuUM tab
2. Check test row Laporan_Maju_Doc_ID column
   - [ ] Doc ID is updated to new document
   - [ ] New ID is different from Step 2.1
```

**Supabase:**
```sql
-- Verify report updated
SELECT
  id,
  status,
  revision_count,
  doc_url,
  approved_at,
  payment_status
FROM reports
WHERE id = 'YOUR_MAJU_REPORT_ID_HERE';
```

**Checklist:**
- [ ] status = 'approved'
- [ ] revision_count = 1
- [ ] doc_url = NEW URL
- [ ] approved_at is set
- [ ] payment_status = 'approved_for_payment'

**Dual Write Logs:**
```sql
SELECT
  operation_type,
  supabase_success,
  sheets_success,
  metadata
FROM dual_write_logs
WHERE record_id = 'YOUR_MAJU_REPORT_ID_HERE'
  AND operation_type = 'pdf_regenerate'
ORDER BY created_at DESC
LIMIT 1;
```

**Checklist:**
- [ ] Entry exists
- [ ] supabase_success = true
- [ ] sheets_success = true
- [ ] metadata contains new_doc_id

**Google Drive:**
```
1. Navigate to Maju mentee's folder
2. Go to Sesi X subfolder
3. Count PDFs: ______ (should be 2)
4. Verify new PDF has later timestamp
```

**Checklist:**
- [ ] 2 PDFs exist
- [ ] Old PDF still present
- [ ] New PDF has newer timestamp
- [ ] New PDF opens correctly

---

## Test Sequence 3: Edge Cases

### 3.1: Report with revision_count = 0 (Should NOT Regenerate)

```sql
-- Create test case
UPDATE reports
SET
  status = 'submitted',
  revision_count = 0
WHERE id = 'TEST_REPORT_WITH_NO_REVISION';

-- Approve it
-- (via admin UI)
```

**Expected Result:**
- [ ] Report approved normally
- [ ] NO PDF regeneration triggered
- [ ] Console shows: "revision_count=0, skipping regeneration"
- [ ] No 'pdf_regenerate' entry in dual_write_logs
- [ ] Only 1 PDF in Drive folder

---

### 3.2: Report with Missing sheets_row_number

```sql
-- Create test case
UPDATE reports
SET
  status = 'review_requested',
  revision_count = 1,
  sheets_row_number = NULL
WHERE id = 'TEST_REPORT_MISSING_ROW_NUMBER';

-- Approve it
```

**Expected Result:**
- [ ] Report approved in Supabase
- [ ] Console warning: "⚠️ Cannot regenerate PDF: sheets_row_number is missing"
- [ ] dual_write_logs entry shows failure with helpful error
- [ ] Approval NOT blocked (non-blocking behavior works)

---

### 3.3: GAS URL Not Configured

```
1. Remove BANGKIT_GAS_URL from environment
2. Restart server
3. Approve a Bangkit report with revision_count = 1
```

**Expected Result:**
- [ ] Report approved in Supabase
- [ ] Console warning: "⚠️ Cannot regenerate PDF: GAS URL not configured"
- [ ] Approval NOT blocked
- [ ] dual_write_logs entry shows failure

---

## Test Sequence 4: Multiple Revisions

### 4.1: Second Revision Cycle

```sql
-- Request another revision on same report
UPDATE reports
SET
  status = 'review_requested',
  revision_count = 2,  -- Increment
  revision_requested_at = NOW()
WHERE id = 'YOUR_BANGKIT_REPORT_ID_HERE';

-- Approve again
```

**Expected Result:**
- [ ] Third PDF generated (total 3 PDFs in folder)
- [ ] doc_url updated to newest PDF
- [ ] revision_count remains 2
- [ ] All 3 PDFs accessible in Drive

---

## Test Sequence 5: Payment Tracking Integration

### 5.1: Verify Payment Tracking Sheet

```sql
-- Check if report appears in payment tracking
SELECT
  id,
  program,
  status,
  payment_status,
  approved_at,
  base_payment_amount
FROM reports
WHERE id IN ('YOUR_BANGKIT_REPORT_ID', 'YOUR_MAJU_REPORT_ID');
```

**Verify in Payment Tracking Sheet:**
```
1. Open payment tracking Google Sheet
2. Find the correct tab (B7-M6, B6-M5, etc.)
3. Search for report_id
4. Check columns:
   - [ ] report_id exists
   - [ ] verification_nota populated
   - [ ] base_payment_amount correct
   - [ ] Status column (Q) shows status
```

---

## Final Verification Checklist

### Bangkit Program
- [ ] GAS regenerateDoc action works
- [ ] Approval triggers regeneration when revision_count > 0
- [ ] Old PDF preserved (not deleted)
- [ ] New PDF generated with fresh timestamp
- [ ] Sheets DOC_URL updated
- [ ] Supabase doc_url updated
- [ ] dual_write_logs entry created
- [ ] Payment tracking updated

### Maju Program
- [ ] GAS regenerateDoc action works
- [ ] Approval triggers regeneration when revision_count > 0
- [ ] Old PDF preserved
- [ ] New PDF generated
- [ ] Sheets Laporan_Maju_Doc_ID updated
- [ ] Supabase doc_url updated
- [ ] dual_write_logs entry created
- [ ] Payment tracking updated

### Edge Cases
- [ ] revision_count = 0 does NOT trigger regeneration
- [ ] Missing sheets_row_number handled gracefully
- [ ] Missing GAS URL handled gracefully
- [ ] Approval never blocked by regeneration failures
- [ ] Multiple revisions work correctly

### Non-Functional Requirements
- [ ] All operations logged with emoji prefixes
- [ ] Error messages are helpful and actionable
- [ ] No breaking changes to existing workflows
- [ ] Backward compatible with reports without sheets_row_number

---

## Rollback Plan

If issues found:

1. **Quick rollback (revert review.js):**
```bash
git checkout HEAD~1 pages/api/admin/reports/[id]/review.js
git commit -m "Rollback: Temporarily disable PDF regeneration"
git push
```

2. **Remove GAS URLs from environment** (disables feature)

3. **GAS scripts unchanged** (uploadImage and processRow still work)

---

## Success Criteria

✅ **Test passes if:**
1. Both Bangkit and Maju regeneration work
2. Old PDFs are preserved (orphaned)
3. New PDFs generated successfully
4. Both Sheets and Supabase updated
5. dual_write_logs entries created
6. Approval never blocked by failures
7. Edge cases handled gracefully

❌ **Test fails if:**
- Approval blocked by regeneration failure
- Old PDFs deleted
- Sheets or Supabase not updated
- GAS errors break approval flow
- Missing helpful error messages

---

## Test Results Template

```
Test Date: _______________
Tester: _______________
Environment: [ ] Local [ ] Staging [ ] Production

Bangkit Tests: [ ] PASS [ ] FAIL
Maju Tests: [ ] PASS [ ] FAIL
Edge Cases: [ ] PASS [ ] FAIL

Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

Notes:
_____________________________________
_____________________________________
_____________________________________
```

---

## Quick Reference SQL Queries

```sql
-- Find reports ready for testing
SELECT id, program, mentor_email, mentee_name, session_number, sheets_row_number
FROM reports
WHERE status = 'approved'
  AND sheets_row_number IS NOT NULL
  AND doc_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check all regeneration logs
SELECT
  record_id,
  operation_type,
  supabase_success,
  sheets_success,
  sheets_error,
  metadata->>'revision_count' as revision_count,
  metadata->>'new_doc_id' as new_doc_id,
  created_at
FROM dual_write_logs
WHERE operation_type = 'pdf_regenerate'
ORDER BY created_at DESC;

-- Reset test report to re-test
UPDATE reports
SET
  status = 'submitted',
  revision_count = 0,
  revision_reason = NULL,
  revision_notes = NULL,
  approved_at = NULL,
  reviewed_by = NULL
WHERE id = 'YOUR_TEST_REPORT_ID';
```
