// pages/api/submitMajuReport.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;
    console.log('📋 Received report data for MAJU submission');

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

    // Prepare row data
    const rowData = mapMajuDataToSheetRow(reportData);
    console.log('📊 Prepared row data:', rowData.slice(0, 5)); // Log first 5 values

    // Append data to Google Sheet
    console.log('📊 Appending data to Google Sheets...');
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

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
    console.log('📥 Apps Script response status:', appsScriptResponse.status);
    console.log('📥 Apps Script response text:', appsScriptText);

    if (appsScriptResponse.ok) {
      try {
        const appsScriptResult = JSON.parse(appsScriptText);
        if (appsScriptResult.success) {
          console.log('✅ Document created successfully:', appsScriptResult.docId);
          return res.status(200).json({ 
            success: true, 
            message: 'Laporan berjaya dihantar dan dokumen telah dicipta!',
            rowNumber: newRowNumber,
            docId: appsScriptResult.docId
          });
        } else {
          console.error('❌ Apps Script returned error:', appsScriptResult.message);
          return res.status(200).json({ 
            success: true, 
            message: `Laporan berjaya dihantar, tetapi ada masalah dengan dokumen: ${appsScriptResult.message}`,
            rowNumber: newRowNumber,
            warning: appsScriptResult.message
          });
        }
      } catch (parseError) {
        console.error('❌ Failed to parse Apps Script response:', parseError);
        return res.status(200).json({ 
          success: true, 
          message: 'Laporan berjaya dihantar, tetapi respons dokumen tidak dapat diproses.',
          rowNumber: newRowNumber,
          warning: 'Document processing response invalid'
        });
      }
    } else {
      console.error('❌ Apps Script call failed with status:', appsScriptResponse.status);
      return res.status(200).json({ 
        success: true, 
        message: 'Laporan berjaya dihantar, tetapi dokumen tidak dapat dicipta.',
        rowNumber: newRowNumber,
        warning: `Document creation failed (HTTP ${appsScriptResponse.status})`
      });
    }

  } catch (error) {
    console.error('❌ Error in /api/submitMajuReport:', error);
    return res.status(500).json({
      success: false,
      error: `Gagal menghantar laporan: ${error.message}`,
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
    data.Mentee_Folder_ID || '',                 // Mentee_Folder_ID
    '',                                          // Laporan_Maju_Doc_ID (empty, will be filled by Apps Script)
    data.MIA_STATUS || 'Tidak MIA',              // MIA_STATUS
    data.MIA_REASON || '',                       // MIA_REASON
    data.MIA_PROOF_URL || ''                     // MIA_PROOF_URL
  ];
}