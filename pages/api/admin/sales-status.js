import { getSheetsClient } from '../../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { isAdmin } from '../../../lib/auth';

export default async function handler(req, res) {
  try {
    // 1. Check admin authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const client = await getSheetsClient();
    const mappingSheet = await client.getRows('mapping');
    const sessionSheet = await client.getRows('V8');

    // Read Maju reports sheet
    let majuSheet = [];
    try {
      majuSheet = await client.getRows('LaporanMajuUM');
    } catch (e) {
      console.warn('⚠️ LaporanMajuUM sheet not found, skipping Maju reports');
    }

    console.log(`📊 Loaded ${mappingSheet.length} rows from mapping sheet`);
    console.log(`📊 Loaded ${sessionSheet.length} rows from V8 (Bangkit) sheet`);
    console.log(`📊 Loaded ${majuSheet.length} rows from LaporanMajuUM sheet`); 
    
    // Try to get batch sheet, if it doesn't exist, extract batches from mapping
    let batchSheet;
    try {
      batchSheet = await client.getRows('batch');
    } catch (error) {
      console.log('Batch sheet not found, extracting batches from mapping sheet');
      // Extract unique batches from mapping sheet
      const uniqueBatches = [...new Set(mappingSheet.map(row => row.Batch).filter(Boolean))];
      batchSheet = uniqueBatches.map(batch => ({
        'Batch': batch,
        'Mentoring Round': 'Round 1', // Default value
        'Period': '2024' // Default value
      }));
    }

    const sessionsByMentee = new Map();

    // Process Bangkit sessions (V8 sheet)
    for (const session of sessionSheet) {
      const menteeName = session['Nama Usahawan'];
      if (!menteeName) continue;

      // Read all 12 month columns for sales data
      const sessionData = {
        reportLabel: session['Sesi Laporan'] || '',
        status: session['Status Sesi'] || '',
        programType: 'bangkit',
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

    // Process Maju sessions (LaporanMajuUM sheet)
    for (const session of majuSheet) {
      const menteeName = (session['NAMA_MENTEE'] || '').toString().trim();
      if (!menteeName) continue;

      const sesiNumber = session['SESI_NUMBER'];
      const miaStatus = (session['MIA_STATUS'] || 'Tidak MIA').toString().trim();

      // Find mentee's batch to get round info
      const menteeRow = mappingSheet.find(r =>
        (r['Mentee'] || r['Nama Usahawan'] || '').toString().trim() === menteeName
      );

      let roundNumber = '1';
      if (menteeRow) {
        const batch = menteeRow['Batch'];
        const batchInfo = batchSheet?.find(b => b['Batch'] === batch);
        if (batchInfo) {
          const roundLabel = batchInfo['Mentoring Round'] || 'Round 1';
          const roundMatch = roundLabel.match(/\d+$/);
          roundNumber = roundMatch ? roundMatch[0] : '1';
        }
      }

      // Construct report label similar to Bangkit format
      const reportLabel = `Sesi #${sesiNumber} (Round ${roundNumber})`;

      const sessionData = {
        reportLabel,
        status: miaStatus.toLowerCase() === 'mia' ? 'MIA' : 'Selesai',
        programType: 'maju',
        sesiNumber,
        miaStatus,
        // Maju stores sales data in JSON format
        dataKewanganJson: session['DATA_KEWANGAN_BULANAN_JSON'] || '',
      };

      if (!sessionsByMentee.has(menteeName)) {
        sessionsByMentee.set(menteeName, []);
      }
      sessionsByMentee.get(menteeName).push(sessionData);
    }

    console.log(`✅ Processed ${sessionSheet.length} Bangkit sessions and ${majuSheet.length} Maju sessions`);

    const batches = [];

    for (const batch of batchSheet) {
      const { 'Batch': batchName, 'Mentoring Round': roundLabel, 'Period': period } = batch;
      if (!batchName) continue;

      console.log(`🔍 Processing batch: "${batchName}" (Round: ${roundLabel})`);
      const filteredMap = mappingSheet.filter(row => row.Batch === batchName);

      if (filteredMap.length === 0) {
        console.log(`⚠️ No mapping data found for batch: "${batchName}"`);
        console.log(`   Available batches in mapping:`, [...new Set(mappingSheet.map(r => r.Batch).filter(Boolean))].slice(0, 5));
        continue;
      }
      console.log(`✅ Found ${filteredMap.length} mapping rows for batch: "${batchName}"`);

      const mentorMap = {};
      let skippedRows = 0;
      for (const row of filteredMap) {
        const { Mentor: mentor, Mentee: mentee, Zon: zone } = row;
        if (!mentor || !mentee) {
          skippedRows++;
          continue;
        }

        // Use composite key: mentor + zone to support mentors in multiple zones
        const normalizedZone = zone || 'N/A';
        const mentorZoneKey = `${mentor}|||${normalizedZone}`;

        if (!mentorMap[mentorZoneKey]) {
            mentorMap[mentorZoneKey] = {
              mentorName: mentor,
              mentees: [],
              zone: normalizedZone
            };
        }
        mentorMap[mentorZoneKey].mentees.push(mentee);
      }
      if (skippedRows > 0) {
        console.log(`⚠️ Skipped ${skippedRows} rows with missing Mentor or Mentee data`);
      }

      // DEBUG: Log all mentor-zone combinations found in this batch
      const mentorZonePairs = Object.values(mentorMap).map(m => `${m.mentorName} (${m.zone})`);
      console.log(`📝 Mentor-Zone pairs in batch "${batchName}":`, mentorZonePairs);

      const mentors = Object.entries(mentorMap).map(([mentor, data]) => {
        let totalSessions = 0;
        let miaCount = 0;
        let salesDataCount = 0;
        const expectedSessions = data.mentees.length;
        
        // Use a regular expression to reliably get the number
        const roundMatch = (roundLabel || 'Round 1').match(/\d+$/);
        const roundNumber = roundMatch ? roundMatch[0] : '1';

        data.mentees.forEach(name => {
          const menteeSessions = sessionsByMentee.get(name) || [];

          const reportsForThisRound = menteeSessions.filter(session => {
            if (!session.reportLabel) return false;

            // Extract round number from report label
            // For Maju: "Sesi #1 (Round 1)" -> extract "1" from "(Round X)"
            // For Bangkit: "Sesi 1 Round 1" -> extract "1" from end
            let reportRoundNumber = null;

            const majuMatch = session.reportLabel.match(/Round (\d+)\)/);
            if (majuMatch) {
              reportRoundNumber = majuMatch[1];
            } else {
              const bangkitMatch = session.reportLabel.match(/\d+$/);
              reportRoundNumber = bangkitMatch ? bangkitMatch[0] : null;
            }

            return reportRoundNumber === roundNumber;
          });

          const completedSessions = reportsForThisRound.filter(r => r.status === 'Selesai');
          // Count mentee as completed if they have at least 1 completed session this round
          if (completedSessions.length > 0) {
            totalSessions += 1; // Count 1 per mentee, not all sessions
          }

          const miaSessions = reportsForThisRound.filter(r => r.status === 'MIA');
          if (miaSessions.length > 0) {
            miaCount += 1; // Count 1 per mentee, not all MIA sessions
          }

          // Count mentee as having sales data if at least one completed session has sales data
          const salesDataCompleteSessions = completedSessions.filter(session => {
            if (session.programType === 'maju') {
              // For Maju: Check if DATA_KEWANGAN_BULANAN_JSON has content
              const jsonData = session.dataKewanganJson;
              if (!jsonData || jsonData === '') return false;

              try {
                const parsed = JSON.parse(jsonData);
                // Check if JSON array has at least one entry with sales data
                return Array.isArray(parsed) && parsed.length > 0;
              } catch (e) {
                return false;
              }
            } else {
              // For Bangkit: Check if at least one month column has a value
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
              return months.some(month => session[month] && session[month] !== '');
            }
          });
          if (salesDataCompleteSessions.length > 0) {
            salesDataCount += 1; // Count 1 per mentee
          }
        });
        
        return {
          mentorName: data.mentorName,
          zone: data.zone,
          totalMentees: data.mentees.length,
          totalSessions,
          expectedSessions,
          miaCount,
          salesDataCount,
          percent: expectedSessions ? Math.round((totalSessions / expectedSessions) * 100) : 0
        };
      });

      const zonesMap = {};
      for (const mentor of mentors) {
        if (!zonesMap[mentor.zone]) {
            zonesMap[mentor.zone] = [];
        }
        zonesMap[mentor.zone].push(mentor);
      }
      const zones = Object.entries(zonesMap).map(([zoneName, mentorList]) => ({ zoneName, mentors: mentorList }));

      if (mentors.length > 0) {
        batches.push({ 
          batchName: period ? `${batchName} - ${period}` : batchName, 
          roundLabel: roundLabel || 'Round 1', 
          zones 
        });
      }
    }

    console.log(`Found ${batches.length} batches with data`);

    // Prevent caching - always fetch fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.status(200).json(batches);
  } catch (err) {
    console.error('❌ ERROR IN /api/admin/sales-status:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
}