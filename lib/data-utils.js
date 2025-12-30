/**
 * Data Utility Functions
 * Helper functions for data normalization and validation
 */

/**
 * Normalize boolean values from various formats
 * Supports: boolean, "TRUE", "true", "✓", "ya", "yes", "1"
 *
 * @param {*} value - The value to normalize
 * @returns {boolean} - Normalized boolean value
 *
 * @example
 * normalizeBoolean(true) // true
 * normalizeBoolean("TRUE") // true
 * normalizeBoolean("✓") // true
 * normalizeBoolean("ya") // true
 * normalizeBoolean("false") // false
 * normalizeBoolean("") // false
 */
export function normalizeBoolean(value) {
  // Already a boolean
  if (typeof value === 'boolean') return value;

  // Handle null/undefined
  if (value === null || value === undefined) return false;

  // Convert to string and normalize
  const str = String(value).trim().toLowerCase();

  // Check for truthy values
  return str === 'true' || str === '✓' || str === 'ya' || str === 'yes' || str === '1';
}

/**
 * Validate that a value is a valid array
 *
 * @param {*} value - The value to validate
 * @param {*} defaultValue - Default value if not an array (default: [])
 * @returns {Array} - Valid array or default value
 */
export function ensureArray(value, defaultValue = []) {
  return Array.isArray(value) ? value : defaultValue;
}

/**
 * Safely parse JSON string
 *
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails (default: null)
 * @returns {*} - Parsed JSON or default value
 */
export function safeJSONParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('JSON parse error:', err.message);
    return defaultValue;
  }
}

/**
 * Safely stringify JSON
 *
 * @param {*} value - Value to stringify
 * @param {string} defaultValue - Default value if stringify fails (default: '{}')
 * @returns {string} - JSON string or default value
 */
export function safeJSONStringify(value, defaultValue = '{}') {
  try {
    return JSON.stringify(value);
  } catch (err) {
    console.error('JSON stringify error:', err.message);
    return defaultValue;
  }
}
