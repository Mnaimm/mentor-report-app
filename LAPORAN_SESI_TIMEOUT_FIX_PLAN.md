# Laporan Sesi Timeout & Duplicate Submission Fix Plan
**Date:** October 25, 2025
**Issue:** 504 Timeout errors and duplicate sheet entries during report submission

---

## 🔍 PROBLEM ANALYSIS

### **From Vercel Logs (Image #1):**
```
OCT 25 11:37:01 - POST 200 /api/upload-proxy (6 successful uploads)
OCT 25 11:37:09 - POST 504 /api/submitReport (TIMEOUT after 8 seconds)
```

### **Root Causes Identified:**

#### **1. Timeout Issue (504 Error)**
- **Images upload successfully** (6 images at 11:37:01)
- **submitReport times out** 8 seconds later (11:37:09)
- **Vercel 10-second limit** exceeded on Hobby plan
- **Apps Script call has NO timeout** (lines 175-179 in submitReport.js)
- Apps Script can hang indefinitely, causing function to exceed Vercel's limit

#### **2. Duplicate Submission Issue**
- User sees error: `"Unexpected token 'A', 'An error o'... is not valid JSON"`
- User thinks submission failed → clicks submit again
- **BUT first submission may have written to sheet already**
- **Result:** Multiple duplicate rows in Google Sheet

#### **3. JSON Parsing Error**
- When Vercel times out (504), it returns **HTML error page**
- Frontend tries to parse HTML as JSON → fails with "Unexpected token 'A'"
- Error message is confusing and doesn't help user understand what happened

#### **4. Poor User Feedback**
- No indication of submission progress stages
- User can't tell if data was saved or not
- No guidance on whether to retry
- Button can be clicked multiple times before `isSubmitting` state updates

---

## 🎯 COMPREHENSIVE FIX STRATEGY

### **Fix 1: Add Apps Script Timeout Protection**
**File:** `pages/api/submitReport.js` (lines 172-186)

**Current Code:**
```javascript
if (newRowNumber) {
  try {
    console.log(`🤖 Triggering ${programType} Apps Script automation for row ${newRowNumber}...`);
    await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }),
    });
    console.log(`✅ Apps Script automation completed for ${programType} row ${newRowNumber}`);
  } catch (e) {
    console.error(`⚠️ Automation ping for ${programType} failed:`, e.message);
  }
}
```

**Problem:** No timeout! Apps Script can hang indefinitely.

**Fixed Code:**
```javascript
if (newRowNumber) {
  try {
    console.log(`🤖 Triggering ${programType} Apps Script automation for row ${newRowNumber}...`);

    // Add 5-second timeout for Apps Script (Google Sheets API already took ~2s, need to stay under 10s total)
    const appsScriptTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Apps Script timeout after 5 seconds')), 5000)
    );

    const appsScriptCall = fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }),
    });

    await Promise.race([appsScriptCall, appsScriptTimeout]);
    console.log(`✅ Apps Script automation completed for ${programType} row ${newRowNumber}`);
  } catch (e) {
    console.error(`⚠️ Automation ping for ${programType} failed:`, e.message);
    // Do not block submission - data is already in sheet, document can be generated manually
  }
}
```

**Rationale:**
- 5-second timeout for Apps Script (conservative)
- Total function time: ~2s (Sheets API) + ~5s (Apps Script) = ~7s (under 10s Vercel limit)
- Non-blocking: Even if Apps Script fails, submission succeeds (data in sheet)

---

### **Fix 2: Handle Non-JSON Responses**
**File:** `pages/laporan-sesi.js` (lines 669-700)

**Current Code:**
```javascript
const response = await fetch('/api/submitReport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
  signal: controller.signal,
});
clearTimeout(timeoutId);

const result = await response.json(); // ❌ FAILS if response is HTML

if (!response.ok) {
  if (result.retryable) {
    throw new Error(`${result.error} (Boleh cuba semula)`);
  }
  throw new Error(result.error || 'Gagal menghantar laporan.');
}
```

**Problem:** Assumes response is always JSON. When Vercel returns HTML error page, parsing fails.

**Fixed Code:**
```javascript
const response = await fetch('/api/submitReport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(reportData),
  signal: controller.signal,
});
clearTimeout(timeoutId);

// Safe JSON parsing with fallback
let result;
const contentType = response.headers.get('content-type');

try {
  if (contentType && contentType.includes('application/json')) {
    result = await response.json();
  } else {
    // Response is not JSON (likely HTML error page)
    const text = await response.text();
    console.error('❌ Non-JSON response:', text.substring(0, 200));
    result = {
      error: 'Server returned unexpected response. Please check Google Sheet to verify if report was saved.',
      retryable: false,
      serverResponse: text.substring(0, 200)
    };
  }
} catch (parseError) {
  console.error('❌ Failed to parse response:', parseError);
  result = {
    error: 'Unable to read server response. Please check Google Sheet to verify if report was saved.',
    retryable: false
  };
}

if (!response.ok) {
  // Enhanced error message based on status code
  let userMessage = result.error;

  if (response.status === 504) {
    userMessage = `⏱️ Server timeout - your images were uploaded, but we couldn't confirm if data was saved.\n\n` +
                  `✓ Check Google Sheet to see if your report appears\n` +
                  `✗ DO NOT submit again without checking\n` +
                  `📞 Contact admin if report is missing`;
  } else if (response.status === 408) {
    userMessage = `${result.error || 'Request timeout'}\n\nYou can try submitting again.`;
  }

  if (result.retryable) {
    throw new Error(`${userMessage} (Boleh cuba semula)`);
  }
  throw new Error(userMessage);
}
```

**Rationale:**
- Safely handles HTML error pages from Vercel
- Provides helpful error messages based on HTTP status
- Guides user on what to do (check sheet, don't resubmit blindly)

---

### **Fix 3: Prevent Double-Click Submissions**
**File:** `pages/laporan-sesi.js` (lines 392-418)

**Current Code:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!selectedMentee) {
    setError('Sila pilih usahawan terlebih dahulu.');
    return;
  }

  if (!isMIA) {
    // validation checks...
  }

  setIsSubmitting(true); // ❌ Set too late! User can double-click before this
  setError('');
  setSuccess('');
  // ... rest of submission logic
```

**Problem:** `setIsSubmitting(true)` is set AFTER validation, allowing multiple clicks.

**Fixed Code:**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  // IMMEDIATELY disable button to prevent double-click
  if (isSubmitting) {
    console.warn('⚠️ Submission already in progress, ignoring duplicate click');
    return;
  }
  setIsSubmitting(true);

  if (!selectedMentee) {
    setError('Sila pilih usahawan terlebih dahulu.');
    setIsSubmitting(false); // Re-enable if validation fails
    return;
  }

  if (!isMIA) {
    if (currentSession === 1) {
      if (!files.gw) {
        setError('Sila muat naik Gambar Carta GrowthWheel.');
        setIsSubmitting(false); // Re-enable if validation fails
        return;
      }
      // ... other validations with setIsSubmitting(false) on error
    }
  }

  if (isMIA && !formState.mia.alasan) {
    setError('Sila berikan alasan untuk status MIA.');
    setIsSubmitting(false); // Re-enable if validation fails
    return;
  }

  setError('');
  setSuccess('');

  // ... rest of submission logic (isSubmitting already true)
```

**Rationale:**
- Button disabled IMMEDIATELY on first click
- Prevents race condition where user clicks twice before state updates
- Re-enables button only if validation fails (before submission starts)

---

### **Fix 4: Add Submission Progress Tracking**
**File:** `pages/laporan-sesi.js`

**Add new state:**
```javascript
const [submissionStage, setSubmissionStage] = useState({
  stage: '', // 'compressing', 'uploading', 'saving', 'generating', 'complete'
  message: '',
  detail: '',
  canRetry: false
});
```

**Update submission flow:**
```javascript
const handleSubmit = async (e) => {
  // ... (validation code)

  try {
    setSubmissionStage({ stage: 'compressing', message: 'Preparing images...', detail: '', canRetry: false });

    // Image upload phase
    const uploadPromises = [];
    // ... (build upload promises)

    setSubmissionStage({
      stage: 'uploading',
      message: 'Uploading images to Google Drive...',
      detail: `Uploading ${uploadPromises.length} images`,
      canRetry: false
    });

    await Promise.all(uploadPromises);

    // Clear compression progress
    setCompressionProgress({ show: false, current: 0, total: 0, message: '', fileName: '' });

    // Submission phase
    setSubmissionStage({
      stage: 'saving',
      message: 'Saving report to Google Sheets...',
      detail: 'This may take up to 30 seconds',
      canRetry: false
    });

    // ... (rest of submission)

    setSubmissionStage({
      stage: 'complete',
      message: 'Report submitted successfully!',
      detail: '',
      canRetry: false
    });

  } catch (err) {
    // Determine stage-specific error message
    let errorMessage = err.message;
    let canRetry = false;

    if (submissionStage.stage === 'uploading') {
      errorMessage = `❌ Image upload failed: ${err.message}\n\nCheck your internet connection and try again.`;
      canRetry = true;
    } else if (submissionStage.stage === 'saving') {
      errorMessage = `⚠️ Timeout while saving to Google Sheets.\n\n` +
                     `Your images were uploaded successfully.\n` +
                     `✓ Check Google Sheet to verify if report was saved\n` +
                     `✗ DO NOT resubmit without checking`;
      canRetry = false;
    }

    setSubmissionStage({
      stage: 'error',
      message: errorMessage,
      detail: '',
      canRetry: canRetry
    });
    setError(errorMessage);
  }
}
```

**Update UI to show progress:**
```javascript
{/* Submission Progress Indicator */}
{submissionStage.stage && submissionStage.stage !== 'complete' && (
  <div className={`border rounded-lg p-4 mb-4 ${
    submissionStage.stage === 'error' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
  }`}>
    <div className="flex items-center space-x-3">
      {submissionStage.stage !== 'error' && (
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          {submissionStage.message}
        </p>
        {submissionStage.detail && (
          <p className="text-xs text-gray-600 mt-1">
            {submissionStage.detail}
          </p>
        )}
      </div>
    </div>
  </div>
)}
```

**Rationale:**
- User sees exactly what's happening at each stage
- Clear error messages with actionable guidance
- User knows whether it's safe to retry

---

### **Fix 5: Add Idempotency Protection (Optional - Future Enhancement)**
**File:** `pages/api/submitReport.js`

**Concept:**
```javascript
// Generate unique submission ID on frontend
const submissionId = `${selectedMentee.Usahawan}_${currentSession}_${Date.now()}`;

// Send with reportData
const reportData = {
  ...formState,
  submissionId: submissionId,
  // ... rest of data
};

// Backend checks for duplicate before writing
const existingRow = await findRowBySubmissionId(submissionId);
if (existingRow) {
  console.log('⚠️ Duplicate submission detected, returning existing result');
  return res.status(200).json({ success: true, message: 'Report already submitted', isDuplicate: true });
}
```

**Note:** This is a more advanced fix. We'll implement this only if duplicates continue after Fixes 1-4.

---

## 🧪 TESTING STRATEGY

### **Test 1: Normal Submission (Happy Path)**
**Goal:** Verify everything works normally

**Steps:**
1. Fill out Laporan Sesi form completely
2. Add 4-6 images (to simulate real usage)
3. Click "Hantar Laporan"
4. **Expected behavior:**
   - ✅ See "Preparing images..." message
   - ✅ See "Uploading images to Google Drive..." with count
   - ✅ See "Saving report to Google Sheets..."
   - ✅ Success message appears within 10 seconds
   - ✅ Form resets
   - ✅ Check Google Sheet: 1 new row appears
   - ✅ Check Google Drive: Images uploaded to correct folder

**Pass criteria:** All steps complete successfully, no errors, single row in sheet

---

### **Test 2: Simulate Timeout (Manual Testing)**
**Goal:** Verify timeout is handled gracefully

**Option A: Network Throttling**
1. Open Chrome DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Fill form and submit
4. **Expected behavior:**
   - ✅ Upload progress shows clearly
   - ✅ After ~25 seconds, see timeout error
   - ✅ Error message guides user to check sheet
   - ✅ Button re-enables only if safe to retry

**Option B: Temporarily Break Apps Script URL**
1. In `.env.local`, change `NEXT_PUBLIC_APPS_SCRIPT_URL` to invalid URL
2. Submit report
3. **Expected behavior:**
   - ✅ Images upload successfully
   - ✅ Data saves to Google Sheet
   - ✅ Apps Script times out after 5 seconds (logged in Vercel)
   - ✅ User still sees success (data is safe)
   - ✅ Document generation failed (can be done manually)

**Option C: Add Artificial Delay (Code-based)**
Add to `submitReport.js` temporarily:
```javascript
// TEMPORARY TEST CODE - REMOVE BEFORE PRODUCTION
console.log('⏰ Adding 12-second delay to test timeout...');
await new Promise(resolve => setTimeout(resolve, 12000));
```

**Expected behavior:**
- ✅ Vercel kills function after 10 seconds (504 error)
- ✅ Frontend shows helpful timeout message
- ✅ User guided to check sheet before retrying

---

### **Test 3: Double-Click Prevention**
**Goal:** Verify user cannot submit twice

**Steps:**
1. Fill form completely
2. Rapidly click "Hantar Laporan" button 5 times quickly
3. **Expected behavior:**
   - ✅ Button disables immediately after first click
   - ✅ Console shows: "⚠️ Submission already in progress, ignoring duplicate click"
   - ✅ Only ONE submission happens
   - ✅ Only ONE row appears in Google Sheet

**Pass criteria:** Exactly 1 row in sheet, no duplicates

---

### **Test 4: Non-JSON Response Handling**
**Goal:** Verify graceful handling of HTML error pages

**How to test:**
1. Temporarily modify `submitReport.js` to return HTML:
```javascript
// TEMPORARY TEST CODE
return res.status(504).send('<html><body>An error occurred: Gateway Timeout</body></html>');
```

2. Submit report
3. **Expected behavior:**
   - ✅ No "Unexpected token" error
   - ✅ Clear error message displayed
   - ✅ User guidance on checking sheet
   - ✅ Console logs: "❌ Non-JSON response: <html><body>An error..."

---

### **Test 5: Validation Failure (Button Re-enable)**
**Goal:** Verify button re-enables after validation fails

**Steps:**
1. Select mentee
2. Leave required fields empty (e.g., no images)
3. Click "Hantar Laporan"
4. **Expected behavior:**
   - ✅ Error message shows: "Sila muat naik sekurang-kurangnya satu Gambar..."
   - ✅ Button is enabled again (user can fix and retry)
   - ✅ `isSubmitting` state is false

---

### **Test 6: Progress Message Clarity**
**Goal:** Verify users understand what's happening

**Steps:**
1. Ask a non-technical user to submit a report
2. Observe their reaction to progress messages
3. **Questions to ask:**
   - "Do you know what's happening right now?"
   - "How long do you expect this to take?"
   - "If you see an error, do you know what to do?"

**Pass criteria:** User feels confident and informed throughout process

---

### **Test 7: Production Monitoring (Post-Deployment)**
**Goal:** Monitor real-world behavior after deployment

**Metrics to track:**
1. Check Vercel logs for:
   - ✅ No more 504 errors (or drastically reduced)
   - ✅ Apps Script timeouts logged but don't block submission
   - ✅ No "Unexpected token" errors in logs

2. Check Google Sheet for:
   - ✅ No duplicate rows with same timestamp
   - ✅ All submissions have complete data

3. User feedback:
   - ✅ No complaints about "confusing errors"
   - ✅ No reports of "I don't know if my report was saved"

**Monitor for:** 48 hours after deployment

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Backend Fixes**
- [ ] Fix 1: Add Apps Script timeout (5 seconds) in `submitReport.js`
- [ ] Test locally with `npm run dev`
- [ ] Verify timeout works with Test 2 Option B

### **Phase 2: Frontend Error Handling**
- [ ] Fix 2: Safe JSON parsing in `laporan-sesi.js`
- [ ] Fix 3: Move `setIsSubmitting(true)` to top of `handleSubmit`
- [ ] Add `setIsSubmitting(false)` to all validation error returns
- [ ] Test locally with Test 3 and Test 5

### **Phase 3: User Feedback Enhancement**
- [ ] Fix 4: Add `submissionStage` state
- [ ] Update submission flow to set stage messages
- [ ] Add progress UI component
- [ ] Test locally with Test 1 and Test 6

### **Phase 4: Testing**
- [ ] Run Test 1 (Happy path)
- [ ] Run Test 2 (Timeout scenarios - all 3 options)
- [ ] Run Test 3 (Double-click prevention)
- [ ] Run Test 4 (Non-JSON response)
- [ ] Run Test 5 (Validation + re-enable)
- [ ] Document test results

### **Phase 5: Deployment**
- [ ] Commit changes with clear message
- [ ] Push to GitHub
- [ ] Verify Vercel auto-deployment succeeds
- [ ] Run smoke test in production (1 real submission)
- [ ] Monitor Vercel logs for first 30 minutes
- [ ] Enable Test 7 monitoring for 48 hours

### **Phase 6: Cleanup**
- [ ] Remove any test code (artificial delays, console.logs)
- [ ] Update documentation
- [ ] Mark issue as resolved

---

## 🎯 SUCCESS CRITERIA

### **Before Fix:**
- ❌ 504 timeout errors causing confusion
- ❌ "Unexpected token" JSON parsing errors
- ❌ Users creating duplicate submissions
- ❌ No visibility into submission progress
- ❌ Users don't know if data was saved

### **After Fix:**
- ✅ Timeouts handled gracefully (if they occur)
- ✅ Clear error messages in Malay
- ✅ No duplicate submissions
- ✅ Users see progress at each stage
- ✅ Users know exactly what to do when errors occur
- ✅ Submission success rate > 95%

---

## 🚀 DEPLOYMENT TIMELINE

**Estimated time:** 2-3 hours total
- Implementation: 60-90 minutes
- Testing: 45-60 minutes
- Deployment + monitoring: 30 minutes

**Ready to proceed with implementation?**
