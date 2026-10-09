// pages/api/laporanMajuData.js
import { google } from 'googleapis';
import { requireSession, userHasAnyRole } from '../../lib/api-guard';
import { hasMentorEmailColumn, isMenteeOfMentor } from '../../lib/mapping-ownership';

const normHeader = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

export default async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

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

    const REPORT_SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
    const LAPORAN_MAJU_TAB = process.env.LAPORAN_MAJU_UM_TAB || 'LaporanMajuUM'; // ✅ FIX: Match submitMajuReportum.js

    console.log('🔍 [laporanMajuData] Using sheet ID:', REPORT_SHEET_ID);
    console.log('🔍 [laporanMajuData] Using tab name:', LAPORAN_MAJU_TAB);

    // Fetch mentee's mapping info from the MAPPING_SHEET_ID first, so ownership
    // is checked before any report data is read.
    const MAPPING_SHEET_ID = process.env.GOOGLE_SHEETS_MAPPING_ID;
    const MAPPING_TAB = process.env.MAPPING_TAB || "mapping";

    const mappingResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: MAPPING_SHEET_ID,
      range: `${MAPPING_TAB}!A:ZZ`, // Fetch wide range for mapping as well
    });
    const mappingRows = mappingResponse.data.values;

    // Non-admins may only read mentees mapped to their own Mentor_Email.
    const isAdmin = await userHasAnyRole(session.user.email, ['system_admin', 'program_coordinator']);
    if (!isAdmin && mappingRows && mappingRows.length > 0 && !hasMentorEmailColumn(mappingRows)) {
      console.error(`❌ [laporanMajuData] Header 'Mentor_Email' not found in '${MAPPING_TAB}' tab; cannot verify mentee ownership.`);
      return res.status(500).json({ error: `Header 'Mentor_Email' not found in '${MAPPING_TAB}' tab.` });
    }
    if (!isAdmin && !isMenteeOfMentor(mappingRows, name, session.user.email)) {
      return res.status(403).json({ error: 'Anda tidak dibenarkan' });
    }

    // Fetch the LaporanMajuUM tab
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

    const headers = laporanMajuRows[0].map(normHeader); // Normalize headers from LaporanMajuUM tab
    const dataRows = laporanMajuRows.slice(1);

    console.log('🔍 [laporanMajuData] Searching for mentee:', name);
    console.log('🔍 [laporanMajuData] Total rows fetched:', laporanMajuRows.length);
    console.log('🔍 [laporanMajuData] Raw headers:', laporanMajuRows[0]);
    console.log('🔍 [laporanMajuData] Normalized headers:', headers);

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

    console.log('🔍 [laporanMajuData] Column indices:', {
      menteeNameColIndex,
      sesiNumberColIndex,
      latarBelakangColIndex,
      dataKewanganJsonColIndex,
      mentoringFindingsJsonColIndex,
      premisPhotosColIndex,
      miaStatusColIndex
    });
    console.log('🔍 [laporanMajuData] Expected: menteeNameColIndex should be 3 (Column D), sesiNumberColIndex should be 8 (Column I)');

    console.log('🔍 [laporanMajuData] First 5 mentee names in sheet:');
    dataRows.slice(0, 5).forEach((row, idx) => {
      console.log(`  Row ${idx + 2}: "${row[menteeNameColIndex]}" (session: "${row[sesiNumberColIndex]}")`);
    });

    const menteeReports = dataRows.filter(row => row && (row[menteeNameColIndex] || '') === name);

    console.log('🔍 [laporanMajuData] Filter logic: row[' + menteeNameColIndex + '] === "' + name + '"');
    console.log('🔍 [laporanMajuData] Matched reports:', menteeReports.length);
    if (menteeReports.length > 0) {
      menteeReports.forEach((r, idx) => {
        console.log(`  Match ${idx + 1}: Mentee="${r[menteeNameColIndex]}", Session="${r[sesiNumberColIndex]}"`);
      });
    } else {
      console.log('❌ [laporanMajuData] NO MATCHES FOUND for:', name);
    }

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

    // mappingRows was fetched above (before the ownership check)
    if (!mappingRows || mappingRows.length < 1) {
      console.warn(`Mapping tab '${MAPPING_TAB}' is empty or does not exist.`);
      return res.status(200).json({
        currentSession,
        previousData: latestPreviousData,
        latarBelakangUsahawanSesi1,
        hasPremisPhotos,
        menteeMapping: null,
        isMIA: isMIAStatus
      });
    }

    const mappingHeaders = mappingRows[0].map(normHeader);

    // DEBUG: Log the mapping headers
    console.log('🔍 DEBUG - Mapping headers:', mappingHeaders);
    console.log('👤 DEBUG - Looking for mentee:', name);

    // Replace the header mapping section in laporanMajuData.js with this:

    // Dynamic column finding for mapping sheet (using EXACT headers from your mapping sheet)
    // Remember: normHeader converts to lowercase and normalizes spaces
    const mapMenteeIdx = mappingHeaders.indexOf(normHeader('Mentee'));
    const mapNamaSyarikatIdx = mappingHeaders.indexOf(normHeader('Nama Syarikat')); // Note the space
    const mapAlamatIdx = mappingHeaders.indexOf(normHeader('Alamat'));
    const mapNoTelefonIdx = mappingHeaders.indexOf(normHeader('no Telefon')); // Note the space and lowercase 'n'
    const mapJenisBisnesIdx = mappingHeaders.indexOf(normHeader('JENIS BISNES')); // Note the space
    const mapMentorEmailIdx = mappingHeaders.indexOf(normHeader('Mentor_Email'));
    const mapMentorNameIdx = mappingHeaders.indexOf(normHeader('Mentor'));
    const mapFolderIdIdx = mappingHeaders.indexOf(normHeader('Folder_ID')); // Match the actual header name
    const mapEmailIdx = mappingHeaders.indexOf(normHeader('EMAIL'));
    const mapBatchIdx = mappingHeaders.indexOf(normHeader('Batch'));

    // DEBUG: Let's also add a debug log to see what the normHeader function produces
    console.log('🔍 DEBUG - Normalized header examples:');
    console.log('  "Nama Syarikat" becomes:', normHeader('Nama Syarikat'));
    console.log('  "no Telefon" becomes:', normHeader('no Telefon'));
    console.log('  "JENIS BISNES" becomes:', normHeader('JENIS BISNES'));
    console.log('  "Folder_ID" becomes:', normHeader('Folder_ID'));

    // DEBUG: Log the mapping indices
    console.log('📊 DEBUG - Mapping indices:', {
      mapMenteeIdx,
      mapNamaSyarikatIdx,
      mapAlamatIdx,
      mapNoTelefonIdx,
      mapJenisBisnesIdx,
      mapMentorEmailIdx,
      mapMentorNameIdx,
      mapFolderIdIdx,
      mapEmailIdx
    });

    let menteeMapping = null;
    if (mapMenteeIdx !== -1) {
      const menteeMapRow = mappingRows.slice(1).find(row => row && (row[mapMenteeIdx] || '') === name);

      // DEBUG: Log mentee search
      console.log('🔍 DEBUG - Searching for mentee in mapping data...');
      console.log('📋 DEBUG - Available mentees in mapping:', mappingRows.slice(1).map(row => row[mapMenteeIdx]).filter(Boolean));

      if (menteeMapRow) {
        console.log('🔍 DEBUG - Found mentee mapping row:', menteeMapRow);

        menteeMapping = {
          // Map to the desired frontend field names
          NAMA_BISNES: mapNamaSyarikatIdx !== -1 ? menteeMapRow[mapNamaSyarikatIdx] : '',
          LOKASI_BISNES: mapAlamatIdx !== -1 ? menteeMapRow[mapAlamatIdx] : '',
          NO_TELEFON: mapNoTelefonIdx !== -1 ? menteeMapRow[mapNoTelefonIdx] : '',
          PRODUK_SERVIS: mapJenisBisnesIdx !== -1 ? menteeMapRow[mapJenisBisnesIdx] : '',
          MENTOR_EMAIL: mapMentorEmailIdx !== -1 ? menteeMapRow[mapMentorEmailIdx] : '',
          NAMA_MENTOR_FROM_MAPPING: mapMentorNameIdx !== -1 ? menteeMapRow[mapMentorNameIdx] : '',
          Folder_ID: mapFolderIdIdx !== -1 ? menteeMapRow[mapFolderIdIdx] : '', // Pass this through
          MENTEE_EMAIL_FROM_MAPPING: mapEmailIdx !== -1 ? menteeMapRow[mapEmailIdx] : '', // Pass mentee email
          BATCH: mapBatchIdx !== -1 ? menteeMapRow[mapBatchIdx] : '', // Added Batch mapping
        };

        console.log('✅ DEBUG - Created mentee mapping:', menteeMapping);
      } else {
        console.log('❌ DEBUG - No mentee mapping row found for:', name);
      }
    } else {
      console.log('❌ DEBUG - mapMenteeIdx is -1, header "Usahawan" not found');
    }

    // Final response
    const responseData = {
      currentSession,
      previousData: latestPreviousData,
      latarBelakangUsahawanSesi1,
      hasPremisPhotos,
      menteeMapping,
      isMIA: isMIAStatus // Return MIA status
    };

    console.log('📤 DEBUG - Final API response:', responseData);

    res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ Error in /api/laporanMajuData:", error);
    res.status(500).json({ error: 'Failed to fetch mentee data for Laporan Maju', details: error.message });
  }
}