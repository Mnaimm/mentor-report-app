// pages/api/submitMajuReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import supabaseAdmin from '../../lib/supabaseAdmin';
import { prepareMIARequestPayload } from '../../lib/mia';
import { requireSession, requireSubmitterEmail } from '../../lib/api-guard';
import { MIA_API_ENABLED } from '../../lib/featureFlags';
import { buildUMPayload, insertUMWithRetry, logUMFailure, UM_DB_FAILED_WARNING } from '../../lib/umDbWrite';
import { resolveUMVersion, UM_V2_NOT_OPEN, UM_VERSION_LOOKUP_FAILED } from '../../lib/resolveUMVersion';


/** Extract the row number from "SheetName!A37:T37" */
function getRowNumberFromUpdatedRange(updatedRange) {
  const m = String(updatedRange).match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  // Mentor email comes from the session. A different body email is allowed
  // only for system_admin/program_coordinator submitting on behalf of a mentor.
  const submitterEmail = await requireSubmitterEmail(res, session, req.body?.EMAIL_MENTOR);
  if (!submitterEmail) return;
  if (req.body && typeof req.body === 'object') req.body.EMAIL_MENTOR = submitterEmail;

  // MIA is disabled unless MIA_ENABLED=true. Block before any Sheets/reports/mia_requests write.
  if (!MIA_API_ENABLED && (
    req.body?.status === 'MIA' || req.body?.MIA_STATUS === 'MIA'
  )) {
    return res.status(400).json({
      error: 'Ciri MIA tidak dibuka buat masa ini. Sila muat semula halaman dan hantar laporan sesi biasa, atau hubungi admin.'
    });
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

    // Missing sheet IDs are handled inside the non-blocking Sheets step (STEP 3)

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

    let miaRequestId = null;

    // ============================================================
    // STEP 1: SUPABASE REPORTS WRITE (BLOCKING - PRIMARY SOURCE OF TRUTH)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;
    let completionPromise = Promise.resolve();
    let entrepreneur = null;
    let mentorId = null;

    {
      console.log('📊 Starting Supabase write for MAJU report...');

      // ============================================================
      // RESOLVE ENTREPRENEUR_ID (2-tier: ID → email; never by name)
      // ============================================================

      // 🆕 PRIMARY: Try entrepreneur_id if provided
      const entrepreneurIdFromPayload = reportData.entrepreneur_id;
      if (entrepreneurIdFromPayload) {
        const { data: byId, error: idError } = await supabaseAdmin
          .from('entrepreneurs')
          .select('id, batch')
          .eq('id', entrepreneurIdFromPayload)
          .maybeSingle();

        if (byId) {
          entrepreneur = byId;
          console.log('✅ MAJU entrepreneur resolved by ID:', entrepreneurIdFromPayload);
        } else if (idError) {
          console.warn('⚠️ MAJU entrepreneur_id lookup failed:', idError.message);
        } else {
          console.warn(`⚠️ MAJU entrepreneur_id not found: ${entrepreneurIdFromPayload}`);
        }
      }

      // Fallback: Email (existing logic)
      if (!entrepreneur) {
        const rawEntrepreneurEmail = reportData.emel;
        if (!rawEntrepreneurEmail) {
          console.error('❌ Missing emel in MAJU payload. Cannot resolve entrepreneur.');
          return res.status(422).json({
            success: false,
            code: 'ENTREPRENEUR_NOT_FOUND',
            error: 'Usahawan tidak dijumpai dalam sistem. Sila muat semula halaman dan pilih usahawan semula, atau hubungi admin.',
            retryable: false
          });
        }

        const normalizedEmail = rawEntrepreneurEmail.toLowerCase().trim();
        console.log(`🔍 Resolving MAJU entrepreneur using email: ${normalizedEmail}`);

        const { data: byEmail, error: entrepreneurError } = await supabaseAdmin
          .from('entrepreneurs')
          .select('id, batch')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (entrepreneurError) {
          throw new Error(`Entrepreneur lookup failed: ${entrepreneurError.message}`);
        }
        if (!byEmail) {
          // No name-only fallback: same-name entrepreneurs exist across batches
          console.error(`❌ Entrepreneur not found for email: ${normalizedEmail}`);
          return res.status(422).json({
            success: false,
            code: 'ENTREPRENEUR_NOT_FOUND',
            error: 'Usahawan tidak dijumpai dalam sistem. Sila muat semula halaman dan pilih usahawan semula, atau hubungi admin.',
            retryable: false
          });
        }

        entrepreneur = byEmail;
        console.log('✅ MAJU entrepreneur resolved by email:', normalizedEmail);
      }

      const entrepreneurId = entrepreneur.id;
      console.log(`✅ Final MAJU entrepreneur ID: ${entrepreneurId}`);
      // ============================================================

      // ============================================================
      // RESOLVE MENTOR_ID (required NOT NULL foreign key)
      // ============================================================
      const mentorEmail = reportData.EMAIL_MENTOR?.toLowerCase().trim();
      if (!mentorEmail) {
        throw new Error('Missing mentor email in payload');
      }

      console.log('🔍 Resolving mentor using email:', mentorEmail);

      const { data: mentor, error: mentorError } = await supabaseAdmin
        .from('mentors')
        .select('id')
        .eq('email', mentorEmail)
        .maybeSingle();

      if (mentorError) {
        throw new Error(`Mentor lookup failed: ${mentorError.message}`);
      }

      if (!mentor) {
        console.error(`❌ Mentor not found in DB for email: ${mentorEmail}`);
        return res.status(422).json({
          success: false,
          code: 'MENTOR_NOT_FOUND',
          error: 'Mentor tidak dijumpai dalam sistem untuk emel ini. Sila hubungi admin.',
          retryable: false
        });
      }

      mentorId = mentor.id;
      console.log(`✅ Mentor resolved: ${mentorId}`);
      // ============================================================

      // UM v2 batches (B10 Bangkit / M9 Maju) stay closed until the v2 form ships.
      // Checked before any reports / UM / Sheets write; a failed lookup fails closed.
      const umResolution = await resolveUMVersion(supabaseAdmin, { entrepreneurId, mentorId });
      if (umResolution.error) {
        console.error('❌ UM version lookup failed:', umResolution.error);
        return res.status(503).json({ success: false, ...UM_VERSION_LOOKUP_FAILED, retryable: true });
      }
      if (umResolution.version === 2) {
        console.warn(`⛔ UM v2 batch ${umResolution.batchId}: submission blocked for entrepreneur ${entrepreneurId}`);
        return res.status(409).json({ success: false, ...UM_V2_NOT_OPEN, retryable: false });
      }

      // Prepare Supabase payload - MUST match 'reports' table schema
      const supabasePayload = {
        // Program & Metadata
        program: 'Maju',
        source: 'web_form',
        status: 'submitted',
        submission_date: new Date().toISOString(),
        // sheets_row_number is set after the (non-blocking) LaporanMajuUM append

        // Mentor Info
        mentor_id: mentorId,                           // ✅ REQUIRED foreign key
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

        // Premises visit tracking
        premis_dilawat: (() => {
          const premisImages = reportData.URL_GAMBAR_PREMIS_JSON || [];
          return Array.isArray(premisImages) && premisImages.length > 0;
        })(),

        // Payment fields
        payment_status: 'pending',
        base_payment_amount: (() => {
          // Calculate base payment amount based on session and premises visit
          const sessionNum = reportData.SESI_NUMBER || 1;
          const premisImages = reportData.URL_GAMBAR_PREMIS_JSON || [];
          const hasPremisVisit = Array.isArray(premisImages) && premisImages.length > 0;

          // Base rate: Session 1-2 = RM100, Session 3-4 = RM180
          let baseAmount = (sessionNum >= 3 && sessionNum <= 4) ? 180 : 100;

          // Premises visit bonus: +RM160
          if (hasPremisVisit) {
            baseAmount += 160;
          }

          return baseAmount;
        })()
      };

      console.log('📋 Reports payload preview:', {
        program: supabasePayload.program,
        mentor_email: supabasePayload.mentor_email,
        nama_mentee: supabasePayload.nama_mentee,
        session_number: supabasePayload.session_number
      });

      const { data: insertedData, error: supabaseInsertError } = await supabaseAdmin
        .from('reports')  // ✅ FIXED: Use existing 'reports' table (same for Bangkit & Maju)
        .insert(supabasePayload)
        .select();

      if (supabaseInsertError) {
        console.error('❌ Reports table insert error:', supabaseInsertError);

        // Log failure to dual_write_monitoring (best effort)
        try {
          await supabaseAdmin.from('dual_write_monitoring').insert({
            source_system: 'google_sheets',
            target_system: 'supabase',
            operation_type: 'insert',
            table_name: 'reports',
            status: 'failed',
            error_message: supabaseInsertError.message,
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

        // unique_mentor_entrepreneur_session: this session was already submitted
        if (supabaseInsertError.code === '23505') {
          return res.status(409).json({
            success: false,
            duplicate: true,
            error: 'Laporan untuk sesi ini telah pun dihantar. Sila semak "Laporan Saya" sebelum menghantar semula.',
            retryable: false
          });
        }
        throw new Error(`Reports insert failed: ${supabaseInsertError.message}`);
      }

      if (!insertedData || insertedData.length === 0) {
        throw new Error('Reports table insert succeeded but returned no data');
      }

      supabaseSuccess = true;
      supabaseRecordId = insertedData[0]?.id || null;

      if (!supabaseRecordId) {
        throw new Error('Reports table insert succeeded but ID is missing');
      }

      console.log(`✅ Supabase reports write successful. Record ID: ${supabaseRecordId}`);

      // ============================================================
      // AUTO-COMPLETE ASSIGNMENT (non-blocking, best-effort) — final session submitted
      // Runs in parallel with the UM writes below; awaited just before the response.
      // MIA reports do not complete the assignment.
      // ============================================================
      if (Number(reportData.SESI_NUMBER) === 4 && reportData.MIA_STATUS !== 'MIA' && mentorId && entrepreneurId) {
        completionPromise = (async () => {
          try {
            const { error: completionError } = await supabaseAdmin
              .from('mentor_assignments')
              .update({
                status: 'completed',
                is_active: false,
                completed_at: new Date().toISOString()
              })
              .eq('mentor_id', mentorId)
              .eq('entrepreneur_id', entrepreneurId)
              .eq('status', 'active')
              .eq('is_active', true);
            if (completionError) {
              console.error('⚠️ Assignment completion update failed (non-blocking):', completionError);
            }
          } catch (err) {
            console.error('⚠️ Assignment completion exception (non-blocking):', err);
          }
        })();
      }

      // Link mia_requests to this report (now that report_id is available)
      if (reportData.MIA_STATUS === 'MIA') {
        try {
          const miaPayload = prepareMIARequestPayload({
            mentorEmail: reportData.EMAIL_MENTOR,
            mentorName: reportData.NAMA_MENTOR,
            menteeName: reportData.NAMA_MENTEE,
            menteeIC: reportData.NAMA_MENTEE,
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
          miaPayload.report_id = supabaseRecordId;

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
        } catch (miaErr) {
          console.error('⚠️ MIA request creation failed (non-blocking):', miaErr);
        }
      }

    }
    // ============================================================
    // END SUPABASE REPORTS WRITE
    // ============================================================

    // ============================================================
    // STEP 2: UPWARD_MOBILITY_REPORTS INSERT (AWAITED, retried once)
    // The reports row is already saved, so a UM failure never fails the submission:
    // it is stored as a replayable dual_write_monitoring row and returned as a warning.
    // ============================================================
    let umSuccess = false;
    let umError = null;
    let umRecordId = null;
    const warnings = [];

    // Only write UM data if NOT MIA and UM data exists
    const umWanted = reportData.MIA_STATUS !== 'MIA' && !!reportData.UPWARD_MOBILITY_JSON;

    if (umWanted) {
      console.log('📊 Starting Upward Mobility DB write for MAJU...');
      const umFailureLog = {
        source_system: 'google_sheets',
        target_system: 'supabase',
        metadata: {
          session_id: supabaseRecordId,
          mentor_email: reportData.EMAIL_MENTOR,
          mentee_name: reportData.NAMA_MENTEE,
          session_number: reportData.SESI_NUMBER,
          program: 'MAJU'
        }
      };

      let umSupabasePayload = null;
      try {
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);
        umSupabasePayload = buildUMPayload(umData, {
          entrepreneur,
          mentorId,
          sesiNumber: reportData.SESI_NUMBER,
          program: 'MAJU',
          reportId: supabaseRecordId,
          umVersion: 1 // v2 never reaches here (guarded before the reports insert)
        });
        console.log('📋 UM payload keys:', Object.keys(umSupabasePayload));
      } catch (error) {
        umError = `UM payload could not be built: ${error.message}`;
        console.error('⚠️ UM payload build failed:', error);
        await logUMFailure(supabaseAdmin, {
          reportId: supabaseRecordId,
          entrepreneurId: entrepreneur.id,
          program: 'MAJU',
          sesiNumber: reportData.SESI_NUMBER,
          payload: null,
          rawUM: reportData.UPWARD_MOBILITY_JSON,
          error: umError,
          attempts: 0,
          failureLog: umFailureLog
        });
      }

      if (umSupabasePayload) {
        const umResult = await insertUMWithRetry(supabaseAdmin, umSupabasePayload, {
          reportId: supabaseRecordId,
          program: 'MAJU',
          sesiNumber: reportData.SESI_NUMBER,
          failureLog: umFailureLog
        });
        umSuccess = umResult.success;
        umRecordId = umResult.recordId;
        umError = umResult.error;
        if (umSuccess) console.log(`✅ UM DB write successful. Record ID: ${umRecordId}`);
      }

      if (!umSuccess) warnings.push(UM_DB_FAILED_WARNING);
    } else {
      console.log(`ℹ️ Skipping UM write. MIA: ${reportData.MIA_STATUS}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}`);
    }

    // ============================================================
    // STEP 3: GOOGLE SHEETS WRITES (NON-BLOCKING - SECONDARY, run in parallel)
    // Each append has its own try/catch; failures are logged with report_id.
    // ============================================================
    let newRowNumber = null;
    let v8SheetSuccess = false;
    let v8SheetError = null;

    let umSheetSuccess = false;
    let umSheetError = null;
    let umSheetRowNumber = null;

    const laporanMajuSheetTask = async () => {
      try {
        if (!v8SpreadsheetId) {
          throw new Error('Missing GOOGLE_SHEETS_MAJU_REPORT_ID environment variable.');
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

        // Parse row number from something like "LaporanMajuUM!A3:AC3"
        const updatedRange = appendRes.data?.updates?.updatedRange || '';
        newRowNumber = updatedRange.match(/!A(\d+):/)?.[1] || null;
        console.log('🔢 Extracted row number:', newRowNumber);

        if (!newRowNumber) {
          throw new Error('Could not determine the row number where data was inserted.');
        }
        v8SheetSuccess = true;

        // Store sheets_row_number on the report (non-blocking)
        const { error: rowUpdateError } = await supabaseAdmin
          .from('reports')
          .update({ sheets_row_number: newRowNumber })
          .eq('id', supabaseRecordId);
        if (rowUpdateError) {
          console.error(`⚠️ reports.sheets_row_number update failed. report_id: ${supabaseRecordId}`, rowUpdateError);
        }

        // Document will be generated automatically by Apps Script time-driven trigger
        console.log(`✅ Data saved to ${laporanMajuTab} row ${newRowNumber}. Document will be generated automatically.`);
      } catch (error) {
        v8SheetError = error.message;
        console.error(`⚠️ ${laporanMajuTab} sheet write failed (non-blocking). report_id: ${supabaseRecordId}`, error);
      }
    };

    // Only write to UM sheet if NOT MIA and UM data exists
    const umSheetTask = async () => {
      if (!umWanted) {
        console.log(`ℹ️ Skipping UM sheet write. MIA: ${reportData.MIA_STATUS === 'MIA'}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}`);
        return;
      }
      try {
        console.log('📊 Starting dual-write to Upward Mobility Google Sheet...');

        // Parse UM data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        if (!umSpreadsheetId) {
          throw new Error('Missing UPWARD_MOBILITY_SPREADSHEET_ID environment variable');
        }

        // Batch from the resolved entrepreneur record (reportData.BATCH is not sent by form)
        const entrepreneurBatchForUM = entrepreneur.batch || '';
        console.log('📊 Entrepreneur batch for UM sheet:', entrepreneurBatchForUM);

        // Map data to UM sheet row (using exact Bangkit column structure)
        const umRowData = mapUMDataToSheetRow(reportData, umData, entrepreneurBatchForUM);

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

        // Capture sheets_row_number from UM sheet write (non-blocking)
        if (umRecordId && umSheetRowNumber) {
          const { error: umRowUpdateError } = await supabaseAdmin
            .from('upward_mobility_reports')
            .update({ sheets_row_number: parseInt(umSheetRowNumber) })
            .eq('id', umRecordId);
          if (umRowUpdateError) {
            console.error(`⚠️ upward_mobility_reports.sheets_row_number update failed. report_id: ${supabaseRecordId}`, umRowUpdateError);
          }
        }
      } catch (error) {
        umSheetError = error.message;
        console.error(`⚠️ Upward Mobility sheet write failed (non-blocking). report_id: ${supabaseRecordId}`, error);
        // This failure does NOT fail the main MAJU submission
      }
    };

    await Promise.allSettled([laporanMajuSheetTask(), umSheetTask()]);

    // Log success to dual_write_monitoring (after Sheets so the row numbers are known)
    try {
      await supabaseAdmin.from('dual_write_monitoring').insert({
        source_system: 'google_sheets',
        target_system: 'supabase',
        operation_type: 'insert',
        table_name: 'reports',
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
      if (umSuccess) {
        await supabaseAdmin.from('dual_write_monitoring').insert({
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
      }
    } catch (monitoringError) {
      console.error('⚠️ Failed to log to dual_write_monitoring:', monitoringError);
    }
    // ============================================================
    // END DUAL-WRITE
    // ============================================================

    // Invalidate cache on successful submission
    const mentorEmail = reportData?.EMAIL_MENTOR;
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

    await completionPromise; // never rejects; usually already settled by now

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
          rowNumber: newRowNumber,
          success: v8SheetSuccess,
          error: v8SheetError
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
      },
      warnings
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
    umData.UM_PEKERJA_PARTTIME_SEMASA || '',     // 44 UM_PEKERJA_PARTTIME_SEMASA
    umData.UM_ULASAN_PEKERJA_PARTTIME || '',     // 45 UM_ULASAN_PEKERJA_PARTTIME
    umData.UM_ULASAN_ASET_BUKAN_TUNAI || '',     // 46 UM_ULASAN_ASET_BUKAN_TUNAI
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

    // Note: The sheet has duplicate headers
    // We'll fill these with the same values to maintain compatibility where needed or leave blank
    umData.UM_PENDAPATAN_SEMASA || '',           // 55 UM_PENDAPATAN_SEMASA (duplicate)
    umData.UM_ASET_BUKAN_TUNAI_SEMASA || '',     // 56 UM_ASET_TUNAI_SEMASA (duplicate slot replaced)

    // UM Section 6: Premises Visit Date (1 field)
    umData.UM_TARIKH_LAWATAN_PREMIS || '',       // 57 BF UM_TARIKH_LAWATAN_PREMIS

    // Columns 58-62: MIA Proof Workflow (5 columns)
    data?.imageUrls?.mia?.whatsapp || '',        // 58 BG MIA_PROOF_WHATSAPP
    data?.imageUrls?.mia?.email || '',           // 59 BH MIA_PROOF_EMEL
    data?.imageUrls?.mia?.call || '',            // 60 BI MIA_PROOF_PANGGILAN
    '',                                          // 61 BJ MIA_REQUEST_ID (reserved)
    data?.MIA_STATUS === 'MIA' ? 'requested' : '', // 62 BK MIA_STATUS

    // Columns 63-64: Kemaskini Maklumat (Updated Contact Info)
    data?.KEMASKINI_MAKLUMAT?.alamat_baharu || '',   // 63 BL ALAMAT_BAHARU
    data?.KEMASKINI_MAKLUMAT?.telefon_baharu || '',  // 64 BM TELEFON_BAHARU

    // Column 65: Additional UM field
    umData.UM_ULASAN_ASET_TUNAI || '',           // 65 BN UM_ULASAN_ASET_TUNAI

    // Column 66: Entrepreneur ID
    data.entrepreneur_id || '',                  // 66 BO ENTREPRENEUR_ID
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
function mapUMDataToSheetRow(reportData, umData, entrepreneurBatch = '') {
  const row = Array(72).fill(''); // Columns 0-71 (A-BT: 72 total)

  // ✅ Columns A-K (0-10): Basic session info
  row[0] = new Date().toISOString();                     // A  Timestamp
  row[1] = reportData.EMAIL_MENTOR || '';                // B  Email Address
  row[2] = 'MAJU';                                       // C  Program
  row[3] = entrepreneurBatch || '';                      // D  Batch (from entrepreneur record)
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
}
