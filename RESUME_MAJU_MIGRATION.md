# Resume: Migrate MAJU Forms to upload-image API

## 📋 Current Status (as of 2026-01-24)

### ✅ Completed
1. **Fixed upload-image.js** - Stream handling + OAuth scope fix
2. **Migrated laporan-bangkit.js** - Now uses `/api/upload-image`
3. **Migrated laporan-sesi.js** - Now uses `/api/upload-image`
4. **Tested laporan-bangkit.js** - 3 images uploaded successfully ✅
5. **Committed changes** - Commit `8f18ddd` (29 commits ahead of origin)

### ⏸️ Paused - Needs Completion
- **laporan-maju.js** - Still uses `/api/upload-proxy` (OLD system)
- **laporan-maju-um.js** - Still uses `/api/upload-proxy` (OLD system)

---

## 🎯 What Needs to Be Done

Migrate both MAJU forms from the old upload-proxy system to the new upload-image system.

---

## 📝 Step-by-Step Instructions

### Step 1: Open Files
```bash
# Open these two files in your editor:
pages/laporan-maju.js
pages/laporan-maju-um.js
```

### Step 2: Find the uploadImage Function

In **both files**, search for:
```javascript
const uploadImage = (file, fId, menteeName, sessionNumber) => new Promise(async (resolve, reject) => {
```

You'll find complex code with:
- `FileReader()`
- `compressImageForProxy()`
- `fetch('/api/upload-proxy', ...)`
- ~100+ lines of compression logic

### Step 3: Replace with Simplified Version

Replace the **entire uploadImage function** with this simplified version:

```javascript
const uploadImage = (file, fId, menteeName, sessionNumber) => new Promise(async (resolve, reject) => {
    try {
      const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`📸 Uploading ${file.name} (${originalSizeMB}MB) to Google Drive...`);

      // Upload directly to Google Drive via /api/upload-image (not Apps Script)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', fId);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload error response:', errorText.substring(0, 200));
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Server error: ${result.error}`);
      }

      console.log('✅ Upload successful:', result.url);
      resolve(result.url);

    } catch (error) {
      console.error('❌ Upload failed:', error);
      reject(error);
    }
});
```

### Step 4: Find and Replace MIA Upload (if present)

Both files also have a **separate MIA upload section**. Search for:
```javascript
// Upload MIA proof if present
```

You'll find another `fetch('/api/upload-proxy', ...)` call around lines 704 (laporan-maju.js) and 741 (laporan-maju-um.js).

**Replace that entire section** with the same simplified logic (use FormData + `/api/upload-image`).

### Step 5: Remove Unused Compression Function (Optional)

After migration, you can remove the `compressImageForProxy` function since it's no longer needed:

Search for:
```javascript
const compressImageForProxy = (base64String, targetSizeKB = 800, onProgress = null) => {
```

Delete the entire function (it's probably 50+ lines).

### Step 6: Remove Compression Progress State (Optional)

Search for:
```javascript
setCompressionProgress
```

Remove any references to `compressionProgress` state and the `setCompressionProgress` calls.

---

## 🧪 Testing Instructions

### Test laporan-maju.js:
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000/laporan-maju`
3. Select a mentee
4. Fill in the form
5. Upload images (GW360, Sesi, Premis, MIA if applicable)
6. Submit the form
7. Check console for success logs:
   ```
   📸 Uploading [filename] to Google Drive...
   ✅ Upload successful: https://drive.google.com/...
   ```
8. Verify images appear in Google Drive folder
9. Verify data saved to Google Sheets

### Test laporan-maju-um.js:
1. Go to `http://localhost:3000/laporan-maju-um`
2. Repeat same testing process as above

---

## 📂 Reference Implementation

Use these files as reference (already migrated):
- `pages/laporan-bangkit.js` - Lines 681-713
- `pages/laporan-sesi.js` - Lines 579-613
- `pages/api/upload-image.js` - The working API endpoint

---

## ✅ After Testing Successfully

### Commit the Changes:
```bash
git add pages/laporan-maju.js pages/laporan-maju-um.js
git commit -m "fix: Migrate MAJU forms to Google Drive API upload-image

- Migrate laporan-maju.js from upload-proxy to upload-image
- Migrate laporan-maju-um.js from upload-proxy to upload-image
- Remove base64 compression workflow
- Use FormData for direct Google Drive uploads
- Simplify upload logic (consistent with bangkit/sesi forms)

Tested: Both forms upload images successfully to Drive.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Check Final Status:
```bash
git status
# Should show: Your branch is ahead of 'origin/main' by 30 commits
```

---

## 🚀 After All Forms Migrated

When all 4 forms are migrated and tested:
- ✅ laporan-sesi.js
- ✅ laporan-bangkit.js
- ⏸️ laporan-maju.js (TODO)
- ⏸️ laporan-maju-um.js (TODO)

You can then:
1. Review all 30 unpushed commits
2. Push to GitHub: `git push origin main`
3. Deploy to Vercel (auto-deploy if connected)
4. Celebrate! 🎉

---

## 🔧 Quick Resume Command

When you return, just tell Claude Code:

```
Resume MAJU migration from RESUME_MAJU_MIGRATION.md

Please:
1. Migrate laporan-maju.js uploadImage function to use /api/upload-image
2. Migrate laporan-maju-um.js uploadImage function to use /api/upload-image
3. Show me the git diff for both files
4. I'll test and then commit
```

---

## 📞 Context for Claude Code

**Environment Variables:** Already configured in `.env.local`
- ✅ `GOOGLE_CREDENTIALS_BASE64` - Service account credentials
- ✅ `GOOGLE_SERVICE_ACCOUNT_EMAIL` - mentor-app-service-account@...
- ✅ All necessary Drive/Sheets IDs

**Working API:** `/api/upload-image`
- Uses Google Drive API (googleapis library)
- OAuth scope: `https://www.googleapis.com/auth/drive` (full access)
- Stream handling: Converts buffer to Readable stream
- Tested and working with laporan-bangkit.js

**Why Migration is Safe:**
- Production uses old upload-proxy system (still works)
- Local development now uses new upload-image system
- Both systems write to same Google Drive folders
- No risk to production data

---

## 📊 Git Commit History
```
Current: 29 commits ahead of origin/main

Last commit (8f18ddd):
- fix: Migrate image uploads to Google Drive API with stream handling
- Files: upload-image.js, laporan-bangkit.js, laporan-sesi.js
- Tested successfully

Next commit (after MAJU migration):
- fix: Migrate MAJU forms to Google Drive API upload-image
- Files: laporan-maju.js, laporan-maju-um.js
- Needs testing first
```

---

## 🎯 Success Criteria

Migration is complete when:
- [ ] laporan-maju.js uses `/api/upload-image` instead of `/api/upload-proxy`
- [ ] laporan-maju-um.js uses `/api/upload-image` instead of `/api/upload-proxy`
- [ ] Both forms tested locally with successful image uploads
- [ ] Console shows success logs (not compression logs)
- [ ] Images appear in correct Google Drive folders
- [ ] Data saves to correct Google Sheets
- [ ] Changes committed to git
- [ ] Ready to push to production

---

## 💡 Tips

1. **Don't rush** - Test each form thoroughly before committing
2. **Check console logs** - They tell you exactly what's happening
3. **Verify Drive uploads** - Open the folder IDs and check images are there
4. **Keep it simple** - The new code is ~70% shorter than the old code
5. **Use the force** - The migration is already proven to work (bangkit/sesi)

---

Good luck! The hard part is done. This is just applying the same pattern to 2 more files. 🚀
