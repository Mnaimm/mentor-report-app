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
    
    // Fetch the mentor-mentee mapping data
    const mappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
      range: 'mapping!A:K', // Read all relevant columns
    });
    const mappingRows = mappingResponse.data.values;

    if (!mappingRows || mappingRows.length < 2) {
      return res.status(404).json({ error: 'No data found in mapping sheet.' });
    }

    // Fetch the report data to check for MIA status
    const reportResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
        range: 'V8!C:H', // Column C for Status, Column H for Mentee Name
    });
    const reportRows = reportResponse.data.values || [];

    // Create a lookup map of mentees who are marked as MIA
    const menteeStatus = {};
    if (reportRows.length > 1) {
        reportRows.slice(1).forEach(row => {
            const status = row[0];
            const menteeName = row[5];
            if (menteeName) {
                // Only store the latest status
                menteeStatus[menteeName] = status;
            }
        });
    }

    // Filter out mentees who have a status of 'MIA'
    const activeMenteesData = mappingRows.slice(1).filter(row => {
        const menteeName = row[4]; // Mentee name is in Column E
        return menteeStatus[menteeName] !== 'MIA';
    });

    // Map the rows to a clean JSON object
    const data = activeMenteesData.map(row => ({
      Batch: row[0] || '',
      Zon: row[1] || '',
      Mentor: row[2] || '',
      Mentor_Email: row[3] || '',
      Usahawan: row[4] || '',
      Nama_Syarikat: row[5] || '',
      Alamat: row[6] || '',
      No_Tel: row[7] || 'N/A',
      Folder_ID: row[8] || '',
      Emel: row[9] || '',
      Jenis_Bisnes: row[10] || '',
    }));

    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error in /api/mapping:", error);
    res.status(500).json({ error: 'Failed to fetch mapping data', details: error.message });
  }
}
