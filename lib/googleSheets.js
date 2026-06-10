import { google } from 'googleapis';

const getAuth = () => {
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
};

/**
 * Map entrepreneurs.batch to payment tracking sheet tab name
 * @param {string} batch - e.g., 'Batch 5 Bangkit', 'Batch 6 Maju', '5', '6', '7'
 * @returns {string|null} - Tab name or null if batch not supported
 */
function getTabNameFromBatch(batch) {
    if (!batch) return null;
    const match = batch.toString().match(/(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1]);
    if (num === 5) return 'B5-M4 KICK OFF 6.8.2025';
    if (num === 6) return 'B6-M5 KICK OFF 4.12.2025';
    if (num === 7) return 'B7-M6 KICK OFF 19.1.2026';
    return null; // Batch 4 and unknown → skip silently
}

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

/**
 * Find row number by report_id (column P)
 * Maps entrepreneurs.batch to the correct tab name in the unified payment tracking sheet
 */
export async function findRowByReportId(batch, reportId) {
    if (!reportId || !batch) return null;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // SINGLE SPREADSHEET ID for all payment tracking
    const spreadsheetId = process.env.GOOGLE_SHEETS_PAYMENT_TRACKING_ID;

    if (!spreadsheetId) {
        console.error('Missing GOOGLE_SHEETS_PAYMENT_TRACKING_ID environment variable');
        return null;
    }

    // Map batch to tab name
    const tabName = getTabNameFromBatch(batch);

    if (!tabName) {
        console.warn(`⚠️ Batch ${batch} not supported for payment tracking sheet - skipping`);
        return null;
    }

    try {
        // Fetch column P (report_id) - index 15
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${tabName}!P:P`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return null;

        // Find matching report_id (starting from row 1, skip headers at rows 1-3)
        for (let i = 3; i < rows.length; i++) { // Start from row 4 (index 3)
            const cellValue = rows[i][0];
            if (cellValue && cellValue.toString().trim() === reportId.toString().trim()) {
                return i + 1; // Return 1-based row number
            }
        }
    } catch (error) {
        console.error('Error finding row by report_id in payment tracking sheet:', error);
    }
    return null;
}

/**
 * Write verification data to payment tracking sheet
 * Updates columns Q, R, S after verification approval
 * Q = Tarikh laporan masuk (Portal)
 * R = Tarikh Pusingan Semakan (Portal)
 * S = Jumlah Bayaran (Portal)
 */
export async function writeVerificationToSheet(batch, reportId, data) {
    const rowNumber = await findRowByReportId(batch, reportId);

    if (!rowNumber) {
        console.warn(`⚠️ Could not find row for report_id ${reportId} in batch ${batch} - skipping sheet write`);
        return false;
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_PAYMENT_TRACKING_ID;

    // Map batch to tab name
    const tabName = getTabNameFromBatch(batch);

    if (!tabName) {
        console.warn(`⚠️ Batch ${batch} not supported for payment tracking sheet - skipping`);
        return false;
    }

    try {
        // Format dates as DD/MM/YYYY
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // Update columns Q, R, S
        const updates = [
            {
                range: `${tabName}!Q${rowNumber}`,
                values: [[formatDate(data.submission_date)]]
            },
            {
                range: `${tabName}!R${rowNumber}`,
                values: [[formatDate(data.approved_at)]]
            },
            {
                range: `${tabName}!S${rowNumber}`,
                values: [[data.base_payment_amount || 0]]
            }
        ];

        // Batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });

        console.log(`✅ Verification data written to ${tabName} row ${rowNumber} (cols Q, R, S)`);
        return true;
    } catch (error) {
        console.error('Error writing verification data to sheet:', error);
        return false;
    }
}

/**
 * Write payment data to payment tracking sheet
 * Updates columns T, U after payment batch is marked as paid
 * T = Approval Oleh (Portal) - admin email
 * U = Tarikh bayar (Portal)
 */
export async function writePaymentToSheet(batch, reportId, data) {
    const rowNumber = await findRowByReportId(batch, reportId);

    if (!rowNumber) {
        console.warn(`⚠️ Could not find row for report_id ${reportId} in batch ${batch} - skipping sheet write`);
        return false;
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_PAYMENT_TRACKING_ID;

    // Map batch to tab name
    const tabName = getTabNameFromBatch(batch);

    if (!tabName) {
        console.warn(`⚠️ Batch ${batch} not supported for payment tracking sheet - skipping`);
        return false;
    }

    try {
        // Format paid date as DD/MM/YYYY
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // Update columns T, U
        const updates = [
            {
                range: `${tabName}!T${rowNumber}`,
                values: [[data.approved_by || '']]
            },
            {
                range: `${tabName}!U${rowNumber}`,
                values: [[formatDate(data.paid_date)]]
            }
        ];

        // Batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });

        console.log(`✅ Payment data written to ${tabName} row ${rowNumber} (cols T, U)`);
        return true;
    } catch (error) {
        console.error('Error writing payment data to sheet:', error);
        return false;
    }
}
