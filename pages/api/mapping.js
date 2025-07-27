import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    // Decode the private key from Base64
    const privateKey = Buffer.from(process.env.GOOGLE_SHEETS_PRIVATE_KEY_BASE64, 'base64').toString('ascii');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
      range: 'mapping!A:G', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]);
    }

    const data = rows.slice(1).map(row => ({
      Batch: row[0],
      Zon: row[1],
      Mentor: row[2],
      Usahawan: row[3],
      Nama_Syarikat: row[4],
      Alamat: row[5],
      No_Tel: row[6] || 'N/A',
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error("❌ Error in /api/mapping:", error);
    res.status(500).json({ error: 'Failed to fetch mapping data' });
  }
}
