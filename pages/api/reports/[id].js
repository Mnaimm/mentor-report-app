import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

// Use SERVICE_ROLE_KEY to bypass RLS
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

    const { id } = req.query;

    try {
        const { data: report, error } = await supabase
            .from('reports')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching report:', error);
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        return res.status(200).json(report);

    } catch (err) {
        console.error('❌ Error in get report API:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
