// pages/api/coordinator/assign-mentor.js
import { requireRole, logActivity } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only program_coordinator can access
  const authResult = await requireRole(req, res, 'program_coordinator');
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;
  const { menteeId, mentorId, reason, notes } = req.body;

  // Validation
  if (!menteeId || !mentorId) {
    return res.status(400).json({ 
      error: 'Missing required fields: menteeId and mentorId are required' 
    });
  }

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
      
      if (!createError && newProfile) {
        coordinatorProgram = newProfile.programs[0];
      }
    }
    
    if (!coordinatorProgram) {
      return res.status(400).json({ error: 'No program assigned to coordinator. Please contact admin.' });
    }

    // Get mentor details and validate they're in the same program
    const { data: mentorProfile, error: mentorError } = await supabase
      .from('mentor_profiles')
      .select(`
        id,
        user_id,
        programs,
        max_mentees,
        users!mentor_profiles_user_id_fkey (
          name,
          email,
          status
        )
      `)
      .eq('user_id', mentorId)
      .single();

    if (mentorError || !mentorProfile) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    // Check if mentor is in the coordinator's program
    if (!mentorProfile.programs?.includes(coordinatorProgram)) {
      return res.status(403).json({ 
        error: `Mentor is not in ${coordinatorProgram} program` 
      });
    }

    // Check mentor is active
    if (mentorProfile.users?.status !== 'active') {
      return res.status(400).json({ error: 'Mentor is not active' });
    }

    // Check mentor capacity from actual assignments
    const maxMentees = mentorProfile.max_mentees || 10;
    
    const { count: currentMenteesCount } = await supabase
      .from('mentor_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

    if (currentMenteesCount >= maxMentees) {
      return res.status(400).json({ 
        error: `Mentor is at maximum capacity (${maxMentees}/${maxMentees} mentees)`,
        mentorName: mentorProfile.users?.name,
        currentMentees: currentMenteesCount,
        maxMentees: maxMentees
      });
    }

    // Update or create assignment in Supabase
    // First check if entrepreneur already has an assignment
    const { data: existingAssignment } = await supabase
      .from('mentor_assignments')
      .select('id, mentor_id')
      .eq('entrepreneur_id', menteeId)
      .single();

    if (existingAssignment) {
      // Update existing assignment
      const { error: updateError } = await supabase
        .from('mentor_assignments')
        .update({
          mentor_id: mentorId,
          status: 'active',
          assigned_at: new Date().toISOString()
        })
        .eq('id', existingAssignment.id);

      if (updateError) {
        console.error('Failed to update assignment:', updateError);
        return res.status(500).json({ error: 'Failed to update assignment' });
      }
    } else {
      // Create new assignment
      const { error: insertError } = await supabase
        .from('mentor_assignments')
        .insert({
          entrepreneur_id: menteeId,
          mentor_id: mentorId,
          status: 'active',
          assigned_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to create assignment:', insertError);
        return res.status(500).json({ error: 'Failed to create assignment' });
      }
    }
    
    // Log the assignment activity
    await logActivity(
      user.id,
      'mentee_assigned',
      'mentor_assignments',
      menteeId,
      {
        menteeId,
        mentorId,
        mentorName: mentorProfile.users?.name,
        program: coordinatorProgram,
        reason: reason || 'Reassignment',
        notes: notes || '',
        assignedBy: user.name,
        availableSlots: maxMentees - currentMenteesCount - 1,
        previousMentor: existingAssignment?.mentor_id || 'none'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Mentee successfully assigned to mentor',
      assignment: {
        menteeId,
        mentorId,
        mentorName: mentorProfile.users?.name,
        mentorEmail: mentorProfile.users?.email,
        program: coordinatorProgram,
        assignedAt: new Date().toISOString(),
        assignedBy: user.name,
        mentorCapacity: {
          current: currentMenteesCount + 1,
          max: maxMentees,
          available: maxMentees - currentMenteesCount - 1
        }
      }
    });

  } catch (error) {
    console.error('Assign mentor error:', error);
    return res.status(500).json({ error: 'Failed to assign mentor' });
  }
}
