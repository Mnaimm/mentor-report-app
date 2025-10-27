// pages/api/mentor-stats.js
import { getSheetsClient } from '../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import cache from '../../lib/simple-cache';
import { getEffectiveUserEmail, canImpersonate } from '../../lib/impersonation';

export default async function handler(req, res) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substr(2, 9)
  };

  console.log(`🔄 [${debugInfo.requestId}] mentor-stats API called at ${debugInfo.timestamp}`);

  try {
    // 1) require login
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log(`❌ [${debugInfo.requestId}] Unauthorized access attempt`);
      return res.status(401).json({ error: "Unauthorized" });
    }
    const realUserEmail = session.user.email.toLowerCase().trim();
    const effectiveUserEmail = getEffectiveUserEmail(req, session);
    const isImpersonating = realUserEmail !== effectiveUserEmail;

    console.log(`👤 [${debugInfo.requestId}] Processing request:`);
    console.log(`  Real user: ${realUserEmail}`);
    console.log(`  Effective user: ${effectiveUserEmail}`);
    console.log(`  Impersonating: ${isImpersonating ? 'Yes' : 'No'}`);

    // Security check: only allow impersonation for super admin
    if (isImpersonating && !canImpersonate(realUserEmail)) {
      console.log(`❌ [${debugInfo.requestId}] Unauthorized impersonation attempt by: ${realUserEmail}`);
      return res.status(403).json({ error: "Unauthorized impersonation attempt" });
    }

    const loginEmail = effectiveUserEmail;

    // Cache key for this mentor's stats (include impersonation context)
    const cacheKey = `mentor-stats:${loginEmail}${isImpersonating ? ':impersonated' : ''}`;

    // Try to get from cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`⚡ [${debugInfo.requestId}] Returning cached data for ${loginEmail}`);
      return res.json({
        ...cachedData,
        debug: {
          ...debugInfo,
          fromCache: true,
          originalTimestamp: cachedData.debug?.timestamp,
          cacheAge: Date.now() - new Date(cachedData.debug?.timestamp || 0).getTime(),
          impersonation: {
            isImpersonating,
            realUser: realUserEmail,
            effectiveUser: effectiveUserEmail
          }
        }
      });
    }

    console.log(`📊 [${debugInfo.requestId}] Fetching data from Google Sheets...`);
    const sheetsStartTime = Date.now();

    const client = await getSheetsClient();
    const mappingSheet = await client.getRows('mapping');
    const bangkitSheet = await client.getRows('V8');
    const batchSheet = await client.getRows('batch');

    // Read Maju reports sheet
    let majuSheet = [];
    try {
      majuSheet = await client.getRows('LaporanMaju');
    } catch (e) {
      console.warn(`⚠️ [${debugInfo.requestId}] LaporanMaju sheet not found, skipping Maju reports`);
    }

    const sheetsEndTime = Date.now();
    console.log(`⏱️ [${debugInfo.requestId}] Google Sheets data fetched in ${sheetsEndTime - sheetsStartTime}ms`);
    console.log(`📋 [${debugInfo.requestId}] Data counts: mapping=${mappingSheet.length}, bangkit=${bangkitSheet.length}, maju=${majuSheet.length}, batches=${batchSheet.length}`);

    // 2) Find mentor's batch and current round info
    const mentorMappings = mappingSheet.filter(row => {
      const email = (row['Mentor_Email'] || row['Email'] || '').toLowerCase().trim();
      return email === loginEmail;
    });

    console.log(`🔍 [${debugInfo.requestId}] Found ${mentorMappings.length} mapping rows for ${loginEmail}`);
    if (mentorMappings.length > 0) {
      const batches = [...new Set(mentorMappings.map(r => r['Batch']).filter(Boolean))];
      console.log(`📦 [${debugInfo.requestId}] Mentor's batches:`, batches);
    }

    if (mentorMappings.length === 0) {
      console.log(`⚠️ [${debugInfo.requestId}] No mentees found for ${loginEmail}`);
      console.log(`   Available emails in mapping (first 5):`,
        [...new Set(mappingSheet.map(r => (r['Mentor_Email'] || r['Email'] || '').toLowerCase().trim()).filter(Boolean))].slice(0, 5)
      );
      return res.json({
        mentorEmail: loginEmail,
        error: "No mentees found for this mentor",
        totalMentees: 0,
        currentRound: null,
        currentRoundStats: { reportedThisRound: 0, pendingThisRound: 0, miaThisRound: 0, perMenteeSessions: {} },
        allTime: { totalReports: 0, uniqueMenteesReported: 0, miaCount: 0, perMenteeSessions: {} },
        menteesByBatch: {},
        sessionsByBatch: {},
        miaByBatch: {}
      });
    }

    // Get mentor's batch info
    const mentorBatch = mentorMappings[0]['Batch'];
    const batchInfo = batchSheet.find(b => b['Batch'] === mentorBatch);
    
    let currentRound = null;
    if (batchInfo) {
      const roundLabel = batchInfo['Mentoring Round'] || 'Round 1';
      const period = batchInfo['Period'] || '';
      const roundMatch = roundLabel.match(/\d+$/);
      const roundNumber = roundMatch ? roundMatch[0] : '1';
      
      currentRound = {
        round: parseInt(roundNumber),
        label: period ? `Round ${roundNumber} (${period})` : `Round ${roundNumber}`,
        batchName: mentorBatch
      };
    }

    // 3) Get mentor's mentees and organize by batch
    const menteeSet = new Set();
    const menteeToBatch = {};
    const menteesByBatch = {};
    let skippedRows = 0;

    for (const row of mentorMappings) {
      const mentee = (row['Mentee'] || row['Nama Usahawan'] || '').toString().trim();
      const batch = (row['Batch'] || '').toString().trim() || 'Unknown';

      if (mentee) {
        menteeSet.add(mentee);
        menteeToBatch[mentee] = batch;

        if (!menteesByBatch[batch]) menteesByBatch[batch] = [];
        menteesByBatch[batch].push(mentee);
      } else {
        skippedRows++;
      }
    }

    const totalMentees = menteeSet.size;
    console.log(`👥 [${debugInfo.requestId}] Extracted ${totalMentees} unique mentees from ${mentorMappings.length} rows`);
    if (skippedRows > 0) {
      console.log(`⚠️ [${debugInfo.requestId}] Skipped ${skippedRows} rows with missing Mentee/Nama Usahawan`);
    }
    console.log(`📊 [${debugInfo.requestId}] Mentees by batch:`,
      Object.entries(menteesByBatch).map(([batch, mentees]) => `${batch}=${mentees.length}`).join(', ')
    );

    // Detect program type from batch name
    const menteeToProgram = {};
    for (const mentee of menteeSet) {
      const batch = menteeToBatch[mentee] || '';
      if (batch.toLowerCase().includes('maju')) {
        menteeToProgram[mentee] = 'maju';
      } else if (batch.toLowerCase().includes('bangkit')) {
        menteeToProgram[mentee] = 'bangkit';
      } else {
        menteeToProgram[mentee] = 'unknown';
        console.warn(`⚠️ [${debugInfo.requestId}] Cannot determine program for mentee: ${mentee}, batch: ${batch}`);
      }
    }

    console.log(`🔍 [${debugInfo.requestId}] Program distribution:`, {
      maju: Object.values(menteeToProgram).filter(p => p === 'maju').length,
      bangkit: Object.values(menteeToProgram).filter(p => p === 'bangkit').length,
      unknown: Object.values(menteeToProgram).filter(p => p === 'unknown').length
    });

    // 4) Process session data from both sheets
    console.log(`📊 [${debugInfo.requestId}] Processing Bangkit sessions...`);
    const sessionsByMentee = new Map();
    for (const session of bangkitSheet) {
      const menteeName = session['Nama Usahawan'];
      if (!menteeName || !menteeSet.has(menteeName)) continue;

      const sessionData = {
        reportLabel: session['Sesi Laporan'] || '',
        status: session['Status Sesi'] || '',
        programType: 'bangkit',
        premisDilawat: session['Premis Dilawat'] || false, // Track premises visit
        // Sales data columns
        Jan: session.Jan, Feb: session.Feb, Mar: session.Mar,
        Apr: session.Apr, Mei: session.Mei, Jun: session.Jun,
        Jul: session.Jul, Ogos: session.Ogos, Sep: session.Sep,
        Okt: session.Okt, Nov: session.Nov, Dis: session.Dis,
      };

      if (!sessionsByMentee.has(menteeName)) {
        sessionsByMentee.set(menteeName, []);
      }
      sessionsByMentee.get(menteeName).push(sessionData);
    }

    console.log(`✅ [${debugInfo.requestId}] Processed ${bangkitSheet.length} Bangkit sessions`);

    // 4b) Process Maju session data (LaporanMaju sheet)
    console.log(`📊 [${debugInfo.requestId}] Processing Maju sessions...`);

    for (const session of majuSheet) {
      const menteeName = (session['NAMA_MENTEE'] || '').toString().trim();
      if (!menteeName || !menteeSet.has(menteeName)) continue;

      const sesiNumber = session['SESI_NUMBER'];
      const miaStatus = (session['MIA_STATUS'] || 'Tidak MIA').toString().trim();

      // Get batch info to extract round number
      const batch = menteeToBatch[menteeName];
      const batchInfo = batchSheet.find(b => b['Batch'] === batch);
      const roundLabel = batchInfo?.['Mentoring Round'] || 'Round 1';
      const roundMatch = roundLabel.match(/\d+$/);
      const roundNumber = roundMatch ? roundMatch[0] : '1';

      // Construct report label similar to Bangkit format
      const reportLabel = `Sesi #${sesiNumber} (Round ${roundNumber})`;

      const sessionData = {
        reportLabel,
        status: miaStatus.toLowerCase() === 'mia' ? 'MIA' : 'Selesai',
        programType: 'maju',
        sesiNumber,
        miaStatus,
        premisDilawat: session['LAWATAN_PREMIS'] || false // Track premises visit for Maju
      };

      if (!sessionsByMentee.has(menteeName)) {
        sessionsByMentee.set(menteeName, []);
      }
      sessionsByMentee.get(menteeName).push(sessionData);
    }

    console.log(`✅ [${debugInfo.requestId}] Processed ${majuSheet.length} Maju sessions`);
    console.log(`📊 [${debugInfo.requestId}] Total sessions combined: ${sessionsByMentee.size} mentees tracked`);

    // Debug: Log some Maju report labels
    const majuSamples = Array.from(sessionsByMentee.entries())
      .filter(([_, sessions]) => sessions.some(s => s.programType === 'maju'))
      .slice(0, 3);
    if (majuSamples.length > 0) {
      console.log(`🔍 [${debugInfo.requestId}] Maju report label samples:`,
        majuSamples.map(([mentee, sessions]) => ({
          mentee,
          labels: sessions.filter(s => s.programType === 'maju').map(s => s.reportLabel)
        }))
      );
    }

    // 5) Calculate statistics
    let allTimeTotalReports = 0;
    let allTimeMiaCount = 0;
    let currentRoundMiaCount = 0;
    const allTimeReportedMentees = new Set();
    const currentRoundReportedMentees = new Set();
    const allTimeSessionsByMentee = {};
    const currentRoundSessionsByMentee = {};
    const sessionsByBatch = {};
    const miaByBatch = {};
    const menteesWithPremisVisit = new Set(); // Track mentees with premises visit

    for (const [menteeName, sessions] of sessionsByMentee) {
      const batch = menteeToBatch[menteeName] || 'Unknown';
      
      // Initialize batch tracking
      if (!sessionsByBatch[batch]) sessionsByBatch[batch] = {};
      if (!miaByBatch[batch]) miaByBatch[batch] = {};
      
      sessionsByBatch[batch][menteeName] = new Set();
      miaByBatch[batch][menteeName] = 0;

      for (const session of sessions) {
        const { reportLabel, status, programType, premisDilawat } = session;

        allTimeTotalReports++;

        // Track if mentee has had premises visit
        if (premisDilawat === true || premisDilawat === 'TRUE' || premisDilawat === 'true') {
          menteesWithPremisVisit.add(menteeName);
        }

        // Extract round number from report label
        // For Maju: "Sesi #1 (Round 1)" -> extract "1" from "(Round 1)"
        // For Bangkit: "Sesi 1 Round 1" -> extract "1" from end
        let reportRoundNumber = null;

        // Try to match "Round X)" pattern first (for Maju)
        const majuMatch = reportLabel.match(/Round (\d+)\)/);
        if (majuMatch) {
          reportRoundNumber = majuMatch[1];
        } else {
          // Fallback to original pattern for Bangkit reports
          const bangkitMatch = reportLabel.match(/\d+$/);
          reportRoundNumber = bangkitMatch ? bangkitMatch[0] : null;
        }

        const isCurrentRound = currentRound && reportRoundNumber === currentRound.round.toString();

        // Debug logging for first few Maju reports
        if (programType === 'maju' && allTimeTotalReports <= 5) {
          console.log(`🔍 [${debugInfo.requestId}] Maju report debug:`, {
            mentee: menteeName,
            reportLabel,
            reportRoundNumber,
            currentRoundNumber: currentRound?.round,
            isCurrentRound,
            status
          });
        }

        if (status.toLowerCase() === 'mia') {
          allTimeMiaCount++;
          miaByBatch[batch][menteeName]++;
          
          if (isCurrentRound) {
            currentRoundMiaCount++;
          }
        } else if (status.toLowerCase() === 'selesai') {
          // All time tracking
          allTimeReportedMentees.add(menteeName);
          if (!allTimeSessionsByMentee[menteeName]) allTimeSessionsByMentee[menteeName] = new Set();
          allTimeSessionsByMentee[menteeName].add(reportLabel);
          sessionsByBatch[batch][menteeName].add(reportLabel);
          
          // Current round tracking
          if (isCurrentRound) {
            currentRoundReportedMentees.add(menteeName);
            if (!currentRoundSessionsByMentee[menteeName]) currentRoundSessionsByMentee[menteeName] = new Set();
            currentRoundSessionsByMentee[menteeName].add(reportLabel);
          }
        }
      }
    }

    // Convert sets to counts
    const allTimePerMenteeSessions = Object.fromEntries(
      Object.entries(allTimeSessionsByMentee).map(([k, v]) => [k, v.size])
    );
    
    const currentRoundPerMenteeSessions = Object.fromEntries(
      Object.entries(currentRoundSessionsByMentee).map(([k, v]) => [k, v.size])
    );

    const sessionsByBatchCount = {};
    for (const [batch, mentees] of Object.entries(sessionsByBatch)) {
      sessionsByBatchCount[batch] = Object.fromEntries(
        Object.entries(mentees).map(([mentee, sessions]) => [mentee, sessions.size])
      );
    }

    // Clean up MIA batch data (remove zeros)
    for (const [batch, mentees] of Object.entries(miaByBatch)) {
      for (const [mentee, count] of Object.entries(mentees)) {
        if (count === 0) delete miaByBatch[batch][mentee];
      }
      if (Object.keys(miaByBatch[batch]).length === 0) delete miaByBatch[batch];
    }

    // Calculate pending reports for current round
    const currentRoundPending = totalMentees - currentRoundReportedMentees.size;

    // 6) Response
    const responseData = {
      mentorEmail: loginEmail,
      currentRound,
      totalMentees,

      // All-time stats
      allTime: {
        totalReports: allTimeTotalReports,
        uniqueMenteesReported: allTimeReportedMentees.size,
        miaCount: allTimeMiaCount,
        premisVisitCount: menteesWithPremisVisit.size, // Number of mentees with premises visit
        perMenteeSessions: allTimePerMenteeSessions,
      },

      // Current round stats
      currentRoundStats: {
        reportedThisRound: currentRoundReportedMentees.size,
        pendingThisRound: currentRoundPending,
        miaThisRound: currentRoundMiaCount,
        perMenteeSessions: currentRoundPerMenteeSessions,
      },

      // Batch-grouped data
      menteesByBatch,
      sessionsByBatch: sessionsByBatchCount,
      miaByBatch,

      source: {
        batchInfo: batchInfo || null,
        mentorBatch,
        totalMenteeRecords: mentorMappings.length,
      },

      // Debug info
      debug: {
        ...debugInfo,
        processingTimeMs: Date.now() - sheetsEndTime,
        totalTimeMs: Date.now() - new Date(debugInfo.timestamp).getTime(),
        impersonation: {
          isImpersonating,
          realUser: realUserEmail,
          effectiveUser: effectiveUserEmail
        }
      }
    };

    console.log(`✅ [${debugInfo.requestId}] Statistics calculated:`, {
      totalMentees,
      bangkitMentees: Object.values(menteeToProgram).filter(p => p === 'bangkit').length,
      majuMentees: Object.values(menteeToProgram).filter(p => p === 'maju').length,
      allTimeReports: allTimeTotalReports,
      currentRoundReported: currentRoundReportedMentees.size,
      allTimeMIA: allTimeMiaCount,
      currentRoundMIA: currentRoundMiaCount,
      processingTime: responseData.debug.totalTimeMs + 'ms'
    });

    // Cache the response for 10 minutes
    cache.set(cacheKey, responseData, 10 * 60 * 1000); // 10 minutes

    return res.json(responseData);

  } catch (e) {
    console.error(`❌ [${debugInfo.requestId}] Error in mentor-stats:`, e);
    res.status(500).json({
      error: String(e?.message || e),
      debug: debugInfo
    });
  }
}