// pages/api/submit-upward-mobility.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const formData = req.body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // The order here MUST match the order of your 44 columns (A to AR)
    // The auto-filled fields are now correctly taken from formData
    const newRow = [
      new Date().toISOString(), // A: Timestamp
      formData.email, // B: Email Address
      formData.program, // C: Program
      formData.batch, // D: Batch
      formData.sesiMentoring, // E: Sesi Mentoring
      formData.namaMentor, // F: Nama Mentor (Auto-filled)
      formData.namaUsahawan, // G: Nama Penuh Usahawan (Auto-filled)
      formData.namaPerniagaan, // H: Nama Penuh Perniagaan (Auto-filled)
      formData.jenisPerniagaan, // I: Jenis Perniagaan (MANUAL INPUT)
      formData.alamatPerniagaan, // J: Alamat Perniagaan (Auto-filled)
      formData.nomborTelefon, // K: Nombor Telefon (Auto-filled)
      formData.statusPenglibatan, // L: Status Penglibatan
      formData.upwardMobilityStatus, // M: Upward Mobility Status
      formData.kriteriaImprovement, // N: Kriteria Improvement
      formData.tarikhLawatan, // O: Tarikh lawatan
      formData.penggunaanAkaunSemasa, // P: Penggunaan Akaun Semasa
      formData.penggunaanBimbBiz, // Q: Penggunaan BIMB Biz
      formData.bukaAkaunAlAwfar, // R: Buka akaun Al-Awfar
      formData.penggunaanBimbMerchant, // S: Penggunaan BIMB Merchant
      formData.lainLainFasiliti, // T: Lain-lain Fasiliti
      formData.langganMesinKira, // U: Langgan aplikasi MesinKira
      formData.pendapatanSebelum, // V: Jumlah Pendapatan (Sebelum)
      formData.pendapatanSelepas, // W: Jumlah Pendapatan (Selepas)
      formData.ulasanPendapatan, // X: Ulasan Mentor (Jumlah Pendapatan)
      formData.pekerjaanSebelum, // Y: Peluang Pekerjaan (Sebelum)
      formData.pekerjaanSelepas, // Z: Peluang Pekerjaan (Selepas)
      formData.ulasanPekerjaan, // AA: Ulasan Mentor (Peluang Pekerjaan)
      formData.asetBukanTunaiSebelum, // AB: Nilai Aset Bukan Tunai (Sebelum)
      formData.asetBukanTunaiSelepas, // AC: Nilai Aset Bukan Tunai (Selepas)
      formData.asetTunaiSebelum, // AD: Nilai Aset Bentuk Tunai (Sebelum)
      formData.asetTunaiSelepas, // AE: Nilai Aset Bentuk Tunai (Selepas)
      formData.ulasanAset, // AF: Ulasan Mentor (Nilai Aset)
      formData.simpananSebelum, // AG: Simpanan Perniagaan (Sebelum)
      formData.simpananSelepas, // AH: Simpanan Perniagaan (Selepas)
      formData.ulasanSimpanan, // AI: Ulasan Mentor (Simpanan)
      formData.zakatSebelum, // AJ: Pembayaran Zakat (Sebelum)
      formData.zakatSelepas, // AK: Pembayaran Zakat (Selepas)
      formData.ulasanZakat, // AL: Ulasan Mentor (Pembayaran Zakat)
      formData.digitalSebelum.join(', '), // AM: Penggunaan Digital (Sebelum)
      formData.digitalSelepas.join(', '), // AN: Penggunaan Digital (Selepas)
      formData.ulasanDigital, // AO: Ulasan Mentor (Penggunaan Digital)
      formData.onlineSalesSebelum.join(', '), // AP: Jualan dan Pemasaran (Sebelum)
      formData.onlineSalesSelepas.join(', '), // AQ: Jualan dan Pemasaran (Selepas)
      formData.ulasanOnlineSales, // AR: Ulasan Mentor (Jualan dan Pemasaran)
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.UPWARD_MOBILITY_SPREADSHEET_ID,
      range: process.env.RESPONSES_SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [newRow],
      },
    });

    res.status(200).json({ message: 'Form submitted successfully' });
  } catch (error) {
    console.error("Error in /api/submit-upward-mobility:", error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
}
