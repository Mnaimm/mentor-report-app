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
    for (const session of sessionSheet) {
      const menteeName = session['Nama Usahawan'];
      if (!menteeName) continue;

      // Read all 12 month columns for sales data
      const sessionData = {
        reportLabel: session['Sesi Laporan'] || '',
        status: session['Status Sesi'] || '',
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

    const batches = [];

    for (const batch of batchSheet) {
      const { 'Batch': batchName, 'Mentoring Round': roundLabel, 'Period': period } = batch;
      if (!batchName) continue;
      
      const filteredMap = mappingSheet.filter(row => row.Batch === batchName);

      if (filteredMap.length === 0) {
        console.log(`No mapping data found for batch: ${batchName}`);
        continue;
      }

      const mentorMap = {};
      for (const row of filteredMap) {
        const { Mentor: mentor, Mentee: mentee, Zon: zone } = row;
        if (!mentor || !mentee) continue;
        if (!mentorMap[mentor]) {
            mentorMap[mentor] = { mentees: [], zone: zone || 'N/A' };
        }
        mentorMap[mentor].mentees.push(mentee);
      }

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
            
            // Use a regular expression to reliably get the number
            const reportMatch = session.reportLabel.match(/\d+$/);
            const reportNumber = reportMatch ? reportMatch[0] : null;

            return reportNumber === roundNumber;
          });

          const completedSessions = reportsForThisRound.filter(r => r.status === 'Selesai');
          totalSessions += completedSessions.length;
          
          const miaSessions = reportsForThisRound.filter(r => r.status === 'MIA');
          miaCount += miaSessions.length;

          // Count completed sessions that have sales data
          const salesDataCompleteSessions = completedSessions.filter(session => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
            // Check if at least one month column has a value
            return months.some(month => session[month] && session[month] !== '');
          });
          salesDataCount += salesDataCompleteSessions.length;
        });
        
        return {
          mentorName: mentor,
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
    res.status(200).json(batches);
  } catch (err) {
    console.error('❌ ERROR IN /api/admin/sales-status:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
}