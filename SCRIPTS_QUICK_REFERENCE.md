# Scripts Quick Reference Guide

Quick command reference for all sync and validation scripts.

---

## 🚀 Sync Scripts

### Entrepreneurs & Mentors (Mapping)
```bash
# Test mode (first 10 rows)
npm run sync:mappings:test

# Full sync
npm run sync:mappings
```
**What it does:** Syncs entrepreneurs and mentors from "mapping" tab to Supabase

---

### Bangkit Reports (V8 Tab)
```bash
# Test mode (first 10 rows)
npm run sync:bangkit:test

# Full sync
npm run sync:bangkit
```
**What it does:** Syncs Bangkit session reports from "V8" tab to Supabase reports table

---

### Maju Reports (LaporanMaju Tab)
```bash
# Test mode (first 10 rows)
npm run sync:maju:test

# Full sync
npm run sync:maju
```
**What it does:** Syncs Maju session reports from "LaporanMaju" tab to Supabase reports table

---

### Upward Mobility Reports (UM Tab)
```bash
# Test mode (first 10 rows)
npm run sync:um:test

# Full sync
npm run sync:um
```
**What it does:** Syncs UM reports from "UM" tab to Supabase upward_mobility_reports table

---

## 🔗 Doc URL Backfill

### Backfill Missing Doc URLs
```bash
# Dry-run (default) - shows what would be updated
npm run sync:docurl

# Live mode - actually updates
npm run sync:docurl:live
```
**What it does:** Syncs doc_url from Google Sheets to Supabase for reports missing them
**When to run:** After main sync, or when validation shows missing doc URLs

---

## ✅ Validation Scripts

### Daily Data Validation
```bash
npm run validate:sync
```
**What it does:** Compares Google Sheets vs Supabase to detect discrepancies
**When to run:** Daily at 9 AM (after submissions)
**Output:** Detailed report with pass/fail for each check

---

### Setup Validation
```bash
npm run sync:validate
```
**What it does:** Validates environment setup before running syncs
**When to run:** Before first sync, or when troubleshooting

---

## 📋 Complete Sync Workflow

### Initial Migration (One-time)
```bash
# 1. Validate setup
npm run sync:validate

# 2. Test with small datasets
npm run sync:mappings:test
npm run sync:bangkit:test
npm run sync:maju:test
npm run sync:um:test

# 3. Review test results, then run full syncs
npm run sync:mappings
npm run sync:bangkit
npm run sync:maju
npm run sync:um

# 4. Validate data integrity
npm run validate:sync
```

---

### Daily Operations

```bash
# Run daily validation
npm run validate:sync

# If validation fails, re-sync affected program:
npm run sync:bangkit    # if Bangkit has issues
npm run sync:maju       # if Maju has issues
npm run sync:um         # if UM has issues
```

---

### Monthly Maintenance

```bash
# 1. Full re-sync (to catch any missed updates)
npm run sync:bangkit
npm run sync:maju
npm run sync:um

# 2. Validate
npm run validate:sync

# 3. Check logs
cat logs/validation.log  # if using cron logging
```

---

## 🔍 Script Outputs

### Success Output
```
✅ [Program] sync complete: X total rows, Y inserted, Z updated
```

### Error Output
```
❌ Row 123: Failed to upsert - [error details]
```

### Validation Output
```
✅ Bangkit Count: Sheets: 76 | Supabase: 76
⚠️  Validation completed with warnings
```

---

## 📊 Current Data Counts

| Program | Google Sheets | Supabase | Status |
|---------|--------------|----------|--------|
| Bangkit | 76 rows | 76 reports | ✅ Synced |
| Maju | 18 rows | 18 reports | ✅ Synced |
| UM | 6 rows | 6 reports | ✅ Synced |
| Entrepreneurs | - | 294 records | - |
| Mentors | - | 25 records | - |

---

## ⚙️ Environment Variables Required

All scripts use these from `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Google Sheets
GOOGLE_CREDENTIALS_BASE64=ewogICJ0eXBl...
GOOGLE_SHEETS_REPORT_ID=1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w
GOOGLE_SHEETS_MAPPING_ID=1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w
UPWARD_MOBILITY_SPREADSHEET_ID=1mO4Vn24QxbCO87iTKCVJn7E98ew5fxb7mTn_Yh6L2KI
```

---

## 🛠️ Troubleshooting

### Script won't run
```bash
# Install dependencies
npm install

# Check Node version (should be 16+)
node --version
```

### "Environment variable not set" error
```bash
# Check .env.local exists
ls -la .env.local

# Verify it has required variables
cat .env.local | grep SUPABASE_URL
```

### "Permission denied" error (Linux/Mac)
```bash
# Make scripts executable
chmod +x scripts/*.js
```

### Sync shows errors
```bash
# Check Supabase connection
node -e "const {createSupabaseClient} = require('./scripts/lib/supabase-client'); const s = createSupabaseClient(); s.from('entrepreneurs').select('count').then(r => console.log('Connected:', r.count))"

# Check Google Sheets connection
npm run sync:validate
```

---

## 📁 Script Locations

```
scripts/
├── sync-mappings.js          # Entrepreneurs & Mentors sync
├── sync-bangkit-reports.js   # Bangkit reports sync
├── sync-maju-reports.js      # Maju reports sync
├── sync-um-reports.js        # Upward Mobility sync
├── validate-sync.js          # Daily validation
├── validate-setup.js         # Setup check
├── README.md                 # Detailed documentation
└── lib/
    ├── sheets-client.js      # Google Sheets helper
    ├── supabase-client.js    # Supabase helper
    ├── entity-resolver.js    # FK resolution
    └── field-mappers.js      # Data mapping
```

---

## 📝 Logs & Monitoring

### Manual log viewing
```bash
# Run with output redirection
npm run validate:sync > validation.log 2>&1

# View log
cat validation.log
```

### Cron logging (Linux/Mac)
```bash
# Edit crontab
crontab -e

# Add daily validation with logging
0 9 * * * cd ~/mentor-report && npm run validate:sync >> logs/validation-$(date +\%Y-\%m-\%d).log 2>&1
```

### Windows Task Scheduler logging
- Action: `cmd.exe`
- Arguments: `/c npm run validate:sync >> logs\validation.log 2>&1`
- Start in: `C:\Users\MyLenovo\Downloads\mentor-report`

---

## 🚨 Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success (all checks passed) | None required |
| 1 | Failure (critical issues or errors) | Check output and investigate |

Use in scripts:
```bash
npm run validate:sync
if [ $? -eq 0 ]; then
  echo "✅ Validation passed"
else
  echo "❌ Validation failed - check logs!"
fi
```

---

## 🔗 Related Files

- **Detailed docs:** `scripts/README.md`
- **Validation summary:** `VALIDATION_SUMMARY.md`
- **Environment config:** `.env.local`
- **Package scripts:** `package.json`

---

**Last Updated:** 2025-12-29
**Version:** 1.0.0
