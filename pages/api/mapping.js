import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { programType } = req.query;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
        const statusColIndex = 0;
        const menteeNameColIndex = 5;
        reportRows.slice(1).forEach(row => {
            const status = row[statusColIndex];
            const menteeName = row[menteeNameColIndex];
            if (menteeName) {
                menteeStatus[menteeName] = status;
            }
        });
    }

    // This is the declaration and assignment of allMenteesFromMapping
    let allMenteesFromMapping = mappingRows.slice(1).map(row => ({
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

    // Logs related to allMenteesFromMapping should be *after* its declaration
    //console.log("Mentees before MIA filter:", allMenteesFromMapping.length); // Added this log for clearer picture

    // Filter out MIA mentees first (always apply this)
    //allMenteesFromMapping = allMenteesFromMapping.filter(mentee => menteeStatus[mentee.Usahawan] !== 'MIA');

    // These console.logs should be here, after allMenteesFromMapping has been defined and potentially filtered by MIA
    //console.log("Mentees available after MIA filter:", allMenteesFromMapping.length);
    //console.log("First 5 batches after MIA filter:", allMenteesFromMapping.slice(0, 5).map(m => m.Batch));

    let filteredMentees = [];

    if (programType === 'bangkit') {
      console.log("Applying 'bangkit' filter."); // Log inside the block
      filteredMentees = allMenteesFromMapping.filter(mentee => mentee.Batch && mentee.Batch.includes('Bangkit'));
      console.log("Mentees after 'bangkit' filter:", filteredMentees.length); // Log inside the block
    } else if (programType === 'maju') {
      console.log("Applying 'maju' filter."); // Log inside the block
      filteredMentees = allMenteesFromMapping.filter(mentee => mentee.Batch && mentee.Batch.toLowerCase().includes('maju')); // Using toLowerCase for robust matching
      console.log("Mentees after 'maju' filter:", filteredMentees.length); // Log inside the block
    } else {
      filteredMentees = [];
    }

    res.status(200).json(filteredMentees);

  } catch (error) {
    console.error("❌ Error in /api/mapping:", error);
    res.status(500).json({ error: 'Failed to fetch mapping data', details: error.message });
  }
}