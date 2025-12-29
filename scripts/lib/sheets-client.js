// scripts/lib/sheets-client.js
// Reusable Google Sheets API client for scripts

const { google } = require('googleapis');

/**
 * Create an authenticated Google Sheets client
 * @returns {Promise<{sheets: Object, getRows: Function}>}
 */
async function createSheetsClient() {
  // Get credentials from environment
  const base64Credentials = process.env.GOOGLE_CREDENTIALS_BASE64;

  if (!base64Credentials) {
    throw new Error('GOOGLE_CREDENTIALS_BASE64 environment variable not found');
  }

  // Decode and parse credentials
  const decodedJson = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const credentials = JSON.parse(decodedJson);

  // Create auth client
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/spreadsheets.readonly'
    ],
  });

  const authClient = await auth.getClient();

  const sheets = google.sheets({
    version: 'v4',
    auth: authClient,
  });

  /**
   * Get rows from a specific sheet tab
   * @param {string} spreadsheetId - The Google Sheets spreadsheet ID
   * @param {string} sheetName - The tab/sheet name (e.g., 'mapping')
   * @param {string} range - The range to fetch (default: 'A:Z')
   * @returns {Promise<Array<Object>>} Array of row objects with headers as keys
   */
  async function getRows(spreadsheetId, sheetName, range = 'A:Z') {
    const fullRange = `${sheetName}!${range}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
    });

    const values = response.data.values;

    // Handle empty sheets
    if (!values || values.length === 0) {
      console.warn(`⚠️  Sheet "${sheetName}" is empty or has no data`);
      return [];
    }

    // First row is header
    const [header, ...rows] = values;

    // Map rows to objects using headers as keys
    return rows.map((row, index) => {
      const rowData = { _rowNumber: index + 2 }; // +2 because: 1-indexed + header row

      header.forEach((key, colIndex) => {
        // Trim whitespace from header keys
        const cleanKey = key.trim();
        rowData[cleanKey] = row[colIndex] || '';
      });

      return rowData;
    });
  }

  return { sheets, getRows };
}

module.exports = { createSheetsClient };
