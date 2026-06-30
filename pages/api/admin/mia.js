import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import supabaseAdmin from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Fetch ALL reports (all statuses) ordered so JS dedup picks the latest per entrepreneur.
    // We must NOT pre-filter by mia_status here — an entrepreneur who had session 2 (MIA)
    // then session 3 (Selesai) should be excluded because their latest session is Selesai.
    const { data: allReports, error: reportsError } = await supabaseAdmin
      .from('reports')
      .select('id, entrepreneur_id, program, session_number, session_date, submission_date, mia_status, mia_reason, nama_mentee, nama_mentor, mentor_email')
      .order('entrepreneur_id', { ascending: true })
      .order('session_number', { ascending: false })
      .order('submission_date', { ascending: false });

    if (reportsError) throw reportsError;

    // Keep the latest report per entrepreneur, then filter: only those whose latest is still MIA
    const seen = new Set();
    const latestMia = (allReports || []).filter(r => {
      if (seen.has(r.entrepreneur_id)) return false;
      seen.add(r.entrepreneur_id);
      return r.mia_status === 'MIA';
    });

    if (latestMia.length === 0) {
      return res.status(200).json({
        success: true,
        mentorGroups: [],
        unassigned: [],
        summary: { total: 0, urgent: 0, tanpaSebab: 0 },
      });
    }

    const entrepreneurIds = latestMia.map(r => r.entrepreneur_id);

    // Fetch active mentor assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('mentor_assignments')
      .select('entrepreneur_id, mentor_id')
      .in('entrepreneur_id', entrepreneurIds)
      .eq('status', 'active')
      .eq('is_active', true);

    if (assignmentsError) throw assignmentsError;

    // Fetch mentor details
    const mentorIds = [...new Set((assignments || []).map(a => a.mentor_id).filter(Boolean))];
    let mentorById = {};
    if (mentorIds.length > 0) {
      const { data: mentors, error: mentorsError } = await supabaseAdmin
        .from('mentors')
        .select('id, name, email')
        .in('id', mentorIds);
      if (mentorsError) throw mentorsError;
      (mentors || []).forEach(m => { mentorById[m.id] = m; });
    }

    // Fetch entrepreneur details
    const { data: entrepreneurs, error: entError } = await supabaseAdmin
      .from('entrepreneurs')
      .select('id, phone, business_name, batch, state')
      .in('id', entrepreneurIds);

    if (entError) throw entError;

    // Build lookup maps
    const assignmentByEntrepreneur = {};
    (assignments || []).forEach(a => {
      assignmentByEntrepreneur[a.entrepreneur_id] = a;
    });

    const entrepreneurById = {};
    (entrepreneurs || []).forEach(e => { entrepreneurById[e.id] = e; });

    // Enrich and calculate days_since in JS
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = latestMia.map(r => {
      const ent = entrepreneurById[r.entrepreneur_id] || {};
      const assignment = assignmentByEntrepreneur[r.entrepreneur_id];
      const mentor = assignment ? mentorById[assignment.mentor_id] : null;

      const refDate = r.session_date
        ? new Date(r.session_date)
        : new Date(r.submission_date);
      refDate.setHours(0, 0, 0, 0);
      const days_since = Math.max(0, Math.floor((today - refDate) / 86400000));

      return {
        report_id: r.id,
        entrepreneur_id: r.entrepreneur_id,
        nama_mentee: r.nama_mentee,
        program: r.program,
        session_number: r.session_number,
        session_date: r.session_date,
        submission_date: r.submission_date,
        mia_reason: r.mia_reason || null,
        days_since,
        business_name: ent.business_name || null,
        phone: ent.phone || null,
        batch: ent.batch || null,
        state: ent.state || null,
        active_mentor_id: mentor?.id || null,
        active_mentor_name: mentor?.name || null,
        active_mentor_email: mentor?.email || null,
      };
    });

    // Group by active mentor
    const mentorGroups = {};
    const unassigned = [];

    enriched.forEach(item => {
      if (item.active_mentor_id) {
        const key = item.active_mentor_id;
        if (!mentorGroups[key]) {
          mentorGroups[key] = {
            mentor_id: item.active_mentor_id,
            mentor_name: item.active_mentor_name,
            mentor_email: item.active_mentor_email,
            mentees: [],
            max_days_since: 0,
          };
        }
        mentorGroups[key].mentees.push(item);
        if (item.days_since > mentorGroups[key].max_days_since) {
          mentorGroups[key].max_days_since = item.days_since;
        }
      } else {
        unassigned.push(item);
      }
    });

    // Sort: within group by days_since desc, groups by max_days_since desc
    const groupsArray = Object.values(mentorGroups)
      .map(g => ({ ...g, mentees: g.mentees.sort((a, b) => b.days_since - a.days_since) }))
      .sort((a, b) => b.max_days_since - a.max_days_since);

    unassigned.sort((a, b) => b.days_since - a.days_since);

    const summary = {
      total: enriched.length,
      urgent: enriched.filter(i => i.days_since > 90).length,
      tanpaSebab: enriched.filter(i => !i.mia_reason).length,
    };

    return res.status(200).json({
      success: true,
      mentorGroups: groupsArray,
      unassigned,
      summary,
    });

  } catch (error) {
    console.error('❌ /api/admin/mia error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
