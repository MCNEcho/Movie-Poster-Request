/** ErrorHandler.js - centralized Error Log writing **/

function ensureErrorTrackingSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp', 'Error Type', 'Function', 'Message',
    'Stack Trace', 'Resolved', 'Resolution Date', 'Admin Notes',
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ERROR_LOG, headers);
}

function logError_(error, functionName, context) {
  try {
    const timestamp = now_();
    const errorType = error && error.constructor && error.constructor.name || 'UnknownError';
    const message = String(error && error.message || error);
    Logger.log(`[ERROR] ${functionName}: ${message}`);
    getSheet_(CONFIG.SHEETS.ERROR_LOG).appendRow([
      fmtDate_(timestamp, CONFIG.DATE_FORMAT),
      errorType,
      functionName,
      message,
      String(error && error.stack || '').substring(0, 500),
      false,
      '',
      context ? JSON.stringify(context) : '',
    ]);
  } catch (logErr) {
    Logger.log(`[CRITICAL] Error logging failed: ${logErr.message}`);
  }
}
