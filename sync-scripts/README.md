# Sync Scripts - Google Sheets to Supabase Migration

Production-ready scripts to migrate ~800+ records from Google Sheets to Supabase database.

## 📦 Scripts Overview

| Script | Input | Output | Records |
|--------|-------|--------|---------|
| `01-sync-batches.js` | batch.json (37 rows) | batches + batch_rounds | ~37 |
| `02-sync-mapping.js` | mapping.json (204 rows) | mentors + entrepreneurs + assignments | ~408 |
| `03-sync-batch-7.js` | all-m.json (69 rows) | entrepreneurs + assignments | ~138 |
| `04-sync-bangkit-reports.js` | bangkit.json (105 rows) | sessions + reports + UM reports | ~315 |
| `05-sync-maju-reports.js` | laporanmaju.json (28 rows) | sessions + reports + UM reports | ~84 |
| `06-sync-um-standalone.js` | um.json (23 rows) | upward_mobility_reports | ~23 |
| `07-master-sync.js` | - | Runs all above scripts | **~1000+** |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd sync-scripts
npm install
```

### 2. Set Environment Variables

Ensure your `.env` file contains:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DRY_RUN=true  # Set to false for actual execution
```

### 3. Run DRY RUN (Recommended First!)

```bash
# Run all scripts in dry-run mode (safe)
node 07-master-sync.js
```

This will:
- ✅ Validate data
- ✅ Check for duplicates
- ✅ Show what would be created
- ❌ NOT write to database

### 4. Run LIVE MODE (After verifying dry run)

```bash
# Execute actual migration
DRY_RUN=false node 07-master-sync.js
```

## 📋 Running Individual Scripts

You can run scripts individually for testing:

```bash
# Test batches sync
node 01-sync-batches.js

# Test mapping sync
node 02-sync-mapping.js

# Test Bangkit reports
node 04-sync-bangkit-reports.js

# etc...
```

## 🔒 Safety Features

All scripts include:

1. **DRY_RUN Mode** - Default true, no writes unless explicitly disabled
2. **Duplicate Checking** - INSERT-ONLY, skips existing records
3. **Error Handling** - Detailed error logging to `sync-errors-XX.json`
4. **Progress Logging** - Real-time feedback every 10 rows
5. **Rate Limiting** - 100ms delay every 10 rows to avoid rate limits
6. **Rollback Safe** - Can be re-run multiple times safely

## 📊 Expected Output

After successful migration:

```
✅ ~30 mentors
✅ ~269 entrepreneurs
✅ ~273 mentor assignments
✅ ~133 sessions
✅ ~133 reports
✅ ~156 UM reports
✅ All records marked with source='google_sheets_sync'
```

## 🎯 Execution Order

The master sync runs scripts in this order:

### Phase 1: Foundation
1. `01-sync-batches.js` - Create batches & rounds
2. `02-sync-mapping.js` - Create mentors, entrepreneurs, assignments
3. `03-sync-batch-7.js` - Add Batch 7 entrepreneurs

### Phase 2: Session Reports
4. `04-sync-bangkit-reports.js` - Bangkit sessions + reports + UM
5. `05-sync-maju-reports.js` - Maju sessions + reports + UM

### Phase 3: UM Reports
6. `06-sync-um-standalone.js` - Standalone UM reports

## 📝 Logs and Reports

After running:

- `master-sync-results.json` - Complete execution report
- `sync-errors-01.json` through `sync-errors-06.json` - Individual error logs (if any)
- Console output - Real-time progress and statistics

## ⚠️ Important Notes

1. **Run scripts in order** - Later scripts depend on earlier ones
2. **Use DRY_RUN first** - Always test before live execution
3. **Check for duplicates** - Scripts will skip existing records
4. **Monitor errors** - Check error JSON files for any issues
5. **Backup database** - Take Supabase backup before live run

## 🔧 Troubleshooting

### "Mentor not found" warnings
- Ensure `01-sync-batches.js` and `02-sync-mapping.js` ran successfully
- Check mentor email matching in mapping.json

### "Entrepreneur not found" warnings
- Ensure `02-sync-mapping.js` and `03-sync-batch-7.js` ran first
- Verify entrepreneur names match exactly

### "Batch not found" errors
- Run `01-sync-batches.js` before other scripts
- Check batch names in JSON files match batches table

### Duplicate key errors
- Normal behavior - script skips and continues
- Shows "Skipped" in results summary

## 📚 Column Mappings

Detailed column mappings are documented in:
- `COMPLETE_MAPPING_FINAL.md` - Complete field mappings
- `EXACT_COLUMN_MAPPING.md` - Detailed schema mappings
- `HANDOFF_TO_CLAUDE_CODE.md` - Full specification

## 🎓 Example Usage

```bash
# 1. Test individual script
DRY_RUN=true node 01-sync-batches.js

# 2. Test full migration
DRY_RUN=true node 07-master-sync.js

# 3. Review logs and results
cat master-sync-results.json

# 4. If all looks good, run for real
DRY_RUN=false node 07-master-sync.js

# 5. Verify in Supabase
# Check tables: batches, mentors, entrepreneurs, sessions, reports, etc.
```

## ✅ Success Criteria

Migration is successful when:

- [ ] All scripts complete without fatal errors
- [ ] Total success count matches expected (~1000+)
- [ ] No critical errors in error logs
- [ ] All records have `source='google_sheets_sync'`
- [ ] Foreign key relationships are intact
- [ ] No duplicate records created
- [ ] Supabase tables populated correctly

## 🆘 Support

For issues:
1. Check error JSON files for details
2. Review console logs for warnings
3. Verify environment variables
4. Ensure Supabase connection works
5. Check JSON input files are correctly formatted

---

**Created by Claude Code** 🤖
**Specification:** HANDOFF_TO_CLAUDE_CODE.md
