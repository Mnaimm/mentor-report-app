import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';

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
    const { amount } = req.body;

    // Validate amount
    if (amount === null || amount === undefined || amount === '') {
        return res.status(400).json({ success: false, error: 'Payment amount is required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ success: false, error: 'Invalid payment amount. Must be a positive number.' });
    }

    try {
        // 1. Fetch current report to verify it exists and get current amount
        const { data: report, error: fetchError } = await supabase
            .from('reports')
            .select('id, base_payment_amount')
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            throw new Error('Report not found');
        }

        const previousAmount = report.base_payment_amount;

        // 2. Update the base_payment_amount
        const { error: updateError } = await supabase
            .from('reports')
            .update({ base_payment_amount: numAmount })
            .eq('id', id);

        if (updateError) throw updateError;

        console.log(`✅ Report ${id} payment amount updated from RM${previousAmount} to RM${numAmount} by ${session.user.email}`);

        // 3. Log the update to dual_write_logs for audit trail
        try {
            await supabase.from('dual_write_logs').insert({
                operation_type: 'update_payment_amount',
                table_name: 'reports',
                record_id: id,
                supabase_success: true,
                sheets_success: null,
                created_at: new Date().toISOString(),
                metadata: {
                    admin_email: session.user.email,
                    previous_amount: previousAmount,
                    new_amount: numAmount,
                    action: 'admin_adjustment'
                }
            });
        } catch (logError) {
            console.error('⚠️ Failed to log payment amount update (non-blocking):', logError);
        }

        return res.status(200).json({
            success: true,
            data: {
                previous_amount: previousAmount,
                new_amount: numAmount
            }
        });

    } catch (err) {
        console.error('Error updating payment amount:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
