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

    try {
        // 1. Fetch current report to verify it's in approved_for_payment status
        const { data: report, error: fetchError } = await supabase
            .from('reports')
            .select('id, payment_status, status')
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            throw new Error('Report not found');
        }

        // 2. Verify report is in approved_for_payment status
        if (report.payment_status !== 'approved_for_payment') {
            return res.status(400).json({
                success: false,
                error: `Cannot unapprove report with payment_status='${report.payment_status}'. Only 'approved_for_payment' reports can be unapproved.`
            });
        }

        // 3. Revert approval - set back to submitted/pending state
        const updates = {
            status: 'submitted',
            payment_status: 'pending',
            approved_at: null,
            reviewed_at: null,
            reviewed_by: null
        };

        const { error: updateError } = await supabase
            .from('reports')
            .update(updates)
            .eq('id', id);

        if (updateError) throw updateError;

        console.log(`✅ Report ${id} unapproved by ${session.user.email}`);

        // 4. Log the unapproval action to dual_write_logs for audit trail
        try {
            await supabase.from('dual_write_logs').insert({
                operation_type: 'unapprove',
                table_name: 'reports',
                record_id: id,
                supabase_success: true,
                sheets_success: null,
                created_at: new Date().toISOString(),
                metadata: {
                    admin_email: session.user.email,
                    previous_status: report.status,
                    previous_payment_status: report.payment_status,
                    action: 'admin_correction'
                }
            });
        } catch (logError) {
            console.error('⚠️ Failed to log unapproval (non-blocking):', logError);
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Error unapproving report:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
