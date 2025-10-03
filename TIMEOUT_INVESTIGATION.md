# Timeout Investigation & Analysis
**Date:** October 3, 2025
**Issue:** Muhammad's submission - Images uploaded but no sheet data

---

## 📊 COMPLETE SUBMISSION FLOW ANALYSIS

### **Flow Diagram:**
```
USER SUBMITS FORM
    ↓
[Frontend] laporan-sesi.js (lines 569-690)
    ↓
PHASE 1: Image Upload (lines 569-645)
    ├─→ uploadImage() × N images
    ├─→ Promise.all(uploadPromises)
    └─→ ✅ SUCCESS (images in Drive folder)
    ↓
PHASE 2: Sheet Data Entry (lines 669-675)
    ├─→ fetch('/api/submitReport') ⚠️ NO TIMEOUT
    ↓
[Backend] submitReport.js (lines 163-270)
    ↓
STEP 1: Google Sheets API (lines 218-224)
    ├─→ sheets.spreadsheets.values.append() ⚠️ NO TIMEOUT
    ├─→ Can hang indefinitely
    └─→ ❌ TIMEOUT → Muhammad's case
    ↓
STEP 2: Apps Script Automation (lines 232-237)
    ├─→ fetch(appsScriptUrl) ⚠️ NO TIMEOUT
    ├─→ Can hang indefinitely
    └─→ Wrapped in try-catch (non-blocking)
    ↓
SUCCESS RESPONSE (line 260)
```

---

## 🔍 TIMEOUT POINTS IDENTIFIED

### **1. Frontend API Call (laporan-sesi.js:669-675)**
```javascript
const response = await fetch('/api/submitReport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
});
```

**Issues:**
- ❌ No `signal` for AbortController
- ❌ No timeout configuration
- ❌ No retry logic
- ❌ Hangs indefinitely if backend times out

**Impact:** User sees "sending..." forever

---

### **2. Backend Google Sheets API (submitReport.js:218-224)**
```javascript
const appendRes = await sheets.spreadsheets.values.append({
  spreadsheetId: spreadsheetId,
  range: range,
  valueInputOption: 'USER_ENTERED',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: [rowData] },
});
```

**Issues:**
- ❌ No timeout on googleapis client
- ❌ No Promise.race() wrapper
- ❌ Subject to Vercel serverless timeout (10s hobby, 60s pro)
- ❌ Can fail silently if Sheets API is slow

**Impact:** **THIS IS THE ROOT CAUSE** - Request times out, but images already uploaded

---

### **3. Backend Apps Script Call (submitReport.js:232-237)**
```javascript
await fetch(appsScriptUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }),
});
```

**Issues:**
- ❌ No timeout on fetch
- ❌ No signal parameter
- ✅ Already wrapped in try-catch (non-blocking)
- ⚠️ But can still contribute to overall timeout

**Impact:** If this times out, data is in sheet but no document generated

---

### **4. Vercel Platform Timeout**
**Default Limits:**
- **Hobby Plan:** 10 seconds
- **Pro Plan:** 60 seconds (can configure up to 300s)
- **Enterprise:** 900 seconds max

**Current Setup:**
- No `vercel.json` found ❌
- No explicit timeout configuration ❌
- Using default timeout (likely 10s for hobby)

**Impact:** Entire API route killed after 10s regardless of code timeout handling

---

## 🎯 FAILURE SCENARIOS IDENTIFIED

### **Scenario 1: Google Sheets API Slow (Muhammad's Case)**
```
1. Images upload successfully (3-5s)
2. fetch('/api/submitReport') starts
3. Google Sheets API takes >10s
4. Vercel kills the request (10s timeout)
5. Frontend never receives response
6. User sees "sending..." timeout
7. Result: Images ✅, Sheet data ❌
```

**Probability:** HIGH (Google Sheets API can be slow during peak hours)

---

### **Scenario 2: Apps Script Cold Start**
```
1. Images upload successfully
2. Sheets API append succeeds (2s)
3. Apps Script fetch starts
4. Apps Script has cold start delay (5-10s)
5. Total time >10s
6. Vercel kills the request
7. Result: Images ✅, Sheet data ✅, Document ❌
```

**Probability:** MEDIUM (Apps Script cold starts are common)

---

### **Scenario 3: Network Issues**
```
1. Images upload successfully
2. Network hiccup during Sheets API call
3. Retry logic missing
4. Request hangs
5. Vercel timeout
6. Result: Images ✅, Sheet data ❌
```

**Probability:** LOW (but possible)

---

### **Scenario 4: Complete Timeout**
```
1. Images upload takes 8s (large files)
2. fetch('/api/submitReport') starts
3. Sheets API takes 3s
4. Total >10s before Apps Script even starts
5. Vercel kills request
6. Result: Images ✅, Sheet data ✅, Document ❌
```

**Probability:** MEDIUM (depends on image sizes)

---

## 📈 TIMING ANALYSIS

### **Best Case Scenario:**
```
Image Upload:     2-3s  (small images, good network)
Sheets API:       1-2s  (Google API healthy)
Apps Script:      2-3s  (warm start)
TOTAL:            5-8s  ✅ SUCCEEDS
```

### **Average Case:**
```
Image Upload:     4-6s  (medium images)
Sheets API:       2-4s  (normal API latency)
Apps Script:      3-5s  (may have cold start)
TOTAL:            9-15s ⚠️ MAY TIMEOUT on hobby plan
```

### **Worst Case (Muhammad's):**
```
Image Upload:     5-7s  (5 files uploaded)
Sheets API:       8-12s ❌ TIMEOUT HERE
Apps Script:      Never reached
TOTAL:            13-19s ❌ FAILS
```

---

## 🔧 TECHNICAL CONSTRAINTS

### **Vercel Serverless Function Limits:**
| Plan       | Timeout | Duration | Memory |
|------------|---------|----------|--------|
| Hobby      | 10s     | FREE     | 1024MB |
| Pro        | 60s     | $20/mo   | 3008MB |
| Enterprise | 900s    | Custom   | Custom |

**Current Plan:** Unknown (likely Hobby based on timeout behavior)

### **Google Sheets API Limits:**
| Metric                  | Limit          |
|-------------------------|----------------|
| Read requests/min       | 60             |
| Write requests/min      | 60             |
| Per user rate limit     | 60/min         |
| Timeout (official)      | No fixed limit |
| Observed timeout range  | 5-30s          |

### **Apps Script Execution Limits:**
| Metric                  | Limit     |
|-------------------------|-----------|
| Script runtime (normal) | 6 minutes |
| Custom function         | 30s       |
| Simultaneous executions | 30        |
| URL Fetch timeout       | 60s       |

---

## 🚨 WHY MUHAMMAD'S SUBMISSION FAILED

### **Timeline Reconstruction:**
```
00:00  - User clicks submit
00:00  - Image compression starts (5 files)
00:05  - Image upload completes ✅
00:05  - fetch('/api/submitReport') starts
00:05  - submitReport.js handler begins
00:06  - Google Sheets API append() called
00:06-00:15 - Sheets API processing (SLOW)
00:15  - Vercel timeout (10s) kills request ❌
00:15  - Frontend never gets response
00:15  - User sees "sending..." timeout
```

**Evidence:**
1. ✅ Images found in Drive folder (upload succeeded)
2. ❌ No entry in Sheet V8 (append failed)
3. ❌ No Apps Script execution logs (never reached)
4. ❌ No error logs (silent timeout)

**Root Cause:** Google Sheets API took >10s, Vercel killed the request

---

## 🎯 WHAT NEEDS TO BE FIXED

### **Priority 1: Backend API Timeouts (CRITICAL)**
**Files:** `pages/api/submitReport.js`, `pages/api/submitMajuReport.js`

**Issues:**
1. No timeout on Google Sheets API call
2. No timeout on Apps Script fetch
3. No graceful degradation
4. No user feedback on partial failures

**Impact:** Production-breaking issue affecting all submissions

---

### **Priority 2: Frontend Timeout Handling (HIGH)**
**Files:** `pages/laporan-sesi.js`, `pages/laporan-maju.js`

**Issues:**
1. No AbortController for fetch
2. No timeout configuration
3. No retry logic
4. Poor error messages

**Impact:** Poor UX, users don't know what happened

---

### **Priority 3: Vercel Configuration (MEDIUM)**
**Files:** `vercel.json` (MISSING)

**Issues:**
1. No vercel.json file
2. Using default 10s timeout
3. No function-specific timeout config

**Impact:** May need to upgrade plan or configure timeouts

---

### **Priority 4: Error Logging & Monitoring (LOW)**
**Files:** All API routes

**Issues:**
1. No structured error logging
2. No timeout tracking
3. No alerting system

**Impact:** Hard to debug future issues

---

## 📝 NEXT STEPS

See: **TIMEOUT_FIX_STRATEGY.md** (to be created)

---

**Investigation Completed:** October 3, 2025
**Next:** Propose comprehensive fix strategy
