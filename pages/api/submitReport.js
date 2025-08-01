import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const { rowData } = req.body;

    if (!rowData || !Array.isArray(rowData)) {
        return res.status(400).json({ error: 'Invalid data format.'});
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A1', 
      valueInputOption: 'RAW',
      resource: {
        values: [rowData],
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error in /api/submitReport:", error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
}
