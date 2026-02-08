// pages/api/mentor/my-dashboard.js
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSheetsClient } from '../../../lib/sheets';
import { validateSequentialSessions } from '../../../lib/mentorUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Normalize round/session number for comparison
 * Handles: "Mentoring 2", "Round 4", "Sesi 1", "Sesi #2", "2"
 */
function normalizeRoundNumber(value) {
  if (!value && value !== 0) return null;
  const match = String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

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

    // 1. REFACTOR: Get mentor's assigned mentees from MAPPING SHEET (Source of Truth)
    // We replace the DB query to 'mentor_assignments' with a call to the Google Sheet.
    console.log('📋 Reading mentor assignments from Google Sheets "mapping"...');
    const client = await getSheetsClient();
    let mappingRows = [];
    try {
      mappingRows = await client.getRows('mapping');
      console.log(`✅ Loaded ${mappingRows.length} rows from mapping sheet`);
    } catch (sheetError) {
      console.error('❌ Error fetching mapping sheet:', sheetError);
      return res.status(500).json({ error: 'Failed to fetch mentee mapping' });
    }

    // Filter for this mentor
    // Mapping Sheet Columns based on standard access:
    // [0] Batch, [1] Zon, [2] Mentor, [3] Mentor_Email, [4] Usahawan(Name), [5] Nama_Syarikat, ...
    // Note: getRows returns objects keyed by header. Assuming headers are standard.
    // Let's iterate and filter manually to be safe with string normalization.

    // Debug: Log the first row keys to understand column names
    if (mappingRows.length > 0) {
      const firstRow = mappingRows[0];
      // Google Spreadsheet Row object usually has properties directly or via _rawData / _sheet.headerValues
      // But for json serialization often we iterate keys
      try {
        const keys = Object.keys(firstRow); // This might include internal keys if using google-spreadsheet
        // filter out internal keys assuming they start with _ or are methods
        const validKeys = keys.filter(k => !k.startsWith('_') && typeof firstRow[k] !== 'function');
        console.log('📋 Mapping Sheet Columns:', validKeys.join(', '));
      } catch (e) {
        console.log('could not read keys', e);
      }
    }

    const myAssignments = mappingRows.filter(row => {
      // Try multiple variations for Mentor Email
      const rowEmail = (
        row['Mentor_Email'] ||
        row['Mentor Email'] ||
        row['Email Mentor'] ||
        row['Emel Mentor'] ||
        ''
      ).trim().toLowerCase();

      return rowEmail === userEmail;
    });

    console.log(`🔍 Found ${myAssignments.length} mentees assigned to ${userEmail}`);

    const assignments = myAssignments.map((row, index) => {
      // Helper to try multiple column names
      const getCol = (possibleNames) => {
        for (const name of possibleNames) {
          if (row[name]) return row[name];
        }
        return null;
      };

      // Extract fields with fallbacks
      const batchStr = getCol(['Batch', 'Cohort', 'Kohort']) || 'Unknown Batch';
      const menteeName = getCol(['Mentee', 'Usahawan', 'Nama Usahawan', 'Nama_Usahawan', 'Nama', 'Name', 'Participant', 'Nama Peserta']) || 'Unknown Mentee';
      const businessName = getCol(['Nama Syarikat', 'Nama_Syarikat', 'Business Name', 'Syarikat']) || '';
      const phone = getCol(['No_Tel', 'No. Tel', 'No Tel', 'Phone', 'Telefon']) || '';
      const state = getCol(['Zon', 'Zone', 'State', 'Negeri']) || '';
      const email = getCol(['Emel', 'Email', 'E-mail', 'EMAIL']) || '';

      // Log if name resolution fails
      if (menteeName === 'Unknown Mentee') {
        console.warn(`⚠️ Failed to resolve mentee name for row ${index}. Available data:`, JSON.stringify(row));
      }

      // Derive Program from Batch String (e.g. "Bangkit Batch 5" -> "Bangkit")
      let program = 'Unknown';
      if (batchStr.toLowerCase().includes('bangkit')) program = 'Bangkit';
      else if (batchStr.toLowerCase().includes('maju')) program = 'Maju';

      // Mock an 'entrepreneurs' object to match previous structure
      return {
        id: `sheet_row_${index}`, // Dummy ID since we don't have DB IDs
        assigned_at: new Date().toISOString(), // Dummy date
        status: 'active',
        entrepreneurs: {
          id: `sheet_${index}`, // Dummy ID
          name: menteeName,
          email: email,
          business_name: businessName,
          phone: phone,
          state: state,
          program: program,
          cohort: batchStr,
          status: 'active'
        }
      };
    });

    // We no longer check assignmentsError because we used try/catch above for Sheets


    // 2. CRITICAL: Read sessions from Google Sheets (source of truth), NOT Supabase
    console.log('📋 Reading session data from Google Sheets...');
    // client is already initialized in Step 1
    const bangkitSheet = await client.getRows('Bangkit');

    // Read Maju reports sheet
    let majuSheet = [];
    try {
      majuSheet = await client.getRows('LaporanMajuUM');
    } catch (e) {
      console.warn('⚠️ LaporanMajuUM sheet not found, skipping Maju reports');
    }

    console.log(`📊 Loaded ${bangkitSheet.length} Bangkit reports and ${majuSheet.length} Maju reports`);

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

    // UM tracking removed from mentor dashboard (remains in admin overview)

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

      // CRITICAL FIX: Get sessions from Google Sheets for this mentee
      const menteeName = entrepreneur.name;
      let menteeSessions = [];

      // Get Bangkit sessions
      const bangkitSessions = bangkitSheet.filter(row => {
        const rowMenteeName = (row['Nama Usahawan'] || '').trim();
        return rowMenteeName === menteeName;
      }).map(row => ({
        menteeName: row['Nama Usahawan'],
        sessionLabel: row['Sesi Laporan'] || '',
        status: row['Status Sesi'] || '',
        sessionDate: row['Tarikh Sesi'] || '',
        programType: 'bangkit'
      }));

      // Get Maju sessions
      const majuSessions = majuSheet.filter(row => {
        const rowMenteeName = (row['NAMA_MENTEE'] || '').trim();
        return rowMenteeName === menteeName;
      }).map(row => ({
        menteeName: row['NAMA_MENTEE'],
        sessionNumber: row['SESI_NUMBER'],
        status: row['MIA_STATUS'] || 'Tidak MIA',
        sessionDate: row['TARIKH_SESI'] || '',
        programType: 'maju'
      }));

      // Combine and sort by date
      menteeSessions = [...bangkitSessions, ...majuSessions].sort((a, b) => {
        const dateA = new Date(a.sessionDate || '1970-01-01');
        const dateB = new Date(b.sessionDate || '1970-01-01');
        return dateA - dateB;
      });

      // Assign sequential session numbers based on chronological order
      const sessionsWithNumbers = menteeSessions.map((s, index) => {
        // Extract session number from label (e.g., "Sesi #2 (Round 1)" -> 2)
        let sessionNum = index + 1; // Default: chronological order
        if (s.sessionLabel) {
          const match = s.sessionLabel.match(/Sesi\s*#?(\d+)/i);
          if (match) sessionNum = parseInt(match[1]);
        } else if (s.sessionNumber) {
          sessionNum = parseInt(s.sessionNumber);
        }

        return {
          ...s,
          calculatedSessionNumber: sessionNum
        };
      });

      // Debug logging for sessions
      if (sessionsWithNumbers.length > 0) {
        console.log(`📊 ${entrepreneur.name}: ${sessionsWithNumbers.length} sessions found in Google Sheets`);
        console.log('Session data:', sessionsWithNumbers.map(s => ({
          session_num: s.calculatedSessionNumber,
          Status: s.status,
          date: s.sessionDate,
          program: s.programType
        })));
      }

      // Get current round info
      const currentRound = batchInfo?.round || 'Mentoring 1';
      const currentRoundNum = batchInfo?.roundNumber || 1;
      const dueDate = batchInfo ? calculateDueDate(batchInfo.endMonth) : null;

      // Count ALL completed sessions (for display purposes)
      const completedSessions = sessionsWithNumbers.filter(s => {
        const statusValue = (s.status || '').toLowerCase();
        // For Maju: check MIA_STATUS !== 'MIA'
        // For Bangkit: check Status Sesi === 'Selesai'
        if (s.programType === 'maju') {
          return statusValue !== 'mia' && statusValue.includes('tidak');
        } else {
          return statusValue === 'selesai' || statusValue === 'completed';
        }
      });

      console.log(`✅ ${entrepreneur.name}: ${completedSessions.length} total completed sessions`);

      // 5. Calculate Status using Sequential Logic
      // We pass: all sessions, current round number, and due date
      const validationResult = validateSequentialSessions(
        sessionsWithNumbers,
        currentRoundNum,
        dueDate
      );

      const status = validationResult.status;
      const nextDueSession = validationResult.nextDueSession;
      const missingSessions = validationResult.missingSessions;

      console.log(`📊 Status for ${menteeName}: ${status} (Next: ${nextDueSession}, Missing: ${missingSessions})`);

      // Calculate missing display fields
      let daysUntilDue = null;
      if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const lastSession = menteeSessions.length > 0 ? menteeSessions[menteeSessions.length - 1] : null;
      const lastSessionDate = lastSession ? lastSession.sessionDate : null;

      // UM tracking removed from mentor dashboard

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
        currentRoundNumber: currentRoundNum,
        status: status,
        totalSessions: menteeSessions.length,
        completedSessions: validationResult.completedCount,
        reportsThisRound: validationResult.submittedSessions.includes(currentRoundNum) ? 1 : 0,
        expectedReportsThisRound: 1,
        lastSessionDate: lastSessionDate,
        roundDueDate: dueDate?.toISOString().split('T')[0],
        nextDueDate: dueDate?.toISOString().split('T')[0],
        daysUntilDue: daysUntilDue, // Keep existing calc for display if needed, but status drives logic
        assignedAt: assignment.assigned_at,
        batchPeriod: batchInfo?.period || '',
        nextDueSession: validationResult.nextDueSession,
        missingSessions: validationResult.missingSessions
      };
    }).filter(m => m !== null) || [];

    // 5. Calculate summary stats
    const stats = {
      totalMentees: mentees.length,
      onTrack: mentees.filter(m => m.status === 'on_track').length,
      dueSoon: mentees.filter(m => m.status === 'due_soon').length,
      overdue: mentees.filter(m => m.status === 'overdue').length,
      mia: mentees.filter(m => m.status === 'mia').length,
      pendingFirstSession: mentees.filter(m => m.status === 'pending_first_session' || m.status === 'never_started').length,
      needsAction: mentees.filter(m =>
        m.status === 'overdue' ||
        m.status === 'due_soon' ||
        m.status === 'sequence_broken' ||
        m.status === 'never_started'
      ).length,
      totalSessions: mentees.reduce((sum, m) => sum + m.totalSessions, 0),
      completedSessions: mentees.reduce((sum, m) => sum + m.completedSessions, 0),
      sessionsThisMonth: 0, // Can calculate if needed
      completionRate: 0 // Can calculate if needed
    };

    // 6. Recent reports - skip for now (can be added later if needed)
    const recentReports = [];

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
