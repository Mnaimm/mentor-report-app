import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { entrepreneur_id } = req.query;
  if (!entrepreneur_id) return res.status(400).json({ error: 'entrepreneur_id required' });

  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('pemerhatian')
      .eq('entrepreneur_id', entrepreneur_id)
      .eq('program', 'Bangkit')
      .not('pemerhatian', 'is', null)
      .order('submission_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return res.status(200).json({ pemerhatian: '' });
    return res.status(200).json({ pemerhatian: data.pemerhatian || '' });
  } catch {
    return res.status(200).json({ pemerhatian: '' });
  }
}
