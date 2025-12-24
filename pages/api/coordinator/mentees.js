// pages/api/coordinator/mentees.js
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
  const { status, batch, region } = req.query;

  try {
    // Get coordinator's program
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
        mentees: []
      });
    }

    // Get ALL mentors across ALL programs for assignment options
    // Program coordinators need visibility into all mentors for proper mentee assignments
    const { data: mentorProfiles } = await supabase
      .from('mentor_profiles')
      .select(`
        user_id,
        programs,
        users!mentor_profiles_user_id_fkey (
          name,
          email
        )
      `);
      // Show all mentors, not just coordinator's program

    const programMentors = mentorProfiles?.filter(p => 
      p.users?.name
    ) || [];

    // Get entrepreneurs and their assignments from Supabase
    let realMentees = [];
    
    try {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('mentor_assignments')
        .select(`
          id,
          entrepreneur_id,
          mentor_id,
          assigned_at,
          status,
          entrepreneurs (
            id,
            name,
            email,
            business_name,
            phone,
            state,
            program,
            cohort,
            status
          ),
          mentors:users!mentor_assignments_mentor_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('status', 'active');

      if (assignmentsError) {
        console.error('❌ Failed to fetch assignments from Supabase:', assignmentsError);
        throw assignmentsError;
      }

      console.log(`📊 Found ${assignments?.length || 0} active assignments in Supabase`);

      // Get session data from Supabase (includes Status field)
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('entrepreneur_id, "Status", session_date, created_at')
        .order('created_at', { ascending: false });

      // Process mentees from Supabase assignments
      realMentees = assignments?.map(assignment => {
        const entrepreneur = assignment.entrepreneurs;
        const mentor = assignment.mentors;
        
        if (!entrepreneur) return null;
        
        const menteeName = entrepreneur.name;
        const menteeEmail = entrepreneur.email?.toLowerCase() || '';
        const businessName = entrepreneur.business_name || 'Unknown Business';
        const batchName = entrepreneur.cohort || 'Unknown Batch';
        const region = entrepreneur.state || 'Unknown';
        const mentorEmail = mentor?.email?.toLowerCase() || '';
        
        // Get sessions for this mentee
        const menteeSessions = sessionsData?.filter(s => s.entrepreneur_id === entrepreneur.id) || [];
        
        // Count completed sessions (Status = 'Selesai' or 'completed')
        const completedSessions = menteeSessions.filter(s => 
          s.Status?.toLowerCase() === 'selesai' || s.Status?.toLowerCase() === 'completed'
        );
        const sessionsCompleted = completedSessions.length;
        
        // Check if any session has Status='MIA'
        const hasMIASession = menteeSessions.some(s => s.Status?.toUpperCase() === 'MIA');
        
        // Get last report date from completed sessions
        const lastReportDate = completedSessions.length > 0 
          ? completedSessions[0].created_at 
          : null;
        const daysSinceLastReport = lastReportDate 
          ? Math.floor((Date.now() - new Date(lastReportDate).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        
        // Simplified status rules:
        // MIA: Only if sessions table has Status='MIA'
        // Active: Has completed sessions and not MIA
        let status;
        if (!mentor || !mentorEmail) {
          status = 'Dropped';
        } else if (hasMIASession) {
          status = 'MIA';
        } else if (sessionsCompleted > 0) {
          status = 'Active';
        } else {
          status = 'Active'; // Default to Active if no sessions yet
        }
        
        const totalSessions = menteeSessions.length;
        const completionRate = totalSessions > 0 
          ? Math.round((sessionsCompleted / totalSessions) * 100)
          : 0;
        
        return {
          id: entrepreneur.id,
          name: menteeName,
          businessName: businessName,
          mentorId: mentor?.id,
          mentorName: mentor?.name || 'Unassigned',
          mentorEmail: mentorEmail,
          batch: batchName,
          region: region,
          status: status,
          sessionsCompleted: sessionsCompleted,
          totalSessions: totalSessions,
          progressPercentage: completionRate,
          lastReportDate: lastReportDate || 'Never',
          daysSinceLastReport: isNaN(daysSinceLastReport) ? 999 : daysSinceLastReport,
          phone: entrepreneur.phone || '',
          email: menteeEmail,
          currentRound: 1,
          overdueReports: 0
        };
      }).filter(m => m !== null) || [];

      console.log(`✅ Processed ${realMentees.length} mentees from Supabase`);
      
    } catch (error) {
      console.error('❌ Failed to fetch data:', error);
      realMentees = [];
    }

    // Apply filters
    let filteredMentees = realMentees;

    if (status) {
      filteredMentees = filteredMentees.filter(m => 
        m.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (batch) {
      filteredMentees = filteredMentees.filter(m => m.batch === batch);
    }

    if (region) {
      filteredMentees = filteredMentees.filter(m => m.region === region);
    }

    return res.status(200).json({
      program: 'All Programs', // Coordinator sees all programs
      mentees: filteredMentees,
      total: filteredMentees.length,
      summary: {
        active: filteredMentees.filter(m => m.status === 'Active').length,
        mia: filteredMentees.filter(m => m.status === 'MIA').length,
        completed: filteredMentees.filter(m => m.status === 'Completed').length,
        dropped: filteredMentees.filter(m => m.status === 'Dropped').length,
        unassigned: filteredMentees.filter(m => !m.mentorId).length,
        bangkit: filteredMentees.filter(m => m.batch?.includes('Bangkit')).length,
        maju: filteredMentees.filter(m => m.batch?.includes('Maju')).length,
        tubf: filteredMentees.filter(m => m.batch?.includes('TUBF')).length
      }
    });

  } catch (error) {
    console.error('Coordinator mentees error:', error);
    return res.status(500).json({ error: 'Failed to fetch mentee data' });
  }
}

// Helper function to generate mock mentees
function generateMockMentees(program, mentors) {
  const menteeCount = program === 'Bangkit' ? 45 : program === 'Maju' ? 67 : 12;
  const batches = [`${program} Batch 5`, `${program} Batch 4`];
  const regions = ['Selangor', 'Kuala Lumpur', 'Penang', 'Johor', 'Sabah'];
  const statuses = ['Active', 'Active', 'Active', 'MIA', 'Completed'];
  const businesses = [
    'Kafe Sedap', 'Tech Solutions', 'Fashion Boutique', 'Bakery Delight',
    'Mobile Repair Shop', 'Online Store', 'Food Truck', 'Salon Beauty',
    'Car Wash Service', 'Tutoring Center'
  ];

  const mockMentees = [];

  for (let i = 0; i < menteeCount; i++) {
    const mentor = mentors[i % mentors.length];
    const sessionsCompleted = Math.floor(Math.random() * 4) + 1;
    const totalSessions = 4;
    const lastReportDays = Math.floor(Math.random() * 14) + 1;
    const status = statuses[i % statuses.length];

    mockMentees.push({
      id: `MENTEE-${program}-${String(i + 1).padStart(3, '0')}`,
      name: `Mentee ${i + 1}`,
      businessName: businesses[i % businesses.length],
      mentorId: mentor?.user_id,
      mentorName: mentor?.users?.name || 'Unassigned',
      mentorEmail: mentor?.users?.email,
      batch: batches[i % batches.length],
      region: regions[i % regions.length],
      status: status,
      sessionsCompleted: sessionsCompleted,
      totalSessions: totalSessions,
      progressPercentage: Math.round((sessionsCompleted / totalSessions) * 100),
      lastReportDate: new Date(Date.now() - lastReportDays * 24 * 60 * 60 * 1000).toISOString(),
      daysSinceLastReport: lastReportDays,
      phone: `+60 12-${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}`,
      email: `mentee${i + 1}@example.com`
    });
  }

  return mockMentees;
}
