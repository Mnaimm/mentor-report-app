import { getSheetsClient } from '../../../lib/sheets';

export default async function handler(req, res) {
  try {
    const client = await getSheetsClient();
    const mappingSheet = await client.getRows('mapping');
    const sessionSheet = await client.getRows('V8'); 
    const batchSheet = await client.getRows('batch');

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
      if (!batchName || !roundLabel) continue;
      
      const filteredMap = mappingSheet.filter(row => row.Batch === batchName);

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
        const roundMatch = roundLabel.match(/\d+$/);
        const roundNumber = roundMatch ? roundMatch[0] : null;

        data.mentees.forEach(name => {
          const menteeSessions = sessionsByMentee.get(name) || [];
          
          const reportsForThisRound = menteeSessions.filter(session => {
            if (!session.reportLabel || !roundNumber) return false;
            
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
        batches.push({ batchName: `${batchName} - ${period}`, roundLabel, zones });
      }
    }
    res.status(200).json(batches);
  } catch (err) {
    console.error('❌ ERROR IN /api/admin/sales-status:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
}