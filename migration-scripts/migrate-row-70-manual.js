/**
 * MANUALLY MIGRATE BANGKIT ROW 70
 * Handles the duplicate entrepreneur issue
 */

require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const SHEET_ID = process.env.GOOGLE_SHEETS_MAJU_REPORT_ID?.replace(/"/g, '') ||
                 process.env.GOOGLE_SHEETS_REPORT_ID?.replace(/"/g, '') ||
                 process.env.SHEET_ID;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrateRow70() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 MANUALLY MIGRATING BANGKIT ROW 70');
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

    // Fetch Row 70 from v8 tab
    console.log('\n📥 Fetching Row 70 from v8 tab...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'v8!A1:Z70',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const row70 = rows[69]; // Row 70 = index 69 (0-based, row 1 = index 0)

    const getCol = (name) => headers.indexOf(name);

    // Extract data
    const mentorEmail = row70[getCol('Emai')];
    const namaUsahawan = row70[getCol('Nama Usahawan')];
    const namaBisnes = row70[getCol('Nama Bisnes')];
    const namaMentor = row70[getCol('Nama Mentor')];
    const sesiLaporan = row70[getCol('Sesi Laporan')];
    const tarikhSesi = row70[getCol('Tarikh Sesi')];
    const sessionNumberMatch = sesiLaporan?.match(/#(\d+)/);
    const sessionNumber = sessionNumberMatch ? parseInt(sessionNumberMatch[1]) : 1;

    console.log(`\n📋 Row 70 Data:`);
    console.log(`   Entrepreneur: ${namaUsahawan}`);
    console.log(`   Business: ${namaBisnes}`);
    console.log(`   Mentor: ${namaMentor} (${mentorEmail})`);
    console.log(`   Session: #${sessionNumber}`);
    console.log(`   Date: ${tarikhSesi}`);

    // Step 1: Handle duplicate entrepreneur - use the FIRST one
    console.log('\n1️⃣ Finding entrepreneur (using first match for duplicates)...');
    const { data: entrepreneurs } = await supabase
      .from('entrepreneurs')
      .select('*')
      .eq('name', namaUsahawan)
      .eq('program', 'Bangkit')
      .limit(1);

    let entrepreneurId;
    if (entrepreneurs && entrepreneurs.length > 0) {
      entrepreneurId = entrepreneurs[0].id;
      console.log(`   ✅ Using existing entrepreneur ID: ${entrepreneurId}`);
    } else {
      // Create new if not found
      const { data: newEnt } = await supabase
        .from('entrepreneurs')
        .insert({
          name: namaUsahawan,
          business_name: namaBisnes,
          program: 'Bangkit',
          status: 'active'
        })
        .select()
        .single();
      entrepreneurId = newEnt.id;
      console.log(`   ✅ Created new entrepreneur ID: ${entrepreneurId}`);
    }

    // Step 2: Find mentor
    console.log('\n2️⃣ Finding mentor...');
    const { data: mentor } = await supabase
      .from('mentors')
      .select('*')
      .eq('email', mentorEmail)
      .single();

    if (!mentor) {
      console.log('   ❌ Mentor not found!');
      return;
    }
    console.log(`   ✅ Found mentor ID: ${mentor.id} (${mentor.name})`);

    // Step 3: Create session
    console.log('\n3️⃣ Creating session...');
    const sessionDate = tarikhSesi ? new Date(tarikhSesi).toISOString().split('T')[0] : null;

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        mentor_id: mentor.id,
        entrepreneur_id: entrepreneurId,
        program: 'Bangkit',
        session_number: sessionNumber,
        session_date: sessionDate,
        status: 'completed'
      })
      .select()
      .single();

    if (sessionError) {
      console.log(`   ❌ Session creation failed: ${sessionError.message}`);
      return;
    }
    console.log(`   ✅ Created session ID: ${session.id}`);

    // Step 4: Create report (simplified payload for Row 70)
    console.log('\n4️⃣ Creating report...');
    const reportPayload = {
      session_id: session.id,
      mentor_id: mentor.id,
      entrepreneur_id: entrepreneurId,
      program: 'Bangkit',
      mentor_email: mentorEmail,
      nama_mentor: namaMentor,
      nama_usahawan: namaUsahawan,
      nama_syarikat: namaBisnes,
      session_date: sessionDate,
      session_number: sessionNumber,
      inisiatif: [],
      jualan_terkini: [],
      gw_skor: [],
      image_urls: { sesi: [], premis: [], growthwheel: '', mia: '', profil: '' },
      mia_status: 'Tidak MIA',
      source: 'migration_v8',
      sheets_row_number: 70,
      submission_date: new Date().toISOString(),
      status: 'submitted'
    };

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert(reportPayload)
      .select()
      .single();

    if (reportError) {
      console.log(`   ❌ Report creation failed: ${reportError.message}`);
      return;
    }

    console.log(`   ✅ SUCCESS! Report ID: ${report.id}`);

    console.log('\n' + '═'.repeat(70));
    console.log('✅ ROW 70 MIGRATION COMPLETE!');
    console.log('═'.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error);
  }
}

migrateRow70();
