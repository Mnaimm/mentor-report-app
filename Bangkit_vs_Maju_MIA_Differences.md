# Bangkit vs Maju UM: MIA Implementation Differences

## 📊 Executive Summary

While both programs handle MIA (Missing In Action) similarly, there are **critical differences** in validation rules, data structure, and field naming that must be preserved when implementing lib/mia.js.

---

## 🔍 Detailed Comparison

### 1. Frontend Validation

| Feature | Bangkit | Maju UM | Impact |
|---------|---------|---------|--------|
| **MIA Checkbox** | `isMIA` state | `isMIA` state | ✅ Same |
| **Reason Field** | Mandatory (`formState.mia.alasan`) | Mandatory (`miaReason`) | ⚠️ Different variable names |
| **Proof File** | **Optional** (validation skips if absent) | **Mandatory** (validation fails if absent) | 🔴 **Critical difference** |
| **UM Data in Payload** | Excluded entirely | Included (empty/partial JSON) | 🔴 **Critical difference** |

---

### 2. API Endpoints

#### **Bangkit: `/api/submitBangkit`**

**Payload Structure:**
```javascript
{
  status: 'MIA',              // or 'Selesai'
  imageUrls: {
    mia: 'https://drive....'  // Optional, only if uploaded
  },
  inisiatif: '',              // Sent but empty
  jualanTerkini: '',          // Sent but empty
  // UPWARD_MOBILITY_JSON: NOT sent at all
}
```

**Google Sheets Mapping:**
- Column C: `STATUS_SESI` = 'MIA'
- Column AO: `LINK_BUKTI_MIA` = proof URL
- Columns BC-CB (28 columns): UM data - **LEFT EMPTY**

**Supabase:**
```javascript
reports table:
├─ mia_status: 'MIA'
├─ mia_reason: '...'
└─ mia_proof_url: '...' (or null)

upward_mobility_reports table:
└─ SKIPPED (logic: if status !== 'MIA')
```

---

#### **Maju: `/api/submitMajuReport`**

**Payload Structure:**
```javascript
{
  MIA_STATUS: 'MIA',          // or 'Tidak MIA'
  MIA_REASON: '...',          // Explicit field
  MIA_PROOF_URL: '...',       // Explicit field (required)
  UPWARD_MOBILITY_JSON: JSON.stringify({
    section3: null,
    section4: null,
    section5: null,
    section6: null
  })  // Empty UM structure INCLUDED
}
```

**Google Sheets Mapping:**
- Column 27 (AB): `MIA_STATUS` = 'MIA'
- Column 28 (AC): `MIA_REASON` = reason text
- Column 29 (AD): `MIA_PROOF_URL` = proof URL
- Columns 30-57 (28 columns): UM data - **LEFT EMPTY**

**Supabase:**
```javascript
reports table:
├─ mia_status: 'MIA'
├─ mia_reason: '...'
└─ mia_proof_url: '...' (required)

upward_mobility_reports table:
└─ SKIPPED (logic: if MIA_STATUS !== 'MIA')
```

---

### 3. Key Differences Summary

| Aspect | Bangkit | Maju UM |
|--------|---------|---------|
| **Status Field Name** | `STATUS_SESI` | `MIA_STATUS` |
| **Proof Field Name** | `LINK_BUKTI_MIA` | `MIA_PROOF_URL` |
| **Proof File Required?** | ❌ No (optional) | ✅ Yes (mandatory) |
| **UM Data in Payload** | ❌ Excluded entirely | ✅ Included (empty JSON) |
| **UM Sheet Skip Logic** | `status !== 'MIA'` | `MIA_STATUS !== 'MIA'` |
| **Column C/27** | STATUS_SESI | MIA_STATUS |
| **Column AO/29** | LINK_BUKTI_MIA | MIA_PROOF_URL |

---

## 🎯 Implementation Strategy for lib/mia.js

### Strategy: Program-Aware Functions

lib/mia.js must be **program-aware** to handle these differences correctly.

### 1. Validation with Program Type

```javascript
// lib/mia.js
export const validateMIAForm = (miaData) => {
  const { reason, proofFile, programType = 'maju' } = miaData;
  const errors = [];
  
  // Reason: Required for BOTH programs
  if (!reason || reason.trim() === '') {
    errors.push('Alasan/Sebab Usahawan MIA adalah wajib diisi');
  }
  
  // Proof File: Required for MAJU ONLY
  const proofRequired = programType === 'maju';
  
  if (proofRequired && !proofFile) {
    errors.push('Bukti MIA (screenshot/dokumen) adalah wajib dimuat naik');
  }
  
  // If proof is provided (optional in Bangkit), validate it
  if (proofFile) {
    // Validate file size, type, etc.
  }
  
  return errors;
};
```

**Usage:**
```javascript
// laporan-bangkit.js
const errors = validateMIAForm({
  reason: miaReason,
  proofFile: miaProofFile,
  programType: 'bangkit'  // Proof optional
});

// laporan-maju-um.js
const errors = validateMIAForm({
  reason: miaReason,
  proofFile: miaProofFile,
  programType: 'maju'  // Proof required
});
```

---

### 2. Data Preparation with UM Handling

```javascript
// lib/mia.js
export const prepareMIASubmission = ({
  mentorEmail,
  menteeName,
  sessionNumber,
  programType,
  miaReason,
  miaProofUrl,
  includeUMPlaceholder = false  // Maju: true, Bangkit: false
}) => {
  if (programType === 'bangkit') {
    return {
      STATUS_SESI: 'MIA',
      MIA_REASON: miaReason,
      LINK_BUKTI_MIA: miaProofUrl || '',  // Optional
      // NO UPWARD_MOBILITY_JSON field
    };
  }
  
  if (programType === 'maju') {
    const data = {
      MIA_STATUS: 'MIA',
      MIA_REASON: miaReason,
      MIA_PROOF_URL: miaProofUrl,  // Required
    };
    
    // INCLUDE empty UM placeholder if requested
    if (includeUMPlaceholder) {
      data.UPWARD_MOBILITY_JSON = JSON.stringify({
        section3: null,
        section4: null,
        section5: null,
        section6: null
      });
    }
    
    return data;
  }
};
```

**Usage:**
```javascript
// submitBangkit.js
const miaData = prepareMIASubmission({
  programType: 'bangkit',
  miaProofUrl: imageUrls.mia || '',  // Optional
  // ... other params
});
// Returns: { STATUS_SESI: 'MIA', LINK_BUKTI_MIA: '...', ... }
// Does NOT include UPWARD_MOBILITY_JSON

// submitMajuReportum.js
const miaData = prepareMIASubmission({
  programType: 'maju',
  miaProofUrl: imageUrls.mia,  // Required
  includeUMPlaceholder: true,  // Maju includes empty UM
  // ... other params
});
// Returns: { MIA_STATUS: 'MIA', MIA_PROOF_URL: '...', UPWARD_MOBILITY_JSON: '{"section3":null,...}' }
```

---

### 3. UM Sheet Skip Logic (Unified)

```javascript
// lib/mia.js
export const shouldSkipUMSheetWrite = (statusOrData, upwardMobilityData = null) => {
  let status = null;
  let umData = upwardMobilityData;
  
  // Handle both call patterns
  if (typeof statusOrData === 'object') {
    const data = statusOrData;
    
    // Auto-detect program type based on field names
    if (data.STATUS_SESI) {
      status = data.STATUS_SESI;  // Bangkit
    } else if (data.MIA_STATUS) {
      status = data.MIA_STATUS;    // Maju
    }
    
    umData = data.UPWARD_MOBILITY_JSON;
  } else {
    status = statusOrData;  // Direct status string
  }
  
  // Skip if status is 'MIA' (same for both programs)
  if (status === 'MIA') {
    return true;
  }
  
  // Skip if no UM data
  if (!umData) {
    return true;
  }
  
  return false;
};
```

**Usage:**
```javascript
// Works for BOTH programs!

// submitBangkit.js
if (shouldSkipUMSheetWrite(reportData)) {
  console.log('Skipping UM sheet - MIA or no data');
}

// submitMajuReportum.js  
if (shouldSkipUMSheetWrite(reportData)) {
  console.log('Skipping UM sheet - MIA or no data');
}

// Both work because function auto-detects field names!
```

---

## 🚨 Critical Implementation Notes

### 1. Proof File Validation MUST Differ

**WRONG:**
```javascript
// Don't do this - makes proof mandatory for Bangkit too!
if (!proofFile) {
  errors.push('Bukti required');  // ❌ Wrong for Bangkit
}
```

**CORRECT:**
```javascript
// Do this - program-aware validation
const proofRequired = programType === 'maju';

if (proofRequired && !proofFile) {
  errors.push('Bukti required');  // ✅ Only Maju
}
```

---

### 2. UM Data Handling MUST Differ

**WRONG:**
```javascript
// Don't do this - excludes UM from Maju payload!
return {
  MIA_STATUS: 'MIA',
  // ... no UPWARD_MOBILITY_JSON
};
```

**CORRECT:**
```javascript
// Do this - Maju includes empty UM
if (programType === 'maju') {
  data.UPWARD_MOBILITY_JSON = JSON.stringify({
    section3: null,
    section4: null,
    section5: null,
    section6: null
  });
}
```

---

### 3. Field Names MUST Match Program

**WRONG:**
```javascript
// Don't do this - uses wrong field name!
return {
  MIA_STATUS: 'MIA',  // ❌ Wrong for Bangkit
};
```

**CORRECT:**
```javascript
// Do this - program-specific field names
if (programType === 'bangkit') {
  return { STATUS_SESI: 'MIA' };  // ✅
} else if (programType === 'maju') {
  return { MIA_STATUS: 'MIA' };   // ✅
}
```

---

## 📋 Testing Matrix

After implementation, test these specific scenarios:

### Bangkit Specific Tests:
- [ ] Submit MIA **without** proof file → Should succeed ✅
- [ ] Submit MIA **with** proof file → Should succeed ✅
- [ ] Verify `STATUS_SESI` field in Google Sheet
- [ ] Verify `LINK_BUKTI_MIA` column (AO)
- [ ] Verify UM columns (BC-CB) are empty
- [ ] Verify `UPWARD_MOBILITY_JSON` is NOT in payload
- [ ] Verify Supabase `mia_proof_url` can be null

### Maju UM Specific Tests:
- [ ] Submit MIA **without** proof file → Should FAIL ❌
- [ ] Submit MIA **with** proof file → Should succeed ✅
- [ ] Verify `MIA_STATUS` field in Google Sheet
- [ ] Verify `MIA_PROOF_URL` column (29/AD)
- [ ] Verify UM columns (30-57) are empty
- [ ] Verify `UPWARD_MOBILITY_JSON` IS in payload (empty)
- [ ] Verify Supabase `mia_proof_url` is required

### Cross-Program Consistency Tests:
- [ ] Both skip UM sheet write when MIA
- [ ] Both show same validation messages for reason field
- [ ] Both handle file size validation same way
- [ ] Both block form in next session after MIA

---

## 💡 Recommendations

### 1. Always Pass Program Type

**Make it explicit:**
```javascript
// Frontend
validateMIAForm({ 
  reason, 
  proofFile, 
  programType: 'bangkit'  // Always pass this!
});

// Backend
prepareMIASubmission({ 
  programType: 'maju',    // Always pass this!
  // ...
});
```

---

### 2. Document Why Differences Exist

Add comments in code explaining the differences:

```javascript
// lib/mia.js

// CRITICAL: Proof file validation differs by program
// - Bangkit: Optional (mentor may mark MIA without immediate proof)
// - Maju: Mandatory (stricter requirement for documentation)
// Reason: Different program policies and audit requirements

const proofRequired = programType === 'maju';
```

---

### 3. Use Constants for Field Names

```javascript
// lib/mia.js
const FIELD_MAPPINGS = {
  bangkit: {
    statusField: 'STATUS_SESI',
    proofField: 'LINK_BUKTI_MIA',
    includeUMPlaceholder: false
  },
  maju: {
    statusField: 'MIA_STATUS',
    proofField: 'MIA_PROOF_URL',
    includeUMPlaceholder: true
  }
};

export const prepareMIASubmission = ({ programType, ... }) => {
  const mapping = FIELD_MAPPINGS[programType];
  
  return {
    [mapping.statusField]: 'MIA',
    [mapping.proofField]: miaProofUrl,
    // ... etc
  };
};
```

---

## ✅ Summary Checklist

Before deploying lib/mia.js, verify:

### Program-Specific Behavior:
- [ ] Bangkit: Proof file is optional
- [ ] Maju: Proof file is mandatory
- [ ] Bangkit: Excludes UPWARD_MOBILITY_JSON from payload
- [ ] Maju: Includes empty UPWARD_MOBILITY_JSON in payload
- [ ] Bangkit: Uses STATUS_SESI field name
- [ ] Maju: Uses MIA_STATUS field name
- [ ] Both: Skip UM sheet write when MIA

### Validation:
- [ ] validateMIAForm() accepts programType parameter
- [ ] Proof validation conditional on programType
- [ ] Reason validation identical for both programs

### Data Preparation:
- [ ] prepareMIASubmission() returns correct field names
- [ ] includeUMPlaceholder parameter works correctly
- [ ] Proof URL handling differs (optional vs required)

### UM Sheet Logic:
- [ ] shouldSkipUMSheetWrite() works for both programs
- [ ] Auto-detects field names (STATUS_SESI vs MIA_STATUS)
- [ ] Handles both call patterns (object vs separate params)

---

## 🎯 Final Architecture

```
lib/mia.js (Program-Aware Utilities)
      ↓
      ├─→ validateMIAForm(data, programType='maju')
      │   ├─ Bangkit: Proof optional
      │   └─ Maju: Proof required
      │
      ├─→ prepareMIASubmission({ programType, ... })
      │   ├─ Bangkit: STATUS_SESI, LINK_BUKTI_MIA, no UM
      │   └─ Maju: MIA_STATUS, MIA_PROOF_URL, with UM placeholder
      │
      └─→ shouldSkipUMSheetWrite(data)
          ├─ Auto-detects: STATUS_SESI or MIA_STATUS
          └─ Returns: true if MIA or no UM data
```

This architecture maintains the critical differences while eliminating duplicate logic! ✅
