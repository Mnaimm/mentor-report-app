// lib/api-guard.js
// SERVER-SIDE ONLY — session + role guards for Pages Router API routes.
import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import supabaseAdmin from './supabaseAdmin';
import { getUserRoles, hasAnyRole } from './auth';
import { ON_BEHALF_ROLES, resolveSubmitterEmail } from './submitter';

/**
 * Returns the session, or sends 401 and returns null.
 */
export async function requireSession(req, res) {
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: 'Sila log masuk' });
    return null;
  }
  return session;
}

/**
 * getUserRoles (lib/auth.js) auto-inserts a 'mentor' row for emails with no
 * user_roles row. Such users can never pass a canAccess* check, so callers
 * deny them first to avoid that write.
 */
export async function hasAnyUserRole(email) {
  const { count, error } = await supabaseAdmin
    .from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase().trim());
  if (error) {
    console.error('❌ Error checking user_roles:', error);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * True if the user has any of `targetRoles` in user_roles. Users with no
 * user_roles row return false without calling getUserRoles (no auto-insert).
 */
export async function userHasAnyRole(email, targetRoles) {
  if (!(await hasAnyUserRole(email))) return false;
  return hasAnyRole(await getUserRoles(email), targetRoles);
}

/**
 * Mentor email a submission may use. Body email equal to the session (or
 * empty) -> session email. Different -> allowed only for ON_BEHALF_ROLES
 * (role check runs only then). Sends 403 and returns null when not allowed.
 */
export async function requireSubmitterEmail(res, session, bodyEmail) {
  const result = await resolveSubmitterEmail(session.user.email, bodyEmail, (email) =>
    userHasAnyRole(email, ON_BEHALF_ROLES)
  );
  if (!result.allowed) {
    res.status(403).json({ error: 'Anda tidak dibenarkan' });
    return null;
  }
  return result.email;
}

/**
 * Returns the session if the user passes `canAccess` (an existing lib/auth.js
 * check such as canAccessMonitoring); otherwise sends 401/403 and returns null.
 */
export async function requireAccess(req, res, canAccess) {
  const session = await requireSession(req, res);
  if (!session) return null;

  const email = session.user.email;
  const allowed = (await hasAnyUserRole(email)) && (await canAccess(email));
  if (!allowed) {
    res.status(403).json({ error: 'Anda tidak dibenarkan' });
    return null;
  }
  return session;
}
