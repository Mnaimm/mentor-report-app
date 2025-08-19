// pages/api/menteeData.js  — header-based version (robust to column shifts)
import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Mentee name is required' });

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Pull a wide range to cover all columns
    const reportResp = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A:ZZ',
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
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const idx = (headerName) => headers.indexOf(headerName);

    // === column helpers (from your header list) ===
    const COL = {
      timestamp: idx('Timestamp'),
      email: idx('Emai'),
      statusSesi: idx('Status Sesi'),
      sesiLaporan: idx('Sesi Laporan'),
      namaUsahawan: idx('Nama Usahawan'),

      // inisiatif 1..4
      fa: (n) => idx(`Fokus Area ${n}`),
      kp: (n) => idx(`Keputusan ${n}`),
      pt: (n) => idx(`Cadangan Tindakan ${n}`),

      // sales
      sales: [
        idx('Jualan Jan'), idx('Jualan Feb'), idx('Jualan Mac'), idx('Jualan Apr'),
        idx('Jualan Mei'), idx('Jualan Jun'), idx('Jualan Jul'), idx('Jualan Ogos'),
        idx('Jualan Sep'), idx('Jualan Okt'), idx('Jualan Nov'), idx('Jualan Dis'),
      ],

      linkPremis: idx('Link_Gambar_Premis'),
      premisChecked: idx('Premis_Dilawat_Checked'),
      statusFinal: idx('Status') > -1 ? idx('Status') : idx('STATUS'), // tolerate either
    };

    // filter all reports for this mentee (exact match)
    const menteeReports = dataRows.filter(r => {
      const val = r[COL.namaUsahawan];
      return val && val.toString().trim() === name.trim();
    });

    // default payload
    let lastSession = 0;
    let status = '';
    let previousSales = Array(12).fill('');
    let previousInisiatif = [];
    let previousPremisDilawat = false;

    if (menteeReports.length > 0) {
      // sort newest by Session number, fallback to timestamp
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

      // lastSession & status
      lastSession = getSessionNum(latest);
      status = (latest[COL.statusSesi] || '').toString();

      // previousSales (by header)
      previousSales = COL.sales.map((cIdx) => (cIdx > -1 ? (latest[cIdx] || '') : ''));

      // previousInisiatif 1..4 (by header)
      for (let i = 1; i <= 4; i++) {
        const fa = COL.fa(i) > -1 ? (latest[COL.fa(i)] || '') : '';
        const kp = COL.kp(i) > -1 ? (latest[COL.kp(i)] || '') : '';
        const pt = COL.pt(i) > -1 ? (latest[COL.pt(i)] || '') : '';
        if (fa || kp || pt) previousInisiatif.push({ focusArea: fa, keputusan: kp, pelanTindakan: pt });
      }

      // previousPremisDilawat: true if any report had the checkbox set OR any premis link exists
      previousPremisDilawat = menteeReports.some((r) => {
        const flag = COL.premisChecked > -1 ? r[COL.premisChecked] : '';
        const link = COL.linkPremis > -1 ? (r[COL.linkPremis] || '') : '';
        const norm = (v) => String(v).trim().toLowerCase();
        return (
          norm(flag) === 'true' ||
          norm(flag) === '✓' ||
          norm(flag) === 'ya' ||
          norm(flag) === 'yes' ||
          (!!link && link.length > 3)
        );
      });
    }

    return res.status(200).json({
      lastSession,
      status,
      previousSales,
      previousInisiatif,
      previousPremisDilawat,
    });
  } catch (error) {
    console.error('❌ /api/menteeData error:', error);
    return res.status(500).json({ error: 'Failed to fetch mentee data', details: error.message });
  }
}
