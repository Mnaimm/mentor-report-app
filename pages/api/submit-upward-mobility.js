// pages/api/submit-upward-mobility.js
import { google } from 'googleapis';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const formData = req.body;

const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
const credentials = JSON.parse(credentialsJson);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});


    const sheets = google.sheets({ version: 'v4', auth });

    // The order here MUST match the order of your 44 columns (A to AR)
    // The auto-filled fields are now correctly taken from formData
    const newRow = [
      new Date().toISOString(), // A: Timestamp
      formData.email, // B: Email Address
      formData.program, // C: Program
      formData.batch, // D: Batch
      formData.sesiMentoring, // E: Sesi Mentoring
      formData.namaMentor, // F: Nama Mentor (Auto-filled)
      formData.namaUsahawan, // G: Nama Penuh Usahawan (Auto-filled)
      formData.namaPerniagaan, // H: Nama Penuh Perniagaan (Auto-filled)
      formData.jenisPerniagaan, // I: Jenis Perniagaan (MANUAL INPUT)
      formData.alamatPerniagaan, // J: Alamat Perniagaan (Auto-filled)
      formData.nomborTelefon, // K: Nombor Telefon (Auto-filled)
      formData.statusPenglibatan, // L: Status Penglibatan
      formData.upwardMobilityStatus, // M: Upward Mobility Status
      formData.kriteriaImprovement, // N: Kriteria Improvement
      formData.tarikhLawatan, // O: Tarikh lawatan
      formData.penggunaanAkaunSemasa, // P: Penggunaan Akaun Semasa
      formData.penggunaanBimbBiz, // Q: Penggunaan BIMB Biz
      formData.bukaAkaunAlAwfar, // R: Buka akaun Al-Awfar
      formData.penggunaanBimbMerchant, // S: Penggunaan BIMB Merchant
      formData.lainLainFasiliti, // T: Lain-lain Fasiliti
      formData.langganMesinKira, // U: Langgan aplikasi MesinKira
      formData.pendapatanSebelum, // V: Jumlah Pendapatan (Sebelum)
      formData.pendapatanSelepas, // W: Jumlah Pendapatan (Selepas)
      formData.ulasanPendapatan, // X: Ulasan Mentor (Jumlah Pendapatan)
      formData.pekerjaanSebelum, // Y: Peluang Pekerjaan (Sebelum)
      formData.pekerjaanSelepas, // Z: Peluang Pekerjaan (Selepas)
      formData.ulasanPekerjaan, // AA: Ulasan Mentor (Peluang Pekerjaan)
      formData.asetBukanTunaiSebelum, // AB: Nilai Aset Bukan Tunai (Sebelum)
      formData.asetBukanTunaiSelepas, // AC: Nilai Aset Bukan Tunai (Selepas)
      formData.asetTunaiSebelum, // AD: Nilai Aset Bentuk Tunai (Sebelum)
      formData.asetTunaiSelepas, // AE: Nilai Aset Bentuk Tunai (Selepas)
      formData.ulasanAset, // AF: Ulasan Mentor (Nilai Aset)
      formData.simpananSebelum, // AG: Simpanan Perniagaan (Sebelum)
      formData.simpananSelepas, // AH: Simpanan Perniagaan (Selepas)
      formData.ulasanSimpanan, // AI: Ulasan Mentor (Simpanan)
      formData.zakatSebelum, // AJ: Pembayaran Zakat (Sebelum)
      formData.zakatSelepas, // AK: Pembayaran Zakat (Selepas)
      formData.ulasanZakat, // AL: Ulasan Mentor (Pembayaran Zakat)
      formData.digitalSebelum.join(', '), // AM: Penggunaan Digital (Sebelum)
      formData.digitalSelepas.join(', '), // AN: Penggunaan Digital (Selepas)
      formData.ulasanDigital, // AO: Ulasan Mentor (Penggunaan Digital)
      formData.onlineSalesSebelum.join(', '), // AP: Jualan dan Pemasaran (Sebelum)
      formData.onlineSalesSelepas.join(', '), // AQ: Jualan dan Pemasaran (Selepas)
      formData.ulasanOnlineSales, // AR: Ulasan Mentor (Jualan dan Pemasaran)
    ];

    // Use proper range format: SheetName!A2:AR to append after headers (row 1)
    const sheetName = process.env.RESPONSES_SHEET_NAME || 'UM';
    const range = `${sheetName}!A2:AR`; // Start from row 2, append at bottom

    const appendResult = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.UPWARD_MOBILITY_SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS', // This ensures it inserts a new row instead of overwriting
      requestBody: {
        values: [newRow],
      },
    });

    // Extract row number from the updated range
    const updatedRange = appendResult.data?.updates?.updatedRange || '';
    const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1] || null;
    console.log(`✅ Data saved to Google Sheets row ${newRowNumber}`);

    // ============================================================
    // DUAL-WRITE TO SUPABASE (NON-BLOCKING)
    // ============================================================
    let supabaseSuccess = false;
    let supabaseError = null;
    let supabaseRecordId = null;

    try {
      console.log('📊 Starting Supabase dual-write for Upward Mobility report...');

      // Prepare Supabase payload
      const supabasePayload = {
        // Metadata
        created_at: new Date().toISOString(),
        google_sheets_row: newRowNumber,

        // Basic Info
        email: formData.email || null,
        program: formData.program || null,
        batch: formData.batch || null,
        session_mentoring: formData.sesiMentoring || null,

        // Mentor & Entrepreneur Info
        mentor_name: formData.namaMentor || null,
        entrepreneur_name: formData.namaUsahawan || null,
        business_name: formData.namaPerniagaan || null,
        business_type: formData.jenisPerniagaan || null,
        business_address: formData.alamatPerniagaan || null,
        phone_number: formData.nomborTelefon || null,

        // Status & Mobility
        engagement_status: formData.statusPenglibatan || null,
        upward_mobility_status: formData.upwardMobilityStatus || null,
        improvement_criteria: formData.kriteriaImprovement || null,
        premises_visit_date: formData.tarikhLawatan || null,

        // Banking & Fintech Usage
        uses_bimb_current_account: formData.penggunaanAkaunSemasa || null,
        uses_bimb_biz: formData.penggunaanBimbBiz || null,
        opened_al_awfar_account: formData.bukaAkaunAlAwfar || null,
        uses_bimb_merchant: formData.penggunaanBimbMerchant || null,
        uses_other_bimb_facilities: formData.lainLainFasiliti || null,
        subscribes_mesinkira: formData.langganMesinKira || null,

        // Financial Situation - Revenue
        revenue_before: parseFloat(formData.pendapatanSebelum) || null,
        revenue_after: parseFloat(formData.pendapatanSelepas) || null,
        revenue_mentor_comments: formData.ulasanPendapatan || null,

        // Financial Situation - Employment
        employment_before: parseInt(formData.pekerjaanSebelum) || null,
        employment_after: parseInt(formData.pekerjaanSelepas) || null,
        employment_mentor_comments: formData.ulasanPekerjaan || null,

        // Financial Situation - Assets
        non_cash_assets_before: parseFloat(formData.asetBukanTunaiSebelum) || null,
        non_cash_assets_after: parseFloat(formData.asetBukanTunaiSelepas) || null,
        cash_assets_before: parseFloat(formData.asetTunaiSebelum) || null,
        cash_assets_after: parseFloat(formData.asetTunaiSelepas) || null,
        assets_mentor_comments: formData.ulasanAset || null,

        // Financial Situation - Savings
        savings_before: parseFloat(formData.simpananSebelum) || null,
        savings_after: parseFloat(formData.simpananSelepas) || null,
        savings_mentor_comments: formData.ulasanSimpanan || null,

        // Financial Situation - Zakat
        zakat_before: parseFloat(formData.zakatSebelum) || null,
        zakat_after: parseFloat(formData.zakatSelepas) || null,
        zakat_mentor_comments: formData.ulasanZakat || null,

        // Digitalization
        digital_usage_before: formData.digitalSebelum || [],
        digital_usage_after: formData.digitalSelepas || [],
        digital_mentor_comments: formData.ulasanDigital || null,

        // Online Sales & Marketing
        online_sales_before: formData.onlineSalesSebelum || [],
        online_sales_after: formData.onlineSalesSelepas || [],
        online_sales_mentor_comments: formData.ulasanOnlineSales || null,

        // Program type
        program_type: 'tubf_upward_mobility'
      };

      const { data: insertedData, error: supabaseInsertError } = await supabase
        .from('upward_mobility_reports')
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
        table_name: 'upward_mobility_reports',
        record_id: supabaseRecordId,
        google_sheets_row: newRowNumber,
        status: 'success',
        timestamp: new Date().toISOString(),
        metadata: {
          mentor_name: formData.namaMentor,
          entrepreneur_name: formData.namaUsahawan,
          session: formData.sesiMentoring
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
          table_name: 'upward_mobility_reports',
          google_sheets_row: newRowNumber,
          status: 'failed',
          error_message: error.message,
          timestamp: new Date().toISOString(),
          metadata: {
            mentor_name: formData.namaMentor,
            entrepreneur_name: formData.namaUsahawan,
            session: formData.sesiMentoring
          }
        });
      } catch (monitoringError) {
        console.error('⚠️ Failed to log to dual_write_monitoring:', monitoringError);
      }
    }
    // ============================================================
    // END DUAL-WRITE TO SUPABASE
    // ============================================================

    res.status(200).json({ message: 'Form submitted successfully' });
  } catch (error) {
    console.error("Error in /api/submit-upward-mobility:", error);
    res.status(500).json({ error: 'Failed to submit form' });
  }
}
