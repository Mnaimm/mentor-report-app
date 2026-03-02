# Sync Script Improvements - March 2, 2026

## Issues Fixed

### 1. ✅ Duplicate Records Prevention
**Problem:** Sync ran twice and created 17 duplicate records

**Solution:**
- Added unique constraint on `mentor_id + entrepreneur_id + program + session_number`
- Updated sync script to use `UPSERT` instead of `INSERT`

**Files:**
- `migrations/add-unique-constraint.sql` - SQL migration
- `scripts/sync-missing-final.js` - Updated to use upsert

---

### 2. ✅ Wrong Timestamp in Tarikh Masuk
**Problem:** `submission_date` showed when sync ran (March 2, 2026 4:59 AM) instead of original Sheet timestamp

**Solution:** Updated sync script to use `record.timestamp` (column 0 from Sheets) instead of `sessionDate`

**Before:**
```javascript
submission_date: undefined // Not set, defaults to created_at
```

**After:**
```javascript
submission_date: record.timestamp // Original Sheet timestamp (column 0)
```

---

### 3. ✅ Missing Name Fields
**Problem:** Synced records had NULL for `nama_mentor`, `nama_usahawan`, `mentor_email` causing "Unknown Mentee" in portal

**Solution:** Updated sync script to populate ALL name fields:
```javascript
nama_mentee: menteeName,
nama_usahawan: menteeName,      // Also populate old field
nama_mentor: record.mentorName,
mentor_email: record.mentorEmail
```

---

## Changes Made

### File 1: `migrations/add-unique-constraint.sql`
```sql
-- Add unique constraint to prevent duplicates
ALTER TABLE reports
ADD CONSTRAINT unique_mentor_entrepreneur_session
UNIQUE (mentor_id, entrepreneur_id, program, session_number);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reports_unique_lookup
ON reports (mentor_id, entrepreneur_id, program, session_number);
```

**How to apply:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `migrations/add-unique-constraint.sql`
3. Run the query
4. If you get "constraint already exists" error, it's already applied (safe to ignore)

---

### File 2: `scripts/sync-missing-final.js`

#### Change 1: Parse original timestamp
```javascript
// Parse submission_date from original Sheet timestamp
let submissionDate = record.timestamp || null;
if (submissionDate && typeof submissionDate === 'string') {
  try {
    const parsed = new Date(submissionDate);
    if (!isNaN(parsed.getTime())) {
      submissionDate = parsed.toISOString();
    }
  } catch (e) {
    console.log(`⚠️  Could not parse timestamp: ${submissionDate}`);
    submissionDate = null;
  }
}
```

#### Change 2: Populate all name fields
```javascript
const reportData = {
  // ... existing fields
  submission_date: submissionDate,  // NEW: Original timestamp
  nama_mentee: menteeName,          // NEW: Always populate
  nama_usahawan: menteeName,        // NEW: Also populate old field
  nama_mentor: record.mentorName,   // NEW: Always populate
  mentor_email: record.mentorEmail, // NEW: Always populate
  // ... rest of fields
};
```

#### Change 3: Use UPSERT instead of INSERT
```javascript
// BEFORE:
const { data, error } = await supabase
  .from('reports')
  .insert(reportData)
  .select();

// AFTER:
const { data, error } = await supabase
  .from('reports')
  .upsert(reportData, {
    onConflict: 'mentor_id,entrepreneur_id,program,session_number',
    ignoreDuplicates: false // Update if exists
  })
  .select();
```

---

## Testing

### Before Running Sync Again:

1. **Apply the unique constraint:**
   ```sql
   -- Run in Supabase SQL Editor
   ALTER TABLE reports
   ADD CONSTRAINT unique_mentor_entrepreneur_session
   UNIQUE (mentor_id, entrepreneur_id, program, session_number);
   ```

2. **Test the updated sync script:**
   ```bash
   # Generate fresh comparison report
   node scripts/compare-sheets-supabase.js

   # Run sync (will now use upsert)
   node scripts/sync-missing-final.js
   ```

3. **Verify results:**
   - No duplicate records should be created
   - `submission_date` should show original Sheet timestamp
   - All name fields should be populated
   - Portal should show actual names (no "Unknown Mentee")

---

## Expected Behavior

### Old Sync (Before Fixes):
```
Row 50: JOHN DOE
   ✅ Inserted (ID: abc123...)

Row 50: JOHN DOE (ran again by accident)
   ✅ Inserted (ID: xyz789...)  ← DUPLICATE!

Result in Supabase:
- submission_date: 2026-03-02 04:59:00 (when sync ran)
- nama_mentor: NULL
- nama_usahawan: NULL
- mentor_email: NULL
```

### New Sync (After Fixes):
```
Row 50: JOHN DOE
   ✅ Upserted (ID: abc123...)

Row 50: JOHN DOE (ran again by accident)
   ℹ️  Already exists, updated (ID: abc123...)  ← NO DUPLICATE!

Result in Supabase:
- submission_date: 2025-10-10 14:30:00 (original Sheet timestamp)
- nama_mentor: "Muhammad Naim Mukhtar"
- nama_usahawan: "JOHN DOE"
- nama_mentee: "JOHN DOE"
- mentor_email: "naemmukhtar@gmail.com"
```

---

## Migration Checklist

- [ ] Apply unique constraint in Supabase SQL Editor
- [ ] Test sync script with updated code
- [ ] Verify no duplicates created
- [ ] Verify `submission_date` shows original timestamps
- [ ] Verify all name fields populated
- [ ] Check portal shows actual names (not "Unknown Mentee")
- [ ] Delete any remaining duplicate records manually

---

## Notes

### About the Unique Constraint
The constraint `mentor_id + entrepreneur_id + program + session_number` ensures:
- Same mentor can have multiple reports (different entrepreneurs/sessions) ✅
- Same entrepreneur can have multiple reports (different mentors/sessions) ✅
- Same mentor + entrepreneur can have multiple sessions ✅
- Same mentor + entrepreneur + program + session = UNIQUE (no duplicates) ✅

### About UPSERT
- First sync: Creates new record
- Second sync: Updates existing record (no duplicate)
- `ignoreDuplicates: false` means it will UPDATE if conflict occurs
- `ignoreDuplicates: true` would SKIP if conflict occurs (not what we want)

### About Timestamp Parsing
The sync script now handles various timestamp formats:
- ISO format: `2025-10-10T14:30:00Z`
- MySQL format: `2025-10-10 14:30:00`
- Sheets format: `10/10/2025 14:30:00`

All are converted to ISO format for Supabase.

---

**Generated:** March 2, 2026
**Author:** Claude Code
