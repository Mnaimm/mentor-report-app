import { createClient } from '@supabase/supabase-js';
import { getSession } from 'next-auth/react';
import { canAccessAdmin } from '../../../../lib/auth';

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

  try {
    if (req.method === 'GET') {
      // Fetch all mentors with their active mentee count
      const { data: mentors, error } = await supabase
        .from('mentors')
        .select(`
          id,
          name,
          email,
          phone,
          ic_number,
          address,
          state,
          region,
          program,
          status,
          bank_account,
          emergency_contact,
          created_at
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      // For each mentor, count active mentees
      const mentorsWithCounts = await Promise.all(
        mentors.map(async (mentor) => {
          const { count, error: countError } = await supabase
            .from('mentor_assignments')
            .select('*', { count: 'exact', head: true })
            .eq('mentor_id', mentor.id)
            .eq('status', 'active')
            .eq('is_active', true);

          if (countError) {
            console.error(`Error counting mentees for ${mentor.email}:`, countError);
          }

          return {
            ...mentor,
            active_mentees: count || 0
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: mentorsWithCounts
      });

    } else if (req.method === 'POST') {
      // Add new mentor
      const {
        name,
        email,
        phone,
        ic_number,
        address,
        state,
        region,
        program,
        bank_account,
        emergency_contact
      } = req.body;

      // Validation
      if (!name || !email || !region || !program) {
        return res.status(400).json({
          error: 'Missing required fields: name, email, region, program'
        });
      }

      // Check if mentor already exists
      const { data: existing } = await supabase
        .from('mentors')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        return res.status(400).json({
          error: 'Mentor dengan email ini sudah wujud'
        });
      }

      // Insert mentor (Supabase client handles enum types automatically)
      const { data: newMentor, error: insertError } = await supabase
        .from('mentors')
        .insert([{
          name,
          email,
          phone: phone || null,
          ic_number: ic_number || null,
          address: address || null,
          state: state || null,
          region,
          program,
          status: 'active',
          bank_account: bank_account || null,
          emergency_contact: emergency_contact || null
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Also add mentor role to user_roles table
      try {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{
            email,
            role: 'mentor',
            assigned_by: session.user.email,
            assigned_at: new Date().toISOString()
          }]);

        if (roleError) {
          console.error('Warning: Failed to add mentor role:', roleError);
        }
      } catch (roleErr) {
        console.error('Warning: Failed to add mentor role:', roleErr);
      }

      return res.status(201).json({
        success: true,
        data: newMentor,
        message: 'Mentor berjaya ditambah'
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error in /api/admin/mentors:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
