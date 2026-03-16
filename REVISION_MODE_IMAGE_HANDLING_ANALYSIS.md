# Revision Mode Image Handling Analysis

## Question
When revision reason includes "Gambar sesi tidak ada / tidak mencukupi", is the existing photo URL from previous submission pre-loaded (allowing submission without change), or is the field forced to be empty requiring fresh upload?

---

## Answer: **DIFFERENT BEHAVIOR BETWEEN BANGKIT AND MAJU**

### Summary Table

| Form | Existing Images Preserved? | Can Submit Without Re-Upload? | Code Location |
|------|---------------------------|------------------------------|---------------|
| **Bangkit** | ❌ **NO** | ❌ **NO** - Must re-upload | `pages/laporan-bangkit.js:431-433` |
| **Maju** | ✅ **YES** | ✅ **YES** - Can keep existing | `pages/laporan-maju-um.js:365-367` |

---

## Detailed Analysis

### 1. Bangkit Form (laporan-bangkit.js)

#### A. Revision Prefill Logic

**Location:** `pages/laporan-bangkit.js`, lines 368-441

```javascript
// --- PRE-FILL FORM FROM REVISION DATA ---
useEffect(() => {
  if (!revisionData || !isRevisionMode) return;

  console.log('📝 Pre-filling form with revision data...');

  try {
    // ... (other field prefills)

    const preFillData = {
      inisiatif: revisionData.inisiatif || [...],
      kemaskiniInisiatif: revisionData.kemaskini_inisiatif || [],
      teknologi: revisionData.teknologi || [...],
      jualanTerkini: revisionData.jualan_terkini || Array(12).fill(''),
      // ... more fields ...
    };

    setFormState(preFillData);

    // ❌ CRITICAL: Images are NOT pre-filled
    // Note: Image files cannot be pre-filled from URLs
    // If photo categories are flagged for revision, they will need to be re-uploaded
    // We'll handle this in the UI with appropriate messaging

    console.log('✅ Form pre-filled successfully');

  } catch (err) {
    console.error('❌ Error pre-filling form:', err);
  }
}, [revisionData, isRevisionMode, allMentees]);
```

**Key Finding:**
- Lines 431-433 explicitly state: **"Image files cannot be pre-filled from URLs"**
- **"If photo categories are flagged for revision, they will need to be re-uploaded"**

#### B. Image Upload Handling

**Location:** `pages/laporan-bangkit.js`, lines 852-862, 1045-1058

```javascript
// Initialize empty image URLs object
const imageUrls = {
  growthwheel: '',
  profil: '',
  sesi: [],
  premis: [],
  mia: {
    whatsapp: '',
    email: '',
    call: ''
  }
};

// ... later in submission ...

// Session 1: Upload images
if (currentSession === 1) {
  if (files.gw) uploadPromises.push(...);
  if (files.profil) uploadPromises.push(...);
  files.sesi.forEach((file) => uploadPromises.push(...)); // ❌ Only NEW files
  if (formState.sesi.premisDilawat) {
    files.premis.forEach((file) => uploadPromises.push(...));
  }
}
```

**Key Finding:**
- `imageUrls` starts **empty** every time
- **NO merging** with `revisionData.image_urls`
- Only newly uploaded files are processed

#### C. Submission to API

**Location:** `pages/laporan-bangkit.js`, lines 1091-1105

```javascript
const reportData = {
  ...formState,
  inisiatif: transformedInisiatif,
  status: isMIA ? 'MIA' : 'Selesai',
  sesiLaporan: currentSession,
  usahawan: selectedMentee.Usahawan,
  // ... other fields ...
  imageUrls,  // ❌ Only contains newly uploaded images
  premisDilawatChecked: !!formState.sesi?.premisDilawat,
  programType: 'bangkit',
  batch: selectedMentee?.Batch || '',
};
```

**Key Finding:**
- `imageUrls` sent to `/api/admin/reports/[id]/revise` contains **only new uploads**
- If mentor doesn't upload new images, `imageUrls.sesi` will be `[]` (empty array)

#### D. Backend Handling (revise.js)

**Location:** `pages/api/admin/reports/[id]/revise.js`, line 288

```javascript
// Bangkit format
supabasePayload = {
  // ... other fields ...

  // Image URLs
  image_urls: reportData?.imageUrls || {},  // ❌ Overwrites existing images!

  // ... more fields ...
};
```

**Key Finding:**
- Backend **replaces** entire `image_urls` object
- If `reportData.imageUrls.sesi` is `[]`, existing images are **lost**

#### **Bangkit Conclusion:**
❌ **Mentor MUST re-upload images**
❌ **Existing images are NOT preserved**
❌ **Submitting without re-upload will result in empty image URLs**

---

### 2. Maju Form (laporan-maju-um.js)

#### A. Revision Prefill Logic

**Location:** `pages/laporan-maju-um.js`, lines 345-391

```javascript
// PRE-FILL FORM FROM REVISION DATA
useEffect(() => {
  if (!revisionData || !isRevisionMode) return;

  console.log('📝 Pre-filling Maju form with revision data...');

  try {
    const preFillData = {
      NAMA_MENTOR: revisionData.mentor_name || session?.user?.name || '',
      EMAIL_MENTOR: revisionData.mentor_email || session?.user?.email || '',
      // ... other fields ...

      // ✅ CRITICAL: Images ARE pre-filled from existing URLs!
      URL_GAMBAR_PREMIS_JSON: revisionData.image_urls?.premis || [],
      URL_GAMBAR_SESI_JSON: revisionData.image_urls?.sesi || [],
      URL_GAMBAR_GW360: revisionData.image_urls?.growthwheel || '',

      // ... more fields ...
    };

    setFormData(preFillData);
    console.log('✅ Maju form pre-filled successfully');

  } catch (err) {
    console.error('❌ Error pre-filling Maju form:', err);
  }
}, [revisionData, isRevisionMode, allMenteesMapping]);
```

**Key Finding:**
- Lines 365-367: **Existing image URLs ARE populated** into `formData`
- `URL_GAMBAR_SESI_JSON` contains existing photo URLs from previous submission

#### B. Image Upload Handling

**Location:** `pages/laporan-maju-um.js`, lines 995-1006, 1025-1074

```javascript
// Initialize image URLs (will be populated from uploads OR preserved from formData)
const imageUrls = {
  gw360: '',
  sesi: [],
  premis: [],
  mia: {
    whatsapp: '',
    email: '',
    call: ''
  }
};

// ... validation logs ...
const sesiCount = files.sesi?.length || 0;
console.log(`  - Sesi Images: ${sesiCount}`);

// Check if we have NEW images to upload
const hasImagesToUpload = files.gw360 ||
                          (files.sesi && files.sesi.length > 0) ||
                          (files.premis && files.premis.length > 0) ||
                          files.mia.whatsapp || files.mia.email || files.mia.call;

// Upload images if we have NEW files
if (hasImagesToUpload) {
  // Upload Sesi images (multiple files)
  if (files.sesi && files.sesi.length > 0) {
    files.sesi.forEach((file) =>
      uploadPromises.push(
        uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload)
          .then((url) => imageUrls.sesi.push(url))
      )
    );
  }

  // ... other uploads ...

  await Promise.all(uploadPromises);
  console.log('✅ All images uploaded successfully');
}
```

**Key Finding:**
- If `files.sesi.length === 0` (no new files), `imageUrls.sesi` remains `[]`
- BUT: Submission logic handles this differently...

#### C. Submission to API

**Location:** `pages/laporan-maju-um.js`, lines 1147-1171

```javascript
// Regular report data (non-MIA)
dataToSend = {
  NAMA_MENTOR: formData.NAMA_MENTOR,
  EMAIL_MENTOR: formData.EMAIL_MENTOR,
  // ... other fields ...

  // ✅ CRITICAL: Uses uploaded URLs OR falls back to formData!
  URL_GAMBAR_PREMIS_JSON: imageUrls.premis,  // New uploads
  URL_GAMBAR_SESI_JSON: imageUrls.sesi,      // New uploads
  URL_GAMBAR_GW360: imageUrls.gw360,         // New upload

  // ... more fields ...
};
```

**Wait, this looks like it only uses new uploads too!**

Let me check if there's merging logic...

#### D. Check if formData is merged when imageUrls is empty

Looking at line 1170:
```javascript
URL_GAMBAR_SESI_JSON: imageUrls.sesi,
```

This sends the **newly uploaded** URLs. If `imageUrls.sesi` is `[]`, it will be empty.

**BUT:** Let me check the backend handling...

#### E. Backend Handling (submitMajuReport.js)

**Location:** `pages/api/submitMajuReport.js` (need to verify if revision endpoint handles differently)

Looking at `pages/api/admin/reports/[id]/revise.js`, lines 196-224 (Maju section):

```javascript
// MAJU format
supabasePayload = {
  // ... fields ...

  // Images (construct object from URL fields)
  image_urls: {
    premis: reportData?.URL_GAMBAR_PREMIS_JSON || [],
    sesi: reportData?.URL_GAMBAR_SESI_JSON || [],
    growthwheel: reportData?.URL_GAMBAR_GW360 || '',
    mia: reportData?.imageUrls?.mia || null
  },

  // ... more fields ...
};
```

**Key Finding:**
- Backend constructs `image_urls` from `reportData.URL_GAMBAR_SESI_JSON`
- If this is `[]` (empty), existing images are **also lost**!

**WAIT - This means Maju has the SAME problem as Bangkit!**

Let me re-check the prefill logic more carefully...

#### F. Re-examining Maju Image Display

**Location:** `pages/laporan-maju-um.js`, lines 2612-2635

```javascript
<ImageInput
  label="Gambar Sesi (Pelbagai Gambar)"
  name="URL_GAMBAR_SESI_JSON"
  value={formData.URL_GAMBAR_SESI_JSON}
  onChange={handleFileChange}
  multiple
  required
  isImageUpload
/>

{/* Display existing images */}
{formData.URL_GAMBAR_SESI_JSON.length > 0 && (
  <div className="mt-2">
    <p className="text-sm font-medium text-gray-700 mb-2">Existing Images:</p>
    <div className="grid grid-cols-3 gap-2">
      {formData.URL_GAMBAR_SESI_JSON.map((url, index) => (
        <img key={index} src={url} alt={`Sesi ${index + 1}`} className="w-full h-24 object-cover rounded" />
      ))}
    </div>
  </div>
)}
```

**Key Finding:**
- Maju **displays** existing images from `formData.URL_GAMBAR_SESI_JSON`
- But does it **preserve** them on submission?

#### G. Final Check: What happens when files.sesi is empty?

Looking back at submission logic (line 1170):
```javascript
URL_GAMBAR_SESI_JSON: imageUrls.sesi,
```

If no new files uploaded:
- `files.sesi.length === 0`
- `imageUrls.sesi` remains `[]`
- `dataToSend.URL_GAMBAR_SESI_JSON` becomes `[]`
- Backend receives empty array
- **Existing images are lost!**

#### **Maju Conclusion (UPDATED):**
❌ **Mentor MUST ALSO re-upload images**
✅ **Existing images ARE displayed in UI** (for reference)
❌ **BUT existing images are NOT preserved on submission**
❌ **Submitting without re-upload will ALSO result in empty image URLs**

---

## Final Answer: **BOTH BANGKIT AND MAJU REQUIRE RE-UPLOAD**

### Bangkit Behavior:
1. ❌ Existing images **NOT pre-filled** into form
2. ❌ Existing images **NOT displayed** in UI
3. ❌ Existing images **NOT preserved** on submission
4. ⚠️ Explicit comment in code (line 431): "Image files cannot be pre-filled from URLs"
5. **Result:** Mentor must re-upload all images

### Maju Behavior:
1. ✅ Existing images **ARE pre-filled** into `formData.URL_GAMBAR_SESI_JSON`
2. ✅ Existing images **ARE displayed** in UI (lines 2619-2629)
3. ❌ **BUT** existing images **NOT preserved** on submission
4. ⚠️ `imageUrls.sesi` starts empty, only populated with new uploads
5. ⚠️ Submission sends `imageUrls.sesi`, not `formData.URL_GAMBAR_SESI_JSON`
6. **Result:** Mentor sees old images but must re-upload to preserve them

---

## The Problem

### User Experience Issue:

**Scenario:**
1. Admin requests revision: "Gambar sesi tidak ada / tidak mencukupi"
2. **Bangkit:** Mentor sees empty file input (confusing - were there no images before?)
3. **Maju:** Mentor sees existing images displayed (good!)
4. Mentor thinks: "Oh, the images are already there, maybe I just need to add one more"
5. Mentor uploads 1 additional image
6. **Bangkit:** Submission contains only 1 new image (old images lost)
7. **Maju:** Submission contains only 1 new image (old images ALSO lost!)
8. Admin reviews again: "Still not enough images, only 1 photo!"

**Root Cause:**
- `imageUrls` object always starts fresh
- No merging logic between new uploads and existing URLs
- Backend receives only new uploads, overwrites existing data

---

## Code Blocks Showing the Issue

### Bangkit: No Prefill, No Preserve

```javascript
// laporan-bangkit.js:431-433
// Note: Image files cannot be pre-filled from URLs
// If photo categories are flagged for revision, they will need to be re-uploaded
// We'll handle this in the UI with appropriate messaging
```

```javascript
// laporan-bangkit.js:852-862
const imageUrls = {
  growthwheel: '',
  profil: '',
  sesi: [],      // ❌ Starts empty, no merge with revisionData.image_urls.sesi
  premis: [],
  mia: { whatsapp: '', email: '', call: '' }
};
```

```javascript
// laporan-bangkit.js:1048
files.sesi.forEach((file) =>
  uploadPromises.push(
    uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload)
      .then((url) => imageUrls.sesi.push(url))  // ❌ Only new uploads added
  )
);
```

```javascript
// laporan-bangkit.js:1101
const reportData = {
  ...formState,
  // ...
  imageUrls,  // ❌ Contains only new uploads, existing URLs lost
  // ...
};
```

### Maju: Prefills for Display, But Doesn't Preserve

```javascript
// laporan-maju-um.js:365-367 (Prefill)
const preFillData = {
  // ...
  URL_GAMBAR_PREMIS_JSON: revisionData.image_urls?.premis || [],  // ✅ Pre-filled
  URL_GAMBAR_SESI_JSON: revisionData.image_urls?.sesi || [],      // ✅ Pre-filled
  URL_GAMBAR_GW360: revisionData.image_urls?.growthwheel || '',   // ✅ Pre-filled
  // ...
};
```

```javascript
// laporan-maju-um.js:995-1006 (Upload logic)
const imageUrls = {
  gw360: '',
  sesi: [],     // ❌ Starts empty, doesn't copy from formData.URL_GAMBAR_SESI_JSON
  premis: [],
  mia: { whatsapp: '', email: '', call: '' }
};
```

```javascript
// laporan-maju-um.js:1034 (Only new files added)
if (files.sesi && files.sesi.length > 0) {
  files.sesi.forEach((file) =>
    uploadPromises.push(
      uploadImage(file, folderId, menteeNameForUpload, sessionNumberForUpload)
        .then((url) => imageUrls.sesi.push(url))  // ❌ Only new uploads
    )
  );
}
```

```javascript
// laporan-maju-um.js:1170 (Submission)
dataToSend = {
  // ...
  URL_GAMBAR_SESI_JSON: imageUrls.sesi,  // ❌ Only new uploads, formData ignored!
  // ...
};
```

---

## Recommended Fix

### Option 1: Merge Existing and New URLs

**For Bangkit** (`laporan-bangkit.js`):

```javascript
// Around line 852, modify imageUrls initialization
const imageUrls = {
  growthwheel: isRevisionMode ? (revisionData?.image_urls?.growthwheel || '') : '',
  profil: isRevisionMode ? (revisionData?.image_urls?.profil || '') : '',
  sesi: isRevisionMode ? [...(revisionData?.image_urls?.sesi || [])] : [],  // Copy existing
  premis: isRevisionMode ? [...(revisionData?.image_urls?.premis || [])] : [],
  mia: {
    whatsapp: isRevisionMode ? (revisionData?.image_urls?.mia?.whatsapp || '') : '',
    email: isRevisionMode ? (revisionData?.image_urls?.mia?.email || '') : '',
    call: isRevisionMode ? (revisionData?.image_urls?.mia?.call || '') : ''
  }
};
```

**For Maju** (`laporan-maju-um.js`):

```javascript
// Around line 995, modify imageUrls initialization
const imageUrls = {
  gw360: isRevisionMode ? (formData.URL_GAMBAR_GW360 || '') : '',
  sesi: isRevisionMode ? [...(formData.URL_GAMBAR_SESI_JSON || [])] : [],  // Copy existing
  premis: isRevisionMode ? [...(formData.URL_GAMBAR_PREMIS_JSON || [])] : [],
  mia: {
    whatsapp: '',
    email: '',
    call: ''
  }
};
```

### Option 2: Better UX - Make it explicit

Add clear messaging in revision mode:

```jsx
{isRevisionMode && shouldHighlightField('Gambar sesi tidak ada / tidak mencukupi') && (
  <div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r">
    <p className="font-semibold text-amber-900 mb-2">⚠️ Gambar Perlu Dikemaskini</p>
    <p className="text-sm text-amber-800">
      Sila muat naik gambar sesi yang baru. Gambar lama akan digantikan dengan gambar baru yang anda muat naik.
    </p>
  </div>
)}
```

---

## Current Workaround for Mentors

**If admin requests "Gambar sesi tidak ada / tidak mencukupi":**

1. **Bangkit:** Must re-upload ALL session photos (old ones will be lost)
2. **Maju:** Can see old photos in UI, but must re-upload ALL photos to preserve them
3. **Both:** Cannot just add 1-2 additional photos - must re-upload complete set

**This is confusing and error-prone!**

---

## Testing Checklist

To verify this behavior:

```
1. Submit a Bangkit report with 2 session photos
2. Admin requests revision: "Gambar sesi tidak ada / tidak mencukupi"
3. Mentor enters revision mode
4. Bangkit: Verify file input is empty (no visual indicator of old photos)
5. Mentor uploads 1 additional photo (thinking it will add to existing)
6. Submit revision
7. Check Supabase: image_urls.sesi should only have 1 photo (old 2 lost)

Repeat for Maju:
1. Submit Maju report with 2 session photos
2. Admin requests revision
3. Mentor enters revision mode
4. Maju: Verify old photos ARE displayed below the file input
5. Mentor uploads 1 additional photo
6. Submit revision
7. Check Supabase: URL_GAMBAR_SESI_JSON should only have 1 photo (old 2 also lost!)
```

---

## Conclusion

**Both forms require fresh upload** when images are flagged for revision.

**Key Differences:**
- **Bangkit:** Completely empty, no visual feedback
- **Maju:** Shows existing images (misleading - they won't be preserved!)

**Recommended fix:** Implement Option 1 (merge existing + new URLs) for both forms.

**Estimated effort:** 30-45 minutes for both forms + testing.
