# Script Comparison: A (Production) vs B (Target)

**Date:** January 24, 2026  
**Script A:** `appsscript-1\Code.js` (Production - Source of Truth)  
**Script B:** `appscript-5\Code.js` (Target - Needs Updates)

---

## 🎯 Executive Summary

Script B introduces **Upward Mobility tracking** (28 new data fields) and uses a new sheet name (`Bangkit` instead of `V8`), but has **7 critical breaking differences** that will cause production failures if deployed as-is.

**Primary Issues:**
1. ❌ Missing CORS support → Browser API calls will fail
2. ❌ Different sheet name → Sheet not found errors
3. ❌ Business category mapping conflicts → Wrong data categorization
4. ⚠️ Different template IDs → Output format mismatch
5. ⚠️ Additional UM columns required → Silent empty values if missing

---

## 🔍 1. Entry Points & Request Flow

### Script A (Production)
```javascript
doGet()          → Test endpoint
doPost(e)        → Main handler with CORS
doOptions(e)     → CORS preflight handler ✅
```

### Script B (Target)
```javascript
doGet(e)         → Test endpoint
doPost(e)        → Main handler WITHOUT CORS ❌
// doOptions() MISSING ❌
```

### 🚨 BREAKING: CORS Headers Missing
**Impact:** All browser-based API requests will fail with CORS errors.

**Expected Request Format (Both):**
```json
{
  "action": "processRow",
  "rowNumber": 5
}
```

**OR for uploads:**
```json
{
  "action": "uploadImage",
  "fileData": "base64...",
  "fileName": "image.jpg",
  "folderId": "...",
  "menteeName": "...",
  "sessionNumber": 1
}
```

---

## 📊 2. Data Mapping Differences

### Sheet Configuration

| Configuration | Script A | Script B | Status |
|---------------|----------|----------|--------|
| Main Sheet | `'V8'` | `'Bangkit'` | 🚨 BREAKING |
| Mapping Sheet | `'mapping'` | `'Mapping'` | ⚠️ Case difference |
| Open Function | `openV8_()` | `openBangkitSheet_()` | Different |

### 🚨 BREAKING: Sheet Name Mismatch
**Script A expects:** `V8` sheet  
**Script B expects:** `Bangkit` sheet  
**Production Impact:** Will throw "Sheet not found" error if sheet name doesn't match.

---

### Column Structure

**Script A: 52 columns (A-BB)**
- A-AZ (0-51): Session data
- BA-BB (52-53): Status, DOC_URL

**Script B: 82 columns (A-CD)**
- A-AZ (0-51): Session data (same as A)
- BA-BB (52-53): Status, DOC_URL, Mentee_Folder_ID
- **BC-CB (54-81): 28 NEW UPWARD MOBILITY columns** ⭐

### ⭐ NEW: Upward Mobility Fields (Script B Only)

```javascript
// Section 1: Engagement Status (3 fields)
UM_STATUS_PENGLIBATAN
UM_STATUS
UM_KRITERIA_IMPROVEMENT

// Section 2: BIMB Channels (6 fields)
UM_AKAUN_BIMB
UM_BIMB_BIZ
UM_AL_AWFAR
UM_MERCHANT_TERMINAL
UM_FASILITI_LAIN
UM_MESINKIRA

// Section 3: Financial Metrics (12 fields - 6 values + 6 ulasan)
UM_PENDAPATAN_SEMASA + UM_ULASAN_PENDAPATAN
UM_PEKERJA_SEMASA + UM_ULASAN_PEKERJA
UM_ASET_BUKAN_TUNAI_SEMASA + UM_ULASAN_ASET_BUKAN_TUNAI
UM_ASET_TUNAI_SEMASA + UM_ULASAN_ASET_TUNAI
UM_SIMPANAN_SEMASA + UM_ULASAN_SIMPANAN
UM_ZAKAT_SEMASA + UM_ULASAN_ZAKAT

// Section 4: Digital (2 fields)
UM_DIGITAL_SEMASA + UM_ULASAN_DIGITAL

// Section 5: Marketing (2 fields)
UM_MARKETING_SEMASA + UM_ULASAN_MARKETING

// Section 6: Premises Visit (1 field)
UM_TARIKH_LAWATAN_PREMIS
```

**Impact:** Script B will leave these fields empty if columns don't exist. No errors, just silent missing data.

---

### Template IDs

| Template | Script A (Production) | Script B (Target) |
|----------|----------------------|-------------------|
| Sesi 1 | `1oeh89mGEiN4DZ6CdP6Rtuo8btNf5FQl3sndHgmGlcEg` | `1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI` |
| Sesi 2-4 | `18iHXbHPen7HkWSL5DtiyGfNz7BpeMhwVp0iKxAYgcI8` | `1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ` |

### ⚠️ IMPACT: Different Templates = Different Output Format
**Action Required:** Verify new templates contain all required placeholders including {{UM_*}} fields.

---

## 🔄 3. Processing Logic Differences

### Document Generation Steps

**Common Steps (Both):**
1. Lock acquisition
2. Check if already processed
3. Build row data object
4. Lookup mentee in mapping sheet
5. Determine session number
6. Create document from template
7. Replace common placeholders
8. Fill footer
9. Insert images
10. Save document
11. Update sheet

**Script B Additional Step (NEW):**
```javascript
// Step 8: NEW in Script B
console.log('Step 8: Performing Upward Mobility replacements...');
replaceUpwardMobilityPlaceholders_(body, row);
console.log('UM replacements completed');
```

**Script A does NOT have this step.**

---

### Business Category Mapping

Both scripts map focus areas to 4 business categories, but with **critical conflicts**:

| Focus Area Text | Script A Maps To | Script B Maps To | Status |
|-----------------|------------------|------------------|--------|
| "Business Process" | `organisasi` | `operasi` | 🚨 CONFLICT |
| "Product Portfolio:" | `konsepBisnes` | Not matched | 🚨 CONFLICT |
| "Product Portfolio" | Not matched | `konsepBisnes` | 🚨 CONFLICT |
| "Ownership & Board" | `organisasi` | Not mapped | ⚠️ Missing |
| "Networking" | `hubunganPelanggan` | Not mapped | ⚠️ Missing |
| "Production & Deliveries" | `operasi` | Not mapped | ⚠️ Missing |

### 🚨 CRITICAL: Business Process Mapping Conflict

**Scenario:** User enters "Business Process" as focus area

**Script A Result:**
```
Category: Organisasi
Focus: • Business Process
```

**Script B Result:**
```
Category: Operasi
Focus: • Business Process
```

**Impact:** Same input produces different categorization → inconsistent reports.

---

## 4. Error Handling Comparison

### Lock Mechanism
✅ **Both identical:** 30-second timeout, returns error object if lock fails.

### Try-Catch Coverage
✅ **Both identical:** Non-fatal errors for:
- Footer replacement
- Image insertion
- Business categories
- Session history

⚠️ **Issue (Both scripts):** Silent failures on image/footer errors. User not alerted.

### Error Return Format
✅ **Both identical:**
```json
{
  "success": false,
  "error": "Error message",
  "rowNumber": 5
}
```

---

## 5. Authentication & Deployment

### Required OAuth Scopes
✅ **Both require same scopes:**
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/script.external_request`

### Web App Deployment Settings
```
Execute as: Me (service account)
Who has access: Anyone (required for external API calls)
```

### 🚨 CRITICAL: CORS Preflight Handler

**Script A has:**
```javascript
function doOptions(e) {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
}
```

**Script B:** ❌ **MISSING THIS FUNCTION**

**Impact:** Browser will send OPTIONS preflight request → Script B returns error → CORS failure.

---

## 🚨 6. Breaking Differences Summary

| # | Issue | Script A | Script B | Fix Priority |
|---|-------|----------|----------|--------------|
| 1 | **CORS Support** | ✅ Full CORS | ❌ No CORS | 🔴 CRITICAL |
| 2 | **Sheet Name** | `V8` | `Bangkit` | 🔴 CRITICAL |
| 3 | **UM Processing** | Not present | 28 NEW fields | 🟡 FEATURE |
| 4 | **Template IDs** | Old | New | 🟠 VERIFY |
| 5 | **Category Mapping** | "Business Process" → organisasi | "Business Process" → operasi | 🔴 CRITICAL |
| 6 | **doOptions()** | Present | Missing | 🔴 CRITICAL |
| 7 | **Focus Variants** | More variants (with colons) | Fewer variants | 🟠 QUALITY |

---

## 🔧 7. PATCH PLAN

### PATCH 1: Add CORS Support (CRITICAL)

**Add to Script B after `doGet()` function:**

```javascript
/**
 * Handles OPTIONS requests for CORS preflight
 */
function doOptions(e) {
  return ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
}
```

**Update `doPost()` to return CORS headers:**

```javascript
function doPost(e) {
  // Define CORS headers at the top
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    // ... existing logic
    
    // Add .setHeaders(corsHeaders) to ALL ContentService returns:
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);  // ← ADD THIS
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);  // ← ADD THIS
  }
}
```

---

### PATCH 2: Fix Sheet Name (CRITICAL)

**Option A: Change Script B to use 'V8'**
```javascript
// Line 21 - Change from:
const REPORT_SHEET_NAME = 'Bangkit';

// To:
const REPORT_SHEET_NAME = 'V8';
```

**Option B: Rename production sheet**
- Rename 'V8' tab to 'Bangkit' in production spreadsheet
- Keep Script B as-is

**Recommendation:** Use Option A to maintain backward compatibility.

---

### PATCH 3: Fix Business Category Mapping (CRITICAL)

**Replace the `categoryMap` object in `buildBusinessCategoryContent_()` function:**

```javascript
// UPDATED: Match Script A's comprehensive mapping
const categoryMap = {
  // KONSEP BISNES
  'Konsep Bisnes': 'konsepBisnes',
  'KONSEP BISNES': 'konsepBisnes',
  'Business Idea': 'konsepBisnes',
  'BUSINESS IDEA': 'konsepBisnes',
  'Product Portfolio': 'konsepBisnes',
  'Product Portfolio:': 'konsepBisnes',        // FIX: Add colon variant
  'PRODUCT PORTFOLIO': 'konsepBisnes',
  'Revenue Model': 'konsepBisnes',
  'REVENUE MODEL': 'konsepBisnes',
  'Customer Portfolio': 'konsepBisnes',
  'CUSTOMER PORTFOLIO': 'konsepBisnes',
  'Market Position': 'konsepBisnes',
  'MARKET POSITION': 'konsepBisnes',
  'Value Proposition': 'konsepBisnes',          // Keep this

  // ORGANISASI (NOT operasi!)
  'Organisasi': 'organisasi',
  'ORGANISASI': 'organisasi',
  'Ownership & Board': 'organisasi',            // ADD: Missing in B
  'OWNERSHIP & BOARD': 'organisasi',            // ADD: Missing in B
  'Employees': 'organisasi',
  'EMPLOYEES': 'organisasi',
  'Partnership': 'organisasi',
  'PARTNERSHIP': 'organisasi',
  'Partners & Resources': 'organisasi',         // Keep this
  'Business Process': 'organisasi',             // FIX: Change from operasi
  'BUSINESS PROCESS': 'organisasi',             // FIX: Change from operasi
  'Legal Issue': 'organisasi',
  'LEGAL ISSUE': 'organisasi',
  'Management': 'organisasi',

  // HUBUNGAN PELANGGAN
  'Hubungan Pelanggan': 'hubunganPelanggan',
  'HUBUNGAN PELANGGAN': 'hubunganPelanggan',
  'Networking': 'hubunganPelanggan',            // ADD: Missing in B
  'NETWORKING': 'hubunganPelanggan',            // ADD: Missing in B
  'Marketing': 'hubunganPelanggan',
  'MARKETING': 'hubunganPelanggan',
  'Sale & Service': 'hubunganPelanggan',        // ADD: Missing in B
  'SALE & SERVICE': 'hubunganPelanggan',        // ADD: Missing in B
  'Sales & Service': 'hubunganPelanggan',
  'SALES & SERVICE': 'hubunganPelanggan',
  'Sales': 'hubunganPelanggan',                 // Keep this
  'Communication & PR': 'hubunganPelanggan',    // ADD: Missing in B
  'COMMUNICATION & PR': 'hubunganPelanggan',    // ADD: Missing in B
  'Branding': 'hubunganPelanggan',              // ADD: Missing in B
  'BRANDING': 'hubunganPelanggan',              // ADD: Missing in B
  'Customer Relations': 'hubunganPelanggan',

  // OPERASI
  'Operasi': 'operasi',
  'OPERASI': 'operasi',
  'Financial': 'operasi',
  'FINANCIAL': 'operasi',
  'Funding': 'operasi',
  'FUNDING': 'operasi',
  'Production & Deliveries': 'operasi',         // ADD: Missing in B
  'PRODUCTION & DELIVERIES': 'operasi',         // ADD: Missing in B
  'IT Systems': 'operasi',
  'IT SYSTEMS': 'operasi',
  'Facilities': 'operasi',
  'FACILITIES': 'operasi',
  'Delivery': 'operasi'
};
```

---

### PATCH 4: Verify Template Compatibility (VERIFY)

**Action Required:**

1. **Check new templates contain all placeholders:**
   ```
   Template Sesi 1: 1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI
   Template Sesi 2-4: 1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ
   ```

2. **Verify these placeholders exist:**
   - All common placeholders (same as Script A)
   - All 28 UM placeholders: `{{UM_STATUS_PENGLIBATAN}}`, `{{UM_AKAUN_BIMB}}`, etc.
   - Business category placeholders: `{{Konsep_Bisnes_Focus}}`, etc.

3. **If templates are incompatible, revert to Script A templates:**
   ```javascript
   const TEMPLATE_ID_SESI_1 = '1oeh89mGEiN4DZ6CdP6Rtuo8btNf5FQl3sndHgmGlcEg';
   const TEMPLATE_ID_SESI_2_4 = '18iHXbHPen7HkWSL5DtiyGfNz7BpeMhwVp0iKxAYgcI8';
   ```

---

### PATCH 5: Optional - Disable UM Processing (If Not Needed)

**If production doesn't need Upward Mobility tracking:**

Comment out in `processRowByIndex_()` around line 350:

```javascript
// Step 8: Upward Mobility replacements (NEW)
// DISABLED: Not required for production yet
/*
console.log('Step 8: Performing Upward Mobility replacements...');
replaceUpwardMobilityPlaceholders_(body, row);
console.log('UM replacements completed');
*/
```

---

## ✅ 8. Pre-Deployment Testing Checklist

### Environment Setup
- [ ] Deploy Script B to **STAGING** Apps Script project first
- [ ] Use test spreadsheet with 'Bangkit' or 'V8' sheet (matching config)
- [ ] Ensure test sheet has 82 columns (or 52 if UM disabled)
- [ ] Verify service account has access to template documents

### Functional Tests

#### CORS Test
```bash
curl -X OPTIONS https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```
- [ ] Response is 200 OK
- [ ] Response contains `Access-Control-Allow-Origin: *` header

#### Sheet Access Test
- [ ] Run `testProcessSingleRow(2)` in Apps Script editor
- [ ] No "Sheet not found" errors
- [ ] Correct sheet opened

#### Category Mapping Test
- [ ] Create test row with "Business Process" as focus area
- [ ] Process row
- [ ] Verify document shows "Organisasi" section (not "Operasi")

#### Template Test
- [ ] Process Sesi 1 row → check document format
- [ ] Process Sesi 2 row → check document format
- [ ] Verify all placeholders replaced (no {{...}} remaining)
- [ ] Check UM fields filled correctly (or empty if disabled)

#### End-to-End Test
- [ ] Frontend sends POST request with `action: "processRow"`
- [ ] Document generated successfully
- [ ] Sheet updated with DOC_URL and Status = "DONE"
- [ ] Document accessible and properly formatted

### Rollback Plan
- [ ] Keep Script A code backup
- [ ] Document current production Apps Script deployment URL
- [ ] Test rollback procedure in staging
- [ ] Define rollback trigger criteria

---

## 📋 9. Deployment Procedure

### Step 1: Apply Patches
1. Apply PATCH 1 (CORS) to Script B
2. Apply PATCH 2 (Sheet name)
3. Apply PATCH 3 (Category mapping)
4. Apply PATCH 4 or 5 based on requirements

### Step 2: Staging Deployment
1. Create new Apps Script project: "mentor-report-staging"
2. Copy patched Script B code
3. Deploy as web app:
   - Execute as: Me
   - Who has access: Anyone
4. Update frontend `.env` to use staging URL
5. Run all tests from checklist

### Step 3: Production Deployment (After Staging Validation)
1. Backup current production script
2. Update production Apps Script with patched Script B
3. Create new deployment version
4. Update frontend `.env` to production URL
5. Monitor first 5-10 document generations
6. Verify no errors in Apps Script logs

### Step 4: Post-Deployment Validation
- [ ] Process 3-5 test rows
- [ ] Compare output documents with Script A output
- [ ] Check Upward Mobility data populated correctly
- [ ] Verify no CORS errors in browser console
- [ ] Check execution logs for errors

---

## 🔍 10. Key Differences Summary Table

| Feature | Script A (Production) | Script B (Target) | Compatibility |
|---------|----------------------|-------------------|---------------|
| **CORS Support** | ✅ Full (doOptions + headers) | ❌ Missing | 🔴 BREAKS |
| **Sheet Name** | V8 | Bangkit | 🔴 BREAKS |
| **Columns** | 52 (A-BB) | 82 (A-CD) | 🟡 EXTENDS |
| **UM Tracking** | None | 28 fields | 🟢 NEW FEATURE |
| **Template Sesi 1** | 1oeh89m... | 1L5dnhq... | ⚠️ DIFFERENT |
| **Template Sesi 2-4** | 18iHXbH... | 1JsSwCJ... | ⚠️ DIFFERENT |
| **Business Process** | → organisasi | → operasi | 🔴 CONFLICT |
| **Focus Variants** | More (with colons) | Fewer | 🟡 REDUCED |
| **Error Handling** | Same | Same | 🟢 COMPATIBLE |
| **Lock Mechanism** | Same | Same | 🟢 COMPATIBLE |
| **Image Insertion** | Same | Same | 🟢 COMPATIBLE |

---

## 💡 11. Recommendations

### Priority 1: CRITICAL (Must Fix Before Production)
1. ✅ **Add CORS support** (Patch 1)
2. ✅ **Fix sheet name** (Patch 2)
3. ✅ **Fix business category mapping** (Patch 3)

### Priority 2: VERIFY (Confirm Before Production)
1. ✅ **Verify template compatibility** (Patch 4)
2. ✅ **Decide on UM tracking** (enable/disable via Patch 5)
3. ✅ **Test with staging environment**

### Priority 3: NICE TO HAVE (Future Improvements)
1. Add explicit error alerts for image/footer failures
2. Add placeholder validation to catch missing {{...}} tags
3. Add detailed logging for UM field population
4. Create automated test suite for category mapping

---

## 📞 12. Contacts & Resources

**Script Files:**
- Production (A): `appsscript-1\Code.js`
- Target (B): `appscript-5\Code.js`

**Spreadsheet:**
- ID: `1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w`
- Production sheet: `V8`
- Target sheet: `Bangkit` (or rename to V8)

**Templates:**
- Production Sesi 1: `1oeh89mGEiN4DZ6CdP6Rtuo8btNf5FQl3sndHgmGlcEg`
- Production Sesi 2-4: `18iHXbHPen7HkWSL5DtiyGfNz7BpeMhwVp0iKxAYgcI8`
- Target Sesi 1: `1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI`
- Target Sesi 2-4: `1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ`

---

## 📝 13. Change Log

**Script B Major Changes:**
- ➕ Added 28 Upward Mobility tracking fields
- ➕ Added `replaceUpwardMobilityPlaceholders_()` function
- ➕ Added `Mentee_Folder_ID` column support
- 🔄 Changed sheet name from 'V8' to 'Bangkit'
- 🔄 Changed template IDs to new versions
- 🔄 Renamed `openV8_()` to `openBangkitSheet_()`
- ⚠️ Reduced business category mapping variants
- ❌ Missing CORS headers in doPost
- ❌ Missing doOptions() function

---

**END OF COMPARISON REPORT**
