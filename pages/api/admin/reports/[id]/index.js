import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { canAccessAdmin } from '../../../../../lib/auth';
import { getDocUrlFromSheet, findRowNumberByDetails } from '../../../../../lib/googleSheets';

// Use SERVICE_ROLE_KEY for admin endpoints (bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hasAccess = await canAccessAdmin(session.user.email);
    if (!hasAccess) {
        return res.status(403).json({ success: false, error: 'Access denied - Admin role required' });
    }

    const { id } = req.query;

    try {
        // 1. Fetch Report from Supabase
        const { data: report, error } = await supabase
            .from('reports')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

        // 2. Hybrid Sync Logic: Check if document_url is present
        let finalDocUrl = report.document_url;
        let urlUpdated = false;

        // Fallback: If row number is missing, try to find it
        if (!report.sheets_row_number) {
            const menteeName = report.nama_usahawan || report.nama_mentee;
            console.log(`🔍 [Hybrid Sync] Row number missing for ${menteeName} (Session ${report.session_number}). Searching Sheets...`);
            try {
                const foundRow = await findRowNumberByDetails(report.program, menteeName, report.session_number);
                if (foundRow) {
                    report.sheets_row_number = foundRow;
                    console.log(`✅ [Hybrid Sync] Found matching row: ${foundRow}`);
                    // Update DB with the found row number immediately
                    await supabase
                        .from('reports')
                        .update({ sheets_row_number: foundRow })
                        .eq('id', id);
                } else {
                    console.warn(`⚠️ [Hybrid Sync] Could not find row for ${menteeName} in Sheets.`);
                }
            } catch (findErr) {
                console.error(`❌ [Hybrid Sync] Error searching for row:`, findErr);
            }
        }

        if (!finalDocUrl && report.sheets_row_number) {
            console.log(`🔍 [Hybrid Sync] Document URL missing for Report ${id}. Fetching from Sheets (Row ${report.sheets_row_number})...`);

            try {
                const fetchedUrl = await getDocUrlFromSheet(report.program, report.sheets_row_number);

                if (fetchedUrl && fetchedUrl.startsWith('http')) {
                    finalDocUrl = fetchedUrl;
                    urlUpdated = true;

                    // 3. Update Supabase with the found URL (Self-Healing)
                    await supabase
                        .from('reports')
                        .update({ document_url: finalDocUrl })
                        .eq('id', id);

                    console.log(`✅ [Hybrid Sync] Supabase updated with URL: ${finalDocUrl}`);
                } else {
                    console.warn(`⚠️ [Hybrid Sync] URL not found in Sheets or invalid format.`);
                }
            } catch (syncErr) {
                console.error(`❌ [Hybrid Sync] Failed to sync URL:`, syncErr);
                // Non-blocking error, we still return the report
            }
        }

        // 4. Transform data for frontend
        const responseData = {
            id: report.id,
            mentor_name: report.nama_mentor || report.mentor_email,
            mentor_email: report.mentor_email,
            mentee_name: report.nama_usahawan,
            nama_syarikat: report.nama_syarikat,
            program: report.program,
            session_number: report.session_number,
            session_date: report.session_date,
            submission_date: report.submission_date,
            mod_sesi: report.mod_sesi,
            rumusan: report.rumusan,
            pemerhatian: report.pemerhatian,
            inisiatif: report.inisiatif, // JSONB array
            status: report.status,
            document_url: finalDocUrl, // Return the synced URL
            sheets_row_number: report.sheets_row_number
        };

        return res.status(200).json({ success: true, data: responseData, synced: urlUpdated });

    } catch (err) {
        console.error('Error fetching details:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
