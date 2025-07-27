// pages/api/get-mentee-mapping.js
import { google } from 'googleapis';
export default async function handler(req, res) {
  try {
    // Decode the full credentials from a single Base64 string
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials, // Use the entire credentials object
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });


    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: Buffer.from(process.env.GOOGLE_SHEETS_PRIVATE_KEY_BASE64, 'base64').toString('utf-8'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Read an extra column for the new "Batch" field (A:G)
    const range = `'${sheetName}'!A:G`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(500).json({ error: 'No data found in mapping sheet.' });
    }

    // Update mapping to include the new "batch" field from column A
    const data = rows.slice(1).map(row => ({
      batch: row[0] || '',
      zon: row[1] || '',
      mentor: row[2] || '',
      mentee: row[3] || '',
      namaSyarikat: row[4] || '',
      alamat: row[5] || '',
      noTelefon: row[6] || '',
    }));

    res.status(200).json(data);

  } catch (error) {
    console.error("\n--- [CRITICAL ERROR] in /api/get-mentee-mapping ---");
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch mapping data', details: error.message });
  }
}
