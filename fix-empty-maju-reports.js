/**
 * Fix empty Maju Session 2 records by updating them with content from Google Sheets
 * Preserves UUID and source field, only fills in missing content
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.env.DRY_RUN !== 'false'; // Set DRY_RUN=false to actually update

// Helper: Safe JSON parse
function safeJSONParse(jsonString, defaultValue = null) {
    if (!jsonString) return defaultValue;
    if (typeof jsonString === 'object') return jsonString; // Already parsed

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn(`   ⚠️  JSON parse error:`, error.message);
        return defaultValue;
    }
}

// Helper: Format time string
function formatTime(val) {
    if (!val) return null;
    if (typeof val === 'string' && val.includes('T')) {
        const timePart = val.split('T')[1];
        if (timePart) {
            return timePart.split('.')[0];
        }
    }
    return val;
}

async function getGoogleSheetsData() {
    console.log('📊 Fetching data from Google Sheets...');

    const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('ascii');
    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID || process.env.GOOGLE_SHEETS_REPORT_ID;

    if (!spreadsheetId) {
        throw new Error('Missing GOOGLE_SHEETS_MAJU_REPORT_ID');
    }

    // Fetch all data from LaporanMaju sheet
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'LaporanMaju!A2:BM', // Skip header row
    });

    const rows = response.data.values || [];
    console.log(`   ✅ Fetched ${rows.length} rows from Google Sheets\n`);

    // Map rows to structured data
    const sheetsData = rows.map((row, idx) => ({
        rowNumber: idx + 2,
        timestamp: row[0] || null,
        mentorName: row[1] || null,
        mentorEmail: row[2] || null,
        menteeName: row[3] || null,
        namaBisnes: row[4] || null,
        lokasiBisnes: row[5] || null,
        produkServis: row[6] || null,
        noTelefon: row[7] || null,
        tarikhSesi: row[8] || null,
        sesiNumber: row[9] || null,
        modSesi: row[10] || null,
        lokasiF2F: row[11] || null,
        masaMula: row[12] || null,
        masaTamat: row[13] || null,
        latarbelakangUsahawan: row[14] || null,
        dataKewanganBulananJSON: row[15] || null,
        mentoringFindingsJSON: row[16] || null,
        refleksiMentorPerasaan: row[17] || null,
        refleksiMentorKomitmen: row[18] || null,
        refleksiMentorLain: row[19] || null,
        statusPerniagaanKeseluruhan: row[20] || null,
        rumusanDanLangkahKehadapan: row[21] || null,
        urlGambarPremisJSON: row[22] || null,
        urlGambarSesiJSON: row[23] || null,
        urlGambarGW360: row[24] || null,
        folderId: row[25] || null,
        laporanMajuDocId: row[26] || null,
        miaStatus: row[27] || null,
        miaReason: row[28] || null,
    }));

    return sheetsData;
}

async function fixEmptyReports() {
    console.log('🔧 Fix Empty Maju Session 2 Reports');
    console.log('='.repeat(80));
    console.log(`DRY_RUN: ${DRY_RUN} (set DRY_RUN=false to apply changes)\n`);

    // Step 1: Find empty reports
    console.log('📊 Step 1: Finding empty Maju Session 2 reports...');
    const { data: emptyReports, error: fetchError } = await supabase
        .from('reports')
        .select('*')
        .eq('program', 'Maju')
        .eq('session_number', 2)
        .eq('source', 'manual_sync_missing_records');

    if (fetchError) throw fetchError;

    console.log(`   ✅ Found ${emptyReports.length} records with source='manual_sync_missing_records'\n`);

    // Step 2: Fetch Google Sheets data
    const sheetsData = await getGoogleSheetsData();

    // Step 3: Match and update each record
    console.log('🔄 Step 3: Matching and updating records...\n');

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const report of emptyReports) {
        try {
            console.log(`\n[${report.id}] Processing...`);
            console.log(`   Current data:`);
            console.log(`   - nama_usahawan: ${report.nama_usahawan || 'NULL'}`);
            console.log(`   - mentor_email: ${report.mentor_email || 'NULL'}`);
            console.log(`   - entrepreneur_id: ${report.entrepreneur_id}`);
            console.log(`   - session_number: ${report.session_number}`);

            // Get entrepreneur name from entrepreneurs table
            let entrepreneurName = null;
            if (report.entrepreneur_id) {
                const { data: entrepreneur, error: entError } = await supabase
                    .from('entrepreneurs')
                    .select('name')
                    .eq('id', report.entrepreneur_id)
                    .single();

                if (!entError && entrepreneur) {
                    entrepreneurName = entrepreneur.name;
                    console.log(`   - entrepreneur name: ${entrepreneurName}`);
                }
            }

            if (!entrepreneurName) {
                throw new Error('Cannot resolve entrepreneur name from entrepreneur_id');
            }

            // Find matching row in Google Sheets
            const matchingRow = sheetsData.find(row => {
                const emailMatch = row.mentorEmail?.toLowerCase() === report.mentor_email?.toLowerCase();
                const nameMatch = row.menteeName?.toLowerCase() === entrepreneurName?.toLowerCase();
                const sessionMatch = parseInt(row.sesiNumber) === parseInt(report.session_number);

                return emailMatch && nameMatch && sessionMatch;
            });

            if (!matchingRow) {
                throw new Error(`No matching row found in Google Sheets for ${entrepreneurName}`);
            }

            console.log(`   ✅ Found matching Sheet row #${matchingRow.rowNumber}`);

            // Parse JSON fields
            const dataKewangan = safeJSONParse(matchingRow.dataKewanganBulananJSON, []);
            const mentoringFindings = safeJSONParse(matchingRow.mentoringFindingsJSON, []);
            const imageUrlsSesi = safeJSONParse(matchingRow.urlGambarSesiJSON, []);
            const imageUrlsPremis = safeJSONParse(matchingRow.urlGambarPremisJSON, []);

            // Build update payload with ALL content fields
            const updatePayload = {
                // Basic info (fill if missing)
                nama_usahawan: matchingRow.menteeName,
                nama_mentee: matchingRow.menteeName,
                nama_mentor: matchingRow.mentorName,
                nama_syarikat: matchingRow.namaBisnes,
                nama_bisnes: matchingRow.namaBisnes,
                lokasi_bisnes: matchingRow.lokasiBisnes,
                produk_servis: matchingRow.produkServis,
                no_telefon: matchingRow.noTelefon,

                // Session details
                session_date: matchingRow.tarikhSesi,
                mod_sesi: matchingRow.modSesi,
                lokasi_f2f: matchingRow.lokasiF2F,
                masa_mula: formatTime(matchingRow.masaMula),
                masa_tamat: formatTime(matchingRow.masaTamat),

                // Content fields (main issue)
                latarbelakang_usahawan: matchingRow.latarbelakangUsahawan,
                data_kewangan_bulanan: dataKewangan,
                mentoring_findings: mentoringFindings,
                rumusan: matchingRow.rumusanDanLangkahKehadapan,

                // Reflection
                refleksi: {
                    perasaan: matchingRow.refleksiMentorPerasaan || null,
                    komitmen: matchingRow.refleksiMentorKomitmen || null,
                    lain: matchingRow.refleksiMentorLain || null
                },

                // Images (main issue)
                image_urls: {
                    sesi: imageUrlsSesi,
                    premis: imageUrlsPremis,
                    gw360: matchingRow.urlGambarGW360 || null
                },

                // MIA status
                mia_status: matchingRow.miaStatus || 'Selesai',
                mia_reason: matchingRow.miaReason || null,

                // Folder & Document
                folder_id: matchingRow.folderId,
                doc_url: matchingRow.laporanMajuDocId,

                // Keep existing fields intact
                // - id (UUID)
                // - source ('manual_sync_missing_records')
                // - created_at
                // - mentor_id
                // - entrepreneur_id
            };

            console.log(`   📝 Update summary:`);
            console.log(`      - nama_usahawan: ${updatePayload.nama_usahawan}`);
            console.log(`      - image_urls.sesi: ${imageUrlsSesi.length} images`);
            console.log(`      - mentoring_findings: ${mentoringFindings.length} items`);
            console.log(`      - data_kewangan_bulanan: ${dataKewangan.length} months`);

            if (!DRY_RUN) {
                const { error: updateError } = await supabase
                    .from('reports')
                    .update(updatePayload)
                    .eq('id', report.id);

                if (updateError) throw updateError;

                console.log(`   ✅ Updated successfully`);
                updated++;
            } else {
                console.log(`   🔍 [DRY RUN] Would update this record`);
                updated++;
            }

        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
            errors.push({
                id: report.id,
                entrepreneur_id: report.entrepreneur_id,
                error: error.message
            });
            skipped++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully updated: ${updated} records`);
    console.log(`❌ Failed: ${skipped} records`);

    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(err => {
            console.log(`   - ${err.id}: ${err.error}`);
        });
    }

    console.log('\n' + '='.repeat(80));

    // Step 4: Verify updates
    if (!DRY_RUN && updated > 0) {
        console.log('\n🔍 Step 4: Verifying updates...\n');

        const { data: verifiedReports, error: verifyError } = await supabase
            .from('reports')
            .select('id, nama_usahawan, image_urls, mentoring_findings, data_kewangan_bulanan')
            .eq('program', 'Maju')
            .eq('session_number', 2)
            .eq('source', 'manual_sync_missing_records');

        if (verifyError) throw verifyError;

        verifiedReports.forEach((report, idx) => {
            const hasSesiImages = report.image_urls?.sesi?.length > 0;
            const hasMentoringFindings = Array.isArray(report.mentoring_findings) && report.mentoring_findings.length > 0;

            console.log(`[${idx + 1}] ${hasSesiImages && hasMentoringFindings ? '✅' : '❌'} ${report.id}`);
            console.log(`    nama_usahawan: ${report.nama_usahawan || 'NULL'}`);
            console.log(`    image_urls.sesi: ${report.image_urls?.sesi?.length || 0} images`);
            console.log(`    mentoring_findings: ${report.mentoring_findings?.length || 0} items`);
            console.log(`    data_kewangan: ${report.data_kewangan_bulanan?.length || 0} months`);
        });

        console.log('\n✅ Verification complete!\n');
    }
}

fixEmptyReports().catch(console.error);
