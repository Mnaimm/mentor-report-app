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
        // Fetch all reports with payment data
        const { data: reports, error } = await supabase
            .from('reports')
            .select(`
                mentor_email,
                nama_mentor,
                payment_status,
                base_payment_amount,
                paid_at
            `)
            .not('mentor_email', 'is', null);

        if (error) throw error;

        // Group by mentor and calculate stats
        const mentorMap = {};

        reports.forEach(report => {
            const email = report.mentor_email;
            const amount = parseFloat(report.base_payment_amount || 0);

            if (!mentorMap[email]) {
                mentorMap[email] = {
                    mentor_email: email,
                    mentor_name: report.nama_mentor || email,
                    sessions_paid: 0,
                    sessions_pending: 0,
                    sessions_submitted: 0,
                    sessions_total: 0,
                    total_paid: 0,
                    total_pending: 0,
                    last_paid_date: null
                };
            }

            const mentor = mentorMap[email];
            mentor.sessions_total++;

            if (report.payment_status === 'paid') {
                mentor.sessions_paid++;
                mentor.total_paid += amount;

                // Track last paid date
                if (report.paid_at) {
                    if (!mentor.last_paid_date || new Date(report.paid_at) > new Date(mentor.last_paid_date)) {
                        mentor.last_paid_date = report.paid_at;
                    }
                }
            } else if (report.payment_status === 'approved_for_payment') {
                mentor.sessions_pending++;
                mentor.total_pending += amount;
            } else if (report.payment_status === 'pending') {
                mentor.sessions_submitted++;
            }
        });

        // Convert to array and sort by total amount (paid + pending) descending
        const mentorSummary = Object.values(mentorMap)
            .sort((a, b) => (b.total_paid + b.total_pending) - (a.total_paid + a.total_pending));

        console.log(`✅ Generated summary for ${mentorSummary.length} mentors`);

        return res.status(200).json({
            success: true,
            data: mentorSummary,
            count: mentorSummary.length
        });

    } catch (err) {
        console.error('❌ Error generating mentor summary:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
