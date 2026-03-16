import { createClient } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../../../../../lib/auth';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // 1. Auth check
  const session = await getSession({ req });
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Mentor ID is required' });
  }

  try {
    // 1. Check if mentor exists
    const { data: mentor, error: mentorError } = await supabase
      .from('mentors')
      .select('id, name, email, status')
      .eq('id', id)
      .single();

    if (mentorError || !mentor) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    if (mentor.status === 'inactive') {
      return res.status(400).json({ error: 'Mentor sudah ditamatkan' });
    }

    // 2. Check for active mentees (CRITICAL VALIDATION)
    const { count: activeMentees, error: countError } = await supabase
      .from('mentor_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('mentor_id', id)
      .eq('status', 'active')
      .eq('is_active', true);

    if (countError) throw countError;

    if (activeMentees > 0) {
      return res.status(400).json({
        error: `Tidak boleh menamatkan mentor dengan ${activeMentees} mentee aktif. Sila pindahkan mentee terlebih dahulu.`,
        active_mentees: activeMentees
      });
    }

    // 3. Update mentor status to inactive
    const { error: updateError } = await supabase
      .from('mentors')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 4. Remove mentor role from user_roles (but don't delete user record)
    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('email', mentor.email)
        .eq('role', 'mentor');

      if (roleError) {
        console.error('Warning: Failed to remove mentor role:', roleError);
      }
    } catch (roleErr) {
      console.error('Warning: Failed to remove mentor role:', roleErr);
    }

    // 5. Log activity
    try {
      await supabase
        .from('activity_logs')
        .insert([{
          action: 'mentor_retired',
          entity_type: 'mentor',
          entity_id: id,
          performed_by: session.user.email,
          details: {
            mentor_name: mentor.name,
            mentor_email: mentor.email,
            retired_by: session.user.email,
            retired_at: new Date().toISOString()
          }
        }]);
    } catch (logErr) {
      console.error('Warning: Failed to log activity:', logErr);
    }

    return res.status(200).json({
      success: true,
      message: `Mentor ${mentor.name} berjaya ditamatkan`,
      data: {
        id: mentor.id,
        name: mentor.name,
        email: mentor.email,
        status: 'inactive'
      }
    });

  } catch (error) {
    console.error(`Error retiring mentor ${id}:`, error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
