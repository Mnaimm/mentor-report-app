# CLAUDE CODE: Fix upload-image.js Stream Handling

## Problem Identified
Upload to Google Drive fails with error: "part.body.pipe is not a function"

**Root Cause:** The googleapis library expects a **Stream** but we're passing a **Buffer**.

**Confirmed:** Test upload with proper stream handling works perfectly.

## Required Fix

### Step 1: Add Stream Import
At the top of `pages/api/upload-image.js`, add:

```javascript
import { Readable } from 'stream';
```

### Step 2: Find the drive.files.create() Call
Search for where the file is uploaded to Google Drive. It should look something like:

```javascript
const response = await drive.files.create({
  requestBody: {
    name: fileName,
    parents: [folderId],
  },
  media: {
    mimeType: 'image/jpeg',
    body: fileBuffer,  // ❌ This is the problem!
  },
  fields: 'id, webViewLink, webContentLink',
  supportsAllDrives: true,
});
```

### Step 3: Convert Buffer to Stream
Replace the upload section with:

```javascript
// Convert buffer to stream
const bufferStream = Readable.from(fileBuffer);

const response = await drive.files.create({
  requestBody: {
    name: fileName,
    parents: [folderId],
  },
  media: {
    mimeType: 'image/jpeg',  // or the actual file mimetype
    body: bufferStream,  // ✅ Use stream instead!
  },
  fields: 'id, webViewLink, webContentLink',
  supportsAllDrives: true,
});
```

## Complete Example

Here's what the fixed section should look like:

```javascript
import { google } from 'googleapis';
import formidable from 'formidable';
import fs from 'fs';
import { Readable } from 'stream';  // ← ADD THIS

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // ... existing code ...

  try {
    // ... parse form data, get file ...
    
    // Read file buffer
    const fileBuffer = fs.readFileSync(file.filepath);
    
    // ✅ NEW: Convert buffer to stream
    const bufferStream = Readable.from(fileBuffer);
    
    // Upload to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: file.originalFilename || 'uploaded-image.jpg',
        parents: [folderId],
      },
      media: {
        mimeType: file.mimetype || 'image/jpeg',
        body: bufferStream,  // ← USE STREAM HERE
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    });
    
    // ... rest of code ...
    
  } catch (error) {
    // ... error handling ...
  }
}
```

## Instructions

1. **Open** `pages/api/upload-image.js`
2. **Add** `import { Readable } from 'stream';` at the top
3. **Find** the `drive.files.create()` call
4. **Add** `const bufferStream = Readable.from(fileBuffer);` before the upload
5. **Change** `body: fileBuffer` to `body: bufferStream`
6. **Show me** the before/after code snippet

## Expected Result

After this fix:
- ✅ Image uploads will work locally
- ✅ No more "pipe is not a function" errors
- ✅ Both laporan-sesi.js and laporan-bangkit.js will work

## Verification

After making the change:
1. Save the file
2. Restart dev server (Ctrl+C, then `npm run dev`)
3. Test upload in laporan-sesi.js form
4. Should see success message and image uploaded to Google Drive
