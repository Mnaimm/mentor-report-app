import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../lib/auth';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  // 1. Auth check
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Mentor ID is required' });
  }

  try {
    if (req.method === 'PUT') {
      // Update mentor details
      const {
        name,
        email,
        phone,
        ic_number,
        address,
        state,
        bank_account,
        emergency_contact
      } = req.body;

      // Validation
      if (!name || !email) {
        return res.status(400).json({
          error: 'Missing required fields: name, email'
        });
      }

      // Check if email is being changed and already exists
      const { data: currentMentor } = await supabaseAdmin
        .from('mentors')
        .select('email')
        .eq('id', id)
        .single();

      if (!currentMentor) {
        return res.status(404).json({ error: 'Mentor not found' });
      }

      if (email !== currentMentor.email) {
        const { data: existing } = await supabaseAdmin
          .from('mentors')
          .select('id')
          .eq('email', email)
          .neq('id', id)
          .single();

        if (existing) {
          return res.status(400).json({
            error: 'Email sudah digunakan oleh mentor lain'
          });
        }
      }

      // Update mentor (region and program are NOT updated - derived from assignments)
      const { data: updatedMentor, error: updateError } = await supabaseAdmin
        .from('mentors')
        .update({
          name,
          email,
          phone: phone || null,
          ic_number: ic_number || null,
          address: address || null,
          state: state || null,
          bank_account: bank_account || null,
          emergency_contact: emergency_contact || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // If email changed, update user_roles too
      if (email !== currentMentor.email) {
        try {
          await supabaseAdmin
            .from('user_roles')
            .update({ email })
            .eq('email', currentMentor.email)
            .eq('role', 'mentor');
        } catch (roleErr) {
          console.error('Warning: Failed to update email in user_roles:', roleErr);
        }
      }

      return res.status(200).json({
        success: true,
        data: updatedMentor,
        message: 'Maklumat mentor berjaya dikemaskini'
      });

    } else if (req.method === 'GET') {
      // Get single mentor details
      const { data: mentor, error } = await supabaseAdmin
        .from('mentors')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!mentor) {
        return res.status(404).json({ error: 'Mentor not found' });
      }

      // Get active mentee count
      const { count } = await supabaseAdmin
        .from('mentor_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('mentor_id', id)
        .eq('status', 'active')
        .eq('is_active', true);

      return res.status(200).json({
        success: true,
        data: {
          ...mentor,
          active_mentees: count || 0
        }
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error(`Error in /api/admin/mentors/${id}:`, error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
