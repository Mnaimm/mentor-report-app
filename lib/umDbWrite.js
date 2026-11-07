// lib/umDbWrite.js
// Shared upward_mobility_reports write for submitBangkit + submitMajuReportum.
// The reports row is already saved when this runs, so it never throws: a failed
// UM write is retried once, then stored as a replayable dual_write_monitoring row
// (see scripts/replay-um-failure.js).

import { UM_VERSION_MISMATCH } from './resolveUMVersion';
import {
  BIMB_CHANNELS,
  SWOT_QUADRANTS,
  requiresSwot,
  swotNotes,
  validateUpwardMobilityV2,
} from './upwardMobilityV2';

export const UM_DB_FAILED_WARNING = {
  code: 'UM_DB_FAILED',
  message:
    'Laporan sesi telah disimpan, tetapi data Upward Mobility gagal disimpan. ' +
    'Sila maklumkan admin dan sertakan ID Penghantaran. Jangan hantar semula laporan ini.',
};

/**
 * Builds the schema-whitelisted upward_mobility_reports payload.
 * Field mapping is unchanged from the original per-handler builders.
 */
export function buildUMPayload(umData, { entrepreneur, mentorId, sesiNumber, program, reportId, umVersion = 1 }) {
  const p = {};

  // Form version + parent report, set explicitly (the column default is only a safety net)
  p.um_version = umVersion;
  if (reportId) p.report_id = reportId;

  // Required foreign keys
  p.entrepreneur_id = entrepreneur.id;
  p.mentor_id = mentorId;

  // Batch from entrepreneur record (not from form payload)
  if (entrepreneur.batch) p.batch = entrepreneur.batch;

  // Program & Session
  if (sesiNumber) p.sesi_mentoring = `Sesi ${sesiNumber}`;
  p.program = program;

  // Section 1: Status & Mobiliti
  if (umData.UM_STATUS_PENGLIBATAN) p.status_penglibatan = umData.UM_STATUS_PENGLIBATAN;
  if (umData.UM_STATUS) p.um_status = umData.UM_STATUS;
  if (umData.UM_STATUS) p.upward_mobility_status = umData.UM_STATUS;
  if (umData.UM_KRITERIA_IMPROVEMENT) p.kriteria_improvement = umData.UM_KRITERIA_IMPROVEMENT;
  if (umData.UM_TARIKH_LAWATAN_PREMIS) p.tarikh_lawatan = umData.UM_TARIKH_LAWATAN_PREMIS;

  // Section 2: Bank Islam & Fintech
  if (umData.UM_AKAUN_BIMB) p.bank_akaun_semasa = umData.UM_AKAUN_BIMB;
  if (umData.UM_BIMB_BIZ) p.bank_bizapp = umData.UM_BIMB_BIZ;
  if (umData.UM_AL_AWFAR) p.bank_al_awfar = umData.UM_AL_AWFAR;
  if (umData.UM_MERCHANT_TERMINAL) p.bank_merchant_terminal = umData.UM_MERCHANT_TERMINAL;
  if (umData.UM_FASILITI_LAIN) p.bank_fasiliti_lain = umData.UM_FASILITI_LAIN;
  if (umData.UM_MESINKIRA) p.bank_mesinkira = umData.UM_MESINKIRA;

  // Section 3: Financial & Employment Metrics
  if (umData.UM_PENDAPATAN_SEMASA) {
    const parsed = parseFloat(umData.UM_PENDAPATAN_SEMASA);
    if (!isNaN(parsed)) p.pendapatan_semasa = parsed;
  }
  if (umData.UM_ULASAN_PENDAPATAN) p.ulasan_pendapatan = umData.UM_ULASAN_PENDAPATAN;

  if (umData.UM_PEKERJA_SEMASA) {
    const parsed = parseInt(umData.UM_PEKERJA_SEMASA);
    if (!isNaN(parsed)) p.pekerja_semasa = parsed;
  }
  if (umData.UM_ULASAN_PEKERJA) p.ulasan_pekerjaan = umData.UM_ULASAN_PEKERJA;

  if (umData.UM_ASET_BUKAN_TUNAI_SEMASA) {
    const parsed = parseFloat(umData.UM_ASET_BUKAN_TUNAI_SEMASA);
    if (!isNaN(parsed)) p.aset_bukan_tunai_semasa = parsed;
  }
  if (umData.UM_ULASAN_ASET_BUKAN_TUNAI) p.ulasan_aset_bukan_tunai = umData.UM_ULASAN_ASET_BUKAN_TUNAI;

  if (umData.UM_PEKERJA_PARTTIME_SEMASA) {
    const parsed = parseInt(umData.UM_PEKERJA_PARTTIME_SEMASA);
    if (!isNaN(parsed)) p.pekerja_parttime_semasa = parsed;
  }
  if (umData.UM_ULASAN_PEKERJA_PARTTIME) p.ulasan_pekerja_parttime = umData.UM_ULASAN_PEKERJA_PARTTIME;

  if (umData.UM_SIMPANAN_SEMASA) {
    const parsed = parseFloat(umData.UM_SIMPANAN_SEMASA);
    if (!isNaN(parsed)) p.simpanan_semasa = parsed;
  }
  if (umData.UM_ULASAN_SIMPANAN) p.ulasan_simpanan = umData.UM_ULASAN_SIMPANAN;

  if (umData.UM_ZAKAT_SEMASA) p.zakat_semasa = umData.UM_ZAKAT_SEMASA;
  if (umData.UM_ULASAN_ZAKAT) p.ulasan_zakat = umData.UM_ULASAN_ZAKAT;

  // Section 4: Digitalization
  if (umData.UM_DIGITAL_SEMASA) p.digital_semasa = umData.UM_DIGITAL_SEMASA;
  if (umData.UM_ULASAN_DIGITAL) p.ulasan_digital = umData.UM_ULASAN_DIGITAL;

  // Section 5: Marketing
  if (umData.UM_MARKETING_SEMASA) p.marketing_semasa = umData.UM_MARKETING_SEMASA;
  if (umData.UM_ULASAN_MARKETING) p.ulasan_marketing = umData.UM_ULASAN_MARKETING;

  // Timestamps (created_at doubles as the per-request idempotency token below)
  const now = new Date().toISOString();
  p.created_at = now;
  p.updated_at = now;

  return p;
}

/**
 * Version check + v2 validation, run before the reports insert so a rejected
 * submission writes nothing.
 * @returns { ok, status, body, v2State } — v2State is the parsed v2 UM data when the
 *   server version is 2 and the data is valid; null on the v1 path or for MIA.
 */
export function prepareUMSubmission(rawJson, { serverVersion, sesiNumber, isMIA }) {
  if (isMIA) return { ok: true, v2State: null };

  let parsed = null;
  try {
    parsed = rawJson ? JSON.parse(rawJson) : null;
  } catch {
    parsed = undefined; // bad JSON
  }
  const clientVersion = parsed ? Number(parsed.umVersion) || 1 : null;

  if (serverVersion !== 2) {
    if (clientVersion !== null && clientVersion !== 1) return { ok: false, status: 409, body: UM_VERSION_MISMATCH };
    return { ok: true, v2State: null }; // v1 path unchanged (bad JSON is still handled at the UM write)
  }

  if (clientVersion !== null && clientVersion !== 2) return { ok: false, status: 409, body: UM_VERSION_MISMATCH };
  const errors = parsed
    ? validateUpwardMobilityV2(parsed, { sesiNumber })
    : ['Upward Mobility - Bahagian Upward Mobility adalah wajib diisi'];
  if (errors.length) {
    return {
      ok: false,
      status: 400,
      body: { code: 'UM_V2_INVALID', error: 'Sila lengkapkan medan Upward Mobility yang diperlukan.', errors },
    };
  }
  return { ok: true, v2State: parsed };
}

const present = (v) => v !== '' && v != null; // 0 must be kept

/**
 * upward_mobility_reports payload for a v2 row. Expects data that already passed
 * validateUpwardMobilityV2 (prepareUMSubmission runs before the reports insert).
 */
export function buildUMPayloadV2(v2, { entrepreneur, mentorId, sesiNumber, program, reportId, batchId }) {
  const p = {
    um_version: 2,
    report_id: reportId || null,
    batch_id: batchId || null,
    entrepreneur_id: entrepreneur.id,
    mentor_id: mentorId,
    program,
  };
  if (entrepreneur.batch) p.batch = entrepreneur.batch;
  if (sesiNumber) p.sesi_mentoring = `Sesi ${sesiNumber}`;

  // Status (same columns as v1)
  if (v2.status) {
    p.um_status = v2.status;
    p.upward_mobility_status = v2.status;
  }
  if (v2.kriteria_improvement) p.kriteria_improvement = v2.kriteria_improvement;
  if (v2.tarikh_lawatan) p.tarikh_lawatan = v2.tarikh_lawatan;

  // BIMB channels (Ya/Tidak)
  for (const c of BIMB_CHANNELS) {
    if (v2.bimb?.[c.field]) p[c.column] = v2.bimb[c.field];
  }

  // Dimensions 1–4 (reused v1 columns)
  if (present(v2.pendapatan)) p.pendapatan_semasa = Number(v2.pendapatan);
  if (v2.ulasan_pendapatan) p.ulasan_pendapatan = v2.ulasan_pendapatan;
  if (present(v2.pekerja_ft)) p.pekerja_semasa = parseInt(v2.pekerja_ft, 10);
  if (present(v2.pekerja_pt)) p.pekerja_parttime_semasa = parseInt(v2.pekerja_pt, 10);
  if (v2.ulasan_pekerjaan) p.ulasan_pekerjaan = v2.ulasan_pekerjaan;
  if (present(v2.simpanan)) p.simpanan_semasa = Number(v2.simpanan);
  if (v2.ulasan_simpanan) p.ulasan_simpanan = v2.ulasan_simpanan;
  if (present(v2.zakat)) p.zakat_semasa = String(Number(v2.zakat)); // column is text
  if (v2.ulasan_zakat) p.ulasan_zakat = v2.ulasan_zakat;

  // 5–6 Media sosial / E-dagang (text[] of codes)
  p.media_sosial = Array.isArray(v2.media_sosial) ? v2.media_sosial : [];
  if (v2.ulasan_media_sosial) p.ulasan_media_sosial = v2.ulasan_media_sosial;
  p.edagang_saluran = Array.isArray(v2.edagang_saluran) ? v2.edagang_saluran : [];
  if (v2.edagang_whatsapp) p.edagang_whatsapp = v2.edagang_whatsapp;
  if (v2.ulasan_edagang) p.ulasan_edagang = v2.ulasan_edagang;

  // SWOT: Sesi 1/3 only; other sessions leave every SWOT column NULL
  if (requiresSwot(sesiNumber) && v2.swot) {
    p.swot_justifikasi = v2.swot.justifikasi;
    for (const q of SWOT_QUADRANTS) p[q.column] = v2.swot[q.key];
    p.swot_nota = swotNotes(v2.swot);
  }

  // Timestamps (created_at doubles as the per-request idempotency token below)
  const now = new Date().toISOString();
  p.created_at = now;
  p.updated_at = now;

  return p;
}

// Finds a row this request already committed (insert succeeded but the response was lost).
async function findCommittedRow(supabaseAdmin, payload) {
  try {
    const { data, error } = await supabaseAdmin
      .from('upward_mobility_reports')
      .select('id')
      .eq('entrepreneur_id', payload.entrepreneur_id)
      .eq('created_at', payload.created_at)
      .limit(1);
    if (error) return null;
    return data?.[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Inserts the UM row, retrying once. Never throws.
 * @param ctx { reportId, program, sesiNumber, mentorEmail, menteeName, failureLog }
 *   failureLog: the handler's existing dual_write_monitoring fields (source/target system, sheets row, metadata)
 * @returns { success, recordId, error, attempts, replayLogged }
 */
export async function insertUMWithRetry(supabaseAdmin, payload, ctx) {
  const errors = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabaseAdmin
        .from('upward_mobility_reports')
        .insert(payload)
        .select();
      if (!error) {
        return { success: true, recordId: data?.[0]?.id || null, error: null, attempts: attempt, replayLogged: false };
      }
      errors.push(error.message || String(error));
    } catch (e) {
      errors.push(e.message || String(e));
    }

    const committedId = await findCommittedRow(supabaseAdmin, payload);
    if (committedId) {
      console.warn(`⚠️ UM insert attempt ${attempt} errored but the row was committed (${committedId})`);
      return { success: true, recordId: committedId, error: null, attempts: attempt, replayLogged: false };
    }
    console.error(`⚠️ UM insert attempt ${attempt} failed:`, errors[errors.length - 1]);
  }

  const error = errors.join(' | ');
  const replayLogged = await logUMFailure(supabaseAdmin, { ...ctx, payload, error, attempts: 2 });
  return { success: false, recordId: null, error, attempts: 2, replayLogged };
}

/**
 * Stores a replayable failure record. payload may be null when the UM data could not be built
 * (e.g. bad JSON) — then rawUM keeps the original string for manual recovery.
 */
export async function logUMFailure(supabaseAdmin, { reportId, entrepreneurId, program, sesiNumber, payload, rawUM, error, attempts, failureLog = {} }) {
  const row = {
    ...failureLog,
    operation_type: 'insert',
    table_name: 'upward_mobility_reports',
    status: 'failed',
    error_message: error,
    timestamp: new Date().toISOString(),
    metadata: {
      ...(failureLog.metadata || {}),
      replayable: !!payload,
      report_id: reportId,
      entrepreneur_id: payload?.entrepreneur_id || entrepreneurId || null,
      program,
      sesi: sesiNumber,
      attempts,
      error,
      um_payload: payload || null,
      raw_um_json: payload ? undefined : rawUM,
    },
  };
  try {
    const { error: logError } = await supabaseAdmin.from('dual_write_monitoring').insert(row);
    if (logError) throw logError;
    return true;
  } catch (e) {
    // Last resort: the full payload goes to the function log so it can still be recovered.
    console.error('❌ UM failure could not be logged to dual_write_monitoring. Replay data:', JSON.stringify(row), e);
    return false;
  }
}
