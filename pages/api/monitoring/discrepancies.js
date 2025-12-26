/**
 * API Endpoint: GET /api/monitoring/discrepancies
 *
 * GET: Fetch data discrepancies from view
 *
 * Query params (GET):
 * - table: filter by table name
 * - discrepancy_type: filter by discrepancy type
 * - limit: number of records (default: 50, max: 200)
 *
 * View columns:
 * - id, operation_type, table_name, record_id, program
 * - user_email, created_at, discrepancy_type
 * - sheets_error, supabase_error
 *
 * Note: This is a read-only view. POST is not supported.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET handler - Fetch discrepancies
 */
async function handleGet(req, res) {
  try {
    const {
      table,
      discrepancy_type,
      limit = '50'
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit), 200);

    // Build query - view columns: id, operation_type, table_name, record_id,
    // program, user_email, created_at, discrepancy_type, sheets_error, supabase_error
    let query = supabase
      .from('data_discrepancies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parsedLimit);

    // Apply filters based on actual view columns
    if (table) {
      query = query.eq('table_name', table);
    }

    if (discrepancy_type) {
      query = query.eq('discrepancy_type', discrepancy_type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Get counts by discrepancy type
    const { data: counts } = await supabase
      .from('data_discrepancies')
      .select('discrepancy_type');

    const typeCounts = {};
    counts?.forEach(c => {
      const type = c.discrepancy_type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return res.status(200).json({
      discrepancies: data || [],
      total: data?.length || 0,
      typeCounts
    });

  } catch (error) {
    console.error('Error in discrepancies GET:', error);
    return res.status(500).json({
      error: 'Failed to fetch discrepancies',
      message: error.message
    });
  }
}

/**
 * POST handler - Not supported (view is read-only)
 */
async function handlePost(req, res) {
  return res.status(405).json({
    error: 'POST not supported',
    message: 'data_discrepancies is a read-only view. Discrepancies are auto-detected and cannot be manually updated.'
  });
}
