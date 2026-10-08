// lib/submitter.js
// Pure helpers (no I/O) for deciding whose mentor email a submission uses.

export const ON_BEHALF_ROLES = ['system_admin', 'program_coordinator'];

export const normEmail = (s) => (s || '').toString().trim().toLowerCase();

/**
 * True if the body carries a mentor email that is not the session email.
 * An empty body email does not count as different.
 */
export function bodyEmailDiffers(sessionEmail, bodyEmail) {
  const body = normEmail(bodyEmail);
  return !!body && body !== normEmail(sessionEmail);
}

/**
 * Resolves the mentor email to use for a submission.
 * - Same as session (or empty): session email; no role check.
 * - Different: allowed only if `checkOnBehalf(sessionEmail)` resolves true,
 *   in which case the body email is used. Otherwise not allowed.
 * `checkOnBehalf` is only called when the emails differ.
 */
export async function resolveSubmitterEmail(sessionEmail, bodyEmail, checkOnBehalf) {
  const session = (sessionEmail || '').toString().trim();
  if (!session) return { allowed: false, email: null, onBehalf: false };
  if (!bodyEmailDiffers(session, bodyEmail)) return { allowed: true, email: session, onBehalf: false };
  const ok = await checkOnBehalf(session);
  return ok
    ? { allowed: true, email: bodyEmail.toString().trim(), onBehalf: true }
    : { allowed: false, email: null, onBehalf: false };
}
