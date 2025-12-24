// pages/api/dashboard/recent-activity.js
import { requireAuth, hasRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authResult = await requireAuth(req, res);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  const { user } = authResult;
  const { limit = 20 } = req.query;

  try {
    let activities = [];

    // System Admin & Report Admin - See all activities
    if (hasRole(user, 'system_admin') || hasRole(user, 'report_admin')) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action,
          table_name,
          record_id,
          new_values,
          created_at,
          user_id,
          users!activity_logs_user_id_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;
      activities = data || [];
    }
    // Program Coordinator - See activities for their program
    else if (hasRole(user, 'program_coordinator')) {
      // Get coordinator's program
      const { data: profile } = await supabase
        .from('mentor_profiles')
        .select('programs')
        .eq('user_id', user.id)
        .single();

      const coordinatorProgram = profile?.programs?.[0];

      // Get activities from mentors in their program
      const { data: programMentors } = await supabase
        .from('mentor_profiles')
        .select('user_id')
        .contains('programs', [coordinatorProgram]);

      const mentorIds = programMentors?.map(m => m.user_id) || [];

      if (mentorIds.length > 0) {
        const { data, error } = await supabase
          .from('activity_logs')
          .select(`
            id,
            action,
            table_name,
            record_id,
            new_values,
            created_at,
            user_id,
            users!activity_logs_user_id_fkey (
              name,
              email
            )
          `)
          .in('user_id', mentorIds)
          .order('created_at', { ascending: false })
          .limit(parseInt(limit));

        if (error) throw error;
        activities = data || [];
      }
    }
    // Payment Admin & Approver - See payment-related activities
    else if (hasRole(user, 'payment_admin') || hasRole(user, 'payment_approver')) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action,
          table_name,
          record_id,
          new_values,
          created_at,
          user_id,
          users!activity_logs_user_id_fkey (
            name,
            email
          )
        `)
        .or('action.like.%payment%,table_name.eq.payment_requests')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;
      activities = data || [];
    }
    // Mentor - See only their own activities
    else if (hasRole(user, 'mentor') || hasRole(user, 'premier_mentor')) {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          action,
          table_name,
          record_id,
          new_values,
          created_at,
          user_id,
          users!activity_logs_user_id_fkey (
            name,
            email
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;
      activities = data || [];
    }
    // Stakeholder - No activity logs (aggregate data only)
    else if (hasRole(user, 'stakeholder')) {
      activities = [];
    }
    else {
      return res.status(403).json({ error: 'No valid role for activity access' });
    }

    // Format activities for display
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      time: activity.created_at,
      user: activity.users?.name || activity.users?.email || 'Unknown User',
      action: formatAction(activity.action),
      target: formatTarget(activity.table_name, activity.record_id),
      details: formatDetails(activity.new_values),
      raw: activity
    }));

    return res.status(200).json({
      activities: formattedActivities,
      count: formattedActivities.length
    });

  } catch (error) {
    console.error('Recent activity error:', error);
    return res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
}

// Helper function to format action names
function formatAction(action) {
  if (!action) return 'Unknown Action';
  
  // Convert snake_case to Title Case
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to format target
function formatTarget(tableName, recordId) {
  if (!tableName) return 'Unknown';
  
  const tableDisplay = tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return recordId ? `${tableDisplay} #${recordId}` : tableDisplay;
}

// Helper function to format details
function formatDetails(newValues) {
  if (!newValues || typeof newValues !== 'object') return '';
  
  // Extract useful details from new_values
  if (newValues.email) return newValues.email;
  if (newValues.name) return newValues.name;
  if (newValues.roles) return `Roles: ${newValues.roles.join(', ')}`;
  if (newValues.status) return `Status: ${newValues.status}`;
  
  return '';
}
