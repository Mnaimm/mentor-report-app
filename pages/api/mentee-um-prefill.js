import { getSession } from 'next-auth/react';
import { createAdminClient } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { entrepreneur_id } = req.query;
  if (!entrepreneur_id) {
    return res.status(400).json({ error: 'entrepreneur_id is required' });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('reports')
      .select('upward_mobility_data')
      .eq('entrepreneur_id', entrepreneur_id)
      .in('status', ['submitted', 'approved'])
      .order('session_number', { ascending: false })
      .order('submission_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({
      UM_TARIKH_LAWATAN_PREMIS: data?.upward_mobility_data?.UM_TARIKH_LAWATAN_PREMIS ?? '',
    });
  } catch (error) {
    console.error('[mentee-um-prefill] ❌ Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
