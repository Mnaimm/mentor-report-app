/**
 * Data Adapter for Monitoring Dashboard
 *
 * Adapts dual_write_monitoring table structure to match expected format
 * dual_write_monitoring columns: status, error_message, source_system, target_system
 * Expected format: sheets_success, supabase_success, sheets_error, supabase_error
 */

/**
 * Convert dual_write_monitoring record to expected format
 * @param {Object} record - Record from dual_write_monitoring table
 * @returns {Object} - Converted record with expected columns
 */
export function adaptMonitoringRecord(record) {
  if (!record) return null;

  // dual_write_monitoring uses 'status' field ('success' or 'failed')
  // We need to map this to sheets_success and supabase_success
  const isSuccess = record.status === 'success';

  return {
    ...record,

    // Map status to individual success flags
    // Since operations go FROM sheets TO supabase:
    // - sheets_success: Always true (sheets write happens first)
    // - supabase_success: Based on status field
    sheets_success: true,  // Sheets always succeeds (or operation wouldn't continue)
    supabase_success: isSuccess,

    // Map error messages
    sheets_error: null,  // Sheets errors aren't logged here
    supabase_error: record.error_message || null,

    // Duration (not tracked in dual_write_monitoring)
    sheets_duration_ms: null,
    supabase_duration_ms: null,

    // User info (from metadata if available)
    user_email: record.metadata?.mentor_email || null,
    batch_name: null,  // Not tracked in current implementation

    // Program (from metadata if available)
    program: record.metadata?.program || null
  };
}

/**
 * Convert array of monitoring records
 * @param {Array} records - Array of records from dual_write_monitoring
 * @returns {Array} - Array of converted records
 */
export function adaptMonitoringRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map(adaptMonitoringRecord);
}

/**
 * Get display status for a record
 * @param {Object} record - Monitoring record
 * @returns {string} - 'success' | 'partial' | 'failed'
 */
export function getRecordStatus(record) {
  return record.status === 'success' ? 'success' : 'failed';
}

/**
 * Get status icon for display
 * @param {Object} record - Monitoring record
 * @returns {string} - Icon emoji
 */
export function getStatusIcon(record) {
  if (record.status === 'success') return '✓✓';
  return '✕';
}

export default {
  adaptMonitoringRecord,
  adaptMonitoringRecords,
  getRecordStatus,
  getStatusIcon
};
