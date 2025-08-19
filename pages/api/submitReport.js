import { google } from 'googleapis';

// Helper: extract row number from Sheets API updatedRange
function getRowNumberFromUpdatedRange(updatedRange) {
  // Example updatedRange: "V8!A37:T37" or "V8!C37:H37"
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

// This helper function maps your form data to the correct columns in the Google Sheet.
const mapDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Create a blank row with plenty of columns

  // --- Basic Info (Common to all sessions) ---
  row[0] = new Date().toISOString();     // Timestamp (A)
  row[1] = data.mentorEmail;             // Emai (B)
  row[2] = data.status || 'Selesai';     // Status Sesi (C)
  row[3] = `Sesi #${data.sesiLaporan}`;  // Sesi Laporan (D)
  row[4] = data.sesi.date;               // Tarikh Sesi (E)
  row[5] = data.sesi.time;               // Masa Sesi (F)
  row[6] = data.sesi.platform;           // Mod Sesi (G)
  row[7] = data.usahawan;                // Nama Usahawan (H)
  row[8] = data.namaSyarikat;            // Nama Bisnes (I)
  row[9] = data.namaMentor;              // Nama Mentor (J)
  row[10] = data.tambahan.jenisBisnes;   // (K) — not used by automation but ok to keep

  // --- Inisiatif Utama (P onward) ---
  for (let i = 0; i < 4; i++) {
    const initiative = data.inisiatif[i];
    const colOffset = 15 + (i * 3); // P, Q, R ... up to X
    if (initiative) {
      row[colOffset] = initiative.focusArea || '';
      row[colOffset + 1] = initiative.keputusan || '';
      row[colOffset + 2] = initiative.pelanTindakan || '';
    }
  }

  // --- Jualan Bulanan (AB–AM = 27..38) ---
  data.jualanTerkini.forEach((sale, i) => {
    row[27 + i] = sale || '0';
  });

  // --- Handle MIA vs Regular ---
  if (data.status === 'MIA') {
    row[14] = data.mia.alasan;                      // Ringkasan Sesi (O)
    row[63] = data.imageUrls.mia || '';             // Link_Bukti_MIA (BL)
    row[74] = !!data.premisDilawatChecked;          // Premis_Dilawat_Checked (BW)
  } else if (data.sesiLaporan === 1) {
    // Sesi 1
    row[14] = data.rumusan || '';                   // Ringkasan Sesi (O)
    row[39] = (data.imageUrls.sesi || []).join(', ');        // Link Gambar (AN) index 39
    row[60] = data.tambahan.produkServis || '';             // Produk/Servis (BI) index 60
    row[61] = data.tambahan.pautanMediaSosial || '';        // Pautan Media Sosial (BJ) index 61
    row[62] = data.imageUrls.growthwheel || '';             // Link_Carta_GrowthWheel (BK) index 62
    row[73] = (data.imageUrls.premis || []).join(', ');     // Link_Gambar_Premis (BN) index 73  ✅ FIXED
    row[64] = data.pemerhatian || '';                       // Panduan_Pemerhatian_Mentor (BM)

    // Refleksi (BO–BT = 65..71)
    row[65] = data.refleksi.perasaan || '';
    row[66] = data.refleksi.skor || '';
    row[67] = data.refleksi.alasan || '';
    row[68] = data.refleksi.eliminate || '';
    row[69] = data.refleksi.raise || '';
    row[70] = data.refleksi.reduce || '';
    row[71] = data.refleksi.create || '';

    row[72] = data.imageUrls.profil || '';                 // Link_Gambar_Profil (BU) index 72
    row[74] = !!data.premisDilawatChecked;                 // Premis_Dilawat_Checked (BW)
  } else {
    // Sesi 2,3,4…
    const kemaskiniText = (data.kemaskiniInisiatif || [])
      .map((update, idx) => `Kemaskini Inisiatif #${idx + 1}:\n${update}`)
      .join('\n\n');

    row[14] = `KEMASKINI SESI LEPAS:\n${kemaskiniText}\n\nRUMUSAN SESI INI:\n${data.rumusan || ''}`;
    row[39] = (data.imageUrls.sesi || []).join(', ');      // Link Gambar (AN) index 39
    row[73] = (data.imageUrls.premis || []).join(', ');    // Link_Gambar_Premis (BN) index 73  ✅ FIXED
    row[74] = !!data.premisDilawatChecked;                 // Premis_Dilawat_Checked (BW)
  }

  // NOTE: Leave STATUS/DOC_URL empty; Apps Script fills them.
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

    // SAVE → Append to V8
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowData] },
    });

    // AFTER SAVE → Ping Apps Script to generate Doc for this row
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    if (newRowNumber) {
      try {
        await fetch(process.env.NEXT_PUBLIC_APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'processRow', rowNumber: newRowNumber })
        });
      } catch (e) {
        console.error('Automation ping failed:', e);
      }
    }

    return res.status(200).json({ success: true, message: 'Laporan berjaya dihantar!' });

  } catch (error) {
    console.error("❌ Error in /api/submitReport:", error);
    return res.status(500).json({
      success: false,
      error: 'Gagal menghantar laporan ke Google Sheets.',
      details: error.message
    });
  }
}
