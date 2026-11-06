import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import supabaseAdmin from '../../../lib/supabaseAdmin';
import { resolveUMVersion } from '../../../lib/resolveUMVersion';

export default async function handler(req, res) {
  console.log('[UM latest-report] Called with entrepreneurId:', req.query.entrepreneurId);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { entrepreneurId, email } = req.query;
  if (!entrepreneurId && !email) return res.status(400).json({ error: 'entrepreneurId or email is required' });

  try {
    // Email fallback for mapping rows without entrepreneur_id: version only, no prefill data.
    // Used only on an exact single match; zero or duplicate matches return umVersion null.
    if (!entrepreneurId) {
      const { data: matches, error: emailError } = await supabaseAdmin
        .from('entrepreneurs')
        .select('id')
        .eq('email', String(email).toLowerCase().trim())
        .limit(2);
      if (emailError) throw emailError;
      if (!matches || matches.length !== 1) return res.status(200).json({ data: null, umVersion: null });

      const byEmail = await resolveUMVersion(supabaseAdmin, { entrepreneurId: matches[0].id });
      if (byEmail.error) console.error('[UM latest-report] UM version lookup failed:', byEmail.error);
      return res.status(200).json({ data: null, umVersion: byEmail.error ? null : byEmail.version });
    }

    const { data, error } = await supabaseAdmin
      .from('upward_mobility_reports')
      .select(`
        sesi_mentoring,
        jenis_perniagaan,
        tarikh_lawatan,
        bank_akaun_semasa,
        bank_bizapp,
        bank_al_awfar,
        bank_merchant_terminal,
        bank_fasiliti_lain,
        bank_mesinkira,
        pekerja_semasa,
        ulasan_pekerja,
        pekerja_parttime_semasa,
        ulasan_pekerja_parttime,
        aset_tunai_semasa,
        ulasan_aset_tunai,
        aset_bukan_tunai_semasa,
        ulasan_aset_bukan_tunai,
        simpanan_semasa,
        ulasan_simpanan,
        zakat_semasa,
        ulasan_zakat,
        digital_semasa,
        ulasan_digital,
        marketing_semasa,
        ulasan_marketing
      `)
      .eq('entrepreneur_id', entrepreneurId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Form version for the client-side block only; the submit routes enforce it themselves.
    // A failed lookup returns null so prefill still works (the submit guard fails closed).
    const umResolution = await resolveUMVersion(supabaseAdmin, { entrepreneurId });
    if (umResolution.error) console.error('[UM latest-report] UM version lookup failed:', umResolution.error);

    return res.status(200).json({
      data: data || null,
      umVersion: umResolution.error ? null : umResolution.version,
    });
  } catch (error) {
    console.error('[UM latest-report] Error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
}
