import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { google } from 'googleapis';
import { findRowByReportId } from '../../../../../lib/googleSheets';

// Use SERVICE_ROLE_KEY for admin/mentor endpoints (bypasses RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Maps updated Bangkit data to Google Sheets row (for revision update)
 * Same structure as submitBangkit.js mapBangkitDataToSheetRow
 */
const mapBangkitDataToSheetRow = (data, miaRequestId = null) => {
  const row = Array(87).fill('');

  // A–J (0-9): Basic session info
  row[0] = new Date().toISOString();                     // A  Timestamp
  row[1] = data?.mentorEmail || '';                      // B  Email
  row[2] = data?.status || 'Selesai';                    // C  Status Sesi
  row[3] = `Sesi #${data?.sesiLaporan ?? ''}`;           // D  Sesi Laporan
  row[4] = data?.sesi?.date || '';                       // E  Tarikh Sesi
  row[5] = data?.sesi?.time || '';                       // F  Masa Sesi
  row[6] = data?.sesi?.platform || '';                   // G  Mod Sesi
  row[7] = data?.usahawan || '';                         // H  Nama Usahawan
  row[8] = data?.namaSyarikat || '';                     // I  Nama Bisnes
  row[9] = data?.namaMentor || '';                       // J  Nama Mentor

  // K (10): Kemaskini Inisiatif Sesi Lepas
  const kemaskiniText = (data?.kemaskiniInisiatif || [])
    .map((t, i) => `Kemaskini Inisiatif #${i + 1}:\n${t}`)
    .join('\n\n');
  row[10] = kemaskiniText;

  // L (11): Ringkasan Sesi
  row[11] = data?.rumusan || '';

  // M–X (12-23): Fokus/Keputusan/Cadangan 1..4
  for (let i = 0; i < 4; i++) {
    const ini = data?.inisiatif?.[i];
    const base = 12 + i * 3;
    if (ini) {
      row[base + 0] = ini?.focusArea || '';
      row[base + 1] = ini?.keputusan || '';
      row[base + 2] = ini?.pelanTindakan || '';
    }
  }

  // Y–AJ (24-35): Jualan 12 bulan
  (data?.jualanTerkini || []).forEach((v, i) => {
    if (i < 12) row[24 + i] = v ?? '0';
  });

  // AK (36): Link Gambar
  row[36] = JSON.stringify(data?.imageUrls?.sesi || []);

  // AL–AM (37-38): Business info
  row[37] = data?.tambahan?.produkServis || '';
  row[38] = data?.tambahan?.pautanMediaSosial || '';

  // AN (39): GrowthWheel chart
  row[39] = data?.imageUrls?.growthwheel || '';

  // AO (40): Bukti MIA (legacy)
  row[40] = data?.status === 'MIA' && data?.imageUrls?.mia?.whatsapp ? data.imageUrls.mia.whatsapp : '';

  // AP–AW (41-48): Sesi 1 reflection fields
  row[41] = data?.pemerhatian || '';
  row[42] = data?.refleksi?.perasaan || '';
  row[43] = data?.refleksi?.skor || '';
  row[44] = data?.refleksi?.alasan || '';
  row[45] = data?.refleksi?.eliminate || '';
  row[46] = data?.refleksi?.raise || '';
  row[47] = data?.refleksi?.reduce || '';
  row[48] = data?.refleksi?.create || '';

  // AX–AY (49-50): Profile & Premis photos
  row[49] = data?.imageUrls?.profil || '';
  row[50] = JSON.stringify(data?.imageUrls?.premis || []);

  // AZ (51): Premis checkbox
  row[51] = !!data?.premisDilawatChecked;

  // BC-CB (54-81): UPWARD MOBILITY DATA
  let umData = {};
  if (data?.status !== 'MIA' && data?.UPWARD_MOBILITY_JSON) {
    try {
      umData = JSON.parse(data.UPWARD_MOBILITY_JSON);
    } catch (e) {
      console.error('Failed to parse UPWARD_MOBILITY_JSON:', e);
    }
  }

  row[54] = umData.UM_STATUS_PENGLIBATAN || '';
  row[55] = umData.UM_STATUS || '';
  row[56] = umData.UM_KRITERIA_IMPROVEMENT || '';
  row[57] = umData.UM_AKAUN_BIMB || '';
  row[58] = umData.UM_BIMB_BIZ || '';
  row[59] = umData.UM_AL_AWFAR || '';
  row[60] = umData.UM_MERCHANT_TERMINAL || '';
  row[61] = umData.UM_FASILITI_LAIN || '';
  row[62] = umData.UM_MESINKIRA || '';
  row[63] = umData.UM_PENDAPATAN_SEMASA || '';
  row[64] = umData.UM_ULASAN_PENDAPATAN || '';
  row[65] = umData.UM_PEKERJA_SEMASA || '';
  row[66] = umData.UM_ULASAN_PEKERJA || '';
  row[67] = umData.UM_ASET_BUKAN_TUNAI_SEMASA || '';
  row[68] = umData.UM_PEKERJA_PARTTIME_SEMASA || '';
  row[69] = umData.UM_ULASAN_PEKERJA_PARTTIME || '';
  row[70] = umData.UM_ULASAN_ASET_BUKAN_TUNAI || '';
  row[71] = umData.UM_SIMPANAN_SEMASA || '';
  row[72] = umData.UM_ULASAN_SIMPANAN || '';
  row[73] = umData.UM_ZAKAT_SEMASA || '';
  row[74] = umData.UM_ULASAN_ZAKAT || '';
  row[75] = umData.UM_DIGITAL_SEMASA || '';
  row[76] = umData.UM_ULASAN_DIGITAL || '';
  row[77] = umData.UM_MARKETING_SEMASA || '';
  row[78] = umData.UM_ULASAN_MARKETING || '';
  row[79] = umData.UM_TARIKH_LAWATAN_PREMIS || '';

  // CE-CI (82-86): Enhanced MIA Proof Workflow
  row[82] = data?.imageUrls?.mia?.whatsapp || '';
  row[83] = data?.imageUrls?.mia?.email || '';
  row[84] = data?.imageUrls?.mia?.call || '';
  row[85] = data?.mia?.alasan || '';
  row[86] = miaRequestId || '';

  return row;
};

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { id } = req.query;
    const reportData = req.body;

    try {
        // 1. Fetch existing report to verify ownership and status
        const { data: existingReport, error: fetchError } = await supabase
            .from('reports')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existingReport) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        // 2. Security check: verify mentor_email matches session
        if (existingReport.mentor_email !== session.user.email) {
            return res.status(403).json({ success: false, error: 'Access denied - You can only revise your own reports' });
        }

        // 3. Verify report status is 'review_requested'
        if (existingReport.status !== 'review_requested') {
            return res.status(400).json({ success: false, error: 'Only reports with status "review_requested" can be revised' });
        }

        console.log(`📝 Processing revision for report ${id} by ${session.user.email}`);

        // ============================================================
        // STEP 1: UPDATE SUPABASE (BLOCKING - PRIMARY SOURCE OF TRUTH)
        // ============================================================

        // Parse GrowthWheel data if present
        let gwSkor = null;
        if (reportData.gwFrameworkScores && Array.isArray(reportData.gwFrameworkScores)) {
            gwSkor = reportData.gwFrameworkScores;
        }

        // Parse Upward Mobility JSON if present
        let umJsonData = null;
        if (reportData.UPWARD_MOBILITY_JSON) {
            try {
                umJsonData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);
            } catch (e) {
                console.error('Failed to parse UPWARD_MOBILITY_JSON:', e);
            }
        }

        // Detect program type to use correct field mappings
        const isMaju = existingReport.program?.toLowerCase().includes('maju');

        let supabasePayload = {};

        if (isMaju) {
            // MAJU format (uses DATA_KEWANGAN_BULANAN_JSON, MENTORING_FINDINGS_JSON, etc.)
            supabasePayload = {
                // Session details
                session_date: reportData?.TARIKH_SESI || null,
                mod_sesi: reportData?.MOD_SESI || null,
                lokasi_f2f: reportData?.LOKASI_F2F || null,
                masa_mula: reportData?.MASA_MULA || null,
                masa_tamat: reportData?.MASA_TAMAT || null,

                // Business Info
                latarbelakang_usahawan: reportData?.LATARBELAKANG_USAHAWAN || null,
                nama_bisnes: reportData?.NAMA_BISNES || null,
                lokasi_bisnes: reportData?.LOKASI_BISNES || null,
                produk_servis: reportData?.PRODUK_SERVIS || null,
                no_telefon: reportData?.NO_TELEFON || null,
                status_perniagaan: reportData?.STATUS_PERNIAGAAN_KESELURUHAN || null,
                rumusan_langkah_kehadapan: reportData?.RUMUSAN_DAN_LANGKAH_KEHADAPAN || null,

                // Financial & Mentoring Data (JSONB)
                data_kewangan_bulanan: reportData?.DATA_KEWANGAN_BULANAN_JSON || [],
                mentoring_findings: reportData?.MENTORING_FINDINGS_JSON || [],

                // Images (construct object from URL fields)
                image_urls: {
                    premis: reportData?.URL_GAMBAR_PREMIS_JSON || [],
                    sesi: reportData?.URL_GAMBAR_SESI_JSON || [],
                    growthwheel: reportData?.URL_GAMBAR_GW360 || '',
                    mia: reportData?.imageUrls?.mia || null
                },

                // Reflection
                refleksi_mentor_perasaan: reportData?.REFLEKSI_MENTOR_PERASAAN || null,
                refleksi_mentor_komitmen: reportData?.REFLEKSI_MENTOR_KOMITMEN || null,
                refleksi_mentor_lain: reportData?.REFLEKSI_MENTOR_LAIN || null,

                // Upward Mobility
                upward_mobility_data: reportData?.UPWARD_MOBILITY || umJsonData,

                // MIA status
                mia_status: reportData?.MIA_STATUS || existingReport.mia_status,
                mia_reason: reportData?.MIA_REASON || existingReport.mia_reason,
                mia_proof_url: reportData?.imageUrls?.mia?.whatsapp || existingReport.mia_proof_url,

                // Status updates
                status: 'submitted',
                revision_reason: null,
                revision_notes: null,
                revision_requested_by: null,
                revision_requested_at: null,
                updated_at: new Date().toISOString()
            };
        } else {
            // BANGKIT format (original format)
            supabasePayload = {
                // Session details
                session_date: reportData?.sesi?.date || null,
                session_time: reportData?.sesi?.time || null,
                session_platform: reportData?.sesi?.platform || null,
                session_location_f2f: reportData?.sesi?.lokasiF2F || null,

                // Business background
                business_background: reportData?.latarBelakangUsahawan || null,
                product_service: reportData?.tambahan?.produkServis || null,
                social_media_links: reportData?.tambahan?.pautanMediaSosial || null,

                // Initiatives
                inisiatif: reportData?.inisiatif || [],
                kemaskini_inisiatif: reportData?.kemaskiniInisiatif || [],

                // Teknologi adoption
                teknologi: reportData?.teknologi || [],

                // Sales data (12-month array)
                jualan_terkini: reportData?.jualanTerkini || Array(12).fill(0),

                // GrowthWheel scores
                gw_skor: gwSkor,

                // Summary and reflection
                rumusan: reportData?.rumusan || null,
                pemerhatian: reportData?.pemerhatian || null,
                refleksi_perasaan: reportData?.refleksi?.perasaan || null,
                refleksi_skor: reportData?.refleksi?.skor || null,
                refleksi_alasan: reportData?.refleksi?.alasan || null,
                refleksi_eliminate: reportData?.refleksi?.eliminate || null,
                refleksi_raise: reportData?.refleksi?.raise || null,
                refleksi_reduce: reportData?.refleksi?.reduce || null,
                refleksi_create: reportData?.refleksi?.create || null,

                // Image URLs
                image_urls: reportData?.imageUrls || {},

                // Premis visited flag
                premis_dilawat: reportData?.premisDilawatChecked || false,

                // Upward Mobility JSON
                upward_mobility_data: umJsonData,

                // MIA status (keep existing if not changed)
                mia_status: reportData?.status || existingReport.mia_status,
                mia_proof_url: reportData?.imageUrls?.mia?.whatsapp || existingReport.mia_proof_url,
                mia_reason: reportData?.mia?.alasan || existingReport.mia_reason,

                // Update status back to 'submitted' (to re-trigger admin review)
                status: 'submitted',

                // Clear revision fields
                revision_reason: null,
                revision_notes: null,
                revision_requested_by: null,
                revision_requested_at: null,

                // Update timestamp
                updated_at: new Date().toISOString()
            };
        }

        const { error: updateError } = await supabase
            .from('reports')
            .update(supabasePayload)
            .eq('id', id);

        if (updateError) {
            console.error('❌ Supabase update failed:', updateError);
            throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        console.log(`✅ Supabase update successful for report ${id}`);

        // ============================================================
        // STEP 2: UPDATE GOOGLE SHEETS (NON-BLOCKING - SECONDARY)
        // ============================================================
        let sheetsSuccess = false;
        let sheetsError = null;

        try {
            // Find the row in Google Sheets using sheets_row_number or report_id
            let rowNumber = existingReport.sheets_row_number;

            // If no row number stored, try to find by report_id in payment tracking sheet
            if (!rowNumber) {
                rowNumber = await findRowByReportId(existingReport.program, id);
            }

            if (rowNumber) {
                // Setup Google Sheets API
                const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
                const credentials = JSON.parse(credentialsJson);
                const auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                const sheets = google.sheets({ version: 'v4', auth });

                // Determine spreadsheet ID and tab based on program
                const spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
                const tabName = process.env.Bangkit_TAB || 'Bangkit';

                // Map data to sheet row
                const rowData = mapBangkitDataToSheetRow(reportData);

                // Update the row in Google Sheets
                const range = `${tabName}!A${rowNumber}:CI${rowNumber}`;

                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [rowData]
                    }
                });

                sheetsSuccess = true;
                console.log(`✅ Sheets update successful at row ${rowNumber}`);
            } else {
                console.warn(`⚠️ Could not find sheets row for report ${id}`);
                sheetsError = 'Row number not found';
            }

        } catch (error) {
            sheetsError = error.message;
            console.error('⚠️ Sheets update failed (non-blocking):', error);
            // Don't throw - Sheets failure is non-blocking
        }

        // 3. Log to dual_write_logs
        try {
            await supabase.from('dual_write_logs').insert({
                operation_type: 'revise_report',
                table_name: 'reports',
                record_id: id,
                supabase_success: true,
                sheets_success: sheetsSuccess,
                sheets_error: sheetsError,
                program: existingReport.program || 'Bangkit',
                created_at: new Date().toISOString(),
                metadata: {
                    mentor_email: session.user.email,
                    previous_status: 'review_requested',
                    new_status: 'submitted'
                }
            });
        } catch (logError) {
            console.error('⚠️ Failed to log to dual_write_logs:', logError);
        }

        return res.status(200).json({
            success: true,
            message: 'Report revised successfully and resubmitted for review',
            reportId: id
        });

    } catch (err) {
        console.error('❌ Error revising report:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
