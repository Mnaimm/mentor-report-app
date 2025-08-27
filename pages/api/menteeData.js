// pages/api/menteeData.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { name, programType } = req.query; // Destructure programType from query
    if (!name) return res.status(400).json({ error: 'Mentee name is required' });
    if (!programType) return res.status(400).json({ error: 'Program type is required' }); // New check

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetId;
    let headersConfig; // Object to store header names for each program type

    // Define headers for Bangkit program
    const bangkitHeaders = {
      timestamp: 'Timestamp',
      email: 'Emai', // Typo in original headers, assuming it should be Email
      statusSesi: 'Status Sesi',
      sesiLaporan: 'Sesi Laporan',
      namaUsahawan: 'Nama Usahawan',
      fa: (n) => `Fokus Area ${n}`,
      kp: (n) => `Keputusan ${n}`,
      pt: (n) => `Cadangan Tindakan ${n}`,
      sales: [
        'Jualan Jan', 'Jualan Feb', 'Jualan Mac', 'Jualan Apr',
        'Jualan Mei', 'Jualan Jun', 'Jualan Jul', 'Jualan Ogos',
        'Jualan Sep', 'Jualan Okt', 'Jualan Nov', 'Jualan Dis',
      ],
      linkPremis: 'Link_Gambar_Premis',
      premisChecked: 'Premis_Dilawat_Checked',
      statusFinal: 'Status',
    };

    // Define headers for Maju program (based on your submitReport.js mapping)
    const majuHeaders = {
      timestamp: 'Timestamp',
      namaMentor: 'NAMA_MENTOR',
      emailMentor: 'EMAIL_MENTOR',
      namaUsahawan: 'NAMA_MENTEE',
      namaSyarikat: 'NAMA_BISNES',
      lokasiBisnes: 'LOKASI_BISNES',
      produkServis: 'PRODUK_SERVIS',
      noTelefon: 'NO_TELEFON',
      tarikhSesi: 'TARIKH_SESI',
      sesiLaporan: 'SESI_NUMBER',
      modSesi: 'MOD_SESI',
      lokasiF2F: 'LOKASI_F2F',
      masaMula: 'MASA_MULA',
      masaTamat: 'MASA_TAMAT',
      latarBelakangUsahawan: 'LATARBELAKANG_USAHAWAN',
      dataKewanganBulananJson: 'DATA_KEWANGAN_BULANAN_JSON',
      mentoringFindingsJson: 'MENTORING_FINDINGS_JSON',
      refleksiPerasaan: 'REFLEKSI_MENTOR_PERASAAN',
      refleksiKomitmen: 'REFLEKSI_MENTOR_KOMITMEN',
      refleksiLain: 'REFLEKSI_MENTOR_LAIN',
      statusPerniagaanKeseluruhan: 'STATUS_PERNIAGAAN_KESELURUHAN',
      rumusanDanLangkahKehadapan: 'RUMUSAN_DAN_LANGKAH_KEHADAPAN',
      urlGambarPremisJson: 'URL_GAMBAR_PREMIS_JSON',
      urlGambarSesiJson: 'URL_GAMBAR_SESI_JSON',
      urlGambarGw360: 'URL_GAMBAR_GW360',
      menteeFolderId: 'Mentee_Folder_ID',
      laporanMajuDocId: 'Laporan_Maju_Doc_ID',
      miaStatus: 'MIA_STATUS',
      miaReason: 'MIA_REASON',
      miaProofUrl: 'MIA_PROOF_URL',
    };

    if (programType === 'bangkit') {
      spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
      headersConfig = bangkitHeaders;
    } else if (programType === 'maju') {
      spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID; // Use Maju sheet ID
      headersConfig = majuHeaders;
    } else {
      return res.status(400).json({ error: 'Invalid programType specified.' });
    }

    if (!spreadsheetId) {
      throw new Error(`Missing GOOGLE_SHEETS_REPORT_ID or GOOGLE_SHEETS_MAJU_REPORT_ID for program type: ${programType}`);
    }

    const reportResp = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'A:ZZ', // Pull a wide range to cover all columns for both sheets
    });

    res.setHeader('Cache-Control', 'no-store');

    const rows = reportResp.data.values || [];
    if (rows.length < 2) {
      return res.status(200).json({
        lastSession: 0,
        status: '',
        previousSales: Array(12).fill(''),
        previousInisiatif: [],
        previousPremisDilawat: false,
        // Add other Maju-specific defaults if needed
        previousDataKewangan: [],
        previousMentoringFindings: [],
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const idx = (headerName) => headers.indexOf(headerName);

    // Dynamic COL object based on selected headersConfig
    const COL = {};
    for (const key in headersConfig) {
      if (typeof headersConfig[key] === 'function') {
        COL[key] = (n) => idx(headersConfig[key](n));
      } else if (Array.isArray(headersConfig[key])) {
        COL[key] = headersConfig[key].map(h => idx(h));
      } else {
        COL[key] = idx(headersConfig[key]);
      }
    }
    // Specific handling for 'Status' column name variations
    if (programType === 'bangkit') {
        COL.statusFinal = idx('Status') > -1 ? idx('Status') : idx('STATUS');
    }


    // filter all reports for this mentee (exact match)
    const menteeReports = dataRows.filter(r => {
      const val = r[COL.namaUsahawan];
      return val && val.toString().trim() === name.trim();
    });

    let lastSession = 0;
    let status = '';
    let previousSales = Array(12).fill('');
    let previousInisiatif = [];
    let previousPremisDilawat = false;
    let previousDataKewangan = []; // For Maju
    let previousMentoringFindings = []; // For Maju

    if (menteeReports.length > 0) {
      const getSessionNum = (row) => {
        const txt = (row[COL.sesiLaporan] || '').toString();
        const m = txt.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      };
      const getTime = (row) => new Date(row[COL.timestamp] || 0).getTime();

      menteeReports.sort((a, b) => {
        const d = getSessionNum(b) - getSessionNum(a);
        return d !== 0 ? d : (getTime(b) - getTime(a));
      });

      const latest = menteeReports[0];

      lastSession = getSessionNum(latest);
      status = programType === 'bangkit'
        ? (latest[COL.statusSesi] || '').toString()
        : (latest[COL.miaStatus] || '').toString(); // For Maju, use MIA_STATUS

      if (programType === 'bangkit') {
        previousSales = COL.sales.map((cIdx) => (cIdx > -1 ? (latest[cIdx] || '') : ''));
        for (let i = 1; i <= 4; i++) {
          const fa = COL.fa(i) > -1 ? (latest[COL.fa(i)] || '') : '';
          const kp = COL.kp(i) > -1 ? (latest[COL.kp(i)] || '') : '';
          const pt = COL.pt(i) > -1 ? (latest[COL.pt(i)] || '') : '';
          if (fa || kp || pt) previousInisiatif.push({ focusArea: fa, keputusan: kp, pelanTindakan: pt });
        }
        previousPremisDilawat = menteeReports.some((r) => {
          const flag = COL.premisChecked > -1 ? r[COL.premisChecked] : '';
          const link = COL.linkPremis > -1 ? (r[COL.linkPremis] || '') : '';
          const norm = (v) => String(v).trim().toLowerCase();
          return (
            norm(flag) === 'true' || norm(flag) === '✓' || norm(flag) === 'ya' || norm(flag) === 'yes' || (!!link && link.length > 3)
          );
        });
      } else if (programType === 'maju') {
        // Handle Maju-specific previous data
        try {
          previousDataKewangan = COL.dataKewanganBulananJson > -1 ? JSON.parse(latest[COL.dataKewanganBulananJson] || '[]') : [];
        } catch (e) {
          console.error("Error parsing DATA_KEWANGAN_BULANAN_JSON for Maju:", e);
          previousDataKewangan = [];
        }
        try {
          previousMentoringFindings = COL.mentoringFindingsJson > -1 ? JSON.parse(latest[COL.mentoringFindingsJson] || '[]') : [];
        } catch (e) {
          console.error("Error parsing MENTORING_FINDINGS_JSON for Maju:", e);
          previousMentoringFindings = [];
        }
        // For Maju, check if premis was visited based on URL_GAMBAR_PREMIS_JSON
        previousPremisDilawat = menteeReports.some((r) => {
            const premisLinks = COL.urlGambarPremisJson > -1 ? (r[COL.urlGambarPremisJson] || '') : '';
            try {
                const parsedLinks = JSON.parse(premisLinks);
                return Array.isArray(parsedLinks) && parsedLinks.length > 0 && parsedLinks.some(link => typeof link === 'string' && link.length > 5);
            } catch {
                return false;
            }
        });
      }
    }

    return res.status(200).json({
      lastSession,
      status,
      previousSales, // Will be empty for Maju unless you decide to map it
      previousInisiatif, // Will be empty for Maju unless you decide to map it
      previousPremisDilawat,
      previousDataKewangan, // For Maju
      previousMentoringFindings, // For Maju
    });
  } catch (error) {
    console.error('❌ /api/menteeData error:', error);
    return res.status(500).json({ error: 'Failed to fetch mentee data', details: error.message });
  }
}