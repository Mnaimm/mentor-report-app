// lib/auth.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Fetch all roles for a user from database
 * Returns array of roles, defaults to ['mentor'] if user not found
 * Auto-creates mentor role for new users
 */
export async function getUserRoles(email) {
  if (!email) return ['mentor'];

  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', normalizedEmail);
  
  // If user doesn't exist, auto-create as mentor
  if (error || !data || data.length === 0) {
    console.log(`Auto-creating mentor role for: ${normalizedEmail}`);
    
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        email: normalizedEmail,
        role: 'mentor',
        assigned_by: 'system',
        assigned_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Error creating mentor role:', insertError);
    }
    
    return ['mentor'];
  }
  
  return data.map(r => r.role);
}

/**
 * Check if user has a specific role
 */
export function hasRole(roles, targetRole) {
  return roles.includes(targetRole);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(roles, targetRoles) {
  return targetRoles.some(role => roles.includes(role));
}

/**
 * Check if user is system admin (superadmin)
 */
export async function isSystemAdmin(email) {
  const roles = await getUserRoles(email);
  return hasRole(roles, 'system_admin');
}

/**
 * Check if user can access /admin page
 * Allowed: system_admin, program_coordinator, report_admin, payment_admin, stakeholder
 */
export async function canAccessAdmin(email) {
  const roles = await getUserRoles(email);
  return hasAnyRole(roles, [
    'system_admin',
    'program_coordinator',
    'report_admin',
    'payment_admin',
    'stakeholder'
  ]);
}

/**
 * Check if user can access /coordinator/dashboard
 * Allowed: system_admin, program_coordinator, stakeholder
 */
export async function canAccessCoordinator(email) {
  const roles = await getUserRoles(email);
  return hasAnyRole(roles, [
    'system_admin',
    'program_coordinator',
    'stakeholder'
  ]);
}

/**
 * Check if user can access /monitoring
 * Allowed: system_admin, stakeholder
 */
export async function canAccessMonitoring(email) {
  const roles = await getUserRoles(email);
  return hasAnyRole(roles, [
    'system_admin',
    'stakeholder'
  ]);
}

/**
 * Check if user can access /payment (future)
 * Allowed: system_admin, payment_admin, payment_approver
 */
export async function canAccessPayment(email) {
  const roles = await getUserRoles(email);
  return hasAnyRole(roles, [
    'system_admin',
    'payment_admin',
    'payment_approver'
  ]);
}

/**
 * Check if user is in read-only mode (stakeholder without other roles)
 * Returns true if user ONLY has stakeholder role
 */
export async function isReadOnly(email) {
  const roles = await getUserRoles(email);
  
  // User is read-only if they ONLY have stakeholder role
  // If they have stakeholder + other roles (like payment_approver), they're NOT read-only
  return roles.length === 1 && hasRole(roles, 'stakeholder');
}

/**
 * Check if user can edit/write (opposite of read-only)
 */
export async function canEdit(email) {
  const readOnly = await isReadOnly(email);
  return !readOnly;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getUserRoles() and hasRole() instead
 */
export function isAdmin(email) {
  const adminEmails = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  if (!email || !adminEmails) return false;
  
  const adminEmailArray = adminEmails.split(',').map(e => e.trim().toLowerCase());
  return adminEmailArray.includes(email.toLowerCase().trim());
}

/**
 * Get user's display role(s) for UI
 * Returns formatted string like "System Admin, Payment Approver"
 */
export async function getUserRoleDisplay(email) {
  const roles = await getUserRoles(email);
  
  const roleNames = {
    system_admin: 'System Admin',
    program_coordinator: 'Program Coordinator',
    report_admin: 'Report Admin',
    payment_admin: 'Payment Admin',
    payment_approver: 'Payment Approver',
    stakeholder: 'Stakeholder',
    mentor: 'Mentor',
    premier_mentor: 'Premier Mentor'
  };
  
  return roles.map(role => roleNames[role] || role).join(', ');
}