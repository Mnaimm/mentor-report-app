import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';
import { createAdminClient } from '../../../../../lib/supabaseAdmin';

function normalizeBatchName(name) {
  if (!name) return name;
  return name.startsWith('Batch ') ? name : 'Batch ' + name;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Mentor ID required' });

  try {
    const supabase = createAdminClient();

    // Stage 1: mentor info + active batch IDs in parallel
    const [
      { data: mentor, error: mentorError },
      { data: activeBatchRows, error: activeBatchError },
    ] = await Promise.all([
      supabase.from('mentors').select('id, name, email, phone').eq('id', id).single(),
      supabase.from('batch_rounds').select('batch_id').eq('is_active', true),
    ]);

    if (mentorError) throw mentorError;
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    if (activeBatchError) throw activeBatchError;

    const activeBatchIds = [...new Set((activeBatchRows || []).map(r => r.batch_id).filter(Boolean))];

    // Stage 2: assignments filtered to active batches + reports in parallel
    // Assignments with no batch_id (ent.batch fallback cases) are excluded by the .in() filter.
    const [
      { data: assignments, error: assignmentsError },
      { data: reportRows, error: reportsError },
    ] = await Promise.all([
      activeBatchIds.length > 0
        ? supabase
            .from('mentor_assignments')
            .select('entrepreneur_id, entrepreneurs(id, name, business_name, zone, batch, program), batches(batch_name, program)')
            .eq('mentor_id', id)
            .eq('status', 'active')
            .eq('is_active', true)
            .in('batch_id', activeBatchIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('reports').select('entrepreneur_id').eq('mentor_id', id),
    ]);

    if (assignmentsError) throw assignmentsError;
    if (reportsError) throw reportsError;

    // Session count per entrepreneur
    const sessionCountMap = {};
    for (const r of reportRows || []) {
      if (r.entrepreneur_id) {
        sessionCountMap[r.entrepreneur_id] = (sessionCountMap[r.entrepreneur_id] || 0) + 1;
      }
    }

    // Group by batch
    const batchMap = {};
    let totalMentees = 0;
    let totalSessions = 0;

    for (const a of assignments || []) {
      const ent = a.entrepreneurs;
      if (!ent) continue;

      const rawBatch = a.batches?.batch_name || ent.batch;
      const batchName = normalizeBatchName(rawBatch) || 'Tiada Batch';
      const rawProgram = String(a.batches?.program || ent.program || '').toLowerCase();
      const program = rawProgram.includes('maju') ? 'Maju' : 'Bangkit';

      if (!batchMap[batchName]) batchMap[batchName] = { batch_name: batchName, program, mentees: [] };

      const sessions = sessionCountMap[ent.id] || 0;
      totalSessions += sessions;
      totalMentees++;

      batchMap[batchName].mentees.push({
        id: ent.id,
        name: ent.name || '',
        business_name: ent.business_name || '',
        zone: ent.zone || '',
        sessions_submitted: sessions,
      });
    }

    const batches = Object.values(batchMap)
      .sort((a, b) => a.batch_name.localeCompare(b.batch_name))
      .map(b => ({ ...b, mentees: b.mentees.sort((a, c) => a.name.localeCompare(c.name)) }));

    // Derive mentor's primary zone from mentees
    const zoneCounts = {};
    for (const b of batches) {
      for (const m of b.mentees) {
        if (m.zone) zoneCounts[m.zone] = (zoneCounts[m.zone] || 0) + 1;
      }
    }
    const primaryZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    return res.status(200).json({
      success: true,
      data: {
        mentor: { ...mentor, zone: primaryZone },
        batches,
        summary: { total_mentees: totalMentees, total_sessions: totalSessions },
      },
    });
  } catch (error) {
    console.error('[mentors/[id]/profile] ❌', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
