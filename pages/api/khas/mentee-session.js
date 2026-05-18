import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { entrepreneur_id, program } = req.query;
  if (!entrepreneur_id || !program) {
    return res.status(400).json({ error: 'entrepreneur_id and program are required' });
  }

  const supabase = createAdminClient();
  const normalizedProgram = program.charAt(0).toUpperCase() + program.slice(1).toLowerCase();

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('session_number')
      .eq('entrepreneur_id', entrepreneur_id)
      .eq('program', normalizedProgram)
      .order('session_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const lastSession = data?.session_number || 0;
    const nextSession = Math.min(lastSession + 1, 4);

    return res.status(200).json({ lastSession, nextSession });
  } catch (err) {
    console.error('[khas/mentee-session] ❌', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
