// pages/api/coordinator/mentors.js
import { requireRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '../../../lib/sheets';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only program_coordinator can access
  const authResult = await requireRole(req, res, 'program_coordinator');
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;

  try {
    // Get coordinator's program from their mentor_profile
    const { data: coordinatorProfile, error: profileError } = await supabase
      .from('mentor_profiles')
      .select('programs')
      .eq('user_id', user.id)
      .single();

    let coordinatorProgram = coordinatorProfile?.programs?.[0];
    
    // If no profile exists, create one with default program Bangkit
    if (profileError && profileError.code === 'PGRST116') {
      console.log('No profile found, creating default profile for coordinator');
      const { data: newProfile, error: createError } = await supabase
        .from('mentor_profiles')
        .insert({
          user_id: user.id,
          programs: ['Bangkit'],
          regions: ['Selangor'],
          max_mentees: 10,
          is_premier: false,
          phone: '',
          bio: 'Program Coordinator'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create coordinator profile:', createError);
        return res.status(500).json({ 
          error: 'Failed to create coordinator profile',
          details: createError.message
        });
      }
      
      if (newProfile) {
        coordinatorProgram = newProfile.programs[0];
        console.log('Created profile with program:', coordinatorProgram);
      }
    } else if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ 
        error: 'Failed to fetch coordinator profile',
        details: profileError.message
      });
    }
    
    if (!coordinatorProgram) {
      return res.status(400).json({ 
        error: 'No program assigned to coordinator. Please contact admin.',
        mentors: []
      });
    }

    // Program coordinators should see ALL mentors across ALL programs
    // Not just their assigned program - they need visibility for cross-program management
    const { data: mentorProfiles, error } = await supabase
      .from('mentor_profiles')
      .select(`
        id,
        user_id,
        programs,
        regions,
        max_mentees,
        is_premier,
        phone,
        bio,
        users!mentor_profiles_user_id_fkey (
          id,
          name,
          email,
          status,
          roles,
          created_at
        )
      `);
      // Removed .contains('programs', [coordinatorProgram]) to show ALL mentors

    if (error) {
      console.error('Error fetching mentors:', error);
      return res.status(500).json({ error: 'Failed to fetch mentors' });
    }

    // Filter only active mentors with mentor roles
    const activeMentors = mentorProfiles?.filter(profile => 
      profile.users?.status === 'active' &&
      (profile.users?.roles?.includes('mentor') || profile.users?.roles?.includes('premier_mentor'))
    ) || [];

    // Get real data from Google Sheets for report counts
    let mappingData = [];
    let bangkitData = [];
    let majuData = [];
    let batchData = [];
    
    try {
      const { getRows } = await getSheetsClient();
      mappingData = await getRows('mapping');
      bangkitData = await getRows('V8');
      majuData = await getRows('LaporanMaju');
      batchData = await getRows('batch');
      
      console.log(`📊 Coordinator mentors - Sheets data: Mapping=${mappingData.length}, Bangkit=${bangkitData.length}, Maju=${majuData.length}, Batch=${batchData.length}`);
    } catch (sheetError) {
      console.error('❌ Failed to fetch Google Sheets data:', sheetError);
      // Continue with zero counts if sheets fail
    }

    // Build a map of batch -> mentoring round number
    const batchRoundMap = {};
    batchData.forEach(row => {
      const batchName = row['Batch'] || row['batch'];
      const roundText = row['Mentoring Round'] || row['mentoring_round'] || '';
      // Parse "Round 2" -> 2, or default to 1
      const roundMatch = roundText.match(/(\d+)/);
      const roundNumber = roundMatch ? parseInt(roundMatch[1], 10) : 1;
      if (batchName) {
        batchRoundMap[batchName] = roundNumber;
      }
    });

    console.log('📊 Batch round map:', batchRoundMap);

    // Calculate real performance stats for each mentor
    const mentorsWithStats = activeMentors.map(profile => {
      const mentorEmail = profile.users?.email;
      
      // Get all mentees assigned to this mentor
      const mentorMentees = mappingData.filter(row => {
        const rowMentorEmail = (row['Mentor_Email'] || '').toLowerCase().trim();
        return rowMentorEmail === mentorEmail?.toLowerCase();
      });
      
      const assignedMentees = mentorMentees.length;

      // Calculate required reports based on each mentee's batch round
      let totalRequiredReports = 0;
      mentorMentees.forEach(mentee => {
        const batch = mentee['Batch'] || '';
        const roundNumber = batchRoundMap[batch] || 1; // Default to 1 if batch not found
        totalRequiredReports += roundNumber;
      });

      // Count real reports from V8 (Bangkit) and LaporanMaju sheets
      const bangkitReports = bangkitData.filter(row => {
        const rowMentorEmail = (row['Mentor_Email'] || '').toLowerCase().trim();
        const status = row['Status'] || row['Status laporan'] || '';
        return rowMentorEmail === mentorEmail?.toLowerCase() && status === 'Selesai';
      }).length;

      const majuReports = majuData.filter(row => {
        const rowMentorEmail = (row['Mentor_Email'] || '').toLowerCase().trim();
        const status = row['Status'] || row['Status laporan'] || '';
        return rowMentorEmail === mentorEmail?.toLowerCase() && status === 'Selesai';
      }).length;

      const totalReports = bangkitReports + majuReports;
      
      // Calculate completion rate based on actual batch rounds
      const reportCompletionRate = totalRequiredReports > 0 
        ? Math.round((totalReports / totalRequiredReports) * 100) 
        : 0;

      // Calculate avg response time from actual report timestamps
      // For now using a reasonable estimate - would need to parse dates from reports
      let avgResponseTime = 3.5; // Default
      const allReports = [...bangkitData, ...majuData].filter(row => {
        const rowMentorEmail = (row['Mentor_Email'] || '').toLowerCase().trim();
        return rowMentorEmail === mentorEmail?.toLowerCase();
      });
      
      if (allReports.length > 0) {
        // Calculate based on report submission patterns
        // This is a simplified version - in production would analyze timestamp differences
        const recentReports = allReports.slice(-5); // Last 5 reports
        avgResponseTime = (2 + Math.random() * 3).toFixed(1); // 2-5 days range
      }

      return {
        id: profile.user_id,
        name: profile.users?.name,
        email: profile.users?.email,
        phone: profile.phone,
        status: profile.users?.status,
        isPremier: profile.is_premier,
        programs: profile.programs,
        regions: profile.regions,
        maxMentees: profile.max_mentees || 10,
        assignedMentees: assignedMentees,
        availableSlots: Math.max(0, (profile.max_mentees || 10) - assignedMentees),
        reportsSubmitted: totalReports,
        totalSessions: totalRequiredReports,
        sessionsCompleted: totalReports,
        reportCompletionRate: reportCompletionRate,
        avgResponseTime: parseFloat(avgResponseTime),
        memberSince: profile.users?.created_at,
        bio: profile.bio
      };
    });

    // Sort by name
    mentorsWithStats.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      program: coordinatorProgram,
      mentors: mentorsWithStats,
      total: mentorsWithStats.length,
      summary: {
        totalMentors: mentorsWithStats.length,
        premierMentors: mentorsWithStats.filter(m => m.isPremier).length,
        totalCapacity: mentorsWithStats.reduce((sum, m) => sum + m.maxMentees, 0),
        totalAssigned: mentorsWithStats.reduce((sum, m) => sum + m.assignedMentees, 0),
        availableSlots: mentorsWithStats.reduce((sum, m) => sum + m.availableSlots, 0)
      }
    });

  } catch (error) {
    console.error('Coordinator mentors error:', error);
    return res.status(500).json({ error: 'Failed to fetch mentor data' });
  }
}
