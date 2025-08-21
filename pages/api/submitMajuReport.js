// Create a new file: pages/api/submitMajuReport.js
// This is a separate API just for maju reports to avoid affecting laporan-sesi

import { google } from 'googleapis';

const mapMajuDataToSheetRow = (data) => {
  const row = Array(100).fill('');

  // Map to your exact column structure
  row[0] = new Date().toISOString();                       // A: Timestamp
  row[1] = data.NAMA_MENTOR || '';                         // B: NAMA_MENTOR
  row[2] = data.EMAIL_MENTOR || '';                        // C: EMAIL_MENTOR
  row[3] = data.NAMA_MENTEE || '';                         // D: NAMA_MENTEE
  row[4] = data.NAMA_BISNES || '';                         // E: NAMA_BISNES
  row[5] = data.LOKASI_BISNES || '';                       // F: LOKASI_BISNES
  row[6] = data.PRODUK_SERVIS || '';                       // G: PRODUK_SERVIS
  row[7] = data.NO_TELEFON || '';                          // H: NO_TELEFON
  row[8] = data.TARIKH_SESI || '';                         // I: TARIKH_SESI
  row[9] = data.SESI_NUMBER || '';                         // J: SESI_NUMBER
  row[10] = data.MOD_SESI || '';                           // K: MOD_SESI
  row[11] = data.LOKASI_F2F || '';                         // L: LOKASI_F2F
  row[12] = data.MASA_MULA || '';                          // M: MASA_MULA
  row[13] = data.MASA_TAMAT || '';                         // N: MASA_TAMAT
  row[14] = data.LATARBELAKANG_USAHAWAN || '';             // O: LATARBELAKANG_USAHAWAN
  row[15] = JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []); // P: DATA_KEWANGAN_BULANAN_JSON
  row[16] = JSON.stringify(data.MENTORING_FINDINGS_JSON || []); // Q: MENTORING_FINDINGS_JSON
  row[17] = data.REFLEKSI_MENTOR_PERASAAN || '';           // R: REFLEKSI_MENTOR_PERASAAN
  row[18] = data.REFLEKSI_MENTOR_KOMITMEN || '';           // S: REFLEKSI_MENTOR_KOMITMEN
  row[19] = data.REFLEKSI_MENTOR_LAIN || '';               // T: REFLEKSI_MENTOR_LAIN
  row[20] = data.STATUS_PERNIAGAAN_KESELURUHAN || '';      // U: STATUS_PERNIAGAAN_KESELURUHAN
  row[21] = data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '';      // V: RUMUSAN_DAN_LANGKAH_KEHADAPAN
  row[22] = JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []); // W: URL_GAMBAR_PREMIS_JSON
  row[23] = JSON.stringify(data.URL_GAMBAR_SESI_JSON || []); // X: URL_GAMBAR_SESI_JSON
  row[24] = data.URL_GAMBAR_GW360 || '';                   // Y: URL_GAMBAR_GW360
  row[25] = data.Mentee_Folder_ID || '';                   // Z: Mentee_Folder_ID
  row[26] = data.Laporan_Maju_Doc_ID || '';                // AA: Laporan_Maju_Doc_ID
  row[27] = data.MIA_STATUS || 'Tidak MIA';                // AB: MIA_STATUS
  row[28] = data.MIA_REASON || '';                         // AC: MIA_REASON
  row[29] = data.MIA_PROOF_URL || '';                      // AD: MIA_PROOF_URL

  return row;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;

    // Auth
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Use maju-specific environment variables
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
    const range = 'LaporanMaju!A1';
    const rowData = mapMajuDataToSheetRow(reportData);
    const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL;

    if (!spreadsheetId || !appsScriptUrl) {
      throw new Error('Missing environment variables for Maju program.');
    }

    // Append data to Google Sheet
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // Get the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];

    // Trigger Apps Script for document generation
    if (newRowNumber && appsScriptUrl) {
      try {
        await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'processRow', 
            rowNumber: newRowNumber, 
            programType: 'maju' 
          }),
        });
      } catch (e) {
        console.error('Apps Script trigger failed:', e);
        // Don't block submission success if automation ping fails
      }
    }

    return res.status(200).json({ success: true, message: 'Laporan berjaya dihantar!' });

  } catch (error) {
    console.error('❌ Error in /api/submitMajuReport:', error);
    return res.status(500).json({
      success: false,
      error: `Gagal menghantar laporan: ${error.message}`,
    });
  }
}