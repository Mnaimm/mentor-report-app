// pages/api/submitReport.js
import { google } from 'googleapis';

/** Extract the row number from "V8!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

/**
 * Map form data -> your NEW V8 header order (0-based)
 * See inline index comments for easy debugging.
 */
const mapDataToSheetRow = (data) => {
  const row = Array(100).fill('');

  // A–J
  row[0]  = new Date().toISOString();                    // 0  Timestamp
  row[1]  = data?.mentorEmail || '';                     // 1  Emai
  row[2]  = data?.status || 'Selesai';                   // 2  Status Sesi
  row[3]  = `Sesi #${data?.sesiLaporan ?? ''}`;          // 3  Sesi Laporan
  row[4]  = data?.sesi?.date || '';                      // 4  Tarikh Sesi
  row[5]  = data?.sesi?.time || '';                      // 5  Masa Sesi
  row[6]  = data?.sesi?.platform || '';                  // 6  Mod Sesi
  row[7]  = data?.usahawan || '';                        // 7  Nama Usahawan
  row[8]  = data?.namaSyarikat || '';                    // 8  Nama Bisnes
  row[9]  = data?.namaMentor || '';                      // 9  Nama Mentor

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
      row[base + 0] = ini?.focusArea || '';             // 12/15/18/21 Fokus Area n
      row[base + 1] = ini?.keputusan || '';             // 13/16/19/22 Keputusan n
      row[base + 2] = ini?.pelanTindakan || '';         // 14/17/20/23 Cadangan Tindakan n
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

  // AO: Bukti MIA (only if status === 'MIA')
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

    // Append
    const rowData = mapDataToSheetRow(reportData);
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // Row number → ping Apps Script to generate Doc
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    if (newRowNumber) {
      try {
        await fetch(process.env.NEXT_PUBLIC_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber }),
        });
      } catch (e) {
        console.error('Automation ping failed:', e);
      }
    }

    return res.status(200).json({ success: true, message: 'Laporan berjaya dihantar!' });

  } catch (error) {
    console.error('❌ Error in /api/submitReport:', error);
    return res.status(500).json({
      success: false,
      error: 'Gagal menghantar laporan ke Google Sheets.',
      details: error.message,
    });
  }
}
