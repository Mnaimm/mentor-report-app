/**
 * API Endpoint: GET /api/monitoring/health
 *
 * System health check
 * Checks connectivity to both Google Sheets and Supabase
 * Returns overall system status
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { checkSystemHealth } from '@/lib/monitoring/dual-write-logger';

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
    const startTime = Date.now();

    // Check Supabase connectivity
    const supabaseHealth = await checkSupabaseHealth();

    // Check Google Sheets connectivity
    const sheetsHealth = await checkSheetsHealth();

    // Check system metrics
    const metricsHealth = await checkSystemHealth();

    const duration = Date.now() - startTime;

    // Determine overall status
    const allHealthy = supabaseHealth.healthy && sheetsHealth.healthy && metricsHealth.healthy;
    const status = allHealthy ? 'healthy' : 'degraded';
    const statusCode = allHealthy ? 200 : 503;

    const response = {
      status,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      checks: {
        supabase: supabaseHealth,
        sheets: sheetsHealth,
        metrics: metricsHealth
      },
      summary: {
        healthy: allHealthy,
        message: allHealthy
          ? 'All systems operational'
          : 'One or more systems are experiencing issues'
      }
    };

    return res.status(statusCode).json(response);

  } catch (error) {
    console.error('Error in health check API:', error);
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    });
  }
}

/**
 * Check Supabase connectivity and performance
 */
async function checkSupabaseHealth() {
  const startTime = Date.now();

  try {
    // Simple query to check connectivity
    const { data, error } = await supabase
      .from('dual_write_logs')
      .select('id')
      .limit(1);

    const duration = Date.now() - startTime;

    if (error) {
      return {
        healthy: false,
        duration_ms: duration,
        error: error.message,
        message: 'Failed to connect to Supabase'
      };
    }

    return {
      healthy: true,
      duration_ms: duration,
      message: 'Supabase connection successful',
      performance: duration < 1000 ? 'good' : duration < 3000 ? 'acceptable' : 'slow'
    };

  } catch (error) {
    return {
      healthy: false,
      duration_ms: Date.now() - startTime,
      error: error.message,
      message: 'Supabase connection failed'
    };
  }
}

/**
 * Check Google Sheets connectivity
 */
async function checkSheetsHealth() {
  const startTime = Date.now();

  try {
    // Check if credentials are configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return {
        healthy: false,
        duration_ms: Date.now() - startTime,
        message: 'Google Sheets credentials not configured',
        error: 'Missing environment variables'
      };
    }

    // Try to initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Try a simple API call (list sheet metadata)
    const spreadsheetId = process.env.SHEET_ID || '1a0Q5pfjJQK79rx7GnTHkF60FE2DpJE-YbWrW8qEBtCw';
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,properties.title'
    });

    const duration = Date.now() - startTime;

    return {
      healthy: true,
      duration_ms: duration,
      message: 'Google Sheets connection successful',
      performance: duration < 2000 ? 'good' : duration < 5000 ? 'acceptable' : 'slow',
      spreadsheet: response.data?.properties?.title || 'Unknown'
    };

  } catch (error) {
    return {
      healthy: false,
      duration_ms: Date.now() - startTime,
      error: error.message,
      message: 'Google Sheets connection failed'
    };
  }
}
