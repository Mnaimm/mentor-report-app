import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessPaymentAdmin } from '../../../../lib/auth';
import { updateSheetPaymentStatus } from '../../../../lib/googleSheets';

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

    const { batchName, paymentDate, notes, reportIds } = req.body;

    if (!batchName || !paymentDate || !reportIds || reportIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        // 1. Fetch reports to calculate totals and validate
        const { data: reports, error: fetchError } = await supabase
            .from('reports')
            .select('id, adjusted_payment_amount, base_payment_amount, payment_batch_id, program, sheets_row_number')
            .in('id', reportIds);

        if (fetchError) throw fetchError;

        // Validate all reports are available
        if (reports.length !== reportIds.length) {
            return res.status(400).json({
                success: false,
                error: 'Some reports not found or already in a batch'
            });
        }

        // Check if any reports already have a batch
        const alreadyBatched = reports.filter(r => r.payment_batch_id !== null);
        if (alreadyBatched.length > 0) {
            return res.status(400).json({
                success: false,
                error: `${alreadyBatched.length} report(s) already in a payment batch`
            });
        }

        // Calculate total amount
        const totalAmount = reports.reduce((sum, r) => {
            return sum + parseFloat(r.adjusted_payment_amount || r.base_payment_amount || 0);
        }, 0);

        // 2. Create payment batch
        const { data: batch, error: batchError } = await supabase
            .from('payment_batches')
            .insert({
                batch_name: batchName,
                payment_date: paymentDate,
                notes: notes || null,
                created_by: session.user.email,
                status: 'pending',
                total_amount: totalAmount,
                total_reports: reports.length,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (batchError) throw batchError;

        console.log(`✅ Created payment batch: ${batch.id} - ${batchName}`);

        // 3. Create payment batch items
        const batchItems = reports.map(r => ({
            batch_id: batch.id,
            report_id: r.id,
            base_amount: parseFloat(r.base_payment_amount || 0),
            adjusted_amount: parseFloat(r.adjusted_payment_amount || r.base_payment_amount || 0),
            created_at: new Date().toISOString()
        }));

        const { error: itemsError } = await supabase
            .from('payment_batch_items')
            .insert(batchItems);

        if (itemsError) throw itemsError;

        console.log(`✅ Created ${batchItems.length} batch items`);

        // 4. Update reports with batch_id and new payment_status
        const { error: updateError } = await supabase
            .from('reports')
            .update({
                payment_batch_id: batch.id,
                payment_status: 'approved_for_payment',
                updated_at: new Date().toISOString()
            })
            .in('id', reportIds);

        if (updateError) throw updateError;

        console.log(`✅ Updated ${reportIds.length} reports with batch_id`);

        // 5. Dual-write to Google Sheets (non-blocking)
        let sheetsUpdated = 0;
        for (const report of reports) {
            if (report.sheets_row_number) {
                try {
                    const success = await updateSheetPaymentStatus(
                        report.program,
                        report.sheets_row_number,
                        'Approved for Payment',
                        batchName
                    );
                    if (success) sheetsUpdated++;
                } catch (sheetErr) {
                    console.error(`⚠️ Failed to update Sheets for row ${report.sheets_row_number}:`, sheetErr);
                    // Non-blocking - continue
                }
            }
        }

        console.log(`✅ Updated ${sheetsUpdated}/${reports.length} rows in Google Sheets`);

        return res.status(200).json({
            success: true,
            batchId: batch.id,
            batchName: batch.batch_name,
            totalReports: reports.length,
            totalAmount: totalAmount,
            sheetsUpdated: sheetsUpdated
        });

    } catch (err) {
        console.error('❌ Error creating payment batch:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
