import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: 'Mentee name is required' });
    }

    // Decode the full credentials from a single Base64 string
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials, // Use the entire credentials object
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

    // Nama Usahawan is in Column G (index 6)
    const menteeRows = rows.slice(1).filter(row => row[6] === name);
    if (menteeRows.length === 0) {
      return res.status(200).json(null);
    }

    const latestRow = menteeRows[menteeRows.length - 1];
    
    const previousDecisions = [];
    // Keputusan starts at Column N (index 13), Cadangan at O (index 14)
    for (let i = 0; i < 4; i++) {
        const keputusan = latestRow[13 + (i * 3)];
        const tindakan = latestRow[14 + (i * 3)];
        if (keputusan && tindakan) {
            previousDecisions.push({ keputusan, tindakan });
        }
    }

    const data = {
      Sesi_Laporan: latestRow[2], // Sesi Laporan is in Column C (index 2)
      previousDecisions: previousDecisions,
    };

    // **FIX**: Add cache-control headers to prevent Vercel from caching the result
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(data);
  } catch (error) {
    console.error("❌ Error in /api/menteeData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data' });
  }
}
