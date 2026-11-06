// lib/resolveUMVersion.js
// Resolves which Upward Mobility form version applies to an entrepreneur:
// active mentor_assignments row → batches.um_version. Never derived from
// entrepreneurs.batch (free text, inconsistent) or from anything the client sends.

const DEFAULT_UM_VERSION = 1;

export const UM_V2_NOT_OPEN = {
  code: 'UM_V2_NOT_OPEN',
  error: 'Borang laporan untuk Batch 10 Bangkit / Batch 9 Maju akan dibuka tidak lama lagi. Sila simpan nota sesi anda dahulu.',
};

export const UM_VERSION_LOOKUP_FAILED = {
  code: 'UM_VERSION_LOOKUP_FAILED',
  error: 'Sistem tidak dapat mengesahkan batch usahawan. Sila cuba sebentar lagi.',
};

/**
 * @param ctx { entrepreneurId, mentorId } — mentorId is optional; when given, that mentor's
 *   assignment is preferred over other active assignments of the same entrepreneur.
 * @returns { version, batchId, error } — version is 1 when no active assignment or batch is found.
 *   error is set when a lookup failed (version is then 1); guarded routes treat it as fail-closed.
 */
export async function resolveUMVersion(supabaseAdmin, { entrepreneurId, mentorId } = {}) {
  const fallback = { version: DEFAULT_UM_VERSION, batchId: null, error: null };
  if (typeof entrepreneurId !== 'string' || !entrepreneurId.trim()) return fallback;

  const { data: assignments, error: assignmentError } = await supabaseAdmin
    .from('mentor_assignments')
    .select('mentor_id, batch_id')
    .eq('entrepreneur_id', entrepreneurId)
    .eq('status', 'active')
    .eq('is_active', true);
  if (assignmentError) return { ...fallback, error: `mentor_assignments: ${assignmentError.message}` };

  const withBatch = (assignments || []).filter((a) => a.batch_id);
  if (withBatch.length === 0) return fallback;

  const own = mentorId ? withBatch.filter((a) => a.mentor_id === mentorId) : [];
  const batchIds = [...new Set((own.length ? own : withBatch).map((a) => a.batch_id))];

  const { data: batches, error: batchError } = await supabaseAdmin
    .from('batches')
    .select('id, um_version')
    .in('id', batchIds);
  if (batchError) return { ...fallback, error: `batches: ${batchError.message}` };

  // Highest version wins if candidates disagree, so a v2 batch is never treated as v1
  let result = fallback;
  for (const b of batches || []) {
    const version = Number(b.um_version) || DEFAULT_UM_VERSION;
    if (!result.batchId || version > result.version) result = { version, batchId: b.id, error: null };
  }
  return result;
}
