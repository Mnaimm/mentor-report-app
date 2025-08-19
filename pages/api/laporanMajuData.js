// pages/api/laporanMajuData.js
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
    const LAPORAN_MAJU_TAB = "LaporanMaju"; // Explicitly set to 'LaporanMaju'

    // Fetch the LaporanMaju tab
    const laporanMajuResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: REPORT_SHEET_ID,
      range: `${LAPORAN_MAJU_TAB}!A:ZZ`, // Fetch a wide range to get all columns
    });

    res.setHeader('Cache-Control', 'no-store');

    const laporanMajuRows = laporanMajuResponse.data.values;
    if (!laporanMajuRows || laporanMajuRows.length < 1) { // Need at least headers
      return res.status(200).json({ 
        currentSession: 1, 
        previousData: null, 
        latarBelakangUsahawanSesi1: '',
        hasPremisPhotos: false, 
        menteeMapping: null,
        isMIA: false // Default to false if no data
      });
    }

    const headers = laporanMajuRows[0].map(normHeader); // Normalize headers from LaporanMaju tab
    const dataRows = laporanMajuRows.slice(1);

    // Find column indices dynamically using normalized headers from LaporanMaju
    // These must EXACTLY match your LaporanMaju tab's header row
    const menteeNameColIndex = headers.indexOf(normHeader('NAMA_MENTEE'));
    const sesiNumberColIndex = headers.indexOf(normHeader('SESI_NUMBER')); 
    const latarBelakangColIndex = headers.indexOf(normHeader('LATARBELAKANG_USAHAWAN')); 
    const dataKewanganJsonColIndex = headers.indexOf(normHeader('DATA_KEWANGAN_BULANAN_JSON'));
    const mentoringFindingsJsonColIndex = headers.indexOf(normHeader('MENTORING_FINDINGS_JSON'));
    const premisPhotosColIndex = headers.indexOf(normHeader('URL_GAMBAR_PREMIS_JSON'));
    // NEW: MIA Status column index
    const miaStatusColIndex = headers.indexOf(normHeader('MIA_STATUS')); // Assuming 'MIA_STATUS' is the header for Column Z

    // Critical column checks
    if (menteeNameColIndex === -1) {
        return res.status(500).json({ error: `Header 'NAMA_MENTEE' not found in '${LAPORAN_MAJU_TAB}' tab.` });
    }
    if (sesiNumberColIndex === -1) {
        return res.status(500).json({ error: `Header 'SESI_NUMBER' not found in '${LAPORAN_MAJU_TAB}' tab.` });
    }
    // NEW: Check for MIA_STATUS column
    if (miaStatusColIndex === -1) {
        // This is a soft error, as MIA might not be implemented in all sheets yet,
        // but it's good to log or warn.
        console.warn(`Header 'MIA_STATUS' not found in '${LAPORAN_MAJU_TAB}' tab. MIA functionality might be limited.`);
    }


    const menteeReports = dataRows.filter(row => row && (row[menteeNameColIndex] || '') === name);
    
    let currentSession = 1;
    let latestPreviousData = null; 
    let latarBelakangUsahawanSesi1 = '';
    let hasPremisPhotos = false;
    let isMIAStatus = false; // Initialize MIA status

    // Sort menteeReports by session number
    menteeReports.sort((a, b) => {
        const sessionA = parseInt((a[sesiNumberColIndex] || ''), 10) || 0; 
        const sessionB = parseInt((b[sesiNumberColIndex] || ''), 10) || 0;
        return sessionA - sessionB;
    });

    if (menteeReports.length > 0) {
        const highestSessionReported = menteeReports.reduce((max, row) => {
            const sessionNum = parseInt((row[sesiNumberColIndex] || ''), 10) || 0;
            return Math.max(max, sessionNum);
        }, 0);
        currentSession = highestSessionReported + 1;

        const previousSessionRow = menteeReports.find(row => 
            (parseInt((row[sesiNumberColIndex] || ''), 10) || 0) === highestSessionReported
        );

        if (previousSessionRow) {
            latestPreviousData = {
                MENTORING_FINDINGS_JSON: mentoringFindingsJsonColIndex !== -1 ? (previousSessionRow[mentoringFindingsJsonColIndex] || '') : '',
                DATA_KEWANGAN_BULANAN_JSON: dataKewanganJsonColIndex !== -1 ? (previousSessionRow[dataKewanganJsonColIndex] || '') : '',
            };
        }

        const sesi1Row = menteeReports.find(row => 
            (parseInt((row[sesiNumberColIndex] || ''), 10) || 0) === 1
        );
        if (sesi1Row && latarBelakangColIndex !== -1) {
            latarBelakangUsahawanSesi1 = sesi1Row[latarBelakangColIndex] || '';
        }

        hasPremisPhotos = menteeReports.some(row => 
            premisPhotosColIndex !== -1 && 
            (row[premisPhotosColIndex] || '').trim() !== '' && 
            (row[premisPhotosColIndex] || '').trim() !== '[]' 
        );

        // NEW: Check if any report for this mentee has MIA_STATUS as 'MIA'
        // This assumes if a mentee is marked MIA once, they stay MIA.
        isMIAStatus = menteeReports.some(row => 
            miaStatusColIndex !== -1 && (row[miaStatusColIndex] || '').toLowerCase() === 'mia'
        );
    }

    // Fetch mentee's mapping info from the MAPPING_SHEET_ID
    const MAPPING_SHEET_ID = process.env.GOOGLE_SHEETS_MAPPING_ID;
    const MAPPING_TAB = process.env.MAPPING_TAB || "mapping"; 

    const mappingResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: MAPPING_SHEET_ID,
        range: `${MAPPING_TAB}!A:ZZ`, // Fetch wide range for mapping as well
    });
    const mappingRows = mappingResponse.data.values;
    if (!mappingRows || mappingRows.length < 1) {
        console.warn(`Mapping tab '${MAPPING_TAB}' is empty or does not exist.`);
        return res.status(200).json({
          currentSession, previousData: latestPreviousData, latarBelakangUsahawanSesi1, hasPremisPhotos, menteeMapping: null, isMIA: isMIAStatus
        });
    }

    const mappingHeaders = mappingRows[0].map(normHeader);

   / Fix the header mapping section in laporanMajuData.js (around line 120-130)
// Replace the existing mapping header searches with these:

const mapMenteeIdx = mappingHeaders.indexOf(normHeader('Usahawan')); // mapping.js uses 'Usahawan' for mentee name
const mapNamaSyarikatIdx = mappingHeaders.indexOf(normHeader('Nama_Syarikat')); // mapping.js uses 'Nama_Syarikat'
const mapAlamatIdx = mappingHeaders.indexOf(normHeader('Alamat')); // mapping.js uses 'Alamat'
const mapNoTelefonIdx = mappingHeaders.indexOf(normHeader('No_Tel')); // mapping.js uses 'No_Tel'
const mapJenisBisnesIdx = mappingHeaders.indexOf(normHeader('Jenis_Bisnes')); // mapping.js uses 'Jenis_Bisnes'
const mapMentorEmailIdx = mappingHeaders.indexOf(normHeader('Mentor_Email')); // mapping.js uses 'Mentor_Email'
const mapMentorNameIdx = mappingHeaders.indexOf(normHeader('Mentor')); // mapping.js uses 'Mentor'
const mapFolderIdIdx = mappingHeaders.indexOf(normHeader('Folder_ID')); // mapping.js uses 'Folder_ID' (THIS WAS THE KEY ISSUE!)
const mapEmailIdx = mappingHeaders.indexOf(normHeader('Emel')); // mapping.js uses 'Emel'

    let menteeMapping = null;
    if (mapMenteeIdx !== -1) {
        const menteeMapRow = mappingRows.slice(1).find(row => row && (row[mapMenteeIdx] || '') === name);
        if (menteeMapRow) {
            menteeMapping = {
                // Map to the desired frontend field names
                NAMA_BISNES: mapNamaSyarikatIdx !== -1 ? menteeMapRow[mapNamaSyarikatIdx] : '',
                LOKASI_BISNES: mapAlamatIdx !== -1 ? menteeMapRow[mapAlamatIdx] : '',
                NO_TELEFON: mapNoTelefonIdx !== -1 ? menteeMapRow[mapNoTelefonIdx] : '',
                PRODUK_SERVIS: mapJenisBisnesIdx !== -1 ? menteeMapRow[mapJenisBisnesIdx] : '',
                MENTOR_EMAIL: mapMentorEmailIdx !== -1 ? menteeMapRow[mapMentorEmailIdx] : '',
                NAMA_MENTOR_FROM_MAPPING: mapMentorNameIdx !== -1 ? menteeMapRow[mapMentorNameIdx] : '',
                Mentee_Folder_ID: mapFolderIdIdx !== -1 ? menteeMapRow[mapFolderIdIdx] : '', // Pass this through
                MENTEE_EMAIL_FROM_MAPPING: mapEmailIdx !== -1 ? menteeMapRow[mapEmailIdx] : '', // Pass mentee email
            };
        }
    }

    res.status(200).json({ 
        currentSession, 
        previousData: latestPreviousData, 
        latarBelakangUsahawanSesi1,
        hasPremisPhotos,
        menteeMapping,
        isMIA: isMIAStatus // Return MIA status
    });

  } catch (error) {
    console.error("❌ Error in /api/laporanMajuData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data for Laporan Maju', details: error.message });
  }
}