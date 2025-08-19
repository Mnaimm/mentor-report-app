import { google } from 'googleapis';

// Helper: extract row number from Sheets API updatedRange
function getRowNumberFromUpdatedRange(updatedRange) {
  // Examples: "V8!A37:T37" or "V8!C37:H37"
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

// Map form data -> V8 row (indexes are 0-based)
// Key columns you care about:
//  - Link Gambar (col AN = 40)        -> index 39
//  - Link_Carta_GrowthWheel (BK = 63) -> index 62
//  - Link_Gambar_Premis (BN = 74)     -> index 73
const mapDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Plenty of columns

  // --- Basic Info ---
  row[0] = new Date().toISOString();     // Timestamp (A)
  row[1] = data.mentorEmail;             // Emai (B)
  row[2] = data.status || 'Selesai';     // Status Sesi (C)
  row[3] = `Sesi #${data.sesiLaporan}`;  // Sesi Laporan (D)
  row[4] = data.sesi?.date || '';        // Tarikh Sesi (E)
  row[5] = data.sesi?.time || '';        // Masa Sesi (F)
  row[6] = data.sesi?.platform || '';    // Mod Sesi (G)
  row[7] = data.usahawan || '';          // Nama Usahawan (H)
  row[8] = data.namaSyarikat || '';      // Nama Bisnes (I)
  row[9] = data.namaMentor || '';        // Nama Mentor (J)
  row[10] = data?.tambahan?.jenisBisnes || ''; // (K)

  // --- Inisiatif Utama (P..X) ---
  for (let i = 0; i < 4; i++) {
    const initiative = data.inisiatif?.[i];
    const colOffset = 15 + (i * 3); // P, Q, R ... up to X
    if (initiative) {
      row[colOffset]     = initiative.focusArea || '';
      row[colOffset + 1] = initiative.keputusan || '';
      row[colOffset + 2] = initiative.pelanTindakan || '';
    }
  }

  // --- Jualan Bulanan (AB–AM = 27..38) ---
  (data.jualanTerkini || []).forEach((sale, i) => {
    row[27 + i] = sale ?? '0';
  });

  // --- MIA vs Regular ---
  if (data.status === 'MIA') {
    row[14] = data.mia?.alasan || '';                   // Ringkasan Sesi (O)
    row[73] = data.imageUrls?.mia || '';                // Link_Bukti_MIA (BL)
    row[74] = !!data.premisDilawatChecked;              // Premis_Dilawat_Checked (BW)
  } else if (data.sesiLaporan === 1) {
    // Sesi 1
    row[14] = data.rumusan || '';                       // Ringkasan Sesi (O)

    row[39] = Array.isArray(data.imageUrls?.sesi)
      ? data.imageUrls.sesi.join(', ')                  // Link Gambar (AN) index 39
      : (data.imageUrls?.sesi || '');

    row[60] = data.tambahan?.produkServis || '';        // Produk/Servis (BI)
    row[61] = data.tambahan?.pautanMediaSosial || '';   // Pautan Media Sosial (BJ)
    row[62] = data.imageUrls?.growthwheel || '';        // Link_Carta_GrowthWheel (BK) ✅
    row[73] = Array.isArray(data.imageUrls?.premis)     // Link_Gambar_Premis (BN) ✅
      ? data.imageUrls.premis.join(', ')
      : (data.imageUrls?.premis || '');
    row[64] = data.pemerhatian || '';                   // Panduan_Pemerhatian_Mentor (BM)

    // Refleksi (BO–BT = 65..71)
    row[65] = data.refleksi?.perasaan || '';
    row[66] = data.refleksi?.skor || '';
    row[67] = data.refleksi?.alasan || '';
    row[68] = data.refleksi?.eliminate || '';
    row[69] = data.refleksi?.raise || '';
    row[70] = data.refleksi?.reduce || '';
    row[71] = data.refleksi?.create || '';

    row[72] = data.imageUrls?.profil || '';             // Link_Gambar_Profil (BU)
    row[74] = !!data.premisDilawatChecked;              // Premis_Dilawat_Checked (BW)
  } else {
    // Sesi 2/3/4
    const kemaskiniText = (data.kemaskiniInisiatif || [])
      .map((t, i) => `Kemaskini Inisiatif #${i + 1}:\n${t}`)
      .join('\n\n');

    row[14] = `KEMASKINI SESI LEPAS:\n${kemaskiniText}\n\nRUMUSAN SESI INI:\n${data.rumusan || ''}`;

    row[39] = Array.isArray(data.imageUrls?.sesi)
      ? data.imageUrls.sesi.join(', ')
      : (data.imageUrls?.sesi || '');

    row[73] = Array.isArray(data.imageUrls?.premis)     // BN ✅
      ? data.imageUrls.premis.join(', ')
      : (data.imageUrls?.premis || '');

    row[74] = !!data.premisDilawatChecked;              // BW
  }

  // Leave STATUS/DOC_URL empty; Apps Script fills them.
  return row;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const rowData = mapDataToSheetRow(reportData);

    // 1) Append to V8 and CAPTURE the response
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // 2) Get the row number from updatedRange
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    // 3) Ping Apps Script to process that single row
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
