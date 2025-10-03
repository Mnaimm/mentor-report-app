// pages/api/debug/recent-submissions.js
import { getSheetsClient } from '../../../lib/sheets';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substr(2, 9)
  };

  console.log(`🔍 [${debugInfo.requestId}] recent-submissions debug API called`);

  try {
    // Require login
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const loginEmail = session.user.email.toLowerCase().trim();

    const client = await getSheetsClient();
    const sessionSheet = await client.getRows('V8');

    // Find all sessions for this mentor from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent submissions (last 10 for this mentor)
    const mentorSessions = sessionSheet
      .filter(row => {
        const mentorEmail = (row['Email Mentor'] || '').toLowerCase().trim();
        return mentorEmail === loginEmail;
      })
      .slice(-10) // Get last 10 submissions
      .map(row => ({
        usahawan: row['Nama Usahawan'],
        sesi: row['Sesi Laporan'],
        status: row['Status Sesi'],
        mentorEmail: row['Email Mentor'],
        timestamp: row['Timestamp'] || 'N/A',
        // Show some key fields to verify data
        hasJanuaryData: !!row['Jan'],
        hasImages: !!(row['URL Gambar Sesi'] || row['URL Gambar GW360']),
        rowNumber: sessionSheet.indexOf(row) + 2 // Google Sheets row number (1-indexed + header)
      }));

    // Get some metadata
    const totalSessionsInSheet = sessionSheet.length;
    const totalForThisMentor = sessionSheet.filter(row => {
      const mentorEmail = (row['Email Mentor'] || '').toLowerCase().trim();
      return mentorEmail === loginEmail;
    }).length;

    console.log(`📊 [${debugInfo.requestId}] Found ${mentorSessions.length} recent sessions for ${loginEmail}`);

    return res.json({
      debug: debugInfo,
      mentorEmail: loginEmail,
      recentSubmissions: mentorSessions,
      metadata: {
        totalSessionsInSheet,
        totalForThisMentor,
        lastRowInSheet: totalSessionsInSheet + 1, // Next available row
        sheetName: 'V8'
      }
    });

  } catch (e) {
    console.error(`❌ [${debugInfo.requestId}] Error in recent-submissions:`, e);
    res.status(500).json({
      error: String(e?.message || e),
      debug: debugInfo
    });
  }
}