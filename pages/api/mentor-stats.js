// pages/api/mentor-stats.js
import { getSheetsClient } from '../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import cache from '../../lib/simple-cache';
import { getEffectiveUserEmail, canImpersonate } from '../../lib/impersonation';

/**
 * Normalize round/session number for comparison
 * Handles various formats: "Mentoring 2", "Round 4", "Sesi 1", "Sesi #2", "2"
 *
 * @param {string|number} value - The round/session value to normalize
 * @returns {string|null} - Normalized number as string, or null if invalid
 *
 * Examples:
 *   "Mentoring 2" → "2"
 *   "Round 4" → "4"
 *   "Sesi 1" → "1"
 *   "Sesi #2" → "2"
 *   "2" → "2"
 *   4 → "4"
 */
function normalizeRoundNumber(value) {
  if (!value && value !== 0) return null;

  // Convert to string and extract first number
  const match = String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

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

    // Read Upward Mobility forms
    console.log('📋 Reading Upward Mobility forms...');
    let umRows = [];
    try {
      const umSheetId = process.env.GOOGLE_SHEET_ID_UM;
      console.log('🔑 GOOGLE_SHEET_ID_UM:', umSheetId ? `${umSheetId.substring(0, 20)}...` : 'NOT SET');

      if (umSheetId) {
        console.log('📡 Attempting to read UM sheet from:', umSheetId);
        const { sheets } = client;
        const umData = await sheets.spreadsheets.values.get({
          spreadsheetId: umSheetId,
          range: 'UM!A:Z', // Read all columns from UM tab
        });

        console.log('📦 UM sheet raw data received, rows:', umData.data.values?.length || 0);
        const umRawRows = umData.data.values || [];

        if (umRawRows.length > 1) {
          const umHeaders = umRawRows[0];
          console.log('📋 UM Sheet has', umRawRows.length - 1, 'data rows');
          console.log('📋 UM Sheet columns:', umHeaders);

          umRows = umRawRows.slice(1).map(row => {
            const obj = {};
            umHeaders.forEach((header, idx) => {
              obj[header] = row[idx] || '';
            });
            return obj;
          });
          console.log(`✅ Loaded ${umRows.length} UM form submissions`);

          // Debug: Show sample entries
          console.log('📋 Sample UM entries:', umRows.slice(0, 3).map(row => ({
            batch: row['Batch.'],
            menteeName: row['Nama Penuh Usahawan.'],
            menteeEmail: row['Email Usahawan'] || row['Email Address Usahawan'] || 'N/A',
            session: row['Sesi Mentoring.']
          })));
        } else if (umRawRows.length === 1) {
          console.warn('⚠️ UM sheet has headers but no data rows');
        } else {
          console.warn('⚠️ UM sheet is completely empty');
        }
      } else {
        console.warn('⚠️ UM sheet ID not configured in environment (GOOGLE_SHEET_ID_UM)');
      }
    } catch (error) {
      console.error('❌ Error reading UM sheet:', error.message);
      console.error('❌ Full error:', error);
    }

    const sheetsEndTime = Date.now();
    console.log(`⏱️ [${debugInfo.requestId}] Google Sheets data fetched in ${sheetsEndTime - sheetsStartTime}ms`);
    console.log(`📋 [${debugInfo.requestId}] Data counts: mapping=${mappingSheet.length}, bangkit=${bangkitSheet.length}, maju=${majuSheet.length}, batches=${batchSheet.length}, um=${umRows.length}`);

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

    // Helper function to check if current date falls within period range
    const isCurrentPeriod = (periodStr) => {
      if (!periodStr) return false;

      const now = new Date();
      const currentMonth = now.getMonth(); // 0-11 (Jan=0, Dec=11)
      const currentYear = now.getFullYear();

      // Parse period string like "Sept-Nov", "Dec-Feb", "Dis-Feb"
      const months = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'may': 4,
        'jun': 5, 'jul': 6, 'ogos': 7, 'aug': 7, 'sep': 8, 'sept': 8,
        'okt': 9, 'oct': 9, 'nov': 10, 'dis': 11, 'dec': 11
      };

      // Clean up the period string - handle formats like "Sept – Nov" with various dashes
      const cleanPeriod = periodStr.toLowerCase().replace(/\s*[–-]\s*/g, '-').trim();
      const parts = cleanPeriod.split('-');
      if (parts.length !== 2) return false;

      const startMonth = months[parts[0].trim()];
      const endMonth = months[parts[1].trim()];

      if (startMonth === undefined || endMonth === undefined) return false;

      // Handle period that spans year boundary (e.g., Dec-Feb)
      if (startMonth <= endMonth) {
        return currentMonth >= startMonth && currentMonth <= endMonth;
      } else {
        return currentMonth >= startMonth || currentMonth <= endMonth;
      }
    };

    // Get all unique batches for this mentor's mentees
    const mentorBatches = [...new Set(mentorMappings.map(m => m['Batch']).filter(Boolean))];

    console.log(`📦 [${debugInfo.requestId}] Mentor's batches:`, mentorBatches);

    // Find ALL batch info entries that are currently active (matching current period)
    // This handles mentors with multiple batches in different rounds but same period
    const activeBatchInfos = [];
    let currentPeriodName = null;

    for (const batch of mentorBatches) {
      const batchInfos = batchSheet.filter(b => b['Batch'] === batch);

      for (const info of batchInfos) {
        const period = info['Period'] || '';
        if (isCurrentPeriod(period)) {
          activeBatchInfos.push({
            batch,
            period,
            roundLabel: info['Mentoring Round'] || 'Round 1',
            info
          });

          // Store the period name (they should all be the same period, e.g., "Dec-Feb")
          if (!currentPeriodName) {
            currentPeriodName = period;
          }
        }
      }
    }

    // If no active batches found, use first available as fallback
    if (activeBatchInfos.length === 0) {
      console.warn(`⚠️ [${debugInfo.requestId}] No current period match found, using first batch info as fallback`);
      for (const batch of mentorBatches) {
        const batchInfos = batchSheet.filter(b => b['Batch'] === batch);
        if (batchInfos.length > 0) {
          const info = batchInfos[0];
          activeBatchInfos.push({
            batch,
            period: info['Period'] || '',
            roundLabel: info['Mentoring Round'] || 'Round 1',
            info
          });
          currentPeriodName = info['Period'] || '';
          break;
        }
      }
    }

    // Create period-based tracking object
    const currentPeriod = activeBatchInfos.length > 0 ? {
      periodName: currentPeriodName,
      label: currentPeriodName || 'Current Period',
      activeBatches: activeBatchInfos.map(b => ({
        batch: b.batch,
        round: b.roundLabel
      }))
    } : null;

    console.log(`📅 [${debugInfo.requestId}] Current period detected:`, {
      periodName: currentPeriodName,
      activeBatchCount: activeBatchInfos.length,
      batches: activeBatchInfos.map(b => `${b.batch} (${b.roundLabel})`)
    });

    // Create a Set of active batch names for quick lookup
    const activeBatchNames = new Set(activeBatchInfos.map(b => b.batch));

    // Create a Map linking batch name to expected round number
    // This is used to filter reports by both batch AND session number
    const activeBatchRounds = new Map(
      activeBatchInfos.map(info => [info.batch, info.roundLabel])
    );

    console.log(`🗺️ [${debugInfo.requestId}] Active batch rounds:`,
      Array.from(activeBatchRounds.entries()).map(([batch, round]) => `${batch}→${round}`).join(', ')
    );

    // 3) Get mentor's mentees and organize by batch
    const menteeSet = new Set();
    const menteeToBatch = {};
    const menteesByBatch = {};
    const menteeEmailToName = {}; // NEW: Map email → name for UM matching
    const menteeNameToEmail = {}; // NEW: Map name → email for reverse lookup
    let skippedRows = 0;

    for (const row of mentorMappings) {
      const mentee = (row['Mentee'] || row['Nama Usahawan'] || '').toString().trim();
      const menteeEmail = (row['Mentee_Email'] || row['Email Usahawan'] || '').toString().toLowerCase().trim();
      const batch = (row['Batch'] || '').toString().trim() || 'Unknown';

      if (mentee) {
        menteeSet.add(mentee);
        menteeToBatch[mentee] = batch;

        // Build email mappings for UM matching
        if (menteeEmail) {
          menteeEmailToName[menteeEmail] = mentee;
          menteeNameToEmail[mentee] = menteeEmail;
        }

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

      // Check if premises were actually visited based on uploaded images
      const premisImages = session['Link_Gambar_Premis'] || '';
      let hasPremisImages = false;

      // Images are stored as JSON array, e.g., ["url1", "url2"]
      try {
        const imageArray = premisImages ? JSON.parse(premisImages) : [];
        hasPremisImages = Array.isArray(imageArray) && imageArray.length > 0 && imageArray.some(url => url && url.trim() !== '');
      } catch (e) {
        // If not valid JSON, check if it's a non-empty string (old format)
        hasPremisImages = premisImages.trim() !== '' && premisImages !== '[]';
      }

      // Get the batch for this mentee to check session/round matching
      const menteeBatch = menteeToBatch[menteeName];
      const reportSessionLabel = session['Sesi Laporan'] || '';

      // Extract session number from report label (e.g., "Sesi #1 (Round 2)" → "1")
      const reportSessionMatch = reportSessionLabel.match(/Sesi\s*#?(\d+)/i);
      const reportSessionNumber = reportSessionMatch ? reportSessionMatch[1] : null;

      const sessionData = {
        reportLabel: reportSessionLabel,
        status: session['Status Sesi'] || '',
        programType: 'bangkit',
        batch: menteeBatch, // Store batch for filtering
        sessionNumber: reportSessionNumber, // Store session number for filtering
        // Track premises visit based on actual uploaded images
        premisDilawat: hasPremisImages,
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

      // Check if premises were actually visited based on uploaded images (Maju format)
      const premisImagesMaju = session['URL_GAMBAR_PREMIS_JSON'] || '';
      let hasPremisImagesMaju = false;

      // Images are stored as JSON array, e.g., ["url1", "url2"]
      try {
        const imageArray = premisImagesMaju ? JSON.parse(premisImagesMaju) : [];
        hasPremisImagesMaju = Array.isArray(imageArray) && imageArray.length > 0 && imageArray.some(url => url && url.trim() !== '');
      } catch (e) {
        // If not valid JSON, check if it's a non-empty string (old format)
        hasPremisImagesMaju = premisImagesMaju.trim() !== '' && premisImagesMaju !== '[]';
      }

      const sessionData = {
        reportLabel,
        status: miaStatus.toLowerCase() === 'mia' ? 'MIA' : 'Selesai',
        programType: 'maju',
        batch: batch, // Store batch for filtering
        sessionNumber: String(sesiNumber), // Store session number for filtering
        sesiNumber,
        miaStatus,
        // Track premises visit based on actual uploaded images
        premisDilawat: hasPremisImagesMaju
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
    const miaMenteesList = []; // Detailed MIA list with batch info for dedicated section
    const menteesWithPremisVisit = new Set(); // Track mentees with premises visit

    const menteeToMiaCount = new Map(); // Track total MIA count per mentee

    for (const [menteeName, sessions] of sessionsByMentee) {
      const batch = menteeToBatch[menteeName] || 'Unknown';

      // Initialize batch tracking
      if (!sessionsByBatch[batch]) sessionsByBatch[batch] = {};
      if (!miaByBatch[batch]) miaByBatch[batch] = {};

      sessionsByBatch[batch][menteeName] = new Set();
      miaByBatch[batch][menteeName] = 0;

      for (const session of sessions) {
        const { reportLabel, status, programType, premisDilawat, batch: sessionBatch, sessionNumber } = session;

        allTimeTotalReports++;

        // Track if mentee has had premises visit (premisDilawat is already boolean from earlier parsing)
        if (premisDilawat === true) {
          menteesWithPremisVisit.add(menteeName);
        }

        // Check if this report is from the current period AND current session
        // Match on BOTH batch AND session number
        const expectedRound = activeBatchRounds.get(batch);
        const matchesBatch = activeBatchNames.has(batch);
        const matchesRound = normalizeRoundNumber(sessionNumber) === normalizeRoundNumber(expectedRound);
        const isCurrentPeriod = matchesBatch && matchesRound;

        // Debug logging for excluded reports
        if (matchesBatch && !matchesRound) {
          console.log(`⚠️ [${debugInfo.requestId}] Excluding late/old report - Batch: ${batch}, Report Session: ${sessionNumber}, Expected: ${expectedRound}, Label: ${reportLabel}`);
        }

        if (status.toLowerCase() === 'mia') {
          allTimeMiaCount++;
          miaByBatch[batch][menteeName]++;

          // Track total MIA count per mentee
          const currentCount = menteeToMiaCount.get(menteeName) || 0;
          menteeToMiaCount.set(menteeName, currentCount + 1);

          if (isCurrentPeriod) {
            currentRoundMiaCount++;
          }
        } else if (status.toLowerCase() === 'selesai') {
          // All time tracking
          allTimeReportedMentees.add(menteeName);
          if (!allTimeSessionsByMentee[menteeName]) allTimeSessionsByMentee[menteeName] = new Set();
          allTimeSessionsByMentee[menteeName].add(reportLabel);
          sessionsByBatch[batch][menteeName].add(reportLabel);

          // Current period tracking with session/round matching
          if (isCurrentPeriod) {
            currentRoundReportedMentees.add(menteeName);
            if (!currentRoundSessionsByMentee[menteeName]) currentRoundSessionsByMentee[menteeName] = new Set();
            currentRoundSessionsByMentee[menteeName].add(reportLabel);
          }
        }
      }
    }

    // Build detailed MIA list grouped by batch
    for (const [menteeName, miaCount] of menteeToMiaCount.entries()) {
      if (miaCount > 0) {
        const batch = menteeToBatch[menteeName] || 'Unknown';
        miaMenteesList.push({
          name: menteeName,
          batch,
          miaCount,
          totalSessions: allTimeSessionsByMentee[menteeName]?.size || 0
        });
      }
    }

    // Sort MIA list by batch, then by name
    miaMenteesList.sort((a, b) => {
      if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);
      return a.name.localeCompare(b.name);
    });

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

    // Calculate pending reports for current period
    // Only count mentees in active batches (current period)
    const menteesInActiveBatches = Array.from(menteeSet).filter(mentee => {
      const batch = menteeToBatch[mentee];
      return activeBatchNames.has(batch);
    }).length;

    const currentPeriodPending = menteesInActiveBatches - currentRoundReportedMentees.size;

    // Process UM forms per batch
    console.log('\n📊 Processing Upward Mobility forms...');
    const umSubmissionsByBatch = new Map(); // batch-session → Set of mentee names who submitted UM

    for (const umRow of umRows) {
      const batch = umRow['Batch.'];
      const umMenteeName = umRow['Nama Penuh Usahawan.'];
      const umMenteeEmail = (umRow['Email Usahawan'] || umRow['Email Address Usahawan'] || '').toLowerCase().trim();
      const sesiMentoring = umRow['Sesi Mentoring.']; // "Sesi 2" or "Sesi 4"

      if (!batch || !sesiMentoring) {
        console.log('⚠️ Skipping UM row with missing batch/session:', { batch, sesiMentoring });
        continue;
      }

      // Try to find the mentee name from our mapping using email
      let menteeName = umMenteeName;
      if (umMenteeEmail && menteeEmailToName[umMenteeEmail]) {
        menteeName = menteeEmailToName[umMenteeEmail];
        console.log(`✅ Matched UM by email: "${umMenteeName}" (${umMenteeEmail}) → "${menteeName}"`);
      } else if (!umMenteeEmail) {
        console.log(`⚠️ UM row has no email, using name as-is: "${umMenteeName}"`);
      } else {
        console.log(`⚠️ UM email not found in mapping: ${umMenteeEmail}, trying name match for "${umMenteeName}"`);
      }

      if (!menteeName) {
        console.log('⚠️ Skipping UM row - no valid mentee identifier');
        continue;
      }

      // Extract session number: "Sesi 2" → "2"
      const sessionNum = normalizeRoundNumber(sesiMentoring);
      if (!sessionNum) {
        console.log('⚠️ Could not extract session number from:', sesiMentoring);
        continue;
      }

      // Create key: batch + session
      const key = `${batch}-Session${sessionNum}`;

      if (!umSubmissionsByBatch.has(key)) {
        umSubmissionsByBatch.set(key, new Set());
      }
      umSubmissionsByBatch.get(key).add(menteeName);
    }

    console.log('📊 UM submissions processed:', umSubmissionsByBatch.size, 'batch-session combinations');
    console.log('🗂️ UM submissions grouped by batch-session:');
    Array.from(umSubmissionsByBatch.entries()).forEach(([key, names]) => {
      console.log(`  ${key}: ${names.size} mentees -`, Array.from(names).slice(0, 3).join(', '));
    });

    // Calculate UM completion for active batches
    const umStatsByBatch = [];

    for (const batchInfo of activeBatchInfos) {
      const batch = batchInfo.batch;
      const roundNum = normalizeRoundNumber(batchInfo.roundLabel);

      // Only track UM for Session 2 and Session 4
      if (roundNum !== '2' && roundNum !== '4') {
        continue;
      }

      // CRITICAL FIX: Get only mentees who have SUBMITTED reports for THIS session
      // Build list of mentees who submitted this session's reports
      const menteesWithSessionReports = new Set();

      for (const [menteeName, sessions] of sessionsByMentee) {
        const menteeBatch = menteeToBatch[menteeName];

        // Check if this mentee belongs to the current batch
        if (menteeBatch !== batch) continue;

        // Check if mentee has submitted reports for THIS session
        for (const session of sessions) {
          if (session.batch === batch &&
              normalizeRoundNumber(session.sessionNumber) === roundNum &&
              session.status.toLowerCase() === 'selesai') {
            menteesWithSessionReports.add(menteeName);
            break; // Found a report for this session, no need to check more
          }
        }
      }

      // Convert Set to Array for easier manipulation
      const menteesEligibleForUM = Array.from(menteesWithSessionReports);
      const totalMentees = menteesEligibleForUM.length;

      console.log(`\n🔍 UM Stats for ${batch} Session ${roundNum}:`);
      console.log(`  - Total assigned in batch: ${menteesByBatch?.[batch]?.length || 0}`);
      console.log(`  - Submitted Sesi ${roundNum} reports: ${menteesEligibleForUM.length}`);
      console.log(`  - Mentees who submitted reports:`, menteesEligibleForUM);

      // Check if any reports have been submitted for this session
      if (menteesEligibleForUM.length === 0) {
        // No reports submitted yet - add warning entry instead of stats
        console.log(`⚠️ ${batch} Session ${roundNum}: No reports submitted yet`);

        umStatsByBatch.push({
          batch: batch,
          session: roundNum,
          sessionLabel: `Sesi ${roundNum}`,
          totalMentees: 0,
          submitted: 0,
          pending: 0,
          pendingMentees: [],
          noReportsYet: true  // Flag to trigger warning display
        });

        continue; // Skip normal calculation
      }

      // Check how many have submitted UM for this session
      const umKey = `${batch}-Session${roundNum}`;
      const submittedSet = umSubmissionsByBatch.get(umKey) || new Set();

      console.log(`  - UM key: ${umKey}`);
      console.log(`  - UM submitters found:`, Array.from(submittedSet));

      // Count how many of the eligible mentees have submitted UM
      const submittedCount = menteesEligibleForUM.filter(name =>
        submittedSet.has(name)
      ).length;

      const pendingCount = totalMentees - submittedCount;

      // List of mentees who submitted reports but NOT UM
      const pendingMentees = menteesEligibleForUM.filter(name =>
        !submittedSet.has(name)
      );

      console.log(`  - Match count: ${submittedCount}/${totalMentees}`);
      console.log(`  ✅ UM submissions found: ${submittedCount}/${totalMentees}`);

      umStatsByBatch.push({
        batch: batch,
        session: roundNum,
        sessionLabel: `Sesi ${roundNum}`,
        totalMentees: totalMentees,
        submitted: submittedCount,
        pending: pendingCount,
        pendingMentees: pendingMentees
      });
    }

    console.log('📈 UM stats calculated for', umStatsByBatch.length, 'batches');

    // 6) Response
    const responseData = {
      mentorEmail: loginEmail,
      currentPeriod, // Period-based instead of round-based
      currentRound: currentPeriod, // Keep for backward compatibility
      totalMentees,
      totalMenteesInCurrentPeriod: menteesInActiveBatches, // New field

      // All-time stats
      allTime: {
        totalReports: allTimeTotalReports,
        uniqueMenteesReported: allTimeReportedMentees.size,
        miaCount: allTimeMiaCount,
        premisVisitCount: menteesWithPremisVisit.size, // Number of mentees with premises visit
        perMenteeSessions: allTimePerMenteeSessions,
      },

      // Current period stats (renamed from currentRoundStats but kept old name for compatibility)
      currentRoundStats: {
        reportedThisRound: currentRoundReportedMentees.size,
        pendingThisRound: currentPeriodPending,
        miaThisRound: currentRoundMiaCount,
        perMenteeSessions: currentRoundPerMenteeSessions,
      },

      // Batch-grouped data
      menteesByBatch,
      sessionsByBatch: sessionsByBatchCount,
      miaByBatch,

      // Detailed MIA list for dedicated section
      miaMentees: miaMenteesList,

      // Upward Mobility form tracking
      upwardMobilityStats: umStatsByBatch,

      source: {
        activeBatchInfos, // Include all active batches
        totalMenteeRecords: mentorMappings.length,
      },

      // Debug info
      debug: {
        ...debugInfo,
        processingTimeMs: Date.now() - sheetsEndTime,
        totalTimeMs: Date.now() - new Date(debugInfo.timestamp).getTime(),
        umFormsLoaded: umRows.length,
        umBatchesTracked: umStatsByBatch.length,
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