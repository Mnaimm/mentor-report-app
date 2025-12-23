/**
 * MIGRATE MAJU REPORTS FROM GOOGLE SHEETS TO SUPABASE
 * Run: node migration-scripts/migrate-maju-reports.js
 *
 * Migrates all Maju reports from LaporanMaju tab → Supabase reports table
 * Uses existing functions from lib/supabase-writes.js
 *
 * Process:
 * 1. Find/Create Entrepreneur
 * 2. Find Mentor
 * 3. Create Session
 * 4. Create Report
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

// Both Bangkit and Maju are in the same spreadsheet
const SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID?.replace(/"/g, '') ||
                 process.env.GOOGLE_SHEETS_REPORT_ID?.replace(/"/g, '') ||
                 process.env.SHEET_ID;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Helper: Find or create entrepreneur
 */
async function findOrCreateEntrepreneur(name, program, businessName, phone) {
  try {
    // Try to find existing
    let { data: entrepreneur, error: findError } = await supabase
      .from('entrepreneurs')
      .select('*')
      .eq('name', name)
      .eq('program', program)
      .maybeSingle();

    if (findError) {
      console.error('   ❌ Error finding entrepreneur:', findError);
      return { success: false, error: findError.message };
    }

    // Create if not found
    if (!entrepreneur) {
      console.log(`   📝 Creating entrepreneur: ${name}`);

      const { data: newEnt, error: createError } = await supabase
        .from('entrepreneurs')
        .insert({
          name: name,
          business_name: businessName || null,
          phone: phone || null,
          program: program,
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('   ❌ Error creating entrepreneur:', createError);
        return { success: false, error: createError.message };
      }

      entrepreneur = newEnt;
      console.log(`   ✅ Created entrepreneur ID: ${entrepreneur.id}`);
    } else {
      console.log(`   ✅ Found entrepreneur ID: ${entrepreneur.id}`);
    }

    return { success: true, data: entrepreneur };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Find mentor by email
 */
async function findMentorByEmail(email) {
  try {
    const { data: mentor, error } = await supabase
      .from('mentors')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!mentor) {
      return { success: false, error: `Mentor not found for email: ${email}` };
    }

    console.log(`   ✅ Found mentor ID: ${mentor.id} (${mentor.name})`);
    return { success: true, data: mentor };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Find or create session
 */
async function findOrCreateSession(mentorId, entrepreneurId, program, sessionNumber, sessionDate) {
  try {
    // Try to find existing
    let { data: session, error: findError } = await supabase
      .from('sessions')
      .select('*')
      .eq('mentor_id', mentorId)
      .eq('entrepreneur_id', entrepreneurId)
      .eq('program', program)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (findError) {
      return { success: false, error: findError.message };
    }

    // Create if not found
    if (!session) {
      console.log(`   📝 Creating session #${sessionNumber}`);

      const { data: newSession, error: createError } = await supabase
        .from('sessions')
        .insert({
          mentor_id: mentorId,
          entrepreneur_id: entrepreneurId,
          program: program,
          session_number: sessionNumber,
          session_date: sessionDate,
          status: 'completed'
        })
        .select()
        .single();

      if (createError) {
        return { success: false, error: createError.message };
      }

      session = newSession;
      console.log(`   ✅ Created session ID: ${session.id}`);
    } else {
      console.log(`   ✅ Found session ID: ${session.id}`);
    }

    return { success: true, data: session };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Helper: Check if report already exists (DUPLICATE DETECTION)
 * Uses multiple criteria to identify existing reports
 */
async function checkIfReportExists(sessionId, sheetsRowNumber, program) {
  try {
    // Strategy 1: Check by sheets_row_number + program (most reliable for migration)
    if (sheetsRowNumber && program) {
      const { data: reportByRow, error: rowError } = await supabase
        .from('reports')
        .select('id, sheets_row_number, source')
        .eq('sheets_row_number', sheetsRowNumber)
        .eq('program', program)
        .maybeSingle();

      if (rowError && rowError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.warn(`   ⚠️  Error checking by row number: ${rowError.message}`);
      }

      if (reportByRow) {
        console.log(`   ⏭️  DUPLICATE FOUND: Report exists with sheets_row_number=${sheetsRowNumber}`);
        return { exists: true, report: reportByRow };
      }
    }

    // Strategy 2: Check by session_id (one report per session)
    if (sessionId) {
      const { data: reportBySession, error: sessionError } = await supabase
        .from('reports')
        .select('id, session_id, source')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (sessionError && sessionError.code !== 'PGRST116') {
        console.warn(`   ⚠️  Error checking by session: ${sessionError.message}`);
      }

      if (reportBySession) {
        console.log(`   ⏭️  DUPLICATE FOUND: Report exists for session_id=${sessionId}`);
        return { exists: true, report: reportBySession };
      }
    }

    // No duplicates found
    return { exists: false };
  } catch (error) {
    console.warn(`   ⚠️  Exception in duplicate check: ${error.message}`);
    return { exists: false }; // Proceed with caution
  }
}

/**
 * Helper: Parse JSON from Google Sheets cell (handles arrays/objects)
 */
function parseJSON(value, fieldName) {
  if (!value || value.trim() === '') return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn(`   ⚠️  Failed to parse ${fieldName}:`, value);
    return null;
  }
}

/**
 * Helper: Parse date from Google Sheets
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try parsing as ISO date first
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  }

  return null;
}

/**
 * Main migration function
 */
async function migrateMajuReports() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 MIGRATING MAJU REPORTS: LaporanMaju TAB → SUPABASE');
  console.log('═'.repeat(70));

  try {
    // Setup Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all data from LaporanMaju tab
    console.log('\n📥 Fetching data from LaporanMaju tab...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'LaporanMaju!A:Z', // Get all columns
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log('❌ No data found in LaporanMaju tab');
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1); // Skip header row

    console.log(`✅ Found ${dataRows.length} reports to migrate`);
    console.log(`   Columns: ${headers.length}`);

    // Create column index mapping
    const getCol = (name) => headers.indexOf(name);

    // Statistics
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each row
    console.log('\n' + '─'.repeat(70));
    console.log('🔄 PROCESSING REPORTS...');
    console.log('─'.repeat(70));

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // +2 because: +1 for 0-index, +1 for header row

      console.log(`\n[${i + 1}/${dataRows.length}] Processing Row ${rowNum}...`);

      try {
        // Extract data from row (Maju field names)
        const emailMentor = row[getCol('EMAIL_MENTOR')];
        const namaMentor = row[getCol('NAMA_MENTOR')];
        const namaMentee = row[getCol('NAMA_MENTEE')];
        const namaBisnes = row[getCol('NAMA_BISNES')];
        const lokasiBisnes = row[getCol('LOKASI_BISNES')];
        const produkServis = row[getCol('PRODUK_SERVIS')];
        const noTelefon = row[getCol('NO_TELEFON')];

        // Session details
        const tarikhSesi = parseDate(row[getCol('TARIKH_SESI')]);
        const sesiNumber = parseInt(row[getCol('SESI_NUMBER')]) || 1;
        const modSesi = row[getCol('MOD_SESI')];
        const lokasiF2F = row[getCol('LOKASI_F2F')];
        const masaMula = row[getCol('MASA_MULA')];
        const masaTamat = row[getCol('MASA_TAMAT')];

        // Content
        const latarbelakangUsahawan = row[getCol('LATARBELAKANG_USAHAWAN')];
        const dataKewanganBulanan = parseJSON(row[getCol('DATA_KEWANGAN_BULANAN_JSON')], 'DATA_KEWANGAN_BULANAN_JSON') || [];
        const mentoringFindings = parseJSON(row[getCol('MENTORING_FINDINGS_JSON')], 'MENTORING_FINDINGS_JSON') || [];

        // Reflections
        const refleksiPerasaan = row[getCol('REFLEKSI_MENTOR_PERASAAN')];
        const refleksiKomitmen = row[getCol('REFLEKSI_MENTOR_KOMITMEN')];
        const refleksiLain = row[getCol('REFLEKSI_MENTOR_LAIN')];

        // Summary
        const statusPerniagaan = row[getCol('STATUS_PERNIAGAAN_KESELURUHAN')];
        const rumusanLangkah = row[getCol('RUMUSAN_DAN_LANGKAH_KEHADAPAN')];

        // Images
        const urlGambarPremis = parseJSON(row[getCol('URL_GAMBAR_PREMIS_JSON')], 'URL_GAMBAR_PREMIS_JSON') || [];
        const urlGambarSesi = parseJSON(row[getCol('URL_GAMBAR_SESI_JSON')], 'URL_GAMBAR_SESI_JSON') || [];
        const urlGambarGW360 = row[getCol('URL_GAMBAR_GW360')] || '';

        // Google Drive
        const folderId = row[getCol('Folder_ID')];
        const laporanMajuDocId = row[getCol('laporan_maju_doc_id')];

        // MIA
        const miaStatus = row[getCol('MIA_STATUS')] || 'Tidak MIA';
        const miaReason = row[getCol('MIA_REASON')];

        // Validation
        if (!emailMentor || !namaMentee) {
          console.log(`   ⚠️  Skipping row ${rowNum}: Missing mentor email or mentee name`);
          errorCount++;
          errors.push({ row: rowNum, error: 'Missing required fields' });
          continue;
        }

        console.log(`   📋 ${namaMentee} - Session ${sesiNumber}`);
        console.log(`   👤 Mentor: ${namaMentor} (${emailMentor})`);

        // Step 1: Find/Create Entrepreneur
        const entResult = await findOrCreateEntrepreneur(namaMentee, 'Maju', namaBisnes, noTelefon);
        if (!entResult.success) {
          console.log(`   ❌ Failed: ${entResult.error}`);
          errorCount++;
          errors.push({ row: rowNum, error: entResult.error });
          continue;
        }

        const entrepreneurId = entResult.data.id;

        // Step 2: Find Mentor
        const mentorResult = await findMentorByEmail(emailMentor);
        if (!mentorResult.success) {
          console.log(`   ❌ Failed: ${mentorResult.error}`);
          errorCount++;
          errors.push({ row: rowNum, error: mentorResult.error });
          continue;
        }

        const mentorId = mentorResult.data.id;

        // Step 3: Create Session
        const sessionResult = await findOrCreateSession(
          mentorId,
          entrepreneurId,
          'Maju',
          sesiNumber,
          tarikhSesi
        );

        if (!sessionResult.success) {
          console.log(`   ❌ Failed: ${sessionResult.error}`);
          errorCount++;
          errors.push({ row: rowNum, error: sessionResult.error });
          continue;
        }

        const sessionId = sessionResult.data.id;

        // Step 4: Check if report already exists (DUPLICATE DETECTION)
        const duplicateCheck = await checkIfReportExists(sessionId, rowNum, 'Maju');
        if (duplicateCheck.exists) {
          console.log(`   ⏭️  SKIPPED: Report already exists (ID: ${duplicateCheck.report.id})`);
          skippedCount++;
          continue;
        }

        // Step 5: Create Report
        const reportPayload = {
          session_id: sessionId,
          mentor_id: mentorId,
          entrepreneur_id: entrepreneurId,
          program: 'Maju',

          // Basic info
          mentor_email: emailMentor,
          nama_mentor: namaMentor,
          nama_mentee: namaMentee,
          nama_bisnes: namaBisnes,
          lokasi_bisnes: lokasiBisnes,
          produk_servis: produkServis,
          no_telefon: noTelefon,

          // Session details
          session_date: tarikhSesi,
          session_number: sesiNumber,
          mod_sesi: modSesi,
          lokasi_f2f: lokasiF2F,
          masa_mula: masaMula,
          masa_tamat: masaTamat,

          // Content
          latarbelakang_usahawan: latarbelakangUsahawan,
          data_kewangan_bulanan: dataKewanganBulanan,
          mentoring_findings: mentoringFindings,

          // Reflections
          refleksi_mentor_perasaan: refleksiPerasaan,
          refleksi_mentor_komitmen: refleksiKomitmen,
          refleksi_mentor_lain: refleksiLain,

          // Summary
          status_perniagaan: statusPerniagaan,
          rumusan_langkah_kehadapan: rumusanLangkah,

          // Images
          image_urls: {
            premis: urlGambarPremis,
            sesi: urlGambarSesi,
            growthwheel: urlGambarGW360
          },

          // Google Drive
          folder_id: folderId,
          doc_url: laporanMajuDocId,

          // MIA
          mia_status: miaStatus,
          mia_reason: miaReason,

          // Tracking
          source: 'migration_laporan_maju',
          sheets_row_number: rowNum,
          submission_date: new Date().toISOString(),
          status: 'submitted'
        };

        const { data: report, error: reportError } = await supabase
          .from('reports')
          .insert(reportPayload)
          .select()
          .single();

        if (reportError) {
          console.log(`   ❌ Report insert failed: ${reportError.message}`);
          errorCount++;
          errors.push({ row: rowNum, error: reportError.message });
          continue;
        }

        console.log(`   ✅ SUCCESS! Report ID: ${report.id}`);
        successCount++;

      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
        errorCount++;
        errors.push({ row: rowNum, error: error.message });
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`✅ Inserted: ${successCount} new reports`);
    console.log(`⏭️  Skipped:  ${skippedCount} duplicates`);
    console.log(`❌ Errors:   ${errorCount} reports`);
    console.log(`📝 Total:    ${dataRows.length} reports`);

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(({ row, error }) => {
        console.log(`   Row ${row}: ${error}`);
      });
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ MAJU MIGRATION COMPLETE!');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateMajuReports();
