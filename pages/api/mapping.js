import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    // Decode the full credentials from a single Base64 string
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
      credentials, // Use the entire credentials object
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
