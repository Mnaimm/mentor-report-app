import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('id, name, email')
      .eq('is_khas', true)
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('[khas/mentors-list] ❌', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
