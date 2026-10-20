/** Analytics.js - request and backup audit logging **/

function ensureAnalyticsSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp', 'Event Type', 'Employee Email', 'Employee Name',
    'Posters Requested', 'Posters Removed', 'Request Status',
    'Execution Time (ms)', 'Sheet Reads', 'Cache Hits', 'Lock Wait Time (ms)', 'Notes',
  ];
  const sheet = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS, headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function logSubmissionEvent_(submission) {
  try {
    getSheet_(CONFIG.SHEETS.ANALYTICS).appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'FORM_SUBMIT',
      submission.empEmail || '',
      submission.empName || '',
      Array.isArray(submission.addLabels) ? submission.addLabels.join(', ') : '',
      Array.isArray(submission.removeLabels) ? submission.removeLabels.join(', ') : '',
      submission.status || 'UNKNOWN',
      submission.executionTime || 0,
      submission.sheetReads || 0,
      submission.cacheHits || 0,
      submission.lockWaitTime || 0,
      submission.notes || '',
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log submission event: ${err.message}`);
  }
}
