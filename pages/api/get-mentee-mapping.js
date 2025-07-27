// pages/api/mapping.js (or get-mentee-mapping.js)
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    // 1. Decode the full credentials from a single Base64 string (Correct Method)
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    // 2. Authenticate using the full credentials object
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 3. Use the correct environment variable for the Spreadsheet ID
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAPPING_ID;
    // 4. Use the correct sheet name and range
    const range = 'mapping!A:G';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(404).json({ error: 'No data found in mapping sheet.' });
    }

    // 5. Use the correct property names and casing that the frontend expects
    const data = rows.slice(1).map(row => ({
      Batch: row[0] || '',
      Zon: row[1] || '',
      Mentor: row[2] || '',
      Usahawan: row[3] || '',
      Nama_Syarikat: row[4] || '',
      Alamat: row[5] || '',
      No_Tel: row[6] || 'N/A',
    }));

    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error in /api/mapping:", error);
    res.status(500).json({ error: 'Failed to fetch mapping data', details: error.message });
  }
}
