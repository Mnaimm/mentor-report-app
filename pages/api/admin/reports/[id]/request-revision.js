import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';
import { findRowByReportId } from '../../../../../lib/googleSheets';
import { google } from 'googleapis';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hasAccess = await canAccessAdmin(session.user.email);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Access denied - Admin role required' });
    }

    const { id } = req.query;
    const { revision_reasons, revision_notes } = req.body;

    // Validate request body
    if (!revision_reasons || !Array.isArray(revision_reasons) || revision_reasons.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'revision_reasons must be a non-empty array'
        });
    }

    try {
        // 1. Fetch current report to get details
        const { data: report, error: fetchError } = await supabase
            .from('reports')
            .select('id, status, revision_count, program, mentor_email, mentee_name, session_number')
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            throw new Error('Report not found');
        }

        const currentRevisionCount = report.revision_count || 0;
        const newRevisionCount = currentRevisionCount + 1;

        console.log(`📊 Processing revision request for report ${id}, revision #${newRevisionCount}`);

        // 2. UPDATE SUPABASE (BLOCKING - primary source of truth)
        const { error: updateError } = await supabase
            .from('reports')
            .update({
                status: 'review_requested',
                revision_reason: revision_reasons,
                revision_notes: revision_notes || null,
                revision_requested_by: session.user.email,
                revision_requested_at: new Date().toISOString(),
                revision_count: newRevisionCount,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        console.log(`✅ Report ${id} status updated to 'review_requested' in Supabase`);

        // 3. Insert into report_revisions table
        const { error: revisionInsertError } = await supabase
            .from('report_revisions')
            .insert({
                report_id: id,
                revision_number: newRevisionCount,
                status_before: report.status || 'submitted',
                status_after: 'review_requested',
                changed_by: session.user.email,
                revision_reasons: revision_reasons,
                revision_notes: revision_notes || null,
                created_at: new Date().toISOString()
            });

        if (revisionInsertError) {
            console.error('⚠️ Failed to insert into report_revisions (non-blocking):', revisionInsertError);
            // Don't throw - this is supplementary data
        } else {
            console.log(`✅ Revision #${newRevisionCount} logged to report_revisions table`);
        }

        // 4. DUAL-WRITE TO SHEETS (NON-BLOCKING)
        let sheetsSuccess = false;
        let sheetsError = null;

        try {
            console.log(`🔄 Attempting to update Sheets status to 'SEMAKAN'...`);

            // Find the row in the payment tracking sheet
            const rowNumber = await findRowByReportId(report.program, report.id);

            if (rowNumber) {
                // Setup Google Sheets API
                const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
                const credentials = JSON.parse(credentialsJson);
                const auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                const sheets = google.sheets({ version: 'v4', auth });
                const spreadsheetId = process.env.GOOGLE_SHEETS_PAYMENT_TRACKING_ID;

                // Determine tab name (same logic as findRowByReportId)
                let tabName = '';
                const programUpper = report.program.toUpperCase();

                if (programUpper.includes('B7') || programUpper.includes('M6') || programUpper.includes('MAJU 6') || programUpper.includes('BANGKIT 7'))
                    tabName = 'B7-M6 KICK OFF 19.1.2026';
                else if (programUpper.includes('B6') || programUpper.includes('M5') || programUpper.includes('MAJU 5') || programUpper.includes('BANGKIT 6'))
                    tabName = 'B6-M5 KICK OFF 4.12.2025';
                else if (programUpper.includes('B5') || programUpper.includes('M4') || programUpper.includes('MAJU 4') || programUpper.includes('BANGKIT 5'))
                    tabName = 'B5-M4 KICK OFF 6.8.2025';
                else if (programUpper.includes('MAIP'))
                    tabName = 'BBG MAIPk KICK OFF 17.12.25';
                else if (programUpper.includes('UKM') || programUpper.includes('MULA'))
                    tabName = 'BBG MULA UKM 3.11.25';

                if (tabName) {
                    // Check if there's a status column - we'll use column Q for status tracking
                    // Column Q is one column after P (report_id)
                    const statusRange = `${tabName}!Q${rowNumber}`;

                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: statusRange,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: {
                            values: [['SEMAKAN']]
                        }
                    });

                    sheetsSuccess = true;
                    console.log(`✅ Sheets status updated to 'SEMAKAN' at ${tabName}!Q${rowNumber}`);
                } else {
                    console.warn('⚠️ Could not determine tab name for program:', report.program);
                }
            } else {
                console.warn(`⚠️ Could not find row for report_id ${report.id} in payment tracking sheet`);
            }

        } catch (sheetError) {
            sheetsError = sheetError.message;
            console.error('⚠️ Sheets write failed (non-blocking):', sheetError);
            // Don't throw - Sheets failure is non-blocking
        }

        // 5. Log to dual_write_logs
        try {
            await supabase.from('dual_write_logs').insert({
                operation_type: 'revision_request',
                table_name: 'reports',
                record_id: report.id,
                supabase_success: true,
                sheets_success: sheetsSuccess,
                sheets_error: sheetsError,
                program: report.program,
                created_at: new Date().toISOString(),
                metadata: {
                    revision_number: newRevisionCount,
                    revision_reasons: revision_reasons,
                    requested_by: session.user.email
                }
            });
        } catch (logError) {
            console.error('⚠️ Failed to log to dual_write_logs:', logError);
        }

        return res.status(200).json({
            success: true,
            message: 'Revision request sent successfully',
            revision_number: newRevisionCount
        });

    } catch (err) {
        console.error('❌ Error requesting revision:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
