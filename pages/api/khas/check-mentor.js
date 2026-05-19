import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();
  const email = session.user.email?.toLowerCase().trim();

  try {
    const [{ data: mentor }, { data: roles }] = await Promise.all([
      supabase
        .from('mentors')
        .select('id, is_khas')
        .eq('email', email)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('email', email),
    ]);

    const isCoordinator = (roles || []).some(r => r.role === 'program_coordinator');
    const isAdmin = (roles || []).some(r => r.role === 'system_admin');

    return res.status(200).json({
      isKhas: mentor?.is_khas === true,
      isCoordinator,
      isAdmin,
      mentorId: mentor?.id || null,
    });
  } catch (err) {
    console.error('[khas/check-mentor] ❌', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
