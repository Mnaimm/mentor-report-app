// pages/api/mentor/pending-summary.js
// Returns the total count of pending reports across all active rounds where today
// is past the round midpoint. Used to drive the overdue floating banner.

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';

const MALAY_MONTHS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

function formatMalayDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();
  const realUserEmail = session.user.email.toLowerCase().trim();

  // Impersonation: query param takes priority, validated by system_admin DB check.
  let mentorEmail = realUserEmail;
  const impersonateParam = req.query.impersonate?.toLowerCase().trim();
  if (impersonateParam && impersonateParam !== realUserEmail) {
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('email', realUserEmail)
      .eq('role', 'system_admin')
      .maybeSingle();
    if (adminRole) {
      mentorEmail = impersonateParam;
    }
    // silently ignore impersonate param if not system_admin
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Resolve mentor by email
  const { data: mentor, error: mentorError } = await supabase
    .from('mentors')
    .select('id')
    .ilike('email', mentorEmail)
    .maybeSingle();

  if (mentorError) {
    console.error('[pending-summary] mentor lookup error:', mentorError.message);
    return res.status(500).json({ error: 'DB error' });
  }
  if (!mentor) return res.json({ hasPending: false, count: 0 });

  // 2. Active assignments (both conditions per CLAUDE.md)
  const { data: assignments, error: assignError } = await supabase
    .from('mentor_assignments')
    .select('entrepreneur_id, batch_id')
    .eq('mentor_id', mentor.id)
    .eq('status', 'active')
    .eq('is_active', true);

  if (assignError) {
    console.error('[pending-summary] assignments error:', assignError.message);
    return res.status(500).json({ error: 'DB error' });
  }
  if (!assignments || assignments.length === 0) return res.json({ hasPending: false, count: 0 });

  const entrepreneurIds = [...new Set(assignments.map(a => a.entrepreneur_id).filter(Boolean))];
  const batchIds        = [...new Set(assignments.map(a => a.batch_id).filter(Boolean))];

  if (entrepreneurIds.length === 0) return res.json({ hasPending: false, count: 0 });

  // 3. Parallel fetch: batches, batch_rounds, reports
  // Include mia_status in reports so we can match mentor-stats logic exactly:
  // a report with mia_status='MIA' is NOT counted as "submitted" (same as mentor-stats).
  const [batchesRes, batchRoundsRes, reportsRes] = await Promise.all([
    batchIds.length > 0
      ? supabase.from('batches').select('id, batch_name, program').in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),

    // All non-null batch_name rows — newer batches have batch_id=null, match by name
    supabase
      .from('batch_rounds')
      .select('id, batch_id, batch_name, round_number, start_date, end_date, start_month, end_month')
      .not('batch_name', 'is', null),

    supabase
      .from('reports')
      .select('entrepreneur_id, session_number, mia_status')
      .in('entrepreneur_id', entrepreneurIds),
  ]);

  if (batchRoundsRes.error) {
    console.error('[pending-summary] batch_rounds error:', batchRoundsRes.error.message);
    return res.status(500).json({ error: 'DB error' });
  }

  const batches     = batchesRes.data     || [];
  const batchRounds = batchRoundsRes.data || [];
  const reports     = reportsRes.data     || [];

  // Build lookup maps
  const batchIdToName    = {};
  const batchIdToProgram = {};
  batches.forEach(b => {
    if (b.id) {
      batchIdToName[b.id]    = b.batch_name;
      batchIdToProgram[b.id] = b.program;
    }
  });

  // "Submitted" means a non-MIA report exists for that entrepreneur+session_number.
  // Mirrors mentor-stats logic: MIA reports do NOT count as "reported".
  const submitted = new Set();
  reports.forEach(r => {
    const isMia = r.mia_status?.trim() === 'MIA';
    if (!isMia && r.entrepreneur_id && r.session_number != null) {
      submitted.add(`${r.entrepreneur_id}:${r.session_number}`);
    }
  });

  // 4. For each batch, find the active round, check midpoint, count pending
  const urgentRounds = [];

  for (const batchId of batchIds) {
    const batchName    = batchIdToName[batchId];
    const batchProgram = batchIdToProgram[batchId];

    // Match by batch_id OR batch_name (newer rows have batch_id=null)
    const rounds = batchRounds.filter(br =>
      br.batch_id === batchId ||
      (batchName && br.batch_name === batchName)
    );

    // Active round: today between start_date and end_date (prefer over start/end_month)
    const activeRound = rounds.find(br => {
      const start = new Date(br.start_date || br.start_month); start.setHours(0, 0, 0, 0);
      const end   = new Date(br.end_date   || br.end_month);   end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });

    if (!activeRound) continue;

    const startMs    = new Date(activeRound.start_date || activeRound.start_month).getTime();
    const endMs      = new Date(activeRound.end_date   || activeRound.end_month).getTime();
    const midpointMs = startMs + (endMs - startMs) / 2;

    // Only show banner when today is past the midpoint of this round
    if (today.getTime() <= midpointMs) continue;

    const entsInBatch = assignments
      .filter(a => a.batch_id === batchId && a.entrepreneur_id)
      .map(a => a.entrepreneur_id);

    const pendingCount = entsInBatch.filter(eid =>
      !submitted.has(`${eid}:${activeRound.round_number}`)
    ).length;

    if (pendingCount === 0) continue;

    urgentRounds.push({
      endDate:      activeRound.end_date || activeRound.end_month,
      program:      batchProgram || '',
      pendingCount,
    });
  }

  if (urgentRounds.length === 0) return res.json({ hasPending: false, count: 0 });

  // Sort by end_date ascending so most urgent is first (used for endDate and laporanUrl)
  urgentRounds.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));
  const mostUrgent = urgentRounds[0];

  // Total count across ALL urgent batches (matches mentor-stats pendingThisRound which is also a total)
  const totalPending = urgentRounds.reduce((sum, r) => sum + r.pendingCount, 0);

  const programLower = mostUrgent.program.toLowerCase();
  const laporanUrl   = programLower.includes('maju') ? '/laporan-maju-um' : '/laporan-bangkit';

  return res.json({
    hasPending: true,
    count:      totalPending,
    endDate:    formatMalayDate(mostUrgent.endDate),
    laporanUrl,
  });
}
