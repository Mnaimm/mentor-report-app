import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';

const ZONE_ORDER = ['Utara', 'Sentral', 'Selatan', 'Pantai Timur', 'Sabah', 'Sarawak', 'Tengah'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  try {
    const supabase = createAdminClient();

    const [
      { data: allAssignments, error: assignmentsError },
      { data: allReports, error: reportsError },
    ] = await Promise.all([
      supabase
        .from('mentor_assignments')
        .select('mentor_id, entrepreneur_id, entrepreneurs(zone, program), batches(program)')
        .eq('status', 'active')
        .eq('is_active', true),
      supabase.from('reports').select('mentor_id, entrepreneur_id, program'),
    ]);

    if (assignmentsError) throw assignmentsError;
    if (reportsError) throw reportsError;

    // Build per-zone maps
    const zoneData = {};
    const entZoneMap = {};

    for (const a of allAssignments || []) {
      const zone = a.entrepreneurs?.zone;
      if (!zone) continue;

      if (!zoneData[zone]) {
        zoneData[zone] = {
          zone,
          mentorIds: new Set(),
          menteeIds: new Set(),
          reportCount: 0,
          programMentees: {},
          programSessions: {},
        };
      }

      zoneData[zone].mentorIds.add(a.mentor_id);
      zoneData[zone].menteeIds.add(a.entrepreneur_id);
      entZoneMap[a.entrepreneur_id] = zone;

      const rawProgram = String(a.entrepreneurs?.program || a.batches?.program || '').toLowerCase();
      const program = rawProgram.includes('maju') ? 'Maju' : 'Bangkit';
      if (!zoneData[zone].programMentees[program]) zoneData[zone].programMentees[program] = new Set();
      zoneData[zone].programMentees[program].add(a.entrepreneur_id);
    }

    // Count sessions per zone via entrepreneur's zone
    for (const r of allReports || []) {
      const zone = entZoneMap[r.entrepreneur_id];
      if (!zone || !zoneData[zone]) continue;
      zoneData[zone].reportCount++;

      const rawProgram = String(r.program || '').toLowerCase();
      const program = rawProgram.includes('maju') ? 'Maju' : 'Bangkit';
      zoneData[zone].programSessions[program] = (zoneData[zone].programSessions[program] || 0) + 1;
    }

    const zones = Object.values(zoneData)
      .sort((a, b) => {
        const ai = ZONE_ORDER.indexOf(a.zone);
        const bi = ZONE_ORDER.indexOf(b.zone);
        if (ai === -1 && bi === -1) return a.zone.localeCompare(b.zone);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map(z => ({
        zone: z.zone,
        total_mentors: z.mentorIds.size,
        total_mentees: z.menteeIds.size,
        total_sessions: z.reportCount,
        by_program: Object.keys(z.programMentees).sort().map(p => ({
          program: p,
          mentees: z.programMentees[p].size,
          sessions: z.programSessions[p] || 0,
        })),
      }));

    // Grand totals — deduplicated across zones
    const allMentorIds = new Set((allAssignments || []).map(a => a.mentor_id));
    const allMenteeIds = new Set(Object.keys(entZoneMap));
    const totalSessions = zones.reduce((sum, z) => sum + z.total_sessions, 0);

    const summary = {
      total_mentors: allMentorIds.size,
      total_mentees: allMenteeIds.size,
      total_sessions: totalSessions,
    };

    return res.status(200).json({ success: true, data: { zones, summary } });
  } catch (error) {
    console.error('[zone-comparison] ❌', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
