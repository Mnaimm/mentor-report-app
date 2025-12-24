/**
 * API Endpoint: POST /api/monitoring/compare-now
 *
 * Trigger a manual comparison between Google Sheets and Supabase
 *
 * Request body:
 * {
 *   table: 'reports',         // Optional: specific table to compare
 *   batch: 'Batch 5 Bangkit', // Optional: specific batch to compare
 *   program: 'Bangkit'        // Optional: specific program to compare
 * }
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, batch, program } = req.body;

    // Check if a comparison is already running
    const runningComparison = await checkRunningComparison();
    if (runningComparison) {
      return res.status(409).json({
        error: 'Comparison already running',
        message: 'Please wait for the current comparison to complete'
      });
    }

    // Start comparison (this would call the comparison script)
    // For now, we'll simulate it with a quick check
    const result = await performComparison({ table, batch, program });

    return res.status(200).json({
      success: true,
      result,
      message: 'Comparison completed successfully'
    });

  } catch (error) {
    console.error('Error in compare-now API:', error);
    return res.status(500).json({
      error: 'Comparison failed',
      message: error.message
    });
  }
}

/**
 * Check if a comparison is currently running
 */
async function checkRunningComparison() {
  // Check for recent comparison logs (within last 5 minutes)
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const { data, error } = await supabase
    .from('dual_write_logs')
    .select('id')
    .eq('operation_type', 'COMPARE')
    .gte('timestamp', fiveMinutesAgo.toISOString())
    .limit(1);

  return data && data.length > 0;
}

/**
 * Perform the actual comparison
 *
 * In production, this would:
 * 1. Fetch data from Google Sheets
 * 2. Fetch data from Supabase
 * 3. Compare field-by-field
 * 4. Log discrepancies to data_discrepancies table
 * 5. Return summary
 *
 * For now, it's a placeholder that does a quick check
 */
async function performComparison({ table, batch, program }) {
  const startTime = Date.now();

  // Log the comparison start
  await supabase.from('dual_write_logs').insert({
    operation_type: 'COMPARE',
    table_name: table || 'all',
    sheets_success: true,
    supabase_success: true,
    batch_name: batch || null,
    program: program || null,
    metadata: {
      comparison_started_at: new Date().toISOString(),
      comparison_type: 'manual'
    },
    timestamp: new Date().toISOString()
  });

  // Simulate comparison (in production, call the actual comparison script)
  await new Promise(resolve => setTimeout(resolve, 1000));

  const duration = Date.now() - startTime;

  // Get current discrepancy count
  const { data: discrepancies } = await supabase
    .from('data_discrepancies')
    .select('id')
    .eq('resolved', false);

  const result = {
    duration_ms: duration,
    tables_compared: table ? [table] : ['all'],
    total_records_compared: 0, // Would be calculated in actual comparison
    discrepancies_found: discrepancies?.length || 0,
    timestamp: new Date().toISOString(),
    status: 'completed'
  };

  return result;
}
