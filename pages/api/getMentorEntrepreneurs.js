import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createAdminClient } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized - Please login' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mentorEmail = session.user.email;
    const normalizedEmail = mentorEmail.toLowerCase().trim();
    const supabase = createAdminClient();

    console.log('Fetching entrepreneurs for mentor:', normalizedEmail);

    const { data: mentorRecord, error: mentorError } = await supabase
      .from('mentors')
      .select('id, name, email, status')
      .ilike('email', normalizedEmail)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    console.log('getMentorEntrepreneurs mentor lookup raw result:', {
      email: normalizedEmail,
      found: Boolean(mentorRecord),
      error: mentorError
    });

    if (mentorError) {
      throw mentorError;
    }

    if (!mentorRecord) {
      return res.status(404).json({ error: 'Mentor record not found' });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from('mentor_assignments')
      .select(`
        id,
        mentor_id,
        entrepreneur_id,
        batch_id,
        status,
        is_active,
        entrepreneurs (
          id,
          name,
          email,
          business_name,
          address,
          phone,
          business_type,
          zone,
          state,
          batch,
          program,
          folder_id
        ),
        batches (
          batch_name
        )
      `)
      .eq('mentor_id', mentorRecord.id)
      .eq('status', 'active')
      .eq('is_active', true);

    console.log('getMentorEntrepreneurs assignments raw result:', {
      mentorId: mentorRecord.id,
      count: assignments?.length || 0,
      error: assignmentsError
    });

    if (assignmentsError) {
      throw assignmentsError;
    }

    const entrepreneurs = (assignments || [])
      .map((assignment) => {
        const entrepreneur = assignment.entrepreneurs;
        const batch = entrepreneur?.batch || assignment.batches?.batch_name || '';
        const program = entrepreneur?.program || '';
        let programType = program || 'Unknown';

        if (!program && batch.toLowerCase().includes('bangkit')) {
          programType = 'Bangkit';
        } else if (!program && batch.toLowerCase().includes('maju')) {
          programType = 'Maju';
        }

        return {
          id: entrepreneur?.id || assignment.entrepreneur_id,
          assignment_id: assignment.id,
          mentee_name: entrepreneur?.name || '',
          entrepreneur_id: assignment.entrepreneur_id,
          business_name: entrepreneur?.business_name || '',
          address: entrepreneur?.address || '',
          phone: entrepreneur?.phone || '',
          email: entrepreneur?.email || '',
          business_type: entrepreneur?.business_type || '',
          zone: entrepreneur?.zone || '',
          state: entrepreneur?.state || '',
          batch,
          program_type: programType,
          mentor_name: mentorRecord.name || '',
          mentor_email: mentorRecord.email || '',
          folder_id: entrepreneur?.folder_id || ''
        };
      })
      .sort((a, b) => a.mentee_name.localeCompare(b.mentee_name));

    const { data: dualWriteLogs, error: dualWriteError } = await supabase
      .from('dual_write_monitoring')
      .select('id, source_system, target_system, operation_type, table_name, record_id, status, error_message, metadata, created_at')
      .eq('metadata->>mentor_email', normalizedEmail)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('getMentorEntrepreneurs recent dual-write raw result:', {
      count: dualWriteLogs?.length || 0,
      error: dualWriteError
    });

    if (dualWriteError) {
      console.warn('Failed to fetch recent dual-write logs:', dualWriteError);
    }

    console.log(`Found ${entrepreneurs.length} entrepreneurs for ${normalizedEmail}`);

    return res.status(200).json({
      success: true,
      data: entrepreneurs,
      count: entrepreneurs.length
    });
  } catch (error) {
    console.error('Error in getMentorEntrepreneurs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
