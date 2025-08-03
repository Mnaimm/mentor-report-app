import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Fetch data from the 'Bank' sheet.
    // Ensure your sheet is named "Bank" and the data is in columns A through E.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID, 
      range: 'Bank!A2:E', // Start from A2 to skip header row
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No data found in framework Bank sheet.' });
    }

    // Map the spreadsheet rows to a clean JSON object
    const data = rows.map(row => ({
      Focus_Area: row[0] || '',
      Keputusan: row[1] || '',
      Cadangan_Tindakan1: row[2] || '',
      Cadangan_Tindakan2: row[3] || '',
      Cadangan_Tindakan3: row[4] || '',
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cache for 1 hour
    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error in /api/frameworkBank:", error);
    res.status(500).json({ error: 'Failed to fetch framework data', details: error.message });
  }
}
