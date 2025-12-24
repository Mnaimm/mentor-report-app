/**
 * API Endpoint: GET /api/monitoring/stats
 *
 * Get monitoring statistics for the dashboard
 *
 * Query params:
 * - period: 'today' | 'week' | 'month' (default: 'today')
 * - type: 'hourly' | 'daily' (default: 'hourly')
 */

import { createClient } from '@supabase/supabase-js';
import { getLatestMetrics, getMetricsForRange } from '@/lib/monitoring/metrics-aggregator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { period = 'today', type = 'hourly' } = req.query;

    let stats;

    if (period === 'today') {
      // Get today's summary from view
      const { data, error } = await supabase
        .from('todays_summary')
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      stats = {
        period: 'today',
        summary: data,
        hourlyBreakdown: await getLatestMetrics('hourly', 24)
      };

    } else if (period === 'week') {
      // Get last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const metrics = await getMetricsForRange(startDate, endDate, type);

      stats = {
        period: 'week',
        type,
        metrics,
        summary: calculateSummary(metrics)
      };

    } else if (period === 'month') {
      // Get last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const metrics = await getMetricsForRange(startDate, endDate, 'daily');

      stats = {
        period: 'month',
        type: 'daily',
        metrics,
        summary: calculateSummary(metrics)
      };

    } else {
      return res.status(400).json({
        error: 'Invalid period',
        validPeriods: ['today', 'week', 'month']
      });
    }

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Error in stats API:', error);
    return res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
}

/**
 * Calculate summary from metrics array
 */
function calculateSummary(metrics) {
  if (!metrics || metrics.length === 0) {
    return {
      totalOperations: 0,
      avgSheetsSuccessRate: 0,
      avgSupabaseSuccessRate: 0,
      avgBothSuccessRate: 0,
      totalErrors: 0
    };
  }

  const totalOps = metrics.reduce((sum, m) => sum + (m.total_operations || 0), 0);
  const totalErrors = metrics.reduce((sum, m) => sum + (m.total_error_count || 0), 0);

  // Calculate weighted average success rates
  const avgSheetsSuccessRate = metrics.reduce((sum, m) => {
    return sum + (m.sheets_success_rate || 0) * (m.total_operations || 0);
  }, 0) / (totalOps || 1);

  const avgSupabaseSuccessRate = metrics.reduce((sum, m) => {
    return sum + (m.supabase_success_rate || 0) * (m.total_operations || 0);
  }, 0) / (totalOps || 1);

  const avgBothSuccessRate = metrics.reduce((sum, m) => {
    return sum + (m.both_success_rate || 0) * (m.total_operations || 0);
  }, 0) / (totalOps || 1);

  return {
    totalOperations: totalOps,
    avgSheetsSuccessRate: parseFloat(avgSheetsSuccessRate.toFixed(2)),
    avgSupabaseSuccessRate: parseFloat(avgSupabaseSuccessRate.toFixed(2)),
    avgBothSuccessRate: parseFloat(avgBothSuccessRate.toFixed(2)),
    totalErrors
  };
}
