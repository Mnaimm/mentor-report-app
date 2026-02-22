import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../lib/auth';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // Check Auth
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check Admin Access
    const hasAccess = await canAccessAdmin(session.user.email);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Access denied - Admin role required' });
    }

    const { status = 'submitted', limit = 50, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    console.log(`🔍 Fetching reports with status="${status}", limit=${limit}, page=${page}`);

    try {
        let query = supabase
            .from('reports')
            .select(`
        id,
        mentor_email,
        nama_mentor,
        nama_usahawan,
        program,
        session_number,
        submission_date,
        status,
        entrepreneur_id,
        mentor_id
      `, { count: 'exact' })
            .order('submission_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }

        console.log(`✅ Found ${data?.length || 0} reports (total: ${count})`);

        // Normalizing keys for frontend consistency (frontend verification/index.js expects camelCase/snakeCase mix)
        // The query returns `nama_mentor`, but frontend expects `mentor_name`?
        // Let's check `pages/admin/verification/index.js`:
        // report.mentor_name, report.mentee_name, report.program, report.session_number, report.status

        const formattedData = data.map(r => ({
            id: r.id,
            mentor_name: r.nama_mentor || r.mentor_email,
            mentee_name: r.nama_usahawan || 'Unknown Mentee',
            program: r.program,
            session_number: r.session_number,
            submission_date: r.submission_date,
            status: r.status
        }));

        return res.status(200).json({
            success: true,
            data: formattedData,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (err) {
        console.error('Error fetching reports:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
