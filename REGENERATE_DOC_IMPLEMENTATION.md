# Regenerate Doc Implementation Guide

This guide documents the changes needed to support automatic PDF regeneration for revised reports upon approval.

## Overview

When a report with `revision_count > 0` is approved, the system should:
1. Call GAS `regenerateDoc` action
2. Clear existing DOC_URL and Status in the Google Sheet row
3. Regenerate the PDF document using existing logic
4. Return the new docId and docUrl
5. **DO NOT** delete the old PDF from Drive (orphan it)

---

## Part 1: Bangkit GAS Script Updates

### Changes to `doPost` function

**Location:** Bangkit GAS.txt, lines 195-236

**Add this new case** after line 215 (after the `uploadImage` case):

```javascript
function doPost(e) {
  // Log incoming request
  console.log('=== doPost CALLED ===');
  console.log('Request method:', e?.parameter?.method || 'POST');

  try {
    // Parse request body
    const data = JSON.parse(e.postData.contents || '{}');
    console.log('Action:', data.action);

    // Route based on action
    if (data.action === 'processRow' && data.rowNumber) {
      // AUTOMATION PATH: Process specific row to generate document
      console.log('Processing row:', data.rowNumber);
      const result = processSingleRow(Number(data.rowNumber));
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        result: result
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else if (data.action === 'uploadImage' || (!data.action && data.fileData)) {
      // UPLOAD PATH: Handle file upload to Google Drive
      return handleFileUpload(data);
    }
    else if (data.action === 'regenerateDoc' && data.rowNumber) {
      // REGENERATION PATH: Regenerate PDF for revised report
      console.log('Regenerating document for row:', data.rowNumber);
      const result = regenerateDocument(Number(data.rowNumber));
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        docId: result.docId,
        docUrl: result.docUrl,
        message: 'Document regenerated successfully'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    else {
      // Unknown action
      throw new Error('Invalid action. Use "processRow", "uploadImage", or "regenerateDoc"');
    }

  } catch (err) {
    console.error('doPost error:', err.toString());
    console.error('Stack:', err.stack);

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString(),
      stack: err.stack
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### New function: `regenerateDocument`

**Add this function** after the `processUnprocessedRows` function (around line 1612):

```javascript
/**
 * Regenerates document for a specific row (for revised reports)
 * Clears existing DOC_URL and Status, then calls processSingleRow
 *
 * @param {number} rowNumber - Row number to regenerate (1-indexed)
 * @returns {Object} Result with docId and docUrl
 */
function regenerateDocument(rowNumber) {
  console.log(`=== REGENERATING DOCUMENT FOR ROW ${rowNumber} ===`);

  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(30000);

  if (!lockAcquired) {
    throw new Error('Could not acquire lock - another process is running');
  }

  try {
    // Open sheet and get column indices
    const { sheet, headers, idx } = openBangkitSheet_();

    // Clear existing DOC_URL (column BB, index 52)
    sheet.getRange(rowNumber, idx[H.DocUrl]).clearContent();
    console.log(`Cleared DOC_URL for row ${rowNumber}`);

    // Clear existing Status (column BA, index 52)
    sheet.getRange(rowNumber, idx[H.Status]).clearContent();
    console.log(`Cleared Status for row ${rowNumber}`);

    // Now regenerate the document using existing logic
    processRowByIndex_(sheet, headers, idx, rowNumber);

    // Read back the new DOC_URL and Status
    const newDocUrl = sheet.getRange(rowNumber, idx[H.DocUrl]).getValue();
    const newStatus = sheet.getRange(rowNumber, idx[H.Status]).getValue();

    // Extract docId from URL
    const docIdMatch = String(newDocUrl).match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    const docId = docIdMatch ? docIdMatch[1] : '';

    console.log(`Document regenerated successfully`);
    console.log(`New Doc ID: ${docId}`);
    console.log(`New Doc URL: ${newDocUrl}`);

    return {
      success: true,
      docId: docId,
      docUrl: newDocUrl,
      status: newStatus,
      rowNumber: rowNumber
    };

  } catch (err) {
    console.error('Regeneration error:', err.toString());
    throw err;
  } finally {
    lock.releaseLock();
  }
}
```

---

## Part 2: Maju GAS Script Updates

### Changes to `doPost` function

**Location:** Maju GAS.txt, lines 55-157

**Update the action routing** to include `regenerateDoc`:

```javascript
function doPost(e) {
  const executionId = Utilities.getUuid().substring(0, 8);
  let logData = {
    executionId: executionId,
    timestamp: new Date().toISOString(),
    step: 'start',
    success: false,
    error: null,
    mentee: '',
    sesi: '',
    docId: '',
    rowNumber: ''
  };

  try {
    Logger.log(`[${executionId}] doPost: start`);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No data received in POST.');
    }

    const requestPayload = JSON.parse(e.postData.contents);
    Logger.log(`[${executionId}] Received payload action: ${requestPayload.action}`);

    // Handle image upload action
    if (requestPayload.action === 'uploadImage') {
      Logger.log(`[${executionId}] Processing image upload`);
      return handleImageUpload(requestPayload, executionId);
    }

    // Handle document processing action for 'maju' programType
    if (requestPayload.action === 'processRow' && requestPayload.rowNumber && requestPayload.programType === 'maju') {
      const rowNumber = parseInt(requestPayload.rowNumber, 10);
      if (isNaN(rowNumber) || rowNumber < 2) {
        throw new Error('Invalid rowNumber received for processing.');
      }
      logData.rowNumber = rowNumber;

      Logger.log(`[${executionId}] Processing existing row: ${rowNumber}`);
      const result = processMajuRow(rowNumber, executionId);

      logData.success = result.processed || result.skipped;
      logData.docId = result.docId || '';

      try {
        saveExecutionLog(logData);
      } catch (logError) {
        Logger.log(`[${executionId}] ⚠️ Could not save execution log: ${logError.message}`);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Document processed successfully.',
        docId: logData.docId,
        executionId: executionId,
        row: rowNumber
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle regenerateDoc action for 'maju' programType
    else if (requestPayload.action === 'regenerateDoc' && requestPayload.rowNumber) {
      const rowNumber = parseInt(requestPayload.rowNumber, 10);
      if (isNaN(rowNumber) || rowNumber < 2) {
        throw new Error('Invalid rowNumber received for regeneration.');
      }

      Logger.log(`[${executionId}] Regenerating document for row: ${rowNumber}`);
      const result = regenerateMajuDocument(rowNumber, executionId);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        docId: result.docId,
        message: 'Maju document regenerated successfully',
        executionId: executionId,
        row: rowNumber
      })).setMimeType(ContentService.MimeType.JSON);
    }

    else {
      Logger.log(`[${executionId}] Invalid payload. Action: ${requestPayload.action}`);
      const errorDetails = `Received: action="${requestPayload.action}", rowNumber="${requestPayload.rowNumber}"`;
      logData.error = `Invalid payload. ${errorDetails}`;
      throw new Error(logData.error);
    }

  } catch (err) {
    Logger.log(`[${executionId}] doPost ERROR: ${err.message}`);
    logData.success = false;
    logData.error = err.message;

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: err.message,
      executionId: executionId
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      saveExecutionLog(logData);
    } catch (logError) {
      Logger.log(`[${logData.executionId}] ⚠️ Final log save failed: ${logError.message}`);
    }
  }
}
```

### New function: `regenerateMajuDocument`

**Add this function** after the `processMajuRow` function (around line 392):

```javascript
/**
 * Regenerates Maju document for a specific row (for revised reports)
 * Clears existing Laporan_Maju_Doc_ID, then calls processMajuRow
 *
 * @param {number} rowNumber - Row number to regenerate (1-indexed)
 * @param {string} executionId - Unique execution ID for logging
 * @returns {Object} Result with docId
 */
function regenerateMajuDocument(rowNumber, executionId) {
  Logger.log(`[${executionId}] === REGENERATING MAJU DOCUMENT FOR ROW ${rowNumber} ===`);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Could not acquire lock - another process is running');
  }

  try {
    // Open sheet and get headers
    const result = getLaporanMajuSheetAndHeaders();
    const sheet = result.sheet;
    const headers = result.headers;

    if (!headers || headers.length === 0) {
      throw new Error('Headers are invalid from getLaporanMajuSheetAndHeaders');
    }

    // Find Laporan_Maju_Doc_ID column
    const docIdColIndex = headers.indexOf('Laporan_Maju_Doc_ID');
    if (docIdColIndex === -1) {
      throw new Error('Laporan_Maju_Doc_ID column not found in sheet');
    }

    // Clear existing Laporan_Maju_Doc_ID
    sheet.getRange(rowNumber, docIdColIndex + 1).clearContent();
    Logger.log(`[${executionId}] Cleared Laporan_Maju_Doc_ID for row ${rowNumber}`);

    // Regenerate document using existing logic
    const processResult = processMajuRow(rowNumber, executionId);

    Logger.log(`[${executionId}] Maju document regenerated successfully`);
    Logger.log(`[${executionId}] New Doc ID: ${processResult.docId}`);

    return {
      success: true,
      docId: processResult.docId,
      rowNumber: rowNumber
    };

  } catch (err) {
    Logger.log(`[${executionId}] Regeneration error: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
  }
}
```

---

## Part 3: Next.js API Update (Approval Endpoint)

**File:** `pages/api/admin/reports/[id]/review.js`

**Location:** After line 126 (after the sheets status update block), before the final `return res.status(200)`

**Add this code block:**

```javascript
        // 6. REGENERATE DOC FOR REVISED REPORTS (NON-BLOCKING)
        if (status === 'approved') {
            try {
                // Fetch full report data including revision_count
                const { data: fullReport, error: fullReportError } = await supabase
                    .from('reports')
                    .select('id, revision_count, sheets_row_number, program')
                    .eq('id', id)
                    .single();

                if (!fullReportError && fullReport && fullReport.revision_count > 0) {
                    console.log(`🔄 Report has revision_count=${fullReport.revision_count}, triggering PDF regeneration...`);

                    // Determine which GAS to call based on program
                    const isBangkit = fullReport.program?.toLowerCase().includes('bangkit');
                    const isMaju = fullReport.program?.toLowerCase().includes('maju');

                    let gasUrl = '';
                    let programType = '';

                    if (isBangkit) {
                        gasUrl = process.env.BANGKIT_GAS_URL;
                        programType = 'bangkit';
                    } else if (isMaju) {
                        gasUrl = process.env.MAJU_GAS_URL;
                        programType = 'maju';
                    }

                    if (gasUrl && fullReport.sheets_row_number) {
                        // Call GAS regenerateDoc action
                        const gasPayload = {
                            action: 'regenerateDoc',
                            rowNumber: fullReport.sheets_row_number,
                            programType: programType
                        };

                        console.log(`🚀 Calling ${programType.toUpperCase()} GAS regenerateDoc for row ${fullReport.sheets_row_number}`);

                        const gasResponse = await fetch(gasUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(gasPayload)
                        });

                        const gasResult = await gasResponse.json();

                        if (gasResult.success) {
                            console.log(`✅ PDF regenerated successfully: ${gasResult.docId}`);

                            // Update doc_url in Supabase if returned
                            if (gasResult.docUrl) {
                                await supabase
                                    .from('reports')
                                    .update({ doc_url: gasResult.docUrl })
                                    .eq('id', id);

                                console.log(`✅ Updated doc_url in Supabase`);
                            }

                            // Log success
                            await supabase.from('dual_write_logs').insert({
                                operation_type: 'pdf_regenerate',
                                table_name: 'reports',
                                record_id: fullReport.id,
                                supabase_success: true,
                                sheets_success: true,
                                program: fullReport.program,
                                created_at: new Date().toISOString(),
                                metadata: {
                                    revision_count: fullReport.revision_count,
                                    new_doc_id: gasResult.docId,
                                    trigger: 'approval_after_revision'
                                }
                            });
                        } else {
                            console.error(`⚠️ GAS regenerateDoc failed (non-blocking):`, gasResult.error);

                            // Log failure
                            await supabase.from('dual_write_logs').insert({
                                operation_type: 'pdf_regenerate',
                                table_name: 'reports',
                                record_id: fullReport.id,
                                supabase_success: true,
                                sheets_success: false,
                                sheets_error: gasResult.error || 'GAS call failed',
                                program: fullReport.program,
                                created_at: new Date().toISOString(),
                                metadata: {
                                    revision_count: fullReport.revision_count,
                                    trigger: 'approval_after_revision'
                                }
                            });
                        }
                    } else if (!fullReport.sheets_row_number) {
                        console.warn(`⚠️ Cannot regenerate PDF: sheets_row_number is missing for report ${id}`);
                    } else {
                        console.warn(`⚠️ Cannot regenerate PDF: GAS URL not configured for program ${fullReport.program}`);
                    }
                }
            } catch (regenerateError) {
                console.error('⚠️ PDF regeneration failed (non-blocking):', regenerateError);
                // Don't let regeneration failure block the approval response
            }
        }

        return res.status(200).json({ success: true });
```

---

## Part 4: Environment Variables

Add these to your `.env.local` and Vercel environment variables:

```bash
# Google Apps Script URLs for PDF generation
BANGKIT_GAS_URL=https://script.google.com/macros/s/YOUR_BANGKIT_DEPLOYMENT_ID/exec
MAJU_GAS_URL=https://script.google.com/macros/s/YOUR_MAJU_DEPLOYMENT_ID/exec
```

---

## Implementation Checklist

- [ ] Update Bangkit GAS script with `regenerateDoc` action handler
- [ ] Update Bangkit GAS script with `regenerateDocument` function
- [ ] Update Maju GAS script with `regenerateDoc` action handler
- [ ] Update Maju GAS script with `regenerateMajuDocument` function
- [ ] Deploy both GAS scripts and get their web app URLs
- [ ] Add GAS URLs to `.env.local` and Vercel environment variables
- [ ] Update `pages/api/admin/reports/[id]/review.js` with PDF regeneration logic
- [ ] Test with a revised report (revision_count > 0)
- [ ] Verify old PDF remains in Drive (orphaned)
- [ ] Verify new PDF is generated with fresh timestamp
- [ ] Verify `doc_url` is updated in Supabase

---

## Testing Steps

1. **Create a test scenario:**
   - Submit a Bangkit report
   - Admin requests revision (sets revision_count = 1)
   - Mentor revises and resubmits
   - Admin approves the revised report

2. **Verify behavior:**
   - Old PDF should remain in Drive folder (orphaned)
   - New PDF should be generated with timestamp
   - `doc_url` in Supabase should be updated to new PDF
   - `dual_write_logs` should have entry for `pdf_regenerate` operation

3. **Repeat for Maju program**

---

## Notes

- **Non-blocking:** PDF regeneration failures will NOT block the approval process
- **Old PDFs:** Old documents are orphaned (not deleted) to preserve history
- **Row number requirement:** `sheets_row_number` must be available (added in migration)
- **Logging:** All regeneration attempts are logged to `dual_write_logs` table
- **Error handling:** GAS errors are caught and logged, but don't fail the approval

---

## Troubleshooting

**Problem:** `sheets_row_number` is null
**Solution:** Ensure the report was migrated with row number tracking, or manually update it

**Problem:** GAS URL not configured
**Solution:** Add `BANGKIT_GAS_URL` and `MAJU_GAS_URL` to environment variables

**Problem:** GAS call times out
**Solution:** Check GAS execution logs, ensure template IDs are correct

**Problem:** Old PDF not found
**Solution:** This is expected - old PDF is orphaned but remains in Drive folder

