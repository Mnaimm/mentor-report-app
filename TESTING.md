# Local Testing Guide for Mentor Reporting Tool

## 🚀 Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the application:**
   - Main app: http://localhost:3000
   - laporan-sesi (Bangkit): http://localhost:3000/laporan-sesi
   - laporan-maju (Maju): http://localhost:3000/laporan-maju
   - Admin dashboard: http://localhost:3000/admin

## 🧪 Testing Workflow

### Phase 1: Basic Functionality Test

#### Test laporan-sesi (Known Working)
1. Navigate to http://localhost:3000/laporan-sesi
2. Select a mentee from the dropdown
3. Fill out a simple form (Session 1)
4. Upload a test image (small JPEG/PNG)
5. Submit and verify:
   - ✅ Form submission successful
   - ✅ Image upload works
   - ✅ Data appears in Google Sheets (V8 tab)
   - ✅ Apps Script generates document

#### Test laporan-maju (Recently Fixed)
1. Navigate to http://localhost:3000/laporan-maju  
2. Select a mentee from the dropdown
3. Fill out Session 1 form
4. Upload a test image
5. Submit and verify:
   - ✅ Form submission successful
   - ✅ Image upload routed to MAJU Apps Script (FIXED!)
   - ✅ Data appears in Google Sheets (LaporanMaju tab)
   - ✅ Apps Script generates document correctly

### Phase 2: Image Upload Verification

#### Test Image Routing Fix
1. **Before Fix Issue:** Images from laporan-maju were going to Sesi Apps Script
2. **After Fix:** Images from laporan-maju should go to Maju Apps Script

**Verification Steps:**
1. Upload image in laporan-maju
2. Check browser network tab for API call to `/api/upload-proxy`
3. Verify payload contains `"reportType": "maju"`
4. Check Google Drive folder structure for correct organization
5. Verify document generation includes correct image links

### Phase 3: Complete Data Flow Test

#### End-to-End Flow Verification
```
Form Input → API Endpoint → Google Sheets → Apps Script → Document Generation
```

**laporan-sesi Flow:**
- Form → `/api/submitReport` → V8 Sheet → appsscript-1 → Document

**laporan-maju Flow:**  
- Form → `/api/submitMajuReport` → LaporanMaju Sheet → appsscript-2 → Document

## 🐛 Debugging Tools

### 1. Browser Developer Tools
- **Network Tab:** Monitor API calls and responses
- **Console:** Check for JavaScript errors
- **Application Tab:** Verify localStorage (drafts)

### 2. API Testing Endpoints
Create test API calls to verify functionality:

```javascript
// Test image upload routing
fetch('/api/upload-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'uploadImage',
    reportType: 'maju', // Should route to Maju Apps Script
    fileName: 'test.jpg',
    // ... other required fields
  })
});
```

### 3. Google Sheets Verification
- Check data appears in correct tabs:
  - Bangkit data → V8 tab
  - Maju data → LaporanMaju tab
- Verify timestamps and row numbers

### 4. Apps Script Logs
- Check Google Apps Script execution logs
- Verify correct script is being called for each program type

## 📋 Test Scenarios

### Critical Test Cases

#### ✅ Image Upload Routing (FIXED)
- **laporan-sesi:** `reportType: 'sesi'` → appsscript-1
- **laporan-maju:** `reportType: 'maju'` → appsscript-2 ✅ FIXED

#### 🔍 Session Management
- Test all session types (1-4) for both programs
- Verify historical data loading
- Test draft saving and restoration

#### 📸 File Upload Scenarios
- Small images (<1MB)
- Large images (>1MB) - should auto-compress
- Multiple file uploads per session
- MIA proof uploads

#### 🚨 Error Handling
- Network failures during submission
- Invalid file types
- Missing required fields
- Apps Script timeout/failure

## 🎯 Success Criteria

### laporan-maju Should Now Work Correctly:
- ✅ Images route to correct Apps Script (appsscript-2)
- ✅ Documents generate with proper image links
- ✅ No cross-contamination with Bangkit data
- ✅ MIA proofs uploaded correctly

### Both Programs Should:
- ✅ Submit data to correct Google Sheets tabs
- ✅ Generate documents via correct Apps Scripts
- ✅ Handle image uploads properly
- ✅ Maintain separate file organizations

## 🐛 Common Issues to Watch For

1. **Image Upload Errors:** Check network requests for correct `reportType`
2. **Document Generation Fails:** Verify Apps Script URLs in environment
3. **Cross-Program Data Mixing:** Ensure laporan-maju doesn't affect laporan-sesi
4. **File Storage Issues:** Check Google Drive folder organization

## 📞 Quick Debug Commands

```bash
# Check environment variables
npm run dev -- --inspect

# Test API endpoints directly
curl -X POST http://localhost:3000/api/test-env

# Monitor logs
tail -f .next/trace
```

## 🚀 Next Steps After Local Testing

1. Deploy to staging environment
2. Run full regression tests
3. User acceptance testing
4. Production deployment

---

**Remember:** The critical fix was changing `reportType: 'sesi'` to `reportType: 'maju'` in laporan-maju.js - this ensures images and documents are processed by the correct Apps Script!
