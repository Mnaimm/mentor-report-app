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

  try {
    if (req.method === 'GET') {
      // Fetch mentors with manual aggregation
      const { data: mentorsRaw, error: fetchError } = await supabaseAdmin
          .from('mentors')
          .select(`
            id,
            name,
            email,
            phone,
            ic_number,
            address,
            state,
            status,
            bank_account,
            emergency_contact,
            created_at
          `)
          .eq('status', 'active')
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;

        const mentorsWithData = await Promise.all(
          mentorsRaw.map(async (mentor) => {
            const { data: assignments } = await supabaseAdmin
              .from('mentor_assignments')
              .select(`
                id,
                status,
                is_active,
                entrepreneurs (
                  program,
                  zone
                )
              `)
              .eq('mentor_id', mentor.id)
              .eq('status', 'active')
              .eq('is_active', true);

            const activeCount = assignments?.length || 0;
            const programs = [...new Set(
              assignments
                ?.map(a => a.entrepreneurs?.program)
                .filter(Boolean)
                .sort() || []
            )].join(', ');
            const zones = [...new Set(
              assignments
                ?.map(a => a.entrepreneurs?.zone)
                .filter(Boolean)
                .sort() || []
            )].join(', ');

            return {
              ...mentor,
              active_mentees: activeCount,
              programs_served: programs || null,
              zones_covered: zones || null
            };
          })
        );

      return res.status(200).json({
        success: true,
        data: mentorsWithData
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
        bank_account,
        emergency_contact
      } = req.body;

      // Validation
      if (!name || !email) {
        return res.status(400).json({
          error: 'Missing required fields: name, email'
        });
      }

      // Check if mentor already exists
      const { data: existing } = await supabaseAdmin
        .from('mentors')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        return res.status(400).json({
          error: 'Mentor dengan email ini sudah wujud'
        });
      }

      // Insert mentor (region and program are NULL - derived from assignments)
      const { data: newMentor, error: insertError } = await supabaseAdmin
        .from('mentors')
        .insert([{
          name,
          email,
          phone: phone || null,
          ic_number: ic_number || null,
          address: address || null,
          state: state || null,
          region: null,
          program: null,
          status: 'active',
          bank_account: bank_account || null,
          emergency_contact: emergency_contact || null
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Also add mentor role to user_roles table
      try {
        const { error: roleError } = await supabaseAdmin
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
