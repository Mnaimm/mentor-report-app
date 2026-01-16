// pages/api/submitMajuReport.js
import { google } from 'googleapis';
import cache from '../../lib/simple-cache';
import { supabase } from '../../lib/supabaseClient';

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

    // Prepare row data
    const rowData = mapMajuDataToSheetRow(reportData);
    console.log('📊 Prepared row data (first 5 values):', rowData.slice(0, 5));
    console.log('📊 Folder_ID in row data (index 25):', rowData[25]);

    // Append data to Google Sheet with 8s timeout
    console.log('📊 Appending data to Google Sheets...');
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
    console.log('✅ Sheet append successful');

    // Extract the row number where data was appended
    const updatedRange = appendRes.data?.updates?.updatedRange || '';
    console.log('📊 Updated range:', updatedRange);
    
    // Parse row number from something like "LaporanMaju!A3:AC3"
    const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];
    console.log('🔢 Extracted row number:', newRowNumber);

    if (!newRowNumber) {
      throw new Error('Could not determine the row number where data was inserted.');
    }

    // Document will be generated automatically by Apps Script time-driven trigger
    console.log(`✅ Data saved to row ${newRowNumber}. Document will be generated automatically.`);

    // ============================================================
    // DUAL-WRITE TO SUPABASE (NON-BLOCKING)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;

    try {
      console.log('📊 Starting Supabase dual-write for MAJU report...');

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

      const { data: insertedData, error: supabaseInsertError } = await supabase
        .from('reports')  // ✅ FIXED: Use existing 'reports' table (same for Bangkit & Maju)
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
          mentor_email: reportData.EMAIL_MENTOR,
          mentee_name: reportData.NAMA_MENTEE,
          session_number: reportData.SESI_NUMBER
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
            mentor_email: reportData.EMAIL_MENTOR,
            mentee_name: reportData.NAMA_MENTEE,
            session_number: reportData.SESI_NUMBER
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
        console.log('📊 Starting Upward Mobility dual-write...');

        // Parse the UM JSON data
        const umData = JSON.parse(reportData.UPWARD_MOBILITY_JSON);

        // Get mentor and entrepreneur IDs from reports table record
        const { data: reportRecord, error: reportFetchError } = await supabase
          .from('reports')
          .select('id, mentor_email, nama_mentee')
          .eq('id', supabaseRecordId)
          .single();

        if (reportFetchError) throw new Error(`Failed to fetch report record: ${reportFetchError.message}`);

        // Get mentor_id from mentors table
        const { data: mentorData, error: mentorError } = await supabase
          .from('mentors')
          .select('id')
          .eq('email', reportData.EMAIL_MENTOR)
          .single();

        if (mentorError) throw new Error(`Failed to fetch mentor: ${mentorError.message}`);

        // Get entrepreneur_id from entrepreneurs table
        const { data: entrepreneurData, error: entrepreneurError } = await supabase
          .from('entrepreneurs')
          .select('id')
          .eq('name', reportData.NAMA_MENTEE)
          .single();

        if (entrepreneurError) throw new Error(`Failed to fetch entrepreneur: ${entrepreneurError.message}`);

        // Prepare UM payload
        const umPayload = {
          session_id: supabaseRecordId,              // Link to reports table
          entrepreneur_id: entrepreneurData.id,
          mentor_id: mentorData.id,
          program: 'MAJU',
          sesi_mentoring: `Sesi ${reportData.SESI_NUMBER}`,

          // Section 3: Status & Mobiliti
          status_penglibatan: umData.UM_STATUS_PENGLIBATAN || null,
          um_status: umData.UM_STATUS || null,
          kriteria_improvement: umData.UM_KRITERIA_IMPROVEMENT || null,
          tarikh_lawatan: umData.UM_TARIKH_LAWATAN_PREMIS || null,

          // Section 4: Bank Islam & Fintech
          bank_akaun_semasa: umData.UM_AKAUN_BIMB || null,
          bank_bizapp: umData.UM_BIMB_BIZ || null,
          bank_al_awfar: umData.UM_AL_AWFAR || null,
          bank_merchant_terminal: umData.UM_MERCHANT_TERMINAL || null,
          bank_fasiliti_lain: umData.UM_FASILITI_LAIN || null,
          bank_mesinkira: umData.UM_MESINKIRA || null,

          // Section 5: Situasi Kewangan (Semasa + Ulasan)
          pendapatan_semasa: umData.UM_PENDAPATAN_SEMASA ? parseFloat(umData.UM_PENDAPATAN_SEMASA) : null,
          ulasan_pendapatan: umData.UM_ULASAN_PENDAPATAN || null,
          pekerja_semasa: umData.UM_PEKERJA_SEMASA ? parseInt(umData.UM_PEKERJA_SEMASA) : null,
          ulasan_pekerja: umData.UM_ULASAN_PEKERJA || null,
          aset_bukan_tunai_semasa: umData.UM_ASET_BUKAN_TUNAI_SEMASA ? parseFloat(umData.UM_ASET_BUKAN_TUNAI_SEMASA) : null,
          ulasan_aset_bukan_tunai: umData.UM_ULASAN_ASET_BUKAN_TUNAI || null,
          aset_tunai_semasa: umData.UM_ASET_TUNAI_SEMASA ? parseFloat(umData.UM_ASET_TUNAI_SEMASA) : null,
          ulasan_aset_tunai: umData.UM_ULASAN_ASET_TUNAI || null,
          simpanan_semasa: umData.UM_SIMPANAN_SEMASA ? parseFloat(umData.UM_SIMPANAN_SEMASA) : null,
          ulasan_simpanan: umData.UM_ULASAN_SIMPANAN || null,
          zakat_semasa: umData.UM_ZAKAT_SEMASA || null,
          ulasan_zakat: umData.UM_ULASAN_ZAKAT || null,

          // Section 6: Digital & Marketing (comma-separated strings)
          digital_semasa: umData.UM_DIGITAL_SEMASA || null,
          ulasan_digital: umData.UM_ULASAN_DIGITAL || null,
          marketing_semasa: umData.UM_MARKETING_SEMASA || null,
          ulasan_marketing: umData.UM_ULASAN_MARKETING || null,

          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: umInsertedData, error: umInsertError } = await supabase
          .from('upward_mobility_reports')
          .insert(umPayload)
          .select();

        if (umInsertError) throw umInsertError;

        umSuccess = true;
        umRecordId = umInsertedData?.[0]?.id || null;
        console.log(`✅ Upward Mobility dual-write successful. Record ID: ${umRecordId}`);

        // Log UM success to dual_write_monitoring
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
            session_id: supabaseRecordId,
            mentor_email: reportData.EMAIL_MENTOR,
            mentee_name: reportData.NAMA_MENTEE,
            session_number: reportData.SESI_NUMBER
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
            google_sheets_row: newRowNumber,
            status: 'failed',
            error_message: error.message,
            timestamp: new Date().toISOString(),
            metadata: {
              session_id: supabaseRecordId,
              mentor_email: reportData.EMAIL_MENTOR,
              mentee_name: reportData.NAMA_MENTEE,
              session_number: reportData.SESI_NUMBER
            }
          });
        } catch (monitoringError) {
          console.error('⚠️ Failed to log UM failure to dual_write_monitoring:', monitoringError);
        }
      }
    } else {
      console.log(`ℹ️ Skipping UM write. MIA: ${reportData.MIA_STATUS}, Has UM Data: ${!!reportData.UPWARD_MOBILITY_JSON}, Has Reports ID: ${!!supabaseRecordId}`);
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
    const responseMessage = umSuccess
      ? 'Laporan MAJU & Upward Mobility berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.'
      : 'Laporan MAJU berjaya dihantar! Dokumen akan dicipta secara automatik dalam masa 1-2 minit.' +
        (umError ? ` (Nota: UM data tidak berjaya disimpan - ${umError})` : '');

    return res.status(200).json({
      success: true,
      message: responseMessage,
      rowNumber: newRowNumber,
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

// Helper function to map form data to sheet row
function mapMajuDataToSheetRow(data) {
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
    data.Folder_ID || '',                        // Folder_ID (FIXED: was Mentee_Folder_ID)
    '',                                          // Laporan_Maju_Doc_ID (empty, will be filled by Apps Script)
    data.MIA_STATUS || 'Tidak MIA',              // MIA_STATUS
    data.MIA_REASON || '',                       // MIA_REASON
    data.MIA_PROOF_URL || '',                    // MIA_PROOF_URL
    data.UPWARD_MOBILITY_JSON || '{}'            // UPWARD_MOBILITY_JSON (NEW for UM data)
  ];
}
