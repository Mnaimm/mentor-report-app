// pages/api/submitMajuReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import { supabase, supabaseAdmin } from '../../lib/supabaseClient';
import { prepareMIARequestPayload } from '../../lib/mia';

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

    // Environment variables
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;
    const range = 'LaporanMaju!A1';

    console.log('🔗 Using spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      throw new Error('Missing GOOGLE_SHEETS_MAJU_REPORT_ID environment variable.');
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

    // If MIA submission, create mia_requests entry FIRST to get the ID for Sheets
    let miaRequestId = null;
    if (reportData.MIA_STATUS === 'MIA') {
      try {
        const miaPayload = prepareMIARequestPayload({
          mentorEmail: reportData.EMAIL_MENTOR,
          mentorName: reportData.NAMA_MENTOR,
          menteeName: reportData.NAMA_MENTEE,
          menteeIC: reportData.NAMA_MENTEE, // Use name as fallback if IC not available
          menteeCompany: reportData.NAMA_BISNES,
          menteeBusinessType: reportData.PRODUK_SERVIS,
          menteeLocation: reportData.LOKASI_BISNES,
          menteePhone: reportData.NO_TELEFON,
          sessionNumber: reportData.SESI_NUMBER,
          batch: reportData.BATCH,
          miaReason: reportData.MIA_REASON,
          proofWhatsappUrl: reportData.imageUrls?.mia?.whatsapp,
          proofEmailUrl: reportData.imageUrls?.mia?.email,
          proofCallUrl: reportData.imageUrls?.mia?.call
        }, 'maju');

        const { data: miaRequestData, error: miaError } = await supabaseAdmin
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

    // ============================================================
    // STEP 1: SUPABASE WRITE (BLOCKING - PRIMARY SOURCE OF TRUTH)
    // ============================================================
    console.log('📊 Step 1: Writing to Supabase (primary source of truth)...');

    // RESOLVE MENTOR_ID (lookup by email only, not program)
    const { data: mentorData, error: mentorError } = await supabase
      .from('mentors')
      .select('id')
      .eq('email', reportData.EMAIL_MENTOR.toLowerCase().trim())
      .limit(1)        // take first match if multi-program
      .maybeSingle();

    if (mentorError) throw new Error(`Mentor lookup failed: ${mentorError.message}`);
    if (!mentorData) throw new Error(`Mentor not found for email: ${reportData.EMAIL_MENTOR}`);

    // Prepare Supabase payload - MUST match 'reports' table schema
    const supabasePayload = {
      // Program & Metadata
      program: 'Maju',
      source: 'web_form',
      status: 'submitted',
      submission_date: new Date().toISOString(),

      // Mentor Info (REQUIRED: mentor_id is NOT NULL in database)
      mentor_id: mentorData.id,
      nama_mentor: reportData.NAMA_MENTOR || null,
      mentor_email: reportData.EMAIL_MENTOR || null,

      // Mentee Info (use reports table column names!)
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
        growthwheel: reportData.URL_GAMBAR_GW360 || '',
        mia: reportData.imageUrls?.mia || null  // Can be object with {whatsapp, email, call} or null
      },

      // Folder & Document IDs
      folder_id: reportData.Folder_ID || null,
      doc_url: reportData.Laporan_Maju_Doc_ID || null,  // Maju has doc_url immediately

      // MIA Status (TEXT field: 'Tidak MIA' or 'MIA', NOT boolean!)
      mia_status: reportData.MIA_STATUS || 'Tidak MIA',
      mia_reason: reportData.MIA_REASON || null,
      mia_proof_url: reportData.imageUrls?.mia?.whatsapp || null,  // Legacy field - use WhatsApp proof for backward compatibility
      mia_proof_whatsapp: reportData.imageUrls?.mia?.whatsapp || null,
      mia_proof_email: reportData.imageUrls?.mia?.email || null,
      mia_proof_call: reportData.imageUrls?.mia?.call || null,

      // KEMASKINI MAKLUMAT (Updated Contact Info)
      kemaskini_maklumat: reportData.KEMASKINI_MAKLUMAT || null,

      // Payment fields (defaults)
      payment_status: 'pending'
    };

    // INSERT INTO SUPABASE (BLOCKING)
    const { data: insertedData, error: supabaseInsertError } = await supabase
      .from('reports')
      .insert(supabasePayload)
      .select();

    if (supabaseInsertError) {
      console.error('❌ Supabase insert failed:', supabaseInsertError);
      throw new Error(`Supabase insert failed: ${supabaseInsertError.message}`);
    }

    const supabaseRecordId = insertedData?.[0]?.id || null;
    console.log(`✅ Supabase write successful. Record ID: ${supabaseRecordId}`);

    // If MIA submission, update mia_request with the report_id link
    if (reportData.MIA_STATUS === 'MIA' && miaRequestId && supabaseRecordId) {
      try {
        const { error: updateError } = await supabase
          .from('mia_requests')
          .update({ report_id: supabaseRecordId })
          .eq('id', miaRequestId);

        if (updateError) {
          console.error('⚠️ Failed to link MIA request to report (non-blocking):', updateError);
        } else {
          console.log(`✅ Linked MIA request ${miaRequestId} to report ${supabaseRecordId}`);
        }
      } catch (error) {
        console.error('⚠️ MIA request update failed (non-blocking):', error);
      }
    }

    // ============================================================
    // STEP 2: GOOGLE SHEETS WRITE (NON-BLOCKING - SECONDARY)
    // ============================================================
    let newRowNumber = null;
    let sheetsSuccess = false;
    let sheetsError = null;

    try {
      console.log('📊 Step 2: Writing to Google Sheets (secondary, non-blocking)...');

      // Prepare row data WITH report_id in column P (index 15)
      const rowData = mapMajuDataToSheetRow(reportData, miaRequestId);
      rowData[15] = supabaseRecordId; // Column P = report_id

      console.log('📊 Prepared row data (first 5 values):', rowData.slice(0, 5));
      console.log('📊 Folder_ID in row data (index 25):', rowData[25]);
      console.log('📊 report_id in row data (index 15):', rowData[15]);

      // Append data to Google Sheet with timeout
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

      // Extract the row number where data was appended
      const updatedRange = appendRes.data?.updates?.updatedRange || '';
      console.log('📊 Updated range:', updatedRange);

      // Parse row number from something like "LaporanMaju!A3:AC3"
      newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];
      console.log('🔢 Extracted row number:', newRowNumber);

      if (newRowNumber) {
        sheetsSuccess = true;
        console.log(`✅ Sheets write successful. Row: ${newRowNumber}. Document will be generated automatically.`);

        // Update Supabase with sheets_row_number (non-blocking)
        await supabase
          .from('reports')
          .update({ sheets_row_number: newRowNumber })
          .eq('id', supabaseRecordId);
      } else {
        throw new Error('Could not determine the row number where data was inserted.');
      }

    } catch (error) {
      sheetsError = error.message;
      console.error('⚠️ Google Sheets write failed (non-blocking):', error);
      // DO NOT throw - Sheets failure is non-blocking
    }

    // Log to dual_write_logs
    try {
      await supabase.from('dual_write_logs').insert({
        operation_type: 'submit_report',
        table_name: 'reports',
        record_id: supabaseRecordId,
        supabase_success: true,
        sheets_success: sheetsSuccess,
        sheets_error: sheetsError,
        sheets_row_number: newRowNumber,
        program: 'Maju',
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('⚠️ Failed to log to dual_write_logs:', logError);
    }
    // ============================================================
    // END PRIMARY DUAL-WRITE (Supabase + Sheets)
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

    return res.status(200).json({
      success: true,
      message: 'Laporan berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.',
      recordId: supabaseRecordId,
      rowNumber: newRowNumber,
      dualWrite: {
        supabaseReports: {
          success: true, // Always true if we reach this point
          recordId: supabaseRecordId
        },
        sheetsWrite: {
          success: sheetsSuccess,
          rowNumber: newRowNumber,
          error: sheetsError
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

// Helper function to map form data to sheet row
function mapMajuDataToSheetRow(data, miaRequestId = null) {
  // This should match the order of your getLaporanMajuColumnHeaders() in Apps Script
  const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
  
  return [
    timestamp,                                    // Timestamp
    data.NAMA_MENTOR || '',                      // NAMA_MENTOR
    data.EMAIL_MENTOR || '',                     // EMAIL_MENTOR
    data.NAMA_MENTEE || '',                      // NAMA_MENTEE
    data.NAMA_BISNES || '',                      // NAMA_BISNES
    data.LOKASI_BISNES || '',                    // LOKASI_BISNES
    data.PRODUK_SERVIS || '',                    // PRODUK_SERVIS
    data.NO_TELEFON || '',                       // NO_TELEFON
    data.TARIKH_SESI || '',                      // TARIKH_SESI
    data.SESI_NUMBER || '',                      // SESI_NUMBER
    data.MOD_SESI || '',                         // MOD_SESI
    data.LOKASI_F2F || '',                       // LOKASI_F2F
    data.MASA_MULA || '',                        // MASA_MULA
    data.MASA_TAMAT || '',                       // MASA_TAMAT
    data.LATARBELAKANG_USAHAWAN || '',           // LATARBELAKANG_USAHAWAN
    JSON.stringify(data.DATA_KEWANGAN_BULANAN_JSON || []),     // DATA_KEWANGAN_BULANAN_JSON
    JSON.stringify(data.MENTORING_FINDINGS_JSON || []),        // MENTORING_FINDINGS_JSON
    data.REFLEKSI_MENTOR_PERASAAN || '',         // REFLEKSI_MENTOR_PERASAAN
    data.REFLEKSI_MENTOR_KOMITMEN || '',         // REFLEKSI_MENTOR_KOMITMEN
    data.REFLEKSI_MENTOR_LAIN || '',             // REFLEKSI_MENTOR_LAIN
    data.STATUS_PERNIAGAAN_KESELURUHAN || '',    // STATUS_PERNIAGAAN_KESELURUHAN
    data.RUMUSAN_DAN_LANGKAH_KEHADAPAN || '',    // RUMUSAN_DAN_LANGKAH_KEHADAPAN
    JSON.stringify(data.URL_GAMBAR_PREMIS_JSON || []),         // URL_GAMBAR_PREMIS_JSON
    JSON.stringify(data.URL_GAMBAR_SESI_JSON || []),           // URL_GAMBAR_SESI_JSON
    data.URL_GAMBAR_GW360 || '',                 // URL_GAMBAR_GW360
    data.Folder_ID || '',                        // Z  Folder_ID (FIXED: was Mentee_Folder_ID)
    '',                                          // AA Laporan_Maju_Doc_ID (empty, will be filled by Apps Script)
    data.MIA_STATUS || 'Tidak MIA',              // AB MIA_STATUS
    data.MIA_REASON || '',                       // AC MIA_REASON
    data.UPWARD_MOBILITY_JSON || '',             // AD UPWARD_MOBILITY_JSON
    '',                                          // AE (reserved for future UM fields)
    '',                                          // AF
    '',                                          // AG
    '',                                          // AH
    '',                                          // AI
    '',                                          // AJ
    '',                                          // AK
    '',                                          // AL
    '',                                          // AM
    '',                                          // AN
    '',                                          // AO
    '',                                          // AP
    '',                                          // AQ
    '',                                          // AR
    '',                                          // AS
    '',                                          // AT
    '',                                          // AU
    '',                                          // AV
    '',                                          // AW
    '',                                          // AX
    '',                                          // AY
    '',                                          // AZ
    '',                                          // BA
    '',                                          // BB
    '',                                          // BC
    '',                                          // BD
    '',                                          // BE
    '',                                          // BF
    data.imageUrls?.mia?.whatsapp || '',         // BG MIA_PROOF_WHATSAPP
    data.imageUrls?.mia?.email || '',            // BH MIA_PROOF_EMAIL
    data.imageUrls?.mia?.call || '',             // BI MIA_PROOF_CALL
    miaRequestId || '',                          // BJ MIA_REQUEST_ID (UUID from mia_requests table)
    data.MIA_STATUS === 'MIA' ? 'requested' : '', // BK MIA_REQUEST_STATUS
    data.KEMASKINI_MAKLUMAT?.alamat_baharu || '', // BL ALAMAT_BAHARU
    data.KEMASKINI_MAKLUMAT?.telefon_baharu || '' // BM TELEFON_BAHARU
  ];
}
