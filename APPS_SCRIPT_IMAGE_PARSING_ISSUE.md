# Apps Script Image Parsing Issue - Root Cause Found
**Date:** October 25, 2025
**Script:** `appsscript-1/Code.js` (Laporan Sesi)
**Issue:** Wonky images in generated documents

---

## 🔴 **ROOT CAUSE IDENTIFIED**

### **Line 1908 in Code.js:**

```javascript
function insertImageAt_(body, marker, urls) {
  if (!urls) {
    replaceAll_(body, marker, '');
    return;
  }
  const list = String(urls).split(',').map(s => s.trim()).filter(Boolean);  // ← PROBLEM HERE!
  // ... rest of image insertion code
}
```

---

## ⚠️ **The Problem:**

The Apps Script is using **`.split(',')`** to parse image URLs, which ONLY works if:
1. ✅ URLs are stored as comma-separated strings: `"url1, url2, url3"`
2. ❌ URLs don't contain commas themselves (not always true!)

**BUT** this is fragile because:
- Google Drive URLs can have query parameters with commas
- Inconsistent spacing (`, ` vs `,`)
- Edge cases with empty strings

---

## 📊 **Flow Analysis:**

### **Current Flow (Laporan Sesi):**

```
Frontend (laporan-sesi.js)
↓
Sends: imageUrls.sesi = ["url1", "url2", "url3"]  // Array
↓
submitReport.js (line 56-58)
↓
Stores: row[36] = data.imageUrls.sesi.join(', ')  // "url1, url2, url3" (string)
↓
Google Sheet
↓
Column AK (Link Gambar): "url1, url2, url3"
↓
Apps Script Code.js (line 1908)
↓
Parses: urls.split(',')  // ["url1", " url2", " url3"]
↓
Document Generation
↓
Result: ⚠️ WONKY if URLs contain commas or spacing is inconsistent
```

### **Better Flow (Like Laporan Maju):**

```
Frontend (laporan-maju.js)
↓
Sends: URL_GAMBAR_SESI_JSON = ["url1", "url2", "url3"]  // Array
↓
submitMajuReport.js (line 273)
↓
Stores: row[273] = JSON.stringify(data.URL_GAMBAR_SESI_JSON)  // '["url1","url2","url3"]' (JSON string)
↓
Google Sheet
↓
Column: '["url1","url2","url3"]'
↓
Apps Script
↓
Parses: JSON.parse(urlsJson)  // ["url1", "url2", "url3"] (perfect array!)
↓
Document Generation
↓
Result: ✅ PERFECT - each URL intact
```

---

## 🔧 **Solution Options:**

### **Option 1: Update Apps Script to Handle Both Formats (Backwards Compatible)**

**Modify `insertImageAt_` function (line 1903):**

```javascript
function insertImageAt_(body, marker, urls) {
  if (!urls) {
    replaceAll_(body, marker, '');
    return;
  }

  let list = [];

  // Try JSON parsing first (new format from Laporan Maju / updated Laporan Sesi)
  try {
    const parsed = JSON.parse(String(urls));
    if (Array.isArray(parsed)) {
      list = parsed.map(s => String(s).trim()).filter(Boolean);
    } else {
      throw new Error('Not an array');
    }
  } catch (jsonError) {
    // Fallback to comma-splitting (legacy format)
    list = String(urls).split(',').map(s => s.trim()).filter(Boolean);
  }

  const range = body.findText(marker);
  if (!range) return;

  // ... rest of the function remains the same
}
```

**Benefits:**
- ✅ Backwards compatible with old comma-separated data
- ✅ Works with new JSON array format
- ✅ Graceful degradation
- ✅ No data migration needed

---

### **Option 2: Update submitReport.js to Use JSON Arrays (Like Maju)**

**In `submitReport.js`, change lines 56-58 and 82-84:**

```javascript
// BEFORE:
row[36] = Array.isArray(data?.imageUrls?.sesi)
  ? data.imageUrls.sesi.join(', ')  // ❌ Comma-separated
  : (data?.imageUrls?.sesi || '');

// AFTER:
row[36] = JSON.stringify(data?.imageUrls?.sesi || []);  // ✅ JSON array

// BEFORE:
row[50] = Array.isArray(data?.imageUrls?.premis)
  ? data.imageUrls.premis.join(', ')  // ❌ Comma-separated
  : (data?.imageUrls?.premis || '');

// AFTER:
row[50] = JSON.stringify(data?.imageUrls?.premis || []);  // ✅ JSON array
```

**Then update Apps Script to parse JSON (or use Option 1 for compatibility)**

**Benefits:**
- ✅ Consistent with Laporan Maju
- ✅ Reliable parsing
- ✅ Future-proof
- ⚠️ Requires Apps Script update (but Option 1 handles this)

---

## 🎯 **Recommended Approach:**

### **Implement BOTH Options:**

1. **First: Update Apps Script** (Option 1)
   - Makes it compatible with BOTH formats
   - No breaking changes
   - Deploy immediately

2. **Then: Update submitReport.js** (Option 2)
   - New submissions use JSON arrays
   - Old data still works (thanks to Option 1)
   - Gradual migration

3. **Result:**
   - ✅ Old documents with comma-separated URLs still work
   - ✅ New documents use JSON arrays (more reliable)
   - ✅ No data loss
   - ✅ Better image quality going forward

---

## 📋 **Implementation Steps:**

### **Step 1: Update Apps Script (Priority: High)**

```javascript
// File: appsscript-1/Code.js
// Function: insertImageAt_ (line 1903)

function insertImageAt_(body, marker, urls) {
  if (!urls) {
    replaceAll_(body, marker, '');
    return;
  }

  let list = [];

  // Try JSON parsing first (new format)
  try {
    const parsed = JSON.parse(String(urls));
    if (Array.isArray(parsed)) {
      console.log(`Parsed ${parsed.length} URLs from JSON array`);
      list = parsed.map(s => String(s).trim()).filter(Boolean);
    } else {
      throw new Error('Not an array');
    }
  } catch (jsonError) {
    // Fallback to comma-splitting (legacy format)
    console.log('Using legacy comma-split format');
    list = String(urls).split(',').map(s => s.trim()).filter(Boolean);
  }

  console.log(`Inserting ${list.length} images for marker "${marker}"`);

  const range = body.findText(marker);
  if (!range) return;

  const el = range.getElement();
  el.asText().replaceText(marker, '');
  let par = el.getParent().asParagraph();

  const cell = findAncestorTableCell_(par);
  const inCell = !!cell;

  const MAX_BODY_WIDTH = 450,
    MAX_CELL_WIDTH = 220,
    COLS_PER_ROW = 2;

  if (inCell) {
    par.clear();
    let inRow = 0;
    list.forEach((u, i) => {
      try {
        const id = extractDriveId_(u);
        const blob = id ? DriveApp.getFileById(id).getBlob() : UrlFetchApp.fetch(u).getBlob();
        if (inRow === 0 && i > 0) par = cell.appendParagraph('');
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_CELL_WIDTH);
        inRow++;
        if (inRow < COLS_PER_ROW) par.appendText('  ');
        if (inRow === COLS_PER_ROW) inRow = 0;
      } catch (e) {
        console.error(`Failed to insert image ${i}: ${e.toString()}`);
        par.appendText(` [[Image not available: ${u}]] `);
      }
    });
  } else {
    list.forEach((u, i) => {
      try {
        const id = extractDriveId_(u);
        const blob = id ? DriveApp.getFileById(id).getBlob() : UrlFetchApp.fetch(u).getBlob();
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_BODY_WIDTH);
        if (i < list.length - 1) par.appendText(' ');
      } catch (e) {
        console.error(`Failed to insert image ${i}: ${e.toString()}`);
        par.appendText(` [[Image not available: ${u}]] `);
      }
    });
  }
}
```

### **Step 2: Update submitReport.js (Priority: Medium)**

```javascript
// File: pages/api/submitReport.js
// Lines: 56-58, 82-84

// Change from:
row[36] = Array.isArray(data?.imageUrls?.sesi)
  ? data.imageUrls.sesi.join(', ')
  : (data?.imageUrls?.sesi || '');

// To:
row[36] = JSON.stringify(data?.imageUrls?.sesi || []);

// Change from:
row[50] = Array.isArray(data?.imageUrls?.premis)
  ? data.imageUrls.premis.join(', ')
  : (data?.imageUrls?.premis || '');

// To:
row[50] = JSON.stringify(data?.imageUrls?.premis || []);
```

### **Step 3: Test**

1. **Test Apps Script Update:**
   - Create test row with comma-separated URLs (old format)
   - Trigger Apps Script → should still work ✅
   - Create test row with JSON array URLs (new format)
   - Trigger Apps Script → should work ✅

2. **Test Full Flow:**
   - Submit Laporan Sesi with multiple images
   - Check Google Sheet: should see JSON array
   - Trigger document generation
   - Verify all images appear correctly

3. **Test Edge Cases:**
   - Single image (no array)
   - No images (empty array)
   - Many images (6-10 images)

---

## 📊 **Before vs After:**

### **Before (Current):**

| Aspect | Status |
|--------|--------|
| Image URL Format | Comma-separated string |
| Parsing Method | `.split(',')` |
| Reliability | ⚠️ Fragile |
| URL Integrity | ❌ Can break if URL has comma |
| Image Quality | ⚠️ Wonky |
| Backwards Compatible | N/A (current version) |

### **After (With Both Updates):**

| Aspect | Status |
|--------|--------|
| Image URL Format | JSON array (preferred) |
| Parsing Method | `JSON.parse()` with fallback |
| Reliability | ✅ Rock solid |
| URL Integrity | ✅ Always intact |
| Image Quality | ✅ Perfect |
| Backwards Compatible | ✅ Yes (handles both formats) |

---

## 🚀 **Deployment Plan:**

### **Phase 1: Apps Script Update (Immediate)**
1. Update `insertImageAt_` function in Apps Script
2. Deploy to production
3. Test with existing comma-separated data
4. Test with new JSON array data
5. Monitor for 24 hours

### **Phase 2: Frontend Update (After Phase 1 Confirmed Working)**
1. Update `submitReport.js` to use JSON arrays
2. Commit and push to GitHub
3. Vercel auto-deploys
4. Test new submissions
5. Verify document generation

### **Phase 3: Monitoring (Ongoing)**
1. Check generated documents for image quality
2. Compare old vs new documents
3. Verify no regression in existing documents
4. Collect user feedback

---

## ✅ **Success Criteria:**

- ✅ All images appear in correct positions
- ✅ No missing images
- ✅ No broken URL fragments
- ✅ Correct image sizing
- ✅ Old documents still work
- ✅ New documents have better image quality
- ✅ No user complaints about "wonky images"

---

**Analysis Complete**
**Next Action:** Update Apps Script `insertImageAt_` function with JSON parsing support
