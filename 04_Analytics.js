/** 04_Analytics.gs **/

/**
 * Comprehensive analytics and logging for system monitoring
 * Tracks usage patterns, performance metrics, and system health
 */

/**
 * Ensure Analytics sheet exists with proper headers
 */
function ensureAnalyticsSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp',
    'Event Type',
    'Employee Email',
    'Employee Name',
    'Posters Requested',
    'Posters Removed',
    'Request Status',
    'Execution Time (ms)',
    'Sheet Reads',
    'Cache Hits',
    'Notes'
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS, headers);
}

/**
 * Ensure Analytics Summary sheet exists
 */
function ensureAnalyticsSummarySheet_() {
  const ss = SpreadsheetApp.getActive();
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS_SUMMARY, [
    'Metric',
    'Period',
    'Value',
    'Last Updated'
  ]);
}

/**
 * Log a form submission event
 * @param {object} submission - Submission details
 */
function logSubmissionEvent_(submission) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'FORM_SUBMISSION',
      submission.empEmail || '',
      submission.empName || '',
      Array.isArray(submission.addLabels) ? submission.addLabels.join(', ') : '',
      Array.isArray(submission.removeLabels) ? submission.removeLabels.join(', ') : '',
      submission.status || 'UNKNOWN',
      submission.executionTime || 0,
      submission.sheetReads || 0,
      submission.cacheHits || 0,
      submission.notes || ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log submission event: ${err.message}`);
  }
}

/**
 * Log a board rebuild event
 * @param {number} executionTime - Time in milliseconds
 * @param {number} sheetReads - Number of sheet reads
 * @param {number} cacheHits - Number of cache hits
 */
function logBoardRebuildEvent_(executionTime, sheetReads, cacheHits) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BOARD_REBUILD',
      '',
      '',
      '',
      '',
      'COMPLETE',
      executionTime || 0,
      sheetReads || 0,
      cacheHits || 0,
      'Automatic board update'
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log board rebuild event: ${err.message}`);
  }
}

/**
 * Log a form sync event
 * @param {number} executionTime - Time in milliseconds
 * @param {number} posterCount - Number of posters synced
 */
function logFormSyncEvent_(executionTime, posterCount) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'FORM_SYNC',
      '',
      '',
      posterCount || 0,
      '',
      'COMPLETE',
      executionTime || 0,
      0,
      0,
      `Synced ${posterCount || 0} posters to form`
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log form sync event: ${err.message}`);
  }
}

/**
 * Calculate and update analytics summary metrics
 */
function updateAnalyticsSummary_() {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(analytics, 11);
    if (data.length === 0) return;

    const summarySheet = getSheet_(CONFIG.SHEETS.ANALYTICS_SUMMARY);
    summarySheet.clearContents();
    summarySheet.appendRow(['Metric', 'Period', 'Value', 'Last Updated']);

    // Calculate metrics
    const totalSubmissions = data.filter(r => r[1] === 'FORM_SUBMISSION').length;
    const totalBoardRebuilds = data.filter(r => r[1] === 'BOARD_REBUILD').length;
    const totalFormSyncs = data.filter(r => r[1] === 'FORM_SYNC').length;

    // Average execution times
    const submissions = data.filter(r => r[1] === 'FORM_SUBMISSION');
    const avgSubmissionTime = submissions.length > 0
      ? submissions.reduce((sum, r) => sum + (Number(r[7]) || 0), 0) / submissions.length
      : 0;

    const rebuilds = data.filter(r => r[1] === 'BOARD_REBUILD');
    const avgRebuildTime = rebuilds.length > 0
      ? rebuilds.reduce((sum, r) => sum + (Number(r[7]) || 0), 0) / rebuilds.length
      : 0;

    // Sheet read stats
    const totalSheetReads = data.reduce((sum, r) => sum + (Number(r[8]) || 0), 0);
    const totalCacheHits = data.reduce((sum, r) => sum + (Number(r[9]) || 0), 0);
    const cacheHitRate = (totalSheetReads + totalCacheHits) > 0
      ? ((totalCacheHits / (totalSheetReads + totalCacheHits)) * 100).toFixed(1)
      : 0;

    // Unique employees
    const uniqueEmployees = new Set(
      data.filter(r => r[1] === 'FORM_SUBMISSION' && r[2])
        .map(r => String(r[2]).toLowerCase())
    ).size;

    // Append summary metrics
    summarySheet.appendRow(['Total Form Submissions', 'All Time', totalSubmissions, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Board Rebuilds', 'All Time', totalBoardRebuilds, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Form Syncs', 'All Time', totalFormSyncs, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Submission Time (ms)', 'Last Period', avgSubmissionTime.toFixed(0), fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Board Rebuild Time (ms)', 'Last Period', avgRebuildTime.toFixed(0), fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Sheet Reads', 'All Time', totalSheetReads, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Cache Hits', 'All Time', totalCacheHits, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Cache Hit Rate (%)', 'All Time', cacheHitRate, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Unique Employees', 'All Time', uniqueEmployees, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);

  } catch (err) {
    Logger.log(`[WARN] Failed to update analytics summary: ${err.message}`);
  }
}

/**
 * Get most requested posters from analytics
 * @param {number} limit - Number of top posters to return
 * @returns {Array<object>} Array of {title, count}
 */
function getMostRequestedPosters_(limit = 10) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(analytics, 11);

    const posterCounts = {};
    data.forEach(row => {
      const posterStr = String(row[4] || '').trim(); // Posters Requested column
      if (posterStr) {
        const posters = posterStr.split(',').map(p => p.trim());
        posters.forEach(poster => {
          posterCounts[poster] = (posterCounts[poster] || 0) + 1;
        });
      }
    });

    return Object.entries(posterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([title, count]) => ({ title, count }));

  } catch (err) {
    Logger.log(`[WARN] Failed to get most requested posters: ${err.message}`);
    return [];
  }
}

/**
 * Detect anomalies in submission patterns
 * @returns {Array<object>} Detected anomalies
 */
function detectAnomalies_() {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(analytics, 11);
    const anomalies = [];

    // Check for employees with unusual activity
    const employeeActivity = {};
    data.filter(r => r[1] === 'FORM_SUBMISSION').forEach(row => {
      const email = String(row[2] || '').toLowerCase();
      if (email) {
        employeeActivity[email] = (employeeActivity[email] || 0) + 1;
      }
    });

    // Flag if any employee has more than 10 submissions in the analytics window
    Object.entries(employeeActivity).forEach(([email, count]) => {
      if (count > 10) {
        anomalies.push({
          type: 'HIGH_SUBMISSION_RATE',
          email,
          count,
          severity: 'MEDIUM'
        });
      }
    });

    // Check for rapid submissions (same employee, multiple submissions within 5 minutes)
    const submissions = data.filter(r => r[1] === 'FORM_SUBMISSION');
    for (let i = 0; i < submissions.length - 1; i++) {
      const curr = submissions[i];
      const next = submissions[i + 1];
      
      if (curr[2] === next[2]) { // Same employee
        try {
          const currTime = new Date(curr[0]).getTime();
          const nextTime = new Date(next[0]).getTime();
          if (nextTime - currTime < 300000) { // 5 minutes
            anomalies.push({
              type: 'RAPID_SUBMISSIONS',
              email: curr[2],
              timeDiff_ms: nextTime - currTime,
              severity: 'LOW'
            });
          }
        } catch (e) {
          // Skip if date parsing fails
        }
      }
    }

    return anomalies;

  } catch (err) {
    Logger.log(`[WARN] Failed to detect anomalies: ${err.message}`);
    return [];
  }
}

/**
 * Generate analytics report
 * @returns {string} Formatted report
 */
function generateAnalyticsReport_() {
  const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
  const data = getNonEmptyData_(analytics, 11);

  const totalSubmissions = data.filter(r => r[1] === 'FORM_SUBMISSION').length;
  const mostRequested = getMostRequestedPosters_(5);
  const anomalies = detectAnomalies_();

  let report = `
POSTER SYSTEM - ANALYTICS REPORT
Generated: ${new Date()}
======================================

SUMMARY STATISTICS:
- Total Form Submissions: ${totalSubmissions}
- Analytics Records: ${data.length}

TOP 5 REQUESTED POSTERS:
${mostRequested.map((p, i) => `  ${i+1}. ${p.title} (${p.count} requests)`).join('\n')}

DETECTED ANOMALIES: ${anomalies.length}
${anomalies.map(a => `  - ${a.type} (${a.severity}) - ${a.email || ''}`).join('\n')}

For detailed metrics, see the Analytics Summary sheet.
  `.trim();

  return report;
}

/**
 * Archive old analytics entries (keep last 90 days)
 */
function archiveOldAnalytics_() {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(analytics, 11);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let rowsToDelete = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      try {
        const dateStr = data[i][0];
        const date = new Date(dateStr);
        if (date < ninetyDaysAgo) {
          rowsToDelete++;
        } else {
          break;
        }
      } catch (e) {
        // Skip if date parsing fails
      }
    }

    if (rowsToDelete > 0) {
      analytics.deleteRows(2, rowsToDelete);
      Logger.log(`[ARCHIVE] Removed ${rowsToDelete} old analytics entries`);
    }
  } catch (err) {
    Logger.log(`[WARN] Failed to archive old analytics: ${err.message}`);
  }
}
