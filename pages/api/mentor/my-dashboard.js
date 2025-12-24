// pages/api/mentor/my-dashboard.js
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authenticated user
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userEmail = session.user.email.toLowerCase().trim();

    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mentorId = user.id;

    // Fetch batch rounds data from Supabase
    const { data: batchRounds, error: batchError } = await supabase
      .from('batch_rounds')
      .select('*');
    
    if (batchError) {
      console.error('❌ Error fetching batch rounds:', batchError);
    } else {
      console.log(`📋 Loaded ${batchRounds?.length || 0} batch rounds from database`);
      if (batchRounds && batchRounds.length > 0) {
        const uniqueBatches = [...new Set(batchRounds.map(b => b.batch_name))];
        console.log('Available batches:', uniqueBatches.join(', '));
      }
    }
    
    // Helper function to get batch round info
    const getBatchRoundInfo = (batchName, programName) => {
      if (!batchRounds) {
        console.warn('⚠️ No batch_rounds data available');
        return null;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find all matching batch rounds for this batch and program
      const matchingRounds = batchRounds.filter(b => {
        const batchMatch = b.batch_name === batchName || 
                          b.batch_name?.includes(batchName) || 
                          batchName?.includes(b.batch_name);
        
        const programMatch = !programName || 
                            b.program?.toLowerCase() === programName?.toLowerCase() ||
                            programName?.toLowerCase().includes(b.program?.toLowerCase());
        
        return batchMatch && programMatch;
      });
      
      if (matchingRounds.length === 0) {
        console.warn(`❌ No batch_rounds entry for: "${batchName}" (${programName})`);
        return null;
      }
      
      // Find the current active round (today is between start and end)
      let currentRound = matchingRounds.find(b => {
        const startDate = new Date(b.start_month);
        const endDate = new Date(b.end_month);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return today >= startDate && today <= endDate;
      });
      
      // If no current round, find the next upcoming round
      if (!currentRound) {
        const upcomingRounds = matchingRounds
          .filter(b => new Date(b.start_month) > today)
          .sort((a, b) => new Date(a.start_month) - new Date(b.start_month));
        
        currentRound = upcomingRounds[0];
      }
      
      // If still no round, take the most recent past round
      if (!currentRound) {
        const pastRounds = matchingRounds
          .filter(b => new Date(b.end_month) < today)
          .sort((a, b) => new Date(b.end_month) - new Date(a.end_month));
        
        currentRound = pastRounds[0];
      }
      
      if (!currentRound) {
        console.warn(`❌ No suitable round found for: "${batchName}" (${programName})`);
        return null;
      }
      
      console.log(`✅ Found round: ${currentRound.batch_name} - ${currentRound.round_name}`);
      
      return {
        batch: currentRound.batch_name,
        round: currentRound.round_name,
        roundNumber: currentRound.round_number,
        period: currentRound.period_label,
        startMonth: currentRound.start_month,
        endMonth: currentRound.end_month,
        notes: currentRound.notes
      };
    };

    // Helper function to calculate due date from end month
    const calculateDueDate = (endMonthStr) => {
      if (!endMonthStr) return null;
      
      // Handle both formats: "2024-08" or "2024-08-31"
      const dateParts = endMonthStr.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      
      if (!year || !month) {
        console.error(`❌ Invalid end month format: "${endMonthStr}"`);
        return null;
      }
      
      // Return the last day of the end month (no grace period)
      const dueDate = new Date(year, month, 0);
      
      console.log(`📅 Due date: ${endMonthStr} → ${dueDate.toISOString().split('T')[0]}`);
      
      return dueDate;
    };

    // 1. Get mentor's assigned mentees
    const { data: assignments, error: assignmentsError } = await supabase
      .from('mentor_assignments')
      .select(`
        id,
        assigned_at,
        status,
        entrepreneurs (
          id,
          name,
          email,
          business_name,
          phone,
          state,
          program,
          cohort,
          status
        )
      `)
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return res.status(500).json({ error: 'Failed to fetch mentees' });
    }

    // 2. Get all sessions for this mentor
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('mentor_id', mentorId)
      .order('session_date', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
    }

    // 3. Get payment requests for this mentor (if table exists)
    let paymentRequests = [];
    try {
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });

      if (!paymentsError && payments) {
        paymentRequests = payments;
      }
    } catch (e) {
      console.warn('Payment requests table not found, skipping');
    }

    // 4. Process mentees with their session data
    const mentees = assignments?.map(assignment => {
      const entrepreneur = assignment.entrepreneurs;
      if (!entrepreneur) return null;

      const menteeBatch = entrepreneur.cohort; // e.g., "Batch 5"
      const menteeProgram = entrepreneur.program; // e.g., "Bangkit" or "Maju"
      console.log(`🔍 Processing ${entrepreneur.name}, cohort: "${menteeBatch}", program: "${menteeProgram}"`);
      
      const batchInfo = getBatchRoundInfo(menteeBatch, menteeProgram);
      
      // Debug logging for batch mismatch
      if (!batchInfo) {
        console.warn(`⚠️ No batch_rounds entry found for cohort: "${menteeBatch}" (${entrepreneur.name})`);
        if (batchRounds && batchRounds.length > 0) {
          const uniqueBatches = [...new Set(batchRounds.map(b => b.batch_name))];
          console.log('Available batches:', uniqueBatches.join(', '));
        }
      } else {
        console.log(`✅ Found batch info for ${entrepreneur.name}:`, batchInfo);
      }
      
      // Get sessions for this mentee
      const menteeSessions = sessions?.filter(s => s.entrepreneur_id === entrepreneur.id) || [];
      
      // Debug logging for sessions
      if (menteeSessions.length > 0) {
        console.log(`📊 ${entrepreneur.name}: ${menteeSessions.length} sessions found`);
        console.log('Session statuses:', menteeSessions.map(s => s.Status || s.status).join(', '));
      }
      
      // Get current round info
      const currentRound = batchInfo?.round || 'Mentoring 1';
      const dueDate = batchInfo ? calculateDueDate(batchInfo.endMonth) : null;
      
      // Count completed sessions FOR CURRENT ROUND ONLY
      // Check both "Status" (capital S) and "status" (lowercase s) for compatibility
      const completedSessions = menteeSessions.filter(s => {
        const statusValue = (s.Status || s.status || '').toLowerCase();
        return statusValue === 'selesai' || 
               statusValue === 'completed' || 
               statusValue === 'done' ||
               statusValue === 'submitted';
      });
      
      console.log(`✅ ${entrepreneur.name}: ${completedSessions.length} completed sessions`);
      
      // Expected reports for current round (usually 1 per round)
      const expectedReportsThisRound = 1;
      const reportsThisRound = completedSessions.length > 0 ? 1 : 0;

      // Check for MIA status
      const hasMIASession = menteeSessions.some(s => s.Status?.toUpperCase() === 'MIA');

      // Calculate last session date
      const lastSession = completedSessions.length > 0 ? completedSessions[0] : null;
      const lastSessionDate = lastSession?.session_date || null;

      // Calculate days until due
      let daysUntilDue = null;
      let status = 'pending_first_session';

      // Determine status based on sessions and due date
      if (hasMIASession) {
        status = 'mia';
      } else if (completedSessions.length === 0 && menteeSessions.length === 0) {
        status = 'pending_first_session'; // No sessions at all
      } else if (reportsThisRound >= expectedReportsThisRound) {
        status = 'on_track'; // Completed this round
      } else if (dueDate) {
        // Calculate days until due if we have a due date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate - today;
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) {
          status = 'overdue'; // Past due date
        } else if (daysUntilDue <= 7) {
          status = 'due_soon'; // Within 7 days
        } else {
          status = 'pending'; // Not yet due
        }
      } else {
        // No due date available, but has sessions - default to pending
        status = 'pending';
      }

      return {
        id: entrepreneur.id,
        name: entrepreneur.name,
        email: entrepreneur.email,
        businessName: entrepreneur.business_name || 'Unknown Business',
        phone: entrepreneur.phone || '',
        region: entrepreneur.state || 'Unknown',
        program: entrepreneur.program || 'Unknown',
        batch: menteeBatch,
        currentRound: currentRound,
        status: status,
        totalSessions: menteeSessions.length,
        completedSessions: completedSessions.length,
        reportsThisRound: reportsThisRound,
        expectedReportsThisRound: expectedReportsThisRound,
        lastSessionDate: lastSessionDate,
        roundDueDate: dueDate?.toISOString().split('T')[0],
        daysUntilDue: daysUntilDue,
        assignedAt: assignment.assigned_at,
        batchPeriod: batchInfo?.period || ''
      };
    }).filter(m => m !== null) || [];

    // 5. Calculate summary stats
    const stats = {
      totalMentees: mentees.length,
      onTrack: mentees.filter(m => m.status === 'on_track').length,
      dueSoon: mentees.filter(m => m.status === 'due_soon').length,
      overdue: mentees.filter(m => m.status === 'overdue').length,
      mia: mentees.filter(m => m.status === 'mia').length,
      pendingFirstSession: mentees.filter(m => m.status === 'pending_first_session').length,
      totalSessions: sessions?.length || 0,
      completedSessions: sessions?.filter(s => {
        const statusValue = (s.Status || s.status || '').toLowerCase();
        return statusValue === 'selesai' || 
               statusValue === 'completed' || 
               statusValue === 'done' ||
               statusValue === 'submitted';
      }).length || 0,
      sessionsThisMonth: sessions?.filter(s => {
        const sessionDate = new Date(s.created_at);
        const now = new Date();
        return sessionDate.getMonth() === now.getMonth() && 
               sessionDate.getFullYear() === now.getFullYear();
      }).length || 0,
      completionRate: sessions?.length > 0 
        ? Math.round((sessions.filter(s => 
            s.Status?.toLowerCase() === 'selesai' || s.Status?.toLowerCase() === 'completed'
          ).length / sessions.length) * 100) 
        : 0
    };

    // 6. Recent reports (last 10 completed sessions)
    const recentReports = sessions
      ?.filter(s => s.Status?.toLowerCase() === 'selesai' || s.Status?.toLowerCase() === 'completed')
      .slice(0, 10)
      .map(s => {
        const mentee = mentees.find(m => m.id === s.entrepreneur_id);
        return {
          id: s.id,
          sessionDate: s.session_date,
          menteeName: mentee?.name || 'Unknown',
          businessName: mentee?.businessName || 'Unknown',
          program: s.program || mentee?.program,
          status: s.Status,
          createdAt: s.created_at
        };
      }) || [];

    // 7. Upcoming sessions (sessions due in next 14 days)
    const upcomingSessions = mentees
      .filter(m => m.nextDueDate && m.daysUntilDue !== null && m.daysUntilDue >= 0 && m.daysUntilDue <= 14)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .map(m => ({
        menteeId: m.id,
        menteeName: m.name,
        businessName: m.businessName,
        dueDate: m.nextDueDate,
        daysUntilDue: m.daysUntilDue,
        status: m.status
      }));

    // 8. Payment summary
    const paymentSummary = {
      totalRequests: paymentRequests.length,
      pendingApproval: paymentRequests.filter(p => p.status === 'pending_approval').length,
      approved: paymentRequests.filter(p => p.status === 'approved').length,
      paid: paymentRequests.filter(p => p.status === 'paid').length,
      totalPending: paymentRequests
        .filter(p => p.status === 'pending_approval' || p.status === 'approved')
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      totalPaid: paymentRequests
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount || 0), 0),
      recentRequests: paymentRequests.slice(0, 5)
    };

    // Return complete dashboard data
    return res.status(200).json({
      mentor: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      stats,
      mentees,
      recentReports,
      upcomingSessions,
      paymentSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mentor dashboard error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
