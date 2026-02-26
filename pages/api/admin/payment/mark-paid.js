import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessPaymentAdmin } from '../../../../lib/auth';
import { writePaymentToSheet } from '../../../../lib/googleSheets';

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

    const hasAccess = await canAccessPaymentAdmin(session.user.email);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Access denied - Payment Admin role required' });
    }

    const { batchId, paidDate, bankRef } = req.body;

    if (!batchId || !paidDate) {
        return res.status(400).json({ success: false, error: 'Missing required fields: batchId, paidDate' });
    }

    try {
        // 1. Fetch batch to validate and get approved_by
        const { data: batch, error: batchError } = await supabase
            .from('payment_batches')
            .select('id, batch_name, status, approved_by, total_reports')
            .eq('id', batchId)
            .single();

        if (batchError || !batch) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        if (batch.status === 'paid') {
            return res.status(400).json({ success: false, error: 'Batch already marked as paid' });
        }

        console.log(`📊 Marking batch ${batch.batch_name} as paid...`);

        // 2. UPDATE SUPABASE (BLOCKING - primary source of truth)
        const { error: updateError } = await supabase
            .from('payment_batches')
            .update({
                status: 'paid',
                paid_at: paidDate,
                paid_by: session.user.email,
                notes: bankRef ? `Bank Ref: ${bankRef}${batch.notes ? '\n' + batch.notes : ''}` : batch.notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', batchId);

        if (updateError) throw updateError;

        console.log(`✅ Batch ${batchId} marked as paid in Supabase`);

        // 3. Fetch all payment_batch_items for this batch
        const { data: batchItems, error: itemsError } = await supabase
            .from('payment_batch_items')
            .select('report_id')
            .eq('batch_id', batchId);

        if (itemsError) throw itemsError;

        console.log(`📋 Found ${batchItems.length} reports in batch ${batchId}`);

        // 4. Fetch all reports linked to this batch
        const reportIds = batchItems.map(item => item.report_id);

        const { data: reports, error: reportsError } = await supabase
            .from('reports')
            .select('id, program')
            .in('id', reportIds);

        if (reportsError) throw reportsError;

        console.log(`📊 Fetched ${reports.length} report records`);

        // 5. DUAL-WRITE TO GOOGLE SHEETS (NON-BLOCKING)
        let sheetsUpdatedCount = 0;
        const sheetsErrors = [];

        for (const report of reports) {
            try {
                console.log(`🔄 Writing payment data for report ${report.id}...`);

                const paymentData = {
                    approved_by: batch.approved_by || 'Unknown',
                    paid_date: paidDate
                };

                const sheetsWritten = await writePaymentToSheet(
                    report.program,
                    report.id,
                    paymentData
                );

                if (sheetsWritten) {
                    sheetsUpdatedCount++;
                    console.log(`✅ Payment data written for report ${report.id}`);
                } else {
                    console.warn(`⚠️ Failed to write payment data for report ${report.id}`);
                    sheetsErrors.push({ reportId: report.id, error: 'Write failed' });
                }

                // Log each write attempt to dual_write_logs
                await supabase.from('dual_write_logs').insert({
                    operation_type: 'payment_mark_paid',
                    table_name: 'payment_batches',
                    record_id: batchId,
                    supabase_success: true,
                    sheets_success: sheetsWritten,
                    sheets_error: sheetsWritten ? null : 'Failed to write payment data',
                    program: report.program,
                    created_at: new Date().toISOString(),
                    metadata: {
                        report_id: report.id,
                        batch_name: batch.batch_name,
                        paid_date: paidDate
                    }
                });

            } catch (sheetError) {
                console.error(`⚠️ Sheet write failed for report ${report.id} (non-blocking):`, sheetError);
                sheetsErrors.push({ reportId: report.id, error: sheetError.message });

                // Log failure
                try {
                    await supabase.from('dual_write_logs').insert({
                        operation_type: 'payment_mark_paid',
                        table_name: 'payment_batches',
                        record_id: batchId,
                        supabase_success: true,
                        sheets_success: false,
                        sheets_error: sheetError.message,
                        program: report.program,
                        created_at: new Date().toISOString(),
                        metadata: {
                            report_id: report.id,
                            batch_name: batch.batch_name,
                            paid_date: paidDate
                        }
                    });
                } catch (logError) {
                    console.error('⚠️ Failed to log to dual_write_logs:', logError);
                }
            }
        }

        console.log(`✅ Updated ${sheetsUpdatedCount}/${reports.length} rows in Google Sheets`);

        return res.status(200).json({
            success: true,
            batchId: batch.id,
            batchName: batch.batch_name,
            totalReports: reports.length,
            sheetsUpdated: sheetsUpdatedCount,
            sheetsErrors: sheetsErrors.length > 0 ? sheetsErrors : undefined
        });

    } catch (err) {
        console.error('❌ Error marking batch as paid:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
