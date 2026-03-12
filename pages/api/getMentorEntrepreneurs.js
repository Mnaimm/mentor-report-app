import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { google } from 'googleapis';

export default async function handler(req, res) {
  // Auth check - require login
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized - Please login' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mentorEmail = session.user.email;

    console.log('🔍 Fetching entrepreneurs for mentor:', mentorEmail);

    // Fetch from Google Sheets mapping (which has all the data including address)
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const mappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
      range: 'mapping!A:L',
    });
    const mappingRows = mappingResponse.data.values;

    if (!mappingRows || mappingRows.length < 2) {
      return res.status(404).json({ error: 'No data found in mapping sheet.' });
    }

    // Filter rows for this mentor and transform to usable format
    const entrepreneurs = mappingRows.slice(1)
      .filter(row => {
        const rowMentorEmail = (row[3] || '').toLowerCase().trim();
        return rowMentorEmail === mentorEmail.toLowerCase().trim();
      })
      .map(row => {
        const batch = row[0] || '';
        let programType = 'Unknown';
        if (batch.toLowerCase().includes('bangkit')) {
          programType = 'Bangkit';
        } else if (batch.toLowerCase().includes('maju')) {
          programType = 'Maju';
        }

        return {
          mentee_name: row[4] || '',
          entrepreneur_id: row[5] || '',
          business_name: row[6] || '',
          address: row[7] || '',
          phone: row[8] || '',
          email: row[10] || '',
          business_type: row[11] || '',
          zone: row[1] || '',
          batch: batch,
          program_type: programType,
          mentor_name: row[2] || '',
          mentor_email: row[3] || '',
          folder_id: row[9] || ''
        };
      });

    console.log(`✅ Found ${entrepreneurs.length} entrepreneurs for ${mentorEmail}`);

    return res.status(200).json({
      success: true,
      data: entrepreneurs,
      count: entrepreneurs.length
    });

  } catch (error) {
    console.error('❌ Error in getMentorEntrepreneurs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
