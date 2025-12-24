/**
 * API Endpoint: GET/POST /api/monitoring/discrepancies
 *
 * GET: Fetch data discrepancies
 * POST: Mark discrepancy as resolved
 *
 * Query params (GET):
 * - resolved: 'true' | 'false' | 'all' (default: 'false')
 * - table: filter by table name
 * - severity: filter by severity (low, medium, high, critical)
 * - limit: number of records (default: 50)
 *
 * Request body (POST):
 * {
 *   id: 'uuid',
 *   resolved: true,
 *   resolvedBy: 'admin@email.com',
 *   notes: 'Fixed by manual sync'
 * }
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
      resolved = 'false',
      table,
      severity,
      limit = '50'
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit), 200);

    // Build query
    let query = supabase
      .from('data_discrepancies')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(parsedLimit);

    // Apply filters
    if (resolved !== 'all') {
      query = query.eq('resolved', resolved === 'true');
    }

    if (table) {
      query = query.eq('table_name', table);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Get counts by severity for unresolved
    const { data: counts } = await supabase
      .from('data_discrepancies')
      .select('severity')
      .eq('resolved', false);

    const severityCounts = {
      low: counts?.filter(c => c.severity === 'low').length || 0,
      medium: counts?.filter(c => c.severity === 'medium').length || 0,
      high: counts?.filter(c => c.severity === 'high').length || 0,
      critical: counts?.filter(c => c.severity === 'critical').length || 0
    };

    return res.status(200).json({
      discrepancies: data || [],
      total: data?.length || 0,
      severityCounts
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
 * POST handler - Update discrepancy status
 */
async function handlePost(req, res) {
  try {
    const { id, resolved, resolvedBy, notes } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing discrepancy ID' });
    }

    const updateData = {
      resolved: resolved === true,
      updated_at: new Date().toISOString()
    };

    if (resolved) {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = resolvedBy || null;
      updateData.resolution_notes = notes || null;
    }

    const { data, error } = await supabase
      .from('data_discrepancies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      discrepancy: data,
      message: resolved ? 'Discrepancy marked as resolved' : 'Discrepancy updated'
    });

  } catch (error) {
    console.error('Error in discrepancies POST:', error);
    return res.status(500).json({
      error: 'Failed to update discrepancy',
      message: error.message
    });
  }
}
