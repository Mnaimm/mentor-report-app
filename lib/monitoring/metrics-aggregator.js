/**
 * Metrics Aggregator
 *
 * Aggregates dual-write logs into system health metrics
 * Called periodically (hourly/daily) to update dashboard stats
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Calculate and store hourly metrics
 *
 * @param {Date} targetDate - Date to calculate metrics for (default: now)
 * @param {number} targetHour - Hour to calculate (0-23, default: current hour)
 * @returns {Promise<Object>} - Calculated metrics
 */
export async function calculateHourlyMetrics(targetDate = new Date(), targetHour = null) {
  try {
    const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const hour = targetHour !== null ? targetHour : date.getHours();

    // Use the SQL function to calculate metrics
    const { data, error } = await supabase.rpc('calculate_hourly_metrics', {
      target_date: date.toISOString().split('T')[0],
      target_hour: hour
    });

    if (error) {
      console.error('❌ Failed to calculate hourly metrics:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Calculated hourly metrics for ${date.toISOString().split('T')[0]} hour ${hour}`);
    return { success: true, data };

  } catch (error) {
    console.error('❌ Exception in calculateHourlyMetrics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate daily metrics (aggregates all hours for a day)
 *
 * @param {Date} targetDate - Date to calculate metrics for
 * @returns {Promise<Object>} - Calculated metrics
 */
export async function calculateDailyMetrics(targetDate = new Date()) {
  try {
    const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const dateString = date.toISOString().split('T')[0];

    // Get all hourly logs for the day
    const { data: logs, error: logsError } = await supabase
      .from('dual_write_logs')
      .select('*')
      .gte('timestamp', `${dateString}T00:00:00`)
      .lt('timestamp', `${dateString}T23:59:59`);

    if (logsError) {
      console.error('Failed to fetch daily logs:', logsError);
      return { success: false, error: logsError.message };
    }

    // Aggregate metrics
    const metrics = aggregateLogs(logs || []);

    // Store in database
    const { data, error } = await supabase
      .from('system_health_metrics')
      .upsert({
        metric_date: dateString,
        metric_hour: null,
        period_type: 'daily',
        ...metrics,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'metric_date,metric_hour,period_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store daily metrics:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Calculated daily metrics for ${dateString}`);
    return { success: true, data };

  } catch (error) {
    console.error('Exception in calculateDailyMetrics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggregate logs into metrics
 *
 * @param {Array} logs - Array of dual_write_logs
 * @returns {Object} - Aggregated metrics
 */
function aggregateLogs(logs) {
  if (!logs || logs.length === 0) {
    return {
      total_operations: 0,
      sheets_success_count: 0,
      supabase_success_count: 0,
      both_success_count: 0,
      sheets_only_success_count: 0,
      supabase_only_success_count: 0,
      both_failed_count: 0,
      avg_sheets_duration_ms: null,
      avg_supabase_duration_ms: null,
      max_sheets_duration_ms: null,
      max_supabase_duration_ms: null,
      min_sheets_duration_ms: null,
      min_supabase_duration_ms: null,
      sheets_success_rate: 0,
      supabase_success_rate: 0,
      both_success_rate: 0,
      discrepancy_count: 0,
      total_error_count: 0,
      sheets_error_count: 0,
      supabase_error_count: 0
    };
  }

  const total = logs.length;
  const sheetsSuccess = logs.filter(l => l.sheets_success).length;
  const supabaseSuccess = logs.filter(l => l.supabase_success).length;
  const bothSuccess = logs.filter(l => l.sheets_success && l.supabase_success).length;
  const sheetsOnly = logs.filter(l => l.sheets_success && !l.supabase_success).length;
  const supabaseOnly = logs.filter(l => !l.sheets_success && l.supabase_success).length;
  const bothFailed = logs.filter(l => !l.sheets_success && !l.supabase_success).length;

  const sheetsDurations = logs.map(l => l.sheets_duration_ms).filter(d => d !== null);
  const supabaseDurations = logs.map(l => l.supabase_duration_ms).filter(d => d !== null);

  const sheetsErrors = logs.filter(l => l.sheets_error !== null).length;
  const supabaseErrors = logs.filter(l => l.supabase_error !== null).length;

  return {
    total_operations: total,
    sheets_success_count: sheetsSuccess,
    supabase_success_count: supabaseSuccess,
    both_success_count: bothSuccess,
    sheets_only_success_count: sheetsOnly,
    supabase_only_success_count: supabaseOnly,
    both_failed_count: bothFailed,

    avg_sheets_duration_ms: sheetsDurations.length > 0
      ? Math.round(sheetsDurations.reduce((a, b) => a + b, 0) / sheetsDurations.length)
      : null,
    avg_supabase_duration_ms: supabaseDurations.length > 0
      ? Math.round(supabaseDurations.reduce((a, b) => a + b, 0) / supabaseDurations.length)
      : null,

    max_sheets_duration_ms: sheetsDurations.length > 0 ? Math.max(...sheetsDurations) : null,
    max_supabase_duration_ms: supabaseDurations.length > 0 ? Math.max(...supabaseDurations) : null,
    min_sheets_duration_ms: sheetsDurations.length > 0 ? Math.min(...sheetsDurations) : null,
    min_supabase_duration_ms: supabaseDurations.length > 0 ? Math.min(...supabaseDurations) : null,

    sheets_success_rate: total > 0 ? parseFloat(((sheetsSuccess / total) * 100).toFixed(2)) : 0,
    supabase_success_rate: total > 0 ? parseFloat(((supabaseSuccess / total) * 100).toFixed(2)) : 0,
    both_success_rate: total > 0 ? parseFloat(((bothSuccess / total) * 100).toFixed(2)) : 0,

    discrepancy_count: sheetsOnly + supabaseOnly,

    total_error_count: sheetsErrors + supabaseErrors,
    sheets_error_count: sheetsErrors,
    supabase_error_count: supabaseErrors
  };
}

/**
 * Get metrics for a date range
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} periodType - 'hourly' or 'daily'
 * @returns {Promise<Array>} - Array of metrics
 */
export async function getMetricsForRange(startDate, endDate, periodType = 'daily') {
  try {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);

    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('*')
      .eq('period_type', periodType)
      .gte('metric_date', start.toISOString().split('T')[0])
      .lte('metric_date', end.toISOString().split('T')[0])
      .order('metric_date', { ascending: true })
      .order('metric_hour', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Failed to get metrics for range:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Exception in getMetricsForRange:', error);
    return [];
  }
}

/**
 * Get latest metrics
 *
 * @param {string} periodType - 'hourly' or 'daily'
 * @param {number} limit - Number of records to fetch
 * @returns {Promise<Array>} - Array of metrics
 */
export async function getLatestMetrics(periodType = 'hourly', limit = 24) {
  try {
    const { data, error } = await supabase
      .from('system_health_metrics')
      .select('*')
      .eq('period_type', periodType)
      .order('metric_date', { ascending: false })
      .order('metric_hour', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get latest metrics:', error);
      return [];
    }

    return (data || []).reverse(); // Return in chronological order

  } catch (error) {
    console.error('Exception in getLatestMetrics:', error);
    return [];
  }
}

/**
 * Calculate metrics for current hour (use this in a cron job)
 *
 * @returns {Promise<Object>} - Result
 */
export async function updateCurrentHourMetrics() {
  const now = new Date();
  return calculateHourlyMetrics(now, now.getHours());
}

/**
 * Calculate metrics for yesterday (use this in a nightly cron job)
 *
 * @returns {Promise<Object>} - Result
 */
export async function updateYesterdayMetrics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return calculateDailyMetrics(yesterday);
}

export default {
  calculateHourlyMetrics,
  calculateDailyMetrics,
  getMetricsForRange,
  getLatestMetrics,
  updateCurrentHourMetrics,
  updateYesterdayMetrics
};
