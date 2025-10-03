# Timeout Fix Strategy
**Date:** October 3, 2025
**Based on:** TIMEOUT_INVESTIGATION.md

---

## 🎯 FIX STRATEGY OVERVIEW

### **Goals:**
1. ✅ Prevent silent timeout failures
2. ✅ Provide clear user feedback on timeouts
3. ✅ Enable graceful degradation (partial success)
4. ✅ Maintain backward compatibility
5. ✅ No breaking changes to existing functionality

### **Approach:**
- **Conservative timeouts** - Work within Vercel's 10s hobby plan limit
- **Graceful degradation** - Allow partial success (sheet saved, document pending)
- **Better error handling** - Clear messages for users
- **Minimal changes** - Only touch critical paths

---

## 🔧 PROPOSED FIXES

### **Fix 1: Backend Google Sheets API Timeout**
**File:** `pages/api/submitReport.js` (lines 217-224)
**File:** `pages/api/submitMajuReport.js` (lines 43-51)

#### **Current Code:**
```javascript
const appendRes = await sheets.spreadsheets.values.append({
  spreadsheetId: spreadsheetId,
  range: range,
  valueInputOption: 'USER_ENTERED',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: [rowData] },
});
```

#### **Proposed Fix:**
```javascript
// Add timeout wrapper for Google Sheets API call
const appendRes = await Promise.race([
  sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowData] },
  }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Google Sheets API timeout after 8 seconds')), 8000)
  )
]);
```

#### **Rationale:**
- **8 seconds** chosen to stay well under 10s Vercel limit
- Leaves 2s buffer for Apps Script call
- `Promise.race()` ensures first completion wins
- Clear error message for debugging

---

### **Fix 2: Backend Apps Script Timeout**
**File:** `pages/api/submitReport.js` (lines 230-242)
**File:** `pages/api/submitMajuReport.js` (lines 65-140)

#### **Current Code (submitReport.js):**
```javascript
if (newRowNumber) {
  try {
    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }),
    });
  } catch (e) {
    console.error(`Automation ping for ${programType} failed:`, e);
    // Do not block submission success if automation ping fails
  }
}
```

#### **Proposed Fix:**
```javascript
if (newRowNumber) {
  try {
    // Add timeout to Apps Script call (non-blocking)
    await Promise.race([
      fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Apps Script timeout after 15 seconds')), 15000)
      )
    ]);
    console.log(`✅ Apps Script automation completed for ${programType} row ${newRowNumber}`);
  } catch (e) {
    console.error(`⚠️ Automation ping for ${programType} failed:`, e.message);
    // Do not block submission success if automation ping fails
    // Return success anyway - data is already in sheet
  }
}
```

#### **Rationale:**
- **15 seconds** allows Apps Script warm/cold starts
- Non-blocking (already in try-catch)
- Still returns success even if document generation fails
- User gets data saved, document can be generated manually

---

### **Fix 3: Graceful Timeout Error Handling**
**File:** `pages/api/submitReport.js` (lines 262-269)
**File:** `pages/api/submitMajuReport.js` (lines 142-148)

#### **Current Code:**
```javascript
catch (error) {
  console.error('❌ Error in /api/submitReport:', error);
  return res.status(500).json({
    success: false,
    error: `Gagal menghantar laporan ke Google Sheets: ${error.message}`,
    details: error.message,
  });
}
```

#### **Proposed Fix:**
```javascript
catch (error) {
  console.error('❌ Error in /api/submitReport:', error);

  // Specific timeout error handling
  if (error.message.includes('timeout')) {
    return res.status(408).json({
      success: false,
      error: 'Timeout - sila cuba lagi dalam beberapa saat',
      details: error.message,
      phase: error.message.includes('Sheets') ? 'sheet_write_timeout' : 'unknown_timeout',
      retryable: true
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    error: `Gagal menghantar laporan: ${error.message}`,
    details: error.message,
    retryable: false
  });
}
```

#### **Rationale:**
- HTTP 408 for timeout errors (correct status code)
- Malay error message for user clarity
- `retryable: true` flag for frontend retry logic
- `phase` field helps debugging

---

### **Fix 4: Frontend Timeout Handling**
**File:** `pages/laporan-sesi.js` (lines 669-675)
**File:** `pages/laporan-maju.js` (line 849)

#### **Current Code:**
```javascript
const response = await fetch('/api/submitReport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Gagal menghantar laporan.');
```

#### **Proposed Fix:**
```javascript
// Add frontend timeout protection
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

try {
  const response = await fetch('/api/submitReport', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const result = await response.json();

  if (!response.ok) {
    // Check if retryable
    if (result.retryable) {
      throw new Error(`${result.error} (Boleh cuba semula)`);
    }
    throw new Error(result.error || 'Gagal menghantar laporan.');
  }

  // Handle success
  setSuccess('✅ Laporan berjaya dihantar! Borang sedang direset...');

} catch (error) {
  clearTimeout(timeoutId);

  if (error.name === 'AbortError') {
    throw new Error('⏱️ Request timeout - sila cuba lagi. Jika masalah berterusan, hubungi admin.');
  }
  throw error;
}
```

#### **Rationale:**
- **25 seconds** frontend timeout (generous, covers Vercel delays)
- AbortController for clean cancellation
- Clear timeout message in Malay
- Distinguishes between retryable and non-retryable errors

---

### **Fix 5: Add Vercel Configuration (OPTIONAL)**
**File:** `vercel.json` (CREATE NEW)

#### **Proposed File:**
```json
{
  "functions": {
    "pages/api/submitReport.js": {
      "maxDuration": 10
    },
    "pages/api/submitMajuReport.js": {
      "maxDuration": 10
    }
  }
}
```

#### **Rationale:**
- Explicit 10s timeout (documents current behavior)
- Can be increased if upgrading to Pro plan
- Makes timeout configuration visible and configurable

**NOTE:** This is OPTIONAL for now. Only needed if we want to:
1. Document current timeout settings
2. Prepare for Pro plan upgrade (can set to 60s)

---

## 📊 TIMEOUT CONFIGURATION SUMMARY

| Layer                  | Timeout | Rationale                           |
|------------------------|---------|-------------------------------------|
| Vercel Platform        | 10s     | Hobby plan limit (default)          |
| Google Sheets API      | 8s      | Stay under Vercel limit + buffer    |
| Apps Script (blocking) | N/A     | Not implemented (risky)             |
| Apps Script (optional) | 15s     | Would exceed Vercel limit, skip     |
| Frontend fetch()       | 25s     | Cover Vercel delays gracefully      |

### **Revised Strategy for Apps Script:**
**DON'T add timeout** - Let it complete or fail naturally within Vercel's 10s limit. Since it's already non-blocking (in try-catch), it won't break the submission.

**Updated timeout approach:**
- Sheets API: 8s timeout ✅
- Apps Script: No explicit timeout, rely on Vercel's 10s ✅
- Frontend: 25s timeout (AbortController) ✅

---

## 🎯 IMPLEMENTATION PLAN

### **Phase 1: Backend Fixes (Priority 1)**
**Files to modify:**
1. `pages/api/submitReport.js`
2. `pages/api/submitMajuReport.js`

**Changes:**
1. Add Promise.race() timeout to Google Sheets API call (8s)
2. Remove Apps Script timeout (rely on Vercel's 10s limit)
3. Improve error handling with specific timeout detection
4. Add better logging for debugging

**Testing:**
- Test normal submission (should succeed)
- Test with simulated slow Sheets API (should timeout gracefully)
- Verify error messages are user-friendly

---

### **Phase 2: Frontend Fixes (Priority 2)**
**Files to modify:**
1. `pages/laporan-sesi.js`
2. `pages/laporan-maju.js`

**Changes:**
1. Add AbortController with 25s timeout
2. Improve error messages (Malay)
3. Add retryable error detection
4. Better UX feedback

**Testing:**
- Test normal submission
- Test timeout scenario (network disconnect)
- Verify error messages are clear

---

### **Phase 3: Configuration (Optional)**
**Files to create:**
1. `vercel.json`

**Changes:**
1. Document current 10s timeout
2. Prepare for future Pro plan upgrade

---

## 🧪 TESTING STRATEGY

### **Test Case 1: Normal Submission**
```
Scenario: Everything works normally
Expected: Success within 5-8s
- Images upload
- Sheet data saved
- Document generated
- Success message shown
```

### **Test Case 2: Google Sheets API Slow**
```
Scenario: Sheets API takes >8s
Expected: Timeout error with retry message
- Images upload ✅
- Sheet timeout after 8s ❌
- Error: "Timeout - sila cuba lagi dalam beberapa saat"
- User can retry
```

### **Test Case 3: Apps Script Slow**
```
Scenario: Apps Script takes >10s (cold start)
Expected: Data saved, document pending
- Images upload ✅
- Sheet data saved ✅
- Apps Script times out (Vercel kills it) ⚠️
- Success message (data is safe)
- Document can be generated manually
```

### **Test Case 4: Frontend Timeout**
```
Scenario: Network disconnect after backend starts
Expected: Clean timeout after 25s
- Frontend AbortController triggers
- Error: "Request timeout - sila cuba lagi"
- User can retry
```

### **Test Case 5: Complete Success**
```
Scenario: All steps complete quickly
Expected: Success within 8s
- All phases complete
- Success message
- Form reset
```

---

## 📝 CODE CHANGES CHECKLIST

### **submitReport.js:**
- [ ] Add 8s timeout to Google Sheets API call (Promise.race)
- [ ] Remove explicit Apps Script timeout (rely on Vercel)
- [ ] Add timeout error detection in catch block
- [ ] Return HTTP 408 for timeout errors
- [ ] Add `retryable` flag to responses
- [ ] Improve console logging

### **submitMajuReport.js:**
- [ ] Same changes as submitReport.js
- [ ] Ensure consistency with Bangkit flow

### **laporan-sesi.js:**
- [ ] Add AbortController with 25s timeout
- [ ] Add signal parameter to fetch
- [ ] Handle AbortError in catch block
- [ ] Improve error messages (Malay)
- [ ] Add retryable error detection

### **laporan-maju.js:**
- [ ] Same changes as laporan-sesi.js

### **vercel.json (optional):**
- [ ] Create file
- [ ] Set maxDuration: 10 for submit endpoints

---

## 🚀 DEPLOYMENT PLAN

### **Step 1: Code Review**
- Review all changes with user
- Confirm timeout values
- Verify error messages

### **Step 2: Local Testing**
- Test with `npm run dev`
- Simulate timeouts (network throttling)
- Verify error handling

### **Step 3: Commit to Git**
- Commit backend fixes
- Commit frontend fixes
- Commit vercel.json (if needed)

### **Step 4: Deploy to Vercel**
- Push to GitHub
- Automatic deployment on Vercel
- Monitor deployment logs

### **Step 5: Production Testing**
- Test actual submission
- Monitor Vercel function logs
- Watch for timeout events

### **Step 6: Monitor**
- Track success/failure rates
- Monitor timeout frequency
- Adjust timeouts if needed

---

## ⚠️ RISKS & MITIGATIONS

### **Risk 1: 8s timeout too short**
**Mitigation:**
- Monitor Vercel logs for timeout frequency
- Can increase to 9s if needed
- Add retry logic in frontend

### **Risk 2: Apps Script fails without timeout**
**Mitigation:**
- Already non-blocking (in try-catch)
- Data is saved to sheet regardless
- Document can be generated manually
- Consider async job queue in future

### **Risk 3: Frontend timeout too long (25s)**
**Mitigation:**
- Better than infinite wait
- User gets clear feedback
- Can reduce to 20s if preferred

### **Risk 4: Breaking existing submissions**
**Mitigation:**
- All changes are additive (no breaking changes)
- Backward compatible error responses
- Extensive testing before deployment

---

## 📈 SUCCESS METRICS

### **Before Fix:**
- ❌ Silent timeout failures
- ❌ No user feedback
- ❌ Images orphaned in Drive
- ❌ No way to recover

### **After Fix:**
- ✅ Clear timeout error messages
- ✅ Retryable errors identified
- ✅ Graceful degradation (partial success)
- ✅ Better logging for debugging
- ✅ User knows what happened

---

## 🎯 NEXT ACTIONS

### **For User:**
1. **Review** this strategy
2. **Approve** timeout values (8s, 25s)
3. **Confirm** error messages (Malay)
4. **Decide** on vercel.json (optional)

### **For Implementation:**
1. Apply Fix 1: Backend Sheets API timeout
2. Apply Fix 2: Backend Apps Script handling (no explicit timeout)
3. Apply Fix 3: Graceful error handling
4. Apply Fix 4: Frontend timeout
5. Apply Fix 5: vercel.json (if approved)

---

**Strategy Created:** October 3, 2025
**Ready for:** Implementation
**Estimated Time:** 30-60 minutes implementation + testing
