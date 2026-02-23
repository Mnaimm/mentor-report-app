import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessPaymentAdmin } from '../../../../lib/auth';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
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

    try {
        // Fetch approved reports that haven't been added to a payment batch yet
        const { data: reports, error } = await supabase
            .from('reports')
            .select(`
                id,
                nama_mentor,
                mentor_email,
                nama_usahawan,
                nama_syarikat,
                program,
                session_number,
                premis_dilawat,
                base_payment_amount,
                adjusted_payment_amount,
                approved_at,
                payment_batch_id,
                sheets_row_number
            `)
            .eq('payment_status', 'approved')
            .is('payment_batch_id', null)
            .order('approved_at', { ascending: false });

        if (error) throw error;

        // Handle empty results
        if (!reports || reports.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                count: 0
            });
        }

        // Fetch mentor bank details
        const mentorEmails = [...new Set(reports.map(r => r.mentor_email))];
        const { data: mentors, error: mentorError } = await supabase
            .from('mentors')
            .select('email, name, bank_account')
            .in('email', mentorEmails);

        if (mentorError) console.error('Error fetching mentor details:', mentorError);

        // Map bank details to reports
        const mentorMap = {};
        (mentors || []).forEach(m => {
            mentorMap[m.email] = m;
        });

        const enrichedReports = reports.map(r => {
            const mentorInfo = mentorMap[r.mentor_email] || {};
            return {
                ...r,
                // Transform database column names to frontend-friendly names
                mentor_name: r.nama_mentor || mentorInfo.name || r.mentor_email,
                mentee_name: r.nama_usahawan,
                bank_account: mentorInfo.bank_account || 'N/A'
            };
        });

        return res.status(200).json({
            success: true,
            data: enrichedReports,
            count: enrichedReports.length
        });

    } catch (err) {
        console.error('Error fetching approved reports:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
