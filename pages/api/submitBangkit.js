// pages/api/submitReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import { supabase } from '../../lib/supabaseClient';
import { prepareMIARequestPayload, MIA_STATUS } from '../../lib/mia';


/** Extract the row number from "SheetName!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

/**
 * Maps data from laporan-bangkit.js (Bangkit program) to its Google Sheet row.
 * Ensure this matches your 'Bangkit' sheet column headers.
 * Columns A-AZ (0-51): Session data
 * Columns BA-BB (52-53): Apps Script fills these
 * Columns BC-CB (54-81): Upward Mobility data (28 columns)
 */
const mapBangkitDataToSheetRow = (data, miaRequestId = null) => {
  const row = Array(87).fill(''); // Columns 0-86 (87 total) - extended for MIA enhancements

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
  row[10] = kemaskiniText;                               // K  Update Keputusan Terdahulu 1

  // L (11): Ringkasan Sesi
  row[11] = data?.rumusan || '';                         // L  Ringkasan Sesi

  // M–X (12-23): Fokus/Keputusan/Cadangan 1..4 (4 initiatives × 3 fields = 12 columns)
  for (let i = 0; i < 4; i++) {
    const ini = data?.inisiatif?.[i];
    const base = 12 + i * 3;
    if (ini) {
      row[base + 0] = ini?.focusArea || '';              // M/P/S/V Fokus Area n
      row[base + 1] = ini?.keputusan || '';              // N/Q/T/W Keputusan n
      row[base + 2] = ini?.pelanTindakan || '';          // O/R/U/X Cadangan Tindakan n
    }
  }

  // Y–AJ (24-35): Jualan 12 bulan
  (data?.jualanTerkini || []).forEach((v, i) => {
    if (i < 12) row[24 + i] = v ?? '0';
  });

  // AK (36): Link Gambar
  row[36] = JSON.stringify(data?.imageUrls?.sesi || []);

  // AL–AM (37-38): Business info
  row[37] = data?.tambahan?.produkServis || '';         // AL Produk/Servis
  row[38] = data?.tambahan?.pautanMediaSosial || '';    // AM Pautan Media Sosial

  // AN (39): GrowthWheel chart
  row[39] = data?.imageUrls?.growthwheel || '';         // AN Link_Carta_GrowthWheel

  // AO (40): Bukti MIA (legacy - keep for backward compatibility)
  row[40] = data?.status === 'MIA' && data?.imageUrls?.mia?.whatsapp ? data.imageUrls.mia.whatsapp : '';

  // AP–AW (41-48): Sesi 1 reflection fields
  row[41] = data?.pemerhatian || '';                    // AP Panduan_Pemerhatian_Mentor
  row[42] = data?.refleksi?.perasaan || '';             // AQ Refleksi_Perasaan
  row[43] = data?.refleksi?.skor || '';                 // AR Refleksi_Skor
  row[44] = data?.refleksi?.alasan || '';               // AS Refleksi_Alasan_Skor
  row[45] = data?.refleksi?.eliminate || '';            // AT Refleksi_Eliminate
  row[46] = data?.refleksi?.raise || '';                // AU Refleksi_Raise
  row[47] = data?.refleksi?.reduce || '';               // AV Refleksi_Reduce
  row[48] = data?.refleksi?.create || '';               // AW Refleksi_Create

  // AX–AY (49-50): Profile & Premis photos
  row[49] = data?.imageUrls?.profil || '';              // AX Link_Gambar_Profil
  row[50] = JSON.stringify(data?.imageUrls?.premis || []); // AY Link_Gambar_Premis

  // AZ (51): Premis checkbox
  row[51] = !!data?.premisDilawatChecked;               // AZ Premis_Dilawat_Checked

  // BA–BB (52-53): Apps Script fills "Status" & "DOC_URL" - leave blank
  // row[52] = ''; // BA Status (Apps Script)
  // row[53] = ''; // BB DOC_URL (Apps Script)

  // BC-CB (54-81): UPWARD MOBILITY DATA - ALWAYS POPULATED (28 columns)
  // Parse UM data if available
  let umData = {};
  if (data?.status !== 'MIA' && data?.UPWARD_MOBILITY_JSON) {
    try {
      umData = JSON.parse(data.UPWARD_MOBILITY_JSON);
    } catch (e) {
      console.error('Failed to parse UPWARD_MOBILITY_JSON:', e);
    }
  }

  // Section 1: Engagement Status (3 fields)
  row[54] = umData.UM_STATUS_PENGLIBATAN || '';         // BC UM_STATUS_PENGLIBATAN
  row[55] = umData.UM_STATUS || '';                     // BD UM_STATUS
  row[56] = umData.UM_KRITERIA_IMPROVEMENT || '';       // BE UM_KRITERIA_IMPROVEMENT

  // Section 2: BIMB Channels & Fintech (6 fields)
  row[57] = umData.UM_AKAUN_BIMB || '';                 // BF UM_AKAUN_BIMB
  row[58] = umData.UM_BIMB_BIZ || '';                   // BG UM_BIMB_BIZ
  row[59] = umData.UM_AL_AWFAR || '';                   // BH UM_AL_AWFAR
  row[60] = umData.UM_MERCHANT_TERMINAL || '';          // BI UM_MERCHANT_TERMINAL
  row[61] = umData.UM_FASILITI_LAIN || '';              // BJ UM_FASILITI_LAIN
  row[62] = umData.UM_MESINKIRA || '';                  // BK UM_MESINKIRA

  // Section 3: Financial & Employment Metrics (12 fields: 6 values + 6 ulasan)
  row[63] = umData.UM_PENDAPATAN_SEMASA || '';          // BL UM_PENDAPATAN_SEMASA
  row[64] = umData.UM_ULASAN_PENDAPATAN || '';          // BM UM_ULASAN_PENDAPATAN
  row[65] = umData.UM_PEKERJA_SEMASA || '';             // BN UM_PEKERJA_SEMASA
  row[66] = umData.UM_ULASAN_PEKERJA || '';             // BO UM_ULASAN_PEKERJA
  row[67] = umData.UM_ASET_BUKAN_TUNAI_SEMASA || '';    // BP UM_ASET_BUKAN_TUNAI_SEMASA
  row[68] = umData.UM_PEKERJA_PARTTIME_SEMASA || '';    // BQ UM_PEKERJA_PARTTIME_SEMASA (New Slot)
  row[69] = umData.UM_ULASAN_PEKERJA_PARTTIME || '';    // BR UM_ULASAN_PEKERJA_PARTTIME (New Slot)
  row[70] = umData.UM_ULASAN_ASET_BUKAN_TUNAI || '';    // BS UM_ULASAN_ASET_BUKAN_TUNAI (Shifted)
  row[71] = umData.UM_SIMPANAN_SEMASA || '';            // BT UM_SIMPANAN_SEMASA
  row[72] = umData.UM_ULASAN_SIMPANAN || '';            // BU UM_ULASAN_SIMPANAN
  row[73] = umData.UM_ZAKAT_SEMASA || '';               // BV UM_ZAKAT_SEMASA
  row[74] = umData.UM_ULASAN_ZAKAT || '';               // BW UM_ULASAN_ZAKAT

  // Section 4: Digitalization (2 fields)
  row[75] = umData.UM_DIGITAL_SEMASA || '';             // BX UM_DIGITAL_SEMASA
  row[76] = umData.UM_ULASAN_DIGITAL || '';             // BY UM_ULASAN_DIGITAL

  // Section 5: Marketing (2 fields)
  row[77] = umData.UM_MARKETING_SEMASA || '';           // BZ UM_MARKETING_SEMASA
  row[78] = umData.UM_ULASAN_MARKETING || '';           // CA UM_ULASAN_MARKETING

  // Section 6: Premises Visit Date (1 field)
  row[79] = umData.UM_TARIKH_LAWATAN_PREMIS || '';      // CB UM_TARIKH_LAWATAN_PREMIS

  // Columns 80-81 reserved for future use
  // row[80] = ''; // CC (reserved)
  // row[81] = ''; // CD (reserved)

  return row;
};

/**
 * Maps data from laporan-bangkit.js to the Upward Mobility Google Sheet row.
 * Columns A-K: Basic info
 * Columns L-AR: Legacy fields (leave empty)
 * Columns AS-BT: UM-specific fields
 */
const mapUMToUpwardMobilitySheetRow = (reportData, umData) => {
  const row = Array(72).fill(''); // Columns 0-71 (A-BT: 72 total)

  // ✅ Columns A-K (0-10): Basic session info
  row[0] = new Date().toISOString();                     // A  Timestamp
  row[1] = reportData?.mentorEmail || '';                // B  Email Address
  row[2] = 'Bangkit';                                    // C  Program
  row[3] = reportData?.batch || '';                      // D  Batch
  row[4] = `Sesi ${reportData?.sesiLaporan ?? ''}`;      // E  Sesi Mentoring
  row[5] = reportData?.namaMentor || '';                 // F  Nama Mentor
  row[6] = reportData?.usahawan || '';                   // G  Nama Penuh Usahawan
  row[7] = reportData?.namaSyarikat || '';               // H  Nama Perniagaan
  row[8] = reportData?.tambahan?.produkServis || '';     // I  Jenis Perniagaan / Produk
  row[9] = reportData?.tambahan?.alamatPerniagaan || ''; // J  Alamat Perniagaan
  row[10] = reportData?.tambahan?.nomorTelefon || '';    // K  Nombor Telefon

  // 🚫 Columns L-AR (11-43): Legacy fields - LEAVE EMPTY (33 columns)
  // These are from the standalone UM form and must not be overwritten

  // ✅ Columns AS-BT (44-71): UM-specific fields (28 columns)
  // Section 1: Engagement Status (3 fields)
  row[44] = umData.UM_STATUS_PENGLIBATAN || '';         // AS UM_STATUS_PENGLIBATAN
  row[45] = umData.UM_STATUS || '';                     // AT UM_STATUS
  row[46] = umData.UM_KRITERIA_IMPROVEMENT || '';       // AU UM_KRITERIA_IMPROVEMENT

  // Section 2: BIMB Channels & Fintech (6 fields)
  row[47] = umData.UM_AKAUN_BIMB || '';                 // AV UM_AKAUN_BIMB
  row[48] = umData.UM_BIMB_BIZ || '';                   // AW UM_BIMB_BIZ
  row[49] = umData.UM_AL_AWFAR || '';                   // AX UM_AL_AWFAR
  row[50] = umData.UM_MERCHANT_TERMINAL || '';          // AY UM_MERCHANT_TERMINAL
  row[51] = umData.UM_FASILITI_LAIN || '';              // AZ UM_FASILITI_LAIN
  row[52] = umData.UM_MESINKIRA || '';                  // BA UM_MESINKIRA

  // Section 3: Financial & Employment Metrics (12 fields: 6 values + 6 ulasan)
  row[53] = umData.UM_PENDAPATAN_SEMASA || '';          // BB UM_PENDAPATAN_SEMASA
  row[54] = umData.UM_ULASAN_PENDAPATAN || '';          // BC UM_ULASAN_PENDAPATAN
  row[55] = umData.UM_PEKERJA_SEMASA || '';             // BD UM_PEKERJA_SEMASA
  row[56] = umData.UM_ULASAN_PEKERJA || '';             // BE UM_ULASAN_PEKERJA
  row[57] = umData.UM_ASET_BUKAN_TUNAI_SEMASA || '';    // BF UM_ASET_BUKAN_TUNAI_SEMASA
  row[58] = umData.UM_PEKERJA_PARTTIME_SEMASA || '';    // BG UM_PEKERJA_PARTTIME_SEMASA (New Slot)
  row[59] = umData.UM_ULASAN_PEKERJA_PARTTIME || '';    // BH UM_ULASAN_PEKERJA_PARTTIME (New Slot)
  row[60] = umData.UM_ULASAN_ASET_BUKAN_TUNAI || '';    // BI UM_ULASAN_ASET_BUKAN_TUNAI (Shifted)
  row[61] = umData.UM_SIMPANAN_SEMASA || '';            // BJ UM_SIMPANAN_SEMASA
  row[62] = umData.UM_ULASAN_SIMPANAN || '';            // BK UM_ULASAN_SIMPANAN
  row[63] = umData.UM_ZAKAT_SEMASA || '';               // BL UM_ZAKAT_SEMASA
  row[64] = umData.UM_ULASAN_ZAKAT || '';               // BM UM_ULASAN_ZAKAT

  // Section 4: Digitalization (2 fields)
  row[65] = umData.UM_DIGITAL_SEMASA || '';             // BN UM_DIGITAL_SEMASA
  row[66] = umData.UM_ULASAN_DIGITAL || '';             // BO UM_ULASAN_DIGITAL

  // Section 5: Marketing (2 fields)
  row[67] = umData.UM_MARKETING_SEMASA || '';           // BP UM_MARKETING_SEMASA
  row[68] = umData.UM_ULASAN_MARKETING || '';           // BQ UM_ULASAN_MARKETING

  // Section 6: Premises Visit Date (1 field)
  row[69] = umData.UM_TARIKH_LAWATAN_PREMIS || '';      // BR UM_TARIKH_LAWATAN_PREMIS

  // Remaining columns BS-BT (70-71) are reserved/future use - leave empty

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
    let miaRequestId = null;

    // ============================================================
    // CREATE MIA REQUEST RECORD (if MIA status)
    // This must happen BEFORE Sheets write so we can include the UUID
    // ============================================================
    if (reportData?.status === 'MIA') {
      console.log('📝 Creating MIA request record...');
      try {
        const miaPayload = prepareMIARequestPayload({
          mentorEmail: reportData.mentorEmail,
          mentorName: reportData.namaMentor,
          menteeName: reportData.usahawan,
          menteeIC: reportData.menteeIC || reportData.usahawan, // Use IC if available, fallback to name
          menteeCompany: reportData.namaSyarikat,
          sessionNumber: reportData.sesiLaporan,
          batch: reportData.batch,
          miaReason: reportData.mia?.alasan,
          proofWhatsappUrl: reportData.imageUrls?.mia?.whatsapp,
          proofEmailUrl: reportData.imageUrls?.mia?.email,
          proofCallUrl: reportData.imageUrls?.mia?.call
        }, 'bangkit');

        const { data: miaRequestData, error: miaError } = await supabase
          .from('mia_requests')
          .insert(miaPayload)
          .select()
          .single();

        if (miaError) {
          console.error('⚠️ Failed to create MIA request (non-blocking):', miaError);
        } else {
          miaRequestId = miaRequestData.id;
          console.log(`✅ MIA request created with ID: ${miaRequestId}`);
        }
      } catch (error) {
        console.error('⚠️ MIA request creation failed (non-blocking):', error);
      }
    }

    // Only Bangkit is handled by this endpoint now
    // Maju has its own dedicated endpoint: /api/submitMajuReport
    if (programType === 'bangkit') {
      spreadsheetId = process.env.GOOGLE_SHEETS_REPORT_ID;
      const bangkitTab = process.env.Bangkit_TAB || 'Bangkit';
      range = `${bangkitTab}!A1`; // Bangkit tab (columns A-CI: 0-86)
      rowData = mapBangkitDataToSheetRow(reportData, miaRequestId);
      if (!spreadsheetId) {
        throw new Error('Missing GOOGLE_SHEETS_REPORT_ID environment variable for Bangkit program.');
      }
      console.log('🔗 Bangkit Sheet ID:', spreadsheetId, '- Tab:', bangkitTab);
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
    // DUAL-WRITE TO UPWARD MOBILITY GOOGLE SHEET (NON-BLOCKING)
    // ============================================================
    let umSheetSuccess = false;
    let umSheetError = null;
    let umSheetRowNumber = null;

    // Only write to UM sheet if NOT MIA and UM data exists
    if (reportData.status !== 'MIA' && reportData.UPWARD_MOBILITY_JSON) {
      try {
        console.log('📊 Starting dual-write to Upward Mobility Google Sheet...');

        // Parse UM data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        // Get UM sheet configuration
        const umSpreadsheetId = process.env.GOOGLE_SHEET_ID_UM;
        const umRange = 'UM!A1';

        if (!umSpreadsheetId) {
          throw new Error('Missing GOOGLE_SHEET_ID_UM environment variable');
        }

        // Map data to UM sheet row
        const umRowData = mapUMToUpwardMobilitySheetRow(reportData, umData);

        // Append to UM sheet with 8s timeout
        const umAppendRes = await Promise.race([
          sheets.spreadsheets.values.append({
            spreadsheetId: umSpreadsheetId,
            range: umRange,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [umRowData] },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Upward Mobility Sheet API timeout after 8 seconds')), 8000)
          )
        ]);

        const umUpdatedRange = umAppendRes.data?.updates?.updatedRange || '';
        umSheetRowNumber = getRowNumberFromUpdatedRange(umUpdatedRange);
        umSheetSuccess = true;

        console.log(`✅ Upward Mobility sheet write successful. Row: ${umSheetRowNumber}`);

      } catch (error) {
        umSheetError = error.message;
        console.error('⚠️ Upward Mobility sheet write failed (non-blocking):', error);
        // This failure does NOT fail the main Bangkit submission
      }
    } else {
      console.log(`ℹ️ Skipping UM sheet write. MIA: ${reportData.status === 'MIA'}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}`);
    }
    // ============================================================
    // END UPWARD MOBILITY GOOGLE SHEET DUAL-WRITE
    // ============================================================

    // ============================================================
    // DUAL-WRITE TO SUPABASE (NON-BLOCKING)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;

    try {
      console.log('📊 Starting Supabase dual-write for Bangkit session report...');

      // Resolve entrepreneur ID BEFORE inserting into reports
      const entrepreneurEmail =
        reportData.emailUsahawan ||
        reportData.entrepreneurEmail ||
        reportData.email;

      if (!entrepreneurEmail) {
        throw new Error('Entrepreneur email not found in report data');
      }

      const { data: entrepreneur, error: entrepreneurError } = await supabase
        .from('entrepreneurs')
        .select('id')
        .eq('email', entrepreneurEmail.toLowerCase().trim())
        .single();

      if (entrepreneurError || !entrepreneur) {
        throw new Error(`Entrepreneur not found: ${entrepreneurEmail}`);
      }

      console.log(`✅ Entrepreneur resolved: ${entrepreneur.id}`);

      // Prepare Supabase payload - MUST match 'reports' table schema
      const supabasePayload = {
        // Program & Metadata
        program: 'Bangkit',
        source: 'web_form',
        status: 'submitted',
        submission_date: new Date().toISOString(),
        sheets_row_number: newRowNumber,

        // Foreign Keys
        entrepreneur_id: entrepreneur.id,

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
          premis: reportData?.imageUrls?.premis || [],
          mia: reportData?.imageUrls?.mia || null  // Can be object with {whatsapp, email, call} or null
        },

        // Premises visit
        premis_dilawat: reportData?.premisDilawatChecked || false,

        // MIA status (TEXT field: 'Selesai' or 'MIA', NOT boolean!)
        mia_status: reportData?.status || 'Selesai',
        mia_proof_url: reportData?.imageUrls?.mia?.whatsapp || null,  // Legacy field - use WhatsApp proof for backward compatibility
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

    // ============================================================
    // DUAL-WRITE TO UPWARD_MOBILITY_REPORTS TABLE (NON-BLOCKING)
    // ============================================================
    let umSuccess = false;
    let umError = null;
    let umRecordId = null;

    // For Bangkit, UM data is required EXCEPT for MIA submissions
    // Use unified check for MIA status
    if (reportData.status !== 'MIA' && reportData.UPWARD_MOBILITY_JSON && supabaseRecordId) {
      try {
        console.log('📊 Starting Upward Mobility dual-write for BANGKIT...');

        // Parse the UM JSON data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        // Get mentor and entrepreneur IDs from reports table record
        const { data: reportRecord, error: reportFetchError } = await supabase
          .from('reports')
          .select('id, mentor_email, nama_mentee')
          .eq('id', supabaseRecordId)
          .single();

        if (reportFetchError) throw reportFetchError;

        // Fetch mentor ID
        const { data: mentorData, error: mentorError } = await supabase
          .from('mentors')
          .select('id')
          .eq('email', reportRecord.mentor_email)
          .single();

        if (mentorError) throw new Error(`Mentor not found: ${mentorError.message}`);

        // Fetch entrepreneur ID (email-based lookup)
        const entrepreneurEmail =
          reportData.emailUsahawan ||
          reportData.entrepreneurEmail ||
          reportData.email ||
          reportRecord?.email;

        if (!entrepreneurEmail) {
          throw new Error('Entrepreneur email not found in report data');
        }

        const { data: entrepreneur, error: entrepreneurError } = await supabase
          .from('entrepreneurs')
          .select('id')
          .eq('email', entrepreneurEmail.toLowerCase().trim())
          .single();

        if (entrepreneurError || !entrepreneur) {
          throw new Error(`Entrepreneur not found: ${entrepreneurEmail}`);
        }

        // Build schema-whitelisted UM payload (aligned with upward_mobility_reports table)
        const umSupabasePayload = {};

        // Required foreign keys
        umSupabasePayload.entrepreneur_id = entrepreneur.id;
        umSupabasePayload.mentor_id = mentorData.id;

        // Program & Session
        if (reportData.sesiLaporan) umSupabasePayload.sesi_mentoring = `Sesi ${reportData.sesiLaporan}`;
        umSupabasePayload.program = 'BANGKIT';

        // Section 1: Status & Mobiliti
        if (umData.UM_STATUS_PENGLIBATAN) umSupabasePayload.status_penglibatan = umData.UM_STATUS_PENGLIBATAN;
        if (umData.UM_STATUS) umSupabasePayload.um_status = umData.UM_STATUS;
        if (umData.UM_KRITERIA_IMPROVEMENT) umSupabasePayload.kriteria_improvement = umData.UM_KRITERIA_IMPROVEMENT;
        if (umData.UM_TARIKH_LAWATAN_PREMIS) umSupabasePayload.tarikh_lawatan = umData.UM_TARIKH_LAWATAN_PREMIS;

        // Section 2: Bank Islam & Fintech
        if (umData.UM_AKAUN_BIMB) umSupabasePayload.bank_akaun_semasa = umData.UM_AKAUN_BIMB;
        if (umData.UM_BIMB_BIZ) umSupabasePayload.bank_bizapp = umData.UM_BIMB_BIZ;
        if (umData.UM_AL_AWFAR) umSupabasePayload.bank_al_awfar = umData.UM_AL_AWFAR;
        if (umData.UM_MERCHANT_TERMINAL) umSupabasePayload.bank_merchant_terminal = umData.UM_MERCHANT_TERMINAL;
        if (umData.UM_FASILITI_LAIN) umSupabasePayload.bank_fasiliti_lain = umData.UM_FASILITI_LAIN;
        if (umData.UM_MESINKIRA) umSupabasePayload.bank_mesinkira = umData.UM_MESINKIRA;

        // Section 3: Financial & Employment Metrics
        if (umData.UM_PENDAPATAN_SEMASA) {
          const parsed = parseFloat(umData.UM_PENDAPATAN_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.pendapatan_semasa = parsed;
        }
        if (umData.UM_ULASAN_PENDAPATAN) umSupabasePayload.ulasan_pendapatan = umData.UM_ULASAN_PENDAPATAN;

        if (umData.UM_PEKERJA_SEMASA) {
          const parsed = parseInt(umData.UM_PEKERJA_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.pekerja_semasa = parsed;
        }
        if (umData.UM_ULASAN_PEKERJA) umSupabasePayload.ulasan_pekerjaan = umData.UM_ULASAN_PEKERJA;

        if (umData.UM_ASET_BUKAN_TUNAI_SEMASA) {
          const parsed = parseFloat(umData.UM_ASET_BUKAN_TUNAI_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.aset_bukan_tunai_semasa = parsed;
        }
        if (umData.UM_ULASAN_ASET_BUKAN_TUNAI) umSupabasePayload.ulasan_aset_bukan_tunai = umData.UM_ULASAN_ASET_BUKAN_TUNAI;

        if (umData.UM_PEKERJA_PARTTIME_SEMASA) {
          const parsed = parseInt(umData.UM_PEKERJA_PARTTIME_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.pekerja_parttime_semasa = parsed;
        }
        if (umData.UM_ULASAN_PEKERJA_PARTTIME) umSupabasePayload.ulasan_pekerja_parttime = umData.UM_ULASAN_PEKERJA_PARTTIME;

        if (umData.UM_SIMPANAN_SEMASA) {
          const parsed = parseFloat(umData.UM_SIMPANAN_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.simpanan_semasa = parsed;
        }
        if (umData.UM_ULASAN_SIMPANAN) umSupabasePayload.ulasan_simpanan = umData.UM_ULASAN_SIMPANAN;

        if (umData.UM_ZAKAT_SEMASA) umSupabasePayload.zakat_semasa = umData.UM_ZAKAT_SEMASA;
        if (umData.UM_ULASAN_ZAKAT) umSupabasePayload.ulasan_zakat = umData.UM_ULASAN_ZAKAT;

        // Section 4: Digitalization
        if (umData.UM_DIGITAL_SEMASA) umSupabasePayload.digital_semasa = umData.UM_DIGITAL_SEMASA;
        if (umData.UM_ULASAN_DIGITAL) umSupabasePayload.ulasan_digital = umData.UM_ULASAN_DIGITAL;

        // Section 5: Marketing
        if (umData.UM_MARKETING_SEMASA) umSupabasePayload.marketing_semasa = umData.UM_MARKETING_SEMASA;
        if (umData.UM_ULASAN_MARKETING) umSupabasePayload.ulasan_marketing = umData.UM_ULASAN_MARKETING;

        // Timestamps
        const now = new Date().toISOString();
        umSupabasePayload.created_at = now;
        umSupabasePayload.updated_at = now;

        console.log('📋 UM payload keys:', Object.keys(umSupabasePayload));

        const { data: insertedUM, error: umInsertError } = await supabase
          .from('upward_mobility_reports')
          .insert(umSupabasePayload)
          .select();

        if (umInsertError) throw umInsertError;

        umSuccess = true;
        umRecordId = insertedUM?.[0]?.id || null;
        console.log(`✅ UM dual-write successful. Record ID: ${umRecordId}`);

        // Log success to dual_write_monitoring
        await supabase.from('dual_write_monitoring').insert({
          source_system: 'google_sheets',
          target_system: 'supabase',
          operation_type: 'insert',
          table_name: 'upward_mobility_reports',
          record_id: umRecordId,
          google_sheets_row: newRowNumber,
          status: 'success',
          timestamp: new Date().toISOString(),
          metadata: {
            mentor_email: reportData.mentorEmail,
            mentee_name: reportData.usahawan,
            session_number: reportData.sesiLaporan,
            program: 'BANGKIT'
          }
        });

      } catch (error) {
        umError = error.message;
        console.error('⚠️ UM dual-write failed (non-blocking):', error);

        // Log failure to dual_write_monitoring (best effort)
        try {
          await supabase.from('dual_write_monitoring').insert({
            source_system: 'google_sheets',
            target_system: 'supabase',
            operation_type: 'insert',
            table_name: 'upward_mobility_reports',
            google_sheets_row: newRowNumber,
            status: 'failed',
            error_message: error.message,
            timestamp: new Date().toISOString(),
            metadata: {
              mentor_email: reportData.mentorEmail,
              mentee_name: reportData.usahawan,
              session_number: reportData.sesiLaporan,
              program: 'BANGKIT'
            }
          });
        } catch (monitoringError) {
          console.error('⚠️ Failed to log UM failure to dual_write_monitoring:', monitoringError);
        }
      }
    } else {
      console.log(`ℹ️ Skipping UM write. MIA: ${reportData.status === 'MIA'}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}, Has Reports ID: ${!!supabaseRecordId}`);
    }
    // ============================================================
    // END UPWARD MOBILITY DUAL-WRITE
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
      message: 'Laporan Bangkit dan Upward Mobility berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.',
      rowNumber: newRowNumber,
      dualWrite: {
        bangkitSheet: {
          success: true,
          rowNumber: newRowNumber
        },
        upwardMobilitySheet: {
          success: umSheetSuccess,
          rowNumber: umSheetRowNumber,
          error: umSheetError,
          skipped: reportData.status === 'MIA' || !reportData.UPWARD_MOBILITY_JSON
        },
        supabaseReports: {
          success: supabaseSuccess,
          recordId: supabaseRecordId,
          error: supabaseError
        },
        supabaseUpwardMobility: {
          success: umSuccess,
          recordId: umRecordId,
          error: umError,
          skipped: reportData.status === 'MIA' || !reportData.UPWARD_MOBILITY_JSON
        }
      }
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
