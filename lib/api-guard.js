// lib/api-guard.js
// SERVER-SIDE ONLY — session + role guards for Pages Router API routes.
import { unstable_getServerSession } from 'next-auth/next';
import { authOptions } from '../pages/api/auth/[...nextauth]';
import supabaseAdmin from './supabaseAdmin';

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
