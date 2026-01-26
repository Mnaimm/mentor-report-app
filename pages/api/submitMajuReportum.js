// pages/api/submitMajuReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import { supabase } from '../../lib/supabaseClient';

/** Extract the row number from "SheetName!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const reportData = req.body;
    console.log('📋 [SUBMIT API] Request received for MAJU submission');
    console.log('📊 [SUBMIT API] Mentee:', reportData.NAMA_MENTEE);
    console.log('📊 [SUBMIT API] Session:', reportData.SESI_NUMBER);
    console.log('📊 [SUBMIT API] Folder_ID:', reportData.Folder_ID);
    console.log('📊 [SUBMIT API] MIA Status:', reportData.MIA_STATUS);

    // Auth setup
    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Environment variables - TWO spreadsheets for MAJU UM
    // 1. V8 Sheet for LaporanMajuUM tab (main report data)
    const v8SpreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
    const laporanMajuTab = process.env.LAPORAN_MAJU_UM_TAB || 'LaporanMajuUM';
    const laporanMajuRange = `${laporanMajuTab}!A1`;

    // 2. Upward Mobility Sheet for UM tab (UM tracking data)
    const umSpreadsheetId = process.env.UPWARD_MOBILITY_SPREADSHEET_ID;
    const umTab = process.env.UPWARD_MOBILITY_TAB || 'UM';
    const umRange = `${umTab}!A1`;

    console.log('🔗 V8 Sheet ID:', v8SpreadsheetId, '- Tab:', laporanMajuTab);
    console.log('🔗 UM Sheet ID:', umSpreadsheetId, '- Tab:', umTab);

    if (!v8SpreadsheetId) {
      throw new Error('Missing GOOGLE_SHEETS_MAJU_REPORT_ID environment variable.');
    }
    if (!umSpreadsheetId) {
      throw new Error('Missing UPWARD_MOBILITY_SPREADSHEET_ID environment variable.');
    }

    // DEBUG: Verify all critical fields are populated
    console.log('🔍 [DEBUG] Field verification before sheet write:');
    console.log('  - Folder_ID from request:', reportData.Folder_ID);
    console.log('  - NAMA_MENTEE:', reportData.NAMA_MENTEE);
    console.log('  - SESI_NUMBER:', reportData.SESI_NUMBER);
    console.log('  - NAMA_MENTOR:', reportData.NAMA_MENTOR);
    console.log('  - EMAIL_MENTOR:', reportData.EMAIL_MENTOR);

    // Alert if Folder_ID is missing
    if (!reportData.Folder_ID || reportData.Folder_ID === '') {
      console.error('⚠️ [CRITICAL] Folder_ID is empty! Document generation will fail.');
      console.error('⚠️ Request body Folder_ID:', reportData.Folder_ID);
    }

    // Prepare row data
    const rowData = mapMajuDataToSheetRow(reportData);
    console.log('📊 Prepared row data (first 5 values):', rowData.slice(0, 5));
    console.log('📊 Folder_ID in row data (index 25):', rowData[25]);

    // Append data to V8 Sheet / LaporanMajuUM tab
    console.log(`📊 Appending data to V8 Sheet / ${laporanMajuTab} tab...`);
    const appendRes = await Promise.race([
      sheets.spreadsheets.values.append({
        spreadsheetId: v8SpreadsheetId,
        range: laporanMajuRange,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Google Sheets API timeout after 10 seconds')), 10000)
      )
    ]);
    console.log(`✅ V8 Sheet / ${laporanMajuTab} tab append successful`);

    // Extract the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    console.log('📊 Updated range:', updatedRange);

    // Parse row number from something like "LaporanMajuUM!A3:AC3" or "LaporanMaju!A3:AC3"
    const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];
    console.log('🔢 Extracted row number:', newRowNumber);

    if (!newRowNumber) {
      throw new Error('Could not determine the row number where data was inserted.');
    }

    // ============================================================
    // DUAL-WRITE TO UPWARD MOBILITY GOOGLE SHEET (NON-BLOCKING)
    // ============================================================
    let umSheetSuccess = false;
    let umSheetError = null;
    let umSheetRowNumber = null;

    // Only write to UM sheet if NOT MIA and UM data exists
    if (reportData.MIA_STATUS !== 'MIA' && reportData.UPWARD_MOBILITY_JSON) {
      try {
        console.log('📊 Starting dual-write to Upward Mobility Google Sheet...');

        // Parse UM data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        if (!umSpreadsheetId) {
          throw new Error('Missing UPWARD_MOBILITY_SPREADSHEET_ID environment variable');
        }

        // Map data to UM sheet row (using exact Bangkit column structure)
        const umRowData = mapUMDataToSheetRow(reportData, umData);

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
        umSheetRowNumber = umUpdatedRange.match(/!A(\d+):/)?.[1];
        umSheetSuccess = true;

        console.log(`✅ Upward Mobility sheet write successful. Row: ${umSheetRowNumber}`);

      } catch (error) {
        umSheetError = error.message;
        console.error('⚠️ Upward Mobility sheet write failed (non-blocking):', error);
        // This failure does NOT fail the main MAJU submission
      }
    } else {
      console.log(`ℹ️ Skipping UM sheet write. MIA: ${reportData.MIA_STATUS === 'MIA'}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}`);
    }
    // ============================================================
    // END UPWARD MOBILITY GOOGLE SHEET DUAL-WRITE
    // ============================================================

    // Document will be generated automatically by Apps Script time-driven trigger
    console.log(`✅ Data saved to ${laporanMajuTab} row ${newRowNumber}. Document will be generated automatically.`);

    // ============================================================
    // DUAL-WRITE TO SUPABASE (NON-BLOCKING)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;

    try {
      console.log('📊 Starting Supabase dual-write for MAJU report...');

      // ============================================================
      // RESOLVE ENTREPRENEUR_ID (required NOT NULL foreign key)
      // ============================================================
      const entrepreneurEmail = 
        reportData.emel ||
        reportData.emailUsahawan ||
        reportData.entrepreneurEmail;

      if (!entrepreneurEmail) {
        throw new Error('Entrepreneur email not found in MAJU report data (missing emel field)');
      }

      console.log(`🔍 Looking up entrepreneur by email: ${entrepreneurEmail}`);

      const { data: entrepreneur, error: entrepreneurError } = await supabase
        .from('entrepreneurs')
        .select('id')
        .eq('email', entrepreneurEmail.toLowerCase().trim())
        .single();

      if (entrepreneurError || !entrepreneur) {
        throw new Error(`Entrepreneur not found for email: ${entrepreneurEmail}. Error: ${entrepreneurError?.message || 'No match'}`);
      }

      const entrepreneurId = entrepreneur.id;
      console.log(`✅ Entrepreneur resolved: ${entrepreneurId}`);
      // ============================================================

      // Prepare Supabase payload - MUST match 'reports' table schema
      const supabasePayload = {
        // Program & Metadata
        program: 'Maju',
        source: 'web_form',
        status: 'submitted',
        submission_date: new Date().toISOString(),
        sheets_row_number: newRowNumber,

        // Mentor Info
        nama_mentor: reportData.NAMA_MENTOR || null,
        mentor_email: reportData.EMAIL_MENTOR || null,

        // Mentee Info (use reports table column names!)
        entrepreneur_id: entrepreneurId,                   // ✅ REQUIRED foreign key
        nama_mentee: reportData.NAMA_MENTEE || null,       // Maju uses 'nama_mentee'
        nama_bisnes: reportData.NAMA_BISNES || null,
        lokasi_bisnes: reportData.LOKASI_BISNES || null,
        produk_servis: reportData.PRODUK_SERVIS || null,
        no_telefon: reportData.NO_TELEFON || null,

        // Session Info
        session_date: reportData.TARIKH_SESI || null,
        session_number: reportData.SESI_NUMBER || null,
        mod_sesi: reportData.MOD_SESI || null,
        lokasi_f2f: reportData.LOKASI_F2F || null,
        masa_mula: reportData.MASA_MULA || null,
        masa_tamat: reportData.MASA_TAMAT || null,

        // Business Information
        latarbelakang_usahawan: reportData.LATARBELAKANG_USAHAWAN || null,
        status_perniagaan: reportData.STATUS_PERNIAGAAN_KESELURUHAN || null,
        rumusan_langkah_kehadapan: reportData.RUMUSAN_DAN_LANGKAH_KEHADAPAN || null,

        // Financial Data (JSONB array)
        data_kewangan_bulanan: reportData.DATA_KEWANGAN_BULANAN_JSON || [],

        // Mentoring Findings (JSONB array)
        mentoring_findings: reportData.MENTORING_FINDINGS_JSON || [],

        // Reflection
        refleksi_mentor_perasaan: reportData.REFLEKSI_MENTOR_PERASAAN || null,
        refleksi_mentor_komitmen: reportData.REFLEKSI_MENTOR_KOMITMEN || null,
        refleksi_mentor_lain: reportData.REFLEKSI_MENTOR_LAIN || null,

        // Images (JSONB object with nested structure)
        image_urls: {
          premis: reportData.URL_GAMBAR_PREMIS_JSON || [],
          sesi: reportData.URL_GAMBAR_SESI_JSON || [],
          growthwheel: reportData.URL_GAMBAR_GW360 || ''
        },

        // Folder & Document IDs
        folder_id: reportData.Folder_ID || null,
        doc_url: reportData.Laporan_Maju_Doc_ID || null,  // Maju has doc_url immediately

        // MIA Status (TEXT field: 'Tidak MIA' or 'MIA', NOT boolean!)
        mia_status: reportData.MIA_STATUS || 'Tidak MIA',
        mia_reason: reportData.MIA_REASON || null,
        mia_proof_url: reportData.MIA_PROOF_URL || null,

        // Payment fields (defaults)
        payment_status: 'pending'
      };

      console.log('📋 Reports payload preview:', {
        program: supabasePayload.program,
        mentor_email: supabasePayload.mentor_email,
        nama_mentee: supabasePayload.nama_mentee,
        session_number: supabasePayload.session_number
      });

      const { data: insertedData, error: supabaseInsertError } = await supabase
        .from('reports')  // ✅ FIXED: Use existing 'reports' table (same for Bangkit & Maju)
        .insert(supabasePayload)
        .select();

      if (supabaseInsertError) {
        console.error('❌ Reports table insert error:', supabaseInsertError);
        throw supabaseInsertError;
      }

      if (!insertedData || insertedData.length === 0) {
        throw new Error('Reports table insert succeeded but returned no data');
      }

      supabaseSuccess = true;
      supabaseRecordId = insertedData[0]?.id || null;
      
      if (!supabaseRecordId) {
        throw new Error('Reports table insert succeeded but ID is missing');
      }
      
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
          mentor_email: reportData.EMAIL_MENTOR,
          mentee_name: reportData.NAMA_MENTEE,
          session_number: reportData.SESI_NUMBER
        }
      });

    } catch (error) {
      supabaseError = error.message;
      console.error('⚠️ Supabase reports dual-write failed (non-blocking):', error);

      // Log failure to dual_write_monitoring (best effort)
      try {
        await supabase.from('dual_write_monitoring').insert({
          source_system: 'google_sheets',
          target_system: 'supabase',
          operation_type: 'insert',
          table_name: 'reports',
          google_sheets_row: newRowNumber,
          status: 'failed',
          error_message: error.message,
          timestamp: new Date().toISOString(),
          metadata: {
            mentor_email: reportData.EMAIL_MENTOR,
            mentee_name: reportData.NAMA_MENTEE,
            session_number: reportData.SESI_NUMBER,
            entrepreneur_email: reportData.emel || reportData.emailUsahawan || 'unknown'
          }
        });
      } catch (monitoringError) {
        console.error('⚠️ Failed to log to dual_write_monitoring:', monitoringError);
      }
    }
    // ============================================================
    // END DUAL-WRITE TO SUPABASE (REPORTS TABLE)
    // ============================================================

    // ============================================================
    // DUAL-WRITE TO UPWARD_MOBILITY_REPORTS TABLE (NON-BLOCKING)
    // ============================================================
    let umSuccess = false;
    let umError = null;
    let umRecordId = null;

    // Only write UM data if NOT MIA and UM data exists
    if (reportData.MIA_STATUS !== 'MIA' && reportData.UPWARD_MOBILITY_JSON && supabaseRecordId) {
      try {
        console.log('📊 Starting Upward Mobility dual-write for MAJU...');

        // Parse the UM JSON data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        // Fetch mentor ID
        const { data: mentorData, error: mentorError } = await supabase
          .from('mentors')
          .select('id')
          .eq('email', reportData.EMAIL_MENTOR.toLowerCase().trim())
          .single();

        if (mentorError) throw new Error(`Mentor not found: ${mentorError.message}`);

        // Fetch entrepreneur ID (reuse same email used for reports table)
        const entrepreneurEmail =
          reportData.emel ||
          reportData.emailUsahawan ||
          reportData.entrepreneurEmail;

        if (!entrepreneurEmail) {
          throw new Error('Entrepreneur email not found in MAJU report data (missing emel field)');
        }

        const { data: entrepreneur, error: entrepreneurError } = await supabase
          .from('entrepreneurs')
          .select('id')
          .eq('email', entrepreneurEmail.toLowerCase().trim())
          .single();

        if (entrepreneurError || !entrepreneur) {
          throw new Error(`Entrepreneur not found: ${entrepreneurEmail}`);
        }

        console.log(`✅ Entrepreneur resolved for UM: ${entrepreneur.id}`);

        // Build schema-whitelisted UM payload (aligned with upward_mobility_reports table)
        const umSupabasePayload = {};

        // Required foreign keys
        umSupabasePayload.entrepreneur_id = entrepreneur.id;
        umSupabasePayload.mentor_id = mentorData.id;

        // Program & Session
        if (reportData.SESI_NUMBER) umSupabasePayload.sesi_mentoring = `Sesi ${reportData.SESI_NUMBER}`;
        umSupabasePayload.program = 'MAJU';

        // Capture sheets_row_number from UM sheet write
        if (umSheetRowNumber) umSupabasePayload.sheets_row_number = parseInt(umSheetRowNumber);

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

        if (umData.UM_ASET_TUNAI_SEMASA) {
          const parsed = parseFloat(umData.UM_ASET_TUNAI_SEMASA);
          if (!isNaN(parsed)) umSupabasePayload.aset_tunai_semasa = parsed;
        }
        if (umData.UM_ULASAN_ASET_TUNAI) umSupabasePayload.ulasan_aset_tunai = umData.UM_ULASAN_ASET_TUNAI;

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

        // Log UM success to dual_write_monitoring
        await supabase.from('dual_write_monitoring').insert({
          source_system: 'google_sheets',
          target_system: 'supabase',
          operation_type: 'insert',
          table_name: 'upward_mobility_reports',
          record_id: umRecordId,
          google_sheets_row: umSheetRowNumber,
          status: 'success',
          timestamp: new Date().toISOString(),
          metadata: {
            session_id: supabaseRecordId,
            mentor_email: reportData.EMAIL_MENTOR,
            mentee_name: reportData.NAMA_MENTEE,
            session_number: reportData.SESI_NUMBER,
            program: 'MAJU'
          }
        });

      } catch (error) {
        umError = error.message;
        console.error('⚠️ Upward Mobility dual-write failed (non-blocking):', error);

        // Log UM failure to dual_write_monitoring (best effort)
        try {
          await supabase.from('dual_write_monitoring').insert({
            source_system: 'google_sheets',
            target_system: 'supabase',
            operation_type: 'insert',
            table_name: 'upward_mobility_reports',
            google_sheets_row: umSheetRowNumber,
            status: 'failed',
            error_message: error.message,
            timestamp: new Date().toISOString(),
            metadata: {
              session_id: supabaseRecordId,
              mentor_email: reportData.EMAIL_MENTOR,
              mentee_name: reportData.NAMA_MENTEE,
              session_number: reportData.SESI_NUMBER,
              program: 'MAJU'
            }
          });
        } catch (monitoringError) {
          console.error('⚠️ Failed to log UM failure to dual_write_monitoring:', monitoringError);
        }
      }
    } else {
      console.log(`ℹ️ Skipping UM write. MIA: ${reportData.MIA_STATUS}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}, Has Reports ID: ${!!supabaseRecordId}, Reports ID value: ${supabaseRecordId}`);
    }
    // ============================================================
    // END UPWARD MOBILITY DUAL-WRITE
    // ============================================================

    // Invalidate cache on successful submission
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

    // Build comprehensive response including UM status
    const responseMessage = umSheetRowNumber
      ? 'Laporan MAJU & Upward Mobility berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.'
      : 'Laporan MAJU berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.' +
        (reportData.MIA_STATUS !== 'MIA' && reportData.UPWARD_MOBILITY_JSON ? ' (Nota: UM data tidak berjaya disimpan ke UM tab)' : '');

    return res.status(200).json({
      success: true,
      message: responseMessage,
      rowNumber: newRowNumber,
      sheets: {
        v8Sheet: {
          spreadsheetId: v8SpreadsheetId,
          tab: laporanMajuTab,
          rowNumber: newRowNumber
        },
        umSheet: {
          success: umSheetSuccess,
          spreadsheetId: umSpreadsheetId,
          tab: umTab,
          rowNumber: umSheetRowNumber,
          error: umSheetError,
          written: !!umSheetRowNumber
        }
      },
      supabase: {
        reports: {
          success: supabaseSuccess,
          recordId: supabaseRecordId,
          error: supabaseError
        },
        upwardMobility: {
          success: umSuccess,
          recordId: umRecordId,
          error: umError,
          skipped: reportData.MIA_STATUS === 'MIA' || !reportData.UPWARD_MOBILITY_JSON
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in /api/submitMajuReport:', error);

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

// Helper function to map form data to sheet row for laporanmajuum tab
function mapMajuDataToSheetRow(data) {
  // This MUST match the order of getLaporanMajuColumnHeaders() in Apps Script
  const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
  
  // Parse UM data if available (similar to Bangkit)
  let umData = {};
  if (data.MIA_STATUS !== 'MIA' && data.UPWARD_MOBILITY_JSON) {
    try {
      umData = JSON.parse(data.UPWARD_MOBILITY_JSON);
    } catch (e) {
      console.error('Failed to parse UPWARD_MOBILITY_JSON:', e);
    }
  }

  return [
    // Columns 0-19: Basic session info & reflections
    timestamp,                                    // 0  Timestamp
    data.NAMA_MENTOR || '',                      // 1  NAMA_MENTOR
    data.EMAIL_MENTOR || '',                     // 2  EMAIL_MENTOR
    data.NAMA_MENTEE || '',                      // 3  NAMA_MENTEE
    data.NAMA_BISNES || '',                      // 4  NAMA_BISNES
    data.LOKASI_BISNES || '',                    // 5  LOKASI_BISNES
    data.PRODUK_SERVIS || '',                    // 6  PRODUK_SERVIS
    data.NO_TELEFON || '',                       // 7  NO_TELEFON
    data.TARIKH_SESI || '',                      // 8  TARIKH_SESI
    data.SESI_NUMBER || '',                      // 9  SESI_NUMBER
    data.MOD_SESI || '',                         // 10 MOD_SESI
    data.LOKASI_F2F || '',                       // 11 LOKASI_F2F
    data.MASA_MULA || '',                        // 12 MASA_MULA
    data.MASA_TAMAT || '',                       // 13 MASA_TAMAT
    data.LATARBELAKANG_USAHAWAN || '',           // 14 LATARBELAKANG_USAHAWAN
    JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []),     // 15 DATA_KEWANGAN_BULANAN_JSON
    JSON.stringify(data.MENTORING_FINDINGS_JSON || []),        // 16 MENTORING_FINDINGS_JSON
    data.REFLEKSI_MENTOR_PERASAAN || '',         // 17 REFLEKSI_MENTOR_PERASAAN
    data.REFLEKSI_MENTOR_KOMITMEN || '',         // 18 REFLEKSI_MENTOR_KOMITMEN
    data.REFLEKSI_MENTOR_LAIN || '',             // 19 REFLEKSI_MENTOR_LAIN

    // Columns 20-29: Business status, images, folder ID, and MIA status
    data.STATUS_PERNIAGAAN_KESELURUHAN || '',    // 20 STATUS_PERNIAGAAN_KESELURUHAN
    data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '',    // 21 RUMUSAN_DAN_LANGKAH_KEHADAPAN
    JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []),         // 22 URL_GAMBAR_PREMIS_JSON
    JSON.stringify(data.URL_GAMBAR_SESI_JSON || []),           // 23 URL_GAMBAR_SESI_JSON
    data.URL_GAMBAR_GW360 || '',                 // 24 URL_GAMBAR_GW360
    data.Folder_ID || '',                        // 25 Mentee_Folder_ID
    '',                                          // 26 Laporan_Maju_Doc_ID (empty, will be filled by Apps Script)
    data.MIA_STATUS || 'Tidak MIA',              // 27 MIA_STATUS
    data.MIA_REASON || '',                       // 28 MIA_REASON
    data.MIA_PROOF_URL || '',                    // 29 MIA_PROOF_URL

    // Columns 30-57: UM Data (28 columns) - INDIVIDUAL FIELDS, NOT JSON
    // UM Section 1: Engagement Status (3 fields)
    umData.UM_STATUS_PENGLIBATAN || '',          // 30 UM_STATUS_PENGLIBATAN
    umData.UM_STATUS || '',                      // 31 UM_STATUS
    umData.UM_KRITERIA_IMPROVEMENT || '',        // 32 UM_KRITERIA_IMPROVEMENT

    // UM Section 2: BIMB Channels & Fintech (6 fields)
    umData.UM_AKAUN_BIMB || '',                  // 33 UM_AKAUN_BIMB
    umData.UM_BIMB_BIZ || '',                    // 34 UM_BIMB_BIZ
    umData.UM_AL_AWFAR || '',                    // 35 UM_AL_AWFAR
    umData.UM_MERCHANT_TERMINAL || '',           // 36 UM_MERCHANT_TERMINAL
    umData.UM_FASILITI_LAIN || '',               // 37 UM_FASILITI_LAIN
    umData.UM_MESINKIRA || '',                   // 38 UM_MESINKIRA

    // UM Section 3: Financial & Employment Metrics (12 fields)
    umData.UM_PENDAPATAN_SEMASA || '',           // 39 UM_PENDAPATAN_SEMASA
    umData.UM_ULASAN_PENDAPATAN || '',           // 40 UM_ULASAN_PENDAPATAN
    umData.UM_PEKERJA_SEMASA || '',              // 41 UM_PEKERJA_SEMASA
    umData.UM_ULASAN_PEKERJA || '',              // 42 UM_ULASAN_PEKERJA
    umData.UM_ASET_BUKAN_TUNAI_SEMASA || '',     // 43 UM_ASET_BUKAN_TUNAI_SEMASA
    umData.UM_ULASAN_ASET_BUKAN_TUNAI || '',     // 44 UM_ULASAN_ASET_BUKAN_TUNAI
    umData.UM_ASET_TUNAI_SEMASA || '',           // 45 UM_ASET_TUNAI_SEMASA
    umData.UM_ULASAN_ASET_TUNAI || '',           // 46 UM_ULASAN_ASET_TUNAI
    umData.UM_SIMPANAN_SEMASA || '',             // 47 UM_SIMPANAN_SEMASA
    umData.UM_ULASAN_SIMPANAN || '',             // 48 UM_ULASAN_SIMPANAN
    umData.UM_ZAKAT_SEMASA || '',                // 49 UM_ZAKAT_SEMASA
    umData.UM_ULASAN_ZAKAT || '',                // 50 UM_ULASAN_ZAKAT

    // UM Section 4: Digitalization (2 fields)
    umData.UM_DIGITAL_SEMASA || '',              // 51 UM_DIGITAL_SEMASA
    umData.UM_ULASAN_DIGITAL || '',              // 52 UM_ULASAN_DIGITAL

    // UM Section 5: Marketing (2 fields)
    umData.UM_MARKETING_SEMASA || '',            // 53 UM_MARKETING_SEMASA
    umData.UM_ULASAN_MARKETING || '',            // 54 UM_ULASAN_MARKETING

    // Note: The sheet has duplicate headers (UM_PENDAPATAN_SEMASA at 55, UM_ASET_TUNAI_SEMASA at 56)
    // We'll fill these with the same values to maintain compatibility
    umData.UM_PENDAPATAN_SEMASA || '',           // 55 UM_PENDAPATAN_SEMASA (duplicate)
    umData.UM_ASET_TUNAI_SEMASA || '',           // 56 UM_ASET_TUNAI_SEMASA (duplicate)

    // UM Section 6: Premises Visit Date (1 field)
    umData.UM_TARIKH_LAWATAN_PREMIS || '',       // 57 UM_TARIKH_LAWATAN_PREMIS
  ];
}

/**
 * Maps MAJU UM data to the shared Upward Mobility Google Sheet row.
 * This MUST match the exact column structure used by Bangkit UM (columns A-BT: 72 total).
 * 
 * Columns A-K (0-10): Basic session info
 * Columns L-AR (11-43): Legacy fields (leave empty - 33 columns)
 * Columns AS-BT (44-71): UM-specific fields (28 columns)
 */
function mapUMDataToSheetRow(reportData, umData) {
  const row = Array(72).fill(''); // Columns 0-71 (A-BT: 72 total)

  // ✅ Columns A-K (0-10): Basic session info
  row[0] = new Date().toISOString();                     // A  Timestamp
  row[1] = reportData.EMAIL_MENTOR || '';                // B  Email Address
  row[2] = 'MAJU';                                       // C  Program
  row[3] = reportData.BATCH || '';                       // D  Batch (if applicable)
  row[4] = `Sesi ${reportData.SESI_NUMBER ?? ''}`;       // E  Sesi Mentoring
  row[5] = reportData.NAMA_MENTOR || '';                 // F  Nama Mentor
  row[6] = reportData.NAMA_MENTEE || '';                 // G  Nama Penuh Usahawan
  row[7] = reportData.NAMA_BISNES || '';                 // H  Nama Perniagaan
  row[8] = reportData.PRODUK_SERVIS || '';               // I  Jenis Perniagaan / Produk
  row[9] = reportData.LOKASI_BISNES || '';               // J  Alamat Perniagaan
  row[10] = reportData.NO_TELEFON || '';                 // K  Nombor Telefon

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
  row[58] = umData.UM_ULASAN_ASET_BUKAN_TUNAI || '';    // BG UM_ULASAN_ASET_BUKAN_TUNAI
  row[59] = umData.UM_ASET_TUNAI_SEMASA || '';          // BH UM_ASET_TUNAI_SEMASA
  row[60] = umData.UM_ULASAN_ASET_TUNAI || '';          // BI UM_ULASAN_ASET_TUNAI
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
}
