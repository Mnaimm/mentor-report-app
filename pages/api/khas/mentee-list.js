import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { mentor_id } = req.query;
  if (!mentor_id) return res.status(400).json({ error: 'mentor_id is required' });

  const supabase = createAdminClient();

  try {
    const { data: assignments, error: assignErr } = await supabase
      .from('mentor_assignments')
      .select(`
        id,
        entrepreneurs (
          id,
          name,
          email,
          phone,
          business_name,
          address,
          program,
          batch,
          folder_id,
          zone,
          state
        )
      `)
      .eq('mentor_id', mentor_id)
      .eq('status', 'active')
      .eq('is_active', true);

    if (assignErr) throw assignErr;

    const mentees = (assignments || [])
      .filter(a => a.entrepreneurs)
      .map(a => {
        const e = a.entrepreneurs;
        const program = String(e.program || '').toLowerCase();
        return {
          entrepreneur_id: e.id,
          Usahawan: e.name || '',
          Emel: e.email || '',
          No_Tel: e.phone || 'N/A',
          Nama_Syarikat: e.business_name || '',
          Alamat: e.address || '',
          Batch: e.batch || '',
          Folder_ID: e.folder_id || '',
          program: e.program || '',
          programType: program.includes('maju') ? 'maju' : 'bangkit',
        };
      });

    return res.status(200).json(mentees);
  } catch (err) {
    console.error('[khas/mentee-list] ❌', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
