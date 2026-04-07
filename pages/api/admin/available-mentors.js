import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const supabaseAdmin = createAdminClient();

  // 1. Auth
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  // 2. Method check
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Get excludeMentorId from query
  const { excludeMentorId } = req.query;

  if (!excludeMentorId || typeof excludeMentorId !== 'string' || !excludeMentorId.trim()) {
    return res.status(400).json({ error: 'excludeMentorId is required' });
  }

  try {
    // Fetch all active mentor assignments to count mentees per mentor
    const { data: assignments, error: fetchError } = await supabaseAdmin
      .from('mentor_assignments')
      .select(`
        mentor_id,
        mentors!inner (
          id,
          name,
          email,
          status
        )
      `)
      .eq('status', 'active')
      .eq('is_active', true)
      .eq('mentors.status', 'active')
      .neq('mentor_id', excludeMentorId);

    console.log('available-mentors assignments raw result:', {
      excludeMentorId,
      count: assignments?.length || 0,
      error: fetchError
    });

    if (fetchError) {
      console.error('❌ Error fetching mentor assignments:', fetchError);
      throw fetchError;
    }

    console.log('✅ Fetched mentor assignments:', assignments?.length || 0, 'assignments');

    // Group by mentor and count active mentees
    const mentorCounts = {};
    (assignments || []).forEach(assignment => {
      const mentor = assignment.mentors;
      if (!mentorCounts[mentor.id]) {
        mentorCounts[mentor.id] = {
          id: mentor.id,
          name: mentor.name,
          email: mentor.email,
          active_mentees: 0
        };
      }
      mentorCounts[mentor.id].active_mentees++;
    });

    // Also include mentors with 0 active mentees
    const { data: allActiveMentors, error: allError } = await supabaseAdmin
      .from('mentors')
      .select('id, name, email')
      .eq('status', 'active')
      .neq('id', excludeMentorId);

    console.log('available-mentors all active mentors raw result:', {
      excludeMentorId,
      count: allActiveMentors?.length || 0,
      error: allError
    });

    if (allError) {
      console.error('❌ Error fetching all mentors:', allError);
      throw allError;
    }

    console.log('✅ Fetched all active mentors:', allActiveMentors?.length || 0, 'mentors');

    (allActiveMentors || []).forEach(mentor => {
      if (!mentorCounts[mentor.id]) {
        mentorCounts[mentor.id] = {
          id: mentor.id,
          name: mentor.name,
          email: mentor.email,
          active_mentees: 0
        };
      }
    });

    const finalMentorList = Object.values(mentorCounts).sort((a, b) => a.name.localeCompare(b.name));
    console.log('✅ Available mentors for dropdown:', finalMentorList.length, 'mentors');

    return res.status(200).json({
      success: true,
      data: finalMentorList,
      count: finalMentorList.length
    });

  } catch (error) {
    console.error('❌ Error in available-mentors API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
