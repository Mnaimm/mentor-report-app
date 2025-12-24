// pages/api/coordinator/dashboard-summary.js
import { requireRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

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

  try {
    // Fetch dashboard summary from view_program_summary
    const { data: summary, error: summaryError } = await supabase
      .from('view_program_summary')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (summaryError) {
      console.error('Failed to fetch program summary:', summaryError);
      // Return default values if view doesn't exist yet
      return res.status(200).json({
        summary: {
          total_mentees: 0,
          active_mentors: 0,
          overall_completion_pct: 0,
          reports_this_month: 0,
          unassigned_mentees: 0,
          pending_mentors: 0,
          critical_mentors: 0,
          sessions_due_this_week: 0
        },
        unassigned: [],
        note: 'Views not created yet. Run create-dashboard-views.sql'
      });
    }

    // Fetch unassigned mentees
    const { data: unassignedData, error: unassignedError } = await supabase
      .from('mentor_assignments')
      .select(`
        id,
        entrepreneur_id,
        created_at,
        entrepreneurs!inner (
          id,
          name,
          email,
          business_name,
          phone,
          state,
          program,
          cohort
        )
      `)
      .is('mentor_id', null)
      .order('created_at', { ascending: false });

    if (unassignedError) {
      console.error('Failed to fetch unassigned:', unassignedError);
    }

    // Flatten unassigned data
    const flattenedUnassigned = (unassignedData || []).map(item => ({
      assignment_id: item.id,
      id: item.entrepreneurs.id,
      name: item.entrepreneurs.name,
      email: item.entrepreneurs.email,
      business_name: item.entrepreneurs.business_name,
      phone: item.entrepreneurs.phone,
      state: item.entrepreneurs.state,
      program: item.entrepreneurs.program,
      cohort: item.entrepreneurs.cohort,
      created_at: item.created_at
    }));

    return res.status(200).json({
      summary: summary || {
        total_mentees: 0,
        active_mentors: 0,
        overall_completion_pct: 0,
        reports_this_month: 0,
        unassigned_mentees: 0,
        pending_mentors: 0,
        critical_mentors: 0,
        sessions_due_this_week: 0
      },
      unassigned: flattenedUnassigned,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch dashboard summary',
      details: err.message 
    });
  }
}
