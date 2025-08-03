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
    
    const mappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
      range: 'mapping!A:K',
    });
    const mappingRows = mappingResponse.data.values;

    if (!mappingRows || mappingRows.length < 2) {
      return res.status(404).json({ error: 'No data found in mapping sheet.' });
    }

    const reportResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
        range: 'V8!C:H',
    });
    const reportRows = reportResponse.data.values || [];

    const menteeStatus = {};
    if (reportRows.length > 1) {
        reportRows.slice(1).forEach(row => {
            const status = row[0];
            const menteeName = row[5];
            if (menteeName) {
                menteeStatus[menteeName] = status;
            }
        });
    }

    const activeMenteesData = mappingRows.slice(1).filter(row => {
        // Use the personal name from Column E for the MIA check
        const menteeName = row[4]; 
        return menteeStatus[menteeName] !== 'MIA';
    });

    // --- THIS IS THE CORRECTED MAPPING ---
const data = activeMenteesData.map(row => {


  return {
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
  };
});

    res.status(200).json(data);

  } catch (error) {
    console.error("❌ Error in /api/mapping:", error);
    res.status(500).json({ error: 'Failed to fetch mapping data', details: error.message });
  }
}
