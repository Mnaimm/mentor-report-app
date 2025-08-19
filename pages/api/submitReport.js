// pages/api/submitReport.js
import { google } from 'googleapis';

/**
 * Helper: extract row number from Sheets API updatedRange
 * Example: "V8!A37:T37" -> 37
 */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

/**
 * Map form data -> your NEW V8 header order (0-based indexes)
 *
 *  0 Timestamp                          28 Jualan Mei
 *  1 Emai                               29 Jualan Jun
 *  2 Status Sesi                        30 Jualan Jul
 *  3 Sesi Laporan                       31 Jualan Ogos
 *  4 Tarikh Sesi                        32 Jualan Sep
 *  5 Masa Sesi                          33 Jualan Okt
 *  6 Mod Sesi                           34 Jualan Nov
 *  7 Nama Usahawan                      35 Jualan Dis
 *  8 Nama Bisnes                        36 Link Gambar
 *  9 Nama Mentor                        37 Produk/Servis
 * 10 Update Keputusan Terdahulu 1       38 Pautan Media Sosial
 * 11 Ringkasan Sesi                     39 Link_Carta_GrowthWheel
 * 12 Fokus Area 1                       40 Link_Bukti_MIA
 * 13 Keputusan 1                        41 Panduan_Pemerhatian_Mentor
 * 14 Cadangan Tindakan 1                42 Refleksi_Perasaan
 * 15 Fokus Area 2                       43 Refleksi_Skor
 * 16 Keputusan 2                        44 Refleksi_Alasan_Skor
 * 17 Cadangan Tindakan 2                45 Refleksi_Eliminate
 * 18 Fokus Area 3                       46 Refleksi_Raise
 * 19 Keputusan 3                        47 Refleksi_Reduce
 * 20 Cadangan Tindakan 3                48 Refleksi_Create
 * 21 Fokus Area 4                       49 Link_Gambar_Profil
 * 22 Keputusan 4                        50 Link_Gambar_Premis
 * 23 Cadangan Tindakan 4                51 Premis_Dilawat_Checked
 * 24 Jualan Jan                         52 Status   (leave blank; Apps Script fills)
 * 25 Jualan Feb                         53 DOC_URL (leave blank; Apps Script fills)
 * 26 Jualan Mac                         54..73 GW_Skor_1..20  (optional)
 * 27 Jualan Apr
 */
const mapDataToSheetRow = (data) => {
  const row = Array(100).fill('');

  // A–J
  row[0] = new Date().toISOString();                 // Timestamp
  row[1] = data?.mentorEmail || '';                  // Emai
  row[2] = data?.status || 'Selesai';                // Status Sesi
  row[3] = `Sesi #${data?.sesiLaporan ?? ''}`;       // Sesi Laporan
  row[4] = data?.sesi?.date || '';                   // Tarikh Sesi
  row[5] = data?.sesi?.time || '';                   // Masa Sesi
  row[6] = data?.sesi?.platform || '';               // Mod Sesi
  row[7] = data?.usahawan || '';                     // Nama Usahawan
  row[8] = data?.namaSyarikat || '';                 // Nama Bisnes
  row[9] = data?.namaMentor || '';                   // Nama Mentor

  // K: “Kemaskini Inisiatif Sesi Lepas” (textarea for sesi 2-4)
  const kemaskiniText = (data?.kemaskiniInisiatif || [])
    .map((t, i) => `Kemaskini Inisiatif #${i + 1}:\n${t}`)
    .join('\n\n');
  row[10] = kemaskiniText;                            // Update Keputusan Terdahulu 1

  // L: Ringkasan Sesi
  row[11] = data?.rumusan || '';

  // M–X: Fokus/Keputusan/Cadangan 1..4
  for (let i = 0; i < 4; i++) {
    const ini = data?.inisiatif?.[i];
    const base = 12 + i * 3; // 12,15,18,21
    if (ini) {
      row[base + 0] = ini?.focusArea || '';
      row[base + 1] = ini?.keputusan || '';
      row[base + 2] = ini?.pelanTindakan || '';
    }
  }

  // Y–AJ: Jualan 12 bulan
  (data?.jualanTerkini || []).forEach((v, i) => {
    if (i < 12) row[24 + i] = v ?? '0';
  });

  // AK: Link Gambar (session photos; can be multiple)
  row[36] = Array.isArray(data?.imageUrls?.sesi)
    ? data.imageUrls.sesi.join(', ')
    : (data?.imageUrls?.sesi || '');

  // AL–AM
  row[37] = data?.tambahan?.produkServis || '';       // Produk/Servis
  row[38] = data?.tambahan?.pautanMediaSosial || '';  // Pautan Media Sosial

  // AN: GrowthWheel chart
  row[39] = data?.imageUrls?.growthwheel || '';

  // AO: Bukti MIA (only if status === 'MIA')
  row[40] = data?.status === 'MIA' ? (data?.imageUrls?.mia || '') : '';

  // AP–AW: Sesi 1 extras (safe to leave blank for sesi 2–4)
  row[41] = data?.pemerhatian || '';                  // Panduan_Pemerhatian_Mentor
  row[42] = data?.refleksi?.perasaan || '';
  row[43] = data?.refleksi?.skor || '';
  row[44] = data?.refleksi?.alasan || '';
  row[45] = data?.refleksi?.eliminate || '';
  row[46] = data?.refleksi?.raise || '';
  row[47] = data?.refleksi?.reduce || '';
  row[48] = data?.refleksi?.create || '';

  // AX–AY: Profile & Premis photos
  row[49] = data?.imageUrls?.profil || '';           // Link_Gambar_Profil
  row[50] = Array.isArray(data?.imageUrls?.premis)
    ? data.imageUrls.premis.join(', ')
    : (data?.imageUrls?.premis || '');               // Link_Gambar_Premis

  // AZ: Premis checkbox
  row[51] = !!data?.premisDilawatChecked;            // Premis_Dilawat_Checked

  // BA–BB: leave blank; Apps Script fills STATUS + DOC_URL
  // row[52] = '';
  // row[53] = '';

  // BC–BV: GW_Skor_1..20 (optional)
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

    // Auth to Sheets
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Build row & append
    const rowData = mapDataToSheetRow(reportData);

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // Get the row number that was written
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    // Ping Apps Script to process that single row (generate Doc)
    if (newRowNumber) {
      try {
        await fetch(process.env.NEXT_PUBLIC_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber }),
        });
      } catch (e) {
        console.error('Automation ping failed:', e);
        // Non-fatal: if you also set up a time-driven trigger, it will pick up blank STATUS rows later
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
