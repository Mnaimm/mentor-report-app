import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseClient';

const normalizeProgram = (program) => (program ? String(program).toLowerCase() : 'all');

// Whitelist of active batches to display
const ACTIVE_BATCHES = [
  'Batch 4 MAJU',
  'Batch 5 Bangkit',
  'Batch 5 MAJU',
  'Batch 6 Bangkit',
  'Batch 6 MAJU',
  'Batch 7 Bangkit',
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hasAccess = await canAccessAdmin(session.user.email);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied - Admin role required' });
    }

    const programFilter = normalizeProgram(req.query.program);
    const batchFilter = req.query.batch ? String(req.query.batch) : 'all';
    const roundFilter = req.query.round ? parseInt(req.query.round, 10) : null;

    const [
      { data: assignments, error: assignmentsError },
      { data: rounds, error: roundsError },
      { data: reports, error: reportsError },
      { data: mentors, error: mentorsError },
      { data: entrepreneurs, error: entrepreneursError },
    ] = await Promise.all([
      supabaseAdmin
        .from('mentor_assignments')
        .select('mentor_id, entrepreneur_id, batch_id, status')
        .eq('status', 'active'),
      supabaseAdmin
        .from('batch_rounds')
        .select('batch_id, batch_name, program, round_number, end_month'),
      supabaseAdmin
        .from('reports')
        .select('id, mentor_id, entrepreneur_id, mentor_email, nama_usahawan, nama_mentee, program, session_number, status, payment_status, submission_date'),
      supabaseAdmin
        .from('mentors')
        .select('id, name, email'),
      supabaseAdmin
        .from('entrepreneurs')
        .select('id, name'),
    ]);

    if (assignmentsError) throw assignmentsError;
    if (roundsError) throw roundsError;
    if (reportsError) throw reportsError;
    if (mentorsError) throw mentorsError;
    if (entrepreneursError) throw entrepreneursError;

    // Filter to only valid and active batches
    // 1. Exclude batch_rounds where batch_id is null (orphaned rows like Batch 2 Bangkit)
    // 2. Apply active batch whitelist
    const roundsActive = (rounds || []).filter(r =>
      r.batch_id !== null &&
      ACTIVE_BATCHES.some(name =>
        r.batch_name?.toLowerCase() === name.toLowerCase()
      )
    );

    const mentorById = new Map((mentors || []).map((m) => [m.id, m]));
    const mentorIdByEmail = new Map((mentors || []).map((m) => [String(m.email || '').toLowerCase(), m.id]));
    const entrepreneurById = new Map((entrepreneurs || []).map((e) => [e.id, e]));
    const entrepreneurIdByName = new Map(
      (entrepreneurs || []).map((e) => [String(e.name || '').toLowerCase(), e.id])
    );

    // Identify orphaned mentor_ids in assignments (for debugging)
    const orphanedMentorIds = (assignments || [])
      .filter(a => !mentorById.has(a.mentor_id))
      .map(a => a.mentor_id);
    if (orphanedMentorIds.length > 0) {
      console.log('⚠️ Orphaned mentor_ids in assignments:', [...new Set(orphanedMentorIds)]);
    }

    const today = new Date();

    // Filter to active batches if 'all' is selected
    // A batch is "active" if it has at least one round where end_month <= today (i.e. at least one due round exists)
    let activeBatchNames = null;
    if (batchFilter === 'all') {
      activeBatchNames = new Set(
        (roundsActive || [])
          .filter(r => r.end_month && new Date(r.end_month) <= today)
          .map(r => r.batch_name)
      );
    }

    const roundsFiltered = (roundsActive || []).filter((r) => {
      const programOk = programFilter === 'all' || String(r.program || '').toLowerCase() === programFilter;

      // If batchFilter is 'all', show all batches that have at least one due round
      let batchOk = true;
      if (batchFilter === 'all' && activeBatchNames) {
        batchOk = activeBatchNames.has(r.batch_name);
      } else if (batchFilter !== 'all') {
        batchOk = r.batch_name === batchFilter;
      }

      const roundOk = !roundFilter || r.round_number === roundFilter;
      return programOk && batchOk && roundOk;
    });

    const expected = [];
    const futureRounds = new Map(); // Track future rounds for each mentor
    for (const a of assignments || []) {
      const roundsForBatch = roundsFiltered.filter((r) => r.batch_id === a.batch_id);
      for (const r of roundsForBatch) {
        // Fix 1: Skip future rounds (not yet due) from expected reports
        if (r.end_month && new Date(r.end_month) > today) {
          // Track future rounds for UI display
          if (!futureRounds.has(a.mentor_id)) {
            futureRounds.set(a.mentor_id, new Set());
          }
          futureRounds.get(a.mentor_id).add(r.round_number);
          continue;
        }

        expected.push({
          mentor_id: a.mentor_id,
          entrepreneur_id: a.entrepreneur_id,
          batch_id: a.batch_id,
          batch_name: r.batch_name,
          program: r.program,
          round_number: r.round_number,
          due_date: r.end_month || null,
        });
      }
    }

    const submissionMap = new Map();
    for (const report of reports || []) {
      const program = String(report.program || '').toLowerCase();
      if (programFilter !== 'all' && program !== programFilter) continue;

      let mentorId = report.mentor_id || null;
      if (!mentorId && report.mentor_email) {
        mentorId = mentorIdByEmail.get(String(report.mentor_email).toLowerCase()) || null;
      }

      let entrepreneurId = report.entrepreneur_id || null;
      if (!entrepreneurId) {
        const name = (report.nama_usahawan || report.nama_mentee || '').toLowerCase();
        if (name) entrepreneurId = entrepreneurIdByName.get(name) || null;
      }

      const roundNumber = report.session_number ? parseInt(report.session_number, 10) : null;
      if (!mentorId || !entrepreneurId || !roundNumber) continue;

      const key = `${mentorId}|${entrepreneurId}|${roundNumber}`;
      submissionMap.set(key, {
        id: report.id,
        status: report.status,
        payment_status: report.payment_status,
        submission_date: report.submission_date,
      });
    }

    const roundStatsMap = new Map();
    const mentorStatsMap = new Map();
    const missingReports = [];

    for (const e of expected) {
      // Skip if mentor not found in mentors table (orphaned assignment)
      const mentor = mentorById.get(e.mentor_id);
      if (!mentor) continue;

      // Skip test entrepreneurs (names starting with "TEST")
      const entrepreneur = entrepreneurById.get(e.entrepreneur_id);
      if (entrepreneur?.name?.startsWith('TEST')) continue;

      const key = `${e.mentor_id}|${e.entrepreneur_id}|${e.round_number}`;
      const submission = submissionMap.get(key) || null;

      const roundKey = `${e.batch_name}|${e.program}|${e.round_number}`;
      const roundEntry = roundStatsMap.get(roundKey) || {
        batch: e.batch_name,
        program: e.program,
        round: e.round_number,
        expected: 0,
        submitted: 0,
        missing: 0,
      };
      roundEntry.expected += 1;

      const mentorEntry = mentorStatsMap.get(e.mentor_id) || {
        mentor_id: e.mentor_id,
        mentor_name: mentor.name || 'Unknown Mentor',
        mentor_email: mentor.email || '',
        batch_name: e.batch_name,
        rounds: {},
        assigned: 0,
        submitted: 0,
        missing: 0,
      };
      mentorEntry.assigned += 1;

      if (submission) {
        roundEntry.submitted += 1;
        mentorEntry.submitted += 1;
        const isPending = submission.payment_status === 'pending';
        // Only set if not already set (don't overwrite submitted with anything)
        if (!mentorEntry.rounds[e.round_number]) {
          mentorEntry.rounds[e.round_number] = isPending ? 'pending' : 'submitted';
        }
      } else {
        roundEntry.missing += 1;
        mentorEntry.missing += 1;
        // Only set to missing if not already submitted/pending
        if (!mentorEntry.rounds[e.round_number]) {
          mentorEntry.rounds[e.round_number] = 'missing';
        }
        missingReports.push({
          mentor_id: e.mentor_id,
          mentor_name: mentorEntry.mentor_name,
          mentor_email: mentorEntry.mentor_email,
          entrepreneur_id: e.entrepreneur_id,
          entrepreneur_name: entrepreneurById.get(e.entrepreneur_id)?.name || 'Unknown Entrepreneur',
          round: e.round_number,
          batch: e.batch_name,
          program: e.program,
          due_date: e.due_date,
        });
      }

      roundStatsMap.set(roundKey, roundEntry);
      mentorStatsMap.set(e.mentor_id, mentorEntry);
    }

    const roundStats = Array.from(roundStatsMap.values()).sort((a, b) => {
      if (a.batch !== b.batch) return (a.batch ?? '').localeCompare(b.batch ?? '');
      if (a.program !== b.program) return (a.program ?? '').localeCompare(b.program ?? '');
      return a.round - b.round;
    });

    // Mark future rounds as 'not_due' for each mentor
    for (const [mentorId, futureRoundSet] of futureRounds.entries()) {
      const mentorEntry = mentorStatsMap.get(mentorId);
      if (mentorEntry) {
        for (const roundNum of futureRoundSet) {
          if (!mentorEntry.rounds[roundNum]) {
            mentorEntry.rounds[roundNum] = 'not_due';
          }
        }
      }
    }

    const mentorStats = Array.from(mentorStatsMap.values()).sort((a, b) => b.missing - a.missing);

    // Group data by batch for UI display
    const batchesInStats = [...new Set(roundStats.map(r => r.batch))];

    const batchGroups = {};
    let activeBatchName = null;
    let latestEndMonth = new Date(0);

    for (const batchName of batchesInStats) {
      // Get round stats for this batch
      const batchRoundStats = roundStats.filter(r => r.batch === batchName);

      // Get mentor stats for this batch (mentors who have assignments in this batch)
      const batchMentorStats = mentorStats.filter(m => m.batch_name === batchName);

      // Get missing reports for this batch
      const batchMissingReports = missingReports.filter(mr => mr.batch === batchName);

      // Calculate batch totals
      const expected = batchRoundStats.reduce((sum, r) => sum + r.expected, 0);
      const submitted = batchRoundStats.reduce((sum, r) => sum + r.submitted, 0);
      const missing = batchRoundStats.reduce((sum, r) => sum + r.missing, 0);

      // Find the latest end_month for this batch to determine if it's active
      const batchRounds = roundsFiltered.filter(r => r.batch_name === batchName);
      const batchLatestEndMonth = batchRounds.reduce((latest, r) => {
        if (!r.end_month) return latest;
        const endDate = new Date(r.end_month);
        return endDate > latest ? endDate : latest;
      }, new Date(0));

      // Track the overall latest batch
      if (batchLatestEndMonth > latestEndMonth) {
        latestEndMonth = batchLatestEndMonth;
        activeBatchName = batchName;
      }

      batchGroups[batchName] = {
        batchName,
        roundStats: batchRoundStats,
        mentorStats: batchMentorStats,
        missingReports: batchMissingReports,
        totals: { expected, submitted, missing },
        isActive: batchLatestEndMonth >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Active if within last 90 days
      };
    }

    // Calculate overall totals across all batches
    const expectedTotal = roundStats.reduce((sum, r) => sum + r.expected, 0);
    const submittedTotal = roundStats.reduce((sum, r) => sum + r.submitted, 0);
    const missingTotal = roundStats.reduce((sum, r) => sum + r.missing, 0);

    return res.status(200).json({
      success: true,
      batchGroups,
      totals: {
        expected: expectedTotal,
        submitted: submittedTotal,
        missing: missingTotal,
      },
      activeBatch: activeBatchName,
      filters: {
        program: programFilter,
        batch: batchFilter,
        round: roundFilter,
      },
    });
  } catch (err) {
    console.error('Error in /api/admin/progress:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
