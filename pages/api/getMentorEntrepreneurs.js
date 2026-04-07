import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import supabaseAdmin from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
  // Auth check - require login
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized - Please login' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mentorEmail = session.user.email.toLowerCase().trim();

    console.log('🔍 Fetching entrepreneurs for mentor:', mentorEmail);

    // Step 1: Get mentor ID from email using mentors table
    const { data: mentor, error: mentorError } = await supabaseAdmin
      .from('mentors')
      .select('id, name, email')
      .eq('email', mentorEmail)
      .eq('status', 'active')
      .single();

    if (mentorError || !mentor) {
      console.error('❌ Mentor not found:', mentorError);
      return res.status(404).json({
        error: 'Mentor not found',
        success: false,
        data: []
      });
    }

    console.log('✅ Found mentor:', mentor.name, '(ID:', mentor.id + ')');

    // Step 2: Fetch active assignments with entrepreneur data
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('mentor_assignments')
      .select(`
        id,
        batch_id,
        entrepreneur_id,
        entrepreneurs (
          id,
          name,
          email,
          phone,
          business_name,
          address,
          region,
          zone,
          state,
          district,
          program,
          batch,
          folder_id,
          status
        ),
        batches (
          batch_name
        )
      `)
      .eq('mentor_id', mentor.id)
      .eq('status', 'active')
      .eq('is_active', true)
      .order('entrepreneurs(name)', { ascending: true });

    if (assignmentsError) {
      console.error('❌ Error fetching assignments:', assignmentsError);
      throw assignmentsError;
    }

    console.log(`✅ Found ${assignments?.length || 0} active assignments`);

    // Step 3: Transform to match frontend expected format
    const entrepreneurs = (assignments || []).map(assignment => {
      const e = assignment.entrepreneurs;
      if (!e) return null;

      // Determine program type from batch name or program field
      let programType = e.program || 'Unknown';
      const batchName = assignment.batches?.batch_name || e.batch || '';

      if (batchName.toLowerCase().includes('bangkit') || programType.toLowerCase().includes('bangkit')) {
        programType = 'Bangkit';
      } else if (batchName.toLowerCase().includes('maju') || programType.toLowerCase().includes('maju')) {
        programType = 'Maju';
      }

      return {
        id: e.id,
        mentee_name: e.name || '',
        entrepreneur_id: e.id || '',
        business_name: e.business_name || '',
        address: e.address || '',
        phone: e.phone || '',
        email: e.email || '',
        zone: e.zone || e.state || '',
        state: e.state || '',
        batch: batchName || e.batch || '',
        program_type: programType,
        mentor_name: mentor.name,
        mentor_email: mentor.email,
        folder_id: e.folder_id || '',
        status: e.status || ''
      };
    }).filter(Boolean); // Remove null entries

    console.log(`✅ Returning ${entrepreneurs.length} entrepreneurs for ${mentorEmail}`);

    return res.status(200).json({
      success: true,
      data: entrepreneurs,
      count: entrepreneurs.length
    });

  } catch (error) {
    console.error('❌ Error in getMentorEntrepreneurs:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      success: false,
      data: []
    });
  }
}
