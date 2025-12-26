// lib/auth-middleware.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Require user to be authenticated
 * Returns { user, error, status, message }
 * Note: Also fetches user's roles and ID from database
 */
export async function requireAuth(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return {
      error: true,
      status: 401,
      message: 'Unauthorized - Please sign in'
    };
  }

  // Get user's roles and ID from database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, roles')
    .eq('email', session.user.email)
    .single();

  if (dbError || !dbUser) {
    console.error('User not found in database:', session.user.email, dbError);
    return {
      error: true,
      status: 403,
      message: 'User not found in database. Please contact administrator.'
    };
  }

  return {
    error: false,
    user: {
      ...session.user,
      id: dbUser.id, // Database UUID
      roles: dbUser.roles || [] // User roles from database
    }
  };
}

/**
 * Require user to have a specific role
 * Returns { user, error, status, message }
 */
export async function requireRole(req, res, requiredRole) {
  const authResult = await requireAuth(req, res);

  if (authResult.error) {
    return authResult;
  }

  const { user } = authResult;

  // Get user's roles and ID from database
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, roles')
    .eq('email', user.email)
    .single();

  if (dbError || !dbUser) {
    // If user doesn't exist in database, return error
    console.error('User not found in database:', user.email, dbError);
    return {
      error: true,
      status: 403,
      message: 'User not found in database. Please contact administrator.'
    };
  }

  const userRoles = dbUser.roles || [];

  // Check if user has required role
  if (!userRoles.includes(requiredRole)) {
    console.warn(`Access denied for ${user.email} - Required role: ${requiredRole}, User has: ${userRoles.join(', ')}`);
    return {
      error: true,
      status: 403,
      message: `Access denied - Required role: ${requiredRole}`
    };
  }

  return {
    error: false,
    user: {
      ...user,
      id: dbUser.id, // Use database ID (UUID)
      roles: userRoles
    }
  };
}

/**
 * Check if user object has a specific role
 * Used in dashboard/stats.js
 */
export function hasRole(user, role) {
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
}

/**
 * Log coordinator activity
 * Used in coordinator/assign-mentor.js
 */
export async function logActivity(userId, action, tableName, recordId, metadata) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action,
        table_name: tableName,
        record_id: recordId,
        metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log activity:', error);
      return false;
    }

    console.log(`✅ Activity logged: ${action} by ${userId}`);
    return true;
  } catch (err) {
    console.error('Activity logging error:', err);
    return false;
  }
}
