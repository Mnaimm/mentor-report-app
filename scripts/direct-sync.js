/**
 * DIRECT SYNC FROM JSON TO SUPABASE
 * Run: node scripts/direct-sync.js
 *
 * Simplified sync that directly imports JSON files to Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const results = {
  bangkit: { success: 0, failed: 0, errors: [] },
  maju: { success: 0, failed: 0, errors: [] }
};

// Helper: Get mentor ID by email
async function getMentorId(email) {
  if (!email) return null;

  const { data, error } = await supabase
    .from('mentors')
    .select('id')
    .eq('email', email.toLowerCase())
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(`   ⚠️  Mentor not found: ${email}`);
    return null;
  }

  return data.id;
}

// Helper: Get entrepreneur ID by name
async function getEntrepreneurId(name) {
  if (!name) return null;

  const { data, error } = await supabase
    .from('entrepreneurs')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(`   ⚠️  Entrepreneur not found: ${name}`);
    return null;
  }

  return data.id;
}

// Parse session number from "Sesi #1" format
function parseSessionNumber(sesiLaporan) {
  if (!sesiLaporan) return 1;
  const match = sesiLaporan.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
}

// Build mentoring findings JSONB
function buildMentoringFindings(row) {
  const findings = [];

  for (let i = 1; i <= 4; i++) {
    const fokusArea = row[`Fokus Area ${i}`];
    const keputusan = row[`Keputusan ${i}`];
    const tindakan = row[`Cadangan Tindakan ${i}`];

    if (fokusArea || keputusan || tindakan) {
      findings.push({
        'Fokus Area': fokusArea || '',
        'Keputusan': keputusan || '',
        'Cadangan Tindakan': tindakan || ''
      });
    }
  }

  return findings.length > 0 ? findings : null;
}

// Build jualan_terkini JSONB
function buildJualanTerkini(row) {
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
  const jualan = [];

  for (const month of months) {
    const value = row[`Jualan ${month}`];
    if (value !== undefined && value !== null && value !== '') {
      jualan.push({
        month: month,
        sales: parseFloat(value) || 0
      });
    }
  }

  return jualan.length > 0 ? jualan : null;
}

// Sync Bangkit reports
async function syncBangkit() {
  console.log('\n📝 Syncing Bangkit reports...');

  const dataPath = path.join(__dirname, '..', 'sync-data', 'bangkit.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`   Loaded ${data.length} reports from bangkit.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorEmail = row.Emai || row.Email || row.email;
      const entrepreneurName = row['Nama Usahawan'];
      const sessionNumber = parseSessionNumber(row['Sesi Laporan']);

      if (!entrepreneurName) {
        throw new Error('Missing entrepreneur name');
      }

      console.log(`   [${rowNum}/${data.length}] ${entrepreneurName} - Session ${sessionNumber}`);

      const mentorId = await getMentorId(mentorEmail);
      const entrepreneurId = await getEntrepreneurId(entrepreneurName);

      if (!mentorId || !entrepreneurId) {
        throw new Error('Missing mentor or entrepreneur ID');
      }

      // Check if report exists
      const { data: existingReport } = await supabase
        .from('reports')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('entrepreneur_id', entrepreneurId)
        .eq('session_number', sessionNumber)
        .eq('program', 'Bangkit')
        .limit(1)
        .maybeSingle();

      const reportData = {
        mentor_id: mentorId,
        entrepreneur_id: entrepreneurId,
        program: 'Bangkit',
        session_number: sessionNumber,
        session_date: row['Tarikh Sesi'] || null,
        nama_usahawan: entrepreneurName,
        nama_syarikat: row['Nama Bisnes'] || null,
        mentoring_findings: buildMentoringFindings(row),
        jualan_terkini: buildJualanTerkini(row),
        mia_status: row['Status Sesi'] || 'Selesai',
        source: 'google_sheets_sync'
      };

      if (existingReport) {
        const { error } = await supabase
          .from('reports')
          .update(reportData)
          .eq('id', existingReport.id);

        if (error) throw error;
        console.log(`      ✅ Updated`);
      } else {
        const { error } = await supabase
          .from('reports')
          .insert(reportData);

        if (error) throw error;
        console.log(`      ✅ Created`);
      }

      results.bangkit.success++;

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.bangkit.failed++;
      results.bangkit.errors.push({
        row: rowNum,
        entrepreneur: row['Nama Usahawan'],
        error: error.message
      });
      console.error(`      ❌ Error: ${error.message}`);
    }
  }
}

// Sync Maju reports
async function syncMaju() {
  console.log('\n📝 Syncing Maju reports...');

  const dataPath = path.join(__dirname, '..', 'sync-data', 'LaporanMajuUM.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`   Loaded ${data.length} reports from LaporanMajuUM.json\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      const mentorEmail = row.EMAIL_MENTOR;
      const entrepreneurName = row.NAMA_MENTEE;
      const sessionNumber = row.SESI_NUMBER || 1;

      if (!entrepreneurName) {
        throw new Error('Missing entrepreneur name');
      }

      console.log(`   [${rowNum}/${data.length}] ${entrepreneurName} - Session ${sessionNumber}`);

      const mentorId = await getMentorId(mentorEmail);
      const entrepreneurId = await getEntrepreneurId(entrepreneurName);

      if (!mentorId || !entrepreneurId) {
        throw new Error('Missing mentor or entrepreneur ID');
      }

      // Check if report exists
      const { data: existingReport } = await supabase
        .from('reports')
        .select('id')
        .eq('mentor_id', mentorId)
        .eq('entrepreneur_id', entrepreneurId)
        .eq('session_number', sessionNumber)
        .eq('program', 'Maju')
        .limit(1)
        .maybeSingle();

      const reportData = {
        mentor_id: mentorId,
        entrepreneur_id: entrepreneurId,
        program: 'Maju',
        session_number: sessionNumber,
        session_date: row.TARIKH_SESI || null,
        nama_usahawan: entrepreneurName,
        nama_syarikat: row.NAMA_BISNES || null,
        mia_status: row.MIA_STATUS || 'Selesai',
        source: 'google_sheets_sync'
      };

      if (existingReport) {
        const { error } = await supabase
          .from('reports')
          .update(reportData)
          .eq('id', existingReport.id);

        if (error) throw error;
        console.log(`      ✅ Updated`);
      } else {
        const { error } = await supabase
          .from('reports')
          .insert(reportData);

        if (error) throw error;
        console.log(`      ✅ Created`);
      }

      results.maju.success++;

      // Rate limiting
      if (rowNum % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      results.maju.failed++;
      results.maju.errors.push({
        row: rowNum,
        entrepreneur: row.NAMA_MENTEE,
        error: error.message
      });
      console.error(`      ❌ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 DIRECT SYNC: JSON → Supabase');
  console.log('='.repeat(70));

  try {
    await syncBangkit();
    await syncMaju();

    console.log('\n' + '='.repeat(70));
    console.log('📊 SYNC RESULTS:');
    console.log('='.repeat(70));
    console.log(`\nBangkit:`);
    console.log(`   ✅ Success: ${results.bangkit.success}`);
    console.log(`   ❌ Failed:  ${results.bangkit.failed}`);
    console.log(`\nMaju:`);
    console.log(`   ✅ Success: ${results.maju.success}`);
    console.log(`   ❌ Failed:  ${results.maju.failed}`);
    console.log(`\nTotal: ${results.bangkit.success + results.maju.success} synced`);

    if (results.bangkit.errors.length > 0 || results.maju.errors.length > 0) {
      console.log('\n⚠️  Some errors occurred. Check the output above for details.');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Sync complete!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
