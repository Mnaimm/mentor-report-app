import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseAdmin = createAdminClient();

  try {
    // Get all active assignments joined to active mentors
    const { data: assignments, error } = await supabaseAdmin
      .from('mentor_assignments')
      .select('mentors!inner(id, name, email)')
      .eq('status', 'active')
      .eq('is_active', true)
      .eq('mentors.status', 'active');

    if (error) throw error;

    // Deduplicate by email, sort alphabetically
    const seen = new Set();
    const mentors = (assignments || [])
      .map(a => a.mentors)
      .filter(m => {
        if (seen.has(m.email)) return false;
        seen.add(m.email);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(m => ({ name: m.name, email: m.email }));

    return res.status(200).json(mentors);
  } catch (error) {
    console.error('[mentor-list] ❌ Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
