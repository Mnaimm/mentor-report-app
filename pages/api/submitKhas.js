// pages/api/submitKhas.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createAdminClient } from '../../lib/supabaseAdmin';
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createAdminClient();
  const data = req.body;

  if (!data.entrepreneur_id || !data.program || !data.session_number) {
    return res.status(400).json({ error: 'Missing required fields: entrepreneur_id, program, session_number' });
  }

  try {
    const mentorEmail = session.user.email?.toLowerCase().trim();
    console.log(`[submitKhas][ENTRY] mentor=${mentorEmail} entrepreneur=${data.entrepreneur_id} program=${data.program} sesi=${data.session_number}`);

    // ── Resolve mentor_id ──
    const { data: mentorRecord, error: mentorErr } = await supabase
      .from('mentors')
      .select('id, name')
      .eq('email', mentorEmail)
      .maybeSingle();

    if (mentorErr) throw new Error(`Mentor lookup failed: ${mentorErr.message}`);
    if (!mentorRecord) throw new Error(`Mentor not found for email: ${mentorEmail}`);

    // ── Resolve entrepreneur ──
    const { data: entrepreneur, error: entErr } = await supabase
      .from('entrepreneurs')
      .select('id, name, business_name, phone, address, program, batch, zone, email, folder_id')
      .eq('id', data.entrepreneur_id)
      .maybeSingle();

    if (entErr) throw new Error(`Entrepreneur lookup failed: ${entErr.message}`);
    if (!entrepreneur) throw new Error(`Entrepreneur not found: ${data.entrepreneur_id}`);

    const normalizedProgram = data.program.charAt(0).toUpperCase() + data.program.slice(1).toLowerCase();
    const isMaju = normalizedProgram === 'Maju';
    const sessionNum = parseInt(data.session_number, 10);

    // ── Build reports payload ──
    const supabasePayload = {
      program: normalizedProgram,
      source: 'web_form_khas',
      status: 'submitted',
      submission_date: new Date().toISOString(),

      entrepreneur_id: entrepreneur.id,
      mentor_id: mentorRecord.id,
      mentor_email: mentorEmail,
      nama_mentor: mentorRecord.name || session.user.name || null,

      nama_mentee: entrepreneur.name || null,
      nama_usahawan: entrepreneur.name || null,
      nama_syarikat: entrepreneur.business_name || null,
      no_telefon: entrepreneur.phone || null,
      alamat_perniagaan: entrepreneur.address || null,

      session_number: sessionNum,
      session_date: data.session_date || null,
      mod_sesi: data.mod_sesi || null,
      lokasi_f2f: data.lokasi_f2f || null,
      masa_mula: data.masa_mula || null,

      // Pemerhatian/Latar belakang (saved per session as audit trail)
      pemerhatian: isMaju ? null : (data.pemerhatian || null),
      latarbelakang_usahawan: isMaju ? (data.latarbelakang || null) : null,

      // Session summary
      rumusan: isMaju ? null : (data.rumusan || null),
      rumusan_langkah_kehadapan: isMaju ? (data.rumusan || null) : null,
      status_perniagaan: data.status_perniagaan || null,

      // Financial data — both programs now use data_kewangan_bulanan
      jualan_terkini: null,
      data_kewangan_bulanan: data.data_kewangan_bulanan || [],

      image_urls: {
        sesi: Array.isArray(data.url_gambar_json) ? data.url_gambar_json : [],
        premis: [],
        growthwheel: '',
        profil: '',
      },
      premis_dilawat: false,

      // MIA always not applicable for khas form
      mia_status: 'Selesai',
      mia_reason: null,
      mia_proof_url: null,

      payment_status: 'pending',
      base_payment_amount: (() => {
        let base = (sessionNum >= 3) ? 180 : 100;
        return base;
      })(),
    };

    // ── PRIMARY WRITE: Supabase (blocking) ──
    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert(supabasePayload)
      .select('id')
      .single();

    if (insertErr) throw new Error(`Supabase insert failed: ${insertErr.message}`);

    const reportId = inserted.id;
    console.log(`[submitKhas][DB_OK] report_id=${reportId.slice(0, 8)} status=submitted`);

    // ── SECONDARY WRITE: Google Sheets + GAS doc generation (non-blocking) ──
    setImmediate(async () => {
      try {
        const khasSheetId = process.env.KHAS_SPREADSHEET_ID;
        if (!khasSheetId) {
          console.warn('⚠️ [submitKhas] KHAS_SPREADSHEET_ID not set — skipping Sheets write');
          return;
        }

        const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
        const credentials = JSON.parse(credentialsJson);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const khasTab = process.env.KHAS_SHEET_TAB || 'KES KHAS';

        let umData = {};
        if (data.UPWARD_MOBILITY_JSON) {
          try { umData = JSON.parse(data.UPWARD_MOBILITY_JSON); } catch {}
        }

        const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        const rowData = [
          timestamp,                                                  // A  Timestamp
          mentorRecord.name || '',                                    // B  Nama Mentor
          mentorEmail,                                                // C  Email Mentor
          normalizedProgram,                                          // D  Program
          entrepreneur.batch || '',                                   // E  Batch
          entrepreneur.zone || '',                                    // F  Zon
          entrepreneur.name || '',                                    // G  Nama Usahawan
          entrepreneur.business_name || '',                           // H  Nama Syarikat
          entrepreneur.phone || '',                                   // I  No Telefon
          entrepreneur.address || '',                                 // J  Alamat Perniagaan
          sessionNum,                                                 // K  Sesi Ke
          data.session_date || '',                                    // L  Tarikh Sesi
          data.masa_mula || '',                                       // M  Waktu Bermula
          data.mod_sesi || '',                                        // N  Mod Sesi
          data.lokasi_f2f || '',                                      // O  Lokasi Sesi F2F
          data.pemerhatian || data.latarbelakang || '',               // P  Pemerhatian / Latar Belakang
          data.status_perniagaan || '',                               // Q  Status Perniagaan
          data.rumusan || '',                                         // R  Rumusan Sesi
          JSON.stringify(data.data_kewangan_bulanan || []),           // S  DATA_KEWANGAN_JSON
          umData.UM_STATUS || '',                                     // T  UM_STATUS
          umData.UM_KRITERIA_IMPROVEMENT || '',                       // U  UM_KRITERIA_IMPROVEMENT
          umData.UM_AKAUN_BIMB || '',                                // V  UM_AKAUN_BIMB
          umData.UM_BIMB_BIZ || '',                                  // W  UM_BIMB_BIZ
          umData.UM_AL_AWFAR || '',                                  // X  UM_AL_AWFAR
          umData.UM_MERCHANT_TERMINAL || '',                          // Y  UM_MERCHANT_TERMINAL
          umData.UM_FASILITI_LAIN || '',                             // Z  UM_FASILITI_LAIN
          umData.UM_MESINKIRA || '',                                 // AA UM_MESINKIRA
          umData.UM_PENDAPATAN_SEMASA || '',                         // AB UM_PENDAPATAN_SEMASA
          umData.UM_ULASAN_PENDAPATAN || '',                         // AC UM_ULASAN_PENDAPATAN
          umData.UM_PEKERJA_SEMASA || '',                            // AD UM_PEKERJA_SEMASA
          umData.UM_ULASAN_PEKERJA || '',                            // AE UM_ULASAN_PEKERJA
          umData.UM_PEKERJA_PARTTIME_SEMASA || '',                   // AF UM_PEKERJA_PARTTIME_SEMASA
          umData.UM_ULASAN_PEKERJA_PARTTIME || '',                   // AG UM_ULASAN_PEKERJA_PARTTIME
          umData.UM_ASET_BUKAN_TUNAI_SEMASA || '',                  // AH UM_ASET_BUKAN_TUNAI_SEMASA
          umData.UM_ULASAN_ASET_BUKAN_TUNAI || '',                  // AI UM_ULASAN_ASET_BUKAN_TUNAI
          umData.UM_SIMPANAN_SEMASA || '',                           // AJ UM_SIMPANAN_SEMASA
          umData.UM_ULASAN_SIMPANAN || '',                           // AK UM_ULASAN_SIMPANAN
          umData.UM_ZAKAT_SEMASA || '',                              // AL UM_ZAKAT_SEMASA
          umData.UM_ULASAN_ZAKAT || '',                              // AM UM_ULASAN_ZAKAT
          umData.UM_DIGITAL_SEMASA || '',                            // AN UM_DIGITAL_SEMASA
          umData.UM_ULASAN_DIGITAL || '',                            // AO UM_ULASAN_DIGITAL
          umData.UM_MARKETING_SEMASA || '',                          // AP UM_MARKETING_SEMASA
          umData.UM_ULASAN_MARKETING || '',                          // AQ UM_ULASAN_MARKETING
          umData.UM_TARIKH_LAWATAN_PREMIS || '',                     // AR UM_TARIKH_LAWATAN_PREMIS
          supabasePayload.base_payment_amount || '',                 // AS base_payment_amount
          'pending',                                                  // AT payment_status
          '',                                                         // AU Status (Apps Script fills)
          '',                                                         // AV DOC_URL (Apps Script fills)
          entrepreneur.folder_id || '',                              // AW Folder_ID
          reportId,                                                   // AX report_id
          JSON.stringify(Array.isArray(data.url_gambar_json) ? data.url_gambar_json : []), // AY URL_GAMBAR_JSON
        ];

        console.log(`[submitKhas][SHEETS_START] sheet=${khasSheetId.slice(0, 6)}... tab=${khasTab} cols=${rowData.length}`);
        const appendRes = await sheets.spreadsheets.values.append({
          spreadsheetId: khasSheetId,
          range: `${khasTab}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [rowData] },
        });

        const updatedRange = appendRes.data?.updates?.updatedRange || '';
        const newRowNumber = updatedRange.match(/!A(\d+):/)?.[1];
        console.log(`[submitKhas][SHEETS_OK] row=${newRowNumber} range=${updatedRange}`);

        // Call GAS to trigger doc generation
        const gasUrl = process.env.GAS_KHAS_URL;
        if (newRowNumber && gasUrl) {
          try {
            const maskedGasUrl = gasUrl.length > 20 ? ('...' + gasUrl.slice(-20)) : gasUrl;
            console.log(`[submitKhas][GAS_START] url=${maskedGasUrl} row=${newRowNumber}`);
            const gasRes = await fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'processRow', rowNumber: parseInt(newRowNumber, 10) }),
            });
            const gasJson = await gasRes.json();
            console.log(`[submitKhas][GAS_OK] status=${gasRes.status} success=${gasJson?.result?.success}`);
          } catch (gasErr) {
            console.error(`[submitKhas][ERROR_GAS] ${gasErr.message}`);
          }
        } else if (!gasUrl) {
          console.warn('⚠️ [submitKhas] GAS_KHAS_URL not set — doc generation skipped');
        }

      } catch (sheetsErr) {
        console.error(`[submitKhas][ERROR_SHEETS] ${sheetsErr.message}`);
      }
    });

    // ── SECONDARY WRITE: Upward Mobility (non-blocking) ──
    if (data.UPWARD_MOBILITY_JSON) {
      setImmediate(async () => {
        try {
          const umData = JSON.parse(data.UPWARD_MOBILITY_JSON);
          const umPayload = {
            entrepreneur_id: entrepreneur.id,
            mentor_id: mentorRecord.id,
            sesi_mentoring: `Sesi ${sessionNum}`,
            program: normalizedProgram.toUpperCase(),
            batch: entrepreneur.batch || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (umData.UM_STATUS) umPayload.um_status = umData.UM_STATUS;
          if (umData.UM_KRITERIA_IMPROVEMENT) umPayload.kriteria_improvement = umData.UM_KRITERIA_IMPROVEMENT;
          if (umData.UM_TARIKH_LAWATAN_PREMIS) umPayload.tarikh_lawatan = umData.UM_TARIKH_LAWATAN_PREMIS;
          if (umData.UM_AKAUN_BIMB) umPayload.bank_akaun_semasa = umData.UM_AKAUN_BIMB;
          if (umData.UM_BIMB_BIZ) umPayload.bank_bizapp = umData.UM_BIMB_BIZ;
          if (umData.UM_AL_AWFAR) umPayload.bank_al_awfar = umData.UM_AL_AWFAR;
          if (umData.UM_MERCHANT_TERMINAL) umPayload.bank_merchant_terminal = umData.UM_MERCHANT_TERMINAL;
          if (umData.UM_FASILITI_LAIN) umPayload.bank_fasiliti_lain = umData.UM_FASILITI_LAIN;
          if (umData.UM_MESINKIRA) umPayload.bank_mesinkira = umData.UM_MESINKIRA;

          const parseNum = (v) => { const n = parseFloat(v); return isNaN(n) ? undefined : n; };
          const parseInt2 = (v) => { const n = parseInt(v); return isNaN(n) ? undefined : n; };

          const pendapatan = parseNum(umData.UM_PENDAPATAN_SEMASA);
          if (pendapatan !== undefined) umPayload.pendapatan_semasa = pendapatan;
          if (umData.UM_ULASAN_PENDAPATAN) umPayload.ulasan_pendapatan = umData.UM_ULASAN_PENDAPATAN;

          const pekerja = parseInt2(umData.UM_PEKERJA_SEMASA);
          if (pekerja !== undefined) umPayload.pekerja_semasa = pekerja;
          if (umData.UM_ULASAN_PEKERJA) umPayload.ulasan_pekerjaan = umData.UM_ULASAN_PEKERJA;

          const pekerjaParttime = parseInt2(umData.UM_PEKERJA_PARTTIME_SEMASA);
          if (pekerjaParttime !== undefined) umPayload.pekerja_parttime_semasa = pekerjaParttime;
          if (umData.UM_ULASAN_PEKERJA_PARTTIME) umPayload.ulasan_pekerja_parttime = umData.UM_ULASAN_PEKERJA_PARTTIME;

          const aset = parseNum(umData.UM_ASET_BUKAN_TUNAI_SEMASA);
          if (aset !== undefined) umPayload.aset_bukan_tunai_semasa = aset;
          if (umData.UM_ULASAN_ASET_BUKAN_TUNAI) umPayload.ulasan_aset_bukan_tunai = umData.UM_ULASAN_ASET_BUKAN_TUNAI;

          const simpanan = parseNum(umData.UM_SIMPANAN_SEMASA);
          if (simpanan !== undefined) umPayload.simpanan_semasa = simpanan;
          if (umData.UM_ULASAN_SIMPANAN) umPayload.ulasan_simpanan = umData.UM_ULASAN_SIMPANAN;

          if (umData.UM_ZAKAT_SEMASA) umPayload.zakat_semasa = umData.UM_ZAKAT_SEMASA;
          if (umData.UM_ULASAN_ZAKAT) umPayload.ulasan_zakat = umData.UM_ULASAN_ZAKAT;
          if (umData.UM_DIGITAL_SEMASA) umPayload.digital_semasa = umData.UM_DIGITAL_SEMASA;
          if (umData.UM_ULASAN_DIGITAL) umPayload.ulasan_digital = umData.UM_ULASAN_DIGITAL;
          if (umData.UM_MARKETING_SEMASA) umPayload.marketing_semasa = umData.UM_MARKETING_SEMASA;
          if (umData.UM_ULASAN_MARKETING) umPayload.ulasan_marketing = umData.UM_ULASAN_MARKETING;

          const { error: umErr } = await supabase
            .from('upward_mobility_reports')
            .insert(umPayload);

          if (umErr) {
            console.error(`[submitKhas][ERROR_UM] ${umErr.message}`);
          } else {
            console.log(`[submitKhas][UM_OK] um_insert=success`);

            // Fire-and-forget: mirror UM data to shared Upward Mobility sheet
            try {
              const umSheetId = process.env.GOOGLE_SHEET_ID_UM || process.env.UPWARD_MOBILITY_SPREADSHEET_ID;
              if (!umSheetId) {
                console.warn('[submitKhas][UM_SHEETS] GOOGLE_SHEET_ID_UM not set — skipping UM sheet write');
              } else {
                const umCredentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
                const umCreds = JSON.parse(umCredentialsJson);
                const umAuth = new google.auth.GoogleAuth({
                  credentials: umCreds,
                  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
                });
                const umSheets = google.sheets({ version: 'v4', auth: umAuth });

                // 72-column row (A-BT) — identical structure used by Bangkit & Maju UM
                const umRow = Array(72).fill('');

                // A-K (0-10): Basic session info
                umRow[0] = new Date().toISOString();           // A  Timestamp
                umRow[1] = mentorEmail;                        // B  Email Mentor
                umRow[2] = normalizedProgram;                  // C  Program
                umRow[3] = entrepreneur.batch || '';           // D  Batch
                umRow[4] = `Sesi ${sessionNum}`;               // E  Sesi Mentoring
                umRow[5] = mentorRecord.name || '';            // F  Nama Mentor
                umRow[6] = entrepreneur.name || '';            // G  Nama Usahawan
                umRow[7] = entrepreneur.business_name || '';   // H  Nama Perniagaan
                umRow[8] = '';                                 // I  Produk/Servis (not captured in khas form)
                umRow[9] = entrepreneur.address || '';         // J  Alamat Perniagaan
                umRow[10] = entrepreneur.phone || '';          // K  Nombor Telefon

                // L-AR (11-43): Legacy fields — leave empty

                // AS-BT (44-71): UM-specific fields (28 columns)
                umRow[44] = umData.UM_STATUS_PENGLIBATAN || '';       // AS UM_STATUS_PENGLIBATAN
                umRow[45] = umData.UM_STATUS || '';                    // AT UM_STATUS
                umRow[46] = umData.UM_KRITERIA_IMPROVEMENT || '';      // AU UM_KRITERIA_IMPROVEMENT
                umRow[47] = umData.UM_AKAUN_BIMB || '';               // AV UM_AKAUN_BIMB
                umRow[48] = umData.UM_BIMB_BIZ || '';                 // AW UM_BIMB_BIZ
                umRow[49] = umData.UM_AL_AWFAR || '';                 // AX UM_AL_AWFAR
                umRow[50] = umData.UM_MERCHANT_TERMINAL || '';        // AY UM_MERCHANT_TERMINAL
                umRow[51] = umData.UM_FASILITI_LAIN || '';            // AZ UM_FASILITI_LAIN
                umRow[52] = umData.UM_MESINKIRA || '';                // BA UM_MESINKIRA
                umRow[53] = umData.UM_PENDAPATAN_SEMASA || '';        // BB UM_PENDAPATAN_SEMASA
                umRow[54] = umData.UM_ULASAN_PENDAPATAN || '';        // BC UM_ULASAN_PENDAPATAN
                umRow[55] = umData.UM_PEKERJA_SEMASA || '';           // BD UM_PEKERJA_SEMASA
                umRow[56] = umData.UM_ULASAN_PEKERJA || '';           // BE UM_ULASAN_PEKERJA
                umRow[57] = umData.UM_ASET_BUKAN_TUNAI_SEMASA || ''; // BF UM_ASET_BUKAN_TUNAI_SEMASA
                umRow[58] = umData.UM_PEKERJA_PARTTIME_SEMASA || ''; // BG UM_PEKERJA_PARTTIME_SEMASA
                umRow[59] = umData.UM_ULASAN_PEKERJA_PARTTIME || ''; // BH UM_ULASAN_PEKERJA_PARTTIME
                umRow[60] = umData.UM_ULASAN_ASET_BUKAN_TUNAI || ''; // BI UM_ULASAN_ASET_BUKAN_TUNAI
                umRow[61] = umData.UM_SIMPANAN_SEMASA || '';          // BJ UM_SIMPANAN_SEMASA
                umRow[62] = umData.UM_ULASAN_SIMPANAN || '';          // BK UM_ULASAN_SIMPANAN
                umRow[63] = umData.UM_ZAKAT_SEMASA || '';             // BL UM_ZAKAT_SEMASA
                umRow[64] = umData.UM_ULASAN_ZAKAT || '';             // BM UM_ULASAN_ZAKAT
                umRow[65] = umData.UM_DIGITAL_SEMASA || '';           // BN UM_DIGITAL_SEMASA
                umRow[66] = umData.UM_ULASAN_DIGITAL || '';           // BO UM_ULASAN_DIGITAL
                umRow[67] = umData.UM_MARKETING_SEMASA || '';         // BP UM_MARKETING_SEMASA
                umRow[68] = umData.UM_ULASAN_MARKETING || '';         // BQ UM_ULASAN_MARKETING
                umRow[69] = umData.UM_TARIKH_LAWATAN_PREMIS || '';    // BR UM_TARIKH_LAWATAN_PREMIS
                // BS-BT (70-71): reserved — leave empty

                const umAppendRes = await umSheets.spreadsheets.values.append({
                  spreadsheetId: umSheetId,
                  range: 'UM!A1',
                  valueInputOption: 'USER_ENTERED',
                  insertDataOption: 'INSERT_ROWS',
                  requestBody: { values: [umRow] },
                });

                const umUpdatedRange = umAppendRes.data?.updates?.updatedRange || '';
                const umNewRow = umUpdatedRange.match(/!A(\d+):/)?.[1];
                console.log(`[submitKhas][UM_SHEETS_OK] row=${umNewRow} range=${umUpdatedRange}`);
              }
            } catch (umSheetsErr) {
              console.error(`[submitKhas][ERROR_UM_SHEETS] ${umSheetsErr.message}`);
            }
          }
        } catch (err) {
          console.error(`[submitKhas][ERROR_UM] ${err.message}`);
        }
      });
    }

    // ── LOGGING: dual_write_monitoring (non-blocking) ──
    setImmediate(async () => {
      try {
        await supabase.from('dual_write_monitoring').insert({
          source_system: 'web_form_khas',
          target_system: 'supabase',
          operation_type: 'insert',
          table_name: 'reports',
          record_id: reportId,
          status: 'success',
          timestamp: new Date().toISOString(),
          metadata: {
            mentor_email: mentorEmail,
            mentee_name: entrepreneur.name,
            session_number: sessionNum,
            program: normalizedProgram,
            form_type: 'khas',
          },
        });
      } catch { /* non-blocking */ }
    });

    return res.status(200).json({
      success: true,
      reportId,
      message: 'Laporan Kes Khas berjaya dihantar.',
    });

  } catch (err) {
    console.error(`[submitKhas][ERROR] ${err.message}`);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
