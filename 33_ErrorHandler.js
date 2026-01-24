/** 33_ErrorHandler.js **/

/**
 * Centralized Error Handling & Recovery System
 * 
 * Provides centralized error logging, admin notifications on critical failures,
 * and automatic recovery for transient issues.
 */

/**
 * Log an error to the Error Log sheet with context and severity.
 * 
 * @param {Error} error - The error object
 * @param {string} functionName - Name of the function where error occurred
 * @param {string} context - Additional context about the error
 * @param {string} severity - Error severity: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
 * @returns {void}
 */
function logError_(error, functionName, context, severity = 'MEDIUM') {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const timestamp = now_();
    const errorType = error.name || 'Error';
    const errorMessage = error.message || String(error);
    const stackTrace = error.stack || '';
    
    const row = [];
    row[COLS.ERROR_LOG.TIMESTAMP - 1] = timestamp;
    row[COLS.ERROR_LOG.ERROR_TYPE - 1] = errorType;
    row[COLS.ERROR_LOG.FUNCTION_NAME - 1] = functionName;
    row[COLS.ERROR_LOG.ERROR_MESSAGE - 1] = errorMessage;
    row[COLS.ERROR_LOG.STACK_TRACE - 1] = stackTrace;
    row[COLS.ERROR_LOG.CONTEXT - 1] = context;
    row[COLS.ERROR_LOG.SEVERITY - 1] = severity;
    
    sh.appendRow(row);
    
    // Send admin notification for critical errors
    if (severity === 'CRITICAL') {
      sendCriticalErrorNotification_(functionName, errorMessage, context);
    }
  } catch (loggingError) {
    // Fallback to console logging if sheet logging fails
    console.error(`Failed to log error: ${loggingError.message}`);
    console.error(`Original error: ${error.message}`);
  }
}

/**
 * Send email notification to admin for critical errors.
 * 
 * @param {string} functionName - Name of the function where error occurred
 * @param {string} errorMessage - The error message
 * @param {string} context - Additional context
 * @returns {void}
 */
function sendCriticalErrorNotification_(functionName, errorMessage, context) {
  try {
    const adminEmail = Session.getActiveUser().getEmail();
    const subject = `[CRITICAL] Poster Request System Error`;
    const body = [
      'A critical error occurred in the Poster Request System:',
      '',
      `Function: ${functionName}`,
      `Error: ${errorMessage}`,
      `Context: ${context}`,
      `Time: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`,
      '',
      'Please check the Error Log sheet for more details.'
    ].join('\n');
    
    MailApp.sendEmail(adminEmail, subject, body);
  } catch (emailError) {
    console.error(`Failed to send critical error notification: ${emailError.message}`);
  }
}

/**
 * Retry a function with exponential backoff for transient failures.
 * 
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns {*} Result of the function if successful
 * @throws {Error} If all retries fail
 */
function retryWithBackoff_(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is transient (lock timeout, service error, etc.)
      const isTransient = isTransientError_(error);
      
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      Utilities.sleep(delay);
      delay *= 2;
    }
  }
  
  throw lastError;
}

/**
 * Determine if an error is transient and worth retrying.
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is transient
 */
function isTransientError_(error) {
  const message = String(error.message || '').toLowerCase();
  
  // Common transient error patterns
  const transientPatterns = [
    'lock',
    'timeout',
    'service error',
    'backend error',
    'internal error',
    'temporarily unavailable',
    'try again',
  ];
  
  return transientPatterns.some(pattern => message.includes(pattern));
}

/**
 * Wrapper for handling errors in a standardized way.
 * Use this to wrap critical code sections.
 * 
 * @param {Function} fn - Function to execute
 * @param {string} functionName - Name for logging
 * @param {string} context - Context information
 * @param {string} severity - Error severity level
 * @returns {*} Result of the function or null on error
 */
function handleError_(fn, functionName, context, severity = 'MEDIUM') {
  try {
    return fn();
  } catch (error) {
    logError_(error, functionName, context, severity);
    console.error(`[${functionName}] Error: ${error.message}`);
    return null;
  }
}
