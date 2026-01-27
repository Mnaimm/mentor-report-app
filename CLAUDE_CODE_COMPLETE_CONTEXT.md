# CLAUDE CODE: Complete Project Context & Instructions

## 🎯 SITUATION SUMMARY

### Current State
- **Production (Vercel)**: Working fine, 28 commits behind local
- **Local**: Has 28 unpushed commits, image uploads FAIL locally but work in production
- **Problem**: Not the code - it's the LOCAL ENVIRONMENT configuration

### What Happened
I've been working on consolidating report forms:
1. Created `laporan-bangkit.js` (combines session reports + Upward Mobility tracking)
2. Created `laporan-maju-um.js` (combines MAJU reports + UM tracking)
3. Migrated from `/api/upload-proxy` (Apps Script) → `/api/upload-image` (Google Drive API)
4. Both new forms fail to upload images locally
5. Production `laporan-sesi.js` still works because it uses OLD upload-proxy system

## 📂 KEY FILES

### Working in Production (OLD system - 28 commits behind):
- `pages/laporan-sesi.js` - Uses `/api/upload-proxy` (Apps Script upload)
- `pages/api/submitReport.js` - Handles session report submissions
- `pages/api/upload-proxy.js` - Routes uploads through Apps Script

### Modified Locally (NEW system - unpushed):
- `pages/laporan-sesi.js` - Migrated to `/api/upload-image` (Google Drive API)
- `pages/laporan-bangkit.js` - New form, uses `/api/upload-image`
- `pages/laporan-maju-um.js` - New form, uses `/api/upload-image`
- `pages/api/submitBangkit.js` - New API endpoint
- `pages/api/submitMajuReportum.js` - New API endpoint
- `pages/api/upload-image.js` - Google Drive API direct upload

## 🔍 ROOT CAUSE

The migration to `/api/upload-image` is CORRECT, but local environment is missing:
- Google Drive API credentials
- Service account configuration
- Folder permissions

Production works because it still uses the old upload-proxy system.

## ✅ WHAT I NEED YOU TO DO

### Task 1: Verify Environment Variables
```bash
# Check what environment variables exist in .env.local
cat .env.local

# Look for these critical variables:
# - GOOGLE_DRIVE_FOLDER_ID
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
# - NEXT_PUBLIC_APPS_SCRIPT_URL (old system)

# Compare with what pages/api/upload-image.js expects
```

**Show me:**
1. Which environment variables are MISSING
2. Which environment variables upload-image.js REQUIRES
3. Where these variables are used in the code

### Task 2: Verify Upload-Image Implementation
```bash
# Read and analyze pages/api/upload-image.js
cat pages/api/upload-image.js
```

**Tell me:**
1. Does it use Google Drive API correctly?
2. What credentials does it expect?
3. What's the upload flow?
4. Are there any obvious bugs?

### Task 3: Compare Upload Methods
```bash
# Compare the two upload systems side-by-side
diff pages/api/upload-proxy.js pages/api/upload-image.js
```

**Explain:**
1. Key differences between upload-proxy vs upload-image
2. Why upload-image might fail locally
3. What configuration upload-image needs that upload-proxy doesn't

### Task 4: Check Form Upload Calls
```bash
# Check how forms call the upload API
grep -A 10 "uploadImage\|upload-image" pages/laporan-sesi.js
grep -A 10 "uploadImage\|upload-image" pages/laporan-bangkit.js
```

**Verify:**
1. Are forms calling /api/upload-image correctly?
2. Is the FormData structure correct?
3. Are there any differences between laporan-sesi and laporan-bangkit?

### Task 5: Recommend Fix
Based on your findings, recommend ONE of these:

**Option A: Fix Local Environment**
```bash
# What environment variables to add to .env.local
# Where to get the values (from Vercel dashboard)
# How to test if it works
```

**Option B: Keep Using Upload-Proxy**
```bash
# Revert laporan-sesi.js to upload-proxy
# Update laporan-bangkit.js to use upload-proxy
# Why this might be better for now
```

## 📋 CONSTRAINTS

- **Don't modify code yet** - Just analyze and report findings
- **Focus on environment configuration** - The code migration is correct
- **Be specific** - Show exact env var names needed
- **Test locally** - Suggest how to verify the fix works

## 🎯 EXPECTED OUTPUT

Please provide a report with:

### Section 1: Environment Analysis
```
Missing Environment Variables:
- GOOGLE_DRIVE_FOLDER_ID: Required by upload-image.js line 23
- GOOGLE_SERVICE_ACCOUNT_EMAIL: Required by upload-image.js line 34
- etc.

Present in Vercel Production:
- NEXT_PUBLIC_APPS_SCRIPT_URL: Used by upload-proxy.js
- etc.
```

### Section 2: Upload-Image Requirements
```
upload-image.js needs:
1. Service account JSON key
2. Folder ID with proper permissions
3. Google Drive API enabled
4. etc.

Current issues:
1. Missing private key in .env.local
2. etc.
```

### Section 3: Recommended Action
```
RECOMMENDED: Fix Local Environment

Steps:
1. Go to Vercel → Settings → Environment Variables
2. Copy these variables to .env.local:
   GOOGLE_DRIVE_FOLDER_ID=...
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   etc.
3. Restart dev server: npm run dev
4. Test upload in laporan-sesi.js
5. If works, proceed to test laporan-bangkit.js

Alternative if env fix doesn't work:
[Fallback plan]
```

## 🔴 IMPORTANT NOTES

1. **Production is working** - Don't break what works
2. **The code migration is good** - upload-image is better than upload-proxy
3. **Local testing failed** - Due to missing credentials, not bad code
4. **28 unpushed commits** - Most are good, just need proper environment to test

## 📝 ADDITIONAL CONTEXT

### Git Status
```
Current branch: main
28 commits ahead of origin/main
Modified but uncommitted: pages/laporan-sesi.js (the upload-image migration)

Recent commits:
f3afdc6 - Refactored laporan-bangkit image upload flow (upload-image)
50bd699 - Add custom keputusan input option for Bangkit
3c3cad9 - fix: Replace placeholder-as-value pattern
505e973 - fix: Add separate Apps Script for MAJU UM
aa0fac2 - fix: Implement dual-spreadsheet for MAJU UM
```

### File Modifications
```
✅ pages/laporan-sesi.js - Migration to upload-image (GOOD change)
✅ pages/laporan-bangkit.js - Already committed, uses upload-image
✅ pages/laporan-maju-um.js - New form, uses upload-image
✅ pages/api/submitBangkit.js - New endpoint
✅ pages/api/submitMajuReportum.js - New endpoint
```

## ❓ QUESTIONS TO ANSWER

1. **What env vars does upload-image.js need?**
2. **Why does upload-proxy work but upload-image doesn't?**
3. **How to get Google Drive API credentials for local dev?**
4. **Should I commit the laporan-sesi.js changes now or wait?**
5. **Can I test upload-image without deploying to Vercel?**

## 🚀 GOAL

Get local development working with upload-image so I can:
1. Test laporan-bangkit.js locally
2. Test laporan-maju-um.js locally  
3. Verify everything works before pushing 28 commits to production
4. Deploy with confidence

---

**START HERE:** Run Task 1 (Verify Environment Variables) and show me what's missing.
