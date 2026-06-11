import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createAdminClient } from '../../lib/supabaseAdmin';
import { canAccessAdmin } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();
  const userEmail = session.user.email.toLowerCase().trim();
  const isAdmin = await canAccessAdmin(userEmail);

  if (isAdmin) {
    const { data, error } = await supabase
      .from('batch_rounds')
      .select('id, batch_name, program, round_number, round_name, period_label, start_date, end_date, batch_id')
      .not('batch_name', 'is', null)
      .order('program', { ascending: true })
      .order('batch_name', { ascending: true })
      .order('round_number', { ascending: true });

    if (error) {
      console.error('[batch-timeline] admin query error:', error.message);
      return res.status(500).json({ error: 'DB error' });
    }

    return res.json({ rounds: data || [], role: 'admin' });
  }

  // Mentor flow: resolve mentor_id from email via mentors table
  const { data: mentor, error: mentorError } = await supabase
    .from('mentors')
    .select('id')
    .ilike('email', userEmail)
    .maybeSingle();

  if (mentorError) {
    console.error('[batch-timeline] mentor lookup error:', mentorError.message);
    return res.status(500).json({ error: 'DB error' });
  }
  if (!mentor) return res.json({ rounds: [], role: 'mentor' });

  // Active assignments — both conditions per CLAUDE.md
  const { data: assignments, error: assignError } = await supabase
    .from('mentor_assignments')
    .select('batch_id')
    .eq('mentor_id', mentor.id)
    .eq('status', 'active')
    .eq('is_active', true);

  if (assignError) {
    console.error('[batch-timeline] assignments error:', assignError.message);
    return res.status(500).json({ error: 'DB error' });
  }

  const batchIds = [...new Set((assignments || []).map(a => a.batch_id).filter(Boolean))];
  if (batchIds.length === 0) return res.json({ rounds: [], role: 'mentor' });

  const { data, error } = await supabase
    .from('batch_rounds')
    .select('id, batch_name, program, round_number, round_name, period_label, start_date, end_date, batch_id')
    .not('batch_name', 'is', null)
    .in('batch_id', batchIds)
    .order('program', { ascending: true })
    .order('batch_name', { ascending: true })
    .order('round_number', { ascending: true });

  if (error) {
    console.error('[batch-timeline] batch_rounds error:', error.message);
    return res.status(500).json({ error: 'DB error' });
  }

  return res.json({ rounds: data || [], role: 'mentor' });
}
