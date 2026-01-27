# Fix Upload Proxy 302 Redirect Error

## Problem
The upload-proxy.js is failing with:
1. **DNS Resolution Error**: `ENOTFOUND script.google.com` on first attempt
2. **302 Redirect Error**: Google Apps Script returns "Moved Temporarily" HTML instead of processing the upload

## Root Cause
Google Apps Script is rejecting the requests because:
1. Missing proper HTTP headers (especially User-Agent)
2. Not following redirects properly
3. Possible network/firewall blocking on first attempt

## Solution

### Update `pages/api/upload-proxy.js`

Find the fetch request to Apps Script (around line 70-80) and update it with these changes:

```javascript
// OLD CODE (remove this):
const response = await fetch(appsScriptUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(cleanedBody),
});

// NEW CODE (replace with this):
const response = await fetch(appsScriptUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  },
  body: JSON.stringify(cleanedBody),
  redirect: 'follow', // Automatically follow 302 redirects
});
```

### Key Changes:
1. **Add User-Agent header**: Google Apps Script often blocks requests without a proper User-Agent
2. **Add Accept headers**: Tells Google what response format we expect
3. **Add redirect: 'follow'**: Automatically follows 302 redirects instead of treating them as errors
4. **Add Connection: keep-alive**: Better connection handling
5. **Add Cache-Control**: Prevents caching issues

### Additional: Increase Retry Logic (Optional but Recommended)

If the retry logic is configurable, you might want to:
- Increase timeout from default to 30 seconds
- Add a longer delay between retries (3-5 seconds instead of 2 seconds)
- Make sure all 3 attempts use the same headers

### Expected Result:
After this fix:
- The 302 redirect will be followed automatically
- Google Apps Script will properly receive and process the image upload
- The DNS errors should still happen on attempt 1 (network issue) but retry will succeed

### Testing:
1. Save the changes
2. Restart the dev server: `npm run dev`
3. Try uploading images in the Bangkit report form
4. Check the terminal logs - should see successful upload without 302 errors

### If DNS Errors Persist:
The `ENOTFOUND script.google.com` error is a separate network/firewall issue. If it continues:
1. Check Windows Firewall settings for Node.js
2. Try using Google DNS (8.8.8.8)
3. Temporarily disable antivirus to test
4. Check if VPN/proxy is blocking Google services

But the retry mechanism should handle this - it should succeed on attempt 2 or 3 once the headers are fixed.
