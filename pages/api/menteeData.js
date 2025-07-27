import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Mentee name is required' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A:AK', 
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(200).json(null);
    }

    // **CHANGE**: Nama Usahawan is now in Column G (index 6)
    const menteeRows = rows.slice(1).filter(row => row[6] === name);
    if (menteeRows.length === 0) {
      return res.status(200).json(null);
    }

    const latestRow = menteeRows[menteeRows.length - 1];
    
    const previousDecisions = [];
    // **CHANGE**: Updated indices for previous decisions based on the new structure
    for (let i = 0; i < 4; i++) {
        const keputusan = latestRow[13 + (i * 3)]; // Starts at N
        const tindakan = latestRow[14 + (i * 3)]; // Starts at O
        if (keputusan && tindakan) {
            previousDecisions.push({ keputusan, tindakan });
        }
    }

    const data = {
      // **CHANGE**: Sesi Laporan is now in Column C (index 2)
      Sesi_Laporan: latestRow[2], 
      previousDecisions: previousDecisions,
    };

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in /api/menteeData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data' });
  }
}
