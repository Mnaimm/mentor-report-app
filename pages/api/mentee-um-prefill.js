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
      .from('upward_mobility_reports')
      .select('tarikh_lawatan')
      .eq('entrepreneur_id', entrepreneur_id)
      .not('tarikh_lawatan', 'is', null)
      .neq('tarikh_lawatan', '')
      .neq('tarikh_lawatan', 'Belum dilawat')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const tarikh = (data?.tarikh_lawatan ?? '').trim();
    return res.status(200).json({
      UM_TARIKH_LAWATAN_PREMIS: tarikh,
    });
  } catch (error) {
    console.error('[mentee-um-prefill] ❌ Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
