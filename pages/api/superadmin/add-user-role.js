// pages/api/superadmin/add-user-role.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { isSystemAdmin } from '../../../lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Valid role types
const VALID_ROLES = [
  'system_admin',
  'program_coordinator',
  'report_admin',
  'payment_admin',
  'payment_approver',
  'stakeholder',
  'mentor',
  'premier_mentor'
];

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Check if user already has this role
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('email, role')
      .eq('email', normalizedEmail)
      .eq('role', role)
      .single();

    if (existingRole) {
      return res.status(409).json({
        error: `User ${normalizedEmail} already has the role: ${role}`
      });
    }

    // Insert new role
    const { data: newRole, error: insertError } = await supabase
      .from('user_roles')
      .insert({
        email: normalizedEmail,
        role: role,
        assigned_by: adminEmail,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting role:', insertError);
      return res.status(500).json({
        error: 'Failed to add role',
        details: insertError.message
      });
    }

    // Log to sync_operations table for audit trail
    await supabase
      .from('sync_operations')
      .insert({
        operation_type: 'role_added',
        table_name: 'user_roles',
        record_id: newRole.id,
        user_email: normalizedEmail,
        metadata: {
          role: role,
          assigned_by: adminEmail,
          action: 'add_role'
        },
        sheets_success: false, // Not syncing to sheets
        supabase_success: true,
        timestamp: new Date().toISOString()
      });

    return res.status(201).json({
      success: true,
      message: `Role "${role}" successfully added to ${normalizedEmail}`,
      role: newRole
    });

  } catch (error) {
    console.error('Error in add-user-role API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
