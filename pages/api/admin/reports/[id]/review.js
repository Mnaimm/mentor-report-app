import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';
import { updateSheetStatus, writeVerificationToSheet } from '../../../../../lib/googleSheets';

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
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    try {
        // 1. Fetch current report to get all necessary fields
        const { data: report, error: fetchError } = await supabase
            .from('reports')
            .select('id, sheets_row_number, program, mentor_email, submission_date, verification_nota, base_payment_amount')
            .eq('id', id)
            .single();

        if (fetchError || !report) throw new Error('Report not found');

        // 2. Prepare Update Payload
        const updates = {
            status: status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: session.user.email,
            rejection_reason: status === 'rejected' ? rejectionReason : null,

            // Update payment status based on approval
            payment_status: status === 'approved' ? 'approved_for_payment' :
                           status === 'rejected' ? 'rejected' :
                           'pending',

            // Set approval timestamp for approved reports
            approved_at: status === 'approved' ? new Date().toISOString() : null,
        };

        // 3. UPDATE SUPABASE (BLOCKING - primary source of truth)
        const { error: updateError } = await supabase
            .from('reports')
            .update(updates)
            .eq('id', id);

        if (updateError) throw updateError;

        console.log(`✅ Report ${id} status updated to '${status}' in Supabase`);

        // 4. DUAL-WRITE TO SHEETS (NON-BLOCKING)
        // Only write to payment tracking sheet if status is 'approved'
        if (status === 'approved') {
            try {
                console.log(`🔄 Writing verification data to payment tracking sheet...`);

                const verificationData = {
                    submission_date: report.submission_date,
                    verification_nota: report.verification_nota,
                    base_payment_amount: report.base_payment_amount
                };

                const sheetsWritten = await writeVerificationToSheet(
                    report.program,
                    report.id,
                    verificationData
                );

                if (sheetsWritten) {
                    console.log('✅ Verification data written to payment tracking sheet');
                } else {
                    console.warn('⚠️ Payment tracking sheet write failed (non-blocking)');
                }

                // Log to dual_write_logs
                await supabase.from('dual_write_logs').insert({
                    operation_type: 'verify_approve',
                    table_name: 'reports',
                    record_id: report.id,
                    supabase_success: true,
                    sheets_success: sheetsWritten,
                    sheets_error: sheetsWritten ? null : 'Failed to write verification data',
                    program: report.program,
                    created_at: new Date().toISOString()
                });

            } catch (sheetError) {
                console.error('⚠️ Payment tracking sheet write failed (non-blocking):', sheetError);

                // Log failure
                try {
                    await supabase.from('dual_write_logs').insert({
                        operation_type: 'verify_approve',
                        table_name: 'reports',
                        record_id: report.id,
                        supabase_success: true,
                        sheets_success: false,
                        sheets_error: sheetError.message,
                        program: report.program,
                        created_at: new Date().toISOString()
                    });
                } catch (logError) {
                    console.error('⚠️ Failed to log to dual_write_logs:', logError);
                }
            }
        }

        // 5. Also sync to legacy Sheets (for backward compatibility)
        if (report.sheets_row_number) {
            try {
                console.log(`🔄 Syncing status '${status}' to legacy Sheets (Row ${report.sheets_row_number})...`);
                const sheetUpdated = await updateSheetStatus(
                    report.program,
                    report.sheets_row_number,
                    status,
                    rejectionReason
                );

                if (sheetUpdated) console.log('✅ Legacy sheet status updated.');
                else console.warn('⚠️ Legacy sheet status update failed or row number invalid.');
            } catch (legacyError) {
                console.error('⚠️ Legacy sheet update failed (non-blocking):', legacyError);
            }
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Error reviewing report:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
