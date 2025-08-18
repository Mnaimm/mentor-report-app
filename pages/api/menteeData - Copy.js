import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Mentee name is required' });
    }

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Widen the range to fetch all necessary columns for history
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!C:AM', 
    });

    res.setHeader('Cache-Control', 'no-store');

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(200).json({ lastSession: 0, status: '', previousSales: [], previousInisiatif: [] });
    }

    const menteeRows = rows.slice(1).filter(row => row && row[5] === name); // Column H is index 5 in this range
    
    if (menteeRows.length === 0) {
        return res.status(200).json({ lastSession: 0, status: '', previousSales: [], previousInisiatif: [] });
    }

    // Find the row with the highest session number
    let latestRow = null;
    let lastSession = 0;
    menteeRows.forEach(row => {
        const sessionMatch = row[1].match(/#(\d+)/); // Column D is index 1
        if (sessionMatch) {
            const sessionNum = parseInt(sessionMatch[1], 10);
            if (sessionNum >= lastSession) {
                lastSession = sessionNum;
                latestRow = row;
            }
        }
    });

    if (!latestRow) {
        return res.status(200).json({ lastSession: 0, status: '', previousSales: [], previousInisiatif: [] });
    }

    // Extract previous sales data (Columns AB to AM)
    const previousSales = latestRow.slice(25, 37) || Array(12).fill('');

    // Extract previous initiatives (Columns P to AA)
    const previousInisiatif = [];
    for (let i = 0; i < 4; i++) {
        const offset = 13 + (i * 3); // Starts at Column P (index 13)
        if (latestRow[offset] && latestRow[offset+1]) {
            previousInisiatif.push({
                focusArea: latestRow[offset],
                keputusan: latestRow[offset + 1],
                pelanTindakan: latestRow[offset + 2] || '',
            });
        }
    }
    
    const status = latestRow[0]; // Column C is index 0

    res.status(200).json({ lastSession, status, previousSales, previousInisiatif });

  } catch (error) {
    console.error("❌ Error in /api/menteeData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data', details: error.message });
  }
}
