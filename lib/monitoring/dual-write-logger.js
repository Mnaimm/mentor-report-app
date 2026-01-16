/**
 * Dual-Write Logger
 *
 * Logs every write operation to both Google Sheets and Supabase
 * Tracks success rates, performance, and errors
 *
 * Usage:
 * import { logDualWrite } from '@/lib/monitoring/dual-write-logger';
 *
 * await logDualWrite({
 *   operation: 'INSERT',
 *   table: 'reports',
 *   recordId: '123',
 *   sheetsResult: { success: true, duration: 1200 },
 *   supabaseResult: { success: true, duration: 450 },
 *   user: 'mentor@email.com',
 *   batch: 'Batch 5 Bangkit'
 * });
 */

import { createClient } from '@supabase/supabase-js';
import { formatError } from './error-formatter';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Log a dual-write operation
 *
 * @param {Object} params - Logging parameters
 * @param {string} params.operation - INSERT, UPDATE, DELETE, UPSERT
 * @param {string} params.table - Table name
 * @param {string} params.recordId - Record ID (optional)
 * @param {Object} params.sheetsResult - { success: boolean, duration: number, error?: Error }
 * @param {Object} params.supabaseResult - { success: boolean, duration: number, error?: Error }
 * @param {string} params.user - User email
 * @param {string} params.batch - Batch name
 * @param {string} params.program - Program name (Bangkit, Maju, iTEKAD)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} - { success: boolean, logId?: string, error?: string }
 */
export async function logDualWrite({
  operation,
  table,
  recordId = null,
  sheetsResult,
  supabaseResult,
  user = null,
  batch = null,
  program = null,
  metadata = {}
}) {
  try {
    // Validate required params
    if (!operation || !table) {
      console.error('❌ logDualWrite: Missing required parameters');
      return { success: false, error: 'Missing required parameters' };
    }

    if (!sheetsResult || !supabaseResult) {
      console.error('❌ logDualWrite: Missing result objects');
      return { success: false, error: 'Missing result objects' };
    }

    // Prepare log data
    const logData = {
      operation_type: operation.toUpperCase(),
      table_name: table,
      record_id: recordId,

      // Google Sheets results
      sheets_success: sheetsResult.success === true,
      sheets_duration_ms: sheetsResult.duration || null,
      sheets_error: sheetsResult.error ? formatError(sheetsResult.error) : null,

      // Supabase results
      supabase_success: supabaseResult.success === true,
      supabase_duration_ms: supabaseResult.duration || null,
      supabase_error: supabaseResult.error ? formatError(supabaseResult.error) : null,

      // Context
      user_email: user,
      batch_name: batch,
      program: program,

      // Metadata
      metadata: {
        ...metadata,
        logged_at: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      },

      timestamp: new Date().toISOString()
    };

    // Insert log into Supabase
    const { data, error } = await supabase
      .from('dual_write_monitoring')
      .insert(logData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to insert dual-write log:', error);
      return { success: false, error: error.message };
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const status = sheetsResult.success && supabaseResult.success ? '✅' : '⚠️';
      console.log(`${status} Dual-write logged: ${operation} ${table} (Sheets: ${sheetsResult.success}, Supabase: ${supabaseResult.success})`);
    }

    return { success: true, logId: data.id };

  } catch (error) {
    console.error('❌ Exception in logDualWrite:', error);
    // Don't throw - logging should never break the main flow
    return { success: false, error: error.message };
  }
}

/**
 * Log a successful dual-write (both systems succeeded)
 */
export async function logDualWriteSuccess(params) {
  return logDualWrite({
    ...params,
    sheetsResult: { success: true, duration: params.sheetsResult?.duration },
    supabaseResult: { success: true, duration: params.supabaseResult?.duration }
  });
}

/**
 * Log a partial failure (one system failed)
 */
export async function logDualWritePartialFailure(params) {
  return logDualWrite(params);
}

/**
 * Log a complete failure (both systems failed)
 */
export async function logDualWriteFailure(params) {
  return logDualWrite({
    ...params,
    sheetsResult: { success: false, error: params.sheetsResult?.error },
    supabaseResult: { success: false, error: params.supabaseResult?.error }
  });
}

/**
 * Get recent dual-write logs
 *
 * @param {number} limit - Number of logs to retrieve
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Array of log entries
 */
export async function getRecentLogs(limit = 50, filters = {}) {
  try {
    let query = supabase
      .from('dual_write_monitoring')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Apply filters
    if (filters.table) {
      query = query.eq('table_name', filters.table);
    }
    if (filters.user) {
      query = query.eq('user_email', filters.user);
    }
    if (filters.batch) {
      query = query.eq('batch_name', filters.batch);
    }
    if (filters.operation) {
      query = query.eq('operation_type', filters.operation);
    }
    if (filters.failuresOnly) {
      query = query.or('sheets_success.eq.false,supabase_success.eq.false');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get recent logs:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Exception in getRecentLogs:', error);
    return [];
  }
}

/**
 * Get today's statistics
 *
 * @returns {Promise<Object>} - Statistics object
 */
export async function getTodayStats() {
  try {
    const { data, error } = await supabase
      .from('todays_summary')
      .select('*')
      .single();

    if (error) {
      console.error('Failed to get today stats:', error);
      return null;
    }

    return data;

  } catch (error) {
    console.error('Exception in getTodayStats:', error);
    return null;
  }
}

/**
 * Check system health
 *
 * @returns {Promise<Object>} - Health status
 */
export async function checkSystemHealth() {
  try {
    const stats = await getTodayStats();

    if (!stats) {
      return {
        healthy: false,
        message: 'Unable to fetch statistics'
      };
    }

    const sheetsSuccessRate = parseFloat(stats.sheets_success_rate || 0);
    const supabaseSuccessRate = parseFloat(stats.supabase_success_rate || 0);

    const healthy = sheetsSuccessRate >= 99.5 && supabaseSuccessRate >= 99.5;

    return {
      healthy,
      sheetsSuccessRate,
      supabaseSuccessRate,
      totalOperations: stats.total_operations || 0,
      message: healthy ? 'System healthy' : 'Success rate below threshold'
    };

  } catch (error) {
    console.error('Exception in checkSystemHealth:', error);
    return {
      healthy: false,
      message: 'Health check failed',
      error: error.message
    };
  }
}

export default logDualWrite;
