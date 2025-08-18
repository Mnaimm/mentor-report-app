// pages/api/menteeData.js - FIXED VERSION
import { google } from 'googleapis';

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
    
    // Use the same approach as mapping.js which works
    const reportResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: 'V8!A:ZZ', // Get more columns to cover all data
    });

    res.setHeader('Cache-Control', 'no-store');

    const reportRows = reportResponse.data.values || [];
    
    if (reportRows.length < 2) {
      return res.status(200).json({ 
        lastSession: 0,
        status: '',
        previousSales: Array(12).fill(''),
        previousInisiatif: [],
        previousPremisDilawat: false
      });
    }

    // Use the same column indices that mapping.js uses successfully
    const headers = reportRows[0];
    const dataRows = reportRows.slice(1);
    
    // Based on mapping.js, these are the correct column positions:
    // Column C (index 2) = Status
    // Column D (index 3) = Sesi Laporan  
    // Column H (index 7) = Nama Usahawan
    // Columns AB onwards (index 27+) = Sales data (Jan-Dec)
    
    const statusColIndex = 2;     // Column C - Status Sesi
    const sessionColIndex = 3;    // Column D - Sesi Laporan
    const menteeNameColIndex = 7; // Column H - Nama Usahawan
    
    // Find all reports for this mentee
    const menteeReports = dataRows.filter(row => {
      const menteeName = row[menteeNameColIndex];
      return menteeName && menteeName.toString().trim() === name.trim();
    });

    let lastSession = 0;
    let status = '';
    let previousSales = Array(12).fill('');
    let previousInisiatif = [];
    let previousPremisDilawat = false;

    if (menteeReports.length > 0) {
      // Sort by session number to find the latest
      menteeReports.sort((a, b) => {
        const getSessionNum = (row) => {
          const sessionText = row[sessionColIndex] || '';
          const match = sessionText.toString().match(/\d+/);
          return match ? parseInt(match[0]) : 0;
        };
        return getSessionNum(b) - getSessionNum(a); // Descending order
      });

      const latestReport = menteeReports[0];
      
      // Extract session number from "Sesi #1", "Sesi #2", etc.
      const sessionText = latestReport[sessionColIndex] || '';
      const sessionMatch = sessionText.toString().match(/\d+/);
      lastSession = sessionMatch ? parseInt(sessionMatch[0]) : 0;
      
      // Get status
      status = latestReport[statusColIndex] || '';
      
      // Get sales data from columns AB-AM (indices 27-38)
      // Based on submitReport.js mapping: row[27 + i] = sale
      for (let i = 0; i < 12; i++) {
        const saleValue = latestReport[27 + i];
        previousSales[i] = saleValue || '';
      }
      
      // Get previous initiatives from columns P-AA (indices 15-26)
      // Based on submitReport.js: const colOffset = 15 + (i * 3)
      for (let i = 0; i < 4; i++) {
        const colOffset = 15 + (i * 3);
        const focusArea = latestReport[colOffset] || '';
        const keputusan = latestReport[colOffset + 1] || '';
        const pelanTindakan = latestReport[colOffset + 2] || '';
        
        if (focusArea || keputusan || pelanTindakan) {
          previousInisiatif.push({
            focusArea,
            keputusan,
            pelanTindakan
          });
        }
      }
      
      // Check if premises were visited - based on submitReport.js Column BW (index 74)
      // Check across all reports for this mentee
      previousPremisDilawat = menteeReports.some(report => {
        return report[74] === true || report[74] === 'TRUE' || report[74] === '✓';
      });
    }

    res.status(200).json({ 
      lastSession,
      status,
      previousSales,
      previousInisiatif,
      previousPremisDilawat
    });

  } catch (error) {
    console.error("❌ Error in /api/menteeData:", error);
    res.status(500).json({ 
      error: 'Failed to fetch mentee data', 
      details: error.message 
    });
  }
}