// pages/api/admin/mentor-progress.js
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. AUTHENTICATION
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. AUTHORIZATION - Check if user can access admin
    const hasAccess = await canAccessAdmin(session.user.email);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    // 3. CHECK CACHE (unless refresh requested)
    const forceRefresh = req.query.refresh === 'true';
    if (!forceRefresh && cache.data && cache.timestamp) {
      const age = Date.now() - cache.timestamp;
      if (age < CACHE_DURATION) {
        console.log(`⚡ Cache HIT - Age: ${Math.round(age / 1000)}s`);
        return res.status(200).json({
          ...cache.data,
          cached: true,
          cacheAge: Math.round(age / 1000),
        });
      }
    }

    console.log('🔄 Cache MISS - Fetching fresh data...');

    // Track partial failures for graceful degradation
    const errors = [];
    let mappingData = null;
    let batchRoundsData = null;
    let umData = null;
    let sessionsData = null;

    // 4. GOOGLE SHEETS AUTHENTICATION
    let sheets = null;
    try {
      const credentialsJson = Buffer.from(
        process.env.GOOGLE_CREDENTIALS_BASE64,
        'base64'
      ).toString('ascii');
      const credentials = JSON.parse(credentialsJson);
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      errors.push({
        source: 'Google Sheets Auth',
        message: 'Failed to authenticate with Google Sheets',
        details: error.message,
      });
      console.error('❌ Google Sheets auth failed:', error);
    }

    // 5. FETCH DATA WITH GRACEFUL DEGRADATION
    const fetchPromises = [];

    // Fetch mentor-mentee mappings from Google Sheets
    if (sheets) {
      fetchPromises.push(
        sheets.spreadsheets.values
          .get({
            spreadsheetId: process.env.GOOGLE_SHEETS_MAPPING_ID,
            range: 'mapping!A:K',
          })
          .then((data) => {
            mappingData = data;
            console.log('✅ Mapping data fetched');
          })
          .catch((error) => {
            errors.push({
              source: 'Mapping Sheet',
              message: 'Failed to fetch mentor-mentee mapping',
              details: error.message,
            });
            console.error('❌ Mapping fetch failed:', error);
          })
      );

      // Fetch UM form submissions from Google Sheets
      fetchPromises.push(
        sheets.spreadsheets.values
          .get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID_UM,
            range: 'UM!A:AR',
          })
          .then((data) => {
            umData = data;
            console.log('✅ UM data fetched');
          })
          .catch((error) => {
            errors.push({
              source: 'UM Sheet',
              message: 'Failed to fetch Upward Mobility data',
              details: error.message,
            });
            console.error('❌ UM fetch failed:', error);
          })
      );
    }

    // Fetch batch rounds from Supabase
    fetchPromises.push(
      supabase
        .from('batch_rounds')
        .select('*')
        .then((result) => {
          batchRoundsData = result;
          console.log('✅ Batch rounds fetched');
        })
        .catch((error) => {
          errors.push({
            source: 'Batch Rounds',
            message: 'Failed to fetch batch rounds',
            details: error.message,
          });
          console.error('❌ Batch rounds fetch failed:', error);
        })
    );

    // Fetch sessions WITHOUT joins (joins might be failing)
    // We'll manually join the data later
    fetchPromises.push(
      supabase
        .from('sessions')
        .select('*')
        .order('session_date', { ascending: true })
        .then((result) => {
          sessionsData = result;
          console.log('✅ Sessions data fetched (without joins)');
        })
        .catch((error) => {
          errors.push({
            source: 'Sessions',
            message: 'Failed to fetch sessions data',
            details: error.message,
          });
          console.error('❌ Sessions fetch failed:', error);
        })
    );

    // Fetch users separately
    let usersData = null;
    fetchPromises.push(
      supabase
        .from('users')
        .select('id, email, name')
        .then((result) => {
          usersData = result;
          console.log('✅ Users data fetched');
        })
        .catch((error) => {
          errors.push({
            source: 'Users',
            message: 'Failed to fetch users data',
            details: error.message,
          });
          console.error('❌ Users fetch failed:', error);
        })
    );

    // Fetch entrepreneurs separately
    let entrepreneursData = null;
    fetchPromises.push(
      supabase
        .from('entrepreneurs')
        .select('id, name, email, cohort, program')
        .then((result) => {
          entrepreneursData = result;
          console.log('✅ Entrepreneurs data fetched');
        })
        .catch((error) => {
          errors.push({
            source: 'Entrepreneurs',
            message: 'Failed to fetch entrepreneurs data',
            details: error.message,
          });
          console.error('❌ Entrepreneurs fetch failed:', error);
        })
    );

    await Promise.all(fetchPromises);

    // Check if we have critical data
    if (!mappingData || !mappingData.data || !mappingData.data.values) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch mapping data - cannot generate report',
        errors,
      });
    }

    // 6. PROCESS MAPPING DATA
    const mappingRows = mappingData.data.values || [];
    if (mappingRows.length < 2) {
      return res.status(404).json({
        success: false,
        error: 'No mapping data found',
        errors,
      });
    }

    // Group mentees by mentor
    const mentorMenteeMap = {};
    mappingRows.slice(1).forEach((row) => {
      const mentorEmail = (row[3] || '').toLowerCase().trim();
      const mentorName = row[2] || '';
      const batch = row[0] || '';
      const menteeName = row[4] || '';
      const businessName = row[5] || '';
      const email = row[9] || '';

      if (!mentorEmail || !menteeName) return;

      if (!mentorMenteeMap[mentorEmail]) {
        mentorMenteeMap[mentorEmail] = {
          mentorName,
          mentorEmail,
          batches: {},
          mentees: [],
        };
      }

      if (!mentorMenteeMap[mentorEmail].batches[batch]) {
        mentorMenteeMap[mentorEmail].batches[batch] = {
          batchName: batch,
          mentees: [],
        };
      }

      mentorMenteeMap[mentorEmail].batches[batch].mentees.push({
        name: menteeName,
        businessName: businessName,
        email: email,
      });

      // Add to overall mentees list (for unique count)
      if (!mentorMenteeMap[mentorEmail].mentees.includes(menteeName)) {
        mentorMenteeMap[mentorEmail].mentees.push(menteeName);
      }
    });

    console.log(`📊 Processed ${Object.keys(mentorMenteeMap).length} mentors`);

    // 7. PROCESS UM DATA
    const umRows = umData?.data?.values || [];
    const umSubmissions = {};

    if (umRows.length > 1) {
      // Headers: A=Timestamp, B=Email, C=Program, D=Batch, E=Session, F=Mentor, G=Entrepreneur
      umRows.slice(1).forEach((row) => {
        const mentorEmail = (row[1] || '').toLowerCase().trim(); // Column B
        const batch = row[3] || ''; // Column D
        const session = row[4] || ''; // Column E (e.g., "Sesi Mentoring 2")
        const entrepreneur = row[6] || ''; // Column G

        const sessionNum = session.match(/\d+/)?.[0]; // Extract number from "Sesi Mentoring 2"

        if (!mentorEmail || !sessionNum || !entrepreneur) return;

        const key = `${mentorEmail}:${batch}`;
        if (!umSubmissions[key]) {
          umSubmissions[key] = {
            session2: new Set(),
            session4: new Set(),
          };
        }

        if (sessionNum === '2') {
          umSubmissions[key].session2.add(entrepreneur);
        } else if (sessionNum === '4') {
          umSubmissions[key].session4.add(entrepreneur);
        }
      });

      console.log(`📋 Processed ${umRows.length - 1} UM form submissions`);
    } else {
      console.warn('⚠️ No UM data available');
    }

    // 8. MANUALLY JOIN SESSIONS WITH USERS AND ENTREPRENEURS
    const sessions = sessionsData?.data || [];
    const users = usersData?.data || [];
    const entrepreneurs = entrepreneursData?.data || [];

    // Create lookup maps for fast joining
    const usersMap = {};
    users.forEach(user => {
      usersMap[user.id] = user;
    });

    const entrepreneursMap = {};
    entrepreneurs.forEach(entrepreneur => {
      entrepreneursMap[entrepreneur.id] = entrepreneur;
    });

    console.log('\n=== DATA FETCHED ===');
    console.log('Sessions:', sessions.length);
    console.log('Users:', users.length);
    console.log('Entrepreneurs:', entrepreneurs.length);

    // Manually join sessions with users and entrepreneurs
    const joinedSessions = sessions.map(session => ({
      ...session,
      users: usersMap[session.mentor_id] || null,
      entrepreneurs: entrepreneursMap[session.entrepreneur_id] || null,
    }));

    // 9. PROCESS SESSION REPORTS DATA (CHRONOLOGICAL SESSION NUMBER DETECTION)
    const sessionReportsByMentor = {};
    const sessionsByMentee = {}; // Track sessions per mentee for chronological ordering

    // === DEBUGGING: RAW SESSION DATA ===
    console.log('\n=== DEBUGGING SESSION REPORTS ===');
    console.log('Total sessions fetched:', joinedSessions.length);
    if (joinedSessions.length > 0) {
      console.log('Sample session data:', JSON.stringify({
        id: joinedSessions[0]?.id,
        mentor_id: joinedSessions[0]?.mentor_id,
        entrepreneur_id: joinedSessions[0]?.entrepreneur_id,
        entrepreneur_name: joinedSessions[0]?.entrepreneurs?.name,
        cohort: joinedSessions[0]?.entrepreneurs?.cohort,
        mentor_email: joinedSessions[0]?.users?.email,
        session_date: joinedSessions[0]?.session_date,
        Status: joinedSessions[0]?.Status,
        status: joinedSessions[0]?.status,
      }, null, 2));
    }

    // Check status field variations
    const statusFields = joinedSessions.map(s => ({
      Status: s.Status,
      status: s.status,
      combined: s.Status || s.status
    }));
    console.log('Status field samples (first 5):', statusFields.slice(0, 5));

    const uniqueStatuses = [...new Set(joinedSessions.map(s => (s.Status || s.status || '').toLowerCase()))];
    console.log('Unique status values:', uniqueStatuses);

    // Helper function to find matching batch from mapping
    const findMatchingBatch = (sessionBatch, mentorEmail) => {
      if (!sessionBatch || !mentorEmail) return null;

      const mentorData = mentorMenteeMap[mentorEmail];
      if (!mentorData) return null;

      // Extract batch number from session batch (e.g., "Batch 4" -> "4")
      const batchNumberMatch = sessionBatch.match(/\d+/);
      if (!batchNumberMatch) return sessionBatch; // Return as-is if no number found

      const batchNumber = batchNumberMatch[0];

      // Find matching batch in mapping that contains this number
      const mappingBatches = Object.keys(mentorData.batches);
      const matchedBatch = mappingBatches.find(mappingBatch => {
        // Check if mapping batch contains the same batch number
        return mappingBatch.includes(`Batch ${batchNumber}`);
      });

      return matchedBatch || sessionBatch; // Return matched batch or original
    };

    // First, group all completed sessions by mentee
    joinedSessions.forEach((session) => {
      const entrepreneurId = session.entrepreneur_id;
      const entrepreneurName = session.entrepreneurs?.name;
      const sessionBatch = session.entrepreneurs?.cohort;
      const mentorEmail = session.users?.email?.toLowerCase().trim();
      const sessionDate = session.session_date;
      const sessionNumber = session.session_number; // Use actual session number from DB
      const status = (session.Status || session.status || '').toLowerCase();

      if (!entrepreneurId || !entrepreneurName || !mentorEmail || !sessionBatch) {
        console.log('⚠️ Skipping session - missing data:', {
          hasEntrepreneurId: !!entrepreneurId,
          hasEntrepreneurName: !!entrepreneurName,
          hasMentorEmail: !!mentorEmail,
          hasBatch: !!sessionBatch,
        });
        return;
      }

      // More flexible status matching
      const isCompleted =
        status.includes('seles') ||
        status.includes('complet') ||
        status.includes('done') ||
        status.includes('submit');

      // Check for MIA status
      const isMIA = status.includes('mia');

      if (!isCompleted) return;

      // Find matching batch from mapping sheet
      const batch = findMatchingBatch(sessionBatch, mentorEmail);

      // Group by mentee for chronological counting
      if (!sessionsByMentee[entrepreneurId]) {
        sessionsByMentee[entrepreneurId] = [];
      }

      sessionsByMentee[entrepreneurId].push({
        sessionDate,
        sessionNumber, // Add actual session number from DB
        entrepreneurName,
        batch,
        mentorEmail,
        isMIA,
        status,
      });
    });

    console.log('Sessions grouped by mentee:', Object.keys(sessionsByMentee).length, 'mentees with sessions');
    const beforeDedup = Object.values(sessionsByMentee).reduce((sum, sessions) => sum + sessions.length, 0);
    console.log('Before deduplication:', beforeDedup, 'total sessions');

    // Deduplicate sessions per mentee
    Object.keys(sessionsByMentee).forEach((entrepreneurId) => {
      const sessions = sessionsByMentee[entrepreneurId];

      // Create unique key: sessionNumber + batch + mentorEmail
      const uniqueSessions = new Map();

      sessions.forEach(session => {
        const uniqueKey = `${session.sessionNumber}-${session.batch}-${session.mentorEmail}`;

        if (!uniqueSessions.has(uniqueKey)) {
          // First occurrence - keep it
          uniqueSessions.set(uniqueKey, session);
        } else {
          // Duplicate found - keep the one with later session_date
          const existing = uniqueSessions.get(uniqueKey);
          const existingDate = new Date(existing.sessionDate);
          const newDate = new Date(session.sessionDate);

          // Keep whichever has a later timestamp (in case dates differ slightly)
          // If dates are same, just keep the first one
          if (newDate > existingDate) {
            uniqueSessions.set(uniqueKey, session);
          }
        }
      });

      // Replace with deduplicated sessions
      sessionsByMentee[entrepreneurId] = Array.from(uniqueSessions.values());
    });

    const afterDedup = Object.values(sessionsByMentee).reduce((sum, sessions) => sum + sessions.length, 0);
    console.log('After deduplication:', afterDedup, 'unique sessions');
    console.log('Duplicates removed:', beforeDedup - afterDedup);

    // Now, process each mentee's sessions using actual session numbers from DB
    Object.values(sessionsByMentee).forEach((menteeSessions) => {
      // Process each session using its actual session number
      menteeSessions.forEach((session) => {
        const sessionNumber = session.sessionNumber;

        // Skip if no session number or invalid
        if (!sessionNumber || sessionNumber < 1 || sessionNumber > 4) {
          console.log('⚠️ Skipping session - invalid session_number:', {
            entrepreneurName: session.entrepreneurName,
            sessionNumber,
            sessionDate: session.sessionDate,
          });
          return;
        }

        const key = `${session.mentorEmail}:${session.batch}`;
        if (!sessionReportsByMentor[key]) {
          sessionReportsByMentor[key] = {
            session1: new Set(),
            session2: new Set(),
            session3: new Set(),
            session4: new Set(),
            miaCount: 0,
          };
        }

        // Add to appropriate session set
        sessionReportsByMentor[key][`session${sessionNumber}`].add(
          session.entrepreneurName
        );

        // Track MIA
        if (session.isMIA) {
          sessionReportsByMentor[key].miaCount++;
        }
      });
    });

    console.log('Session Reports By Mentor - Keys:', Object.keys(sessionReportsByMentor));

    // === DEBUGGING: SPECIFIC MENTOR ===
    const debugEmail = 'naemmukhtar@gmail.com';
    console.log(`\n=== DEBUGGING MENTOR: ${debugEmail} ===`);
    const debugMentorSessions = joinedSessions.filter(s =>
      s.users?.email?.toLowerCase().trim() === debugEmail
    );
    console.log('Sessions for this mentor:', debugMentorSessions.length);
    console.log('Completed sessions for this mentor:', debugMentorSessions.filter(s => {
      const status = (s.Status || s.status || '').toLowerCase();
      return status.includes('seles') || status.includes('complet');
    }).length);
    console.log('Session numbers in data:', debugMentorSessions.map(s => ({
      name: s.entrepreneurs?.name,
      batch: s.entrepreneurs?.cohort,
      session_number: s.session_number,
      date: s.session_date,
    })));

    if (mentorMenteeMap[debugEmail]) {
      console.log('Mentor batches:', Object.keys(mentorMenteeMap[debugEmail].batches));
      console.log('Mentor mentees:', mentorMenteeMap[debugEmail].mentees);

      Object.keys(mentorMenteeMap[debugEmail].batches).forEach(batchName => {
        const key = `${debugEmail}:${batchName}`;
        console.log(`\nKey: "${key}"`);
        if (sessionReportsByMentor[key]) {
          console.log('Session data:', {
            session1: sessionReportsByMentor[key].session1.size,
            session2: sessionReportsByMentor[key].session2.size,
            session3: sessionReportsByMentor[key].session3.size,
            session4: sessionReportsByMentor[key].session4.size,
            session1Names: Array.from(sessionReportsByMentor[key].session1),
            session2Names: Array.from(sessionReportsByMentor[key].session2),
          });
        } else {
          console.log('❌ No session data found for this key!');
        }
      });
    }

    // Check batch name matching
    console.log('\n=== BATCH NAME MATCHING ===');
    const sessionsWithBatch = joinedSessions.filter(s => s.entrepreneurs?.cohort);
    const uniqueBatchesInSessions = [...new Set(sessionsWithBatch.map(s => s.entrepreneurs.cohort))];
    const uniqueBatchesInMapping = [...new Set(Object.values(mentorMenteeMap).flatMap(m => Object.keys(m.batches)))];
    console.log('Batches in sessions table:', uniqueBatchesInSessions);
    console.log('Batches in mapping sheet:', uniqueBatchesInMapping);

    console.log(`📝 Processed ${joinedSessions.length} session reports`);

    // 9. GET BATCH ROUNDS INFO
    const batchRounds = batchRoundsData?.data || [];
    const getBatchRound = (batchName) => {
      if (!batchRounds || batchRounds.length === 0) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const matchingRounds = batchRounds.filter((b) => {
        return (
          b.batch_name === batchName ||
          b.batch_name?.includes(batchName) ||
          batchName?.includes(b.batch_name)
        );
      });

      if (matchingRounds.length === 0) return null;

      // Find current round
      let currentRound = matchingRounds.find((b) => {
        const startDate = new Date(b.start_month);
        const endDate = new Date(b.end_month);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return today >= startDate && today <= endDate;
      });

      if (!currentRound) {
        currentRound = matchingRounds
          .filter((b) => new Date(b.start_month) > today)
          .sort((a, b) => new Date(a.start_month) - new Date(b.start_month))[0];
      }

      if (!currentRound) {
        currentRound = matchingRounds
          .filter((b) => new Date(b.end_month) < today)
          .sort((a, b) => new Date(b.end_month) - new Date(a.end_month))[0];
      }

      return currentRound
        ? {
            batch: currentRound.batch_name,
            round: currentRound.round_name,
            roundNumber: currentRound.round_number,
          }
        : null;
    };

    // 10. BUILD MENTOR PROGRESS DATA
    const mentors = Object.entries(mentorMenteeMap).map(([email, mentorData]) => {
      const batches = Object.entries(mentorData.batches).map(
        ([batchName, batchData]) => {
          const batchInfo = getBatchRound(batchName);
          const currentRound = batchInfo?.roundNumber || 1;
          const menteeCount = batchData.mentees.length;

          const umKey = `${email}:${batchName}`;
          const umData = umSubmissions[umKey] || {
            session2: new Set(),
            session4: new Set(),
          };
          const sessionData = sessionReportsByMentor[umKey] || {
            session1: new Set(),
            session2: new Set(),
            session3: new Set(),
            session4: new Set(),
            miaCount: 0,
          };

          // UM tracking
          const session2Required = currentRound >= 2;
          const session4Required = currentRound >= 4;

          const session2Submitted = umData.session2.size;
          const session2Pending = session2Required
            ? menteeCount - session2Submitted
            : 0;
          const session2PendingMentees = session2Required
            ? batchData.mentees
                .filter((m) => !umData.session2.has(m.name))
                .map((m) => m.name)
            : [];

          const session4Submitted = umData.session4.size;
          const session4Pending = session4Required
            ? menteeCount - session4Submitted
            : 0;
          const session4PendingMentees = session4Required
            ? batchData.mentees
                .filter((m) => !umData.session4.has(m.name))
                .map((m) => m.name)
            : [];

          // Session reports tracking
          const totalUMRequired =
            (session2Required ? menteeCount : 0) +
            (session4Required ? menteeCount : 0);
          const totalUMSubmitted = session2Submitted + session4Submitted;

          const totalReportsRequired = menteeCount * 4; // 4 sessions per mentee
          const totalReportsSubmitted =
            sessionData.session1.size +
            sessionData.session2.size +
            sessionData.session3.size +
            sessionData.session4.size;

          return {
            batchName,
            currentRound,
            menteeCount,
            miaCount: sessionData.miaCount,
            upwardMobility: {
              session2Required,
              session2: {
                required: session2Required ? menteeCount : 0,
                submitted: session2Submitted,
                pending: session2Pending,
                pendingMentees: session2PendingMentees,
              },
              session4Required,
              session4: {
                required: session4Required ? menteeCount : 0,
                submitted: session4Submitted,
                pending: session4Pending,
                pendingMentees: session4PendingMentees,
              },
            },
            sessionReports: {
              session1: {
                required: menteeCount,
                submitted: sessionData.session1.size,
                pending: menteeCount - sessionData.session1.size,
              },
              session2: {
                required: menteeCount,
                submitted: sessionData.session2.size,
                pending: menteeCount - sessionData.session2.size,
              },
              session3: {
                required: menteeCount,
                submitted: sessionData.session3.size,
                pending: menteeCount - sessionData.session3.size,
              },
              session4: {
                required: menteeCount,
                submitted: sessionData.session4.size,
                pending: menteeCount - sessionData.session4.size,
              },
            },
            overallProgress: {
              totalRequired: totalReportsRequired,
              totalSubmitted: totalReportsSubmitted,
              percentComplete:
                totalReportsRequired > 0
                  ? Math.round(
                      (totalReportsSubmitted / totalReportsRequired) * 100
                    )
                  : 0,
            },
            totalUMRequired,
            totalUMSubmitted,
          };
        }
      );

      // Calculate mentor-level totals
      const totalMentees = mentorData.mentees.length;
      const totalUMRequired = batches.reduce(
        (sum, b) => sum + b.totalUMRequired,
        0
      );
      const totalUMSubmitted = batches.reduce(
        (sum, b) => sum + b.totalUMSubmitted,
        0
      );
      const totalReportsRequired = batches.reduce(
        (sum, b) => sum + b.overallProgress.totalRequired,
        0
      );
      const totalReportsSubmitted = batches.reduce(
        (sum, b) => sum + b.overallProgress.totalSubmitted,
        0
      );

      const umCompletionRate =
        totalUMRequired > 0
          ? Math.round((totalUMSubmitted / totalUMRequired) * 100)
          : 0;
      const reportCompletionRate =
        totalReportsRequired > 0
          ? Math.round((totalReportsSubmitted / totalReportsRequired) * 100)
          : 0;

      return {
        mentorEmail: email,
        mentorName: mentorData.mentorName,
        totalMentees,
        batches,
        totalUMRequired,
        totalUMSubmitted,
        umCompletionRate,
        totalReportsRequired,
        totalReportsSubmitted,
        reportCompletionRate,
      };
    });

    // Sort mentors by name
    mentors.sort((a, b) => a.mentorName.localeCompare(b.mentorName));

    // 11. CALCULATE SYSTEM-WIDE SUMMARY
    const summary = {
      totalMentors: mentors.length,
      totalMentees: mentors.reduce((sum, m) => sum + m.totalMentees, 0),
      totalUMFormsRequired: mentors.reduce(
        (sum, m) => sum + m.totalUMRequired,
        0
      ),
      totalUMFormsSubmitted: mentors.reduce(
        (sum, m) => sum + m.totalUMSubmitted,
        0
      ),
      umCompletionRate: 0,
      totalSessionReportsRequired: mentors.reduce(
        (sum, m) => sum + m.totalReportsRequired,
        0
      ),
      totalSessionReportsSubmitted: mentors.reduce(
        (sum, m) => sum + m.totalReportsSubmitted,
        0
      ),
      sessionReportCompletionRate: 0,
      mentorsAtRisk: 0,
      mentorsOnTrack: 0,
    };

    summary.umCompletionRate =
      summary.totalUMFormsRequired > 0
        ? Math.round(
            (summary.totalUMFormsSubmitted / summary.totalUMFormsRequired) * 100
          )
        : 0;

    summary.sessionReportCompletionRate =
      summary.totalSessionReportsRequired > 0
        ? Math.round(
            (summary.totalSessionReportsSubmitted /
              summary.totalSessionReportsRequired) *
              100
          )
        : 0;

    // Calculate overall completion per mentor (average of UM and reports)
    mentors.forEach((mentor) => {
      const overallCompletion =
        (mentor.umCompletionRate + mentor.reportCompletionRate) / 2;
      if (overallCompletion < 50) {
        summary.mentorsAtRisk++;
      } else {
        summary.mentorsOnTrack++;
      }
    });

    // 12. PREPARE RESPONSE
    const responseData = {
      success: true,
      mentors,
      summary,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
      cached: false,
    };

    // Update cache
    cache.data = responseData;
    cache.timestamp = Date.now();

    console.log('✅ Data fetched and cached successfully');

    // 13. RETURN RESPONSE
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Admin mentor progress error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch mentor progress',
      details: error.message,
    });
  }
}
