// lib/umDbWrite.js
// Shared upward_mobility_reports write for submitBangkit + submitMajuReportum.
// The reports row is already saved when this runs, so it never throws: a failed
// UM write is retried once, then stored as a replayable dual_write_monitoring row
// (see scripts/replay-um-failure.js).

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
export function buildUMPayload(umData, { entrepreneur, mentorId, sesiNumber, program }) {
  const p = {};

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
