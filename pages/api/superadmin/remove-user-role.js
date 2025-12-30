// pages/api/superadmin/remove-user-role.js
import { getSession } from 'next-auth/react';
import { isSystemAdmin, getUserRoles } from '../../../lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow DELETE requests
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized - Please sign in' });
    }

    const adminEmail = session.user.email;

    // Check if user is system admin
    const isSuperAdmin = await isSystemAdmin(adminEmail);
    if (!isSuperAdmin) {
      return res.status(403).json({
        error: 'Forbidden - Only system administrators can access this endpoint'
      });
    }

    // Validate request body
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        error: 'Missing required fields: email and role are required'
      });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Get all current roles for this user
    const currentRoles = await getUserRoles(normalizedEmail);

    // Check if user has only one role
    if (currentRoles.length === 1) {
      return res.status(400).json({
        error: 'Cannot remove the last role from a user. Each user must have at least one role.'
      });
    }

    // Check if removing system_admin role and count remaining system admins
    if (role === 'system_admin') {
      // Get all users with system_admin role
      const { data: systemAdmins, error: countError } = await supabase
        .from('user_roles')
        .select('email')
        .eq('role', 'system_admin');

      if (countError) {
        console.error('Error counting system admins:', countError);
        return res.status(500).json({
          error: 'Failed to verify system admin count',
          details: countError.message
        });
      }

      // Get unique system admin emails
      const uniqueAdminEmails = [...new Set(systemAdmins.map(a => a.email))];

      // If this is the last system admin, prevent removal
      if (uniqueAdminEmails.length === 1 && uniqueAdminEmails[0] === normalizedEmail) {
        return res.status(400).json({
          error: 'Cannot remove the last system_admin role. There must be at least one system administrator.'
        });
      }
    }

    // Check if the role exists for this user
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('id, email, role')
      .eq('email', normalizedEmail)
      .eq('role', role)
      .single();

    if (checkError || !existingRole) {
      return res.status(404).json({
        error: `Role "${role}" not found for user ${normalizedEmail}`
      });
    }

    // Delete the role
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('email', normalizedEmail)
      .eq('role', role);

    if (deleteError) {
      console.error('Error deleting role:', deleteError);
      return res.status(500).json({
        error: 'Failed to remove role',
        details: deleteError.message
      });
    }

    // Log to sync_operations table for audit trail
    await supabase
      .from('sync_operations')
      .insert({
        operation_type: 'role_removed',
        table_name: 'user_roles',
        record_id: existingRole.id,
        user_email: normalizedEmail,
        metadata: {
          role: role,
          removed_by: adminEmail,
          action: 'remove_role'
        },
        sheets_success: false, // Not syncing to sheets
        supabase_success: true,
        timestamp: new Date().toISOString()
      });

    return res.status(200).json({
      success: true,
      message: `Role "${role}" successfully removed from ${normalizedEmail}`
    });

  } catch (error) {
    console.error('Error in remove-user-role API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
