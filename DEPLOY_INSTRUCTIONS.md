# Enhanced Apps Script Deployment Instructions

## Issue Identified
The table insertion is failing because the Apps Script cannot find the correct placeholders in the Google Docs template. The enhanced version now includes:

- Multiple placeholder format detection
- Comprehensive debugging logs  
- Better error handling for table insertion

## Deployment Steps

1. **Open Google Apps Script**
   - Go to: https://script.google.com
   - Open your "LaporanMajuBackend" project

2. **Update Code.js**
   - Replace ALL content in Code.js with the enhanced version from `appsscript-2/Code.js`
   - The updated code includes better placeholder detection and debugging

3. **Deploy New Version**
   - Click "Deploy" → "New deployment"
   - Choose "Web app" as type
   - Set execute as: "Me"
   - Set access: "Anyone"
   - Click "Deploy"
   - Copy the new web app URL

4. **Update Environment Variable**
   - Update `NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL` in `.env.local`
   - Use the new deployment URL from step 3

## Testing the Fix

After deployment, test the form submission and check the Apps Script execution logs for:

```
[executionId] All placeholders found in template: [...]
[executionId] Financial table inserted successfully with placeholder: [...]
[executionId] Mentoring table inserted successfully with placeholder: [...]
```

## Expected Improvements

The enhanced version will:
- Try multiple placeholder formats automatically
- Provide detailed logs of what placeholders exist in the template
- Show which placeholder format works for each table
- Give clear error messages if tables still can't be inserted

## Next Steps

1. Deploy the updated Apps Script
2. Test form submission
3. Check execution logs for placeholder detection results
4. Report back with the logs showing which placeholders were found and used