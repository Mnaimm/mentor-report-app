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
              range: 'LaporanMaju!A:AC', // Need up to AC for MIA status
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

    // 8. COMBINE BANGKIT AND MAJU DATA INTO A UNIFIED SESSION LIST
    const unifiedSessions = [];

    // Process Bangkit
    if (bangkitData?.data?.values?.length > 1) {
      const bRows = bangkitData.data.values;
      console.log(`Processing ${bRows.length - 1} Bangkit rows...`);
      // Headers: A=Timestamp, B=Email, C=StatusSesi, D=SesiLaporan, ... H=NamaUsahawan
      bRows.slice(1).forEach(row => {
        const mentorEmail = (row[1] || '').toLowerCase().trim();
        const status = (row[2] || '').toLowerCase(); // 'Selesai' or 'MIA'
        const sessionStr = row[3] || ''; // 'Sesi #1'
        const sessionNum = sessionStr.match(/\d+/)?.[0];
        const menteeName = (row[7] || '').trim(); // Column H (index 7) - Verify if header changed? assuming H is name

        if (!mentorEmail || !menteeName) return;

        const isMIA = status.includes('mia');
        const isCompleted = status.includes('seles') || status.includes('done') || status.includes('complet');

        if (isCompleted || isMIA) {
          unifiedSessions.push({
            mentorEmail,
            menteeName,
            sessionNumber: sessionNum,
            isMIA,
            source: 'Bangkit'
          });
        }
      });
    }

    // Process Maju
    if (majuData?.data?.values?.length > 1) {
      const mRows = majuData.data.values;
      console.log(`Processing ${mRows.length - 1} Maju rows...`);
      // Headers: A=Time, B=NameMentor, C=EmailMentor, D=NameMentee, ... J(9)=SesiNum, ... AC(28)=MIA_Status
      mRows.slice(1).forEach(row => {
        const mentorEmail = (row[2] || '').toLowerCase().trim(); // C
        const menteeName = (row[3] || '').trim(); // D
        const sessionNum = row[9] || ''; // J
        const miaStatus = (row[28] || '').toLowerCase(); // AC

        if (!mentorEmail || !menteeName) return;

        const isMIA = miaStatus.includes('mia');
        // Maju default behavior: If in sheet, it's submitted
        unifiedSessions.push({
          mentorEmail,
          menteeName,
          sessionNumber: sessionNum,
          isMIA,
          source: 'Maju'
        });
      });
    }

    // 9. AGGREGATE SESSIONS BY MENTOR
    const sessionReportsByMentor = {};

    unifiedSessions.forEach(session => {
      if (!session.sessionNumber) return;

      // Lookup Batch
      const lookupKey = `${session.mentorEmail}:${session.menteeName.toLowerCase()}`;
      const batch = menteeBatchLookup[lookupKey];

      if (!batch) {
        // console.warn(`No batch found for ${session.menteeName} (${session.mentorEmail})`);
        return;
      }

      const key = `${session.mentorEmail}:${batch}`;
      if (!sessionReportsByMentor[key]) {
        sessionReportsByMentor[key] = {
          session1: new Set(),
          session2: new Set(),
          session3: new Set(),
          session4: new Set(),
          miaCount: 0,
        };
      }

      // Add to Set (deduplication handled by Set)
      if (session.sessionNumber >= 1 && session.sessionNumber <= 4) {
        sessionReportsByMentor[key][`session${session.sessionNumber}`].add(session.menteeName);
      }

      if (session.isMIA) {
        sessionReportsByMentor[key].miaCount++;
      }
    });


    // 10. GET BATCH ROUNDS & SMART REQUIREMENTS
    const batchRounds = batchRoundsData?.data || [];

    // Helper to get current Batch Round Info
    const getBatchInfo = (batchName) => {
      if (!batchRounds.length) return { currentRound: 1, roundStartDate: new Date() }; // Default

      const today = new Date();
      const rounds = batchRounds
        .filter(b => batchName.includes(b.batch_name) || b.batch_name.includes(batchName))
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
        currentRoundStart: new Date(current.start_month)
      };
    };


    // 11. BUILD FINAL DATA
    const mentors = Object.entries(mentorMenteeMap).map(([email, mentorData]) => {
      const batches = Object.entries(mentorData.batches).map(
        ([batchName, batchData]) => {

          const { currentRound } = getBatchInfo(batchName);
          const menteeCount = batchData.mentees.length;

          const key = `${email}:${batchName}`;
          const um = umSubmissions[key] || {
            session1: new Set(), session2: new Set(), session3: new Set(), session4: new Set()
          };
          const reports = sessionReportsByMentor[key] || {
            session1: new Set(), session2: new Set(), session3: new Set(), session4: new Set(), miaCount: 0
          };

          // --- SMART REQUIREMENT LOGIC (STRICT) ---
          // Reuse common logic for both UM and Reports
          // If session > currentRound (Future) -> Required = 0
          // If session <= currentRound (Past or Current) -> Required = Mentee Count

          const calcRequirements = (sessionNum, submittedSet) => {
            const submittedCount = submittedSet.size;
            let required = menteeCount;

            if (sessionNum > currentRound) {
              required = 0; // Future: Not required yet
            }
            // Else (Past or Current) -> Required is Mentee Count. STRICT.

            return {
              required,
              submitted: submittedCount,
              pending: Math.max(0, required - submittedCount),
            };
          };

          const um1 = calcRequirements(1, um.session1);
          const um2 = calcRequirements(2, um.session2);
          const um3 = calcRequirements(3, um.session3);
          const um4 = calcRequirements(4, um.session4);

          const r1 = calcRequirements(1, reports.session1);
          const r2 = calcRequirements(2, reports.session2);
          const r3 = calcRequirements(3, reports.session3);
          const r4 = calcRequirements(4, reports.session4);

          // Total UM Required
          const totalUMRequired = um1.required + um2.required + um3.required + um4.required;
          const totalUMSubmitted = um1.submitted + um2.submitted + um3.submitted + um4.submitted;

          // Total Reports Required
          const totalReportsRequired = r1.required + r2.required + r3.required + r4.required;
          const totalReportsSubmitted = r1.submitted + r2.submitted + r3.submitted + r4.submitted;

          // Helper for pending UM mentees (only for current/active) (and reports!)
          const getPendingMentees = (sessionNum, submittedSet) => {
            if (sessionNum > currentRound) return []; // Future
            // For Past/Current, show pending
            return batchData.mentees
              .filter(m => !submittedSet.has(m.name))
              .map(m => m.name);
          };

          return {
            batchName,
            currentRound,
            menteeCount,
            miaCount: reports.miaCount,
            upwardMobility: {
              session1: { ...um1, pendingMentees: getPendingMentees(1, um.session1) },
              session2: { ...um2, pendingMentees: getPendingMentees(2, um.session2) },
              session3: { ...um3, pendingMentees: getPendingMentees(3, um.session3) },
              session4: { ...um4, pendingMentees: getPendingMentees(4, um.session4) },
              session1Required: um1.required > 0,
              session2Required: um2.required > 0,
              session3Required: um3.required > 0,
              session4Required: um4.required > 0,
            },
            sessionReports: {
              session1: { ...r1, pendingMentees: getPendingMentees(1, reports.session1) },
              session2: { ...r2, pendingMentees: getPendingMentees(2, reports.session2) },
              session3: { ...r3, pendingMentees: getPendingMentees(3, reports.session3) },
              session4: { ...r4, pendingMentees: getPendingMentees(4, reports.session4) },
            },
            overallProgress: {
              totalRequired: totalReportsRequired,
              totalSubmitted: totalReportsSubmitted,
              percentComplete: totalReportsRequired > 0
                ? Math.round((totalReportsSubmitted / totalReportsRequired) * 100)
                : 0,
            },
            totalUMRequired,
            totalUMSubmitted,
          };
        }
      );

      // Mentor totals
      const totalMentees = mentorData.mentees.length;
      const totalUMRequired = batches.reduce((s, b) => s + b.totalUMRequired, 0);
      const totalUMSubmitted = batches.reduce((s, b) => s + b.totalUMSubmitted, 0);
      const totalReportsRequired = batches.reduce((s, b) => s + b.overallProgress.totalRequired, 0);
      const totalReportsSubmitted = batches.reduce((s, b) => s + b.overallProgress.totalSubmitted, 0);

      const umCompletionRate = totalUMRequired > 0 ? Math.round((totalUMSubmitted / totalUMRequired) * 100) : 0;
      const reportCompletionRate = totalReportsRequired > 0 ? Math.round((totalReportsSubmitted / totalReportsRequired) * 100) : 0;

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
      mentorsAtRisk: mentors.filter(m => (m.umCompletionRate + m.reportCompletionRate) / 2 < 50).length,
      mentorsOnTrack: mentors.filter(m => (m.umCompletionRate + m.reportCompletionRate) / 2 >= 50).length,
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
