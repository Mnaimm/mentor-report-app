import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createAdminClient } from '../../lib/supabaseAdmin';
import { canAccessAdmin } from '../../lib/auth';

// batch_rounds.batch_name / .program are inconsistently populated (null on most
// rows for newer batches — see CLAUDE.md). Resolve canonical values from
// `batches` via batch_id instead of trusting batch_rounds' own columns.
function resolveRounds(rounds, batches) {
  const batchMap = {};
  (batches || []).forEach(b => { batchMap[b.id] = b; });

  return (rounds || [])
    .map(r => {
      const batch = batchMap[r.batch_id];
      return {
        ...r,
        batch_name: batch?.batch_name || r.batch_name || null,
        program: batch?.program || r.program || null,
      };
    })
    .filter(r => r.batch_name) // drop rounds that still can't be attributed to a batch
    .sort((a, b) =>
      (a.program || '').localeCompare(b.program || '') ||
      (a.batch_name || '').localeCompare(b.batch_name || '') ||
      (a.round_number || 0) - (b.round_number || 0)
    );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();
  const userEmail = session.user.email.toLowerCase().trim();
  const isAdmin = await canAccessAdmin(userEmail);

  if (isAdmin) {
    const [{ data: rounds, error: roundsError }, { data: batches, error: batchesError }] = await Promise.all([
      supabase
        .from('batch_rounds')
        .select('id, batch_name, program, round_number, round_name, period_label, start_date, end_date, batch_id'),
      supabase
        .from('batches')
        .select('id, batch_name, program'),
    ]);

    if (roundsError) {
      console.error('[batch-timeline] admin query error:', roundsError.message);
      return res.status(500).json({ error: 'DB error' });
    }
    if (batchesError) {
      console.error('[batch-timeline] batches query error:', batchesError.message);
      return res.status(500).json({ error: 'DB error' });
    }

    return res.json({ rounds: resolveRounds(rounds, batches), role: 'admin' });
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

  const [{ data: rounds, error: roundsError }, { data: batches, error: batchesError }] = await Promise.all([
    supabase
      .from('batch_rounds')
      .select('id, batch_name, program, round_number, round_name, period_label, start_date, end_date, batch_id')
      .in('batch_id', batchIds),
    supabase
      .from('batches')
      .select('id, batch_name, program')
      .in('id', batchIds),
  ]);

  if (roundsError) {
    console.error('[batch-timeline] batch_rounds error:', roundsError.message);
    return res.status(500).json({ error: 'DB error' });
  }
  if (batchesError) {
    console.error('[batch-timeline] batches error:', batchesError.message);
    return res.status(500).json({ error: 'DB error' });
  }

  return res.json({ rounds: resolveRounds(rounds, batches), role: 'mentor' });
}
