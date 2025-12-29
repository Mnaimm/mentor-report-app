// scripts/lib/supabase-client.js
// Reusable Supabase client for scripts

const { createClient } = require('@supabase/supabase-js');

/**
 * Create an authenticated Supabase client with service role privileges
 * @returns {Object} Supabase client instance
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable not found');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not found');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabase;
}

/**
 * Upsert a single record into a table
 * @param {Object} supabase - Supabase client
 * @param {string} tableName - Table to upsert into
 * @param {Object} data - Data to upsert
 * @param {string[]} conflictColumns - Columns to check for conflicts (e.g., ['email'])
 * @returns {Promise<{success: boolean, data: Object|null, error: Object|null, isNew: boolean}>}
 */
async function upsertRecord(supabase, tableName, data, conflictColumns = ['email']) {
  try {
    // First, try to find existing record
    let query = supabase.from(tableName).select('*');

    conflictColumns.forEach(col => {
      query = query.eq(col, data[col]);
    });

    const { data: existing, error: selectError } = await query.maybeSingle();

    if (selectError) {
      return { success: false, data: null, error: selectError, isNew: false };
    }

    // If record exists, update it
    if (existing) {
      const { data: result, error: updateError } = await supabase
        .from(tableName)
        .update(data)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        return { success: false, data: null, error: updateError, isNew: false };
      }

      return { success: true, data: result, error: null, isNew: false };
    }

    // Otherwise, insert new record
    const { data: result, error: insertError } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();

    if (insertError) {
      return { success: false, data: null, error: insertError, isNew: true };
    }

    return { success: true, data: result, error: null, isNew: true };

  } catch (err) {
    return { success: false, data: null, error: err, isNew: false };
  }
}

/**
 * Log a data discrepancy to the dual_write_logs table
 * @param {Object} supabase - Supabase client
 * @param {Object} discrepancy - Discrepancy details
 * @returns {Promise<boolean>}
 */
async function logDiscrepancy(supabase, discrepancy) {
  try {
    const logEntry = {
      operation_type: discrepancy.operation_type || 'sync',
      table_name: discrepancy.table_name || 'unknown',
      record_id: discrepancy.record_id || null,
      program: discrepancy.program || null,
      user_email: discrepancy.user_email || 'system@sync',
      sheets_success: discrepancy.sheets_success || false,
      sheets_error: discrepancy.sheets_error || null,
      supabase_success: discrepancy.supabase_success || false,
      supabase_error: discrepancy.supabase_error || null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('dual_write_logs')
      .insert(logEntry);

    if (error) {
      console.error('❌ Failed to log discrepancy:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Error logging discrepancy:', err.message);
    return false;
  }
}

module.exports = {
  createSupabaseClient,
  upsertRecord,
  logDiscrepancy
};
