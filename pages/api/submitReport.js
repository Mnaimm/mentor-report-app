// pages/api/submitReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import { supabase } from '../../lib/supabaseClient';

/** Extract the row number from "SheetName!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

/**
 * Maps data from laporan-sesi.js (Bangkit program) to its Google Sheet row.
 * Ensure this matches your 'Bangkit' sheet column headers.
 */
const mapBangkitDataToSheetRow = (data) => {
  const row = Array(100).fill(''); // Adjust size if needed

  // A–J
  row[0] = new Date().toISOString();                     // 0  Timestamp
  row[1] = data?.mentorEmail || '';                      // 1  Email Mentor
  row[2] = data?.status || 'Selesai';                    // 2  Status Sesi
  row[3] = `Sesi #${data?.sesiLaporan ?? ''}`;           // 3  Sesi Laporan
  row[4] = data?.sesi?.date || '';                       // 4  Tarikh Sesi
  row[5] = data?.sesi?.time || '';                       // 5  Masa Sesi
  row[6] = data?.sesi?.platform || '';                   // 6  Mod Sesi
  row[7] = data?.usahawan || '';                         // 7  Nama Usahawan
  row[8] = data?.namaSyarikat || '';                     // 8  Nama Bisnes
  row[9] = data?.namaMentor || '';                       // 9  Nama Mentor

  // K: Kemaskini Inisiatif Sesi Lepas (textarea for sesi 2–4)
  const kemaskiniText = (data?.kemaskiniInisiatif || [])
    .map((t, i) => `Kemaskini Inisiatif #${i + 1}:\n${t}`)
    .join('\n\n');
  row[10] = kemaskiniText;                               // 10 Update Keputusan Terdahulu 1

  // L: Ringkasan Sesi
  row[11] = data?.rumusan || '';                         // 11 Ringkasan Sesi

  // M–X: Fokus/Keputusan/Cadangan 1..4
  for (let i = 0; i < 4; i++) {
    const ini = data?.inisiatif?.[i];
    const base = 12 + i * 3; // 12,15,18,21
    if (ini) {
      row[base + 0] = ini?.focusArea || '';              // 12/15/18/21 Fokus Area n
      row[base + 1] = ini?.keputusan || '';              // 13/16/19/22 Keputusan n
      row[base + 2] = ini?.pelanTindakan || '';          // 14/17/20/23 Cadangan Tindakan n
    }
  }

  // Y–AJ: Jualan 12 bulan (24..35)
  (data?.jualanTerkini || []).forEach((v, i) => {
    if (i < 12) row[24 + i] = v ?? '0';
  });

  // AK: Link Gambar (session; JSON array format like Laporan Maju)
  row[36] = JSON.stringify(data?.imageUrls?.sesi || []);

  // AL–AM
  row[37] = data?.tambahan?.produkServis || '';         // 37 Produk/Servis
  row[38] = data?.tambahan?.pautanMediaSosial || '';    // 38 Pautan Media Sosial

  // AN: GrowthWheel chart
  row[39] = data?.imageUrls?.growthwheel || '';         // 39 Link_Carta_GrowthWheel

  // AO: Bukti MIA (only if status === 'MIA') - This is `imageUrls.mia` from laporan-sesi.js
  row[40] = data?.status === 'MIA' ? (data?.imageUrls?.mia || '') : ''; // 40 Link_Bukti_MIA

  // AP–AW: Sesi 1 extras (safe blank for 2–4)
  row[41] = data?.pemerhatian || '';                    // 41 Panduan_Pemerhatian_Mentor
  row[42] = data?.refleksi?.perasaan || '';             // 42 Refleksi_Perasaan
  row[43] = data?.refleksi?.skor || '';                 // 43 Refleksi_Skor
  row[44] = data?.refleksi?.alasan || '';               // 44 Refleksi_Alasan_Skor
  row[45] = data?.refleksi?.eliminate || '';            // 45 Refleksi_Eliminate
  row[46] = data?.refleksi?.raise || '';                // 46 Refleksi_Raise
  row[47] = data?.refleksi?.reduce || '';               // 47 Refleksi_Reduce
  row[48] = data?.refleksi?.create || '';               // 48 Refleksi_Create

  // AX–AY: Profile & Premis photos
  row[49] = data?.imageUrls?.profil || '';              // 49 Link_Gambar_Profil
  row[50] = JSON.stringify(data?.imageUrls?.premis || []); // 50 Link_Gambar_Premis (JSON array format like Laporan Maju)

  // AZ: Premis checkbox
  row[51] = !!data?.premisDilawatChecked;               // 51 Premis_Dilawat_Checked

  // BA–BB left blank — Apps Script fills "Status" & "DOC_URL"
  // row[52] = ''; // Status
  // row[53] = ''; // DOC_URL

  // BC.. GW scores if you capture them
  (data?.gwSkor || []).slice(0, 20).forEach((v, i) => {
    row[54 + i] = v ?? '';
  });

  return row;
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;
    const { programType } = reportData; // Extract programType from the payload

    if (!programType) {
      return res.status(400).json({ error: 'Program type is missing in the request body.' });
    }

    // Auth
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // IMPORTANT: This 'spreadsheetId' MUST be the one that contains BOTH Bangkit and Maju tabs.
    // If you have separate spreadsheets for Bangkit and Maju, you need to revisit this logic
    // and use `process.env.GOOGLE_SHEETS_MAJU_REPORT_ID` for 'maju' programType,
    // and `process.env.GOOGLE_SHEETS_REPORT_ID` for 'bangkit'.
    // Your previous conversation implies two separate sheets (`GOOGLE_SHEETS_REPORT_ID` and `GOOGLE_SHEETS_MAJU_REPORT_ID`).
    // So, I'll update this section to use separate spreadsheet IDs.
    let spreadsheetId;
    let range;
    let rowData;

    // Only Bangkit is handled by this endpoint now
    // Maju has its own dedicated endpoint: /api/submitMajuReport
    if (programType === 'bangkit') {
      spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
      const bangkitTab = process.env.BANGKIT_TAB || 'Bangkit'; // ✅ FIX: Use Bangkit tab name (configurable)
      range = `${bangkitTab}!A1`; // ✅ FIX: Changed from 'V8!A1' to 'Bangkit!A1'
      rowData = mapBangkitDataToSheetRow(reportData);
      if (!spreadsheetId) {
          throw new Error('Missing GOOGLE_SHEETS_REPORT_ID environment variable for Bangkit program.');
      }
    } else {
      return res.status(400).json({
        error: 'Invalid programType. This endpoint only handles "bangkit". Use /api/submitMajuReport for Maju reports.'
      });
    }

    // Append data to the determined Google Sheet and tab with 8s timeout
    console.log(`📊 Attempting to append data to ${programType} sheet...`);
    const appendRes = await Promise.race([
      sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google Sheets API timeout after 10 seconds')), 10000)
      )
    ]);
    console.log(`✅ Sheet append successful for ${programType}`);

    // Get the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    const newRowNumber = getRowNumberFromUpdatedRange(updatedRange);

    // Document will be generated automatically by Apps Script time-driven trigger
    console.log(`✅ Data saved to row ${newRowNumber}. Document will be generated automatically.`);

    // ============================================================
    // DUAL-WRITE TO SUPABASE (NON-BLOCKING)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;

    try {
      console.log('📊 Starting Supabase dual-write for Bangkit session report...');

      // Prepare Supabase payload - MUST match 'reports' table schema
      const supabasePayload = {
        // Program & Metadata
        program: 'Bangkit',
        source: 'web_form',
        status: 'submitted',
        submission_date: new Date().toISOString(),
        sheets_row_number: newRowNumber,

        // Mentor Info
        mentor_email: reportData?.mentorEmail || null,
        nama_mentor: reportData?.namaMentor || null,

        // Entrepreneur/Mentee Info (use reports table column names!)
        nama_usahawan: reportData?.usahawan || null,      // NOT 'mentee_name'
        nama_syarikat: reportData?.namaSyarikat || null,  // NOT 'company_name'

        // Session Info
        session_number: reportData?.sesiLaporan || null,
        session_date: reportData?.sesi?.date || null,
        masa_mula: reportData?.sesi?.time || null,        // NOT 'session_time'
        mod_sesi: reportData?.sesi?.platform || null,     // NOT 'session_platform'
        lokasi_f2f: reportData?.sesi?.lokasiF2F || null,  // NOT 'session_location'

        // Business Info
        produk_servis: reportData?.tambahan?.produkServis || null,
        pautan_media_sosial: reportData?.tambahan?.pautanMediaSosial || null,

        // Initiatives (JSONB array)
        inisiatif: reportData?.inisiatif || [],
        kemaskini_inisiatif: reportData?.kemaskiniInisiatif?.join('\n\n') || null,

        // Sales data (JSONB - can be null or array)
        jualan_terkini: reportData?.jualanTerkini || null,

        // Observations & Summary
        pemerhatian: reportData?.pemerhatian || null,
        rumusan: reportData?.rumusan || null,

        // Reflection (JSONB object)
        refleksi: reportData?.refleksi || null,

        // GrowthWheel scores (JSONB array)
        gw_skor: reportData?.gwSkor || null,

        // Images (JSONB object with nested structure)
        image_urls: {
          sesi: reportData?.imageUrls?.sesi || [],
          growthwheel: reportData?.imageUrls?.growthwheel || '',
          profil: reportData?.imageUrls?.profil || '',
          premis: reportData?.imageUrls?.premis || []
        },

        // Premises visit
        premis_dilawat: reportData?.premisDilawatChecked || false,

        // MIA status (TEXT field: 'Selesai' or 'MIA', NOT boolean!)
        mia_status: reportData?.status || 'Selesai',
        mia_proof_url: reportData?.imageUrls?.mia || null,
        mia_reason: reportData?.mia?.alasan || null,

        // Folder ID for Google Drive integration
        folder_id: reportData?.folder_id || null,

        // Payment fields (defaults)
        payment_status: 'pending'
      };

      const { data: insertedData, error: supabaseInsertError } = await supabase
        .from('reports')  // ✅ FIXED: Use existing 'reports' table
        .insert(supabasePayload)
        .select();

      if (supabaseInsertError) throw supabaseInsertError;

      supabaseSuccess = true;
      supabaseRecordId = insertedData?.[0]?.id || null;
      console.log(`✅ Supabase dual-write successful. Record ID: ${supabaseRecordId}`);

      // Log success to dual_write_monitoring
      await supabase.from('dual_write_monitoring').insert({
        source_system: 'google_sheets',
        target_system: 'supabase',
        operation_type: 'insert',
        table_name: 'reports',  // ✅ FIXED: Correct table name
        record_id: supabaseRecordId,
        google_sheets_row: newRowNumber,
        status: 'success',
        timestamp: new Date().toISOString(),
        metadata: {
          mentor_email: reportData?.mentorEmail,
          mentee_name: reportData?.usahawan,
          session_number: reportData?.sesiLaporan,
          program: 'Bangkit'
        }
      });

    } catch (error) {
      supabaseError = error.message;
      console.error('⚠️ Supabase dual-write failed (non-blocking):', error);

      // Log failure to dual_write_monitoring (best effort)
      try {
        await supabase.from('dual_write_monitoring').insert({
          source_system: 'google_sheets',
          target_system: 'supabase',
          operation_type: 'insert',
          table_name: 'reports',  // ✅ FIXED: Correct table name
          google_sheets_row: newRowNumber,
          status: 'failed',
          error_message: error.message,
          timestamp: new Date().toISOString(),
          metadata: {
            mentor_email: reportData?.mentorEmail,
            mentee_name: reportData?.usahawan,
            session_number: reportData?.sesiLaporan,
            program: 'Bangkit'
          }
        });
      } catch (monitoringError) {
        console.error('⚠️ Failed to log to dual_write_monitoring:', monitoringError);
      }
    }
    // ============================================================
    // END DUAL-WRITE TO SUPABASE
    // ============================================================

    // Invalidate relevant cache entries on successful submission
    const mentorEmail = reportData?.mentorEmail;
    if (mentorEmail) {
      const cacheKeysToInvalidate = [
        `mentor-stats:${mentorEmail.toLowerCase().trim()}`,
        'mapping:bangkit',
        'mapping:maju'
      ];

      for (const key of cacheKeysToInvalidate) {
        cache.delete(key);
      }

      console.log(`🗑️ Cache invalidated for mentor: ${mentorEmail}`);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Laporan berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.',
      rowNumber: newRowNumber
    });

  } catch (error) {
    console.error('❌ Error in /api/submitReport:', error);

    // Specific timeout error handling
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'Timeout - sila cuba lagi dalam beberapa saat',
        details: error.message,
        phase: error.message.includes('Sheets') ? 'sheet_write_timeout' : 'unknown_timeout',
        retryable: true
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: `Gagal menghantar laporan: ${error.message}`,
      details: error.message,
      retryable: false
    });
  }
}
