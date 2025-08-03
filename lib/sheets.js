// lib/sheets.js
import { google } from 'googleapis';

export async function getSheetsClient() {
  // 1. Get the variable with the correct name
  const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;

  // Give a better error if the variable is missing
  if (!base64Credentials) {
    throw new Error("GOOGLE_CREDENTIALS_BASE64 environment variable not found.");
  }

  // 2. Decode the Base64 string into a regular JSON string
  const decodedJson = Buffer.from(base64Credentials, 'base64').toString('utf8');
  
  // 3. Parse the decoded JSON
  const credentials = JSON.parse(decodedJson);
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  
  const sheets = google.sheets({
    version: 'v4',
    auth: authClient,
  });

  const getRows = async (sheetName) => {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
      range: `${sheetName}!A1:BV`,
    });
    
    // Safety Check: If the sheet is empty, return an empty array to prevent a crash.
    const values = response.data.values;
    if (!values || values.length === 0) {
      console.warn(`⚠️ Warning: Sheet named "${sheetName}" is empty or has no data.`);
      return [];
    }
    
    const [header, ...rows] = values;
    return rows.map(row => {
      const rowData = {};
      header.forEach((key, index) => {
        rowData[key] = row[index] || ''; 
      });
      return rowData;
    });
  };

  return { sheets, getRows };
}