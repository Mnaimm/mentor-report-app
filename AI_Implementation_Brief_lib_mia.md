# Implementation Brief: Create lib/mia.js Shared Library

## 📋 Executive Summary

**Task:** Refactor MIA (Missing In Action) logic from laporan-bangkit.js and laporan-maju-um.js into a shared library at `/lib/mia.js`.

**Goal:** Eliminate code duplication, ensure consistency, and improve maintainability.

**Estimated Effort:** 2-3 hours

**Priority:** Medium-High (improves code quality significantly)

---

## 🎯 Objectives

1. ✅ Create `/lib/mia.js` with all shared MIA utilities
2. ✅ Refactor `pages/laporan-bangkit.js` to use the shared library
3. ✅ Refactor `pages/laporan-maju-um.js` to use the shared library
4. ✅ Ensure backward compatibility (no breaking changes)
5. ✅ Maintain identical functionality to current implementation

---

## 📂 Files Involved

### New Files to Create:
- `/lib/mia.js` - Main shared library (see lib_mia_proposed.js)

### Files to Modify:
- `pages/laporan-bangkit.js` - Replace inline MIA logic
- `pages/laporan-maju-um.js` - Replace inline MIA logic
- `lib/upwardMobilityUtils.js` - Update to use shouldSkipValidation()
- `api/submitBangkit.js` - Use prepareMIASubmission()
- `api/submitMajuReportum.js` - Use prepareMIASubmission()

### Files to Reference (Don't Modify):
- `lib/upwardMobilityUtils.js` - Follow this pattern!
- `api/menteeData.js` - May need update for MIA state detection

---

## 🔍 Current State Analysis

### Duplicated Code Locations:

**laporan-bangkit.js:**
- Line 184: `const [isMIA, setIsMIA] = useState(false)`
- Line 558-562: MIA validation
- Line 2235-2236: MIA checkbox rendering
- Line 2240-2243: MIA form conditional rendering

**laporan-maju-um.js:**
- Line 112: `const [isMIA, setIsMIA] = useState(false)`
- Line 665-670: MIA validation
- Line 1287-1295: MIA checkbox rendering (with disabled logic)
- Line 1299-1335: MIA form conditional rendering

**submitBangkit.js:**
- Line 774-776: MIA status assignment
- Line 821: MIA proof upload
- Line 834-835: MIA proof URL storage
- Line 299-344: UM sheet skip logic

**submitMajuReportum.js:**
- Line 110-151: MIA data preparation
- Line 820-851: MIA submission data structure

---

## 📝 Implementation Steps

### STEP 1: Create /lib/mia.js

**Action:** Copy the entire contents from `lib_mia_proposed.js` into `/lib/mia.js`

**File:** Create new file at `/lib/mia.js`

**Contents:** 
```javascript
/**
 * lib/mia.js
 * Shared MIA utilities - see full implementation in lib_mia_proposed.js
 */

// [PASTE ENTIRE CONTENTS OF lib_mia_proposed.js HERE]
```

**Verification:**
```bash
# Test import works
node -e "const mia = require('./lib/mia'); console.log(mia.MIA_CONFIG);"
```

---

### STEP 2: Refactor laporan-bangkit.js

#### 2.1: Add Imports (Top of File)

**Location:** After existing imports

**Add:**
```javascript
import {
  validateMIAForm,
  shouldSkipValidation,
  getMIACheckboxClasses,
  getSubmitButtonText,
  prepareMIASubmission,
  handleMIAToggle,
  getInitialMIAState,
  getMIAWarningLevel
} from '../lib/mia';
```

---

#### 2.2: Replace State Initialization

**Find:** (Around line 184)
```javascript
const [isMIA, setIsMIA] = useState(false);
```

**Replace With:**
```javascript
const [miaState, setMiaState] = useState(getInitialMIAState());

// Add helper for backward compatibility
const isMIA = miaState.isMIA;
const setIsMIA = (value) => setMiaState(prev => ({ ...prev, isMIA: value }));
```

**Note:** This maintains backward compatibility with existing code that uses `isMIA`

---

#### 2.3: Replace MIA Validation

**Find:** (Around lines 558-562)
```javascript
if (isMIA && !formState.mia.alasan) {
    setError('Sila berikan alasan untuk status MIA.');
    return;
}
```

**Replace With:**
```javascript
if (miaState.isMIA) {
  const miaErrors = validateMIAForm({
    reason: formState.mia?.alasan || miaState.reason || '',
    proofFile: formState.mia?.bukti || miaState.proofFile || null
  });
  
  if (miaErrors.length > 0) {
    setError(miaErrors.join(' '));
    return;
  }
}
```

---

#### 2.4: Update Upward Mobility Validation Call

**Find:** (Around line 606)
```javascript
validateUpwardMobility(formState.upwardMobility, isMIA)
```

**Already Correct!** The lib/upwardMobilityUtils.js already accepts isMIA parameter.

**Optional Enhancement:** Update upwardMobilityUtils.js to use lib/mia:
```javascript
// In lib/upwardMobilityUtils.js
import { shouldSkipValidation } from './mia';

export const validateUpwardMobility = (umState, isMIA = false) => {
  if (shouldSkipValidation(isMIA)) return [];
  // ... rest of validation
}
```

---

#### 2.5: Replace Checkbox Styling

**Find:** (Around line 2235)
```javascript
<div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-center">
  <input type="checkbox" id="mia-checkbox" checked={isMIA} onChange={(e) => setIsMIA(e.target.checked)} className="h-5 w-5 rounded text-red-600 focus:ring-red-500" />
  <label htmlFor="mia-checkbox" className="ml-3 font-semibold text-gray-700">Tandakan jika Usahawan Tidak Hadir / MIA</label>
</div>
```

**Replace With:**
```javascript
<div className={getMIACheckboxClasses(miaState.isMIA)}>
  <input 
    type="checkbox" 
    id="mia-checkbox" 
    checked={miaState.isMIA} 
    onChange={(e) => setMiaState(handleMIAToggle(e.target.checked, miaState))} 
    className="h-5 w-5 rounded text-red-600 focus:ring-red-500" 
  />
  <label htmlFor="mia-checkbox" className="ml-3 font-semibold text-gray-700">
    Tandakan jika Usahawan Tidak Hadir / MIA
  </label>
</div>
```

---

#### 2.6: Update Submit Button Text (Optional Enhancement)

**Find:** Submit button text

**Enhance With:**
```javascript
<button type="submit" className="...">
  {getSubmitButtonText('bangkit', currentSession, miaState.isMIA)}
</button>
```

---

### STEP 3: Refactor laporan-maju-um.js

#### 3.1: Add Same Imports

**Location:** After existing imports

**Add:**
```javascript
import {
  validateMIAForm,
  shouldSkipValidation,
  getMIACheckboxClasses,
  getSubmitButtonText,
  prepareMIASubmission,
  handleMIAToggle,
  getInitialMIAState
} from '../lib/mia';
```

---

#### 3.2: Replace State Initialization

**Find:** (Around line 112)
```javascript
const [isMIA, setIsMIA] = useState(false);
```

**Replace With:**
```javascript
const [miaState, setMiaState] = useState(getInitialMIAState());
const isMIA = miaState.isMIA;
const setIsMIA = (value) => setMiaState(prev => ({ ...prev, isMIA: value }));
```

---

#### 3.3: Replace MIA Validation

**Find:** (Around lines 665-670)
```javascript
if (isMIA) {
    if (!miaReason || miaReason.trim() === '') {
        errors.push('Alasan/Sebab Usahawan MIA adalah wajib diisi');
    }
    if (!miaProofFile) {
        errors.push('Bukti MIA (screenshot/dokumen) adalah wajib dimuat naik');
    }
}
```

**Replace With:**
```javascript
if (miaState.isMIA) {
  const miaErrors = validateMIAForm({
    reason: miaReason || miaState.reason || '',
    proofFile: miaProofFile || miaState.proofFile || null
  });
  errors.push(...miaErrors);
}
```

---

#### 3.4: Replace Checkbox (Keep Disabled Logic)

**Find:** (Around lines 1287-1292)
```javascript
<input
  type="checkbox"
  className="form-checkbox h-5 w-5 text-red-600"
  checked={isMIA}
  onChange={(e) => setIsMIA(e.target.checked)}
  disabled={isMIA && (formData.NAMA_MENTEE && currentSessionNumber > 1)}
/>
```

**Replace With:**
```javascript
<input
  type="checkbox"
  className="form-checkbox h-5 w-5 text-red-600"
  checked={miaState.isMIA}
  onChange={(e) => setMiaState(handleMIAToggle(e.target.checked, miaState))}
  disabled={miaState.isMIA && (formData.NAMA_MENTEE && currentSessionNumber > 1)}
/>
```

**Note:** Keep the existing `disabled` logic - this is Maju UM specific behavior

---

### STEP 4: Update Submit Scripts

#### 4.1: Update submitBangkit.js

**Find:** MIA data preparation section (around line 774-835)

**Add Import:**
```javascript
const { prepareMIASubmission, shouldSkipUMSheetWrite } = require('../lib/mia');
```

**Replace MIA Data Preparation:**
```javascript
// Old: Manual construction of MIA data
if (reportData.status === 'MIA') {
  // ... many lines of manual field assignment
}

// New: Use shared function
if (reportData.status === 'MIA') {
  const miaData = prepareMIASubmission({
    mentorEmail: reportData.mentorEmail,
    menteeName: reportData.menteeName,
    sessionNumber: reportData.sessionNumber,
    programType: 'bangkit',
    miaReason: reportData.miaReason,
    miaProofUrl: reportData.miaProofUrl
  });
  
  // Merge with existing data
  Object.assign(reportData, miaData);
}
```

**Update UM Sheet Skip Logic:**
```javascript
// Old: if (reportData.status === 'MIA' && ...)
// New:
if (shouldSkipUMSheetWrite(reportData.STATUS_SESI, reportData.UPWARD_MOBILITY_JSON)) {
  console.log('ℹ️ Skipping UM sheet write - MIA status');
  // Skip UM sheet write
}
```

---

#### 4.2: Update submitMajuReportum.js

**Add Import:**
```javascript
const { prepareMIASubmission, shouldSkipUMSheetWrite } = require('../lib/mia');
```

**Replace MIA Data Preparation:** (Around lines 820-851)
```javascript
if (isMIA) {
  const miaData = prepareMIASubmission({
    mentorEmail: reportData.mentorEmail,
    menteeName: reportData.menteeName,
    sessionNumber: reportData.sessionNumber,
    programType: 'maju',
    miaReason: reportData.miaReason,
    miaProofUrl: imageUrls.mia
  });
  
  dataToSend = {
    ...dataToSend,
    ...miaData
  };
}
```

**Update UM Sheet Skip Logic:** (Around line 110-151)
```javascript
if (shouldSkipUMSheetWrite(reportData.MIA_STATUS, reportData.UPWARD_MOBILITY_JSON)) {
  console.log(`ℹ️ Skipping UM sheet write. MIA: ${reportData.MIA_STATUS === 'MIA'}`);
} else {
  // Write to UM sheet
}
```

---

## 🧪 Testing Checklist

After implementation, verify each of these scenarios:

### Bangkit Testing:
- [ ] Can mark mentee as MIA in Session 1
- [ ] MIA form shows only 2 fields (reason + proof)
- [ ] Regular form hidden when MIA checked
- [ ] Validation works (empty reason = error)
- [ ] Validation works (no proof file = error)
- [ ] Can submit MIA report successfully
- [ ] Session 2 form is blocked for MIA mentee
- [ ] Red warning message displays correctly
- [ ] Status saved as "MIA" in Google Sheet
- [ ] UM sheet write is skipped for MIA

### Maju UM Testing:
- [ ] Can mark mentee as MIA in Session 1
- [ ] MIA form shows only 2 fields
- [ ] Regular form hidden when MIA checked
- [ ] Validation works correctly
- [ ] Can submit MIA report successfully
- [ ] Session 2 form is blocked for MIA mentee
- [ ] Checkbox is disabled in Session 2 if was MIA in Session 1
- [ ] MIA_STATUS saved correctly in Google Sheet
- [ ] UM sheet write is skipped for MIA

### Cross-Program Consistency:
- [ ] Both programs show same validation messages
- [ ] Both programs use same MIA form fields
- [ ] Both programs handle file upload same way
- [ ] Both programs skip UM sheet write same way

### Regression Testing:
- [ ] Normal (non-MIA) sessions still work in both programs
- [ ] Upward Mobility validation still works
- [ ] Form submission without MIA checked works normally
- [ ] No console errors in browser
- [ ] No server errors in logs

---

## 🚨 Critical Requirements

### DO:
✅ Maintain exact same behavior as before (no functional changes)
✅ Keep all existing prop names and function signatures
✅ Test thoroughly in dev environment before production
✅ Add backward compatibility wrappers if needed
✅ Follow existing code style and patterns

### DON'T:
❌ Change any user-facing text or labels
❌ Modify validation error messages (unless improving consistency)
❌ Break existing functionality
❌ Remove any existing features
❌ Change Google Sheet column names or mappings

---

## 📊 Success Criteria

### Code Quality:
- [ ] No code duplication between laporan-bangkit and laporan-maju-um
- [ ] All MIA logic centralized in lib/mia.js
- [ ] ESLint passes (no new warnings)
- [ ] No TypeScript errors (if applicable)

### Functionality:
- [ ] All tests pass (see Testing Checklist above)
- [ ] Identical behavior to previous implementation
- [ ] No regression bugs introduced
- [ ] Performance unchanged or improved

### Documentation:
- [ ] JSDoc comments added to lib/mia.js functions
- [ ] README updated to mention lib/mia.js
- [ ] Code review completed
- [ ] Changes documented in CHANGELOG

---

## 🔄 Rollback Plan

If issues are discovered after deployment:

### Option 1: Quick Revert
```bash
git revert <commit-hash>
git push
```

### Option 2: Feature Flag
```javascript
// In lib/mia.js
const USE_NEW_VALIDATION = process.env.USE_NEW_MIA_LIB !== 'false';

export const validateMIAForm = (miaData) => {
  if (!USE_NEW_VALIDATION) {
    // Old logic as fallback
  }
  // New logic
};
```

### Option 3: Per-Program Rollback
```javascript
// In laporan-bangkit.js
const USE_SHARED_MIA = true; // Toggle per file if needed

if (USE_SHARED_MIA) {
  const errors = validateMIAForm(miaData);
} else {
  // Old inline logic
}
```

---

## 📚 Reference Files

### Files to Study Before Implementation:
1. **lib/upwardMobilityUtils.js** - Follow this pattern exactly!
2. **lib_mia_proposed.js** - Complete implementation to copy
3. **lib_mia_refactoring_guide.md** - Detailed migration steps
4. **mia-investigation-report.md** - Understanding current behavior

### Key Patterns to Follow:
```javascript
// Pattern 1: Named exports (like upwardMobilityUtils.js)
export const validateMIAForm = (miaData) => { ... };

// Pattern 2: Pure functions (no side effects)
export const prepareMIASubmission = (params) => {
  return { ... }; // Return new object, don't mutate
};

// Pattern 3: Clear parameter objects
validateMIAForm({ reason, proofFile }); // Not (reason, proofFile)
```

---

## 💡 Implementation Tips

### Tip 1: Start Small
Don't try to refactor everything at once. Start with validation:
```javascript
// Step 1: Just add the import
import { validateMIAForm } from '../lib/mia';

// Step 2: Use it in one place
const errors = validateMIAForm(miaData);

// Step 3: Test thoroughly
// Step 4: Move to next function
```

### Tip 2: Keep Old Code Commented Temporarily
```javascript
// OLD - DELETE AFTER TESTING
// if (isMIA && !formState.mia.alasan) {
//   setError('...');
// }

// NEW
const errors = validateMIAForm(miaData);
```

### Tip 3: Use Git Commits Strategically
```bash
git commit -m "Create lib/mia.js"
git commit -m "Refactor: laporan-bangkit validation only"
git commit -m "Refactor: laporan-bangkit UI helpers"
git commit -m "Refactor: laporan-maju-um complete"
```

This makes it easy to identify which commit introduced a bug (if any).

---

## 🎯 For AI Coding Assistants

### Copilot/Antigravity Instructions:

**Primary Directive:** 
Create `/lib/mia.js` by copying contents from `lib_mia_proposed.js`, then systematically refactor `laporan-bangkit.js` and `laporan-maju-um.js` to use the shared library while maintaining identical functionality.

**Key Context:**
- This is a Next.js project
- Uses React hooks (useState, useEffect)
- Uses Tailwind CSS for styling
- Follows pattern established in `lib/upwardMobilityUtils.js`
- Google Sheets integration for data storage

**Safety First:**
- Maintain backward compatibility
- Don't change user-facing text
- Test each change incrementally
- Comment old code before deleting

**Success Metrics:**
- No functional changes (behavior identical)
- Code duplication eliminated
- All tests pass
- ESLint clean

---

## 📞 Questions or Issues?

If you encounter problems during implementation:

1. **Check Reference Files:**
   - lib_mia_proposed.js (complete implementation)
   - lib_mia_refactoring_guide.md (detailed steps)
   - mia-investigation-report.md (current state)

2. **Common Issues:**
   - Import errors → Check file paths
   - Validation not working → Check parameter names
   - Styling broken → Check className application
   - Data not saving → Check field name mappings

3. **Need Help:**
   - Review the Testing Checklist
   - Check Rollback Plan
   - Consult the Refactoring Guide

---

## ✅ Final Checklist Before PR

- [ ] lib/mia.js created and tested
- [ ] laporan-bangkit.js refactored
- [ ] laporan-maju-um.js refactored
- [ ] submitBangkit.js updated
- [ ] submitMajuReportum.js updated
- [ ] All tests pass
- [ ] No console errors
- [ ] ESLint passes
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Tested in dev environment
- [ ] Ready for staging deployment

---

**Good luck with the implementation! 🚀**

**Remember:** The goal is to improve code quality while maintaining identical functionality. Take your time, test thoroughly, and don't hesitate to rollback if issues arise.
