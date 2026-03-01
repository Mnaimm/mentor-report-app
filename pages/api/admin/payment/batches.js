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
        // Fetch all payment batches ordered by created_at DESC
        const { data: batches, error } = await supabase
            .from('payment_batches')
            .select(`
                id,
                batch_name,
                payment_date,
                status,
                total_amount,
                total_reports,
                created_by,
                paid_at,
                paid_by,
                notes,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Fetched ${batches?.length || 0} payment batches`);

        return res.status(200).json({
            success: true,
            data: batches || [],
            count: batches?.length || 0
        });

    } catch (err) {
        console.error('❌ Error fetching payment batches:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
