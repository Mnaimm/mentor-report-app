import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccessAdmin } from '../../../lib/auth';
import { createAdminClient } from '../../../lib/supabaseAdmin';
import { Resend } from 'resend';

const TEST_EMAIL = 'naemmukhtar@gmail.com';

const MALAY_MONTHS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function buildReminderEmail(mentorName, rows, originalEmail = null) {
  const testBanner = originalEmail
    ? `<div style="background-color:#fffbeb;border:2px dashed #f59e0b;padding:12px 20px;margin-bottom:24px;border-radius:8px;font-size:13px;color:#92400e;font-weight:700;">
        ** INI EMEL UJIAN — asal penerima: ${originalEmail} **
      </div>`
    : '';

  const tableRows = rows.map(({ entName, entBatch, roundNumber, endDate, formUrl }) => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 16px;font-size:14px;color:#1a202c;">${entName}</td>
      <td style="padding:12px 16px;font-size:14px;color:#4a5568;">${entBatch}</td>
      <td style="padding:12px 16px;font-size:14px;color:#4a5568;text-align:center;">Pusingan ${roundNumber}</td>
      <td style="padding:12px 16px;font-size:14px;color:#e53e3e;text-align:center;">${endDate}</td>
      <td style="padding:12px 16px;text-align:center;">
        <a href="${formUrl}" style="display:inline-block;padding:8px 16px;background-color:#2b6cb0;color:#ffffff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
          Hantar Laporan Sekarang
        </a>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f7fafc;margin:0;padding:0;">
  <div style="max-width:640px;margin:40px auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
    <div style="background-color:#1a365d;padding:32px 40px;">
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">iTEKAD Mentor Portal</h1>
      <p style="color:#bee3f8;font-size:14px;margin:6px 0 0;">Peringatan Laporan Mentoring</p>
    </div>
    <div style="padding:40px;">
      ${testBanner}
      <p style="font-size:16px;color:#2d3748;margin:0 0 8px;">Assalamualaikum ${mentorName},</p>
      <p style="font-size:15px;color:#4a5568;margin:0 0 24px;">Berikut adalah senarai usahawan yang laporan pusingan semasa belum dihantar:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background-color:#edf2f7;">
            <th style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a5568;text-align:left;">Nama Usahawan</th>
            <th style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a5568;text-align:left;">Batch</th>
            <th style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a5568;text-align:center;">Pusingan</th>
            <th style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a5568;text-align:center;">Hantar Sebelum</th>
            <th style="padding:12px 16px;font-size:13px;font-weight:600;color:#4a5568;text-align:center;">Tindakan</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p style="font-size:14px;color:#718096;margin:24px 0 0;">
        Sila hantar laporan tersebut sebelum tarikh akhir untuk mengelakkan kelewatan pembayaran.
      </p>
    </div>
    <div style="background-color:#f7fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
      <p style="font-size:13px;color:#718096;margin:0;">Terima kasih atas komitmen anda. — Pasukan iTEKAD</p>
      <p style="font-size:12px;color:#a0aec0;margin:6px 0 0;">Ini adalah emel automatik. Sila jangan balas emel ini.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Shared: build pending-mentor data from DB ─────────────────────────────────
async function buildPendingData(supabase) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Active batch_rounds
  const { data: allRounds, error: roundsError } = await supabase
    .from('batch_rounds')
    .select('id, batch_id, batch_name, round_number, start_date, end_date, start_month, end_month')
    .not('batch_name', 'is', null);

  if (roundsError) throw roundsError;

  const activeRounds = (allRounds || []).filter(br => {
    const start = new Date(br.start_date || br.start_month); start.setHours(0, 0, 0, 0);
    const end   = new Date(br.end_date   || br.end_month);   end.setHours(23, 59, 59, 999);
    return today >= start && today <= end;
  });

  if (activeRounds.length === 0) return { empty: true, message: 'Tiada pusingan aktif hari ini.' };

  // 2. Resolve batch IDs
  const directBatchIds     = new Set(activeRounds.map(r => r.batch_id).filter(Boolean));
  const activeRoundBatchNames = new Set(activeRounds.map(r => r.batch_name).filter(Boolean));

  const { data: batches, error: batchesError } = await supabase
    .from('batches')
    .select('id, batch_name, program');

  if (batchesError) throw batchesError;

  const batchNameToId  = {};
  const batchIdToName  = {};
  const batchIdToProgram = {};
  (batches || []).forEach(b => {
    batchNameToId[b.batch_name] = b.id;
    batchIdToName[b.id]         = b.batch_name;
    batchIdToProgram[b.id]      = b.program;
  });

  activeRoundBatchNames.forEach(name => {
    const id = batchNameToId[name];
    if (id) directBatchIds.add(id);
  });

  const batchIdList = [...directBatchIds];
  if (batchIdList.length === 0) return { empty: true, message: 'Batch IDs tidak dapat diselesaikan.' };

  const batchIdToActiveRound = {};
  batchIdList.forEach(bId => {
    const batchName = batchIdToName[bId];
    const round = activeRounds.find(r =>
      r.batch_id === bId || (batchName && r.batch_name === batchName)
    );
    if (round) batchIdToActiveRound[bId] = round;
  });

  // 3. Active assignments
  const { data: assignments, error: assignError } = await supabase
    .from('mentor_assignments')
    .select('mentor_id, entrepreneur_id, batch_id')
    .eq('status', 'active')
    .eq('is_active', true)
    .in('batch_id', batchIdList);

  if (assignError) throw assignError;

  const entrepreneurIds = [...new Set((assignments || []).map(a => a.entrepreneur_id).filter(Boolean))];
  const allMentorIdSet  = new Set((assignments || []).map(a => a.mentor_id).filter(Boolean));

  if (entrepreneurIds.length === 0) return { empty: true, message: 'Tiada penugasan aktif ditemui.' };

  // 4. Submitted reports (non-MIA)
  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select('entrepreneur_id, session_number, mia_status')
    .in('entrepreneur_id', entrepreneurIds);

  if (reportsError) throw reportsError;

  const submitted = new Set();
  (reports || []).forEach(r => {
    if (r.mia_status?.trim() !== 'MIA' && r.entrepreneur_id && r.session_number != null) {
      submitted.add(`${r.entrepreneur_id}:${r.session_number}`);
    }
  });

  // 5. Build pending list per mentor
  const pendingByMentor = {};
  for (const { mentor_id, entrepreneur_id, batch_id } of (assignments || [])) {
    const activeRound = batchIdToActiveRound[batch_id];
    if (!activeRound) continue;
    if (submitted.has(`${entrepreneur_id}:${activeRound.round_number}`)) continue;

    if (!pendingByMentor[mentor_id]) pendingByMentor[mentor_id] = [];
    pendingByMentor[mentor_id].push({ entrepreneur_id, activeRound, batch_id });
  }

  const pendingMentorIds = Object.keys(pendingByMentor);
  const skipped = allMentorIdSet.size - pendingMentorIds.length;

  if (pendingMentorIds.length === 0) {
    return { empty: true, message: 'Semua laporan telah dihantar.', skipped };
  }

  // 6. Fetch mentor and entrepreneur details
  const [mentorsRes, entrepreneursRes] = await Promise.all([
    supabase.from('mentors').select('id, name, email').in('id', pendingMentorIds),
    supabase.from('entrepreneurs').select('id, name, program, batch').in('id', entrepreneurIds),
  ]);

  if (mentorsRes.error) throw mentorsRes.error;
  if (entrepreneursRes.error) throw entrepreneursRes.error;

  const mentorById       = {};
  const entrepreneurById = {};
  (mentorsRes.data || []).forEach(m => { mentorById[m.id] = m; });
  (entrepreneursRes.data || []).forEach(e => { entrepreneurById[e.id] = e; });

  return {
    empty: false,
    pendingByMentor,
    pendingMentorIds,
    skipped,
    mentorById,
    entrepreneurById,
    batchIdToName,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: 'Unauthorized' });

  const hasAccess = await canAccessAdmin(session.user.email);
  if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

  const isPreview  = req.method === 'GET'  && req.query.preview === 'true';
  const isTestMode = req.method === 'POST' && req.query.test    === 'true';

  const supabase = createAdminClient();

  try {
    const data = await buildPendingData(supabase);

    if (data.empty) {
      if (isPreview) {
        return res.status(200).json({ preview: true, mentors: [], totalMentors: 0, message: data.message });
      }
      return res.status(200).json({ sent: 0, skipped: data.skipped ?? 0, errors: [], message: data.message });
    }

    const { pendingByMentor, pendingMentorIds, skipped, mentorById, entrepreneurById, batchIdToName } = data;

    // ── PREVIEW: return mentor list without sending ───────────────────────────
    if (isPreview) {
      const mentors = pendingMentorIds.map(mentorId => {
        const mentor      = mentorById[mentorId] || {};
        const pendingList = pendingByMentor[mentorId];
        const distinctBatches = [...new Set(
          pendingList
            .map(({ batch_id }) => batchIdToName[batch_id])
            .filter(Boolean)
        )];
        return {
          name:         mentor.name  || '-',
          email:        mentor.email || '-',
          pendingCount: pendingList.length,
          batches:      distinctBatches,
        };
      });

      return res.status(200).json({ preview: true, mentors, totalMentors: mentors.length });
    }

    // ── SEND ─────────────────────────────────────────────────────────────────
    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    const errors = [];

    for (const [mentorId, pendingList] of Object.entries(pendingByMentor)) {
      const mentor = mentorById[mentorId];
      if (!mentor?.email) {
        errors.push({ mentor: mentor?.name || mentorId, email: null, error: 'No email on record' });
        continue;
      }

      const rows = pendingList.map(({ entrepreneur_id, activeRound }) => {
        const ent     = entrepreneurById[entrepreneur_id] || {};
        const isMaju  = (ent.program || '').toLowerCase().includes('maju');
        const path    = isMaju ? '/laporan-maju-um' : '/laporan-bangkit';
        const formUrl = `https://mentor.startlah.my${path}?mentor_id=${mentorId}&entrepreneur_id=${entrepreneur_id}&batch_round_id=${activeRound.id}`;
        return {
          entName:     ent.name  || '-',
          entBatch:    ent.batch || '-',
          roundNumber: activeRound.round_number,
          endDate:     formatDate(activeRound.end_date || activeRound.end_month),
          formUrl,
        };
      });

      const recipientEmail = isTestMode ? TEST_EMAIL     : mentor.email;
      const subject        = isTestMode
        ? `[TEST] Peringatan — Laporan Mentoring Belum Dihantar`
        : 'Peringatan — Laporan Mentoring Belum Dihantar';
      const html = buildReminderEmail(mentor.name, rows, isTestMode ? mentor.email : null);

      try {
        await resend.emails.send({
          from: 'iTEKAD Portal <noreply@startlah.my>',
          to:   recipientEmail,
          subject,
          html,
        });
        console.log(`✅ Reminder sent to ${recipientEmail}${isTestMode ? ` (test, orig: ${mentor.email})` : ''} (${rows.length} pending)`);
        sent++;
      } catch (err) {
        console.error(`❌ Failed to send to ${recipientEmail}:`, err.message);
        errors.push({ mentor: mentor.name, email: mentor.email, error: err.message });
      }
    }

    return res.status(200).json({ sent, skipped, errors });

  } catch (err) {
    console.error('❌ [send-reminders] Fatal error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
