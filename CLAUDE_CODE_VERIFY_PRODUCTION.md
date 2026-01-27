# CLAUDE CODE PROMPT: Extract Production Working State

## Context
I have 24 unpushed local commits with broken laporan-bangkit.js and laporan-maju-um.js.
However, my PRODUCTION deployment of laporan-sesi.js is confirmed working.

I need to verify what's actually working in production and create a clean foundation.

## Tasks

### Task 1: Show Production State
```
Show me the current state of these files:
1. pages/laporan-sesi.js
2. pages/api/submitReport.js  
3. pages/api/upload-image.js
4. pages/api/upload-proxy.js

For each file, show me:
- Total lines
- Which upload method it uses (/api/upload-image or /api/upload-proxy)
- Key functions (handleSubmit, handleImageUpload, etc.)
- API endpoints it calls
- Any environment variables used
```

### Task 2: Identify Working Upload Flow
```
Trace the complete flow for laporan-sesi.js image uploads:

1. User selects image in form → which function handles this?
2. Image processing → compression? FormData creation?
3. Upload API call → which endpoint? (/api/upload-image or /api/upload-proxy?)
4. What gets sent in the request?
5. What does the API return?
6. How are image URLs stored before submission?
7. Final submission → which API? What payload structure?

Show me the exact code path for a working image upload + submission.
```

### Task 3: Compare Upload Methods
```
I see both upload-image.js and upload-proxy.js exist.

Compare these two files:
1. Which one does laporan-sesi.js actually use in production?
2. What's the difference between them?
   - upload-image.js: Direct Google Drive API?
   - upload-proxy.js: Routes through Apps Script?
3. Which one is more reliable?
4. Are both currently deployed?
```

### Task 4: Check Environment Variables
```
Search all files for environment variables related to uploads:

Find references to:
- GOOGLE_DRIVE_FOLDER_ID
- NEXT_PUBLIC_APPS_SCRIPT_URL
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
- Any other Google Drive or Apps Script related env vars

Show me:
- Which files use which env vars
- Are they consistently named across files?
```

### Task 5: Verify API Consistency
```
Check if submitReport.js is production-ready:

1. Does it handle image URLs correctly?
2. What fields does it send to Google Sheets?
3. Does it include error handling?
4. Does it have timeout protection (Vercel 10s limit)?
5. Does it dual-write to Supabase or just Google Sheets?
```

## Expected Output

Please provide:
1. ✅ Confirmation: "laporan-sesi.js uses /api/upload-image (or /api/upload-proxy)"
2. ✅ File comparison showing the working vs broken patterns
3. ✅ Environment variables list with their usage
4. ✅ Complete flow diagram of working upload system
5. ⚠️  Any warnings about potential issues

## Constraints
- Only read files, don't modify anything yet
- Focus on laporan-sesi.js, submitReport.js, upload-image.js, upload-proxy.js
- Ignore laporan-bangkit.js and laporan-maju-um.js for now
- Keep output concise but complete

## Why This Matters
Once I understand what's actually working in production, I can:
1. Create a clean base from proven working code
2. Rebuild laporan-bangkit.js correctly
3. Avoid repeating whatever broke the local version
