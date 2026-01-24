/** 99_ErrorHandler.gs **/

/**
 * Centralized error handling and logging system
 * Provides consistent error logging, admin notifications, and recovery strategies
 */

/**
 * Initialize error tracking sheet on setup
 */
function ensureErrorTrackingSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp',
    'Error Type',
    'Function',
    'Message',
    'Stack Trace',
    'Resolved',
    'Resolution Date',
    'Admin Notes'
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ERROR_LOG, headers);
}

/**
 * Log an error to the error tracking sheet
 * @param {Error} error - The error object
 * @param {string} functionName - Name of the function where error occurred
 * @param {object} context - Additional context data
 */
function logError_(error, functionName, context) {
  try {
    const timestamp = now_();
    const errorType = error.constructor.name || 'UnknownError';
    const message = String(error.message || error);
    const stackTrace = String(error.stack || '');

    Logger.log(`[ERROR] ${functionName}: ${message}`);

    // Append to error log sheet
    const errorSheet = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const contextStr = context ? JSON.stringify(context) : '';
    
    errorSheet.appendRow([
      fmtDate_(timestamp, CONFIG.DATE_FORMAT),
      errorType,
      functionName,
      message,
      stackTrace.substring(0, 500), // Truncate to avoid sheet cell limits
      false,
      '',
      contextStr
    ]);
  } catch (logErr) {
    // Fallback to console if logging fails
    Logger.log(`[CRITICAL] Error logging failed: ${logErr.message}`);
  }
}

/**
 * Send error notification to admin
 * @param {Error} error - The error object
 * @param {string} functionName - Function where error occurred
 * @param {string} severity - 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
 */
function notifyAdminOfError_(error, functionName, severity) {
  try {
    // Only send critical errors to avoid email spam
    if (severity !== 'CRITICAL') return;

    const adminEmail = getAdminEmail_();
    if (!adminEmail) return;

    const subject = `🚨 [CRITICAL] Poster System Error: ${functionName}`;
    const body = `
ERROR DETAILS:
==============
Function: ${functionName}
Error Type: ${error.constructor.name || 'Unknown'}
Message: ${error.message || error}
Timestamp: ${new Date()}
Branch: beta-1.01

STACK TRACE:
============
${error.stack || 'No stack trace available'}

Please check the Error Log sheet in the spreadsheet for more details.

This is an automated notification from the Poster Request System.
    `.trim();

    GmailApp.sendEmail(adminEmail, subject, body);
  } catch (emailErr) {
    Logger.log(`[ERROR] Failed to send admin notification: ${emailErr.message}`);
  }
}

/**
 * Retry function with exponential backoff for transient failures
 * @param {function} fn - Function to retry
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} initialDelayMs - Initial delay in milliseconds
 * @returns {*} Result of function or null if all retries failed
 */
function retryWithBackoff_(fn, maxAttempts = 3, initialDelayMs = 500) {
  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxAttempts;
      const isTransient = isTransientError_(err);

      if (isLastAttempt || !isTransient) {
        throw err;
      }

      Logger.log(`[RETRY] Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms...`);
      Utilities.sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError;
}

/**
 * Check if an error is transient (can be retried)
 * @param {Error} error
 * @returns {boolean}
 */
function isTransientError_(error) {
  const message = String(error.message || error).toLowerCase();
  
  // Lock timeout errors
  if (message.includes('timeout') || message.includes('lock')) return true;
  
  // Service temporarily unavailable
  if (message.includes('temporarily unavailable')) return true;
  
  // Rate limiting (429)
  if (message.includes('429') || message.includes('too many requests')) return true;
  
  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true;

  return false;
}

/**
 * Safe wrapper for form operations with error handling
 * @param {function} fn - Function to execute
 * @param {string} operationName - Name for logging
 * @returns {*} Result or null if error
 */
function safeFormOperation_(fn, operationName) {
  try {
    return fn();
  } catch (err) {
    logError_(err, `safeFormOperation[${operationName}]`, { operation: operationName });
    Logger.log(`[WARN] Form operation failed: ${operationName}`);
    return null;
  }
}

/**
 * Safe wrapper for sheet operations with error handling
 * @param {function} fn - Function to execute
 * @param {string} operationName - Name for logging
 * @returns {*} Result or null if error
 */
function safeSheetOperation_(fn, operationName) {
  try {
    return fn();
  } catch (err) {
    logError_(err, `safeSheetOperation[${operationName}]`, { operation: operationName });
    Logger.log(`[WARN] Sheet operation failed: ${operationName}`);
    return null;
  }
}

/**
 * Get admin email from properties
 * @returns {string}
 */
function getAdminEmail_() {
  // Try to get from config or script properties
  return String(CONFIG.ADMIN_EMAIL || getProps_().getProperty('ADMIN_EMAIL') || '').trim();
}

/**
 * Clear resolved errors from log (keeps last 90 days of errors)
 */
function cleanupErrorLog_() {
  try {
    const errorSheet = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const data = getNonEmptyData_(errorSheet, 8);
    if (data.length === 0) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Mark very old errors as archived (don't delete)
    data.forEach((row, idx) => {
      const rowNum = idx + 2; // Account for header
      const dateStr = row[0];
      try {
        const date = new Date(dateStr);
        if (date < ninetyDaysAgo) {
          // Just mark as old, don't delete
          Logger.log(`[ARCHIVE] Old error from ${dateStr}`);
        }
      } catch (e) {
        // Skip if date parsing fails
      }
    });
  } catch (err) {
    Logger.log(`[WARN] Error log cleanup failed: ${err.message}`);
  }
}
