import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';
import { updateSheetStatus } from '../../../../../lib/googleSheets';

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
        // 1. Fetch current report to get row number & program
        const { data: report, error: fetchError } = await supabase
            .from('reports')
            .select('sheets_row_number, program, mentor_email')
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
            payment_status: status === 'approved' ? 'approved' :
                           status === 'rejected' ? 'rejected' :
                           'pending',

            // Set approval timestamp for approved reports
            approved_at: status === 'approved' ? new Date().toISOString() : null,
        };

        const { error: updateError } = await supabase
            .from('reports')
            .update(updates)
            .eq('id', id);

        if (updateError) throw updateError;

        // 3. Sync to Google Sheets
        if (report.sheets_row_number) {
            console.log(`🔄 Syncing status '${status}' to Sheets (Row ${report.sheets_row_number})...`);
            // Run as background promise (or await if critical) - let's await for reliability in admin actions
            const sheetUpdated = await updateSheetStatus(
                report.program,
                report.sheets_row_number,
                status,
                rejectionReason
            );

            if (sheetUpdated) console.log('✅ Sheet status updated.');
            else console.warn('⚠️ Sheet status update failed or row number invalid.');
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Error reviewing report:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
