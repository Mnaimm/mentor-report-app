// Kapasiti Mentor (Stage 1) — read-only mentor capacity per cohort pair.
//
// A "cohort pair" groups Bangkit batch N with Maju batch N-1 (e.g. B7-M6), since
// they run on the same timeline. Running = max(canonical batch_rounds.end_date) >= today.
// batches.end_date / batches.status are NOT used (unreliable).
import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';

const DEFAULT_CAP = 10;

const normProgram = (p) => {
  const s = String(p || '').toLowerCase();
  if (s.includes('maju')) return 'maju';
  if (s.includes('bangkit')) return 'bangkit';
  return s || null;
};

const batchNumberOf = (b) => {
  if (Number.isInteger(b.batch_number)) return b.batch_number;
  const m = String(b.batch_name || '').match(/batch\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
};

// Bangkit N and Maju N-1 share pair key N
const pairKeyOf = (program, num) => {
  if (num == null) return null;
  if (program === 'bangkit') return num;
  if (program === 'maju') return num + 1;
  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  try {
    const supabase = createAdminClient();

    const [
      { data: rounds, error: roundsError },
      { data: batches, error: batchesError },
      { data: mentors, error: mentorsError },
      { data: assignments, error: assignmentsError },
    ] = await Promise.all([
      supabase
        .from('batch_rounds')
        .select('batch_id, batch_name, program, end_date')
        .eq('is_canonical', true)
        .not('batch_name', 'is', null),
      supabase.from('batches').select('id, batch_name, program, batch_number'),
      supabase.from('mentors').select('id, name, email, status, state, is_khas'),
      supabase
        .from('mentor_assignments')
        .select('id, mentor_id, entrepreneur_id, batch_id, entrepreneurs(name, program)')
        .eq('status', 'active')
        .eq('is_active', true),
    ]);

    if (roundsError) throw roundsError;
    if (batchesError) throw batchesError;
    if (mentorsError) throw mentorsError;
    if (assignmentsError) throw assignmentsError;

    const today = new Date().toISOString().slice(0, 10);

    // 1. Resolve canonical rounds → batches, compute last_end per batch
    const batchById = new Map((batches || []).map((b) => [b.id, b]));
    const batchByNameProgram = new Map(
      (batches || []).map((b) => [`${String(b.batch_name || '').toLowerCase()}|${normProgram(b.program)}`, b])
    );

    const batchLastEnd = new Map(); // batch_id -> last_end
    for (const r of rounds || []) {
      const batch = (r.batch_id && batchById.get(r.batch_id))
        || batchByNameProgram.get(`${String(r.batch_name).toLowerCase()}|${normProgram(r.program)}`);
      if (!batch || !r.end_date) continue;
      const prev = batchLastEnd.get(batch.id);
      if (!prev || r.end_date > prev) batchLastEnd.set(batch.id, r.end_date);
    }

    // 2. Build cohort pairs
    const pairByKey = new Map();
    const pairKeyByBatchId = new Map();
    for (const [batchId, lastEnd] of batchLastEnd) {
      const batch = batchById.get(batchId);
      const program = normProgram(batch.program);
      const key = pairKeyOf(program, batchNumberOf(batch));
      if (key == null) continue;

      if (!pairByKey.has(key)) {
        pairByKey.set(key, {
          key,
          label: `B${key}-M${key - 1}`,
          bangkit_batch_id: null,
          maju_batch_id: null,
          last_end: null,
          is_running: false,
        });
      }
      const pair = pairByKey.get(key);
      if (program === 'bangkit') pair.bangkit_batch_id = batchId;
      else pair.maju_batch_id = batchId;
      if (!pair.last_end || lastEnd > pair.last_end) pair.last_end = lastEnd;
      pairKeyByBatchId.set(batchId, key);
    }
    for (const pair of pairByKey.values()) pair.is_running = pair.last_end >= today;

    const runningPairs = [...pairByKey.values()].filter((p) => p.is_running).sort((a, b) => a.key - b.key);
    const runningKeys = new Set(runningPairs.map((p) => p.key));

    // 3. Aggregate assignments
    const mentorById = new Map((mentors || []).map((m) => [m.id, m]));
    const countsByMentor = new Map(); // mentor_id -> { [pairKey]: { bangkit, maju } }
    const nullBatchByMentor = new Map();
    const endedByMentor = new Map();

    const assignmentsWithoutBatch = [];
    const assignmentsUnmappedBatch = [];
    const endedByBatch = new Map(); // batch_id -> { ..., list }
    const pairStats = new Map(); // pairKey -> { mentors:Set, bangkit, maju }
    let excludedTest = 0;
    let orphanAssignments = 0;

    for (const a of assignments || []) {
      const entName = a.entrepreneurs?.name || '';
      if (entName.startsWith('TEST')) { excludedTest++; continue; }

      const mentor = mentorById.get(a.mentor_id);
      if (!mentor) { orphanAssignments++; continue; }

      if (!a.batch_id) {
        assignmentsWithoutBatch.push({
          assignment_id: a.id,
          mentor: mentor.name,
          mentor_id: mentor.id,
          entrepreneur: entName,
          entrepreneur_id: a.entrepreneur_id,
          program: a.entrepreneurs?.program || null,
        });
        nullBatchByMentor.set(mentor.id, (nullBatchByMentor.get(mentor.id) || 0) + 1);
        continue;
      }

      const pairKey = pairKeyByBatchId.get(a.batch_id);
      const batch = batchById.get(a.batch_id);
      if (pairKey == null) {
        assignmentsUnmappedBatch.push({
          assignment_id: a.id,
          mentor: mentor.name,
          entrepreneur: entName,
          batch_id: a.batch_id,
          batch_name: batch?.batch_name || null,
        });
        continue;
      }

      const program = normProgram(batch.program);

      if (!runningKeys.has(pairKey)) {
        if (!endedByBatch.has(a.batch_id)) {
          endedByBatch.set(a.batch_id, {
            batch_id: a.batch_id,
            batch_name: batch.batch_name,
            pair: pairByKey.get(pairKey).label,
            last_end: batchLastEnd.get(a.batch_id),
            count: 0,
            list: [],
          });
        }
        const e = endedByBatch.get(a.batch_id);
        e.count++;
        e.list.push({ assignment_id: a.id, mentor: mentor.name, entrepreneur: entName });
        endedByMentor.set(mentor.id, (endedByMentor.get(mentor.id) || 0) + 1);
        continue;
      }

      if (!countsByMentor.has(mentor.id)) countsByMentor.set(mentor.id, {});
      const mc = countsByMentor.get(mentor.id);
      if (!mc[pairKey]) mc[pairKey] = { bangkit: 0, maju: 0 };
      mc[pairKey][program]++;

      if (!pairStats.has(pairKey)) pairStats.set(pairKey, { mentors: new Set(), bangkit: 0, maju: 0 });
      const ps = pairStats.get(pairKey);
      ps.mentors.add(mentor.id);
      ps[program]++;
    }

    // 4–6. Per-mentor rows
    const mentorRows = [];
    const nonActiveWithMentees = [];
    for (const m of mentors || []) {
      const mc = countsByMentor.get(m.id) || {};
      const runningTotal = Object.values(mc).reduce((s, c) => s + c.bangkit + c.maju, 0);
      const nullCount = nullBatchByMentor.get(m.id) || 0;
      const endedCount = endedByMentor.get(m.id) || 0;
      const isActive = m.status === 'active';

      if (!isActive && (runningTotal > 0 || nullCount > 0 || endedCount > 0)) {
        nonActiveWithMentees.push({
          id: m.id,
          name: m.name,
          status: m.status,
          running_mentees: runningTotal,
          no_batch_mentees: nullCount,
          ended_batch_mentees: endedCount,
        });
      }
      if (!isActive && runningTotal === 0 && nullCount === 0) continue;

      const pairs = {};
      let overCapAny = false;
      for (const p of runningPairs) {
        const c = mc[p.key] || { bangkit: 0, maju: 0 };
        const total = c.bangkit + c.maju;
        const overCap = total > DEFAULT_CAP;
        if (overCap) overCapAny = true;
        pairs[p.label] = {
          bangkit: c.bangkit,
          maju: c.maju,
          total,
          over_cap: overCap,
          free_slots: Math.max(0, DEFAULT_CAP - total),
        };
      }

      mentorRows.push({
        id: m.id,
        name: m.name,
        email: m.email,
        status: m.status,
        state: m.state,
        is_khas: m.is_khas || false,
        pairs,
        total_running: runningTotal,
        no_batch_mentees: nullCount,
        over_cap: overCapAny,
      });
    }
    mentorRows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const pairsOut = [...pairByKey.values()]
      .sort((a, b) => b.key - a.key)
      .map((p) => {
        const ps = pairStats.get(p.key);
        return {
          label: p.label,
          bangkit_batch_id: p.bangkit_batch_id,
          maju_batch_id: p.maju_batch_id,
          last_end: p.last_end,
          is_running: p.is_running,
          mentor_count: ps ? ps.mentors.size : 0,
          mentee_count: ps ? ps.bangkit + ps.maju : 0,
          bangkit_mentees: ps ? ps.bangkit : 0,
          maju_mentees: ps ? ps.maju : 0,
        };
      });

    const endedList = [...endedByBatch.values()].sort((a, b) => (a.batch_name || '').localeCompare(b.batch_name || ''));

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      default_cap: DEFAULT_CAP,
      pairs: pairsOut,
      mentors: mentorRows,
      exceptions: {
        assignments_without_batch: assignmentsWithoutBatch,
        ended_but_active: {
          count: endedList.reduce((s, e) => s + e.count, 0),
          batches: endedList,
        },
        non_active_mentors_with_mentees: nonActiveWithMentees,
        assignments_unmapped_batch: assignmentsUnmappedBatch,
        excluded_test_entrepreneurs: excludedTest,
        orphan_assignments: orphanAssignments,
      },
    });
  } catch (error) {
    console.error('[kapasiti-mentor] ❌', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
