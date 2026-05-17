// pages/api/mentor-stats.js
import { getSheetsClient } from '../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import cache from '../../lib/simple-cache';
import { getEffectiveUserEmail, canImpersonate } from '../../lib/impersonation';
import { createAdminClient } from '../../lib/supabaseAdmin';

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

// ─────────────────────────────────────────────────────────────────────────────
// Supabase data-fetch path (used when SOURCE_MENTOR_STATS=supabase)
// Returns null if mentor email not found in mentors table.
// Returns { __empty: true } if mentor has no active assignments.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchStatsFromSupabase(loginEmail, debugInfo) {
  const supabase = createAdminClient();
  const t0 = Date.now();

  // 1. Resolve mentor by email (case-insensitive)
  const { data: mentor, error: mentorError } = await supabase
    .from('mentors')
    .select('id, name')
    .ilike('email', loginEmail)
    .maybeSingle();

  if (mentorError) throw new Error(`Mentor lookup failed: ${mentorError.message}`);
  if (!mentor) return null;

  console.log(`👤 [${debugInfo.requestId}] Supabase: resolved ${mentor.name} (${mentor.id})`);

  // 2. Active assignments (both conditions required per CLAUDE.md)
  const { data: assignments, error: assignError } = await supabase
    .from('mentor_assignments')
    .select('entrepreneur_id, batch_id')
    .eq('mentor_id', mentor.id)
    .eq('is_active', true)
    .eq('status', 'active');

  if (assignError) throw new Error(`Assignments query failed: ${assignError.message}`);

  const entrepreneurIds = [
    ...new Set((assignments || []).map(a => a.entrepreneur_id).filter(Boolean))
  ];
  const batchIds = [
    ...new Set((assignments || []).map(a => a.batch_id).filter(Boolean))
  ];

  if (entrepreneurIds.length === 0) {
    return { __empty: true };
  }

  // entrepreneur_id → batch_id lookup
  const entrepreneurToBatchId = {};
  (assignments || []).forEach(a => {
    if (a.entrepreneur_id && a.batch_id) entrepreneurToBatchId[a.entrepreneur_id] = a.batch_id;
  });

  console.log(`📋 [${debugInfo.requestId}] Supabase: ${entrepreneurIds.length} mentees across ${batchIds.length} batches`);

  // 3. Parallel fetch: entrepreneurs, batches, reports, batch_rounds
  const [entrepreneursRes, batchesRes, reportsRes, batchRoundsRes] = await Promise.all([
    supabase
      .from('entrepreneurs')
      .select('id, name, program, batch')
      .in('id', entrepreneurIds),

    batchIds.length > 0
      ? supabase
          .from('batches')
          .select('id, batch_name, program, status')
          .in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from('reports')
      .select('entrepreneur_id, session_number, submission_date, session_date, payment_status, status, premis_dilawat, mia_status')
      .in('entrepreneur_id', entrepreneurIds),

    // CLAUDE.md: always add WHERE batch_name IS NOT NULL to batch_rounds joins
    // Older rows use start_date/end_date; active rows use start_month/end_month
    batchIds.length > 0
      ? supabase
          .from('batch_rounds')
          .select('id, batch_id, round_number, round_name, period_label, start_month, end_month, start_date, end_date, is_active')
          .in('batch_id', batchIds)
          .not('batch_name', 'is', null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (entrepreneursRes.error) throw new Error(`Entrepreneurs query failed: ${entrepreneursRes.error.message}`);
  if (reportsRes.error) throw new Error(`Reports query failed: ${reportsRes.error.message}`);

  const entrepreneurs = entrepreneursRes.data || [];
  const batches       = batchesRes.data || [];
  const reports       = reportsRes.data || [];
  const batchRounds   = batchRoundsRes.data || [];

  console.log(`📊 [${debugInfo.requestId}] Supabase: ${entrepreneurs.length} entrepreneurs, ${reports.length} reports, ${batchRounds.length} batch_rounds`);

  // Build lookup maps
  const entrepreneurMap = {};
  entrepreneurs.forEach(e => { entrepreneurMap[e.id] = e; });

  const batchMap = {};
  batches.forEach(b => { batchMap[b.id] = b; });

  const entrepreneurToBatchName = {};
  entrepreneurIds.forEach(eid => {
    const batchId   = entrepreneurToBatchId[eid];
    const batchInfo = batchMap[batchId];
    const entInfo   = entrepreneurMap[eid];
    entrepreneurToBatchName[eid] = batchInfo?.batch_name || entInfo?.batch || 'Unknown';
  });

  // 4. Current-period detection
  // Prefer start_month/end_month (active rows), fall back to start_date/end_date (legacy rows),
  // then is_active flag as last resort — per CLAUDE.md batch_rounds notes.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isInPeriod = (br) => {
    const start = br.start_month || br.start_date;
    const end   = br.end_month   || br.end_date;
    if (!start) return br.is_active === true;
    const s = new Date(start);
    const e = new Date(end || start);
    if (!end && br.start_month) {
      // No end_month set: treat as end of the start month
      e.setMonth(e.getMonth() + 1);
      e.setDate(0);
    }
    return today >= s && today <= e;
  };

  const activeBatchInfos = [];
  const activeBatchRoundNumbers = {}; // batchId → round_number for current period
  let currentPeriodName = null;

  for (const batchId of batchIds) {
    const rounds      = batchRounds.filter(br => br.batch_id === batchId);
    const activeRound = rounds.find(isInPeriod);

    if (activeRound) {
      const batchName = batchMap[batchId]?.batch_name || 'Unknown';
      activeBatchInfos.push({
        batch:       batchName,
        period:      activeRound.period_label || activeRound.round_name,
        roundLabel:  activeRound.round_name   || `Round ${activeRound.round_number}`,
        roundNumber: activeRound.round_number,
        batchId,
      });
      activeBatchRoundNumbers[batchId] = activeRound.round_number;
      if (!currentPeriodName) currentPeriodName = activeRound.period_label || activeRound.round_name;
    }
  }

  // Fallback: no active period found — use latest round per batch
  if (activeBatchInfos.length === 0) {
    console.warn(`⚠️ [${debugInfo.requestId}] Supabase: no active period, using latest round as fallback`);
    for (const batchId of batchIds) {
      const rounds = batchRounds
        .filter(br => br.batch_id === batchId)
        .sort((a, b) => b.round_number - a.round_number);
      if (rounds.length > 0) {
        const r        = rounds[0];
        const batchName = batchMap[batchId]?.batch_name || 'Unknown';
        activeBatchInfos.push({
          batch:       batchName,
          period:      r.period_label || r.round_name,
          roundLabel:  r.round_name   || `Round ${r.round_number}`,
          roundNumber: r.round_number,
          batchId,
        });
        activeBatchRoundNumbers[batchId] = r.round_number;
        if (!currentPeriodName) currentPeriodName = r.period_label || r.round_name;
      }
    }
  }

  const activeBatchIds = new Set(activeBatchInfos.map(b => b.batchId));

  const currentPeriod = activeBatchInfos.length > 0
    ? {
        periodName: currentPeriodName,
        label:      currentPeriodName || 'Current Period',
        activeBatches: activeBatchInfos.map(b => ({ batch: b.batch, round: b.roundLabel })),
      }
    : null;

  // 5. menteesByBatch
  const menteesByBatch = {};
  entrepreneurIds.forEach(eid => {
    const ent       = entrepreneurMap[eid];
    if (!ent) return;
    const batchName = entrepreneurToBatchName[eid];
    if (!menteesByBatch[batchName]) menteesByBatch[batchName] = [];
    menteesByBatch[batchName].push(ent.name);
  });

  // 6. Process reports for all-time and current-round stats
  // MIA signal: reports.mia_status IS NOT NULL and non-empty.
  // reports has no batch_round_id FK; match round by session_number === activeBatchRoundNumbers[batchId].
  let allTimeTotalReports = 0;
  let allTimeMiaCount     = 0;
  let currentRoundMiaCount = 0;

  const allTimeReportedMentees  = new Set();
  const menteesWithPremisVisit  = new Set();
  const allTimeSessionsByEid    = {}; // eid → Set<sessionLabel>
  const miaCountByEid           = {}; // eid → count

  const currentRoundReportedMentees  = new Set();
  const currentRoundSessionsByEid    = {}; // eid → Set<sessionLabel>

  for (const report of reports) {
    const eid = report.entrepreneur_id;
    if (!entrepreneurMap[eid]) continue;

    const batchId      = entrepreneurToBatchId[eid];
    const isMia        = report.mia_status?.trim() === 'MIA';
    const sessionLabel = `Session ${report.session_number}`;

    allTimeTotalReports++;

    if (report.premis_dilawat === true) menteesWithPremisVisit.add(eid);

    if (isMia) {
      allTimeMiaCount++;
      miaCountByEid[eid] = (miaCountByEid[eid] || 0) + 1;
      const expectedRound = activeBatchRoundNumbers[batchId];
      if (expectedRound != null && report.session_number === expectedRound) {
        currentRoundMiaCount++;
      }
    } else {
      allTimeReportedMentees.add(eid);
      if (!allTimeSessionsByEid[eid]) allTimeSessionsByEid[eid] = new Set();
      allTimeSessionsByEid[eid].add(sessionLabel);

      const expectedRound = activeBatchRoundNumbers[batchId];
      if (expectedRound != null && report.session_number === expectedRound) {
        currentRoundReportedMentees.add(eid);
        if (!currentRoundSessionsByEid[eid]) currentRoundSessionsByEid[eid] = new Set();
        currentRoundSessionsByEid[eid].add(sessionLabel);
      }
    }
  }

  // 7. sessionsByBatch and miaByBatch (keyed by mentee name, matching Sheets shape)
  const sessionsByBatch = {};
  const miaByBatch      = {};

  entrepreneurIds.forEach(eid => {
    const ent       = entrepreneurMap[eid];
    if (!ent) return;
    const batchName = entrepreneurToBatchName[eid];

    if (!sessionsByBatch[batchName]) sessionsByBatch[batchName] = {};
    sessionsByBatch[batchName][ent.name] = allTimeSessionsByEid[eid]?.size || 0;

    const miaCount = miaCountByEid[eid] || 0;
    if (miaCount > 0) {
      if (!miaByBatch[batchName]) miaByBatch[batchName] = {};
      miaByBatch[batchName][ent.name] = miaCount;
    }
  });

  // 8. perMenteeSessions by name (matching Sheets response shape)
  const allTimePerMenteeSessions      = {};
  const currentRoundPerMenteeSessions = {};

  entrepreneurIds.forEach(eid => {
    const ent = entrepreneurMap[eid];
    if (!ent) return;
    allTimePerMenteeSessions[ent.name] = allTimeSessionsByEid[eid]?.size || 0;
  });

  Object.entries(currentRoundSessionsByEid).forEach(([eid, sessionSet]) => {
    const ent = entrepreneurMap[eid];
    if (ent) currentRoundPerMenteeSessions[ent.name] = sessionSet.size;
  });

  // 9. miaMentees list (grouped by mentee, sorted by batch then name)
  const miaMenteesList = Object.entries(miaCountByEid)
    .filter(([, count]) => count > 0)
    .map(([eid, miaCount]) => ({
      name:          entrepreneurMap[eid]?.name || 'Unknown',
      batch:         entrepreneurToBatchName[eid] || 'Unknown',
      miaCount,
      totalSessions: allTimeSessionsByEid[eid]?.size || 0,
    }))
    .sort((a, b) => {
      if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);
      return a.name.localeCompare(b.name);
    });

  // 10. Pending count: mentees in active batches who haven't reported this round
  const menteesInActiveBatchCount = entrepreneurIds.filter(eid =>
    activeBatchIds.has(entrepreneurToBatchId[eid])
  ).length;

  return {
    mentorEmail:               loginEmail,
    currentPeriod,
    currentRound:              currentPeriod, // backward compat
    totalMentees:              entrepreneurIds.length,
    totalMenteesInCurrentPeriod: menteesInActiveBatchCount,
    allTime: {
      totalReports:        allTimeTotalReports,
      uniqueMenteesReported: allTimeReportedMentees.size,
      miaCount:            allTimeMiaCount,
      premisVisitCount:    menteesWithPremisVisit.size,
      perMenteeSessions:   allTimePerMenteeSessions,
    },
    currentRoundStats: {
      reportedThisRound: currentRoundReportedMentees.size,
      pendingThisRound:  Math.max(0, menteesInActiveBatchCount - currentRoundReportedMentees.size),
      miaThisRound:      currentRoundMiaCount,
      perMenteeSessions: currentRoundPerMenteeSessions,
    },
    menteesByBatch,
    sessionsByBatch,
    miaByBatch,
    miaMentees: miaMenteesList,
    source: {
      activeBatchInfos,
      totalMenteeRecords: (assignments || []).length,
    },
    __dbFetchTimeMs: Date.now() - t0, // stripped before response, used for debug
  };
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

    // ── Supabase path (SOURCE_MENTOR_STATS=supabase) ──────────────────────────
    if (process.env.SOURCE_MENTOR_STATS === 'supabase') {
      const cacheKey = `mentor-stats-db:${loginEmail}${isImpersonating ? ':impersonated' : ''}`;

      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        console.log(`⚡ [${debugInfo.requestId}] Supabase: returning cached data for ${loginEmail}`);
        return res.json({
          ...cachedData,
          debug: {
            ...debugInfo,
            fromCache: true,
            originalTimestamp: cachedData.debug?.timestamp,
            cacheAge: Date.now() - new Date(cachedData.debug?.timestamp || 0).getTime(),
            impersonation: { isImpersonating, realUser: realUserEmail, effectiveUser: effectiveUserEmail },
          },
        });
      }

      const result = await fetchStatsFromSupabase(loginEmail, debugInfo);

      if (!result) {
        console.log(`❌ [${debugInfo.requestId}] Supabase: mentor not found for ${loginEmail}`);
        return res.status(404).json({
          error: 'Mentor not found',
          mentorEmail: loginEmail,
          debug: { ...debugInfo, impersonation: { isImpersonating, realUser: realUserEmail, effectiveUser: effectiveUserEmail } },
        });
      }

      if (result.__empty) {
        console.log(`⚠️ [${debugInfo.requestId}] Supabase: no active mentees for ${loginEmail}`);
        return res.json({
          mentorEmail: loginEmail,
          error: 'No mentees found for this mentor',
          totalMentees: 0,
          currentRound: null,
          currentRoundStats: { reportedThisRound: 0, pendingThisRound: 0, miaThisRound: 0, perMenteeSessions: {} },
          allTime: { totalReports: 0, uniqueMenteesReported: 0, miaCount: 0, premisVisitCount: 0, perMenteeSessions: {} },
          menteesByBatch: {},
          sessionsByBatch: {},
          miaByBatch: {},
          miaMentees: [],
          debug: { ...debugInfo, impersonation: { isImpersonating, realUser: realUserEmail, effectiveUser: effectiveUserEmail } },
        });
      }

      const { __dbFetchTimeMs, ...resultData } = result;
      const responseData = {
        ...resultData,
        debug: {
          ...debugInfo,
          fromCache:    false,
          totalTimeMs:  Date.now() - new Date(debugInfo.timestamp).getTime(),
          dbFetchTimeMs: __dbFetchTimeMs,
          impersonation: { isImpersonating, realUser: realUserEmail, effectiveUser: effectiveUserEmail },
        },
      };

      cache.set(cacheKey, responseData, 10 * 60 * 1000);
      console.log(`✅ [${debugInfo.requestId}] Supabase: returning fresh data for ${loginEmail} (${__dbFetchTimeMs}ms DB fetch)`);
      return res.json(responseData);
    }
    // ── End Supabase path ─────────────────────────────────────────────────────

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
    const bangkitSheet = await client.getRows('Bangkit');
    const batchSheet = await client.getRows('batch');

    // Read Maju reports sheet
    let majuSheet = [];
    try {
      majuSheet = await client.getRows('LaporanMajuUM');
    } catch (e) {
      console.warn(`⚠️ [${debugInfo.requestId}] LaporanMajuUM sheet not found, skipping Maju reports`);
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
        'okt': 9, 'oct': 9, 'nov': 10, 'dis': 11, 'dec': 11,
        // Full names
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4,
        'june': 5, 'july': 6, 'august': 7, 'september': 8,
        'october': 9, 'november': 10, 'december': 11
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
      // Use case-insensitive and trimmed match for batch name to be safe
      const batchInfos = batchSheet.filter(b =>
        (b['Batch'] || '').toString().trim().toLowerCase() === batch.toLowerCase()
      );

      console.log(`🔍 [${debugInfo.requestId}] Batch check: "${batch}" found ${batchInfos.length} rows in batch sheet`);

      for (const info of batchInfos) {
        const period = info['Period'] || '';
        const isCurrent = isCurrentPeriod(period);

        console.log(`   Period: "${period}" -> Active: ${isCurrent}`);

        if (isCurrent) {
          activeBatchInfos.push({
            batch, // Use the mentor's batch name formatting
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
      console.warn(`⚠️ [${debugInfo.requestId}] No current period match found, using ALL batches as fallback`);
      for (const batch of mentorBatches) {
        // Use relaxed matching here too
        const batchInfos = batchSheet.filter(b =>
          (b['Batch'] || '').toString().trim().toLowerCase() === batch.toLowerCase()
        );
        if (batchInfos.length > 0) {
          const info = batchInfos[0];
          activeBatchInfos.push({
            batch,
            period: info['Period'] || '',
            roundLabel: info['Mentoring Round'] || 'Round 1',
            info
          });
          if (!currentPeriodName) currentPeriodName = info['Period'] || '';
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



      source: {
        activeBatchInfos, // Include all active batches
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