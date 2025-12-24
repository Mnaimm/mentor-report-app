// pages/api/dashboard/reports-by-status.js
import { requireAuth, hasRole, hasAnyRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication - system_admin, report_admin, coordinators, stakeholders can view
  const authResult = await requireAnyRole(req, res, [
    'system_admin',
    'report_admin',
    'program_coordinator',
    'stakeholder'
  ]);

  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;
  const { program, limit = 10 } = req.query;

  try {
    // TODO: This will need to integrate with actual reports data
    // For now, returning mock data structure
    
    // Status breakdown
    const statusBreakdown = {
      submitted: {
        count: 280,
        percentage: 88.6
      },
      underReview: {
        count: 25,
        percentage: 7.9
      },
      approved: {
        count: 11,
        percentage: 3.5
      },
      flagged: {
        count: 0,
        percentage: 0
      },
      rejected: {
        count: 0,
        percentage: 0
      }
    };

    // Total reports
    const totalReports = 316;

    // Recent reports (mock data - will integrate with actual reports)
    const recentReports = [
      {
        id: 'RPT-001',
        mentorName: 'Ahmad bin Ali',
        program: 'Maju',
        sessionNumber: 3,
        submissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'submitted'
      },
      {
        id: 'RPT-002',
        mentorName: 'Sarah Lee',
        program: 'Bangkit',
        sessionNumber: 4,
        submissionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'submitted'
      },
      {
        id: 'RPT-003',
        mentorName: 'John Tan',
        program: 'TUBF',
        sessionNumber: 2,
        submissionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'under_review'
      }
    ];

    // Filter by program if specified
    let filteredReports = recentReports;
    if (program) {
      filteredReports = recentReports.filter(r => 
        r.program.toLowerCase() === program.toLowerCase()
      );
    }

    // Program Coordinator - Filter to their program only
    if (hasRole(user, 'program_coordinator')) {
      const { data: profile } = await supabase
        .from('mentor_profiles')
        .select('programs')
        .eq('user_id', user.id)
        .single();

      const coordinatorProgram = profile?.programs?.[0];
      if (coordinatorProgram) {
        filteredReports = recentReports.filter(r => 
          r.program === coordinatorProgram
        );
      }
    }

    return res.status(200).json({
      totalReports,
      statusBreakdown,
      recentReports: filteredReports.slice(0, parseInt(limit)),
      filters: {
        program: program || 'all'
      }
    });

  } catch (error) {
    console.error('Reports by status error:', error);
    return res.status(500).json({ error: 'Failed to fetch reports by status' });
  }
}
