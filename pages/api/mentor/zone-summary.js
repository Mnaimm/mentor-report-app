import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { createAdminClient } from '../../../lib/supabaseAdmin';
import { getEffectiveUserEmail } from '../../../lib/impersonation';

const ADMIN_ROLES = ['system_admin', 'program_coordinator', 'report_admin', 'payment_admin', 'payment_approver', 'stakeholder'];
const MENTOR_ROLES = ['mentor', 'premier_mentor'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const supabase = createAdminClient();

    // Honour impersonation header if set by super admin
    const effectiveEmail = getEffectiveUserEmail(req, session);

    // Resolve mentor record for the effective user
    const { data: mentorRecord, error: mentorError } = await supabase
      .from('mentors')
      .select('id, name')
      .ilike('email', effectiveEmail)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (!mentorRecord) {
      // Check if the effective user is admin-only (no mentor role)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .ilike('email', effectiveEmail);

      const userRoles = (roles || []).map(r => r.role);
      const hasMentorRole = userRoles.some(r => MENTOR_ROLES.includes(r));
      const hasAdminRole = userRoles.some(r => ADMIN_ROLES.includes(r));

      if (hasAdminRole && !hasMentorRole) {
        return res.status(200).json({ success: true, data: { is_admin_only: true } });
      }

      return res.status(200).json({
        success: true,
        data: { zone: null, summary: null, by_program: [], by_batch: [] },
      });
    }

    // Derive this mentor's primary zone from their active mentees
    const { data: myAssignments, error: myAssignmentsError } = await supabase
      .from('mentor_assignments')
      .select('entrepreneurs(zone)')
      .eq('mentor_id', mentorRecord.id)
      .eq('status', 'active')
      .eq('is_active', true);

    if (myAssignmentsError) throw myAssignmentsError;

    const myZoneCounts = {};
    for (const a of myAssignments || []) {
      const z = a.entrepreneurs?.zone;
      if (z) myZoneCounts[z] = (myZoneCounts[z] || 0) + 1;
    }

    const primaryZone = Object.entries(myZoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!primaryZone) {
      return res.status(200).json({
        success: true,
        data: { zone: null, summary: null, by_program: [], by_batch: [] },
      });
    }

    // Get all active assignments and reports — filter to zone in JS
    const [
      { data: allAssignments, error: allAssignmentsError },
      { data: allReports, error: allReportsError },
    ] = await Promise.all([
      supabase
        .from('mentor_assignments')
        .select('mentor_id, entrepreneur_id, entrepreneurs(zone, program, batch), batches(batch_name, program)')
        .eq('status', 'active')
        .eq('is_active', true),
      supabase.from('reports').select('mentor_id, entrepreneur_id, program'),
    ]);

    if (allAssignmentsError) throw allAssignmentsError;
    if (allReportsError) throw allReportsError;

    // Assignments in this zone
    const zoneAssignments = (allAssignments || []).filter(a => a.entrepreneurs?.zone === primaryZone);
    const zoneMentorIds = new Set(zoneAssignments.map(a => a.mentor_id));
    const zoneMenteeIds = new Set(zoneAssignments.map(a => a.entrepreneur_id));

    // Reports for mentors in this zone
    const zoneReports = (allReports || []).filter(r => zoneMentorIds.has(r.mentor_id));

    const summary = {
      total_mentors: zoneMentorIds.size,
      total_mentees: zoneMenteeIds.size,
      total_sessions: zoneReports.length,
    };

    // Breakdown by program
    const programMentees = {};
    const programSessions = {};
    for (const a of zoneAssignments) {
      const rawProgram = String(a.entrepreneurs?.program || a.batches?.program || '').toLowerCase();
      const program = rawProgram.includes('maju') ? 'Maju' : 'Bangkit';
      if (!programMentees[program]) programMentees[program] = new Set();
      programMentees[program].add(a.entrepreneur_id);
    }
    for (const r of zoneReports) {
      const rawProgram = String(r.program || '').toLowerCase();
      const program = rawProgram.includes('maju') ? 'Maju' : 'Bangkit';
      programSessions[program] = (programSessions[program] || 0) + 1;
    }
    const by_program = Object.keys(programMentees).sort().map(p => ({
      program: p,
      mentees: programMentees[p].size,
      sessions: programSessions[p] || 0,
    }));

    // Breakdown by batch — use entrepreneurs.batch as fallback when batch_id is NULL
    const batchMentees = {};
    const entBatchMap = {};
    for (const a of zoneAssignments) {
      const batchName = a.batches?.batch_name || a.entrepreneurs?.batch;
      if (!batchName) continue;
      if (!batchMentees[batchName]) batchMentees[batchName] = new Set();
      batchMentees[batchName].add(a.entrepreneur_id);
      entBatchMap[a.entrepreneur_id] = batchName;
    }
    const batchSessionsFinal = {};
    for (const r of zoneReports) {
      const batchName = entBatchMap[r.entrepreneur_id];
      if (batchName) batchSessionsFinal[batchName] = (batchSessionsFinal[batchName] || 0) + 1;
    }
    const by_batch = Object.keys(batchMentees).sort().map(b => ({
      batch_name: b,
      mentees: batchMentees[b].size,
      sessions: batchSessionsFinal[b] || 0,
    }));

    return res.status(200).json({
      success: true,
      data: { zone: primaryZone, summary, by_program, by_batch },
    });
  } catch (error) {
    console.error('[zone-summary] ❌', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
