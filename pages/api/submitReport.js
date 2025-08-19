import { google } from 'googleapis';

// This helper function maps your form data to the correct columns in the Google Sheet.
const mapDataToSheetRow = (data) => {
    const row = Array(100).fill(''); // Create a blank row with plenty of columns
// Helper: extract row number from Sheets API updatedRange
function getRowNumberFromUpdatedRange(updatedRange) {
  // Example updatedRange: "V8!A37:T37" or "V8!C37:H37"
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

    // --- Basic Info (Common to all sessions) ---
    row[0] = new Date().toISOString(); // Timestamp (Column A)
    row[1] = data.mentorEmail; // Mentor Email (Column B)
    row[2] = data.status || 'Selesai'; // Status (Column C) - 'Selesai' or 'MIA'
    row[3] = `Sesi #${data.sesiLaporan}`; // Sesi # (Column D)
    row[4] = data.sesi.date; // Tarikh Sesi (Column E)
    row[5] = data.sesi.time; // Masa Sesi (Column F)
    row[6] = data.sesi.platform; // Mod Sesi (Column G)
    row[7] = data.usahawan; // Nama Usahawan (Column H)
    row[8] = data.namaSyarikat; // Nama Syarikat (Column I)
    row[9] = data.namaMentor; // Nama Mentor (Column J)
    row[10] = data.tambahan.jenisBisnes; // Jenis Bisnes (Column K)

    // --- Inisiatif Utama (Common to Sesi 1 and Sesi 2+) ---
    for (let i = 0; i < 4; i++) {
        const initiative = data.inisiatif[i];
        const colOffset = 15 + (i * 3); // Starts at Column P
        if (initiative) {
            row[colOffset] = initiative.focusArea || '';
            row[colOffset + 1] = initiative.keputusan || '';
            row[colOffset + 2] = initiative.pelanTindakan || '';
        }
    }

    // --- Jualan Bulanan Terkini (Common to Sesi 1 and Sesi 2+) ---
    data.jualanTerkini.forEach((sale, i) => {
        row[27 + i] = sale || '0'; // Starts at Column AB
    });

    // --- Handle MIA vs. Regular Report ---
    if (data.status === 'MIA') {
        row[14] = data.mia.alasan; // Penerangan MIA in Ulasan Mentor column (Column O)
        row[63] = data.imageUrls.mia; // Link_Bukti_MIA (Column BL)
        row[74] = !!data.premisDilawatChecked;    // Column BW (checkbox)
    } 
    // --- Handle Sesi 1 vs Sesi 2+ for Regular Reports ---
    else if (data.sesiLaporan === 1) {
        row[14] = data.rumusan; // Rumusan Keseluruhan (Column O)
        row[39] = data.imageUrls.sesi.join(', '); // Link Gambar Sesi (Column AN)
        row[60] = data.tambahan.produkServis; // Produk/Servis (Column BI)
        row[61] = data.tambahan.pautanMediaSosial; // Pautan Media Sosial (Column BJ)
        row[62] = data.imageUrls.growthwheel; // Link Carta GrowthWheel (Column BK)
        row[63] = data.imageUrls.premis.join(', '); // Link Gambar Premis (Column BL)
        row[64] = data.pemerhatian; // Pemerhatian Mentor (Column BM)
        
        // Refleksi Mentor
        row[65] = data.refleksi.perasaan;
        row[66] = data.refleksi.skor;
        row[67] = data.refleksi.alasan;
        row[68] = data.refleksi.eliminate;
        row[69] = data.refleksi.raise;
        row[70] = data.refleksi.reduce;
        row[71] = data.refleksi.create;

        row[72] = data.imageUrls.profil; // Link Gambar Profil (Column BU)
        row[74] = !!data.premisDilawatChecked;    // Column BW (checkbox)
    } 
    else { // This handles Sesi 2, 3, 4, etc.
        // Combine initiative updates and summary into the main summary column
        const kemaskiniText = (data.kemaskiniInisiatif || [])
            .map((update, index) => `Kemaskini Inisiatif #${index + 1}:\n${update}`)
            .join('\n\n');
        
        row[14] = `KEMASKINI SESI LEPAS:\n${kemaskiniText}\n\nRUMUSAN SESI INI:\n${data.rumusan || ''}`; // Ulasan/Rumusan (Column O)
        row[39] = data.imageUrls.sesi.join(', '); // Link Gambar Sesi (Column AN)
        row[63] = (data.imageUrls?.premis || []).join(', '); // Column BL (premis uploaded in Sesi 2+)
        row[74] = !!data.premisDilawatChecked;    // Column BW (checkbox)
    }

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

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
            range: 'V8!A1', // Append to the 'V8' sheet
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [rowData],
            },
        });
        // --- NEW: Ping Apps Script automation for this row ---
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


        res.status(200).json({ success: true, message: 'Laporan berjaya dihantar!' });

    } catch (error) {
        console.error("❌ Error in /api/submitReport:", error);
        res.status(500).json({ success: false, error: 'Gagal menghantar laporan ke Google Sheets.', details: error.message });
    }
}
