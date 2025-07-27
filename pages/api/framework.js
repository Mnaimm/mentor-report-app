import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_BANK_ID,
      // Menggunakan nama helaian dan julat yang betul
      range: 'Bank!A:E', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]);
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => ({
      Focus_Area: row[0],
      Keputusan: row[1],
      Tindakan_1: row[2],
      Tindakan_2: row[3] || '',
    }));

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in /api/framework:", error);
    res.status(500).json({ error: 'Failed to fetch framework data' });
  }
}
