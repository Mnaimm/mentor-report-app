/**
 * MIGRATE BANGKIT REPORTS FROM GOOGLE SHEETS TO SUPABASE
 * Run: node migration-scripts/migrate-bangkit-reports.js
 *
 * Migrates all Bangkit reports from v8 tab → Supabase reports table
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
async function findOrCreateEntrepreneur(name, program, businessName) {
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
async function migrateBangkitReports() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 MIGRATING BANGKIT REPORTS: v8 TAB → SUPABASE');
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

    // Fetch all data from v8 tab
    console.log('\n📥 Fetching data from v8 tab...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A:Z', // Get all columns
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log('❌ No data found in v8 tab');
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
        // Extract data from row (based on actual v8 column structure)
        const timestamp = row[getCol('Timestamp')];
        const mentorEmail = row[getCol('Emai')]; // Note: Column is "Emai" not "Email"
        const statusSesi = row[getCol('Status Sesi')];
        const sesiLaporan = row[getCol('Sesi Laporan')]; // "Sesi #1", "Sesi #2", etc.
        const tarikhSesi = parseDate(row[getCol('Tarikh Sesi')]);
        const masaSesi = row[getCol('Masa Sesi')];
        const modSesi = row[getCol('Mod Sesi')]; // "Face to Face", "Online", etc.
        const namaUsahawan = row[getCol('Nama Usahawan')];
        const namaBisnes = row[getCol('Nama Bisnes')];
        const namaMentor = row[getCol('Nama Mentor')];

        // Content fields
        const updateKeputusan1 = row[getCol('Update Keputusan Terdahulu 1')];
        const ringkasanSesi = row[getCol('Ringkasan Sesi')];

        // Focus areas 1-4
        const fokusArea1 = row[getCol('Fokus Area 1')];
        const keputusan1 = row[getCol('Keputusan 1')];
        const cadanganTindakan1 = row[getCol('Cadangan Tindakan 1')];

        const fokusArea2 = row[getCol('Fokus Area 2')];
        const keputusan2 = row[getCol('Keputusan 2')];
        const cadanganTindakan2 = row[getCol('Cadangan Tindakan 2')];

        const fokusArea3 = row[getCol('Fokus Area 3')];
        const keputusan3 = row[getCol('Keputusan 3')];
        const cadanganTindakan3 = row[getCol('Cadangan Tindakan 3')];

        const fokusArea4 = row[getCol('Fokus Area 4')];
        const keputusan4 = row[getCol('Keputusan 4')];
        const cadanganTindakan4 = row[getCol('Cadangan Tindakan 4')];

        // Sales data (Jualan Jan, Jualan Feb, etc.)
        const jualanJan = row[getCol('Jualan Jan')];
        const jualanFeb = row[getCol('Jualan Feb')];

        // Parse session number from "Sesi #1" format
        const sessionNumberMatch = sesiLaporan?.match(/#(\d+)/);
        const sessionNumber = sessionNumberMatch ? parseInt(sessionNumberMatch[1]) : 1;

        // Build initiatives array from focus areas
        const inisiatif = [];
        if (fokusArea1) {
          inisiatif.push({
            fokusArea: fokusArea1,
            keputusan: keputusan1 || '',
            cadanganTindakan: cadanganTindakan1 || ''
          });
        }
        if (fokusArea2) {
          inisiatif.push({
            fokusArea: fokusArea2,
            keputusan: keputusan2 || '',
            cadanganTindakan: cadanganTindakan2 || ''
          });
        }
        if (fokusArea3) {
          inisiatif.push({
            fokusArea: fokusArea3,
            keputusan: keputusan3 || '',
            cadanganTindakan: cadanganTindakan3 || ''
          });
        }
        if (fokusArea4) {
          inisiatif.push({
            fokusArea: fokusArea4,
            keputusan: keputusan4 || '',
            cadanganTindakan: cadanganTindakan4 || ''
          });
        }

        // Build sales data array
        const jualanTerkini = [];
        if (jualanJan) jualanTerkini.push({ bulan: 'Januari', jumlah: parseFloat(jualanJan) || 0 });
        if (jualanFeb) jualanTerkini.push({ bulan: 'Februari', jumlah: parseFloat(jualanFeb) || 0 });

        // MIA status
        const miaStatus = statusSesi === 'MIA' ? 'MIA' : 'Tidak MIA';

        // Validation
        if (!mentorEmail || !namaUsahawan) {
          console.log(`   ⚠️  Skipping row ${rowNum}: Missing mentor email or entrepreneur name`);
          errorCount++;
          errors.push({ row: rowNum, error: 'Missing required fields' });
          continue;
        }

        console.log(`   📋 ${namaUsahawan} - ${sesiLaporan}`);
        console.log(`   👤 Mentor: ${namaMentor} (${mentorEmail})`);

        // Step 1: Find/Create Entrepreneur
        const entResult = await findOrCreateEntrepreneur(namaUsahawan, 'Bangkit', namaBisnes);
        if (!entResult.success) {
          console.log(`   ❌ Failed: ${entResult.error}`);
          errorCount++;
          errors.push({ row: rowNum, error: entResult.error });
          continue;
        }

        const entrepreneurId = entResult.data.id;

        // Step 2: Find Mentor
        const mentorResult = await findMentorByEmail(mentorEmail);
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
          'Bangkit',
          sessionNumber,
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
        const duplicateCheck = await checkIfReportExists(sessionId, rowNum, 'Bangkit');
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
          program: 'Bangkit',

          // Basic info
          mentor_email: mentorEmail,
          nama_mentor: namaMentor,
          nama_usahawan: namaUsahawan,
          nama_syarikat: namaBisnes,

          // Session details
          session_date: tarikhSesi,
          session_number: sessionNumber,
          mod_sesi: modSesi,

          // Content (adapted from v8 structure)
          kemaskini_inisiatif: updateKeputusan1 || '',
          rumusan: ringkasanSesi || '',
          inisiatif: inisiatif,
          jualan_terkini: jualanTerkini,
          pemerhatian: '', // Not in v8 tab
          refleksi: {}, // Not in v8 tab
          gw_skor: [], // Not in v8 tab

          // Additional info
          produk_servis: '', // Not in v8 tab
          pautan_media_sosial: '', // Not in v8 tab
          premis_dilawat: false, // Not in v8 tab

          // Images (not in v8 tab)
          image_urls: {
            sesi: [],
            premis: [],
            growthwheel: '',
            mia: '',
            profil: ''
          },

          // MIA
          mia_status: miaStatus,

          // Google Drive (not in v8 tab)
          doc_url: null,

          // Tracking
          source: 'migration_v8',
          sheets_row_number: rowNum,
          submission_date: timestamp || new Date().toISOString(),
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
    console.log('✅ BANGKIT MIGRATION COMPLETE!');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrateBangkitReports();
