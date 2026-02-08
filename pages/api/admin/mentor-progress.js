// pages/api/admin/mentor-progress.js
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { validateSequentialSessions } from '../../../lib/mentorUtils';

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

// Helper to calculate due date
const calculateDueDate = (endMonthStr) => {
  if (!endMonthStr) return null;
  const dateParts = endMonthStr.split('-');
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]);
  if (!year || !month) return null;
  return new Date(year, month, 0);
};

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
    // New Data Sources
    let bangkitData = null;
    let majuData = null;

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

    if (sheets) {
      // A. Fetch Mapping
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

      // B. Fetch UM Data
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

      // C. Fetch Bangkit Reports
      if (process.env.GOOGLE_SHEETS_REPORT_ID) {
        fetchPromises.push(
          sheets.spreadsheets.values
            .get({
              spreadsheetId: process.env.GOOGLE_SHEETS_REPORT_ID,
              range: `${process.env.Bangkit_TAB || 'Bangkit'}!A:K`, // Fetch A-K (enough for Email, Status, Mentee)
            })
            .then((data) => {
              bangkitData = data;
              console.log('✅ Bangkit reports fetched');
            })
            .catch((error) => {
              console.error('❌ Bangkit fetch failed:', error);
              // Non-critical if separate ID used
            })
        );
      }

      // D. Fetch Maju Reports
      const majuId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
      if (majuId) {
        fetchPromises.push(
          sheets.spreadsheets.values
            .get({
              spreadsheetId: majuId,
              range: 'laporanmajuum!A:AC', // Updated tab name per user request
            })
            .then((data) => {
              majuData = data;
              console.log('✅ Maju reports fetched');
            })
            .catch((error) => {
              console.error('❌ Maju fetch failed:', error);
            })
        );
      }
    }

    // E. Fetch Batch Rounds (Supabase)
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

    /* 
    // F. Fetch Reports (Supabase) - FUTURE USE / VERIFICATION ONLY
    // We are deliberately bypassing this for now as per user request to rely on Sheets.
    // Also corrected table name from 'sessions' to 'reports'.
    fetchPromises.push(
      supabase
        .from('reports') 
        .select('id, created_at')
        .limit(1) // Just a connectivity check
        .then(() => console.log('✅ DB Connectivity Check (Reports table) Passed'))
        .catch(err => console.warn('⚠️ DB Check Failed:', err.message))
    );
    */

    await Promise.all(fetchPromises);

    // Check critical data
    if (!mappingData || !mappingData.data || !mappingData.data.values) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch mapping data - cannot generate report',
        errors,
      });
    }

    // 6. PROCESS MAPPING DATA
    const mappingRows = mappingData.data.values || [];
    // Group mentees by mentor
    const mentorMenteeMap = {};
    // Lookup map to find Batch by Mentee Name + Mentor Email
    const menteeBatchLookup = {};

    mappingRows.slice(1).forEach((row) => {
      const mentorEmail = (row[3] || '').toLowerCase().trim();
      const mentorName = row[2] || '';
      const batch = row[0] || '';
      const menteeName = (row[4] || '').trim();
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

      if (!mentorMenteeMap[mentorEmail].mentees.includes(menteeName)) {
        mentorMenteeMap[mentorEmail].mentees.push(menteeName);
      }

      // Build lookup
      const lookupKey = `${mentorEmail}:${menteeName.toLowerCase()}`;
      menteeBatchLookup[lookupKey] = batch;
    });

    console.log(`📊 Processed ${Object.keys(mentorMenteeMap).length} mentors from mapping`);

    // 7. PROCESS UM DATA
    const umRows = umData?.data?.values || [];
    const umSubmissions = {};

    if (umRows.length > 1) {
      umRows.slice(1).forEach((row) => {
        const mentorEmail = (row[1] || '').toLowerCase().trim();
        const batch = row[3] || '';
        const session = row[4] || '';
        const entrepreneur = row[6] || '';
        const sessionNum = session.match(/\d+/)?.[0];

        if (!mentorEmail || !sessionNum || !entrepreneur) return;

        const key = `${mentorEmail}:${batch}`;
        if (!umSubmissions[key]) {
          umSubmissions[key] = {
            session1: new Set(),
            session2: new Set(),
            session3: new Set(),
            session4: new Set(),
          };
        }

        // Store submission for relevant session
        if (sessionNum >= 1 && sessionNum <= 4) {
          umSubmissions[key][`session${sessionNum}`].add(entrepreneur);
        }
      });
    }

    // 8. SESSION DATA AGGREGATION & NORMALIZATION
    // Build a map of Mentee -> Session History for validation
    // Key: "mentorEmail:menteeName" (normalized)
    const sessionsByMentee = {};

    const addSession = (mentorEmail, menteeName, sessionData) => {
      const key = `${mentorEmail.toLowerCase().trim()}:${menteeName.trim().toLowerCase()}`;
      if (!sessionsByMentee[key]) sessionsByMentee[key] = [];
      sessionsByMentee[key].push(sessionData);
    };

    // Process Bangkit
    if (bangkitData?.data?.values?.length > 1) {
      const bRows = bangkitData.data.values;
      // Headers: A=Timestamp, B=Email, C=StatusSesi, D=SesiLaporan, ... G=TarikhSesi, H=NamaUsahawan
      bRows.slice(1).forEach(row => {
        const mentorEmail = (row[1] || '').toLowerCase().trim();
        const status = (row[2] || '').trim();
        const sessionStr = row[3] || '';
        const sessionDate = row[6] || ''; // G
        const menteeName = (row[7] || '').trim(); // H

        if (!mentorEmail || !menteeName) return;

        // Parse session number
        let sessionNum = 0;
        const match = sessionStr.match(/\d+/);
        if (match) sessionNum = parseInt(match[0]);

        addSession(mentorEmail, menteeName, {
          calculatedSessionNumber: sessionNum,
          status: status,
          sessionDate: sessionDate, // Keep as string or parse if needed
          programType: 'bangkit'
        });
      });
    }

    // Process Maju
    if (majuData?.data?.values?.length > 1) {
      const mRows = majuData.data.values;
      // Headers: A=Time, B=NameMentor, C=EmailMentor, D=NameMentee, ... J(9)=SesiNum, ... N(13)=TarikhSesi, ... AC(28)=MIA_Status
      mRows.slice(1).forEach(row => {
        const mentorEmail = (row[2] || '').toLowerCase().trim();
        const menteeName = (row[3] || '').trim();
        const sessionNumStr = row[9] || '0';
        const sessionDate = row[13] || '';
        const miaStatus = (row[28] || 'Tidak').trim();

        if (!mentorEmail || !menteeName) return;

        addSession(mentorEmail, menteeName, {
          calculatedSessionNumber: parseInt(sessionNumStr) || 0,
          status: miaStatus, // specialized check in validator
          sessionDate: sessionDate,
          programType: 'maju'
        });
      });
    }

    // 9. No longer specific aggregation here, moved to main loop similar to logic in 11



    // 10. GET BATCH ROUNDS & SMART REQUIREMENTS
    const batchRounds = batchRoundsData?.data || [];

    // Helper to get current Batch Round Info
    const getBatchInfo = (batchName) => {
      if (!batchRounds.length) return { currentRound: 1, roundStartDate: new Date() }; // Default

      const today = new Date();
      const rounds = batchRounds
        .filter(b => {
          if (!b.batch_name || !batchName) return false;
          return batchName.includes(b.batch_name) || b.batch_name.includes(batchName);
        })
        .sort((a, b) => new Date(a.start_month) - new Date(b.start_month));

      if (!rounds.length) return { currentRound: 1, roundStartDate: new Date() };

      // Determine current round based on date
      let current = rounds.find(r => {
        const start = new Date(r.start_month);
        const end = new Date(r.end_month);
        return today >= start && today <= end;
      });

      // If not in a round, check if before first or after last
      if (!current) {
        if (today < new Date(rounds[0].start_month)) current = rounds[0]; // Future
        else current = rounds[rounds.length - 1]; // Past/Finished
      }

      return {
        currentRound: current.round_number,
        currentRoundStart: new Date(current.start_month),
        currentRoundEnd: current.end_month
      };
    };


    // 11. BUILD FINAL DATA with STATUS ROLLUP
    const mentors = Object.entries(mentorMenteeMap).map(([email, mentorData]) => {
      let mentorCriticalCount = 0;
      let mentorAtRiskCount = 0;
      let mentorOnTrackCount = 0;

      const batches = Object.entries(mentorData.batches).map(
        ([batchName, batchData]) => {

          const { currentRound, currentRoundStart, currentRoundEnd } = getBatchInfo(batchName);
          const menteeCount = batchData.mentees.length;

          // Calculate due date
          let roundDueDate = calculateDueDate(currentRoundEnd);

          // Aggregates for this batch
          let batchMIACount = 0;
          let batchAtRiskCount = 0; // Sequence Broken, Overdue, Never Started

          const umKey = `${email}:${batchName}`;
          const um = umSubmissions[umKey] || {
            session1: new Set(), session2: new Set(), session3: new Set(), session4: new Set()
          };

          // Process Mentees in this batch
          const menteeStatuses = batchData.mentees.map(mentee => {
            const key = `${email}:${mentee.name.toLowerCase()}`;
            const history = sessionsByMentee[key] || [];

            // Sort by date/session
            history.sort((a, b) => a.calculatedSessionNumber - b.calculatedSessionNumber);

            // --- COMBINED FORM LOGIC ---
            // For newer batches, Report Submission IMPLIES UM Submission.
            // If report is done, we mark UM as done if not already.

            // Helper to parse batch number
            const getBatchNum = (bName) => {
              const match = bName.match(/Batch\s*(\d+)/i);
              return match ? parseInt(match[1]) : 0;
            };
            const batchNum = getBatchNum(batchName);
            const isBangkit = batchName.toLowerCase().includes('bangkit');
            const isMaju = batchName.toLowerCase().includes('maju');

            history.forEach(session => {
              if (session.status === 'Selesai' || session.status === 'Tidak') {
                const sNum = session.calculatedSessionNumber;
                let isCombined = false;

                // Bangkit Rules
                if (isBangkit) {
                  if (batchNum >= 6) isCombined = true; // Batch 6, 7+ combined
                  else if (batchNum === 5 && sNum >= 2) isCombined = true; // Batch 5 Sesi 2+ combined
                }

                // Maju Rules
                if (isMaju) {
                  if (batchNum >= 5) isCombined = true; // Batch 5, 6+ combined
                  else if (batchNum === 4 && sNum >= 2) isCombined = true; // Batch 4 Sesi 2+ combined
                }

                if (isCombined && sNum >= 1 && sNum <= 4) {
                  um[`session${sNum}`].add(mentee.name);
                }
              }
            });

            const validation = validateSequentialSessions(
              history,
              currentRound,
              roundDueDate
            );

            // Map status to risk level
            if (validation.status === 'mia') {
              batchMIACount++;
              mentorCriticalCount++;
            } else if (['sequence_broken', 'never_started', 'overdue'].includes(validation.status)) {
              batchAtRiskCount++;
              mentorAtRiskCount++;
            } else {
              mentorOnTrackCount++;
            }

            return {
              name: mentee.name,
              status: validation.status,
              submitted: validation.submittedSessions
            };
          });

          // Determine Batch Status
          let batchStatus = 'on_track';
          if (batchMIACount > 0) batchStatus = 'critical';
          else if (batchAtRiskCount > 0) batchStatus = 'at_risk';

          // --- LEGACY METRICS FOR UI COMPATIBILITY ---
          const totalUMRequired = (menteeCount * currentRound);
          // Previous: (menteeCount * 4) - Updated to follow current round progress like reports

          const totalUMSubmitted =
            um.session1.size + um.session2.size + um.session3.size + um.session4.size;

          const totalReportsSubmitted = menteeStatuses.reduce((acc, m) => acc + m.submitted.length, 0);
          const totalReportsRequired = (menteeCount * currentRound); // Approx logic

          const percentComplete = totalReportsRequired > 0
            ? Math.round((totalReportsSubmitted / totalReportsRequired) * 100)
            : 0;

          return {
            batchName,
            currentRound,
            menteeCount,
            miaCount: batchMIACount,
            status: batchStatus, // NEW
            upwardMobility: {
              // UI expects these for breakdown
              session1: {
                submitted: um.session1.size,
                required: currentRound >= 1 ? menteeCount : 0,
                pending: currentRound >= 1 ? Math.max(0, menteeCount - um.session1.size) : 0,
                pendingMentees: []
              },
              session2: {
                submitted: um.session2.size,
                required: currentRound >= 2 ? menteeCount : 0,
                pending: currentRound >= 2 ? Math.max(0, menteeCount - um.session2.size) : 0,
                pendingMentees: []
              },
              session3: {
                submitted: um.session3.size,
                required: currentRound >= 3 ? menteeCount : 0,
                pending: currentRound >= 3 ? Math.max(0, menteeCount - um.session3.size) : 0,
                pendingMentees: []
              },
              session4: {
                submitted: um.session4.size,
                required: currentRound >= 4 ? menteeCount : 0,
                pending: currentRound >= 4 ? Math.max(0, menteeCount - um.session4.size) : 0,
                pendingMentees: []
              },
            },
            sessionReports: {
              session1: {
                submitted: menteeStatuses.filter(m => m.submitted.includes(1)).length,
                required: currentRound >= 1 ? menteeCount : 0,
                pending: currentRound >= 1 ? menteeCount - menteeStatuses.filter(m => m.submitted.includes(1)).length : 0
              },
              session2: {
                submitted: menteeStatuses.filter(m => m.submitted.includes(2)).length,
                required: currentRound >= 2 ? menteeCount : 0,
                pending: currentRound >= 2 ? menteeCount - menteeStatuses.filter(m => m.submitted.includes(2)).length : 0
              },
              session3: {
                submitted: menteeStatuses.filter(m => m.submitted.includes(3)).length,
                required: currentRound >= 3 ? menteeCount : 0,
                pending: currentRound >= 3 ? menteeCount - menteeStatuses.filter(m => m.submitted.includes(3)).length : 0
              },
              session4: {
                submitted: menteeStatuses.filter(m => m.submitted.includes(4)).length,
                required: currentRound >= 4 ? menteeCount : 0,
                pending: currentRound >= 4 ? menteeCount - menteeStatuses.filter(m => m.submitted.includes(4)).length : 0
              },
            },
            overallProgress: {
              totalRequired: totalReportsRequired,
              totalSubmitted: totalReportsSubmitted,
              percentComplete: percentComplete,
            },
            totalUMRequired, // Simplified
            totalUMSubmitted,
          };
        }
      );

      // Mentor totals
      const totalMentees = mentorData.mentees.length;

      // MENTOR STATUS ROLLUP
      let mentorStatus = 'on_track';
      if (mentorCriticalCount > 0) mentorStatus = 'critical';
      else if (mentorAtRiskCount > 0) mentorStatus = 'at_risk';

      const umCompletionRate = batches.reduce((acc, b) => acc + b.totalUMSubmitted, 0) > 0 ? 50 : 0; // Dummy calc for now
      // Actually let's try to preserve some reasonable numbers
      const totalUM = batches.reduce((acc, b) => acc + b.totalUMSubmitted, 0);
      const totalRep = batches.reduce((acc, b) => acc + b.overallProgress.totalSubmitted, 0);

      const totalUMReq = batches.reduce((acc, b) => acc + b.totalUMRequired, 0);
      const totalRepReq = batches.reduce((acc, b) => acc + b.overallProgress.totalRequired, 0);

      return {
        mentorEmail: email,
        mentorName: mentorData.mentorName,
        totalMentees,
        batches,
        status: mentorStatus, // NEW

        // Legacy fields for sorting/display
        umCompletionRate: 0, // Placeholder
        reportCompletionRate: 0, // Placeholder
        totalUMSubmitted: totalUM,
        totalReportsSubmitted: totalRep,
        totalUMRequired: totalUMReq, // Updated to use batch sum
        totalReportsRequired: totalRepReq // Updated to use batch sum
      };
    });

    mentors.sort((a, b) => a.mentorName.localeCompare(b.mentorName));

    const summary = {
      totalMentors: mentors.length,
      totalMentees: mentors.reduce((sum, m) => sum + m.totalMentees, 0),
      totalUMFormsRequired: mentors.reduce((sum, m) => sum + m.totalUMRequired, 0),
      totalUMFormsSubmitted: mentors.reduce((sum, m) => sum + m.totalUMSubmitted, 0),
      // Recalc average rates
      umCompletionRate: 0,
      sessionReportCompletionRate: 0,
      totalSessionReportsSubmitted: mentors.reduce((sum, m) => sum + m.totalReportsSubmitted, 0),
      totalSessionReportsRequired: mentors.reduce((sum, m) => sum + m.totalReportsRequired, 0),
      mentorsAtRisk: mentors.filter(m => m.status === 'at_risk' || m.status === 'critical').length,
      mentorsOnTrack: mentors.filter(m => m.status === 'on_track').length,
    };

    if (summary.totalUMFormsRequired > 0) {
      summary.umCompletionRate = Math.round((summary.totalUMFormsSubmitted / summary.totalUMFormsRequired) * 100);
    }
    else { summary.umCompletionRate = 100; } // Default if nothing required

    if (summary.totalSessionReportsRequired > 0) {
      summary.sessionReportCompletionRate = Math.round((summary.totalSessionReportsSubmitted / summary.totalSessionReportsRequired) * 100);
    }
    else { summary.sessionReportCompletionRate = 100; } // Default if nothing required

    const response = {
      success: true,
      summary,
      mentors,
      cached: false,
      lastUpdated: new Date().toISOString(),
    };

    // Update Cache
    cache = {
      data: response,
      timestamp: Date.now()
    };

    return res.status(200).json(response);

  } catch (err) {
    console.error('❌ API Error:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
