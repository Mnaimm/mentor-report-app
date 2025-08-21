// pages/api/submitReport.js
import { google } from 'googleapis';

/** Extract the row number from "SheetName!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

/**
 * Maps data from laporan-sesi.js (Bangkit program) to its Google Sheet row.
 * Ensure this matches your 'V8' sheet column headers.
 */
const mapBangkitDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Adjust size if needed

  // A–J
  row[0] = new Date().toISOString();                     // 0  Timestamp
  row[1] = data?.mentorEmail || '';                      // 1  Email Mentor
  row[2] = data?.status || 'Selesai';                    // 2  Status Sesi
  row[3] = `Sesi #${data?.sesiLaporan ?? ''}`;           // 3  Sesi Laporan
  row[4] = data?.sesi?.date || '';                       // 4  Tarikh Sesi
  row[5] = data?.sesi?.time || '';                       // 5  Masa Sesi
  row[6] = data?.sesi?.platform || '';                   // 6  Mod Sesi
  row[7] = data?.usahawan || '';                         // 7  Nama Usahawan
  row[8] = data?.namaSyarikat || '';                     // 8  Nama Bisnes
  row[9] = data?.namaMentor || '';                       // 9  Nama Mentor

  // K: Kemaskini Inisiatif Sesi Lepas (textarea for sesi 2–4)
  const kemaskiniText = (data?.kemaskiniInisiatif || [])
    .map((t, i) => `Kemaskini Inisiatif #${i + 1}:\n${t}`)
    .join('\n\n');
  row[10] = kemaskiniText;                               // 10 Update Keputusan Terdahulu 1

  // L: Ringkasan Sesi
  row[11] = data?.rumusan || '';                         // 11 Ringkasan Sesi

  // M–X: Fokus/Keputusan/Cadangan 1..4
  for (let i = 0; i < 4; i++) {
    const ini = data?.inisiatif?.[i];
    const base = 12 + i * 3; // 12,15,18,21
    if (ini) {
      row[base + 0] = ini?.focusArea || '';              // 12/15/18/21 Fokus Area n
      row[base + 1] = ini?.keputusan || '';              // 13/16/19/22 Keputusan n
      row[base + 2] = ini?.pelanTindakan || '';          // 14/17/20/23 Cadangan Tindakan n
    }
  }

  // Y–AJ: Jualan 12 bulan (24..35)
  (data?.jualanTerkini || []).forEach((v, i) => {
    if (i < 12) row[24 + i] = v ?? '0';
  });

  // AK: Link Gambar (session; array ok)
  row[36] = Array.isArray(data?.imageUrls?.sesi)
    ? data.imageUrls.sesi.join(', ')
    : (data?.imageUrls?.sesi || '');

  // AL–AM
  row[37] = data?.tambahan?.produkServis || '';         // 37 Produk/Servis
  row[38] = data?.tambahan?.pautanMediaSosial || '';    // 38 Pautan Media Sosial

  // AN: GrowthWheel chart
  row[39] = data?.imageUrls?.growthwheel || '';         // 39 Link_Carta_GrowthWheel

  // AO: Bukti MIA (only if status === 'MIA') - This is `imageUrls.mia` from laporan-sesi.js
  row[40] = data?.status === 'MIA' ? (data?.imageUrls?.mia || '') : ''; // 40 Link_Bukti_MIA

  // AP–AW: Sesi 1 extras (safe blank for 2–4)
  row[41] = data?.pemerhatian || '';                    // 41 Panduan_Pemerhatian_Mentor
  row[42] = data?.refleksi?.perasaan || '';             // 42 Refleksi_Perasaan
  row[43] = data?.refleksi?.skor || '';                 // 43 Refleksi_Skor
  row[44] = data?.refleksi?.alasan || '';               // 44 Refleksi_Alasan_Skor
  row[45] = data?.refleksi?.eliminate || '';            // 45 Refleksi_Eliminate
  row[46] = data?.refleksi?.raise || '';                // 46 Refleksi_Raise
  row[47] = data?.refleksi?.reduce || '';               // 47 Refleksi_Reduce
  row[48] = data?.refleksi?.create || '';               // 48 Refleksi_Create

  // AX–AY: Profile & Premis photos
  row[49] = data?.imageUrls?.profil || '';              // 49 Link_Gambar_Profil
  row[50] = Array.isArray(data?.imageUrls?.premis)
    ? data.imageUrls.premis.join(', ')
    : (data?.imageUrls?.premis || '');                  // 50 Link_Gambar_Premis

  // AZ: Premis checkbox
  row[51] = !!data?.premisDilawatChecked;               // 51 Premis_Dilawat_Checked

  // BA–BB left blank — Apps Script fills "Status" & "DOC_URL"
  // row[52] = ''; // Status
  // row[53] = ''; // DOC_URL

  // BC.. GW scores if you capture them
  (data?.gwSkor || []).slice(0, 20).forEach((v, i) => {
    row[54 + i] = v ?? '';
  });

  return row;
};


/**
 * Maps data from laporan-alt.js (Maju program) to its Google Sheet row.
 * Make sure these indices and data points match your Maju Google Sheet's 'LaporanMaju' tab.
 *
 * IMPORTANT: For DATA_KEWANGAN_BULANAN_JSON and MENTORING_FINDINGS_JSON,
 * the frontend (`laporan-alt.js`) is responsible for combining
 * previous findings/data with new inputs/updates before sending to this API.
 * This function will then store the CUMULATIVE array for the current session.
 */
/**
 * Maps data from laporan-maju.js to its Google Sheet row.
 * Updated to match the exact LaporanMaju sheet column structure.
 */
const mapMajuDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Adjust size if needed

  // A-N: Basic session info
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

  // O-T: Content sections
  row[14] = data.LATARBELAKANG_USAHAWAN || '';             // O: LATARBELAKANG_USAHAWAN
  row[15] = JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []); // P: DATA_KEWANGAN_BULANAN_JSON
  row[16] = JSON.stringify(data.MENTORING_FINDINGS_JSON || []); // Q: MENTORING_FINDINGS_JSON
  row[17] = data.REFLEKSI_MENTOR_PERASAAN || '';           // R: REFLEKSI_MENTOR_PERASAAN
  row[18] = data.REFLEKSI_MENTOR_KOMITMEN || '';           // S: REFLEKSI_MENTOR_KOMITMEN
  row[19] = data.REFLEKSI_MENTOR_LAIN || '';               // T: REFLEKSI_MENTOR_LAIN

  // U-V: Enhanced sections (Sesi 2+)
  row[20] = data.STATUS_PERNIAGAAN_KESELURUHAN || '';      // U: STATUS_PERNIAGAAN_KESELURUHAN
  row[21] = data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '';      // V: RUMUSAN_DAN_LANGKAH_KEHADAPAN

  // W-Y: Image URLs
  row[22] = JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []); // W: URL_GAMBAR_PREMIS_JSON
  row[23] = JSON.stringify(data.URL_GAMBAR_SESI_JSON || []); // X: URL_GAMBAR_SESI_JSON
  row[24] = data.URL_GAMBAR_GW360 || '';                   // Y: URL_GAMBAR_GW360

  // Z-AA: Folder and Doc IDs
  row[25] = data.Mentee_Folder_ID || '';                   // Z: Mentee_Folder_ID
  row[26] = data.Laporan_Maju_Doc_ID || '';                // AA: Laporan_Maju_Doc_ID (Apps Script fills this)

  // AB-AD: MIA fields
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
    const { programType } = reportData; // Extract programType from the payload

    if (!programType) {
      return res.status(400).json({ error: 'Program type is missing in the request body.' });
    }

    // Auth
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // IMPORTANT: This 'spreadsheetId' MUST be the one that contains BOTH Bangkit and Maju tabs.
    // If you have separate spreadsheets for Bangkit and Maju, you need to revisit this logic
    // and use `process.env.GOOGLE_SHEETS_MAJU_REPORT_ID` for 'maju' programType,
    // and `process.env.GOOGLE_SHEETS_REPORT_ID` for 'bangkit'.
    // Your previous conversation implies two separate sheets (`GOOGLE_SHEETS_REPORT_ID` and `GOOGLE_SHEETS_MAJU_REPORT_ID`).
    // So, I'll update this section to use separate spreadsheet IDs.
    let spreadsheetId;
    let range;
    let rowData;
    let appsScriptUrl; // URL for the Apps Script to trigger document generation

    // Determine which sheet, tab, mapping function, and Apps Script URL to use based on programType
    if (programType === 'bangkit') {
      spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID; // Your existing Bangkit sheet ID
      range = 'V8!A1'; // The tab for Bangkit reports
      rowData = mapBangkitDataToSheetRow(reportData);
      appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL; // Your existing Bangkit Apps Script URL
      if (!spreadsheetId || !appsScriptUrl) {
          throw new Error('Missing environment variables for Bangkit program.');
      }
    } else if (programType === 'maju') {
      spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID; // Your NEW Maju sheet ID
      range = process.env.LAPORAN_MAJU_TAB + '!A1'; // Use the environment variable for the tab name
      rowData = mapMajuDataToSheetRow(reportData);
      appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_MAJU_URL; // Your NEW Maju Apps Script URL (renamed from LAPORAN_MAJU_URL for clarity)
      if (!spreadsheetId || !appsScriptUrl || !process.env.LAPORAN_MAJU_TAB) {
          throw new Error('Missing environment variables for Maju program. Please check GOOGLE_SHEETS_MAJU_REPORT_ID, LAPORAN_MAJU_TAB and NEXT_PUBLIC_APPS_SCRIPT_MAJU_URL in .env.local');
      }
    } else {
      return res.status(400).json({ error: 'Invalid programType specified.' });
    }

    // Append data to the determined Google Sheet and tab
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // Get the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    // If successful, trigger the corresponding Apps Script automation
    if (newRowNumber) {
      try {
        await fetch(appsScriptUrl, { // Use the correct Apps Script URL
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber, programType: programType }), // Pass programType to Apps Script
        });
      } catch (e) {
        console.error(`Automation ping for ${programType} failed:`, e);
        // Do not block submission success if automation ping fails
      }
    }

    return res.status(200).json({ success: true, message: 'Laporan berjaya dihantar!' });

  } catch (error) {
    console.error('❌ Error in /api/submitReport:', error);
    return res.status(500).json({
      success: false,
      error: `Gagal menghantar laporan ke Google Sheets: ${error.message}`,
      details: error.message,
    });
  }
}