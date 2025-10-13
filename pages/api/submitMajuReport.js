// pages/api/submitMajuReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;
    console.log('📋 [SUBMIT API] Request received for MAJU submission');
    console.log('📊 [SUBMIT API] Mentee:', reportData.NAMA_MENTEE);
    console.log('📊 [SUBMIT API] Session:', reportData.SESI_NUMBER);
    console.log('📊 [SUBMIT API] Folder_ID:', reportData.Folder_ID);
    console.log('📊 [SUBMIT API] MIA Status:', reportData.MIA_STATUS);

    // Auth setup
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Environment variables
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
    const range = 'LaporanMaju!A1';
    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL;

    console.log('🔗 Using spreadsheet ID:', spreadsheetId);
    console.log('🔗 Using Apps Script URL:', appsScriptUrl);

    if (!spreadsheetId) {
      throw new Error('Missing GOOGLE_SHEETS_MAJU_REPORT_ID environment variable.');
    }

    if (!appsScriptUrl) {
      throw new Error('Missing NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL environment variable.');
    }

    // DEBUG: Verify all critical fields are populated
    console.log('🔍 [DEBUG] Field verification before sheet write:');
    console.log('  - Folder_ID from request:', reportData.Folder_ID);
    console.log('  - NAMA_MENTEE:', reportData.NAMA_MENTEE);
    console.log('  - SESI_NUMBER:', reportData.SESI_NUMBER);
    console.log('  - NAMA_MENTOR:', reportData.NAMA_MENTOR);
    console.log('  - EMAIL_MENTOR:', reportData.EMAIL_MENTOR);

    // Alert if Folder_ID is missing
    if (!reportData.Folder_ID || reportData.Folder_ID === '') {
      console.error('⚠️ [CRITICAL] Folder_ID is empty! Document generation will fail.');
      console.error('⚠️ Request body Folder_ID:', reportData.Folder_ID);
    }

    // Prepare row data
    const rowData = mapMajuDataToSheetRow(reportData);
    console.log('📊 Prepared row data (first 5 values):', rowData.slice(0, 5));
    console.log('📊 Folder_ID in row data (index 25):', rowData[25]);

    // Append data to Google Sheet with 8s timeout
    console.log('📊 Appending data to Google Sheets...');
    const appendRes = await Promise.race([
      sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google Sheets API timeout after 8 seconds')), 8000)
      )
    ]);
    console.log('✅ Sheet append successful');

    // Extract the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    console.log('📊 Updated range:', updatedRange);
    
    // Parse row number from something like "LaporanMaju!A3:AC3"
    const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];
    console.log('🔢 Extracted row number:', newRowNumber);

    if (!newRowNumber) {
      throw new Error('Could not determine the row number where data was inserted.');
    }

    // Trigger Apps Script for document generation
    console.log('🚀 Triggering Apps Script for document generation...');
    
    const appsScriptPayload = {
      action: 'processRow',
      rowNumber: parseInt(newRowNumber, 10),
      programType: 'maju'
    };
    
    console.log('📤 Apps Script payload:', appsScriptPayload);
    
    const appsScriptResponse = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appsScriptPayload),
    });

    const appsScriptText = await appsScriptResponse.text();
    console.log('📥 [SUBMIT API] Apps Script response status:', appsScriptResponse.status);
    console.log('📥 [SUBMIT API] Apps Script response text:', appsScriptText.substring(0, 500));

    if (appsScriptResponse.ok) {
      try {
        const appsScriptResult = JSON.parse(appsScriptText);
        console.log('📦 [SUBMIT API] Apps Script parsed response:', {
          success: appsScriptResult.success,
          message: appsScriptResult.message,
          docId: appsScriptResult.docId,
          docUrl: appsScriptResult.docUrl
        });

        if (appsScriptResult.success) {
          console.log('✅ [SUBMIT API] Document created successfully:', appsScriptResult.docId);

          // Invalidate cache on successful submission
          const mentorEmail = reportData?.mentorEmail;
          if (mentorEmail) {
            const cacheKeysToInvalidate = [
              `mentor-stats:${mentorEmail.toLowerCase().trim()}`,
              'mapping:bangkit',
              'mapping:maju'
            ];

            for (const key of cacheKeysToInvalidate) {
              cache.delete(key);
            }

            console.log(`🗑️ Cache invalidated for mentor: ${mentorEmail}`);
          }

          return res.status(200).json({
            success: true,
            message: 'Laporan berjaya dihantar dan dokumen telah dicipta!',
            rowNumber: newRowNumber,
            docId: appsScriptResult.docId
          });
        } else {
          console.error('❌ [SUBMIT API] Apps Script returned error:', appsScriptResult.message);
          console.error('❌ [SUBMIT API] Error details:', appsScriptResult);

          // Partial success: Sheet saved but document failed
          return res.status(200).json({
            success: false,
            partialSuccess: true,
            sheetSaved: true,
            documentCreated: false,
            error: 'Data disimpan tetapi dokumen gagal dicipta',
            message: 'Laporan telah disimpan di Google Sheet tetapi dokumen tidak dapat dijana. Sila hubungi admin dengan nombor row di bawah.',
            warning: appsScriptResult.message,
            rowNumber: newRowNumber,
            phase: 'document_generation',
            retryable: true
          });
        }
      } catch (parseError) {
        console.error('❌ [SUBMIT API] Failed to parse Apps Script response:', parseError);
        return res.status(200).json({
          success: false,
          partialSuccess: true,
          sheetSaved: true,
          documentCreated: false,
          error: 'Data disimpan tetapi respons dokumen tidak dapat diproses',
          message: 'Laporan telah disimpan di Google Sheet tetapi respons dokumen tidak sah. Sila hubungi admin dengan nombor row di bawah.',
          warning: 'Document processing response invalid',
          rowNumber: newRowNumber,
          phase: 'document_generation',
          retryable: true
        });
      }
    } else {
      console.error('❌ [SUBMIT API] Apps Script call failed with status:', appsScriptResponse.status);
      return res.status(200).json({
        success: false,
        partialSuccess: true,
        sheetSaved: true,
        documentCreated: false,
        error: 'Data disimpan tetapi Apps Script gagal',
        message: 'Laporan telah disimpan di Google Sheet tetapi Apps Script gagal dipanggil. Sila hubungi admin dengan nombor row di bawah.',
        warning: `Apps Script HTTP ${appsScriptResponse.status}`,
        rowNumber: newRowNumber,
        phase: 'document_generation',
        retryable: true
      });
    }

  } catch (error) {
    console.error('❌ Error in /api/submitMajuReport:', error);

    // Specific timeout error handling
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'Timeout - sila cuba lagi dalam beberapa saat',
        details: error.message,
        phase: error.message.includes('Sheets') ? 'sheet_write_timeout' : 'unknown_timeout',
        retryable: true
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: `Gagal menghantar laporan: ${error.message}`,
      details: error.message,
      retryable: false
    });
  }
}

// Helper function to map form data to sheet row
function mapMajuDataToSheetRow(data) {
  // This should match the order of your getLaporanMajuColumnHeaders() in Apps Script
  const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
  
  return [
    timestamp,                                    // Timestamp
    data.NAMA_MENTOR || '',                      // NAMA_MENTOR
    data.EMAIL_MENTOR || '',                     // EMAIL_MENTOR
    data.NAMA_MENTEE || '',                      // NAMA_MENTEE
    data.NAMA_BISNES || '',                      // NAMA_BISNES
    data.LOKASI_BISNES || '',                    // LOKASI_BISNES
    data.PRODUK_SERVIS || '',                    // PRODUK_SERVIS
    data.NO_TELEFON || '',                       // NO_TELEFON
    data.TARIKH_SESI || '',                      // TARIKH_SESI
    data.SESI_NUMBER || '',                      // SESI_NUMBER
    data.MOD_SESI || '',                         // MOD_SESI
    data.LOKASI_F2F || '',                       // LOKASI_F2F
    data.MASA_MULA || '',                        // MASA_MULA
    data.MASA_TAMAT || '',                       // MASA_TAMAT
    data.LATARBELAKANG_USAHAWAN || '',           // LATARBELAKANG_USAHAWAN
    JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []),     // DATA_KEWANGAN_BULANAN_JSON
    JSON.stringify(data.MENTORING_FINDINGS_JSON || []),        // MENTORING_FINDINGS_JSON
    data.REFLEKSI_MENTOR_PERASAAN || '',         // REFLEKSI_MENTOR_PERASAAN
    data.REFLEKSI_MENTOR_KOMITMEN || '',         // REFLEKSI_MENTOR_KOMITMEN
    data.REFLEKSI_MENTOR_LAIN || '',             // REFLEKSI_MENTOR_LAIN
    data.STATUS_PERNIAGAAN_KESELURUHAN || '',    // STATUS_PERNIAGAAN_KESELURUHAN
    data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '',    // RUMUSAN_DAN_LANGKAH_KEHADAPAN
    JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []),         // URL_GAMBAR_PREMIS_JSON
    JSON.stringify(data.URL_GAMBAR_SESI_JSON || []),           // URL_GAMBAR_SESI_JSON
    data.URL_GAMBAR_GW360 || '',                 // URL_GAMBAR_GW360
    data.Folder_ID || '',                        // Folder_ID (FIXED: was Mentee_Folder_ID)
    '',                                          // Laporan_Maju_Doc_ID (empty, will be filled by Apps Script)
    data.MIA_STATUS || 'Tidak MIA',              // MIA_STATUS
    data.MIA_REASON || '',                       // MIA_REASON
    data.MIA_PROOF_URL || ''                     // MIA_PROOF_URL
  ];
}