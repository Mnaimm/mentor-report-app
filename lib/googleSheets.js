import { google } from 'googleapis';

const getAuth = () => {
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
};

export async function getDocUrlFromSheet(programType, rowNumber) {
    if (!rowNumber) return null;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
    let tabName = process.env.Bangkit_TAB || 'Bangkit';
    let colLetter = 'BB'; // Default to Bangkit Document URL column

    // MAJU support
    if (programType?.toLowerCase().includes('maju')) {
        spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID;
        tabName = 'LaporanMajuUM';
        colLetter = 'AA'; // Maju Document URL is at Index 26 (AA)
    }

    const range = `${tabName}!${colLetter}${rowNumber}`;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
            valueRenderOption: 'UNFORMATTED_VALUE', // Get raw value to avoid formatting issues
        });

        const rows = response.data.values;
        if (rows && rows.length > 0 && rows[0][0]) {
            let val = rows[0][0];
            if (typeof val === 'string') {
                val = val.trim();

                // Handle Maju custom format: {..., docId=XYZ, ...}
                if (programType?.toLowerCase().includes('maju') && val.includes('docId=')) {
                    const match = val.match(/docId=([^,}\s]+)/);
                    if (match && match[1]) {
                        return `https://docs.google.com/document/d/${match[1]}/edit`;
                    }
                }

                return val;
            }
            return val;
        }
    } catch (error) {
        console.error('Error fetching doc URL from Sheets:', error);
    }
    return null;
}

export async function updateSheetStatus(programType, rowNumber, newStatus, rejectionReason = '') {
    if (!rowNumber) return false;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
    let tabName = process.env.Bangkit_TAB || 'Bangkit';

    // Adjust for Maju if needed
    if (programType?.toLowerCase().includes('maju')) {
        spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID;
        tabName = 'LaporanMajuUM';
    }

    // Column BA is Status
    const range = `${tabName}!BA${rowNumber}`;

    try {
        // Status text logic
        let statusText = newStatus === 'approved' ? 'Approved' : 'Rejected';
        if (rejectionReason) statusText += ` - ${rejectionReason}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[statusText]]
            }
        });
        return true;
    } catch (error) {
        console.error('Error updating status in Sheets:', error);
        return false;
    }
}

export async function updateSheetPaymentStatus(programType, rowNumber, paymentStatus, batchName = '') {
    if (!rowNumber) return false;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
    let tabName = process.env.Bangkit_TAB || 'Bangkit';

    // Adjust for Maju if needed
    if (programType?.toLowerCase().includes('maju')) {
        spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID;
        tabName = 'LaporanMajuUM';
    }

    try {
        // Update payment status column (assume column BB for payment status)
        // and column BC for batch name/notes
        const statusRange = `${tabName}!BB${rowNumber}`;
        const notesRange = `${tabName}!BC${rowNumber}`;

        // Update status
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: statusRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[paymentStatus]]
            }
        });

        // Update batch name if provided
        if (batchName) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: notesRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[batchName]]
                }
            });
        }

        return true;
    } catch (error) {
        console.error('Error updating payment status in Sheets:', error);
        return false;
    }
}

export async function findRowNumberByDetails(programType, menteeName, sessionNumber) {
    if (!menteeName || !sessionNumber) return null;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
    let tabName = process.env.Bangkit_TAB || 'Bangkit';
    let nameColIndex = 7; // Column H (Index 7) for Bangkit Usahawan Name
    let sessionColIndex = 3; // Column D (Index 3) for Bangkit Session (e.g. "Sesi #1")

    // Normalize session string for comparison (e.g. "1" matches "Sesi #1")
    const normalizeSession = (s) => {
        const m = String(s).match(/(\d+)/);
        return m ? m[1] : String(s);
    };

    if (programType?.toLowerCase().includes('maju')) {
        spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID;
        tabName = 'LaporanMajuUM';
        nameColIndex = 3; // Column D (Index 3) for Maju Mentee Name
        sessionColIndex = 9; // Column J (Index 9) for Maju Session Number
    }

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${tabName}!A:Z`, // Fetch first 26 columns, enough to cover Name and Session
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;

        const targetSession = normalizeSession(sessionNumber);
        const targetName = menteeName.toLowerCase().trim();

        // Start from index 0 (Row 1). return index + 1
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const nameInSheet = (row[nameColIndex] || '').toLowerCase().trim();
            const sessionInSheet = normalizeSession(row[sessionColIndex] || '');

            if (nameInSheet === targetName && sessionInSheet === targetSession) {
                return i + 1; // Return 1-based row number
            }
        }
    } catch (error) {
        console.error('Error finding row in Sheets:', error);
    }
    return null;
}
