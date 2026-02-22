// pages/api/admin/lawatan-premis.js
import { getSheetsClient } from '../../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { canAccessAdmin } from '../../../lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// In-memory cache with 5-minute TTL
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Calculate lawatan premis status for a mentee
 *
 * Data Priority Logic:
 * 1. UM Form "Column 70" (standalone UM form date) - HIGHEST PRIORITY
 * 2. Bangkit: "tarikh_lawatan_premis" (date field in session report)
 * 3. Maju: "UM_TARIKH_LAWATAN_PREMIS" (date field in session report)
 * 4. Bangkit: "Premis_Dilawat_Checked" (boolean checkbox)
 * 5. Maju: "URL_GAMBAR_PREMIS_JSON" (presence indicates visit happened)
 * 6. If none of above, check if overdue (Round 2+) or pending (Round 1)
 */
function calculateLawatanStatus(umColumn70, bangkitRecord, majuRecord, currentRound, program) {
  // 1. Check UM Form "Column 70" (HIGHEST PRIORITY)
  if (umColumn70) {
    return {
      status: 'completed',
      visitDate: umColumn70,
      source: 'UM Form'
    };
  }

  // 2. Check program-specific session reports
  if (program.toLowerCase().includes('maju')) {
    // Maju program
    // 2a. Check UM_TARIKH_LAWATAN_PREMIS (date field)
    if (majuRecord?.tarikhLawatanPremis) {
      return {
        status: 'completed',
        visitDate: majuRecord.tarikhLawatanPremis,
        source: 'Laporan Maju (Tarikh)'
      };
    }

    // 2b. Check URL_GAMBAR_PREMIS_JSON (presence of images indicates visit)
    if (majuRecord?.urlGambarPremis) {
      // Try to parse JSON and check if it has content
      try {
        const parsed = JSON.parse(majuRecord.urlGambarPremis);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            status: 'completed',
            visitDate: null,
            source: 'Laporan Maju (Gambar)'
          };
        }
      } catch (e) {
        // If not JSON, check if string is not empty
        if (majuRecord.urlGambarPremis.trim()) {
          return {
            status: 'completed',
            visitDate: null,
            source: 'Laporan Maju (Gambar)'
          };
        }
      }
    }
  } else {
    // Bangkit program
    // 2a. Check tarikh_lawatan_premis (date field)
    if (bangkitRecord?.tarikhLawatanPremis) {
      return {
        status: 'completed',
        visitDate: bangkitRecord.tarikhLawatanPremis,
        source: 'Laporan Bangkit (Tarikh)'
      };
    }

    // 2b. Check Premis_Dilawat_Checked (boolean checkbox)
    if (bangkitRecord?.premisChecked === 'TRUE' || bangkitRecord?.premisChecked === true) {
      return {
        status: 'completed',
        visitDate: null,
        source: 'Laporan Bangkit (Checkbox)'
      };
    }
  }

  // 3. Not completed - determine if overdue or pending
  const round = parseInt(currentRound) || 1;

  if (round >= 2) {
    return {
      status: 'overdue',
      visitDate: null,
      source: '-'
    };
  }

  return {
    status: 'pending',
    visitDate: null,
    source: '-'
  };
}

/**
 * Calculate current round for a batch based on date ranges from Supabase
 */
function getBatchInfo(batchName, batchRoundsData) {
  if (!batchRoundsData || batchRoundsData.length === 0) {
    return { currentRound: 1, roundStartDate: new Date() }; // Default
  }

  const today = new Date();
  const rounds = batchRoundsData
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
}

/**
 * Aggregate lawatan data from all sources
 */
function aggregateLawatanData(umData, bangkitReports, majuReports, mappingData, batchRoundsData) {
  const visits = [];
  const processedMentees = new Set();

  // Create maps for quick lookup
  // UM Form: Use "Column 70" for lawatan premis date
  const umByMentee = new Map();
  umData.forEach(record => {
    const menteeName = record['Nama Usahawan']?.toString().trim();
    if (menteeName) {
      umByMentee.set(menteeName, {
        column70: record['Column 70'] || null
      });
    }
  });

  // Bangkit Reports: Use "tarikh_lawatan_premis" and "Premis_Dilawat_Checked"
  const bangkitByMentee = new Map();
  bangkitReports.forEach(record => {
    const menteeName = record['Nama Usahawan']?.toString().trim();
    if (menteeName) {
      bangkitByMentee.set(menteeName, {
        tarikhLawatanPremis: record['tarikh_lawatan_premis'] || null,
        premisChecked: record['Premis_Dilawat_Checked'] || null
      });
    }
  });

  // Maju Reports: Use "UM_TARIKH_LAWATAN_PREMIS" and "URL_GAMBAR_PREMIS_JSON"
  const majuByMentee = new Map();
  majuReports.forEach(record => {
    const menteeName = record['NAMA_MENTEE']?.toString().trim();
    if (menteeName) {
      majuByMentee.set(menteeName, {
        tarikhLawatanPremis: record['UM_TARIKH_LAWATAN_PREMIS'] || null,
        urlGambarPremis: record['URL_GAMBAR_PREMIS_JSON'] || null
      });
    }
  });

  // Process all mentees from mapping
  mappingData.forEach(mapping => {
    const menteeName = (mapping['Mentee'] || mapping['Nama Usahawan'] || '').toString().trim();
    const mentorName = (mapping['Mentor'] || '').toString().trim();
    const batch = (mapping['Batch'] || '').toString().trim();
    const program = (mapping['Program'] || 'Bangkit').toString().trim();
    const menteeEmail = (mapping['Email Usahawan'] || '').toString().trim();
    const mentorEmail = (mapping['Email Mentor'] || '').toString().trim();

    if (!menteeName || !mentorName) return;
    if (processedMentees.has(menteeName)) return; // Avoid duplicates

    processedMentees.add(menteeName);

    // Get UM record (Column 70)
    const umRecord = umByMentee.get(menteeName);
    const umColumn70 = umRecord?.column70 || null;

    // Get Bangkit record (if Bangkit program)
    const bangkitRecord = bangkitByMentee.get(menteeName);

    // Get Maju record (if Maju program)
    const majuRecord = majuByMentee.get(menteeName);

    // Get current round for this batch (DYNAMIC CALCULATION)
    const { currentRound } = getBatchInfo(batch, batchRoundsData);

    // Calculate status using the correct data priority
    const { status, visitDate, source } = calculateLawatanStatus(
      umColumn70,
      bangkitRecord,
      majuRecord,
      currentRound,
      program
    );

    visits.push({
      menteeName,
      menteeEmail,
      mentorName,
      mentorEmail,
      program,
      batch,
      currentRound,
      status,
      visitDate,
      source
    });
  });

  return visits;
}

export default async function handler(req, res) {
  try {
    // 1. Authentication check
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userEmail = session.user.email;
    const hasAccess = await canAccessAdmin(userEmail);
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // 2. Get filter params
    const {
      program = 'all',
      batch = 'all',
      refresh = 'false',
      status: statusFilter = 'all'
    } = req.query;

    // 3. Check cache (5 minute TTL)
    const cacheKey = `lawatan-${program}-${batch}-${statusFilter}`;
    if (refresh !== 'true' && cache[cacheKey]) {
      const age = Date.now() - cache[cacheKey].timestamp;
      if (age < CACHE_TTL) {
        console.log(`✅ Returning cached data for ${cacheKey} (age: ${Math.round(age/1000)}s)`);
        return res.json({
          ...cache[cacheKey].data,
          cached: true,
          cacheAge: Math.round(age / 1000)
        });
      }
    }

    console.log(`🚀 Fetching fresh data for lawatan premis (program: ${program}, batch: ${batch})`);

    // 4. Fetch batch rounds from Supabase (DYNAMIC)
    let batchRoundsData = [];
    try {
      const { data, error } = await supabase
        .from('batch_rounds')
        .select('*');

      if (error) throw error;
      batchRoundsData = data || [];
      console.log(`✅ Loaded ${batchRoundsData.length} batch rounds from Supabase`);
    } catch (e) {
      console.warn('⚠️ Batch rounds not found in Supabase:', e.message);
    }

    // 5. Fetch from Google Sheets
    const client = await getSheetsClient();

    // Fetch all required sheets
    let umData = [];
    let bangkitReports = [];
    let majuReports = [];
    let mappingData = [];

    try {
      umData = await client.getRows('UM');
      console.log(`📊 Loaded ${umData.length} rows from UM sheet`);
    } catch (e) {
      console.warn('⚠️ UM sheet not found:', e.message);
    }

    try {
      bangkitReports = await client.getRows('V8'); // Bangkit reports tab
      console.log(`📊 Loaded ${bangkitReports.length} rows from Bangkit reports`);
    } catch (e) {
      console.warn('⚠️ Bangkit reports not found:', e.message);
    }

    try {
      majuReports = await client.getRows('LaporanMajuUM'); // Maju reports tab
      console.log(`📊 Loaded ${majuReports.length} rows from Maju reports`);
    } catch (e) {
      console.warn('⚠️ Maju reports not found:', e.message);
    }

    try {
      mappingData = await client.getRows('mapping');
      console.log(`📊 Loaded ${mappingData.length} rows from mapping`);
    } catch (e) {
      console.error('❌ Mapping sheet not found:', e.message);
      return res.status(500).json({ success: false, error: 'Mapping sheet not found' });
    }

    // 6. Aggregate data
    const allVisits = aggregateLawatanData(
      umData,
      bangkitReports,
      majuReports,
      mappingData,
      batchRoundsData
    );

    console.log(`✅ Aggregated ${allVisits.length} total visits`);

    // 7. Apply filters
    let filteredVisits = allVisits;

    if (program !== 'all') {
      filteredVisits = filteredVisits.filter(v =>
        v.program.toLowerCase() === program.toLowerCase()
      );
    }

    if (batch !== 'all') {
      filteredVisits = filteredVisits.filter(v => v.batch === batch);
    }

    if (statusFilter !== 'all') {
      filteredVisits = filteredVisits.filter(v => v.status === statusFilter);
    }

    console.log(`✅ Filtered to ${filteredVisits.length} visits`);

    // 8. Calculate summary stats
    const summary = {
      totalVisits: filteredVisits.length,
      completed: filteredVisits.filter(v => v.status === 'completed').length,
      pending: filteredVisits.filter(v => v.status === 'pending').length,
      overdue: filteredVisits.filter(v => v.status === 'overdue').length,
      withDate: filteredVisits.filter(v => v.visitDate !== null).length
    };

    // 9. Get unique batches and programs for filters
    const availableBatches = [...new Set(allVisits.map(v => v.batch))].sort();
    const availablePrograms = [...new Set(allVisits.map(v => v.program))].sort();

    // 10. Cache and return
    const responseData = {
      success: true,
      summary,
      visits: filteredVisits,
      filters: {
        program,
        batch,
        status: statusFilter,
        availableBatches,
        availablePrograms
      },
      lastUpdated: new Date().toISOString(),
      cached: false
    };

    cache[cacheKey] = {
      data: responseData,
      timestamp: Date.now()
    };

    // Prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.json(responseData);

  } catch (err) {
    console.error('❌ ERROR IN /api/admin/lawatan-premis:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error: ' + err.message
    });
  }
}
