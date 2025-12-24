// pages/api/dashboard/program-breakdown.js
import { requireAuth, hasRole, hasAnyRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication - Only system_admin, coordinators, and stakeholders can view
  const authResult = await requireAnyRole(req, res, [
    'system_admin',
    'program_coordinator',
    'report_admin',
    'stakeholder'
  ]);

  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;

  try {
    let programs = [];

    // System Admin & Stakeholder - See all programs
    if (hasRole(user, 'system_admin') || hasRole(user, 'stakeholder') || hasRole(user, 'report_admin')) {
      programs = await getAllProgramsBreakdown();
    }
    // Program Coordinator - See only their program
    else if (hasRole(user, 'program_coordinator')) {
      // Get coordinator's program
      const { data: profile } = await supabase
        .from('mentor_profiles')
        .select('programs')
        .eq('user_id', user.id)
        .single();

      const coordinatorProgram = profile?.programs?.[0] || 'Bangkit';
      const programData = await getProgramBreakdown(coordinatorProgram);
      programs = [programData];
    }

    return res.status(200).json({
      programs,
      total: programs.length
    });

  } catch (error) {
    console.error('Program breakdown error:', error);
    return res.status(500).json({ error: 'Failed to fetch program breakdown' });
  }
}

// Get breakdown for all programs
async function getAllProgramsBreakdown() {
  const programNames = ['Bangkit', 'Maju', 'TUBF'];
  const results = [];

  for (const programName of programNames) {
    const data = await getProgramBreakdown(programName);
    results.push(data);
  }

  return results;
}

// Get breakdown for a specific program
async function getProgramBreakdown(programName) {
  // Get mentors in this program
  const { data: mentorProfiles, error: mentorError } = await supabase
    .from('mentor_profiles')
    .select(`
      id,
      user_id,
      programs,
      is_premier,
      users!mentor_profiles_user_id_fkey (
        id,
        name,
        email,
        status,
        roles
      )
    `)
    .contains('programs', [programName]);

  if (mentorError) {
    console.error('Error fetching mentors:', mentorError);
  }

  // Filter only active mentors
  const activeMentors = mentorProfiles?.filter(profile => 
    profile.users?.status === 'active' &&
    (profile.users?.roles?.includes('mentor') || profile.users?.roles?.includes('premier_mentor'))
  ) || [];

  const totalMentors = activeMentors.length;
  const premierMentors = activeMentors.filter(m => m.is_premier).length;

  // Placeholder data for reports and sessions
  // TODO: Integrate with actual reports data from Google Sheets or Supabase
  let totalReports = 0;
  let activeSessions = 0;
  let completionRate = 0;

  if (programName === 'Bangkit') {
    totalReports = 142;
    activeSessions = 24;
    completionRate = 87;
  } else if (programName === 'Maju') {
    totalReports = 156;
    activeSessions = 31;
    completionRate = 92;
  } else if (programName === 'TUBF') {
    totalReports = 18;
    activeSessions = 7;
    completionRate = 71;
  }

  return {
    program: programName,
    totalMentors,
    activeMentors: totalMentors,
    premierMentors,
    totalReports,
    activeSessions,
    completionRate,
    mentors: activeMentors.map(profile => ({
      id: profile.user_id,
      name: profile.users?.name,
      email: profile.users?.email,
      isPremier: profile.is_premier,
      status: profile.users?.status
    }))
  };
}
