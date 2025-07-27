import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const { rowData } = req.body;

    if (!rowData || !Array.isArray(rowData)) {
        return res.status(400).json({ error: 'Invalid data format.'});
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      // Menggunakan nama helaian yang betul untuk menambah data
      range: 'V8!A1', 
      valueInputOption: 'RAW',
      resource: {
        values: [rowData],
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error submitting to Google Sheets:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
}
