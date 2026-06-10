/**
 * Backfill 2 web form records to Google Sheets
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false';

async function backfillToSheets() {
    console.log('📝 Backfill Web Form Records to Google Sheets');
    console.log('='.repeat(80));
    console.log(`DRY_RUN: ${DRY_RUN} (set DRY_RUN=false to actually write)\n`);

    // Step 1: Fetch the 2 web form records
    console.log('📊 Step 1: Fetching web form records from Supabase...\n');

    const { data: records, error: fetchError } = await supabase
        .from('reports')
        .select('*')
        .eq('program', 'Maju')
        .eq('session_number', 2)
        .eq('source', 'web_form')
        .in('nama_usahawan', ['Nisha Binti Junus', 'Muhammad As-Shahkirin Bin Mohd Hussin']);

    if (fetchError) throw fetchError;

    console.log(`Found ${records.length} records to backfill\n`);

    if (records.length === 0) {
        console.log('⚠️  No records found to backfill\n');
        return;
    }

    records.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.nama_usahawan} (ID: ${r.id})`);
        console.log(`   Target row: ${r.sheets_row_number || 'UNKNOWN'}`);
        console.log(`   Submitted: ${new Date(r.submission_date).toLocaleString()}`);
        console.log('');
    });

    // Step 2: Initialize Google Sheets API
    console.log('🔑 Step 2: Initializing Google Sheets API...\n');

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;

    // Step 3: Write each record to its designated row
    console.log('📝 Step 3: Writing records to Google Sheets...\n');

    for (const record of records) {
        const rowNumber = record.sheets_row_number;

        if (!rowNumber) {
            console.log(`⚠️  Skipping ${record.nama_usahawan} - no sheets_row_number\n`);
            continue;
        }

        console.log(`Writing ${record.nama_usahawan} to row ${rowNumber}...`);

        // Map Supabase data to Sheet row format
        const rowData = mapMajuDataToSheetRow(record);

        console.log(`   Row data length: ${rowData.length} columns`);
        console.log(`   Mentee: ${rowData[3]}`);
        console.log(`   Session: ${rowData[9]}`);
        console.log(`   Mentor: ${rowData[2]}`);

        if (!DRY_RUN) {
            // Write to specific row using update instead of append
            const range = `LaporanMaju!A${rowNumber}:BM${rowNumber}`;

            const updateResponse = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [rowData]
                }
            });

            console.log(`   ✅ Written to row ${rowNumber}`);
            console.log(`   Updated range: ${updateResponse.data.updatedRange}\n`);
        } else {
            console.log(`   🔍 [DRY RUN] Would write to row ${rowNumber}\n`);
        }
    }

    console.log('='.repeat(80));
    console.log('✅ Backfill complete\n');
}

// Helper: Map Supabase report to Google Sheets row format
// MUST match the exact structure in submitMajuReport.js mapMajuDataToSheetRow()
function mapMajuDataToSheetRow(report) {
    // Format timestamp
    const timestamp = new Date(report.submission_date).toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur'
    });

    return [
        timestamp,                                         // A: Timestamp
        report.nama_mentor || '',                         // B: NAMA_MENTOR
        report.mentor_email || '',                        // C: EMAIL_MENTOR
        report.nama_usahawan || report.nama_mentee || '', // D: NAMA_MENTEE
        report.nama_bisnes || report.nama_syarikat || '', // E: NAMA_BISNES
        report.lokasi_bisnes || '',                       // F: LOKASI_BISNES
        report.produk_servis || '',                       // G: PRODUK_SERVIS
        report.no_telefon || '',                          // H: NO_TELEFON
        report.session_date || '',                        // I: TARIKH_SESI
        report.session_number || '',                      // J: SESI_NUMBER
        report.mod_sesi || '',                            // K: MOD_SESI
        report.lokasi_f2f || '',                          // L: LOKASI_F2F
        report.masa_mula || '',                           // M: MASA_MULA
        report.masa_tamat || '',                          // N: MASA_TAMAT
        report.latarbelakang_usahawan || '',              // O: LATARBELAKANG_USAHAWAN
        JSON.stringify(report.data_kewangan_bulanan || []), // P: DATA_KEWANGAN_BULANAN_JSON
        JSON.stringify(report.mentoring_findings || []),  // Q: MENTORING_FINDINGS_JSON
        report.refleksi?.perasaan || '',                  // R: REFLEKSI_MENTOR_PERASAAN
        report.refleksi?.komitmen || '',                  // S: REFLEKSI_MENTOR_KOMITMEN
        report.refleksi?.lain || '',                      // T: REFLEKSI_MENTOR_LAIN
        report.status_perniagaan || '',                   // U: STATUS_PERNIAGAAN_KESELURUHAN
        report.rumusan || '',                             // V: RUMUSAN_DAN_LANGKAH_KEHADAPAN
        JSON.stringify(report.image_urls?.premis || []),  // W: URL_GAMBAR_PREMIS_JSON
        JSON.stringify(report.image_urls?.sesi || []),    // X: URL_GAMBAR_SESI_JSON
        report.image_urls?.gw360 || report.image_urls?.growthwheel || '', // Y: URL_GAMBAR_GW360
        report.folder_id || '',                           // Z: Folder_ID
        report.doc_url || '',                             // AA: Laporan_Maju_Doc_ID
        report.mia_status || 'Tidak MIA',                 // AB: MIA_STATUS
        report.mia_reason || '',                          // AC: MIA_REASON
        '',                                               // AD: UPWARD_MOBILITY_JSON
        '',                                               // AE (reserved)
        '',                                               // AF
        '',                                               // AG
        '',                                               // AH
        '',                                               // AI
        '',                                               // AJ
        '',                                               // AK
        '',                                               // AL
        '',                                               // AM
        '',                                               // AN
        '',                                               // AO
        '',                                               // AP
        '',                                               // AQ
        '',                                               // AR
        '',                                               // AS
        '',                                               // AT
        '',                                               // AU
        '',                                               // AV
        '',                                               // AW
        '',                                               // AX
        '',                                               // AY
        '',                                               // AZ
        '',                                               // BA
        '',                                               // BB
        '',                                               // BC
        '',                                               // BD
        '',                                               // BE
        '',                                               // BF
        report.mia_proof_whatsapp || '',                  // BG: MIA_PROOF_WHATSAPP
        report.mia_proof_email || '',                     // BH: MIA_PROOF_EMAIL
        report.mia_proof_call || '',                      // BI: MIA_PROOF_CALL
        '',                                               // BJ: MIA_REQUEST_ID
        '',                                               // BK: MIA_REQUEST_STATUS
        report.kemaskini_maklumat?.alamat_baharu || '',   // BL: ALAMAT_BAHARU
        report.kemaskini_maklumat?.telefon_baharu || ''   // BM: TELEFON_BAHARU
    ];
}

backfillToSheets().catch(console.error);
