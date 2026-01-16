/**
 * API Endpoint: GET /api/monitoring/recent-operations
 *
 * Get recent dual-write operations
 *
 * Query params:
 * - limit: number of operations to fetch (default: 50, max: 200)
 * - offset: pagination offset (default: 0)
 * - table: filter by table name
 * - user: filter by user email
 * - batch: filter by batch name
 * - operation: filter by operation type
 * - failuresOnly: boolean (default: false)
 */

import { getRecentLogs } from '@/lib/monitoring/dual-write-logger';
import { adaptMonitoringRecords } from '@/lib/monitoring/data-adapter';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      limit = '50',
      offset = '0',
      table,
      user,
      batch,
      operation,
      failuresOnly = 'false'
    } = req.query;

    // Parse and validate limit
    const parsedLimit = Math.min(parseInt(limit), 200);
    const parsedOffset = parseInt(offset);

    // Build filters
    const filters = {};
    if (table) filters.table = table;
    if (user) filters.user = user;
    if (batch) filters.batch = batch;
    if (operation) filters.operation = operation;
    if (failuresOnly === 'true') filters.failuresOnly = true;

    // Get logs
    const logs = await getRecentLogs(parsedLimit, filters);

    // Adapt records to expected format
    const adaptedLogs = adaptMonitoringRecords(logs);

    // Apply offset (simple pagination)
    const paginatedLogs = adaptedLogs.slice(parsedOffset, parsedOffset + parsedLimit);

    return res.status(200).json({
      operations: paginatedLogs,
      total: logs.length,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: logs.length > (parsedOffset + parsedLimit)
    });

  } catch (error) {
    console.error('Error in recent-operations API:', error);
    return res.status(500).json({
      error: 'Failed to fetch operations',
      message: error.message
    });
  }
}
