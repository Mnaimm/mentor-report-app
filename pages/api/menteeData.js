// pages/api/menteeData.js - PROPOSED ENHANCEMENT for LaporanMajuPage.js
import { google } from 'googleapis';

const normHeader = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

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
    
    const REPORT_SHEET_ID = process.env.GOOGLE_SHEETS_REPORT_ID;
    const REPORT_TAB = process.env.REPORT_TAB || "V8"; // Default to V8

    // Fetch the entire sheet to get headers and all data
    const reportResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: REPORT_SHEET_ID,
      range: `${REPORT_TAB}!A:ZZ`, // Fetch a wide range to get all potential columns
    });

    res.setHeader('Cache-Control', 'no-store');

    const reportRows = reportResponse.data.values;
    if (!reportRows || reportRows.length < 1) { // Need at least headers
      return res.status(200).json({ 
        currentSession: 1, 
        previousData: null, 
        latarBelakangUsahawanSesi1: '',
        hasPremisPhotos: false, 
        menteeMapping: null 
      });
    }

    const headers = reportRows[0].map(normHeader); // Normalize headers
    const dataRows = reportRows.slice(1);

    // Find column indices dynamically using normalized headers
    const menteeNameColIndex = headers.indexOf(normHeader('nama mentee'));
    const sesiNumberColIndex = headers.indexOf(normHeader('sesi number')); // Assuming this is the exact header now
    const latarBelakangColIndex = headers.indexOf(normHeader('latar belakang usahawan')); 
    const dataKewanganJsonColIndex = headers.indexOf(normHeader('data_kewangan_bulanan_json'));
    const mentoringFindingsJsonColIndex = headers.indexOf(normHeader('mentoring_findings_json'));
    const premisPhotosColIndex = headers.indexOf(normHeader('url_gambar_premis_json'));

    // Check if critical columns exist
    if (menteeNameColIndex === -1 || sesiNumberColIndex === -1) {
        return res.status(500).json({ error: 'Required columns (Nama Mentee or Sesi Number) not found in V8 sheet headers' });
    }

    const menteeReports = dataRows.filter(row => row && (row[menteeNameColIndex] || '') === name);
    
    let currentSession = 1;
    let latestPreviousData = null; // Contains DATA_KEWANGAN_BULANAN_JSON and MENTORING_FINDINGS_JSON from previous session
    let latarBelakangUsahawanSesi1 = '';
    let hasPremisPhotos = false;

    // Sort menteeReports by session number to easily find the latest
    menteeReports.sort((a, b) => {
        const sessionA = parseInt((a[sesiNumberColIndex] || '').replace('Sesi #', ''), 10) || 0;
        const sessionB = parseInt((b[sesiNumberColIndex] || '').replace('Sesi #', ''), 10) || 0;
        return sessionA - sessionB;
    });

    if (menteeReports.length > 0) {
        // Determine current session (next session number)
        const highestSessionReported = menteeReports.reduce((max, row) => {
            const sessionNum = parseInt((row[sesiNumberColIndex] || '').replace('Sesi #', ''), 10) || 0;
            return Math.max(max, sessionNum);
        }, 0);
        currentSession = highestSessionReported + 1;

        // Find data for the immediately previous session (highestSessionReported)
        const previousSessionRow = menteeReports.find(row => 
            (parseInt((row[sesiNumberColIndex] || '').replace('Sesi #', ''), 10) || 0) === highestSessionReported
        );

        if (previousSessionRow) {
            latestPreviousData = {
                MENTORING_FINDINGS_JSON: mentoringFindingsJsonColIndex !== -1 ? (previousSessionRow[mentoringFindingsJsonColIndex] || '') : '',
                DATA_KEWANGAN_BULANAN_JSON: dataKewanganJsonColIndex !== -1 ? (previousSessionRow[dataKewanganJsonColIndex] || '') : '',
            };
        }

        // Find Latar Belakang Usahawan from Sesi #1
        const sesi1Row = menteeReports.find(row => 
            (parseInt((row[sesiNumberColIndex] || '').replace('Sesi #', ''), 10) || 0) === 1
        );
        if (sesi1Row && latarBelakangColIndex !== -1) {
            latarBelakangUsahawanSesi1 = sesi1Row[latarBelakangColIndex] || '';
        }

        // Check for premises photos across all sessions for this mentee
        hasPremisPhotos = menteeReports.some(row => 
            premisPhotosColIndex !== -1 && (row[premisPhotosColIndex] || '').trim() !== '' && (row[premisPhotosColIndex] || '').trim() !== '[]'
        );
    }

    // Fetch mentee's mapping info from the MAPPING_SHEET_ID
    const MAPPING_SHEET_ID = process.env.GOOGLE_SHEETS_MAPPING_ID;
    const MAPPING_TAB = process.env.MAPPING_TAB || "mapping"; // Default to mapping

    const mappingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: MAPPING_SHEET_ID,
        range: `${MAPPING_TAB}!A:K`, // Range to cover all mapping columns
    });
    const mappingRows = mappingResponse.data.values;
    const mappingHeaders = mappingRows[0].map(normHeader);

    // Dynamic column finding for mapping sheet
    const mapUsahawanIdx = mappingHeaders.indexOf(normHeader('usahawan'));
    const mapNamaSyarikatIdx = mappingHeaders.indexOf(normHeader('nama_syarikat'));
    const mapAlamatIdx = mappingHeaders.indexOf(normHeader('alamat'));
    const mapNoTelIdx = mappingHeaders.indexOf(normHeader('no_tel'));
    const mapJenisBisnesIdx = mappingHeaders.indexOf(normHeader('jenis_bisnes'));
    const mapMentorEmailIdx = mappingHeaders.indexOf(normHeader('mentor_email'));
    const mapMentorNameIdx = mappingHeaders.indexOf(normHeader('mentor'));


    let menteeMapping = null;
    if (mapUsahawanIdx !== -1) {
        const menteeMapRow = mappingRows.slice(1).find(row => row && (row[mapUsahawanIdx] || '') === name);
        if (menteeMapRow) {
            menteeMapping = {
                NAMA_BISNES: mapNamaSyarikatIdx !== -1 ? menteeMapRow[mapNamaSyarikatIdx] : '',
                LOKASI_BISNES: mapAlamatIdx !== -1 ? menteeMapRow[mapAlamatIdx] : '',
                NO_TELEFON: mapNoTelIdx !== -1 ? menteeMapRow[mapNoTelIdx] : '',
                PRODUK_SERVIS: mapJenisBisnesIdx !== -1 ? menteeMapRow[mapJenisBisnesIdx] : '',
                MENTOR_EMAIL: mapMentorEmailIdx !== -1 ? menteeMapRow[mapMentorEmailIdx] : '',
                NAMA_MENTOR_FROM_MAPPING: mapMentorNameIdx !== -1 ? menteeMapRow[mapMentorNameIdx] : '',
            };
        }
    }


    res.status(200).json({ 
        currentSession, 
        previousData: latestPreviousData, 
        latarBelakangUsahawanSesi1,
        hasPremisPhotos,
        menteeMapping,
    });

  } catch (error) {
    console.error("❌ Error in /api/menteeData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data', details: error.message });
  }
}