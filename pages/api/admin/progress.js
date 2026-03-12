import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabaseClient';

const normalizeProgram = (program) => (program ? String(program).toLowerCase() : 'all');

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

    const mentorById = new Map((mentors || []).map((m) => [m.id, m]));
    const mentorIdByEmail = new Map((mentors || []).map((m) => [String(m.email || '').toLowerCase(), m.id]));
    const entrepreneurById = new Map((entrepreneurs || []).map((e) => [e.id, e]));
    const entrepreneurIdByName = new Map(
      (entrepreneurs || []).map((e) => [String(e.name || '').toLowerCase(), e.id])
    );

    const roundsFiltered = (rounds || []).filter((r) => {
      const programOk = programFilter === 'all' || String(r.program || '').toLowerCase() === programFilter;
      const batchOk = batchFilter === 'all' || r.batch_name === batchFilter;
      const roundOk = !roundFilter || r.round_number === roundFilter;
      return programOk && batchOk && roundOk;
    });

    const expected = [];
    for (const a of assignments || []) {
      const roundsForBatch = roundsFiltered.filter((r) => r.batch_id === a.batch_id);
      for (const r of roundsForBatch) {
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

      const key = `${mentorId}|${entrepreneurId}|${program}|${roundNumber}`;
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
      const program = String(e.program || '').toLowerCase();
      const key = `${e.mentor_id}|${e.entrepreneur_id}|${program}|${e.round_number}`;
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
        mentor_name: mentorById.get(e.mentor_id)?.name || 'Unknown Mentor',
        mentor_email: mentorById.get(e.mentor_id)?.email || '',
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
        mentorEntry.rounds[e.round_number] = isPending ? 'pending' : 'submitted';
      } else {
        roundEntry.missing += 1;
        mentorEntry.missing += 1;
        mentorEntry.rounds[e.round_number] = 'missing';
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

    const mentorStats = Array.from(mentorStatsMap.values()).sort((a, b) => b.missing - a.missing);

    return res.status(200).json({
      success: true,
      roundStats,
      mentorStats,
      missingReports,
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
