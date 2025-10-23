# Laporan Maju - Draft/Autosave Feature Implementation Plan

**Date:** 2025-10-23
**Status:** Planning (Not Yet Implemented)
**Reference:** Based on existing implementation in `laporan-sesi.js`

---

## 📋 Overview

This document outlines the plan to add draft/autosave functionality to the Laporan Maju form, matching the behavior already implemented in Laporan Sesi.

---

## 🎯 Objective

Add automatic draft saving to prevent data loss when mentors are filling out Laporan Maju forms, providing the same user experience as Laporan Sesi.

---

## 📊 Current State (BEFORE Implementation)

### Files Affected
- `pages/laporan-maju.js` - Main form component

### Current Behavior
- ❌ **No autosave** - Form data is lost if user navigates away
- ❌ **No draft restoration** - Cannot resume work on partially completed forms
- ❌ **No save indicator** - No feedback about data persistence
- ✅ Form resets after successful submission
- ✅ Basic form validation works

### User Pain Points
1. **Data Loss Risk:** If browser crashes or user accidentally closes tab, all work is lost
2. **Single Session Work:** Mentors must complete entire form in one sitting
3. **No Progress Indicator:** No visual feedback that work is being saved
4. **Inconsistent UX:** Different behavior from Laporan Sesi

---

## 🎨 Proposed Implementation

### Feature Components

#### 1. **Automatic Draft Saving**
- **Trigger:** Any form field change (debounced with 700ms delay)
- **Storage:** Browser's `localStorage`
- **Frequency:** Every 700ms after last change
- **Key Format:** `laporanMaju:draft:v1:{mentorEmail}:{menteeName}:s{sessionNumber}`

#### 2. **Draft Key Function**
```javascript
const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
  `laporanMaju:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
```

#### 3. **State Management**
New state variables to add:
```javascript
const [saveStatus, setSaveStatus] = useState('');
const [autosaveArmed, setAutosaveArmed] = useState(false);
```

- `saveStatus`: Displays messages like "Saved • 14:35" or "Draft restored"
- `autosaveArmed`: Controls when autosave is active (only after mentee selection)

#### 4. **Autosave Effect**
```javascript
useEffect(() => {
  if (!autosaveArmed) return;
  if (!formData.NAMA_MENTEE || !currentSessionNumber) return;

  const draftKey = getDraftKey(
    formData.NAMA_MENTEE,
    currentSessionNumber,
    session?.user?.email
  );

  const payload = { ...formData };

  const timer = setTimeout(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      setSaveStatus(`Saved • ${timeStr}`);
    } catch {
      setSaveStatus('Unable to save draft');
    }
  }, 700);

  return () => clearTimeout(timer);
}, [formData, autosaveArmed]);
```

#### 5. **Draft Restoration**
Add to `handleMenteeSelect` function:
```javascript
// After loading session data, restore draft if exists
try {
  const draftKey = getDraftKey(
    selectedMenteeName,
    sessionData.currentSession,
    session?.user?.email
  );
  const saved = localStorage.getItem(draftKey);

  if (saved) {
    const parsed = JSON.parse(saved);
    setFormData(prev => ({
      ...prev,
      ...parsed,
    }));
    setSaveStatus('Draft restored');
  }
} catch (error) {
  console.error('Failed to restore draft:', error);
}

// Enable autosave after data is loaded
setAutosaveArmed(true);
```

#### 6. **Draft Cleanup**
Update in `handleSubmit` (after successful submission):
```javascript
// Clear saved draft BEFORE resetting
try {
  const draftKey = getDraftKey(
    formData.NAMA_MENTEE,
    currentSessionNumber,
    session?.user?.email
  );
  localStorage.removeItem(draftKey);
} catch (error) {
  console.error('Failed to clear draft:', error);
}
```

Update in `resetForm` function:
```javascript
const resetForm = () => {
  // Clear draft from localStorage
  try {
    const draftKey = getDraftKey(
      formData.NAMA_MENTEE,
      currentSessionNumber,
      session?.user?.email
    );
    localStorage.removeItem(draftKey);
  } catch {}

  // ... rest of reset logic
  setSaveStatus('');
  setAutosaveArmed(false);
};
```

#### 7. **UI Changes**
Add save status indicator below submit button:

**Current:**
```jsx
<button type="submit" disabled={loading || compressionProgress.show}>
  {compressionProgress.show ? '🔄 Compressing Images...' :
   loading ? '📤 Submitting...' :
   'Submit Laporan Maju'}
</button>
```

**New:**
```jsx
<button type="submit" disabled={loading || compressionProgress.show}>
  {compressionProgress.show ? '🔄 Compressing Images...' :
   loading ? '📤 Submitting...' :
   'Submit Laporan Maju'}
</button>
{saveStatus && (
  <div className="mt-2 text-xs text-gray-500">
    {saveStatus}
  </div>
)}
```

---

## 🔧 Implementation Steps

### Step 1: Add State Variables
- Add `saveStatus` state
- Add `autosaveArmed` state
- Add `getDraftKey` helper function

### Step 2: Add Autosave Effect
- Create `useEffect` hook monitoring `formData` changes
- Implement debounced save to localStorage
- Update `saveStatus` with timestamp

### Step 3: Add Draft Restoration
- Modify `handleMenteeSelect` to check for saved drafts
- Restore draft data if found
- Arm autosave after successful load

### Step 4: Add Draft Cleanup
- Update `handleSubmit` to clear draft after success
- Update `resetForm` to clear draft on manual reset

### Step 5: Update UI
- Add `saveStatus` display below submit button
- Style to match Laporan Sesi appearance

---

## 📁 Files to Modify

### Primary File
- **`pages/laporan-maju.js`**
  - Add state management
  - Add helper functions
  - Add useEffect hooks
  - Update UI components

### No Backend Changes Required
- ✅ All changes are frontend-only
- ✅ Uses browser localStorage
- ✅ No API modifications needed

---

## 🎯 Expected Behavior (AFTER Implementation)

### User Flow

#### First-Time Use
1. User selects mentee → `autosaveArmed = true`
2. User starts filling form
3. After 700ms of inactivity, form saves to localStorage
4. User sees "Saved • 14:35" below submit button
5. User can safely close browser

#### Returning User
1. User selects same mentee for same session
2. Draft is automatically restored
3. User sees "Draft restored" message
4. User continues where they left off

#### Successful Submission
1. User submits form
2. Draft is cleared from localStorage
3. Form resets as normal

#### Manual Reset
1. User clicks "Reset Form"
2. Draft is cleared from localStorage
3. Form returns to initial state

### Save Status Messages
- `"Saved • HH:MM"` - Draft saved successfully
- `"Draft restored"` - Previous draft loaded
- `"Unable to save draft"` - localStorage error (rare)

---

## 🔍 Technical Details

### localStorage Key Structure
```
laporanMaju:draft:v1:{mentorEmail}:{menteeName}:s{sessionNumber}
```

**Examples:**
- `laporanMaju:draft:v1:naemmukhtar@gmail.com:Nisha Binti Junus:s1`
- `laporanMaju:draft:v1:mentor@gmail.com:Ahmad Ali:s2`

### Storage Isolation
Drafts are isolated by:
1. **Program Type:** `laporanMaju` vs `laporanSesi`
2. **Version:** `v1` (for future compatibility)
3. **Mentor Email:** Different mentors don't share drafts
4. **Mentee Name:** Drafts are per mentee
5. **Session Number:** Each session has separate draft

### Data Stored
The entire `formData` object is serialized to JSON, including:
- All text fields
- JSON arrays (mentoring findings, financial data)
- Session metadata
- Image URLs (after upload)

**Note:** Files are NOT stored in localStorage (only URLs after upload)

---

## ⚠️ Edge Cases Handled

### 1. **localStorage Full**
- Catch error and show "Unable to save draft"
- User can continue working, just without autosave

### 2. **Multiple Tabs/Windows**
- Each tab has independent state
- Last-write-wins when saving to localStorage
- Not a problem in practice (mentors use one tab)

### 3. **Browser Clears localStorage**
- Draft lost, but user would have lost all data anyway
- No worse than current behavior

### 4. **Mentee Switching**
- New draft key generated for new mentee
- Previous mentee's draft remains saved
- Can switch back and draft is restored

### 5. **Session Number Changes**
- Different draft key per session number
- Sesi 1 draft doesn't conflict with Sesi 2 draft

---

## 📊 Performance Impact

### Memory Usage
- **Negligible:** Each draft ~10-50KB depending on content
- Browser localStorage limit: 5-10MB (plenty of space)

### CPU Usage
- **Minimal:** Debounced to 700ms prevents excessive writes
- Only saves when user stops typing

### Network Usage
- **Zero:** All operations are local
- No API calls for autosave

---

## ✅ Testing Checklist

After implementation, test these scenarios:

### Basic Functionality
- [ ] Fill form partially, refresh page, draft restored
- [ ] Save status shows "Saved • HH:MM" after typing
- [ ] Draft restored shows "Draft restored" message
- [ ] Submit clears draft from localStorage
- [ ] Reset Form clears draft from localStorage

### Edge Cases
- [ ] Switch mentees, each has separate draft
- [ ] Switch sessions (Sesi 1 → Sesi 2), each has separate draft
- [ ] Multiple browsers/tabs don't interfere
- [ ] Works with admin impersonation
- [ ] Works with complex JSON fields (mentoring findings)

### Error Handling
- [ ] Handles localStorage full gracefully
- [ ] Handles JSON parse errors gracefully
- [ ] Handles missing mentee name gracefully

---

## 🚀 Deployment Plan

### Local Testing
1. Implement changes in `laporan-maju.js`
2. Test all scenarios in development
3. Verify no regressions

### Production Deployment
1. Commit changes to git
2. Push to GitHub
3. Vercel auto-deploys
4. No environment variables needed
5. No backend changes needed

### Rollback Plan
If issues occur:
- Revert git commit
- Push to GitHub
- Vercel auto-deploys previous version

---

## 📝 Success Criteria

Feature is successful if:
- ✅ Drafts save automatically without user action
- ✅ Drafts restore when returning to form
- ✅ Save status is visible and accurate
- ✅ No data loss on browser close/refresh
- ✅ Consistent UX with Laporan Sesi
- ✅ No performance degradation
- ✅ No bugs or errors in console

---

## 🔗 References

- **Source Pattern:** `pages/laporan-sesi.js` (lines 181-265, 333-350, 650-654, 1095)
- **localStorage API:** [MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- **React useEffect:** [React Documentation](https://react.dev/reference/react/useEffect)

---

## 📅 Timeline

**Estimated Implementation Time:** 30-45 minutes

1. Add state and helpers: ~5 minutes
2. Add autosave effect: ~10 minutes
3. Add restoration logic: ~10 minutes
4. Add cleanup logic: ~5 minutes
5. Update UI: ~5 minutes
6. Testing: ~10 minutes

---

## 👥 Stakeholder Sign-off

**Before implementation, confirm:**
- [ ] User approves feature addition
- [ ] User understands localStorage usage
- [ ] User approves UI changes (save status text)
- [ ] User has reviewed implementation plan

---

---

## ✅ IMPLEMENTATION COMPLETED

**Date Implemented:** 2025-10-23
**Status:** ✅ **IMPLEMENTED & TESTED**

### Changes Made

#### 1. State Management Added
```javascript
// Lines 158-162
const getDraftKey = (menteeName, sessionNo, mentorEmail) =>
  `laporanMaju:draft:v1:${mentorEmail || 'unknown'}:${menteeName || 'none'}:s${sessionNo}`;
const [saveStatus, setSaveStatus] = useState('');
const [autosaveArmed, setAutosaveArmed] = useState(false);
```

#### 2. Autosave Effect
```javascript
// Lines 235-263
useEffect(() => {
  if (!autosaveArmed) return;
  if (!formData.NAMA_MENTEE || !currentSessionNumber) return;

  const draftKey = getDraftKey(
    formData.NAMA_MENTEE,
    currentSessionNumber,
    session?.user?.email
  );

  const payload = { ...formData };

  const timer = setTimeout(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload));
      const timeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      setSaveStatus(`Saved • ${timeStr}`);
    } catch {
      setSaveStatus('Unable to save draft');
    }
  }, 700);

  return () => clearTimeout(timer);
}, [formData, autosaveArmed]);
```

#### 3. Draft Restoration (Lines 369-392)
- Added to `handleMenteeSelect` function
- Restores draft from localStorage when mentee is selected
- Displays "Draft restored" message
- Arms autosave after successful load

#### 4. Draft Cleanup
- **In `resetForm()`** (Lines 742-753): Clears draft when form is manually reset
- **In `handleSubmit()`** (Lines 1148-1159): Clears draft after successful submission

#### 5. UI Update (Lines 2006-2010)
```javascript
{saveStatus && (
  <div className="mt-2 text-xs text-gray-500 text-center">
    {saveStatus}
  </div>
)}
```

### Test Results ✅

**Test 1: Basic Autosave**
- ✅ Form data saves automatically after 700ms
- ✅ "Saved • HH:MM" displays below submit button
- ✅ No performance impact observed

**Test 2: Draft Restoration**
- ✅ Draft restores when selecting same mentee
- ✅ "Draft restored" message displays
- ✅ All form fields populated correctly

**Test 3: Draft Clearing**
- ✅ Draft clears after successful submission
- ✅ Draft clears on manual reset
- ✅ No orphaned drafts in localStorage

### Files Modified
- ✅ `pages/laporan-maju.js` - All functionality added

### Deployment Status
- ✅ Tested locally - All tests passed
- ⏳ Ready to push to production

---

## 📊 AFTER Implementation State

### Current Behavior (Working!)
- ✅ **Autosave Active** - Form data saves every 700ms while typing
- ✅ **Draft Restoration** - Returns to saved draft when reopening form
- ✅ **Save Indicator** - Visual feedback shows "Saved • HH:MM"
- ✅ **Smart Cleanup** - Drafts cleared after submission or manual reset
- ✅ **Consistent UX** - Matches Laporan Sesi behavior exactly

### User Benefits Achieved
1. ✅ **No Data Loss** - Work preserved even if browser crashes
2. ✅ **Multi-Session Work** - Can complete forms over multiple sessions
3. ✅ **Visual Feedback** - Users see save status in real-time
4. ✅ **Consistent Experience** - Same UX as Laporan Sesi

### Technical Achievements
- ✅ Zero performance impact (debounced saves)
- ✅ Minimal UI changes (single text element)
- ✅ Robust error handling
- ✅ No backend changes required
- ✅ Isolated per mentor/mentee/session

---

**Implementation Verified By:** User
**Deployment Status:** Ready for Production
**Next Step:** Push to GitHub → Auto-deploy to Vercel

---

*Document prepared by: Claude Code*
*Date: 2025-10-23*
*Implemented: 2025-10-23*
*Status: ✅ Complete*
