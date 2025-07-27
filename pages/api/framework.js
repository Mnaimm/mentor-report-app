// pages/api/framework.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;

    if (!base64) {
      throw new Error("❌ GOOGLE_CREDENTIALS_BASE64 is undefined or empty.");
    }

    // Decode and log for debug (remove in production)
    const decoded = Buffer.from(base64, 'base64').toString('ascii');
    console.log("✅ Decoded credentials string:", decoded);

    const credentials = JSON.parse(decoded);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_BANK_ID,
      range: 'Bank!A:E',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]);
    }

    const data = rows.slice(1).map(row => ({
      Focus_Area: row[0] || '',
      Keputusan: row[1] || '',
      Tindakan_1: row[2] || '',
      Tindakan_2: row[3] || '',
    }));

    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error in /api/framework:", error);
    res.status(500).json({ error: 'Failed to fetch framework data', details: error.message });
  }
}
