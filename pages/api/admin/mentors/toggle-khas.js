import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  const { mentor_id, is_khas } = req.body;
  if (!mentor_id || typeof is_khas !== 'boolean') {
    return res.status(400).json({ error: 'mentor_id and is_khas (boolean) are required' });
  }

  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .from('mentors')
      .update({ is_khas })
      .eq('id', mentor_id);

    if (error) throw error;

    console.log(`✅ [toggle-khas] Mentor ${mentor_id} is_khas set to ${is_khas} by ${session.user.email}`);

    return res.status(200).json({ success: true, mentor_id, is_khas });
  } catch (err) {
    console.error('[toggle-khas] ❌', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
