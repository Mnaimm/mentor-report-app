import { getSession } from 'next-auth/react';
import supabaseAdmin from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { entrepreneurId } = req.query;
  if (!entrepreneurId) return res.status(400).json({ error: 'entrepreneurId is required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('upward_mobility_reports')
      .select(`
        sesi_mentoring,
        jenis_perniagaan,
        bank_akaun_semasa,
        bank_bizapp,
        bank_al_awfar,
        bank_merchant_terminal,
        bank_fasiliti_lain,
        bank_mesinkira,
        aset_tunai_semasa,
        ulasan_aset_tunai,
        aset_bukan_tunai_semasa,
        ulasan_aset_bukan_tunai,
        simpanan_semasa,
        zakat_semasa,
        digital_semasa,
        marketing_semasa,
        ulasan_marketing
      `)
      .eq('entrepreneur_id', entrepreneurId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({ data: data || null });
  } catch (error) {
    console.error('[um/latest-report] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
