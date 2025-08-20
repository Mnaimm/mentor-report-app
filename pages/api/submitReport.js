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
 */
const mapMajuDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Adjust size if needed based on your Maju sheet's final columns

  row[0] = new Date().toISOString();                       // Timestamp
  row[1] = data.namaMentor || '';                          // NAMA_MENTOR
  row[2] = data.mentorEmail || '';                         // EMAIL_MENTOR
  row[3] = data.usahawan || '';                            // NAMA_MENTEE (from payload.usahawan)
  row[4] = data.namaSyarikat || '';                        // NAMA_BISNES (from payload.namaSyarikat)
  row[5] = data.LOKASI_BISNES || '';                       // LOKASI_BISNES
  row[6] = data.PRODUK_SERVIS || '';                       // PRODUK_SERVIS
  row[7] = data.NO_TELEFON || '';                          // NO_TELEFON
  row[8] = data.TARIKH_SESI || '';                         // TARIKH_SESI
  row[9] = data.sesiLaporan || '';                         // SESI_NUMBER (from payload.sesiLaporan)
  row[10] = data.MOD_SESI || '';                           // MOD_SESI
  row[11] = data.LOKASI_F2F || '';                         // LOKASI_F2F
  row[12] = data.MASA_MULA || '';                          // MASA_MULA
  row[13] = data.MASA_TAMAT || '';                         // MASA_TAMAT
  row[14] = data.LATARBELAKANG_USAHAWAN || '';             // LATARBELAKANG_USAHAWAN (Sesi 1 only, taken from previous history)
  row[15] = JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []); // DATA_KEWANGAN_BULANAN_JSON
  row[16] = JSON.stringify(data.MENTORING_FINDINGS_JSON || []); // MENTORING_FINDINGS_JSON
  row[17] = data.REFLEKSI_MENTOR_PERASAAN || '';           // REFLEKSI_MENTOR_PERASAAN
  row[18] = data.REFLEKSI_MENTOR_KOMITMEN || '';           // REFLEKSI_MENTOR_KOMITMEN
  row[19] = data.REFLEKSI_MENTOR_LAIN || '';               // REFLEKSI_MENTOR_LAIN
  // New fields for Maju program, placed next to REFLEKSI_MENTOR_LAIN as per your instruction (Column U in Sheet)
  row[20] = data.STATUS_PERNIAGAAN_KESELURUHAN || '';      // STATUS_PERNIAGAAN_KESELURUHAN (Column U)
  row[21] = data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '';      // RUMUSAN_DAN_LANGKAH_KEHADAPAN (Column V)
  // Continue with other image URLs and MIA fields
  row[22] = JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []); // URL_GAMBAR_PREMIS_JSON
  row[23] = JSON.stringify(data.URL_GAMBAR_SESI_JSON || []); // URL_GAMBAR_SESI_JSON
  row[24] = data.URL_GAMBAR_GW360 || '';                   // URL_GAMBAR_GW360
  row[25] = data.Mentee_Folder_ID || '';                   // Mentee_Folder_ID
  row[26] = data.Laporan_Maju_Doc_ID || '';                // Laporan_Maju_Doc_ID (Apps Script fills this)
  row[27] = data.MIA_STATUS || 'Tidak MIA';                // MIA_STATUS
  row[28] = data.MIA_REASON || '';                         // MIA_REASON
  row[29] = data.MIA_PROOF_URL || '';                      // MIA_PROOF_URL

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

    let spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID; // The single sheet ID
    let range;
    let rowData;
    let appsScriptUrl; // URL for the Apps Script to trigger document generation

    // Determine which tab, mapping function, and Apps Script URL to use based on programType
    if (programType === 'bangkit') {
      range = 'V8!A1'; // The tab for Bangkit reports
      rowData = mapBangkitDataToSheetRow(reportData);
      appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL; // Your existing Bangkit Apps Script URL
      if (!spreadsheetId || !appsScriptUrl) {
          throw new Error('Missing environment variables for Bangkit program.');
      }
    } else if (programType === 'maju') {
      range = process.env.LAPORAN_MAJU_TAB + '!A1'; // Use the environment variable for the tab name
      rowData = mapMajuDataToSheetRow(reportData);
      appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL; // Your existing Maju Apps Script URL
      if (!spreadsheetId || !appsScriptUrl) {
          throw new Error('Missing environment variables for Maju program. Please check LAPORAN_MAJU_TAB and NEXT_PUBLIC_APPS_SCRIPT_LAPORAN_MAJU_URL in .env.local');
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