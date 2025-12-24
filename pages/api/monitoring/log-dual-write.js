/**
 * API Endpoint: POST /api/monitoring/log-dual-write
 *
 * Logs a dual-write operation to the monitoring system
 *
 * Request body:
 * {
 *   operation: 'INSERT',
 *   table: 'reports',
 *   recordId: '123',
 *   sheetsResult: { success: true, duration: 1200, error: null },
 *   supabaseResult: { success: true, duration: 450, error: null },
 *   user: 'mentor@email.com',
 *   batch: 'Batch 5 Bangkit',
 *   program: 'Bangkit',
 *   metadata: { ... }
 * }
 */

import { logDualWrite } from '@/lib/monitoring/dual-write-logger';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      operation,
      table,
      recordId,
      sheetsResult,
      supabaseResult,
      user,
      batch,
      program,
      metadata
    } = req.body;

    // Validate required fields
    if (!operation || !table) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['operation', 'table']
      });
    }

    if (!sheetsResult || !supabaseResult) {
      return res.status(400).json({
        error: 'Missing result objects',
        required: ['sheetsResult', 'supabaseResult']
      });
    }

    // Log the dual-write operation
    const result = await logDualWrite({
      operation,
      table,
      recordId,
      sheetsResult,
      supabaseResult,
      user,
      batch,
      program,
      metadata
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to log dual-write',
        details: result.error
      });
    }

    return res.status(200).json({
      success: true,
      logId: result.logId,
      message: 'Dual-write logged successfully'
    });

  } catch (error) {
    console.error('Error in log-dual-write API:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
