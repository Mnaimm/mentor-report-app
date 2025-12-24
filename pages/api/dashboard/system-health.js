// pages/api/dashboard/system-health.js
import { requireRole } from '../../../lib/auth-middleware';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only system_admin can access system health
  const authResult = await requireRole(req, res, 'system_admin');
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.message });
  }

  try {
    // Database Health Check
    const dbHealth = await checkDatabaseHealth();

    // Dual-Write Status (placeholder - will integrate with actual monitoring)
    const dualWriteStatus = await checkDualWriteStatus();

    // API Performance (placeholder)
    const apiPerformance = {
      avgResponseTime: 245, // ms
      slowestEndpoint: '/api/submitMajuReport',
      slowestTime: 890, // ms
      errorRate: 0.1, // percentage
      uptime: 99.98 // percentage
    };

    // Storage Usage (placeholder)
    const storageUsage = {
      images: {
        used: 2.3, // GB
        total: 50, // GB
        percentage: 4.6
      },
      database: {
        size: 145, // MB
        percentage: 0.3 // of total storage
      },
      reports: {
        count: 316,
        size: 42 // MB estimated
      }
    };

    return res.status(200).json({
      database: dbHealth,
      dualWrite: dualWriteStatus,
      api: apiPerformance,
      storage: storageUsage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('System health check error:', error);
    return res.status(500).json({ error: 'Failed to fetch system health' });
  }
}

// Check database connection and response time
async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    // Simple query to check connection
    const { data, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: 'error',
        connection: false,
        responseTime: null,
        error: error.message
      };
    }

    return {
      status: 'healthy',
      connection: true,
      responseTime: `${responseTime}ms`,
      activeConnections: 3, // Placeholder
      lastBackup: getLastBackupTime() // Placeholder
    };

  } catch (err) {
    return {
      status: 'error',
      connection: false,
      responseTime: null,
      error: err.message
    };
  }
}

// Check dual-write operation status
async function checkDualWriteStatus() {
  // TODO: Implement actual dual-write monitoring
  // For now, returning mock data based on activity logs
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Count operations today (from activity_logs as proxy)
    const { count: operationsToday } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Get last sync time
    const { data: lastActivity } = await supabase
      .from('activity_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastSyncTime = lastActivity?.created_at 
      ? getTimeSince(new Date(lastActivity.created_at))
      : 'Unknown';

    return {
      totalOperationsToday: operationsToday || 0,
      successful: operationsToday || 0, // Assuming all successful for now
      failed: 0,
      successRate: 100, // percentage
      lastSync: lastSyncTime,
      status: 'operational'
    };

  } catch (error) {
    console.error('Dual-write check error:', error);
    return {
      totalOperationsToday: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      lastSync: 'Unknown',
      status: 'error',
      error: error.message
    };
  }
}

// Helper: Get time since last backup (placeholder)
function getLastBackupTime() {
  // Supabase handles backups automatically
  // Return estimated time
  const twoHoursAgo = new Date();
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
  return getTimeSince(twoHoursAgo);
}

// Helper: Format time since a date
function getTimeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
