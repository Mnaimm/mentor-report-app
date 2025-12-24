/**
 * Error Formatter
 *
 * Formats errors for logging, ensuring consistent structure
 * and sanitizing sensitive information
 */

/**
 * Format an error object for logging
 *
 * @param {Error|string|Object} error - Error to format
 * @param {number} maxLength - Maximum length of formatted error (default: 1000)
 * @returns {string} - Formatted error message
 */
export function formatError(error, maxLength = 1000) {
  if (!error) return null;

  try {
    let formatted = '';

    // Handle different error types
    if (error instanceof Error) {
      // Standard Error object
      formatted = `${error.name}: ${error.message}`;

      // Add stack trace in development
      if (process.env.NODE_ENV === 'development' && error.stack) {
        formatted += `\n${error.stack}`;
      }
    } else if (typeof error === 'string') {
      // String error
      formatted = error;
    } else if (error && typeof error === 'object') {
      // Object error (like from API responses)
      formatted = JSON.stringify(error, null, 2);
    } else {
      // Unknown type
      formatted = String(error);
    }

    // Sanitize sensitive information
    formatted = sanitizeError(formatted);

    // Truncate if too long
    if (formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength) + '... (truncated)';
    }

    return formatted;

  } catch (err) {
    console.error('Failed to format error:', err);
    return 'Error formatting failed';
  }
}

/**
 * Sanitize error messages to remove sensitive data
 *
 * @param {string} errorString - Error string to sanitize
 * @returns {string} - Sanitized error string
 */
function sanitizeError(errorString) {
  if (!errorString) return errorString;

  let sanitized = errorString;

  // Remove email addresses
  sanitized = sanitized.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL_REDACTED]');

  // Remove API keys/tokens (common patterns)
  sanitized = sanitized.replace(/(api[_-]?key|token|secret|password)["\s:=]+([^\s"',}]+)/gi, '$1=[REDACTED]');

  // Remove bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[^\s"',}]+/gi, 'Bearer [REDACTED]');

  // Remove Google credentials
  sanitized = sanitized.replace(/"private_key":\s*"[^"]+"/gi, '"private_key": "[REDACTED]"');
  sanitized = sanitized.replace(/"client_email":\s*"[^"]+"/gi, '"client_email": "[REDACTED]"');

  // Remove file paths (optional, but good for security)
  sanitized = sanitized.replace(/([A-Z]:\\[\w\s\-\\]+)/gi, '[PATH_REDACTED]');
  sanitized = sanitized.replace(/(\/[\w\s\-\/]+\.[\w]+)/gi, '[PATH_REDACTED]');

  return sanitized;
}

/**
 * Extract useful debug info from error
 *
 * @param {Error} error - Error object
 * @returns {Object} - Debug information
 */
export function extractDebugInfo(error) {
  if (!error) return {};

  const debug = {
    message: error.message || String(error),
    type: error.name || typeof error,
    timestamp: new Date().toISOString()
  };

  // Add HTTP status if available
  if (error.status || error.statusCode) {
    debug.httpStatus = error.status || error.statusCode;
  }

  // Add error code if available
  if (error.code) {
    debug.code = error.code;
  }

  // Add response data if available (from Axios/Fetch errors)
  if (error.response && error.response.data) {
    debug.responseData = sanitizeError(JSON.stringify(error.response.data));
  }

  // Add Supabase-specific error info
  if (error.details) {
    debug.details = error.details;
  }
  if (error.hint) {
    debug.hint = error.hint;
  }

  return debug;
}

/**
 * Check if error is critical (requires immediate attention)
 *
 * @param {Error|Object} error - Error to check
 * @returns {boolean} - True if critical
 */
export function isCriticalError(error) {
  if (!error) return false;

  const criticalPatterns = [
    'database connection',
    'authentication failed',
    'permission denied',
    'out of memory',
    'disk full',
    'network unreachable',
    'timeout',
    'ECONNREFUSED',
    'ENOTFOUND'
  ];

  const errorString = formatError(error).toLowerCase();

  return criticalPatterns.some(pattern => errorString.includes(pattern));
}

/**
 * Categorize error type
 *
 * @param {Error|Object} error - Error to categorize
 * @returns {string} - Error category
 */
export function categorizeError(error) {
  if (!error) return 'unknown';

  const errorString = formatError(error).toLowerCase();

  if (errorString.includes('network') || errorString.includes('econnrefused') || errorString.includes('timeout')) {
    return 'network';
  }
  if (errorString.includes('auth') || errorString.includes('permission') || errorString.includes('unauthorized')) {
    return 'authentication';
  }
  if (errorString.includes('validation') || errorString.includes('invalid')) {
    return 'validation';
  }
  if (errorString.includes('database') || errorString.includes('sql') || errorString.includes('postgres')) {
    return 'database';
  }
  if (errorString.includes('not found') || errorString.includes('404')) {
    return 'not_found';
  }
  if (errorString.includes('duplicate') || errorString.includes('unique constraint')) {
    return 'duplicate';
  }

  return 'application';
}

/**
 * Create a user-friendly error message
 *
 * @param {Error|Object} error - Error object
 * @returns {string} - User-friendly message
 */
export function getUserFriendlyMessage(error) {
  const category = categorizeError(error);

  const messages = {
    network: 'Unable to connect to the server. Please check your internet connection.',
    authentication: 'Authentication failed. Please log in again.',
    validation: 'The data you entered is invalid. Please check and try again.',
    database: 'A database error occurred. Please try again later.',
    not_found: 'The requested resource was not found.',
    duplicate: 'This record already exists.',
    application: 'An unexpected error occurred. Please try again.',
    unknown: 'Something went wrong. Please try again.'
  };

  return messages[category] || messages.unknown;
}

export default formatError;
