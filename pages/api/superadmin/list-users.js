// pages/api/superadmin/list-users.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { isSystemAdmin } from '../../../lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized - Please sign in' });
    }

    const userEmail = session.user.email;

    // Check if user is system admin
    const isSuperAdmin = await isSystemAdmin(userEmail);
    if (!isSuperAdmin) {
      return res.status(403).json({
        error: 'Forbidden - Only system administrators can access this endpoint'
      });
    }

    // Fetch all user roles from Supabase
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('email, role, assigned_by, assigned_at')
      .order('email', { ascending: true })
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Error fetching user roles:', error);
      return res.status(500).json({
        error: 'Failed to fetch user roles',
        details: error.message
      });
    }

    // Group roles by email
    const usersMap = {};

    userRoles.forEach(row => {
      if (!usersMap[row.email]) {
        usersMap[row.email] = {
          email: row.email,
          roles: [],
          assigned_by: row.assigned_by,
          assigned_at: row.assigned_at
        };
      }
      usersMap[row.email].roles.push(row.role);
    });

    // Convert map to array
    const users = Object.values(usersMap);

    return res.status(200).json({
      success: true,
      users,
      total: users.length
    });

  } catch (error) {
    console.error('Error in list-users API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
