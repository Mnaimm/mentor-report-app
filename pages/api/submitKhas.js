// pages/api/submitKhas.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { createAdminClient } from '../../lib/supabaseAdmin';

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
      .select('id, name, business_name, phone, address, program')
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

      // No images for khas form
      image_urls: { sesi: [], premis: [], growthwheel: '', profil: '' },
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
    console.log(`✅ [submitKhas] Supabase write successful. ID: ${reportId}`);

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
            console.error('⚠️ [submitKhas] UM write failed (non-blocking):', umErr.message);
          } else {
            console.log(`✅ [submitKhas] UM write successful`);
          }
        } catch (err) {
          console.error('⚠️ [submitKhas] UM write exception (non-blocking):', err.message);
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
    console.error('[submitKhas] ❌', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
