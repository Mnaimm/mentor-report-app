# Doc URL Backfill Guide

**Script:** `scripts/sync-docurl.js`
**Purpose:** Backfill missing `doc_url` values from Google Sheets to Supabase
**Status:** ✅ Production Ready

---

## 🎯 Problem This Solves

### The Timing Issue

When a mentor submits a report:
1. Form data is saved to Google Sheets **immediately**
2. Apps Script generates Google Doc **1-2 minutes later**
3. Sync script may run **before** doc is generated
4. Result: Report in Supabase has `doc_url = NULL`

This script fixes those NULL doc URLs by backfilling from the sheet after Apps Script completes.

---

## 🚀 Quick Start

### Check What's Missing (Dry-Run)
```bash
npm run sync:docurl
```

### Actually Update Database (Live Mode)
```bash
npm run sync:docurl:live
```

---

## 📊 How It Works

### For Bangkit Reports:
1. Query Supabase: `SELECT * FROM reports WHERE program='Bangkit' AND doc_url IS NULL`
2. Fetch Google Sheets V8 tab, Column BB (DOC_URL)
3. For each report missing doc_url:
   - Find corresponding row in sheet by `sheets_row_number`
   - If sheet has doc_url, copy it to Supabase
   - If sheet is also empty, skip (Apps Script not done yet)

### For Maju Reports:
1. Query Supabase: `SELECT * FROM reports WHERE program='Maju' AND doc_url IS NULL`
2. Fetch Google Sheets LaporanMaju tab, Column AA (Laporan_Maju_Doc_ID)
3. Same logic as Bangkit

---

## 🔒 Safety Features

### 1. Dry-Run by Default
```bash
npm run sync:docurl  # Shows what WOULD update, doesn't change anything
```

**Output:**
```
[DRY RUN] Would update Row 5: Muhammad Muslim Bin Musa
          URL: https://docs.google.com/document/d/1abc...

💡 Run with --live flag to actually update:
   npm run sync:docurl -- --live
```

### 2. NULL-Only Updates
- Only updates records where `doc_url IS NULL`
- **Never overwrites** existing doc URLs
- Safe to run multiple times

### 3. Row-by-Row Reporting
- See exactly which rows are being updated
- Shows entrepreneur name and doc URL
- Errors reported inline

---

## 📋 Common Scenarios

### Scenario 1: After Initial Migration
**Situation:** Just ran `npm run sync:bangkit` and `npm run sync:maju`

**Steps:**
```bash
# 1. Check immediately (many will be missing)
npm run sync:docurl
# Output: "5 reports missing doc_url, but none found in sheets yet"

# 2. Wait 2-3 minutes for Apps Script

# 3. Check again
npm run sync:docurl
# Output: "Would update 5 reports"

# 4. Update database
npm run sync:docurl:live
# Output: "Successfully updated 5 reports"

# 5. Verify
npm run validate:sync
```

### Scenario 2: Daily Monitoring
**Situation:** Validation shows 1 Maju report missing doc_url

**Steps:**
```bash
# 1. Check what's missing
npm run sync:docurl
# Output: "Maju: Missing doc_url: 1, Found in sheet: 1"

# 2. Update immediately (doc is ready)
npm run sync:docurl:live
# Output: "Successfully updated 1 report"
```

### Scenario 3: Apps Script Was Broken
**Situation:** Apps Script failed for last 10 submissions

**Steps:**
```bash
# 1. Fix Apps Script first

# 2. Wait for it to catch up (may take 10-20 minutes)

# 3. Run backfill
npm run sync:docurl
# Output: "Would update 10 reports"

# 4. Update database
npm run sync:docurl:live
```

### Scenario 4: All Docs Present
**Situation:** Everything is already synced

**Steps:**
```bash
npm run sync:docurl
# Output:
#   "Bangkit: All reports have doc_url"
#   "Maju: All reports have doc_url"
#   "All reports already have doc URLs - nothing to update"
```

---

## 🎨 Output Examples

### Example 1: Nothing to Update
```
🔗 Doc URL Backfill Sync
🧪 DRY RUN MODE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BANGKIT (V8 Sheet → Column BB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 76
Missing doc_url: 0
✅ All Bangkit reports have doc_url

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MAJU (LaporanMaju → Column AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 18
Missing doc_url: 0
✅ All Maju reports have doc_url

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All reports already have doc URLs - nothing to update
```

### Example 2: Missing, Waiting for Apps Script
```
🔗 Doc URL Backfill Sync
🧪 DRY RUN MODE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MAJU (LaporanMaju → Column AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 18
Missing doc_url: 1

📥 Fetching LaporanMaju sheet data...

🔍 Checking for doc URLs in sheet...
   ℹ️  No doc URLs found in sheet for missing reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  1 report(s) missing doc_url, but none found in sheets yet
   (Apps Script may still be generating docs)
```

### Example 3: Ready to Update (Dry-Run)
```
🔗 Doc URL Backfill Sync
🧪 DRY RUN MODE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MAJU (LaporanMaju → Column AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 18
Missing doc_url: 1

📥 Fetching LaporanMaju sheet data...

🔍 Checking for doc URLs in sheet...
   [DRY RUN] Would update Row 5: Muhammad Muslim Bin Musa
             URL: https://docs.google.com/document/d/1Qd8k9zX2vY...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Would update 1 report(s)

💡 Run with --live flag to actually update:
   npm run sync:docurl -- --live
```

### Example 4: Actually Updated (Live Mode)
```
🔗 Doc URL Backfill Sync
⚡ LIVE MODE - Will update database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 MAJU (LaporanMaju → Column AA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total reports in DB: 18
Missing doc_url: 1

📥 Fetching LaporanMaju sheet data...

🔍 Checking for doc URLs in sheet...
   ✅ Row 5: Updated (Muhammad Muslim Bin Musa)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Maju:
  • Total reports: 18
  • Missing doc_url: 1
  • Found in sheet: 1
  • Updated: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully updated 1 report(s)
```

---

## 🔧 Troubleshooting

### Issue: "No doc URLs found in sheet"
**Cause:** Apps Script hasn't generated docs yet
**Solution:** Wait 2-3 minutes and run again

### Issue: "Row X: Not found in sheet"
**Cause:** `sheets_row_number` mismatch or row deleted from sheet
**Solution:**
1. Check if row exists in sheet
2. Verify `sheets_row_number` is correct
3. May need to manually set doc_url in Supabase

### Issue: Updated but validation still shows missing
**Cause:** Cached query or script error
**Solution:**
1. Run validation again: `npm run validate:sync`
2. Query database directly to verify
3. Check for null vs empty string

### Issue: Apps Script keeps failing
**Cause:** Script error, quota exceeded, or permissions
**Solution:**
1. Check Apps Script logs in Google Sheets
2. Verify Apps Script trigger is active
3. Check Google API quotas
4. May need to manually generate docs

---

## 📝 Best Practices

### 1. Always Dry-Run First
```bash
npm run sync:docurl  # See what would update
npm run sync:docurl:live  # Actually update
```

### 2. Timing Recommendations
- **After initial sync:** Wait 3 minutes, then run backfill
- **Daily maintenance:** Run once per day after submissions
- **After issues:** Run after fixing Apps Script

### 3. Integration with Validation
```bash
# Workflow
npm run sync:bangkit
npm run sync:maju
sleep 180  # Wait 3 minutes
npm run sync:docurl:live
npm run validate:sync
```

### 4. Monitoring
```bash
# Check regularly
npm run validate:sync | grep "missing doc_url"

# If any missing, backfill
npm run sync:docurl:live
```

---

## 🎯 Current Status

**Test Run Results:**
```
Bangkit: 76 reports, 0 missing doc_url ✅
Maju: 18 reports, 1 missing doc_url ⚠️
  • Row 5: Waiting for Apps Script to generate doc
```

**Next Steps:**
1. Wait for Apps Script to generate doc for Maju Row 5
2. Run `npm run sync:docurl:live` to backfill
3. Verify with `npm run validate:sync`

---

## 📚 Related Documentation

- **Main Documentation:** `scripts/README.md`
- **Quick Reference:** `SCRIPTS_QUICK_REFERENCE.md`
- **Validation Guide:** `VALIDATION_SUMMARY.md`

---

**Last Updated:** 2025-12-29
**Status:** ✅ Production Ready
**Safe to Run:** Yes (dry-run by default)
