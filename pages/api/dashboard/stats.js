// pages/api/dashboard/stats.js
import { requireAuth, hasRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authResult = await requireAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;

  try {
    let stats = {};

    // System Admin - Full statistics
    if (hasRole(user, 'system_admin')) {
      stats = await getSystemAdminStats();
    }
    // Program Coordinator - Program-specific stats
    else if (hasRole(user, 'program_coordinator')) {
      stats = await getProgramCoordinatorStats(user);
    }
    // Report Admin - Report-focused stats
    else if (hasRole(user, 'report_admin')) {
      stats = await getReportAdminStats();
    }
    // Payment Admin - Payment-focused stats
    else if (hasRole(user, 'payment_admin')) {
      stats = await getPaymentAdminStats();
    }
    // Payment Approver - Approval-focused stats
    else if (hasRole(user, 'payment_approver')) {
      stats = await getPaymentApproverStats();
    }
    // Mentor - Own stats only
    else if (hasRole(user, 'mentor') || hasRole(user, 'premier_mentor')) {
      stats = await getMentorStats(user);
    }
    // Stakeholder - Aggregate stats only
    else if (hasRole(user, 'stakeholder')) {
      stats = await getStakeholderStats();
    }
    else {
      return res.status(403).json({ error: 'No valid role for dashboard access' });
    }

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

// System Admin Statistics
async function getSystemAdminStats() {
  // Total users count
  const { count: totalUsers } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  // Active mentors (users with mentor or premier_mentor role and active status)
  const { data: mentors } = await supabase
    .from('users')
    .select('roles, status')
    .eq('status', 'active');
  
  const activeMentors = mentors?.filter(m => 
    m.roles?.includes('mentor') || m.roles?.includes('premier_mentor')
  ).length || 0;

  // Total reports from Google Sheets (we'll need to query the actual report data)
  // For now, returning placeholder - will integrate with actual sheets data
  const totalReports = 316; // TODO: Query from actual reports table when available

  // Recent activity for "this week" and "this month"
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { count: newUsersThisWeek } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  // Placeholder for reports this month - will integrate with sheets
  const reportsThisMonth = 45;

  return {
    totalUsers,
    totalUsersChange: newUsersThisWeek || 0,
    totalReports,
    reportsThisMonth,
    activeMentors,
    activeMentorsPercentage: totalUsers > 0 ? Math.round((activeMentors / totalUsers) * 100) : 0,
    dualWriteSuccessRate: 99.7, // TODO: Calculate from actual dual-write logs
  };
}

// Program Coordinator Statistics
async function getProgramCoordinatorStats(user) {
  // Get coordinator's program from mentor_profiles
  const { data: profile } = await supabase
    .from('mentor_profiles')
    .select('programs')
    .eq('user_id', user.id)
    .single();

  const coordinatorProgram = profile?.programs?.[0] || 'Bangkit'; // Default to Bangkit

  // Count mentors in this program
  const { data: programMentors } = await supabase
    .from('mentor_profiles')
    .select('user_id, programs')
    .contains('programs', [coordinatorProgram]);

  const activeMentors = programMentors?.length || 0;

  // Get total mentees from mentor_assignments
  const { count: totalMentees, error: menteesError } = await supabase
    .from('mentor_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  if (menteesError) {
    console.error('Error counting mentees:', menteesError);
  }

  const { count: pendingMentees, error: pendingError } = await supabase
    .from('mentor_assignments')
    .select('*', { count: 'exact', head: true })
    .is('mentor_id', null)
    .eq('status', 'active');

  if (pendingError) {
    console.error('Error counting pending mentees:', pendingError);
  }

  console.log(`📊 Stats - Total mentees: ${totalMentees}, Pending: ${pendingMentees}`);

  // TODO: Get reports count from reports table
  const reportsThisMonth = 23;

  return {
    myProgram: coordinatorProgram,
    activeMentors,
    inactiveMentors: 2, // TODO: Calculate from user status
    totalMentees: totalMentees || 0,
    pendingMentees: pendingMentees || 0,
    reportsThisMonth,
    reportsChange: 5, // vs last month
  };
}

// Report Admin Statistics
async function getReportAdminStats() {
  // Placeholder - will integrate with actual reports data
  return {
    totalReports: 316,
    reportsThisMonth: 45,
    pendingReview: 25,
    oldestPendingDays: 7,
    flaggedIssues: 8,
    reviewedToday: 12,
    reviewedTodayChange: 4, // vs average
  };
}

// Payment Admin Statistics
async function getPaymentAdminStats() {
  // Placeholder - will integrate with actual payment_requests table
  return {
    pendingApproval: 8,
    pendingApprovalAmount: 10400,
    approvedNotPaid: 4,
    approvedNotPaidAmount: 5200,
    paidThisMonth: 42300,
    paidThisMonthCount: 18,
    totalPendingAmount: 15600,
  };
}

// Payment Approver Statistics
async function getPaymentApproverStats() {
  // Placeholder - will integrate with actual payment_requests table
  return {
    pendingMyApproval: 8,
    pendingMyApprovalAmount: 10400,
    approvedToday: 3,
    approvedTodayAmount: 4200,
    approvedThisMonth: 24,
    approvedThisMonthAmount: 31200,
    avgApprovalTime: 1.8, // days
    targetApprovalTime: 3, // days
  };
}

// Mentor Statistics
async function getMentorStats(user) {
  // Get mentor's mentees count (placeholder)
  const myMentees = 6;
  const pendingMentees = 1;

  // Get mentor's reports (placeholder)
  const reportsThisMonth = 8;
  const pendingReports = 2;
  const sessionsThisMonth = 8;
  const totalSessionsExpected = 12;

  // Get mentor's pending payments (placeholder)
  const pendingPayment = 3200;
  const pendingPaymentRequests = 2;

  return {
    myMentees,
    pendingMentees,
    reportsThisMonth,
    pendingReports,
    sessionsThisMonth,
    sessionsRemaining: totalSessionsExpected - sessionsThisMonth,
    pendingPayment,
    pendingPaymentRequests,
  };
}

// Stakeholder Statistics
async function getStakeholderStats() {
  // Aggregate stats only - no individual data
  return {
    totalPrograms: 3,
    programs: ['Bangkit', 'Maju', 'TUBF'],
    activeMentors: 23,
    activeMentorsThisMonth: 18,
    activeMentees: 124,
    pendingMentees: 8,
    totalReports: 316,
    reportsThisMonth: 45,
  };
}
