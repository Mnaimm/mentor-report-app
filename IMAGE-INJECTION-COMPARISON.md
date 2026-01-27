# Image Injection Pipeline: Script A vs Script B

**Analysis Date:** January 24, 2026  
**Focus:** Image insertion logic ONLY

---

## 1. SOURCE OF IMAGE DATA

### Script A (appsscript-1)
**Column Headers:**
```javascript
LinkGambar: 'Link Gambar',              // Column AK (36)
LinkCartaGW: 'Link_Carta_GrowthWheel',  // Column AN (39)
LinkGambarProfil: 'Link_Gambar_Profil', // Column AX (49)
LinkGambarPremis: 'Link_Gambar_Premis'  // Column AY (50)
```

**Cell Format Expectations:**
- JSON array: `["https://...", "https://..."]`
- Comma-separated: `https://..., https://...`
- Single URL: `https://...`

**Code:**
```javascript
// Reads from row data
row[H.LinkGambar]        // Current session image
row[H.LinkCartaGW]       // GrowthWheel chart
row[H.LinkGambarProfil]  // Profile photo
row[H.LinkGambarPremis]  // Premises photo
```

### Script B (appscript-5)
**Column Headers:**
```javascript
LinkGambar: 'Link Gambar',              // Column AK (36) - SAME
LinkCartaGW: 'Link_Carta_GrowthWheel',  // Column AN (39) - SAME
LinkGambarProfil: 'Link_Gambar_Profil', // Column AX (49) - SAME
LinkGambarPremis: 'Link_Gambar_Premis'  // Column AY (50) - SAME
```

**Cell Format Expectations:**
- JSON array: `["https://...", "https://..."]` (preferred)
- Single URL: `https://...`
- **NO comma-separated support** ⚠️

**Code:**
```javascript
// Identical to Script A
row[H.LinkGambar]
row[H.LinkCartaGW]
row[H.LinkGambarProfil]
row[H.LinkGambarPremis]
```

### ⚠️ DIFFERENCE #1: Cell Format Parsing

| Format | Script A | Script B |
|--------|----------|----------|
| JSON Array `["url1", "url2"]` | ✅ Supported | ✅ Supported |
| Comma-separated `url1, url2` | ✅ Supported (fallback) | ❌ NOT supported |
| Single URL `url` | ✅ Supported | ✅ Supported |

**Impact:** If sheet contains comma-separated URLs, Script B will treat entire string as ONE URL → will fail.

---

## 2. URL → FILE ID EXTRACTION

### Script A: `extractDriveId_(url)`

**Function Code:**
```javascript
function extractDriveId_(url) {
  if (!url) return '';
  
  // Pattern 1: /file/d/FILE_ID/...
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})\b/);
  if (m1) return m1[1];
  
  // Pattern 2: ?id=FILE_ID or ?fileId=FILE_ID
  const m2 = url.match(/[?&](?:id|fileId)=([a-zA-Z0-9_-]{20,})\b/);
  if (m2) return m2[1];
  
  // Pattern 3: Direct file ID (20+ chars, no slashes)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  
  // Pattern 4: open?id= or uc?id=
  const m3 = url.match(/(?:open|uc)\?id=([a-zA-Z0-9_-]{20,})\b/);
  if (m3) return m3[1];
  
  return '';
}
```

**Supported URL Formats:**
1. ✅ `https://drive.google.com/file/d/1ABC123xyz/view`
2. ✅ `https://drive.google.com/open?id=1ABC123xyz`
3. ✅ `https://drive.google.com/uc?id=1ABC123xyz`
4. ✅ `1ABC123xyz` (bare ID)
5. ✅ `https://drive.google.com/file/d/1ABC123xyz?usp=sharing`

**Return Value:** Empty string `''` if no match

---

### Script B: `extractDriveFileId_(url)`

**Function Code:**
```javascript
function extractDriveFileId_(url) {
  if (!url) return null;

  // Pattern 1: /file/d/FILE_ID/...
  let match = url.match(/\/file\/d\/([^\/\?]+)/);
  if (match) return match[1];

  // Pattern 2: ?id=FILE_ID
  match = url.match(/[?&]id=([^&]+)/);
  if (match) return match[1];

  // Pattern 3: uc?id=FILE_ID
  match = url.match(/uc\?id=([^&]+)/);
  if (match) return match[1];

  // Pattern 4: Direct file ID (no slashes/http)
  if (!url.includes('/') && !url.includes('http')) {
    return url;
  }

  return null;
}
```

**Supported URL Formats:**
1. ✅ `https://drive.google.com/file/d/1ABC123xyz/view`
2. ✅ `https://drive.google.com/open?id=1ABC123xyz`
3. ✅ `https://drive.google.com/uc?id=1ABC123xyz`
4. ✅ `1ABC123xyz` (bare ID)
5. ✅ `https://drive.google.com/file/d/1ABC123xyz?usp=sharing`

**Return Value:** `null` if no match

---

### ⚠️ DIFFERENCE #2: Regex Patterns

| Aspect | Script A | Script B |
|--------|----------|----------|
| File ID min length | `{20,}` (20+ chars) | `[^\/\?]+` (any non-slash/question) |
| Character validation | `[a-zA-Z0-9_-]{20,}` | `[^&]+` (any non-ampersand) |
| Return on failure | `''` (empty string) | `null` |
| Pattern for ?id= | `(?:id\|fileId)` | Only `id` |

**Script A is MORE strict:**
- Requires 20+ character IDs
- Validates allowed characters
- Checks for `fileId=` parameter variant

**Script B is MORE permissive:**
- Accepts any length ID
- No character validation
- Could capture invalid IDs

### 🔍 POTENTIAL BUG in Script B:
```
URL: "https://drive.google.com/file/d/invalid!@#$/view"
Script A: Returns '' (rejects due to invalid chars)
Script B: Returns 'invalid!@#$' (no validation!)
```

**Impact:** Script B may attempt to fetch invalid file IDs → will fail at Drive access.

---

## 3. DRIVE ACCESS

### Script A

**Access Method:**
```javascript
const id = extractDriveId_(u);
const blob = id 
  ? DriveApp.getFileById(id).getBlob()  // Drive file
  : UrlFetchApp.fetch(u).getBlob();     // Direct URL
```

**Fallback Logic:**
- If `extractDriveId_()` returns file ID → use `DriveApp`
- If extraction fails (returns `''`) → treat as direct URL, use `UrlFetchApp`

**Error Handling:**
```javascript
try {
  const blob = ...;
  const img = par.appendInlineImage(blob);
  clampImageWidth_(img, MAX_CELL_WIDTH);
} catch (e) {
  par.appendText(` [[Image not available: ${u}]] `);
}
```

**Failure Behavior:** Non-fatal → inserts error text into document

---

### Script B

**Access Method:**
```javascript
const fileId = extractDriveFileId_(url);
if (fileId) {
  console.log(`Getting Drive file: ${fileId}`);
  const file = DriveApp.getFileById(fileId);
  blob = file.getBlob();
} else {
  console.log(`Fetching image from URL: ${url}`);
  const response = UrlFetchApp.fetch(url);
  blob = response.getBlob();
}
```

**Fallback Logic:**
- If `extractDriveFileId_()` returns file ID → use `DriveApp`
- If extraction fails (returns `null`) → treat as direct URL

**Error Handling:**
```javascript
try {
  let blob;
  // ... access logic
  const image = parent.insertInlineImage(childIndex + insertedCount, blob);
  image.setWidth(400);
  insertedCount++;
  console.log(`Image ${i + 1} inserted successfully`);
} catch (e) {
  console.error(`Failed to insert image ${i + 1} from ${url}:`, e.toString());
  // NO ERROR TEXT INSERTED - just logs and continues
}
```

**Failure Behavior:** Non-fatal → logs error but does NOT insert error text

### ⚠️ DIFFERENCE #3: Error Visibility

| Aspect | Script A | Script B |
|--------|----------|----------|
| On image failure | Inserts `[[Image not available: URL]]` | Silently skips image |
| User notification | ✅ Visible in document | ❌ Hidden (logs only) |
| Debugging | Document shows which images failed | Must check logs |

**Impact:** Script A provides BETTER user feedback about missing images.

---

## 4. IMAGE INSERTION METHOD

### Script A: `insertImageAt_(body, marker, urls)`

**Document Location Detection:**
```javascript
const range = body.findText(marker);
if (!range) return;

const el = range.getElement();
el.asText().replaceText(marker, '');
let par = el.getParent().asParagraph();

// CRITICAL: Detect if placeholder is inside a table cell
const cell = findAncestorTableCell_(par);
const inCell = !!cell;
```

**Helper Function:**
```javascript
function findAncestorTableCell_(el) {
  let cur = el;
  while (cur) {
    if (cur.getType && cur.getType() === DocumentApp.ElementType.TABLE_CELL) 
      return cur.asTableCell();
    if (!cur.getParent) break;
    cur = cur.getParent();
  }
  return null;
}
```

**Two Insertion Modes:**

#### Mode 1: Inside Table Cell (inCell = true)
```javascript
const MAX_CELL_WIDTH = 220;
const COLS_PER_ROW = 2;

par.clear();  // Clear paragraph first
let inRow = 0;

list.forEach((u, i) => {
  try {
    // Create new paragraph for each row of images
    if (inRow === 0 && i > 0) par = cell.appendParagraph('');
    
    const img = par.appendInlineImage(blob);
    clampImageWidth_(img, MAX_CELL_WIDTH);
    
    inRow++;
    if (inRow < COLS_PER_ROW) par.appendText('  ');  // 2-space separator
    if (inRow === COLS_PER_ROW) inRow = 0;            // Reset for new row
  } catch (e) {
    par.appendText(` [[Image not available: ${u}]] `);
  }
});
```

**Cell Layout:** 2-column grid
```
[Image1]  [Image2]
[Image3]  [Image4]
[Image5]  ...
```

#### Mode 2: Normal Document Body (inCell = false)
```javascript
const MAX_BODY_WIDTH = 450;

list.forEach((u, i) => {
  try {
    const img = par.appendInlineImage(blob);
    clampImageWidth_(img, MAX_BODY_WIDTH);
    if (i < list.length - 1) par.appendText(' ');  // Single space between
  } catch (e) {
    par.appendText(` [[Image not available: ${u}]] `);
  }
});
```

**Body Layout:** Horizontal inline
```
[Image1] [Image2] [Image3] ...
```

**Sizing Function:**
```javascript
function clampImageWidth_(img, maxWidth) {
  try {
    const originalWidth = img.getWidth();
    const originalHeight = img.getHeight();
    if (originalWidth > maxWidth) {
      const newHeight = (originalHeight * maxWidth) / originalWidth;
      img.setWidth(maxWidth).setHeight(newHeight);
    }
  } catch (e) {
    console.log('Error clamping image width: ' + e.message);
  }
}
```

**Sizing Behavior:**
- Images larger than maxWidth → resized proportionally
- Images smaller than maxWidth → kept at original size
- Maintains aspect ratio

---

### Script B: `insertImageAt_(body, placeholder, imageUrl)`

**Document Location Detection:**
```javascript
const searchResult = body.findText(escapeRegExp_(placeholder));
if (!searchResult) {
  console.log(`Placeholder "${placeholder}" not found in document`);
  return;
}

const element = searchResult.getElement();
const parent = element.getParent();
const childIndex = parent.getChildIndex(element);
```

**NO table cell detection** ❌

**Single Insertion Mode:**
```javascript
let insertedCount = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i].trim();

  try {
    let blob;
    // ... get blob
    
    // Insert image at specific child index
    const image = parent.insertInlineImage(childIndex + insertedCount, blob);
    image.setWidth(400);
    insertedCount++;
    console.log(`Image ${i + 1} inserted successfully`);

  } catch (e) {
    console.error(`Failed to insert image ${i + 1} from ${url}:`, e.toString());
  }
}

// Remove placeholder text after all images inserted
if (insertedCount > 0) {
  element.asText().setText('');
} else {
  body.replaceText(escapeRegExp_(placeholder), '');
}
```

**Layout:** Images inserted at precise child index position
```
[placeholder location]
↓
[Image1][Image2][Image3]... (no spacing between)
```

**Sizing Behavior:**
- ALL images set to fixed 400px width
- NO height adjustment
- NO aspect ratio preservation
- NO conditional sizing based on location

---

### ⚠️ DIFFERENCE #4: Insertion Strategy

| Feature | Script A | Script B |
|---------|----------|----------|
| **Table cell detection** | ✅ Yes - walks parent tree | ❌ No detection |
| **Layout adaptation** | ✅ Grid in cells, inline in body | ❌ Same layout everywhere |
| **Image spacing** | ✅ 2 spaces in cells, 1 in body | ❌ No spacing |
| **Insertion method** | `appendInlineImage()` | `insertInlineImage(index)` |
| **Width sizing** | 220px (cell) / 450px (body) | 400px (always) |
| **Aspect ratio** | ✅ Preserved | ❌ Not preserved |
| **Conditional resize** | ✅ Only if > maxWidth | ❌ Always 400px |
| **Error text** | ✅ Inserts `[[Image not available]]` | ❌ Silent failure |
| **Multi-row grid** | ✅ In cells (2 cols) | ❌ No grid |

---

### ⚠️ DIFFERENCE #5: Image Sizing Comparison

**Scenario: Original image is 800x600px**

| Script | Location | Width | Height | Method |
|--------|----------|-------|--------|--------|
| **A** | Body | 450px | 338px | Proportional resize |
| **A** | Table cell | 220px | 165px | Proportional resize |
| **B** | Body | 400px | 600px | Fixed width, original height |
| **B** | Table cell | 400px | 600px | Fixed width, original height |

**Script B DISTORTS images** if they're not already 400px wide!

---

## 5. INSERTION ORDER

### Script A: Processing Steps in `processRowByIndex_()`

```
1. Common text replacements (Step 7)
2. Footer replacement (Step 8)
3. Session-specific content (Step 9a or 9b)
   ├─ Business categories
   ├─ Rumusan Sesi
   ├─ Session history (Sesi 2+)
   └─ SESSION IMAGES (9a.3 or 9b.5) ← Images inserted HERE
4. Additional images (Step 10) ← More images HERE
5. Save document (Step 11)
6. Update sheet (Step 12)
```

**Sesi 1 Image Insertion (Step 9a.3):**
```javascript
insertImageAt_(body, `{{Gambar Sesi ${sesiNum}}}`, row[H.LinkGambar]);
```

**Sesi 2-4 Image Insertion (Step 9b.5):**
```javascript
for (let completedSesi = 1; completedSesi <= sesiNum; completedSesi++) {
  if (completedSesi === sesiNum) {
    // Current session image
    insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, row[H.LinkGambar]);
  } else {
    // Previous session images
    const previousImages = getSessionImagesForPreviousSession_(mentee, completedSesi);
    insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, previousImages);
  }
}
```

**Additional Images (Step 10):**
```javascript
insertImageAt_(body, '{{Link_Carta_GrowthWheel}}', row[H.LinkCartaGW]);
insertImageAt_(body, '{{Link_Gambar_Profil}}', row[H.LinkGambarProfil]);
insertImageAt_(body, '{{Link Gambar}}', row[H.LinkGambar]);
insertImageAt_(body, '{{Link_Gambar_Premis}}', row[H.LinkGambarPremis]);
```

---

### Script B: Processing Steps in `processRowByIndex_()`

```
1. Common text replacements (Step 7)
2. Upward Mobility replacements (Step 8) ← NEW
3. Session-specific content (Step 9 via separate functions)
   ├─ processSesi1Content_() OR processSesi2PlusContent_()
   └─ SESSION IMAGES inserted INSIDE these functions
4. Footer replacement (Step 10)
5. Additional images (Step 11) ← Images HERE
6. Save document (Step 12)
7. Update sheet (Step 13)
```

**Sesi 1 Image Insertion (inside `processSesi1Content_()`):**
```javascript
insertImageAt_(body, `{{Gambar Sesi ${sesiNum}}}`, row[H.LinkGambar]);
```

**Sesi 2+ Image Insertion (inside `processSesi2PlusContent_()`):**
```javascript
for (let completedSesi = 1; completedSesi <= sesiNum; completedSesi++) {
  if (completedSesi === sesiNum) {
    insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, row[H.LinkGambar]);
  } else {
    const previousImages = getSessionImagesForPreviousSession_(mentee, completedSesi);
    insertImageAt_(body, `{{Gambar Sesi ${completedSesi}}}`, previousImages);
  }
}
```

**Additional Images (Step 11):**
```javascript
insertImageAt_(body, '{{Link_Carta_GrowthWheel}}', row[H.LinkCartaGW]);
insertImageAt_(body, '{{Link_Gambar_Profil}}', row[H.LinkGambarProfil]);
insertImageAt_(body, '{{Link Gambar}}', row[H.LinkGambar]);
insertImageAt_(body, '{{Link_Gambar_Premis}}', row[H.LinkGambarPremis]);
```

---

### ⚠️ DIFFERENCE #6: Execution Order

| Event | Script A | Script B |
|-------|----------|----------|
| Footer fill | BEFORE images | AFTER images |
| UM placeholders | N/A | BEFORE images |
| Session images | Step 9 (unified) | Inside separate functions |
| Additional images | Step 10 | Step 11 |

**Impact:** If footer or UM placeholders affect image positioning, order matters.

---

## 6. FAILURE BEHAVIOR

### Script A: Error Handling

**Per-Image Try-Catch:**
```javascript
try {
  const id = extractDriveId_(u);
  const blob = id ? DriveApp.getFileById(id).getBlob() : UrlFetchApp.fetch(u).getBlob();
  const img = par.appendInlineImage(blob);
  clampImageWidth_(img, MAX_CELL_WIDTH);
} catch (e) {
  // ERROR VISIBLE TO USER
  par.appendText(` [[Image not available: ${u}]] `);
}
```

**Overall Try-Catch:**
```javascript
try {
  console.log('9a.3: Inserting main image...');
  insertImageAt_(body, `{{Gambar Sesi ${sesiNum}}}`, row[H.LinkGambar]);
  console.log('Main image inserted');
} catch (imageError) {
  console.error('Main image error (non-fatal):', imageError.toString());
}
```

**Failure Scenarios:**

| Failure Type | Behavior | User Impact |
|--------------|----------|-------------|
| Invalid URL | Inserts error text in doc | ✅ User sees problem |
| Drive access denied | Inserts error text in doc | ✅ User sees problem |
| Blob creation fails | Inserts error text in doc | ✅ User sees problem |
| Placeholder not found | Silent (returns early) | ⚠️ No indication |
| Image resize error | Logs error, continues | ⚠️ Image may be inserted but unsized |

**Document continues processing** - not fatal to overall generation.

---

### Script B: Error Handling

**Per-Image Try-Catch:**
```javascript
try {
  let blob;
  const fileId = extractDriveFileId_(url);
  if (fileId) {
    const file = DriveApp.getFileById(fileId);
    blob = file.getBlob();
  } else {
    const response = UrlFetchApp.fetch(url);
    blob = response.getBlob();
  }
  const image = parent.insertInlineImage(childIndex + insertedCount, blob);
  image.setWidth(400);
  insertedCount++;
  console.log(`Image ${i + 1} inserted successfully`);
} catch (e) {
  // ERROR HIDDEN FROM USER
  console.error(`Failed to insert image ${i + 1} from ${url}:`, e.toString());
}
```

**Overall Try-Catch:**
```javascript
try {
  console.log('Inserting main image for Sesi 1...');
  insertImageAt_(body, `{{Gambar Sesi ${sesiNum}}}`, row[H.LinkGambar]);
} catch (err) {
  console.error('Image error (non-fatal):', err.toString());
}
```

**Outer Try-Catch:**
```javascript
try {
  // ... image insertion code
} catch (err) {
  console.error('Image insertion error:', err.toString());
  body.replaceText(escapeRegExp_(placeholder), '');
}
```

**Failure Scenarios:**

| Failure Type | Behavior | User Impact |
|--------------|----------|-------------|
| Invalid URL | Logs error, skips image | ❌ User doesn't know image failed |
| Drive access denied | Logs error, skips image | ❌ Silent failure |
| Blob creation fails | Logs error, skips image | ❌ Silent failure |
| Placeholder not found | Logs message, returns | ❌ No indication in doc |
| Image resize error | (N/A - fixed width) | N/A |
| All images fail | Removes placeholder only | ❌ Blank space, no error text |

**Document continues processing** - not fatal to overall generation.

---

### ⚠️ DIFFERENCE #7: User Feedback

| Aspect | Script A | Script B |
|--------|----------|----------|
| **Failed image visibility** | ✅ Shows `[[Image not available: URL]]` | ❌ Silent skip |
| **Debugging** | Easy - check document | Hard - must check logs |
| **User experience** | User knows something failed | User sees blank space |
| **Actionable feedback** | URL shown in error text | No feedback |

**Script A is SIGNIFICANTLY BETTER for troubleshooting.**

---

## 7. CRITICAL DIFFERENCES SUMMARY

### Functional Differences

| # | Aspect | Script A | Script B | Impact |
|---|--------|----------|----------|--------|
| 1 | **URL Format** | JSON + comma-separated | JSON only | 🔴 Data loss if comma-separated |
| 2 | **File ID Regex** | Strict validation | Permissive | 🟡 Script B may accept invalid IDs |
| 3 | **Error Visibility** | Inserts error text | Silent skip | 🔴 Script B hides failures |
| 4 | **Table Detection** | ✅ Detects cells | ❌ No detection | 🔴 Different layouts |
| 5 | **Grid Layout** | ✅ 2-col grid in cells | ❌ No grid | 🔴 Different appearance |
| 6 | **Image Sizing** | Conditional, proportional | Fixed 400px | 🔴 Script B distorts images |
| 7 | **Aspect Ratio** | ✅ Preserved | ❌ Not preserved | 🔴 Visual quality degraded |
| 8 | **Spacing** | 2 spaces (cell) / 1 space (body) | No spacing | 🟡 Cosmetic difference |
| 9 | **Footer Order** | Before images | After images | 🟡 Minor timing difference |
| 10 | **Return on Fail** | `''` (empty string) | `null` | 🟡 Type difference |

---

### Visual Output Differences

**Scenario: 4 images in a table cell**

**Script A Output:**
```
┌─────────────────────────┐
│ [Image1]  [Image2]      │
│ [Image3]  [Image4]      │
│ (each 220px wide)       │
└─────────────────────────┘
```

**Script B Output:**
```
┌─────────────────────────┐
│ [Image1][Image2]        │
│ [Image3][Image4]        │
│ (each 400px wide - may  │
│  overflow cell!)        │
└─────────────────────────┘
```

**Problem:** Script B images are 82% WIDER (400px vs 220px) and may overflow table cells!

---

**Scenario: 1 failed image + 1 successful**

**Script A Output:**
```
[Working Image]  [[Image not available: https://broken.url]]
```

**Script B Output:**
```
[Working Image]
(nothing else - user doesn't know image failed)
```

---

### Code Quality Differences

| Aspect | Script A | Script B |
|--------|----------|----------|
| **Modularity** | ✅ Separate helper functions | ✅ Similar structure |
| **Error handling** | ✅ User-friendly error text | ❌ Silent failures |
| **Robustness** | ✅ Multiple URL format support | ⚠️ Limited format support |
| **Maintainability** | ✅ Clear separation of concerns | ✅ Similar |
| **Logging** | ✅ Detailed console logs | ✅ Detailed console logs |
| **Complexity** | Higher (table detection, grid logic) | Lower (simpler insertion) |

---

## 8. CONCLUSION

### Why Documents Differ Visually

1. **🔴 CRITICAL: Image Sizing**
   - Script A: 220px (cell) / 450px (body) with proportional resize
   - Script B: Fixed 400px, no aspect ratio preservation
   - **Result:** Script B images are larger and potentially distorted

2. **🔴 CRITICAL: Layout Structure**
   - Script A: 2-column grid in table cells
   - Script B: No grid, single line of images
   - **Result:** Different spacing and arrangement

3. **🔴 CRITICAL: Error Handling**
   - Script A: Shows `[[Image not available]]` for failures
   - Script B: Silent failure, blank space
   - **Result:** Script A documents show which images failed

4. **🟡 MINOR: Image Spacing**
   - Script A: 2 spaces between images in cells, 1 in body
   - Script B: No spacing between images
   - **Result:** Script A images are more visually separated

5. **🟡 MINOR: URL Format Support**
   - Script A: JSON + comma-separated
   - Script B: JSON only
   - **Result:** Script B fails on legacy comma-separated URLs

---

### Which Script is More Robust?

**🏆 Script A (appsscript-1) is SIGNIFICANTLY MORE ROBUST**

**Reasons:**

1. ✅ **Better error visibility** - users can see failed images
2. ✅ **Adaptive layout** - grid in cells, inline in body
3. ✅ **Proper image sizing** - maintains aspect ratio, prevents distortion
4. ✅ **Broader URL support** - handles legacy comma-separated format
5. ✅ **Stricter validation** - rejects invalid file IDs
6. ✅ **Table-aware insertion** - adjusts for document structure

**Script B Advantages:**
- Simpler code (less complexity)
- Fixed sizing (predictable, but less flexible)

**Script B Disadvantages:**
- Silent failures hide problems
- Fixed 400px sizing can distort images
- No table cell detection → same layout everywhere
- May accept invalid file IDs
- No comma-separated URL support

---

### Recommendation

**For Production:**
- **Use Script A** if image quality, layout flexibility, and error visibility are priorities
- **Use Script B** only if:
  - All images are already 400px wide
  - No images are placed in table cells
  - All URLs are in JSON array format
  - Silent failures are acceptable

**To Improve Script B:**
1. Add table cell detection
2. Implement proportional image resizing
3. Add comma-separated URL support
4. Insert error text for failed images
5. Improve file ID validation

---

## 9. CODE BLOCK COMPARISONS

### Image Insertion Function Comparison

**Script A:**
```javascript
function insertImageAt_(body, marker, urls) {
  if (!urls) {
    replaceAll_(body, marker, '');
    return;
  }

  let list = [];
  
  // JSON + comma-separated support
  try {
    const parsed = JSON.parse(String(urls));
    if (Array.isArray(parsed)) {
      list = parsed.map(s => String(s).trim()).filter(Boolean);
    } else {
      throw new Error('Not an array');
    }
  } catch (jsonError) {
    list = String(urls).split(',').map(s => s.trim()).filter(Boolean);
  }

  const range = body.findText(marker);
  if (!range) return;

  const el = range.getElement();
  el.asText().replaceText(marker, '');
  let par = el.getParent().asParagraph();

  // TABLE CELL DETECTION
  const cell = findAncestorTableCell_(par);
  const inCell = !!cell;

  const MAX_BODY_WIDTH = 450, MAX_CELL_WIDTH = 220, COLS_PER_ROW = 2;

  if (inCell) {
    // GRID LAYOUT FOR CELLS
    par.clear();
    let inRow = 0;
    list.forEach((u, i) => {
      try {
        const id = extractDriveId_(u);
        const blob = id ? DriveApp.getFileById(id).getBlob() : UrlFetchApp.fetch(u).getBlob();
        if (inRow === 0 && i > 0) par = cell.appendParagraph('');
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_CELL_WIDTH);  // PROPORTIONAL RESIZE
        inRow++;
        if (inRow < COLS_PER_ROW) par.appendText('  ');
        if (inRow === COLS_PER_ROW) inRow = 0;
      } catch (e) {
        par.appendText(` [[Image not available: ${u}]] `);  // ERROR TEXT
      }
    });
  } else {
    // INLINE LAYOUT FOR BODY
    list.forEach((u, i) => {
      try {
        const id = extractDriveId_(u);
        const blob = id ? DriveApp.getFileById(id).getBlob() : UrlFetchApp.fetch(u).getBlob();
        const img = par.appendInlineImage(blob);
        clampImageWidth_(img, MAX_BODY_WIDTH);  // PROPORTIONAL RESIZE
        if (i < list.length - 1) par.appendText(' ');
      } catch (e) {
        par.appendText(` [[Image not available: ${u}]] `);  // ERROR TEXT
      }
    });
  }
}
```

**Script B:**
```javascript
function insertImageAt_(body, placeholder, imageUrl) {
  try {
    if (!imageUrl) {
      body.replaceText(escapeRegExp_(placeholder), '');
      return;
    }

    // JSON ONLY
    let urls = [];
    if (typeof imageUrl === 'string' && imageUrl.trim().startsWith('[')) {
      try {
        urls = JSON.parse(imageUrl);
      } catch (e) {
        urls = [imageUrl];
      }
    } else {
      urls = [imageUrl];
    }

    urls = urls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

    if (urls.length === 0) {
      body.replaceText(escapeRegExp_(placeholder), '');
      return;
    }

    // NO TABLE DETECTION
    const searchResult = body.findText(escapeRegExp_(placeholder));
    if (!searchResult) {
      console.log(`Placeholder "${placeholder}" not found`);
      return;
    }

    const element = searchResult.getElement();
    const parent = element.getParent();
    const childIndex = parent.getChildIndex(element);

    // SINGLE INSERTION MODE
    let insertedCount = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();

      try {
        let blob;
        const fileId = extractDriveFileId_(url);
        if (fileId) {
          const file = DriveApp.getFileById(fileId);
          blob = file.getBlob();
        } else {
          const response = UrlFetchApp.fetch(url);
          blob = response.getBlob();
        }

        const image = parent.insertInlineImage(childIndex + insertedCount, blob);
        image.setWidth(400);  // FIXED 400PX, NO ASPECT RATIO
        insertedCount++;
      } catch (e) {
        console.error(`Failed to insert image ${i + 1}:`, e.toString());
        // NO ERROR TEXT INSERTED
      }
    }

    if (insertedCount > 0) {
      element.asText().setText('');
    } else {
      body.replaceText(escapeRegExp_(placeholder), '');
    }

  } catch (err) {
    console.error('Image insertion error:', err.toString());
    body.replaceText(escapeRegExp_(placeholder), '');
  }
}
```

---

**END OF IMAGE INJECTION ANALYSIS**
