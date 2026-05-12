import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  try {
    const supabase = createAdminClient();

    const [
      { data: mentors, error: mentorsError },
      { data: assignments, error: assignmentsError },
      { data: reportRows, error: reportsError },
    ] = await Promise.all([
      supabase.from('mentors').select('id, name, email, phone').eq('status', 'active').order('name'),
      supabase
        .from('mentor_assignments')
        .select('mentor_id, entrepreneur_id, entrepreneurs(zone, program)')
        .eq('status', 'active')
        .eq('is_active', true),
      supabase.from('reports').select('mentor_id'),
    ]);

    if (mentorsError) throw mentorsError;
    if (assignmentsError) throw assignmentsError;
    if (reportsError) throw reportsError;

    // Session count per mentor
    const sessionCountMap = {};
    for (const r of reportRows || []) {
      if (r.mentor_id) sessionCountMap[r.mentor_id] = (sessionCountMap[r.mentor_id] || 0) + 1;
    }

    // Build per-mentor stats
    const mentorMap = {};
    for (const m of mentors || []) {
      mentorMap[m.id] = {
        id: m.id, name: m.name, email: m.email, phone: m.phone,
        zoneCounts: {},
        programSet: new Set(),
        total_mentees: 0,
      };
    }

    for (const a of assignments || []) {
      const mentor = mentorMap[a.mentor_id];
      if (!mentor) continue;
      const zone = a.entrepreneurs?.zone;
      const rawProgram = String(a.entrepreneurs?.program || '').toLowerCase();
      if (zone) {
        mentor.zoneCounts[zone] = (mentor.zoneCounts[zone] || 0) + 1;
        mentor.total_mentees++;
      }
      if (rawProgram.includes('maju')) mentor.programSet.add('Maju');
      else if (rawProgram.includes('bangkit')) mentor.programSet.add('Bangkit');
    }

    // Group by primary zone (zone with most mentees)
    const ZONE_ORDER = ['Utara', 'Sentral', 'Selatan', 'Pantai Timur', 'Sabah', 'Sarawak', 'Tengah'];
    const zoneGroups = {};
    let totalMentees = 0;
    let totalSessions = 0;

    for (const mentor of Object.values(mentorMap)) {
      const sessions = sessionCountMap[mentor.id] || 0;
      totalSessions += sessions;
      totalMentees += mentor.total_mentees;

      const zoneEntries = Object.entries(mentor.zoneCounts);
      const primaryZone = zoneEntries.length > 0
        ? zoneEntries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
        : 'Tidak Dikategorikan';

      if (!zoneGroups[primaryZone]) zoneGroups[primaryZone] = [];
      zoneGroups[primaryZone].push({
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
        phone: mentor.phone,
        programs: [...mentor.programSet].sort(),
        total_mentees: mentor.total_mentees,
        total_sessions: sessions,
      });
    }

    const zones = Object.entries(zoneGroups)
      .sort(([a], [b]) => {
        const ai = ZONE_ORDER.indexOf(a);
        const bi = ZONE_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map(([zone, zoneMentors]) => ({
        zone,
        mentors: zoneMentors.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return res.status(200).json({
      success: true,
      data: {
        zones,
        summary: {
          total_mentors: (mentors || []).length,
          total_mentees: totalMentees,
          total_sessions: totalSessions,
        },
      },
    });
  } catch (error) {
    console.error('[mentors/directory] ❌', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
