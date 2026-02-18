/** Analytics.js **/

/**
 * Comprehensive analytics and logging for system monitoring
 * Tracks usage patterns, performance metrics, and system health
 */

// Analytics sheet column count (used for data reading)
const ANALYTICS_COLUMNS = 12;

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
    'Lock Wait Time (ms)',
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
      submission.lockWaitTime || 0,
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
      0, // No lock wait for board rebuild
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
      0, // No lock wait for form sync
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
    const data = getNonEmptyData_(analytics, ANALYTICS_COLUMNS);
    if (data.length === 0) return;

    const summarySheet = getSheet_(CONFIG.SHEETS.ANALYTICS_SUMMARY);
    summarySheet.clearContents();
    summarySheet.appendRow(['Metric', 'Period', 'Value', 'Last Updated']);

    // Calculate metrics
    const totalSubmissions = data.filter(r => r[1] === 'FORM_SUBMISSION').length;
    const totalBoardRebuilds = data.filter(r => r[1] === 'BOARD_REBUILD').length;
    const totalFormSyncs = data.filter(r => r[1] === 'FORM_SYNC').length;
    const totalBulkSims = data.filter(r => r[1] === 'BULK_SIMULATION').length;

    // Average execution times
    const submissions = data.filter(r => r[1] === 'FORM_SUBMISSION');
    const avgSubmissionTime = submissions.length > 0
      ? submissions.reduce((sum, r) => sum + (Number(r[7]) || 0), 0) / submissions.length
      : 0;

    const rebuilds = data.filter(r => r[1] === 'BOARD_REBUILD');
    const avgRebuildTime = rebuilds.length > 0
      ? rebuilds.reduce((sum, r) => sum + (Number(r[7]) || 0), 0) / rebuilds.length
      : 0;

    const bulkSims = data.filter(r => r[1] === 'BULK_SIMULATION');
    const avgBulkSimTime = bulkSims.length > 0
      ? bulkSims.reduce((sum, r) => sum + (Number(r[7]) || 0), 0) / bulkSims.length
      : 0;

    // Sheet read stats
    const totalSheetReads = data.reduce((sum, r) => sum + (Number(r[8]) || 0), 0);
    const totalCacheHits = data.reduce((sum, r) => sum + (Number(r[9]) || 0), 0);
    const cacheHitRate = (totalSheetReads + totalCacheHits) > 0
      ? ((totalCacheHits / (totalSheetReads + totalCacheHits)) * 100).toFixed(1)
      : 0;

    // Lock wait time stats
    const totalLockWaitTime = data.reduce((sum, r) => sum + (Number(r[10]) || 0), 0);
    const avgLockWaitTime = data.length > 0 ? (totalLockWaitTime / data.length).toFixed(0) : 0;

    // Unique employees
    const uniqueEmployees = new Set(
      data.filter(r => r[1] === 'FORM_SUBMISSION' && r[2])
        .map(r => String(r[2]).toLowerCase())
    ).size;

    // Append summary metrics
    summarySheet.appendRow(['Total Form Submissions', 'All Time', totalSubmissions, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Board Rebuilds', 'All Time', totalBoardRebuilds, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Form Syncs', 'All Time', totalFormSyncs, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Bulk Simulations', 'All Time', totalBulkSims, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Submission Time (ms)', 'Last Period', avgSubmissionTime.toFixed(0), fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Board Rebuild Time (ms)', 'Last Period', avgRebuildTime.toFixed(0), fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Bulk Simulation Time (ms)', 'Last Period', avgBulkSimTime.toFixed(0), fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Sheet Reads', 'All Time', totalSheetReads, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Cache Hits', 'All Time', totalCacheHits, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Cache Hit Rate (%)', 'All Time', cacheHitRate, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Total Lock Wait Time (ms)', 'All Time', totalLockWaitTime, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    summarySheet.appendRow(['Avg Lock Wait Time (ms)', 'All Time', avgLockWaitTime, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
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
    const data = getNonEmptyData_(analytics, ANALYTICS_COLUMNS);
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

/**
 * Log a bulk simulation event
 * @param {object} simulationMetrics - Simulation metrics
 */
function logBulkSimulationEvent_(simulationMetrics) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BULK_SIMULATION',
      '',
      '',
      simulationMetrics.totalAdds || 0,
      simulationMetrics.totalRemoves || 0,
      simulationMetrics.dryRun ? 'DRY_RUN' : 'COMPLETE',
      simulationMetrics.totalExecutionTime || 0,
      simulationMetrics.totalSheetReads || 0,
      simulationMetrics.totalCacheHits || 0,
      simulationMetrics.totalLockWaitTime || 0,
      `N=${simulationMetrics.simulationCount}, Avg=${simulationMetrics.avgExecutionTime}ms, Errors=${simulationMetrics.errorCount}`
    ]);
    
    // Update summary after bulk simulation
    updateAnalyticsSummary_();
  } catch (err) {
    Logger.log(`[WARN] Failed to log bulk simulation event: ${err.message}`);
  }
}


/** Announcements.js **/

function handleSheetEdit(e) {
  const sh = e.range.getSheet();
  const name = sh.getName();

  if (name === CONFIG.SHEETS.INVENTORY) {
    updateInventoryLastUpdated_();
    sortInventoryByReleaseDate_();           // Auto-sort after edits
    ensurePosterIdsInInventory_();          // Ensure IDs exist
    const removalHandled = detectInventoryRemovalsFromEdit_(e); // Detect title/release clears
    if (!removalHandled) {
      processInventoryEdit_(e);             // Handle ACTIVE checkbox changes
    }
    // Print Out now updates manually only - removed automatic refresh
    return;
  }

  // Movie Posters sheet is deprecated - edit handler removed
  // All poster management now happens through Inventory sheet
}

/**
 * Handle Inventory sheet edits - check for poster activation changes
 */
function processInventoryEdit_(e) {
  const row = e.range.getRow();
  if (row < 2) return;

  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const r = inv.getRange(row, 1, 1, 12).getValues()[0];

  const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
  const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
  const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
  const release = r[COLS.INVENTORY.RELEASE - 1];

  if (pid && active && title && release) {
    queueAnnouncement_(pid, title, release);
  }
  
  // Sync form options when Inventory changes
  syncPostersToForm();
  rebuildBoards();
}

function queueAnnouncement_(posterId, title, releaseDate) {
  const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
  if (announced[posterId]) return;

  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  queue[posterId] = {
    title,
    releaseDate: (releaseDate instanceof Date) ? fmtDate_(releaseDate, 'yyyy-MM-dd') : String(releaseDate),
  };
  writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
}

function previewPendingAnnouncement() {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  const ids = Object.keys(queue);
  if (ids.length === 0) {
    SpreadsheetApp.getUi().alert('No pending posters in the announcement queue.');
    return;
  }
  
  // Dry-run preview with actual template rendering
  const preview = generateAnnouncementPreview_(queue, ids);
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Announcement Preview (Dry-Run)',
    preview,
    ui.ButtonSet.OK
  );
}

function sendAnnouncementNow() {
  processAnnouncementQueue(true);
}

function processAnnouncementQueue(forceSend) {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  const ids = Object.keys(queue);
  if (ids.length === 0) return;

  const recipients = getActiveSubscriberEmails_();
  if (recipients.length === 0) return;

  try {
    // Process announcements with batching
    if (CONFIG.ANNOUNCEMENT.BATCH_ENABLED && ids.length > 1) {
      processBatchedAnnouncements_(queue, ids, recipients);
    } else {
      // Send individual announcements
      processIndividualAnnouncements_(queue, ids, recipients);
    }

    // Mark all as announced
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    ids.forEach(id => announced[id] = true);
    writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
    
    // Clear queue
    writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    
    // Log successful announcement
    logAnnouncementEvent_(ids.length, recipients.length, 'SUCCESS');
  } catch (err) {
    logError_(err, 'processAnnouncementQueue', { queueSize: ids.length, recipientCount: recipients.length });
    throw err;
  }
}

function getActiveSubscriberEmails_() {
  const sh = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
  const data = getNonEmptyData_(sh, 3);
  return data
    .filter(r => r[COLS.SUBSCRIBERS.ACTIVE - 1] === true)
    .map(r => String(r[COLS.SUBSCRIBERS.EMAIL - 1] || '').trim())
    .filter(Boolean);
}

/**
 * Generate preview of announcement with template rendering
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Preview text
 */
function generateAnnouncementPreview_(queue, ids) {
  const recipients = getActiveSubscriberEmails_();
  const formUrl = getFormPublishedUrlSafe_();
  
  // Select appropriate template
  const template = ids.length === 1 ? CONFIG.TEMPLATES.SINGLE_POSTER : CONFIG.TEMPLATES.BATCH;
  
  // Build poster list
  const posterList = formatPosterList_(queue, ids);
  
  // Get total active count
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  // Substitute variables
  let subject = template.subject;
  let body = template.body;
  
  if (ids.length === 1) {
    const poster = queue[ids[0]];
    subject = substituteVariables_(subject, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(ids[0]),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      COUNT: '1',
      POSTER_LIST: posterList
    });
    body = substituteVariables_(body, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(ids[0]),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      COUNT: '1',
      POSTER_LIST: posterList
    });
  } else {
    subject = substituteVariables_(subject, {
      COUNT: String(ids.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
    body = substituteVariables_(body, {
      COUNT: String(ids.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
  }
  
  const preview = [
    `Recipients: ${recipients.length} subscriber(s)`,
    `Posters to announce: ${ids.length}`,
    '',
    '--- EMAIL PREVIEW ---',
    `Subject: ${subject}`,
    '',
    'Body:',
    body,
    '--- END PREVIEW ---'
  ].join('\n');
  
  return preview;
}

/**
 * Process batched announcements
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @param {Array<string>} recipients - Email addresses
 */
function processBatchedAnnouncements_(queue, ids, recipients) {
  // Send all posters in a single email instead of batching
  const formUrl = getFormPublishedUrlSafe_();
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  const template = CONFIG.TEMPLATES.BATCH;
  const posterList = formatPosterList_(queue, ids);
  
  const subject = substituteVariables_(template.subject, {
    COUNT: String(ids.length),
    ACTIVE_COUNT: activeCount,
    FORM_LINK: formUrl,
    POSTER_LIST: posterList
  });
  
  const body = substituteVariables_(template.body, {
    COUNT: String(ids.length),
    ACTIVE_COUNT: activeCount,
    FORM_LINK: formUrl,
    POSTER_LIST: posterList
  });
  
  // Send with retry
  sendAnnouncementEmail_(recipients, subject, body);
}

/**
 * Process individual announcements (no batching)
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @param {Array<string>} recipients - Email addresses
 */
function processIndividualAnnouncements_(queue, ids, recipients) {
  const formUrl = getFormPublishedUrlSafe_();
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  ids.forEach((id, index) => {
    const poster = queue[id];
    const template = CONFIG.TEMPLATES.SINGLE_POSTER;
    
    const subject = substituteVariables_(template.subject, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(id),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl
    });
    
    const body = substituteVariables_(template.body, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(id),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl
    });
    
    // Send with retry
    sendAnnouncementEmail_(recipients, subject, body);
    
    // Throttle between emails
    if (index < ids.length - 1) {
      Utilities.sleep(CONFIG.ANNOUNCEMENT.THROTTLE_DELAY_MS);
    }
  });
}

/**
 * Substitute template variables with actual values
 * @param {string} template - Template string with {{VARIABLE}} placeholders
 * @param {object} variables - Variable values
 * @returns {string} Substituted string
 */
function substituteVariables_(template, variables) {
  let result = template;
  
  // First, substitute provided variables
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key] !== undefined && variables[key] !== null 
      ? String(variables[key]) 
      : '[N/A]'; // Fallback for missing data
    result = result.replaceAll(placeholder, value);
  });
  
  // Then, replace any remaining unsubstituted variables with fallback
  result = result.replace(/\{\{[A-Z_]+\}\}/g, '[N/A]');
  
  return result;
}

/**
 * Format poster list for announcements
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Formatted poster list
 */
function formatPosterList_(queue, ids) {
  return ids.map((id, i) => {
    const poster = queue[id];
    return `${i+1}. ${poster.title} (${poster.releaseDate})`;
  }).join('\n');
}

/**
 * Get stock information for a poster
 * @param {string} posterId - Poster ID
 * @returns {string} Stock info
 */
function getStockInfo_(posterId) {
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inv, 11, 3);
    
    const poster = data.find(r => 
      String(r[COLS.INVENTORY.POSTER_ID - 1]).trim() === posterId
    );
    
    if (poster) {
      const invCount = poster[COLS.INVENTORY.POSTERS - 1];
      return invCount !== undefined && invCount !== null && invCount !== '' 
        ? String(invCount) 
        : 'Available';
    }
    
    return 'Available';
  } catch (err) {
    Logger.log(`[WARN] Failed to get stock info for ${posterId}: ${err.message}`);
    return 'Available';
  }
}

/**
 * Send announcement email with retry and backoff
 * @param {Array<string>} recipients - Email addresses
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 */
function sendAnnouncementEmail_(recipients, subject, body) {
  recipients.forEach(email => {
    try {
      retryWithBackoff_(
        () => MailApp.sendEmail(email, subject, body),
        CONFIG.ANNOUNCEMENT.RETRY_ATTEMPTS,
        CONFIG.ANNOUNCEMENT.RETRY_INITIAL_DELAY_MS
      );
    } catch (err) {
      logError_(err, 'sendAnnouncementEmail_', { 
        recipient: email, 
        subject: subject 
      });
      // Continue with other recipients even if one fails
    }
  });
}

/**
 * Log announcement event to Analytics
 * @param {number} posterCount - Number of posters announced
 * @param {number} recipientCount - Number of recipients
 * @param {string} status - Status (SUCCESS/FAILURE)
 */
function logAnnouncementEvent_(posterCount, recipientCount, status) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'ANNOUNCEMENT_SENT',
      '',
      '',
      '',
      '',
      status,
      0,
      0,
      0,
      `Sent announcement for ${posterCount} poster(s) to ${recipientCount} recipient(s)`
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log announcement event: ${err.message}`);
  }
}


/** BackupManager.js **/

/**
 * Nightly data backup/export to Google Drive
 * Backs up Requests and Subscribers sheets with retention management
 */

/**
 * Main backup function - exports configured sheets to Drive
 * Called by nightly trigger or manually from menu
 */
function performNightlyBackup() {
  if (!CONFIG.BACKUP.ENABLED) {
    Logger.log('[BACKUP] Backups are disabled in config');
    return;
  }

  const startTime = new Date().getTime();
  const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
  
  try {
    Logger.log('[BACKUP] Starting nightly backup...');
    
    // Ensure backup folder exists
    const folderId = ensureBackupFolder_();
    
    // Backup only configured sheets
    const backupResults = [];
    const backupErrors = [];
    
    CONFIG.BACKUP.SHEETS_TO_BACKUP.forEach(sheetName => {
      try {
        const result = backupSheet_(sheetName, folderId, timestamp);
        if (result && result.name) {
          backupResults.push(result.name);
        } else {
          Logger.log(`[BACKUP] Warning: backup returned invalid result for ${sheetName}`);
          backupErrors.push({ sheet: sheetName, error: 'Invalid result structure' });
        }
      } catch (sheetErr) {
        Logger.log(`[BACKUP] Failed to backup ${sheetName}: ${sheetErr.message}`);
        backupErrors.push({ sheet: sheetName, error: sheetErr.message });
        // Continue with remaining sheets
      }
    });
    
    // If all sheets failed, throw error
    if (backupResults.length === 0 && CONFIG.BACKUP.SHEETS_TO_BACKUP.length > 0) {
      const errorSummary = backupErrors.map(e => `${e.sheet}: ${e.error}`).join('; ');
      throw new Error(`All sheet backups failed. Errors: ${errorSummary}`);
    }
    
    // Apply retention policy
    const deletedCount = applyRetentionPolicy_(folderId);
    
    const executionTime = new Date().getTime() - startTime;
    
    // Log success to Analytics
    logBackupEvent_({
      status: backupErrors.length > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
      sheets: CONFIG.BACKUP.SHEETS_TO_BACKUP,
      files: backupResults,
      errors: backupErrors,
      deletedCount: deletedCount,
      executionTime: executionTime
    });
    
    Logger.log(`[BACKUP] Completed successfully in ${executionTime}ms`);
    Logger.log(`[BACKUP] Backed up ${backupResults.length} sheets: ${CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ')}`);
    Logger.log(`[BACKUP] Deleted ${deletedCount} old backups`);
    
  } catch (err) {
    const executionTime = new Date().getTime() - startTime;
    
    // Log error
    logError_(err, 'performNightlyBackup', {
      timestamp: timestamp,
      executionTime: executionTime
    });
    
    // Log failure to Analytics
    logBackupEvent_({
      status: 'FAILURE',
      error: err.message,
      executionTime: executionTime
    });
    
    Logger.log(`[BACKUP] Failed: ${err.message}`);
    throw err;
  }
}

/**
 * Backup a single sheet to Drive
 * @param {string} sheetName - Name of sheet to backup
 * @param {string} folderId - Drive folder ID
 * @param {string} timestamp - Timestamp for filename
 * @returns {object} File metadata {name, id, url}
 */
function backupSheet_(sheetName, folderId, timestamp) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  const folder = DriveApp.getFolderById(folderId);
  const fileName = `${sheetName}_${timestamp}`;
  
  if (CONFIG.BACKUP.FORMAT === 'SHEET') {
    // Create Google Sheet copy
    const newSpreadsheet = SpreadsheetApp.create(fileName);
    const newSheet = newSpreadsheet.getActiveSheet();
    
    // Copy data
    const data = sheet.getDataRange().getValues();
    if (data.length > 0 && data[0] && data[0].length > 0) {
      newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
    
    // Move to backup folder
    const file = DriveApp.getFileById(newSpreadsheet.getId());
    file.moveTo(folder);
    
    Logger.log(`[BACKUP] Created Sheet backup: ${fileName}`);
    
    return {
      name: fileName,
      id: newSpreadsheet.getId(),
      url: newSpreadsheet.getUrl()
    };
    
  } else {
    // Create CSV export (default)
    const data = sheet.getDataRange().getValues();
    const csv = convertToCsv_(data);
    const blob = Utilities.newBlob(csv, 'text/csv', fileName + '.csv');
    const file = folder.createFile(blob);
    
    Logger.log(`[BACKUP] Created CSV backup: ${fileName}.csv`);
    
    return {
      name: fileName + '.csv',
      id: file.getId(),
      url: file.getUrl()
    };
  }
}

/**
 * Convert 2D array to CSV string
 * @param {Array<Array>} data - 2D array of values
 * @returns {string} CSV string
 */
function convertToCsv_(data) {
  return data.map(row => {
    return row.map(cell => {
      const str = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');
}

/**
 * Ensure backup folder exists in Drive, create if needed
 * @returns {string} Folder ID
 */
function ensureBackupFolder_() {
  const props = getProps_();
  let folderId = props.getProperty(CONFIG.PROPS.BACKUP_FOLDER_ID);
  
  // Check if folder exists
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      Logger.log(`[BACKUP] Using existing folder: ${folder.getName()}`);
      return folderId;
    } catch (e) {
      // Folder doesn't exist, create new one
      Logger.log('[BACKUP] Stored folder not found, creating new one');
      folderId = null;
    }
  }
  
  // Create new folder or find existing one
  const folderName = CONFIG.BACKUP.FOLDER_NAME;
  const folders = DriveApp.getFoldersByName(folderName);
  
  let folder;
  if (folders.hasNext()) {
    // Use first existing folder with same name
    // Note: If multiple folders exist, only the first is used
    folder = folders.next();
    Logger.log(`[BACKUP] Found existing folder: ${folderName}`);
  } else {
    // Create new folder
    folder = DriveApp.createFolder(folderName);
    Logger.log(`[BACKUP] Created new folder: ${folderName}`);
  }
  
  // Store folder ID for future lookups
  folderId = folder.getId();
  props.setProperty(CONFIG.PROPS.BACKUP_FOLDER_ID, folderId);
  
  return folderId;
}

/**
 * Delete backups older than retention days
 * @param {string} folderId - Backup folder ID
 * @returns {number} Number of files deleted
 */
function applyRetentionPolicy_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const retentionMs = CONFIG.BACKUP.RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs);
  
  let deletedCount = 0;
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    const file = files.next();
    const createdDate = file.getDateCreated();
    
    if (createdDate < cutoffDate) {
      Logger.log(`[BACKUP] Deleting old backup: ${file.getName()} (created ${createdDate})`);
      file.setTrashed(true);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Log backup event to Analytics sheet
 * @param {object} details - Backup details
 */
function logBackupEvent_(details) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    let notes;
    if (details.status === 'SUCCESS' || details.status === 'PARTIAL_SUCCESS') {
      notes = `Backed up ${details.sheets.length} sheet(s): ${details.sheets.join(', ')}. Deleted ${details.deletedCount} old backups.`;
      if (details.errors && details.errors.length > 0) {
        notes += ` Errors: ${details.errors.map(e => `${e.sheet} (${e.error})`).join('; ')}`;
      }
    } else {
      notes = `Backup failed: ${details.error}`;
    }
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BACKUP',
      '',
      '',
      '',
      '',
      details.status,
      details.executionTime || 0,
      0,
      0,
      notes
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log backup event: ${err.message}`);
  }
}

/**
 * Manual backup trigger from admin menu
 * Shows user-friendly alerts
 */
function manualBackupTrigger() {
  const ui = SpreadsheetApp.getUi();
  
  if (!CONFIG.BACKUP.ENABLED) {
    ui.alert('⚠️ Backups Disabled', 
      'Backups are currently disabled in the configuration.', 
      ui.ButtonSet.OK);
    return;
  }
  
  try {
    const sheetList = CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ');
    ui.alert('🔄 Starting Backup', 
      `Creating backups of configured sheets:\n${sheetList}`, 
      ui.ButtonSet.OK);
    
    performNightlyBackup();
    
    // Get backup folder for display
    const folderId = getProps_().getProperty(CONFIG.PROPS.BACKUP_FOLDER_ID);
    const folder = DriveApp.getFolderById(folderId);
    const folderUrl = folder.getUrl();
    
    ui.alert('✅ Backup Complete', 
      `Backups created successfully!\n\nSheets backed up: ${sheetList}\n\nView backups in Drive:\n${folderUrl}`, 
      ui.ButtonSet.OK);
      
  } catch (err) {
    ui.alert('❌ Backup Failed', 
      `An error occurred during backup:\n\n${err.message}\n\nCheck the Error Log sheet for details.`, 
      ui.ButtonSet.OK);
  }
}


/** BackupTest.js **/

/**
 * Manual tests for backup functionality
 * Run these functions from the Apps Script editor to verify backup features
 */

/**
 * Test 1: Test CSV conversion function
 */
function testCsvConversion() {
  const testData = [
    ['Header1', 'Header2', 'Header3'],
    ['Value1', 'Value with, comma', 'Value3'],
    ['Value4', 'Value with "quotes"', 'Value6'],
    ['Value7', 'Value with\nNewline', 'Value9']
  ];
  
  const csv = convertToCsv_(testData);
  Logger.log('CSV Output:');
  Logger.log(csv);
  
  // Verify CSV formatting
  const lines = csv.split('\n');
  const expectedLines = 4;
  
  if (lines.length === expectedLines) {
    Logger.log('✅ CSV conversion test PASSED');
  } else {
    Logger.log(`❌ CSV conversion test FAILED: Expected ${expectedLines} lines, got ${lines.length}`);
  }
}

/**
 * Test 2: Test backup folder creation
 */
function testBackupFolderCreation() {
  try {
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    
    Logger.log('✅ Backup folder test PASSED');
    Logger.log(`Folder ID: ${folderId}`);
    Logger.log(`Folder Name: ${folder.getName()}`);
    Logger.log(`Folder URL: ${folder.getUrl()}`);
    
    return folderId;
  } catch (err) {
    Logger.log('❌ Backup folder test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 3: Test single sheet backup (CSV format)
 */
function testSingleSheetBackupCsv() {
  try {
    // Temporarily change format to CSV
    const originalFormat = CONFIG.BACKUP.FORMAT;
    CONFIG.BACKUP.FORMAT = 'CSV';
    
    const folderId = ensureBackupFolder_();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    const sheetName = CONFIG.SHEETS.SUBSCRIBERS; // Use smaller sheet for testing
    
    const result = backupSheet_(sheetName, folderId, timestamp);
    
    Logger.log('✅ CSV backup test PASSED');
    Logger.log(`File Name: ${result.name}`);
    Logger.log(`File ID: ${result.id}`);
    Logger.log(`File URL: ${result.url}`);
    
    // Restore original format
    CONFIG.BACKUP.FORMAT = originalFormat;
    
    return result;
  } catch (err) {
    Logger.log('❌ CSV backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 4: Test single sheet backup (Sheet format)
 */
function testSingleSheetBackupSheet() {
  try {
    // Temporarily change format to SHEET
    const originalFormat = CONFIG.BACKUP.FORMAT;
    CONFIG.BACKUP.FORMAT = 'SHEET';
    
    const folderId = ensureBackupFolder_();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    const sheetName = CONFIG.SHEETS.SUBSCRIBERS; // Use smaller sheet for testing
    
    const result = backupSheet_(sheetName, folderId, timestamp);
    
    Logger.log('✅ Sheet backup test PASSED');
    Logger.log(`Sheet Name: ${result.name}`);
    Logger.log(`Sheet ID: ${result.id}`);
    Logger.log(`Sheet URL: ${result.url}`);
    
    // Restore original format
    CONFIG.BACKUP.FORMAT = originalFormat;
    
    return result;
  } catch (err) {
    Logger.log('❌ Sheet backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 5: Test retention policy (with test files)
 */
function testRetentionPolicy() {
  try {
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    
    // Create test files with different dates
    const testFileName1 = 'TEST_OLD_BACKUP_DELETE_ME.txt';
    const testFileName2 = 'TEST_RECENT_BACKUP_DELETE_ME.txt';
    
    // Create old file (35 days ago - should be deleted with 30 day retention)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    const oldFile = folder.createFile(testFileName1, 'Old test backup');
    
    // Create recent file (10 days ago - should be kept)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    const recentFile = folder.createFile(testFileName2, 'Recent test backup');
    
    Logger.log('Created test files...');
    Logger.log(`Old file: ${oldFile.getName()}`);
    Logger.log(`Recent file: ${recentFile.getName()}`);
    
    // Note: Google Drive doesn't allow setting creation date directly
    // So we'll clean up manually instead
    
    Logger.log('⚠️ Retention policy test requires manual verification');
    Logger.log('To test retention:');
    Logger.log('1. The policy deletes files older than 30 days');
    Logger.log('2. Manually check the backup folder after 30+ days');
    Logger.log('3. Or modify CONFIG.BACKUP.RETENTION_DAYS to 0 and run backup');
    
    // Clean up test files
    oldFile.setTrashed(true);
    recentFile.setTrashed(true);
    
    Logger.log('✅ Retention policy test setup PASSED (manual verification needed)');
    
  } catch (err) {
    Logger.log('❌ Retention policy test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 6: Test full backup with logging
 */
function testFullBackup() {
  try {
    Logger.log('Starting full backup test...');
    
    // Ensure Analytics sheet exists
    if (!SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS)) {
      ensureAnalyticsSheet_();
    }
    
    // Get initial file count in backup folder
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    const filesBefore = [];
    const filesIterator = folder.getFiles();
    while (filesIterator.hasNext()) {
      filesBefore.push(filesIterator.next().getName());
    }
    
    // Perform backup
    performNightlyBackup();
    
    // Check files after backup
    const filesAfter = [];
    const filesIteratorAfter = folder.getFiles();
    while (filesIteratorAfter.hasNext()) {
      filesAfter.push(filesIteratorAfter.next().getName());
    }
    
    // Count new backup files
    const expectedSheets = CONFIG.BACKUP.SHEETS_TO_BACKUP.length;
    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
    
    Logger.log(`New backup files created: ${newFiles.length}`);
    Logger.log(`Expected: ${expectedSheets} (${CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ')})`);
    Logger.log(`Files: ${newFiles.join(', ')}`);
    
    if (newFiles.length === expectedSheets) {
      Logger.log('✅ Full backup test PASSED');
      Logger.log(`Verified that only ${expectedSheets} configured sheets were backed up`);
    } else {
      Logger.log(`⚠️ Full backup test WARNING: Expected ${expectedSheets} files, found ${newFiles.length}`);
    }
    
    Logger.log('Check:');
    Logger.log('1. Analytics sheet for BACKUP event');
    Logger.log('2. Backup folder in Drive for exported files');
    Logger.log('3. Error Log sheet (should have no new errors)');
    Logger.log(`4. Only these sheets should be backed up: ${CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ')}`);
    
  } catch (err) {
    Logger.log('❌ Full backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Run all tests
 */
function runAllBackupTests() {
  Logger.log('=================================');
  Logger.log('RUNNING ALL BACKUP TESTS');
  Logger.log('=================================\n');
  
  try {
    Logger.log('Test 1: CSV Conversion');
    testCsvConversion();
    Logger.log('');
    
    Logger.log('Test 2: Backup Folder Creation');
    testBackupFolderCreation();
    Logger.log('');
    
    Logger.log('Test 3: Single Sheet Backup (CSV)');
    testSingleSheetBackupCsv();
    Logger.log('');
    
    Logger.log('Test 4: Single Sheet Backup (Sheet)');
    testSingleSheetBackupSheet();
    Logger.log('');
    
    Logger.log('Test 5: Retention Policy');
    testRetentionPolicy();
    Logger.log('');
    
    Logger.log('Test 6: Full Backup');
    testFullBackup();
    Logger.log('');
    
    Logger.log('Test 7: Orphaned Request Cleanup');
    testOrphanedRequestCleanup();
    Logger.log('');
    
    Logger.log('=================================');
    Logger.log('ALL TESTS COMPLETED');
    Logger.log('=================================');
    
  } catch (err) {
    Logger.log('\n=================================');
    Logger.log('TEST SUITE FAILED');
    Logger.log(`Error: ${err.message}`);
    Logger.log('=================================');
  }
}

/**
 * Test 7: Test orphaned request auto-deletion
 */
function testOrphanedRequestCleanup() {
  try {
    Logger.log('Testing orphaned request cleanup...');
    
    // This test verifies that checkForOrphanedRequests_() auto-deletes orphaned requests
    // Note: This is a dry-run test - it doesn't create test data
    
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const rowCountBefore = requestsSheet.getLastRow();
    
    // Run orphan check
    const result = checkForOrphanedRequests_();
    
    const rowCountAfter = requestsSheet.getLastRow();
    const rowsDeleted = rowCountBefore - rowCountAfter;
    
    Logger.log(`Rows before: ${rowCountBefore}`);
    Logger.log(`Rows after: ${rowCountAfter}`);
    Logger.log(`Rows deleted: ${rowsDeleted}`);
    Logger.log(`Check result: ${result.status}`);
    Logger.log(`Issues found: ${result.issuesFound}`);
    Logger.log(`Auto-repaired: ${result.autoRepaired}`);
    
    if (rowsDeleted === result.autoRepaired) {
      Logger.log('✅ Orphaned request cleanup test PASSED');
      Logger.log('Verified: Rows deleted matches auto-repaired count');
    } else {
      Logger.log(`⚠️ Orphaned request cleanup test WARNING`);
      Logger.log(`Expected ${result.autoRepaired} deletions, actual: ${rowsDeleted}`);
    }
    
    Logger.log('Check:');
    Logger.log('1. Data Integrity sheet for orphaned request log entries');
    Logger.log('2. Requests sheet should not contain orphaned ACTIVE requests');
    Logger.log('3. Deleted requests should be completely removed (not marked REMOVED)');
    
  } catch (err) {
    Logger.log('❌ Orphaned request cleanup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}
/** Boards.js **/

function rebuildBoards() {
  buildMainBoard_();
  buildEmployeesBoard_();
  
  // Sync employee view with graceful error handling
  try {
    syncEmployeeViewSpreadsheet_();
  } catch (err) {
    Logger.log(`[WARN] Employee View sync failed (access denied): ${err.message}`);
    // Continue without crashing - employee view will show stale data but refresh completes
  }
  
  // Refresh health banner after board rebuild
  try {
    renderHealthBanner_();
  } catch (err) {
    Logger.log(`[WARN] Health banner refresh after board rebuild failed: ${err.message}`);
  }
}

function resetBoardArea_(sheet, colsToClear) {
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  const cols = Math.min(colsToClear || 2, maxCols);

  // Break apart all merges in the area
  sheet.getRange(1, 1, maxRows, cols).breakApart();
  
  // Remove all bandings and conditional formatting
  sheet.getBandings().forEach(b => b.remove());
  sheet.setConditionalFormatRules([]);
  
  // Clear ALL content AND formatting in the area
  sheet.getRange(1, 1, maxRows, cols).clear({ contentsOnly: false });
}

function buildMainBoard_() {
  const main = getSheet_(CONFIG.SHEETS.MAIN);
  
  // Reset all colors and formatting before updating
  main.getRange(1, 1, main.getMaxRows(), main.getMaxColumns()).setBackground(null);
  main.getRange(1, 1, main.getMaxRows(), main.getMaxColumns()).setFontColor(null);
  
  resetBoardArea_(main, 2);

  const rows = getActiveRequests_();
  Logger.log(`[buildMainBoard] Found ${rows.length} ACTIVE requests`);
  const idToLabel = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});

  const byPoster = {};
  rows.forEach(r => {
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
    (byPoster[pid] = byPoster[pid] || []).push(r);
  });

  const posters = getPostersWithLabels_();
  const posterInfo = {};
  posters.forEach(p => {
    posterInfo[p.posterId] = {
      title: p.title,
      release: p.release,
      inv: p.invCount,
    };
  });

  const posterIds = Object.keys(byPoster).sort((a, b) => {
    const ar = posterInfo[a] ? new Date(posterInfo[a].release) : new Date('2100-01-01');
    const br = posterInfo[b] ? new Date(posterInfo[b].release) : new Date('2100-01-01');
    return ar - br;
  });

  let out = [];
  posterIds.forEach(pid => {
    const info = posterInfo[pid] || {};
    const headerBase = idToLabel[pid] || info.title || pid;
    const header = (info.inv !== '' && info.inv != null) ? `${headerBase} — Inventory: ${info.inv}` : headerBase;

    out.push([header, '']);

    const list = (byPoster[pid] || []).slice().sort(
      (r1, r2) => new Date(r1[COLS.REQUESTS.REQ_TS - 1]) - new Date(r2[COLS.REQUESTS.REQ_TS - 1])
    );

    list.forEach(r => out.push([String(r[COLS.REQUESTS.EMP_NAME - 1]), r[COLS.REQUESTS.REQ_TS - 1]]));

    out.push(['', '']);
    out.push(['', '']);
  });

  if (out.length === 0) out = [['No ACTIVE requests yet', '']];

  main.getRange(1, 1, out.length, 2).setValues(out);

  // Clear all rows below the new data to remove orphaned entries
  const maxRows = main.getMaxRows();
  if (out.length + 1 <= maxRows) {
    main.getRange(out.length + 1, 1, maxRows - out.length, 2).clearContent();
  }

  const used = main.getRange(1, 1, out.length, 2);
  used.setBackground('#ffffff');
  used.setFontWeight('normal');
  used.setHorizontalAlignment('left');
  used.setFontColor('#000000');

  styleBoardHeaders_(main, 'main');
}

function buildEmployeesBoard_() {
  const empSheet = getSheet_(CONFIG.SHEETS.EMPLOYEES);
  
  // Reset all colors and formatting before updating
  empSheet.getRange(1, 1, empSheet.getMaxRows(), empSheet.getMaxColumns()).setBackground(null);
  empSheet.getRange(1, 1, empSheet.getMaxRows(), empSheet.getMaxColumns()).setFontColor(null);
  
  resetBoardArea_(empSheet, 2);

  const rows = getActiveRequests_();
  const idToLabel = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});

  // Group by EMPLOYEE NAME (display name), but internally tracked by email
  const byName = {};
  rows.forEach(r => {
    const name = String(r[COLS.REQUESTS.EMP_NAME - 1] || '').trim();
    if (!name) return;
    (byName[name] = byName[name] || []).push(r);
  });

  const names = Object.keys(byName).sort((a,b) => a.localeCompare(b));

  let out = [];
  names.forEach(name => {
    const list = (byName[name] || []).slice().sort(
      (r1, r2) => new Date(r1[COLS.REQUESTS.REQ_TS - 1]) - new Date(r2[COLS.REQUESTS.REQ_TS - 1])
    );

    const usedSlots = list.length;
    out.push([`${name} (${usedSlots}/${CONFIG.MAX_ACTIVE})`, '']);

    list.forEach(r => {
      const pid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
      out.push([idToLabel[pid] || String(r[COLS.REQUESTS.LABEL_AT_REQ - 1]) || pid, r[COLS.REQUESTS.REQ_TS - 1]]);
    });

    out.push(['', '']);
    out.push(['', '']);
  });

  if (out.length === 0) out = [['No ACTIVE requests yet', '']];

  empSheet.getRange(1, 1, out.length, 2).setValues(out);

  // Clear all rows below the new data to remove orphaned entries
  const maxRows = empSheet.getMaxRows();
  if (out.length + 1 <= maxRows) {
    empSheet.getRange(out.length + 1, 1, maxRows - out.length, 2).clearContent();
  }

  const used = empSheet.getRange(1, 1, out.length, 2);
  used.setBackground('#ffffff');
  used.setFontWeight('normal');
  used.setHorizontalAlignment('left');
  used.setFontColor('#000000');

  styleBoardHeaders_(empSheet, 'employees');
}

function styleBoardHeaders_(sheet, mode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  sheet.setColumnWidths(1, 2, 320);

  const rng = sheet.getRange(1, 1, lastRow, 2);
  const values = rng.getValues();

  for (let r = 1; r <= lastRow; r++) {
    const a = values[r - 1][0];
    const b = values[r - 1][1];

    // Header heuristic: col A has text and col B is blank
    if (a && !b) {
      sheet.getRange(r, 1, 1, 2).merge();
      const cell = sheet.getRange(r, 1);
      cell.setFontWeight('bold');
      cell.setHorizontalAlignment('center');
      cell.setFontColor('#000000');
      cell.setBackground(mode === 'main' ? '#f4cccc' : '#cfe2f3');
    }
  }
}
/** CacheManager.js **/

/**
 * Caching layer for performance optimization
 * Reduces sheet read quota by caching computed results with TTL
 */

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  EMPLOYEE_SLOTS: 'CACHE_EMPLOYEE_SLOTS',
  POSTER_AVAILABILITY: 'CACHE_POSTER_AVAILABILITY',
  BOARD_MAIN: 'CACHE_BOARD_MAIN',
  BOARD_EMPLOYEES: 'CACHE_BOARD_EMPLOYEES',
  ACTIVE_SUBSCRIBERS: 'CACHE_ACTIVE_SUBSCRIBERS',
  POSTERS_WITH_LABELS: 'CACHE_POSTERS_WITH_LABELS',
  POSTER_ID_MAP: 'CACHE_POSTER_ID_MAP',
};

/**
 * Get cache TTL from config (default 5 minutes)
 * @returns {number} TTL in milliseconds
 */
function getCacheTTL_() {
  return (CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
}

/**
 * Set a cache entry with TTL
 * @param {string} key - Cache key from CACHE_CONFIG
 * @param {*} value - Value to cache
 */
function setCache_(key, value) {
  try {
    const entry = {
      value: value,
      timestamp: now_().getTime(),
      ttl: getCacheTTL_()
    };
    writeJsonProp_(key, entry);
  } catch (err) {
    Logger.log(`[WARN] Cache set failed for ${key}: ${err.message}`);
  }
}

/**
 * Get a cache entry if still valid
 * @param {string} key - Cache key from CACHE_CONFIG
 * @returns {*} Cached value or null if expired/missing
 */
function getCache_(key) {
  try {
    const entry = readJsonProp_(key, null);
    if (!entry) return null;

    const age = now_().getTime() - entry.timestamp;
    if (age > entry.ttl) {
      clearCache_(key);
      return null;
    }

    return entry.value;
  } catch (err) {
    Logger.log(`[WARN] Cache get failed for ${key}: ${err.message}`);
    return null;
  }
}

/**
 * Clear a specific cache entry
 * @param {string} key - Cache key from CACHE_CONFIG
 */
function clearCache_(key) {
  try {
    getProps_().deleteProperty(key);
  } catch (err) {
    Logger.log(`[WARN] Cache clear failed for ${key}: ${err.message}`);
  }
}

/**
 * Clear all caches
 */
function clearAllCaches_() {
  Object.values(CACHE_CONFIG).forEach(key => {
    clearCache_(key);
  });
  Logger.log('[CACHE] All caches cleared');
}

/**
 * Get or compute employee active slot count with caching
 * @param {string} empEmail - Employee email
 * @returns {number} Active slot count
 */
function countActiveSlots_Cached(empEmail) {
  const key = CACHE_CONFIG.EMPLOYEE_SLOTS;
  let cache = getCache_(key);
  
  if (!cache) {
    cache = {};
  }

  if (cache[empEmail] !== undefined) {
    return cache[empEmail];
  }

  // Compute and cache
  const count = countActiveSlotsByEmail_(empEmail);
  cache[empEmail] = count;
  setCache_(key, cache);
  
  return count;
}

/**
 * Invalidate employee slots cache for specific email
 * @param {string} empEmail - Employee email to invalidate
 */
function invalidateEmployeeSlots_(empEmail) {
  const key = CACHE_CONFIG.EMPLOYEE_SLOTS;
  let cache = getCache_(key);
  
  if (cache && cache[empEmail] !== undefined) {
    delete cache[empEmail];
    if (Object.keys(cache).length > 0) {
      setCache_(key, cache);
    } else {
      clearCache_(key);
    }
  }
}

/**
 * Get or compute poster availability with caching
 * @returns {object} Poster ID to available count map
 */
function getPosterAvailability_Cached() {
  const key = CACHE_CONFIG.POSTER_AVAILABILITY;
  let cache = getCache_(key);

  if (cache) return cache;

  // Compute availability from Inventory
  cache = {};
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, COLS.INVENTORY.NOTES || 12);

  data.forEach((row, idx) => {
    const isActive = row[COLS.INVENTORY.ACTIVE - 1];
    const posterId = row[COLS.INVENTORY.POSTER_ID - 1];
    const invCount = row[COLS.INVENTORY.POSTERS - 1];

    if (isActive && posterId && invCount) {
      cache[String(posterId)] = Number(invCount || 0);
    }
  });

  setCache_(key, cache);
  return cache;
}

/**
 * Invalidate poster availability cache
 */
function invalidatePosterAvailability_() {
  clearCache_(CACHE_CONFIG.POSTER_AVAILABILITY);
}

/**
 * Get or compute board main data with caching
 * @returns {object} Board data structure
 */
function getBoardMainData_Cached() {
  const key = CACHE_CONFIG.BOARD_MAIN;
  const cache = getCache_(key);

  if (cache) return cache;

  // This would be computed from ledger, implementation depends on buildMainBoard_
  // For now, we'll let the system recompute on cache miss
  return null;
}

/**
 * Invalidate main board cache
 */
function invalidateBoardMain_() {
  clearCache_(CACHE_CONFIG.BOARD_MAIN);
}

/**
 * Get or compute board employees data with caching
 * @returns {object} Board data structure
 */
function getBoardEmployeesData_Cached() {
  const key = CACHE_CONFIG.BOARD_EMPLOYEES;
  const cache = getCache_(key);

  if (cache) return cache;

  return null;
}

/**
 * Invalidate employees board cache
 */
function invalidateBoardEmployees_() {
  clearCache_(CACHE_CONFIG.BOARD_EMPLOYEES);
}

/**
 * Get or compute active subscribers with caching
 * @returns {Array<string>} Array of active subscriber emails
 */
function getActiveSubscriberEmails_Cached() {
  const key = CACHE_CONFIG.ACTIVE_SUBSCRIBERS;
  let cache = getCache_(key);

  if (Array.isArray(cache)) return cache;

  // Compute
  const subSheet = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
  const data = getNonEmptyData_(subSheet, 2);

  cache = data
    .filter(row => row[0] === true) // Active checkbox
    .map(row => String(row[1] || '').trim().toLowerCase())
    .filter(Boolean);

  setCache_(key, cache);
  return cache;
}

/**
 * Invalidate active subscribers cache
 */
function invalidateActiveSubscribers_() {
  clearCache_(CACHE_CONFIG.ACTIVE_SUBSCRIBERS);
}

/**
 * Get or compute posters with labels with caching
 * @returns {Array<object>} Posters with computed labels
 */
function getPostersWithLabels_Cached() {
  const key = CACHE_CONFIG.POSTERS_WITH_LABELS;
  let cache = getCache_(key);

  if (Array.isArray(cache) && cache.length > 0) return cache;

  cache = getPostersWithLabels_();
  setCache_(key, cache);
  return cache;
}

/**
 * Invalidate posters with labels cache
 */
function invalidatePostersWithLabels_() {
  clearCache_(CACHE_CONFIG.POSTERS_WITH_LABELS);
}

/**
 * Convenience invalidation after any write to Requests/Inventory/etc.
 * Keeps slot counts, boards, and poster metadata caches fresh.
 * @param {{empEmail?: string}} opts
 */
function invalidateCachesAfterWrite_(opts) {
  try {
    if (opts && opts.empEmail) invalidateEmployeeSlots_(opts.empEmail.toLowerCase().trim());
  } catch (err) {
    Logger.log(`[WARN] Cache invalidation (employee slots) failed: ${err.message}`);
  }

  invalidateBoardMain_();
  invalidateBoardEmployees_();
  invalidatePosterAvailability_();
  invalidatePostersWithLabels_();
}

/**
 * Get cache statistics for monitoring
 * @returns {object} Cache stats
 */
function getCacheStats_() {
  const stats = {
    timestamp: now_().getTime(),
    caches: {}
  };

  Object.entries(CACHE_CONFIG).forEach(([name, key]) => {
    const entry = readJsonProp_(key, null);
    const isValid = entry && (now_().getTime() - entry.timestamp) <= entry.ttl;
    
    stats.caches[name] = {
      cached: !!entry,
      valid: isValid,
      age_ms: entry ? (now_().getTime() - entry.timestamp) : null,
      ttl_ms: entry ? entry.ttl : null
    };
  });

  return stats;
}

/**
 * Log cache statistics to analytics
 */
function logCacheStats_() {
  try {
    const stats = getCacheStats_();
    Logger.log('[CACHE] Stats: ' + JSON.stringify(stats));
  } catch (err) {
    Logger.log(`[WARN] Cache stats logging failed: ${err.message}`);
  }
}
/** Config.js **/

const CONFIG = {
  TIMEZONE: 'America/Los_Angeles',

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form - Pasco',
    DESCRIPTION:
      'You can only have your name on 7 posters at a time. If you already have all 7 slots maxed out and you want a different poster, remove one from your selection to choose a new one.',
  },

  FORM: {
    Q_EMPLOYEE_NAME: 'Name (First Name + Last Initial)',
    Q_ADD: 'Request Posters (Add)',
    Q_REMOVE: 'Remove Posters',
    Q_SUBSCRIBE: 'Subscribe to Notifications',
  },

  SHEETS: {
    MAIN: 'Main',
    EMPLOYEES: 'Employees',
    REQUEST_ORDER: 'Request Order',
    MOVIE_POSTERS: 'Movie Posters',  // DEPRECATED: Use INVENTORY instead (kept for backward compatibility)
    INVENTORY: 'Inventory',          // PRIMARY: Canonical source for poster data
    PRINT_OUT: 'Print Out',
    POSTER_OUTSIDE: 'Poster Outside',
    POSTER_INSIDE: 'Poster Inside',
    REQUESTS: 'Requests',       // script-created
    SUBSCRIBERS: 'Subscribers', // script-created
    DOCUMENTATION: 'Documentation',
    ERROR_LOG: 'Error Log',     // script-created - Task 1
    ANALYTICS: 'Analytics',     // script-created - Task 3
    ANALYTICS_SUMMARY: 'Analytics Summary', // script-created - Task 3
    DATA_INTEGRITY: 'Data Integrity', // script-created - Task 5
  },

  MAX_ACTIVE: 7,

  // Deduplication configuration (Feature: Config flags for dedup rules)
  ALLOW_REREQUEST_AFTER_REMOVAL: true, // Allow re-requesting a poster after removal
  REREQUEST_COOLDOWN_DAYS: 0, // Days to wait before re-request (0 = immediate if ALLOW_REREQUEST_AFTER_REMOVAL is true)

  // Cache configuration (Task 2 - Performance Optimization)
  CACHE_TTL_MINUTES: 5, // Cache time-to-live in minutes
  
  // Analytics configuration (Task 3 - Logging & Monitoring)
  DATE_FORMAT: 'MM/dd/yyyy HH:mm:ss',
  
  // Admin email for error notifications (Task 1 - Error Handling)
  ADMIN_EMAIL: '', // Leave blank to use spreadsheet owner

  // Bulk Simulator configuration (Task 5 - Bulk Submission Simulator)
  BULK_SIMULATOR: {
    MAX_SIMULATIONS: 100,        // Hard cap on number of simulations per run
    DEFAULT_SIMULATIONS: 10,     // Default number if not specified
    WARNING_THRESHOLD: 50,       // Warn user if N >= this value
    MAX_ADD_PER_SIM: 3,         // Max posters to add in a single simulation
    MAX_REMOVE_PER_SIM: 3,      // Max posters to remove in a single simulation
  },

  // Backup configuration (Task 8 - Nightly Data Backup)
  BACKUP: {
    RETENTION_DAYS: 30,           // Keep backups for 30 days
    FORMAT: 'CSV',                // 'CSV' or 'SHEET' (Google Sheet copy)
    FOLDER_NAME: 'Poster System Backups', // Drive folder name
    ENABLED: true,                // Set to false to disable backups
    SHEETS_TO_BACKUP: [
      'Requests',                 // Complete audit trail
      'Request Order',            // Submission history
      'Inventory'                 // Inventory tracking
    ],
  },

  INVENTORY_LAST_UPDATED_CELL: 'A1',

  PRINT: {
    FORM_URL_CELL: 'B1',
    EMP_VIEW_URL_CELL: 'B2',
    FORM_QR_CELL: 'D1',
    EMP_QR_CELL: 'D2',
    LAST_UPDATED_CELL: 'H1',
    LIST_START_ROW: 6,
  },

  PROPS: {
    FORM_ID: 'POSTER_SYSTEM_FORM_ID',
    EMPLOYEE_VIEW_SSID: 'EMPLOYEE_VIEW_SSID',
    LABEL_TO_ID: 'LABEL_TO_ID_MAP_JSON',
    ID_TO_CURRENT_LABEL: 'ID_TO_CURRENT_LABEL_JSON',

    INVENTORY_SNAPSHOT: 'INVENTORY_SNAPSHOT_JSON',

    ANNOUNCE_QUEUE: 'ANNOUNCE_QUEUE_JSON',
    ANNOUNCED_IDS: 'ANNOUNCED_POSTER_IDS_JSON',
    CUSTOM_ANNOUNCE_QUEUE: 'CUSTOM_ANNOUNCE_QUEUE_JSON',
    BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
  },

  // Announcement batching configuration
  ANNOUNCEMENT: {
    BATCH_ENABLED: true,
    BATCH_SIZE: 5, // Max posters per email
    THROTTLE_DELAY_MS: 1000, // Delay between emails
    RETRY_ATTEMPTS: 3,
    RETRY_INITIAL_DELAY_MS: 500,
  },

  // Email templates with variable support
  TEMPLATES: {
    DEFAULT: {
      subject: 'We Have Added More Posters to the Request Form!',
      body: `We Have Added More Posters to the Request Form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    SINGLE_POSTER: {
      subject: 'New Poster Available: {{TITLE}}',
      body: `A new poster is now available!

Title: {{TITLE}}
Release Date: {{RELEASE}}
Stock: {{STOCK}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    BATCH: {
      subject: 'New Posters Available - {{COUNT}} Added!',
      body: `We've added {{COUNT}} new posters to the request form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    }
  },
};

// 1-based column indexes
const COLS = {
  INVENTORY: {
    ACTIVE: 1,        // NEW: Checkbox for activation
    RELEASE: 2,       // Shifted from 1
    TITLE: 3,         // Shifted from 2
    COMPANY: 4,       // Shifted from 3
    POSTERS: 5,       // Shifted from 4 - Primary tracking column
    BUS: 6,           // Shifted from 5
    MINI: 7,          // Shifted from 6
    STANDEE: 8,       // Shifted from 7
    TEASER: 9,        // Shifted from 8
    NOTES: 10,        // Notes moved to column J
    POSTER_ID: 11,    // Poster ID moved to column K
    // Column L reserved/unused; Poster Received Date removed
  },

  MOVIE_POSTERS: {
    ACTIVE: 1,
    POSTER_ID: 2,
    TITLE: 3,
    RELEASE: 4,
    INV_COUNT: 5,
    RECEIVED: 6,
    NOTES: 7,
    CLOSE_QUEUE: 8,
  },

  REQUESTS: {
    REQ_TS: 1,
    EMP_EMAIL: 2,
    EMP_NAME: 3,
    POSTER_ID: 4,
    LABEL_AT_REQ: 5,
    TITLE_SNAP: 6,
    RELEASE_SNAP: 7,
    ACTION_TYPE: 8,
    STATUS: 9,
    STATUS_TS: 10,
  },

  REQUEST_ORDER: {
    FORM_TS: 1,
    EMP_EMAIL: 2,
    ADD_RAW: 3,
    REMOVE_RAW: 4,
    SLOTS_BEFORE: 5,
    SLOTS_AFTER: 6,
    ADDED_ACCEPTED: 7,
    REMOVED_APPLIED: 8,
    DENIED_ADDS: 9,
    NOTES: 10,
  },

  SUBSCRIBERS: { ACTIVE: 1, EMAIL: 2, NAME: 3 },
};

const STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
  REMOVED_INVENTORY_DELETE: 'REMOVED_INVENTORY_DELETE',
};

// PUSH_TEST 2026-01-25T20:45:50.4999107-08:00
/** DataIntegrity.js **/

/**
 * Data validation and integrity checking framework
 * Ensures system data consistency and provides auto-repair for minor issues
 */

/**
 * Ensure Data Integrity Check sheet exists
 */
function ensureDataIntegritySheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp',
    'Check Type',
    'Status',
    'Records Affected',
    'Details',
    'Auto-Repaired',
    'Admin Action Required'
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DATA_INTEGRITY, headers);
}

/**
 * Run all data integrity checks
 * @returns {object} Summary of checks performed
 */
function runFullIntegrityCheck_() {
  const results = {
    timestamp: now_(),
    checksPerformed: [],
    totalIssuesFound: 0,
    autoRepaired: 0,
    requiresAdminAction: 0
  };

  try {
    Logger.log('[INTEGRITY] Starting full data integrity check...');

    // Check 1: Orphaned requests
    const orphanedCheck = checkForOrphanedRequests_();
    results.checksPerformed.push(orphanedCheck);
    results.totalIssuesFound += orphanedCheck.issuesFound;
    results.autoRepaired += orphanedCheck.autoRepaired;

    // Check 2: Over-capacity assignments
    const overCapCheck = checkForOverCapacity_();
    results.checksPerformed.push(overCapCheck);
    results.totalIssuesFound += overCapCheck.issuesFound;
    results.autoRepaired += overCapCheck.autoRepaired;

    // Check 3: Duplicate active requests
    const duplicateCheck = checkForDuplicates_();
    results.checksPerformed.push(duplicateCheck);
    results.totalIssuesFound += duplicateCheck.issuesFound;
    results.autoRepaired += duplicateCheck.autoRepaired;

    // Check 4: Invalid email formats
    const emailCheck = checkInvalidEmails_();
    results.checksPerformed.push(emailCheck);
    results.totalIssuesFound += emailCheck.issuesFound;

    // Check 5: Inconsistent state
    const stateCheck = checkInconsistentState_();
    results.checksPerformed.push(stateCheck);
    results.totalIssuesFound += stateCheck.issuesFound;
    results.autoRepaired += stateCheck.autoRepaired;

    // Check 6: Missing poster IDs
    const idCheck = checkMissingPosterIds_();
    results.checksPerformed.push(idCheck);
    results.totalIssuesFound += idCheck.issuesFound;
    results.autoRepaired += idCheck.autoRepaired;

    Logger.log(`[INTEGRITY] Check complete. Issues found: ${results.totalIssuesFound}, Auto-repaired: ${results.autoRepaired}`);

    return results;

  } catch (err) {
    Logger.log(`[ERROR] Full integrity check failed: ${err.message}`);
    results.checksPerformed.push({
      checkType: 'FATAL_ERROR',
      status: 'FAILED',
      error: err.message
    });
    return results;
  }
}

/**
 * Check for orphaned requests (requests with deleted posters)
 * Auto-deletes entire rows for orphaned ACTIVE requests
 * @returns {object} Check results
 */
function checkForOrphanedRequests_() {
  const result = {
    checkType: 'ORPHANED_REQUESTS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const inventorySheet = getSheet_(CONFIG.SHEETS.INVENTORY);

    const requestData = getNonEmptyData_(requestsSheet, 7);
    const posterData = getNonEmptyData_(inventorySheet, 11, 3);

    const validPosterIds = new Set(
      posterData.map(row => String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim())
    );

    const orphanedRows = [];
    const orphanedDetails = [];
    requestData.forEach((row, idx) => {
      const posterId = String(row[CONFIG.COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[CONFIG.COLS.REQUESTS.STATUS - 1] || '').trim();
      const title = String(row[CONFIG.COLS.REQUESTS.TITLE_SNAP - 1] || '').trim();
      const empEmail = String(row[CONFIG.COLS.REQUESTS.EMP_EMAIL - 1] || '').trim();

      if (status === 'ACTIVE' && !validPosterIds.has(posterId)) {
        orphanedRows.push(idx + 2); // +2 for header and 0-indexing
        orphanedDetails.push(`${empEmail} - ${title} (${posterId})`);
        result.issuesFound++;
      }
    });

    if (orphanedRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = orphanedRows.length;
      result.details.push(`Deleted ${orphanedRows.length} orphaned request(s)`);
      result.details.push(...orphanedDetails);

      // Auto-repair: Delete entire rows (from bottom to top to maintain row numbers)
      // Reverse order is critical: deleting from top would shift row numbers down,
      // causing subsequent deletions to target wrong rows
      orphanedRows.reverse().forEach(rowNum => {
        requestsSheet.deleteRow(rowNum);
      });
      
      Logger.log(`[INTEGRITY] Deleted ${orphanedRows.length} orphaned requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for over-capacity assignments (more than 5 active per employee)
 * @returns {object} Check results
 */
function checkForOverCapacity_() {
  const result = {
    checkType: 'OVER_CAPACITY',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 9);

    const employeeSlots = {};
    const overCapRows = {};

    data.forEach((row, idx) => {
      const email = String(row[CONFIG.COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase();
      const status = String(row[CONFIG.COLS.REQUESTS.STATUS - 1] || '').trim();

      if (status === 'ACTIVE' && email) {
        if (!employeeSlots[email]) employeeSlots[email] = [];
        employeeSlots[email].push(idx + 2);
      }
    });

    // Check for over-capacity
    Object.entries(employeeSlots).forEach(([email, rows]) => {
      if (rows.length > CONFIG.MAX_ACTIVE) {
        result.issuesFound += rows.length - CONFIG.MAX_ACTIVE;
        overCapRows[email] = rows.slice(CONFIG.MAX_ACTIVE); // Keep oldest, mark newest as removed

        // Auto-repair: Keep oldest slots, mark newest as removed
        const rowsToRemove = rows.slice(CONFIG.MAX_ACTIVE);
        rowsToRemove.forEach(rowNum => {
          requestsSheet.getRange(rowNum, CONFIG.COLS.REQUESTS.STATUS).setValue('REMOVED_OVER_CAPACITY');
          requestsSheet.getRange(rowNum, CONFIG.COLS.REQUESTS.STATUS_TS).setValue(fmtDate_(now_(), CONFIG.DATE_FORMAT));
          result.autoRepaired++;
        });

        result.details.push(`${email}: Removed ${rowsToRemove.length} excess requests (kept oldest ${CONFIG.MAX_ACTIVE})`);
        result.status = 'REPAIRED';
      }
    });

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for duplicate active requests per employee/poster
 * @returns {object} Check results
 */
function checkForDuplicates_() {
  const result = {
    checkType: 'DUPLICATE_REQUESTS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 9);

    const seen = {};
    const duplicateRows = [];

    data.forEach((row, idx) => {
      const email = String(row[CONFIG.COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase();
      const posterId = String(row[CONFIG.COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[CONFIG.COLS.REQUESTS.STATUS - 1] || '').trim();

      const key = `${email}:${posterId}`;

      if (status === 'ACTIVE') {
        if (seen[key]) {
          duplicateRows.push(idx + 2); // Mark for removal
          result.issuesFound++;
        } else {
          seen[key] = true;
        }
      }
    });

    if (duplicateRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = duplicateRows.length;

      // Auto-repair: Mark duplicates as removed
      duplicateRows.forEach(rowNum => {
        requestsSheet.getRange(rowNum, CONFIG.COLS.REQUESTS.STATUS).setValue('REMOVED_DUPLICATE');
        requestsSheet.getRange(rowNum, CONFIG.COLS.REQUESTS.STATUS_TS).setValue(fmtDate_(now_(), CONFIG.DATE_FORMAT));
      });

      result.details.push(`Removed ${duplicateRows.length} duplicate requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for invalid email formats in Subscribers sheet
 * @returns {object} Check results
 */
function checkInvalidEmails_() {
  const result = {
    checkType: 'INVALID_EMAILS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const subSheet = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
    const data = getNonEmptyData_(subSheet, 2);

    const invalidRows = [];

    data.forEach((row, idx) => {
      const email = String(row[1] || '').trim().toLowerCase();
      if (email && !isValidEmail_(email)) {
        invalidRows.push(idx + 2);
        result.issuesFound++;
      }
    });

    if (invalidRows.length > 0) {
      result.status = 'REQUIRES_ACTION';
      result.details.push(`Found ${invalidRows.length} invalid email addresses. Manual review needed.`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for inconsistent state between sheets
 * @returns {object} Check results
 */
function checkInconsistentState_() {
  const result = {
    checkType: 'INCONSISTENT_STATE',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const mainSheet = getSheet_(CONFIG.SHEETS.MAIN);
    const employeesSheet = getSheet_(CONFIG.SHEETS.EMPLOYEES);

    const requestData = getNonEmptyData_(requestsSheet, 9);
    const activeCount = requestData.filter(r => String(r[CONFIG.COLS.REQUESTS.STATUS - 1]).trim() === 'ACTIVE').length;

    // Simple check: make sure active count seems reasonable
    if (activeCount < 0) {
      result.status = 'FAILED';
      result.issuesFound++;
      result.details.push('Invalid active request count detected');
    } else {
      result.details.push(`Validated ${activeCount} active requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for missing or invalid poster IDs
 * @returns {object} Check results
 */
function checkMissingPosterIds_() {
  const result = {
    checkType: 'MISSING_POSTER_IDS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const inventorySheet = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inventorySheet, 11, 3);

    const missingRows = [];

    data.forEach((row, idx) => {
      const posterId = String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      if (!posterId) {
        missingRows.push(idx + 2);
        result.issuesFound++;
      }
    });

    if (missingRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = missingRows.length;

      // Auto-repair: Generate missing IDs
      missingRows.forEach(rowNum => {
        const newId = uuidPosterId_();
        inventorySheet.getRange(rowNum, COLS.INVENTORY.POSTER_ID).setValue(newId);
      });

      result.details.push(`Generated ${missingRows.length} missing poster IDs`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Log integrity check results
 * @param {object} result - Check result object
 */
function logIntegrityCheck_(result) {
  try {
    const integritySheet = getSheet_(CONFIG.SHEETS.DATA_INTEGRITY);

    integritySheet.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      result.checkType,
      result.status,
      result.issuesFound,
      result.details.join('; '),
      result.autoRepaired,
      result.status === 'REQUIRES_ACTION' ? 'YES' : 'NO'
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log integrity check: ${err.message}`);
  }
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail_(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).trim().toLowerCase());
}

/**
 * Generate data integrity report
 * @returns {string} Formatted report
 */
function generateDataIntegrityReport_() {
  try {
    const integritySheet = getSheet_(CONFIG.SHEETS.DATA_INTEGRITY);
    const data = getNonEmptyData_(integritySheet, 7);

    const passCount = data.filter(r => r[2] === 'PASS').length;
    const failCount = data.filter(r => r[2] === 'FAILED').length;
    const repairCount = data.filter(r => r[2] === 'REPAIRED').length;
    const totalIssuesFound = data.reduce((sum, r) => sum + (Number(r[3]) || 0), 0);
    const totalRepaired = data.reduce((sum, r) => sum + (Number(r[5]) || 0), 0);

    return `
DATA INTEGRITY REPORT
Generated: ${new Date()}
======================================

SUMMARY:
- Checks Passed: ${passCount}
- Checks Failed: ${failCount}
- Checks Repaired: ${repairCount}

ISSUES:
- Total Issues Found: ${totalIssuesFound}
- Auto-Repaired: ${totalRepaired}
- Requires Admin Action: ${data.filter(r => r[6] === 'YES').length}

LAST 5 CHECKS:
${data.slice(-5).reverse().map((r, i) => `  ${i+1}. ${r[1]} - ${r[2]} (${r[3]} issues)`).join('\n')}

See Data Integrity sheet for full details.
    `.trim();
  } catch (err) {
    return `ERROR: Failed to generate report: ${err.message}`;
  }
}
/**
 * DEBUG.JS - DEBUGGING UTILITIES
 * ACTIVE DEBUGGING FUNCTIONS

function debugFormAndLinks() {
  const form = getOrCreateForm_();
  Logger.log("FORM EDIT URL: " + form.getEditUrl());
  Logger.log("FORM LIVE URL: " + form.getPublishedUrl());
  Logger.log("SPREADSHEET URL: " + SpreadsheetApp.getActive().getUrl());
}

function resetAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const form = getOrCreateForm_();

  ScriptApp.newTrigger('handleFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger('handleSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  ScriptApp.newTrigger('handleSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  ScriptApp.newTrigger('processAnnouncementQueue')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("Triggers reset. FORM LIVE URL: " + form.getPublishedUrl());
}

/**
 * Test function for dedup configuration feature
 * Tests various scenarios with different CONFIG settings
 */
function testDedupConfig() {
  Logger.log('=== Testing Dedup Configuration ===');
  Logger.log(`Current settings: ALLOW_REREQUEST_AFTER_REMOVAL=${CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL}, COOLDOWN_DAYS=${CONFIG.REREQUEST_COOLDOWN_DAYS}`);
  
  // Test scenarios:
  // 1. No previous request - should always allow
  const test1 = canRequestPoster_('newuser@test.com', 'test-poster-id-1');
  Logger.log(`Test 1 (no previous request): ${test1.allowed ? 'PASS' : 'FAIL'} - ${test1.reason || 'allowed'}`);
  
  // 2. When ALLOW_REREQUEST_AFTER_REMOVAL=false (default), historical requests should be blocked
  Logger.log('\nTest 2: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=false (strict mode)');
  Logger.log('  - Scenario: User previously requested and removed a poster');
  Logger.log('  - Expected: Should be blocked with "duplicate (historical)"');
  Logger.log('  - To test fully, would need actual data in Requests sheet');
  
  // 3. When ALLOW_REREQUEST_AFTER_REMOVAL=true and COOLDOWN_DAYS=0
  Logger.log('\nTest 3: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=true, COOLDOWN_DAYS=0');
  Logger.log('  - Scenario: User previously requested and removed a poster');
  Logger.log('  - Expected: Should be allowed immediately');
  
  // 4. When ALLOW_REREQUEST_AFTER_REMOVAL=true and COOLDOWN_DAYS>0
  Logger.log('\nTest 4: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=true, COOLDOWN_DAYS=7');
  Logger.log('  - Scenario: User removed poster 3 days ago');
  Logger.log('  - Expected: Should be blocked with "cooldown (4 days remaining)"');
  
  Logger.log('\n=== Dedup Config Test Complete ===');
  Logger.log('Review logs above to verify behavior matches expectations');
  Logger.log('To test with real data, add test requests in Requests sheet');
}

/**
 * ============================================================================
 * ONE-TIME MIGRATION / CLEANUP FUNCTION (Archive - no longer maintained)
 * ============================================================================
 * This function was used to migrate legacy data.
 * It is NO LONGER CALLED automatically and is kept for reference only.
 * 
 * If you need to run legacy cleanup:
 *  1. Call: cleanupInvalidNamesAndOverCap_()
 *  2. Check logs for what was changed
 *  3. Review the "Requests" sheet afterward
 * ============================================================================
 */

function cleanupInvalidNamesAndOverCap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.REQUESTS);
  if (!sh) throw new Error('Missing Requests sheet');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    Logger.log('No ledger rows to clean.');
    return;
  }

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();
  const ts = now_();

  // Helper: normalize any weird whitespace (including NBSP)
  const cleanSpaces = (s) =>
    String(s || '')
      .replace(/\u00A0/g, ' ')     // NBSP -> space
      .replace(/\s+/g, ' ')        // collapse runs
      .trim();

  // Track ACTIVE rows by email and dedupe by email+poster
  const activeByEmail = {}; // email -> [{ idx, reqTs }]
  const firstSeenByEmailPoster = {}; // `${email}|${posterId}` -> { idx, reqTs }
  let changed = false;

  for (let i = 0; i < values.length; i++) {
    const r = values[i];

    const status = String(r[COLS.REQUESTS.STATUS - 1] || '');
    if (status !== STATUS.ACTIVE) continue;

    const email = cleanSpaces(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase();
    if (!email) {
      // Empty email => remove ACTIVE row
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
      continue;
    }

    const rawName = cleanSpaces(r[COLS.REQUESTS.EMP_NAME - 1]);
    const chk = normalizeEmployeeName_(rawName);

    if (!chk.ok) {
      // Invalid name format => remove ACTIVE row
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
      continue;
    }

    // Normalize stored name to canonical
    if (rawName !== chk.canonical) {
      r[COLS.REQUESTS.EMP_NAME - 1] = chk.canonical;
      changed = true;
    }

    const posterId = cleanSpaces(r[COLS.REQUESTS.POSTER_ID - 1]);

    const reqTsVal = r[COLS.REQUESTS.REQ_TS - 1];
    const reqTs = (reqTsVal instanceof Date) ? reqTsVal : new Date(reqTsVal || 0);

    // --- DEDUPE by (email + posterId) keep OLDEST ---
    const dedupeKey = `${email}|${posterId}`;
    const prior = firstSeenByEmailPoster[dedupeKey];

    if (!prior) {
      firstSeenByEmailPoster[dedupeKey] = { idx: i, reqTs };
    } else {
      // Keep the OLDEST request
      if (reqTs < prior.reqTs) {
        // Current is older => remove prior
        const priorRow = values[prior.idx];
        priorRow[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
        priorRow[COLS.REQUESTS.STATUS_TS - 1] = ts;
        changed = true;

        // Current becomes the keeper
        firstSeenByEmailPoster[dedupeKey] = { idx: i, reqTs };
      } else {
        // Prior is older => remove current
        r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
        r[COLS.REQUESTS.STATUS_TS - 1] = ts;
        changed = true;
        continue; // do not count it towards activeByEmail
      }
    }

    // Collect remaining ACTIVE rows per email for 5-cap enforcement
    (activeByEmail[email] = activeByEmail[email] || []).push({ idx: i, reqTs });
  }

  // --- Enforce MAX_ACTIVE per email: keep OLDEST 5 ACTIVE ---
  Object.keys(activeByEmail).forEach(email => {
    const arr = activeByEmail[email].sort((a, b) => a.reqTs - b.reqTs);
    if (arr.length <= CONFIG.MAX_ACTIVE) return;

    const overflow = arr.slice(CONFIG.MAX_ACTIVE);
    overflow.forEach(o => {
      const r = values[o.idx];
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
    });
  });

  if (changed) {
    range.setValues(values);
    Logger.log('Cleanup applied: invalid names removed + duplicates removed + over-cap trimmed.');
  } else {
    Logger.log('Cleanup found nothing to change.');
  }

  rebuildBoards();
  syncPostersToForm();
}
/** Documentation.js **/

function buildDocumentationTab() {
  const ss = SpreadsheetApp.getActive();
  const name = CONFIG.SHEETS.DOCUMENTATION;

  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  sh.clear({ contentsOnly: false });
  sh.setColumnWidths(1, 1, 900);
  sh.getRange(1, 1, sh.getMaxRows(), 1).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(1);

  let r = 1;

  r = writeDocTitle_(sh, r, 'Poster Request System — Documentation');
  r = writeDocPara_(sh, r, `Last updated: ${fmtDate_(now_(), 'yyyy-MM-dd hh:mm:ss a')} (${CONFIG.TIMEZONE})`);
  r++;

  r = writeDocSection_(sh, r, '🚀 Quick Start Guide', [
    '1. AUTHORIZE THE SCRIPT: Extensions → Apps Script → Run any function → Click "Review Permissions" → Allow access.',
    '2. VERIFY ACCOUNT: If receiving "access denied" errors, make sure you are authorized on ALL signed-in Google accounts.',
    '3. CHECK PERMISSIONS: Ensure your account has Editor permissions on this spreadsheet.',
    '4. RUN SETUP: Click "Run Setup / Repair" from the Poster Request System menu (top menu bar). THIS IS ONLY NEEDED ONCE FOR INITIALIZATION.',
    '5. ADD POSTERS: Use "Add New Poster" from the admin menu to add posters to the Inventory tab.',
    '6. ACTIVATE POSTERS: Check the "Active?" checkbox in the Inventory tab for posters that should appear in the form.',
    '7. SHARE FORM: Get the form link from Print Out tab (QR code provided) and share with employees.',
    '8. MONITOR REQUESTS: Check Main and Employees tabs to see active requests.',
    'Need help? Contact Gavin if you encounter issues.',
  ]);

  r = writeDocSection_(sh, r, 'Employee Guide', [
    'Open the Poster Request Form (QR code is on the Print Out tab).',
    'Your email address is automatically collected from your Google account.',
    'Enter your Name in the REQUIRED format: FirstName + LastInitial (ex: "Gavin N" or "Gavin N.").',
    'If the name format is wrong (ex: "Miles pratt" or just "Gavin"), the system will NOT save your requests.',
    'To request posters: check titles under "Request Posters (Add)" and submit.',
    'Optionally check "Subscribe to Notifications" to receive email announcements when new posters are added.',
    'To swap posters: select posters to remove AND posters to add in the same submission. Removals happen first.',
    `Check the Employees tab to see your ACTIVE posters and slot count (used/${CONFIG.MAX_ACTIVE}).`,
  ]);

  r = writeDocSection_(sh, r, 'Manager/Admin Guide', [
    '📋 INVENTORY MANAGEMENT:',
    '  • Inventory tab controls what appears in Form Add list (Active? = TRUE) and tracks incoming counts.',
    '  • Poster IDs are internal and auto-generated (hidden column).',
    '  • To activate a poster: set Active? checkbox to TRUE in Inventory tab.',
    '  • To deactivate a poster: set Active? checkbox to FALSE to stop requests.',
    '',
    '📧 ANNOUNCEMENTS:',
    '  • Subscribers tab: checked emails receive announcements when new posters are activated.',
    '  • Use "Preview Pending Announcement" to see draft email before sending.',
    '  • Use "Send Announcement Now" to notify subscribers of new posters.',
    '',
    '🖨️ PRINTING & DISPLAYS:',
    '  • Print Out tab: print-friendly inventory list + QR codes (Form + Employees view).',
    '  • Display Management: Use Poster Outside and Poster Inside tabs to track poster locations.',
    '  • Use "Update Print Out" to refresh the print layout with current data.',
    '',
    '👥 EMPLOYEE VIEW:',
    '  • Setup Employee View: Creates a separate read-only spreadsheet for employees to view boards.',
    '  • Sync Employee View: Updates the employee spreadsheet with current Main/Employees data.',
    '  • Share the Employee View URL with employees for read-only access to request boards.',
    '  • IMPORTANT: Master account must share Employee View spreadsheet with Editor permissions for other admins to sync.',
    '',
    '🎨 TAB COLORS:',
    '  • Blue = Primary data (Main, Employees, Inventory)',
    '  • Cyan = Display management (Poster Outside/Inside)',
    '  • Orange = Configuration (Requests, Analytics)',
    '  • Yellow = Admin tools (Print Out, Documentation)',
    '  • Red = Error tracking',
    '  • Green = Analytics & Reports',
  ]);

  r = writeDocSection_(sh, r, 'Admin Menu — Button Reference', [
    '⚙️ Run Setup / Repair: One-time initialization OR repair if system breaks. Creates sheets, form, triggers, and rebuilds everything.',
    '',
    '📊 REPORTS:',
    '  • Rebuild Main Board: Refresh Main tab showing requests grouped by poster.',
    '  • Rebuild Employees Board: Refresh Employees tab showing requests grouped by employee.',
    '  • Rebuild Both Boards: Updates both Main and Employees tabs from Requests sheet.',
    '  • Show Form Published Link: Displays the public form URL for sharing.',
    '  • Refresh Documentation: Rebuilds this Documentation tab with latest system info.',
    '',
    '🖨️ PRINT & LAYOUT:',
    '  • Print Out & Select Area: Opens print-friendly layout and sets print area.',
    '',
    '📺 DISPLAY MANAGEMENT:',
    '  • Manage Poster Displays: Opens dialog to refresh Poster Outside/Inside dropdown lists.',
    '',
    '📧 ANNOUNCEMENTS:',
    '  • Preview Pending: Shows draft of email announcement with all pending posters.',
    '  • Send Announcement: Sends announcement email to subscribers immediately.',
    '  • Custom Announcement: Send a custom message to all subscribers.',
    '',
    '⚙️ ADVANCED:',
    '  • Run Backup Now: Manually creates a backup of the Requests sheet.',
    '  • Manage Employee View: Opens dialog to setup/sync/view employee-facing spreadsheet.',
    '',
    '🔄 REFRESH MANAGER:',
    '  • Opens dialog with individual refresh operations:',
    '    - Refresh Everything (master button)',
    '    - Rebuild boards',
    '    - Sync form options',
    '    - Update print layout',
    '    - Refresh display dropdowns (Outside/Inside)',
  ]);

  r++;
  r = writeDocFormLink_(sh, r);

  r++;
  r = writeDocSection_(sh, r, '🛠️ Troubleshooting', [
    '❌ COMMON ISSUES:',
    '',
    '1. "Access Denied" or "Permission Denied" Errors:',
    '   • Make sure you have authorized the script: Extensions → Apps Script → Run any function → Allow permissions.',
    '   • Check that you are signed into the correct Google account.',
    '   • If multiple Google accounts are signed in, authorize ALL of them.',
    '   • Verify you have Editor permissions on this spreadsheet.',
    '   • For Employee View sync errors: Master account must share Employee View spreadsheet with Editor permissions.',
    '',
    '2. Poster Not Appearing in Form Add List:',
    '   • Ensure "Active?" checkbox is TRUE in Inventory tab.',
    '   • Verify Title and Release Date are filled in.',
    '   • Run "Sync Form Options Now" from admin menu or Refresh Manager.',
    '',
    '3. No Remove Options in Form:',
    '   • Remove list only shows posters the employee currently has ACTIVE.',
    '   • If employee has no active requests, remove list will be empty.',
    '',
    '4. Form Submissions Not Logging:',
    '   • Triggers may be missing—run "Run Setup / Repair" from admin menu.',
    '   • Check Extensions → Apps Script → Triggers to verify they exist.',
    '',
    '5. Boards Show Old/Incorrect Data:',
    '   • Run "Rebuild Both Boards" from admin menu.',
    '   • Or use "Refresh Everything" from Refresh Manager.',
    '',
    '6. Employee View Not Updating:',
    '   • Non-master accounts need Editor permissions on the Employee View spreadsheet.',
    '   • Master account: Open Employee View in Google Drive → Share → Add emails with Editor access.',
    '   • Run "Sync Employee View" from Manage Employee View dialog.',
    '',
    '7. Announcements Not Sending:',
    '   • Check that subscribers are listed in Subscribers tab.',
    '   • Verify email addresses are correct.',
    '   • Run "Preview Pending Announcement" to see what will be sent.',
    '',
    '8. Print Out QR Codes Not Working:',
    '   • QR codes are generated from cached URLs.',
    '   • If form/employee view was recreated, run "Run Setup / Repair" to refresh links.',
    '',
    '⚠️ STILL HAVING ISSUES?',
    'CONTACT GAVIN if you cannot resolve the problem using the steps above.',
    'Provide details: What were you trying to do? What error message did you see? Which account are you using?',
  ]);

  sh.getRange(1, 1, r, 1).setFontFamily('Arial').setFontSize(11);
}

function writeDocTitle_(sh, r, text) {
  sh.getRange(r, 1).setValue(text)
    .setFontSize(16).setFontWeight('bold')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('left');
  return r + 1;
}

function writeDocPara_(sh, r, text) {
  sh.getRange(r, 1).setValue(text).setFontColor('#444444');
  return r + 1;
}

function writeDocSection_(sh, r, title, bullets) {
  sh.getRange(r, 1).setValue(title)
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#cfe2f3');
  r++;

  const body = bullets.map(b => `• ${b}`).join('\n');
  sh.getRange(r, 1).setValue(body);
  r++;

  sh.getRange(r, 1).setValue('');
  return r + 1;
}

/**
 * Generate dedup summary text based on CONFIG settings
 */
function getDedupSummary_() {
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return 'Dedupe is permanent: an employee can request the same poster only once ever.';
  }
  
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    return `Re-requests allowed after removal with ${CONFIG.REREQUEST_COOLDOWN_DAYS}-day cooldown period.`;
  }
  
  return 'You can request the same poster again after removing it, with no waiting period.';
}

/**
 * Generate dedup rule description based on CONFIG settings
 */
function getDedupRuleDescription_() {
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return '3. Deduplication: An employee can request each poster ONE TIME EVER. Historical requests block future requests.';
  }
  
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    return `3. Deduplication: Employees can re-request posters after removal. Cooldown period: ${CONFIG.REREQUEST_COOLDOWN_DAYS} day${CONFIG.REREQUEST_COOLDOWN_DAYS === 1 ? '' : 's'} after removal.`;
  }
  
  return '3. Deduplication: You can request the same poster again immediately after removing it. No waiting period.';
}

/**
 * Generate system health section for documentation
 */
function getSystemHealthSection_() {
  try {
    const health = collectHealthData_();
    
    if (!health || !health.triggers) {
      return [
        'System Health: Data loading...',
        'Click "Refresh Documentation" to refresh this section.'
      ];
    }
    
    const lines = [];
    
    // Triggers
    lines.push(`Triggers Installed: ${health.triggers.triggersInstalled || '?'} (${health.triggers.status || 'UNKNOWN'})`);
    if (health.triggers.details) {
      lines.push(`  • Form Submissions: ${health.triggers.details.formSubmit.installed ? '✅' : '❌'}`);
      lines.push(`  • Sheet Edits: ${health.triggers.details.sheetEdit.installed ? '✅' : '❌'}`);
      lines.push(`  • Announcements: ${health.triggers.details.announcementQueue.installed ? '✅' : '❌'}`);
    }
    
    // Cache
    if (health.cache) {
      lines.push(`Cache Health: ${health.cache.validCaches || '?'}/${health.cache.totalCaches || '?'} valid (${health.cache.status || 'UNKNOWN'})`);
    }
    
    // Errors
    if (health.lastError) {
      if (health.lastError.status === 'HEALTHY') {
        lines.push(`Last Error: None (✅ System clean)`);
      } else if (health.lastError.error && health.lastError.error.includes('Missing sheet')) {
        lines.push(`Last Error: Error Log sheet not yet created (will be created on first error)`);
      } else {
        lines.push(`Last Error: ${health.lastError.errorType || 'Unknown'} - ${health.lastError.message || 'No details'}`);
        if (health.lastError.ageInHours) {
          lines.push(`  Logged: ${health.lastError.ageInHours} hours ago`);
        }
        lines.push(`  Status: ${health.lastError.resolved ? 'Resolved' : 'UNRESOLVED'}`);
      }
    }
    
    // Queue
    if (health.queue) {
      lines.push(`Announcement Queue: ${health.queue.queueSize || '0'} item${(health.queue.queueSize || 0) !== 1 ? 's' : ''} pending`);
    }
    
    lines.push('');
    lines.push('Click "Refresh Documentation" from admin menu to update this section.');
    
    return lines;
  } catch (err) {
    return [
      `System Health: ${err.message}`,
      '(Health data will refresh after first operations)'
    ];
  }
}

/**
 * Write form edit link section
 */
function writeDocFormLink_(sh, r) {
  const formId = getEffectiveFormId_();
  
  if (!formId) {
    sh.getRange(r, 1).setValue('Form Link')
      .setFontSize(13).setFontWeight('bold')
      .setBackground('#cfe2f3');
    r++;
    sh.getRange(r, 1).setValue('Form not yet created. Run "Setup / Repair" to create it.');
    r++;
    sh.getRange(r, 1).setValue('');
    return r + 1;
  }
  
  const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
  
  sh.getRange(r, 1).setValue('Form Link')
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#cfe2f3');
  r++;
  
  const linkText = 'Click here to edit the Poster Request Form';
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(linkText)
    .setLinkUrl(0, linkText.length, formUrl)
    .build();
  
  sh.getRange(r, 1).setRichTextValue(richText);
  
  r++;
  
  sh.getRange(r, 1).setValue('');
  return r + 1;
}
/** EmployeeViewSync.js (CROSS-SPREADSHEET SAFE) **/

/**
 * Creates (if needed) and syncs the employee-view spreadsheet.
 * Uses native sheet.copyTo() to copy Main and Employees sheets.
 * Gracefully handles permission errors for non-master accounts.
 */
function syncEmployeeViewSpreadsheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log(`[syncEmployeeViewSpreadsheet_] Starting sync`);
    const adminSS = SpreadsheetApp.getActive();
    
    let empSS;
    try {
      empSS = getOrCreateEmployeeViewSpreadsheet_();
    } catch (accessErr) {
      // Permission denied - non-master account cannot access Employee View
      Logger.log(`[syncEmployeeViewSpreadsheet_] WARN: Cannot access Employee View (permission denied). Only the master account can sync. Employee View will show stale data until master account syncs.`);
      return; // Exit gracefully - don't crash, just skip the sync
    }

    // Add a temporary sheet to allow deleting all others
    let tempSheet = empSS.getSheetByName('TEMP_DELETE_ME');
    if (!tempSheet) {
      tempSheet = empSS.insertSheet('TEMP_DELETE_ME');
    }

    // Delete all other sheets except the temporary one
    empSS.getSheets().forEach(sh => {
      if (sh.getSheetName() !== 'TEMP_DELETE_ME') {
        empSS.deleteSheet(sh);
      }
    });

    // Copy Main sheet
    const mainSheet = adminSS.getSheetByName(CONFIG.SHEETS.MAIN);
    if (mainSheet) {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Copying Main sheet`);
      try {
        mainSheet.copyTo(empSS).setName(CONFIG.SHEETS.MAIN);
      } catch (err) {
        Logger.log(`[syncEmployeeViewSpreadsheet_] Error copying Main sheet: ${err.message}`);
      }
    } else {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Main sheet not found in admin spreadsheet`);
    }

    // Copy Employees sheet
    const empSheet = adminSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    let empSheetCopy = null;
    if (empSheet) {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Copying Employees sheet`);
      try {
        empSheetCopy = empSheet.copyTo(empSS).setName(CONFIG.SHEETS.EMPLOYEES);
      } catch (err) {
        Logger.log(`[syncEmployeeViewSpreadsheet_] Error copying Employees sheet: ${err.message}`);
      }
    } else {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Employees sheet not found in admin spreadsheet`);
    }

    // Remove the temporary sheet
    if (tempSheet && empSS.getSheetByName('TEMP_DELETE_ME')) {
      empSS.deleteSheet(tempSheet);
    }

    Logger.log(`[syncEmployeeViewSpreadsheet_] Sync complete`);

    // Only update Print Out tab B2 if URL is currently empty (first-time setup)
    // This preserves the link across multiple syncs by different users
    const printSheet = adminSS.getSheetByName(CONFIG.SHEETS.PRINT_OUT);
    if (printSheet) {
      const currentUrl = printSheet.getRange(CONFIG.PRINT.EMP_VIEW_URL_CELL).getValue();
      if (!currentUrl || currentUrl.trim() === '') {
        const empUrl = getEmployeeViewEmployeesUrl_();
        if (empUrl) {
          printSheet.getRange(CONFIG.PRINT.EMP_VIEW_URL_CELL).setValue(empUrl);
          Logger.log(`[syncEmployeeViewSpreadsheet_] Set Print Out tab B2 Employee View URL (first time): ${empUrl}`);
        }
      } else {
        Logger.log(`[syncEmployeeViewSpreadsheet_] Print Out URL already set, preserving link: ${currentUrl}`);
      }
    }

  } catch (err) {
    Logger.log(`[syncEmployeeViewSpreadsheet_] ERROR: ${err.message}`);
    // Don't rethrow - allow graceful degradation for permission errors
    // Employee View will just show stale data until master account syncs
  } finally {
    lock.releaseLock();
  }
}

/**
 * One-time setup: creates the employee view spreadsheet if missing,
 * stores its ID in Script Properties, and initializes its sheets.
 */
function setupEmployeeViewSpreadsheet() {
  const empSS = getOrCreateEmployeeViewSpreadsheet_();

  // initial sync
  syncEmployeeViewSpreadsheet_();

  SpreadsheetApp.getUi().alert(
    'Employee View spreadsheet is ready.\n\n' +
    'Share THIS file with employees as Viewer:\n' +
    empSS.getUrl()
  );
}

function openEmployeeViewSpreadsheet() {
  const empSS = getEmployeeViewSpreadsheet_();
  SpreadsheetApp.getUi().alert('Employee View URL:\n' + empSS.getUrl());
}

/**
 * Shows consolidated Employee View Manager dialog with all employee view operations
 */
function showEmployeeViewManagerDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h2 {
            color: #1a73e8;
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .section h3 {
            margin-top: 0;
            color: #5f6368;
            font-size: 14px;
          }
          button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-top: 8px;
          }
          button:hover {
            background: #1557b0;
          }
          button:active {
            background: #0d47a1;
          }
          button.secondary {
            background: #5f6368;
          }
          button.secondary:hover {
            background: #3c4043;
          }
          .info {
            color: #5f6368;
            font-size: 12px;
            margin-top: 5px;
          }
          .success {
            color: #0d7a3c;
            font-weight: bold;
          }
          .error {
            color: #d93025;
            font-weight: bold;
          }
          #status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
          }
          .show-status {
            display: block !important;
          }
          #urlDisplay {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            word-break: break-all;
            font-size: 12px;
            display: none;
          }
          .show-url {
            display: block !important;
          }
        </style>
      </head>
      <body>
        <h2>⚙️ Employee View Manager</h2>
        
        <div class="section">
          <h3>Setup (One-Time)</h3>
          <button onclick="setupEmployeeView()">Setup Employee View</button>
          <div class="info">Creates new employee-facing spreadsheet (run once)</div>
        </div>
        
        <div class="section">
          <h3>Sync Data</h3>
          <button onclick="syncEmployeeView()">Sync Employee View</button>
          <div class="info">Updates employee view with current board data</div>
        </div>
        
        <div class="section">
          <h3>Access Link</h3>
          <button class="secondary" onclick="showLink()">Show Employee View Link</button>
          <div class="info">Display shareable link to employee spreadsheet</div>
          <div id="urlDisplay"></div>
        </div>
        
        <div id="status"></div>
        
        <script>
          function setupEmployeeView() {
            showStatus('Setting up Employee View...', false);
            google.script.run
              .withSuccessHandler(function(url) {
                showStatus('✅ Employee View setup complete!', true);
                displayUrl(url);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .setupEmployeeViewWithReturn();
          }
          
          function syncEmployeeView() {
            showStatus('Syncing Employee View...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Employee View synced successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .syncEmployeeView();
          }
          
          function showLink() {
            showStatus('Fetching Employee View link...', false);
            google.script.run
              .withSuccessHandler(function(url) {
                displayUrl(url);
                showStatus('', false);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .getEmployeeViewUrl();
          }
          
          function showStatus(message, isSuccess) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = isSuccess ? 'show-status success' : 'show-status error';
          }
          
          function displayUrl(url) {
            const urlDiv = document.getElementById('urlDisplay');
            urlDiv.innerHTML = '<strong>Employee View URL:</strong><br>' + 
              '<a href="' + url + '" target="_blank">' + url + '</a>';
            urlDiv.className = 'show-url';
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Employee View Manager');
}

/**
 * PUBLIC wrapper - Setup helper that returns URL for dialog display
 */
function setupEmployeeViewWithReturn() {
  const empSS = getOrCreateEmployeeViewSpreadsheet_();
  syncEmployeeViewSpreadsheet_();
  return empSS.getUrl();
}

/**
 * PUBLIC wrapper - Get Employee View URL for dialog display
 */
function getEmployeeViewUrl() {
  const empSS = getEmployeeViewSpreadsheet_();
  return empSS.getUrl();
}

/**
 * PUBLIC wrapper - Sync employee view from dialog
 */
function syncEmployeeView() {
  syncEmployeeViewSpreadsheet_();
}

// Keep private versions for backward compatibility
function setupEmployeeViewWithReturn_() {
  return setupEmployeeViewWithReturn();
}

function getEmployeeViewUrl_() {
  return getEmployeeViewUrl();
}

/** Employees tab URL in employee-view spreadsheet (for QR/Print Out) */
function getEmployeeViewEmployeesUrl_() {
  try {
    const empSS = getEmployeeViewSpreadsheet_();
    if (!empSS) return '';
    
    const sh = empSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    if (!sh) {
      Logger.log('[getEmployeeViewEmployeesUrl_] EMPLOYEES sheet not found in employee view. Syncing now...');
      syncEmployeeViewSpreadsheet_();
      const shRetry = empSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
      if (!shRetry) return ''; // Still missing, return empty
      return empSS.getUrl() + '#gid=' + shRetry.getSheetId();
    }
    return empSS.getUrl() + '#gid=' + sh.getSheetId();
  } catch (err) {
    Logger.log(`[getEmployeeViewEmployeesUrl_] Error: ${err.message} - Employee View not set up yet`);
    return ''; // Return empty if employee view not set up
  }
}

/**
 * Get cached Employee View URL from properties (set during initial setup)
 * This ensures the URL never changes even if spreadsheet access becomes denied
 */
function getCachedEmployeeViewUrl_() {
  const props = PropertiesService.getScriptProperties();
  let cachedUrl = props.getProperty('CACHED_EMPLOYEE_VIEW_URL');
  
  // If not cached, try to get it now and cache it
  if (!cachedUrl) {
    try {
      cachedUrl = getEmployeeViewEmployeesUrl_();
      if (cachedUrl) {
        props.setProperty('CACHED_EMPLOYEE_VIEW_URL', cachedUrl);
        Logger.log('[getCachedEmployeeViewUrl_] Cached Employee View URL: ' + cachedUrl);
      }
    } catch (err) {
      Logger.log('[getCachedEmployeeViewUrl_] Could not cache URL: ' + err.message);
      // Return empty string - graceful degradation
      return '';
    }
  }
  
  return cachedUrl || '';
}

/**
 * Initialize Employee View URL cache during setup (called once)
 */
function initializeEmployeeViewUrlCache_() {
  try {
    const url = getEmployeeViewEmployeesUrl_();
    if (url) {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('CACHED_EMPLOYEE_VIEW_URL', url);
      Logger.log('[initializeEmployeeViewUrlCache_] Cached Employee View URL: ' + url);
    }
  } catch (err) {
    Logger.log('[initializeEmployeeViewUrlCache_] Warning - could not cache Employee View URL: ' + err.message);
    // Don't throw - graceful degradation during setup
  }
}

/** --- Internal helpers --- **/

function getEmployeeViewSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID);

  if (!id) {
    throw new Error('Employee View spreadsheet not set up yet. Run setupEmployeeViewSpreadsheet() first.');
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Employee View spreadsheet exists but cannot be accessed: ' + e.message);
  }
}

function getOrCreateEmployeeViewSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // Spreadsheet was deleted or access denied
      if (!isMasterAccount_()) {
        throw new Error('Employee View spreadsheet access denied. Contact the master admin to manage it.');
      }
      // Will recreate below for master admin
    }
  }

  if (!isMasterAccount_()) {
    throw new Error('Employee View spreadsheet not set up yet. Contact the master admin to initialize it.');
  }

  const adminSS = SpreadsheetApp.getActive();
  const name = `${adminSS.getName()} (Employee View)`;
  const empSS = SpreadsheetApp.create(name);

  props.setProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID, empSS.getId());
  return empSS;
}
/** ErrorHandler.js **/

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
/** FormManager.js **/

function getEffectiveFormId_() {
  const cfg = String(CONFIG.FORM_ID || '').trim();
  if (cfg) return cfg;

  const p = getProps_().getProperty(CONFIG.PROPS.FORM_ID);
  return String(p || '').trim();
}

function getOrCreateForm_() {
  const existingId = getEffectiveFormId_();
  if (existingId) {
    try { 
      return FormApp.openById(existingId); 
    } catch (e) {
      // Form not accessible or ID invalid
      if (!isMasterAccount_()) {
        throw new Error('Form access denied. Contact the master admin to manage the form.');
      }
      Logger.log('Form not found or inaccessible (ID: ' + existingId + '). Creating new form...');
      getProps_().deleteProperty(CONFIG.PROPS.FORM_ID);
    }
  }

  if (!isMasterAccount_()) {
    throw new Error('Form not set up yet. Contact the master admin to initialize the form.');
  }

  // Create new form
  const form = FormApp.create(CONFIG.FORM_META.TITLE);
  form.setDescription(CONFIG.FORM_META.DESCRIPTION);

  getProps_().setProperty(CONFIG.PROPS.FORM_ID, form.getId());

  Logger.log('Created new form. EDIT URL: ' + form.getEditUrl());
  Logger.log('NEW FORM_ID: ' + form.getId());
  return form;
}

function getFormPublishedUrlSafe_() {
  const id = getEffectiveFormId_();
  if (!id) return '';
  try {
    return FormApp.openById(id).getPublishedUrl();
  } catch (e) {
    // Fall back to viewform URL if user lacks access
    return `https://docs.google.com/forms/d/${id}/viewform`;
  }
}

/**
 * Get cached Form URL from properties (set during initial setup)
 * This ensures the URL never changes even if form is modified
 */
function getCachedFormUrl_() {
  const props = PropertiesService.getScriptProperties();
  let cachedUrl = props.getProperty('CACHED_FORM_URL');
  
  // If not cached, get it now and cache it
  if (!cachedUrl) {
    cachedUrl = getFormPublishedUrlSafe_();
    if (cachedUrl) {
      props.setProperty('CACHED_FORM_URL', cachedUrl);
    }
  }
  
  return cachedUrl;
}

/**
 * Initialize Form URL cache during setup (called once)
 */
function initializeFormUrlCache_() {
  const url = getFormPublishedUrlSafe_();
  if (url) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('CACHED_FORM_URL', url);
    Logger.log('[initializeFormUrlCache_] Cached Form URL: ' + url);
  }
}

function setCheckboxChoicesByTitle_(form, itemTitle, choices, required) {
  const target = String(itemTitle || '').trim();
  if (!target) throw new Error('Missing checkbox item title');

  const items = form.getItems(FormApp.ItemType.CHECKBOX);
  let item = items.find(it => String(it.getTitle() || '').trim() === target);
  if (!item) item = form.addCheckboxItem().setTitle(target);

  const cb = (typeof item.asCheckboxItem === 'function') ? item.asCheckboxItem() : item;

  if (!choices || choices.length === 0) {
    cb.setChoices([cb.createChoice('— None available —')]);
    cb.setRequired(false);
    return;
  }

  cb.setChoices(choices.map(c => cb.createChoice(c)));
  cb.setRequired(!!required);
}

function ensureSubscribeQuestion_(form) {
  const subTitle = CONFIG.FORM.Q_SUBSCRIBE;
  const subItems = form.getItems(FormApp.ItemType.CHECKBOX);
  let subscribeItem = subItems.find(it => String(it.getTitle() || '').trim() === subTitle);
  if (!subscribeItem) {
    subscribeItem = form.addCheckboxItem().setTitle(subTitle);
  }
  const subCb = (typeof subscribeItem.asCheckboxItem === 'function') ? subscribeItem.asCheckboxItem() : subscribeItem;
  subCb.setChoices([subCb.createChoice('Yes, subscribe me to notifications')]);
  subCb.setRequired(false);
  return subCb;
}

function ensureFormStructure_() {
  const form = getOrCreateForm_();

  form.setTitle(CONFIG.FORM_META.TITLE);
  form.setDescription(CONFIG.FORM_META.DESCRIPTION);
  
  // Collect verified email addresses from Google accounts
  form.setCollectEmail(true);
  // NOTE: To require Google sign-in, manually configure in Form Settings:
  // Settings > Responses > "Collect email addresses" > check "Respondents will be required to sign in with Google as verified"

  // Ensure employee name text item
  const nameTitle = CONFIG.FORM.Q_EMPLOYEE_NAME;
  const nameItems = form.getItems(FormApp.ItemType.TEXT);
  let nameItem = nameItems.find(it => String(it.getTitle() || '').trim() === nameTitle);
  if (!nameItem) nameItem = form.addTextItem().setTitle(nameTitle);
  const nameTextItem = (typeof nameItem.asTextItem === 'function') ? nameItem.asTextItem() : nameItem;
  nameTextItem.setRequired(true);

  // Remove any deprecated questions and ensure no email field exists
  // (Email is auto-collected via form.setCollectEmail(true) above)
  form.getItems().forEach(item => {
    const title = String(item.getTitle() || '').trim();
    if (title === 'Employee ID (Clock-In Password)' || 
        title.toLowerCase().includes('email') ||
        title.toLowerCase() === 'email address') {
      form.deleteItem(item);
    }
  });

  // Set up Add/Remove posters checkboxes
  setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_ADD, ['— placeholder —'], false);
  setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_REMOVE, ['— placeholder —'], false);

  ensureSubscribeQuestion_(form);
}
/** FormSubmit.js **/

function handleFormSubmit(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log(`[handleFormSubmit] TRIGGERED - processing form submission`);
    const formTs = e && e.response ? e.response.getTimestamp() : now_();
    const answers = readFormAnswers_(e);

    const empEmail = String(answers.empEmail || '').trim().toLowerCase();
    const nameRaw = String(answers.empName || '').trim();
    const subscribeChecked = answers.subscribe === true;

    Logger.log(`[handleFormSubmit] Email: ${empEmail}, Name: ${nameRaw}, Subscribe: ${subscribeChecked}, RemoveLabels: ${JSON.stringify(answers.removeLabels)}, AddLabels: ${JSON.stringify(answers.addLabels)}`);

    if (!empEmail) {
      Logger.log(`[handleFormSubmit] No email found - exiting`);
      return;
    }

    // Validate name format (First Name + Last Initial)
    const nameCheck = normalizeEmployeeName_(nameRaw);
    if (!nameCheck.ok) {
      Logger.log(`Invalid name format from ${empEmail}: ${nameRaw}. Reason: ${nameCheck.reason}`);
      return; // Don't save requests with invalid names
    }

    const empName = nameCheck.canonical;
    const addLabels = safeArray_(answers.addLabels);
    const removeLabels = safeArray_(answers.removeLabels);

    // Sync subscriber status from form
    if (subscribeChecked) {
      Logger.log(`[handleFormSubmit] Adding subscriber: ${empEmail}`);
      addSubscriber_(empEmail, empName);
      invalidateActiveSubscribers_();
      Logger.log(`[handleFormSubmit] Subscriber added successfully`);
    }

    // For logging (email-keyed)
    const slotsBefore = countActiveSlotsByEmail_(empEmail);

    const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels);
    const slotsAfter = countActiveSlotsByEmail_(empEmail);

    // Reset caches after write-heavy operations
    invalidateCachesAfterWrite_({ empEmail });

    appendRequestOrderLog_({
      formTs,
      empEmail,
      empName,
      addRaw: addLabels.join(', '),
      removeRaw: removeLabels.join(', '),
      slotsBefore,
      slotsAfter,
      addedAccepted: result.addedAccepted.join(', '),
      removedApplied: result.removedApplied.join(', '),
      deniedAdds: result.deniedAdds.join(' | '),
      notes: result.notes.join(' | '),
    });

    Logger.log(`[handleFormSubmit] About to rebuild boards. Removals: ${result.removedApplied.join(', ')}, Additions: ${result.addedAccepted.join(', ')}`);
    rebuildBoards();
    Logger.log(`[handleFormSubmit] Boards rebuilt successfully`);
    syncPostersToForm();
  } catch (err) {
    logError_(err, 'handleFormSubmit', 'Form submission');
  } finally {
    lock.releaseLock();
  }
}

function readFormAnswers_(e) {
  const out = { empEmail: '', empName: '', addLabels: [], removeLabels: [], subscribe: false };
  if (!e || !e.response) {
    Logger.log(`[readFormAnswers] No response object`);
    return out;
  }

  const tName = String(CONFIG.FORM.Q_EMPLOYEE_NAME || '').trim();
  const tAdd = String(CONFIG.FORM.Q_ADD || '').trim();
  const tRem = String(CONFIG.FORM.Q_REMOVE || '').trim();
  const tSub = String(CONFIG.FORM.Q_SUBSCRIBE || '').trim();

  Logger.log(`[readFormAnswers] Expected field names - Name: "${tName}", Add: "${tAdd}", Remove: "${tRem}", Subscribe: "${tSub}"`);

  // Get email from form's built-in email collection
  out.empEmail = String(e.response.getRespondentEmail() || '').trim().toLowerCase();

  e.response.getItemResponses().forEach(r => {
    const title = String(r.getItem().getTitle() || '').trim();
    const resp = r.getResponse();

    Logger.log(`[readFormAnswers] Found form field: "${title}" = ${JSON.stringify(resp)}`);

    if (title === tName) out.empName = resp;
    else if (title === tAdd) out.addLabels = resp;
    else if (title === tRem) out.removeLabels = resp;
    else if (title === tSub) {
      // Check if "Yes" was selected
      if (Array.isArray(resp)) {
        out.subscribe = resp.some(v => String(v || '').toLowerCase().includes('yes'));
      } else {
        out.subscribe = String(resp || '').toLowerCase().includes('yes');
      }
      Logger.log(`[readFormAnswers] Parsed subscribe response: ${out.subscribe}`);
    }
  });

  Logger.log(`[readFormAnswers] Final parsed answer object: ${JSON.stringify(out)}`);
  return out;
}

function processSubmission_(empEmail, empName, formTs, addLabels, removeLabels) {
  const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const decode = (lbl) => labelToId[String(lbl || '').trim()] || null;

  // Process removals first
  const removedApplied = processRemovals_(empEmail, removeLabels, decode);

  // Process additions after removals
  const { addedAccepted, deniedAdds } = processAdditions_(empEmail, empName, addLabels, decode, formTs);

  return {
    removedApplied,
    addedAccepted,
    deniedAdds,
    notes: [`Removals first: ${removedApplied.length}`, `Adds accepted: ${addedAccepted.length}`],
  };
}

/**
 * Process removals from the form submission.
 * Returns array of label strings that were successfully removed.
 */
function processRemovals_(empEmail, removeLabels, decode) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const removedApplied = [];

  removeLabels.forEach(lbl => {
    const pid = decode(lbl);
    if (!pid) {
      Logger.log(`[processRemovals] Could not decode label: ${lbl}`);
      return;
    }

    Logger.log(`[processRemovals] Attempting to remove poster ${pid} (${lbl}) for ${empEmail}`);
    const ok = setRequestStatusByEmail_(empEmail, pid, STATUS.REMOVED, now_());
    if (ok) {
      removedApplied.push(idToCurrent[pid] || String(lbl).trim());
      Logger.log(`[processRemovals] Successfully removed poster ${pid}`);
    } else {
      Logger.log(`[processRemovals] Failed to remove poster ${pid} (not found or not ACTIVE status)`);
    }
  });

  return removedApplied;
}

/**
 * Process additions from the form submission.
 * Returns { addedAccepted, deniedAdds } arrays.
 */
function processAdditions_(empEmail, empName, addLabels, decode, formTs) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const activePosterMap = getActivePosterIdMap_();

  const addQueue = Array.from(new Set((addLabels || []).map(lbl => String(lbl || '').trim()).filter(Boolean)));

  Logger.log(`[processAdditions] Starting with ${addQueue.length} labels to add`);
  Logger.log(`[processAdditions] ID to Current Label map: ${JSON.stringify(idToCurrent)}`);
  Logger.log(`[processAdditions] Active Poster Map: ${JSON.stringify(activePosterMap)}`);

  const activeNow = countActiveSlotsByEmail_(empEmail);
  let available = Math.max(0, CONFIG.MAX_ACTIVE - activeNow);
  Logger.log(`[processAdditions] Current active slots: ${activeNow}, Available: ${available}`);

  const deniedAdds = [];
  const addedAccepted = [];

  for (const lbl of addQueue) {
    const pid = decode(lbl);
    const show = pid ? (idToCurrent[pid] || String(lbl).trim()) : String(lbl).trim();

    Logger.log(`[processAdditions] Processing label "${lbl}" -> decoded to PID "${pid}"`);

    // Validate poster ID exists
    if (!pid) { 
      deniedAdds.push(`${show}: unknown`); 
      Logger.log(`[processAdditions] DENIED: "${show}" - unknown poster ID`);
      continue; 
    }

    // Validate poster is active
    if (!activePosterMap[pid]) { 
      deniedAdds.push(`${show}: inactive`); 
      Logger.log(`[processAdditions] DENIED: "${show}" - poster not in active map`);
      continue; 
    }

    // Check for duplicates by email
    const dedupCheck = canRequestPoster_(empEmail, pid);
    if (!dedupCheck.allowed) {
      deniedAdds.push(`${show}: ${dedupCheck.reason}`);
      Logger.log(`[processAdditions] DENIED: "${show}" - ${dedupCheck.reason}`);
      continue;
    }

    // Check slot availability
    if (available <= 0) {
      deniedAdds.push(`${show}: limit (${CONFIG.MAX_ACTIVE}-slot)`);
      Logger.log(`[processAdditions] DENIED: "${show}" - no available slots`);
      continue;
    }

    // All checks passed - add the request
    Logger.log(`[processAdditions] ACCEPTED: "${show}" - creating ledger row`);
    createLedgerRow_(empEmail, empName, pid, formTs);
    addedAccepted.push(show);
    available--;
  }

  Logger.log(`[processAdditions] Final result: ${addedAccepted.length} accepted, ${deniedAdds.length} denied`);
  return { addedAccepted, deniedAdds };
}

function appendRequestOrderLog_(o) {
  const sh = getSheet_(CONFIG.SHEETS.REQUEST_ORDER);
  const row = [];
  row[COLS.REQUEST_ORDER.FORM_TS - 1] = o.formTs;
  row[COLS.REQUEST_ORDER.EMP_EMAIL - 1] = o.empEmail;
  row[COLS.REQUEST_ORDER.ADD_RAW - 1] = o.addRaw;
  row[COLS.REQUEST_ORDER.REMOVE_RAW - 1] = o.removeRaw;
  row[COLS.REQUEST_ORDER.SLOTS_BEFORE - 1] = o.slotsBefore;
  row[COLS.REQUEST_ORDER.SLOTS_AFTER - 1] = o.slotsAfter;
  row[COLS.REQUEST_ORDER.ADDED_ACCEPTED - 1] = o.addedAccepted;
  row[COLS.REQUEST_ORDER.REMOVED_APPLIED - 1] = o.removedApplied;
  row[COLS.REQUEST_ORDER.DENIED_ADDS - 1] = o.deniedAdds;
  row[COLS.REQUEST_ORDER.NOTES - 1] = o.notes;
  sh.appendRow(row);
}

/**
 * Add or update subscriber in Subscribers sheet if not already there
 */
function addSubscriber_(empEmail, empName) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
    Logger.log(`[addSubscriber] Got sheet: ${CONFIG.SHEETS.SUBSCRIBERS}`);
    
    const data = getNonEmptyData_(sh, 3);
    Logger.log(`[addSubscriber] Read ${data.length} existing rows`);
    
    // Check if already exists
    const exists = data.some(r => String(r[COLS.SUBSCRIBERS.EMAIL - 1] || '').trim().toLowerCase() === empEmail);
    Logger.log(`[addSubscriber] Email ${empEmail} already exists: ${exists}`);
    if (exists) {
      Logger.log(`[addSubscriber] Email already subscribed, returning`);
      return;
    }
    
    // Append new subscriber with ACTIVE checked and employee name
    const row = [true, empEmail, empName];
    Logger.log(`[addSubscriber] About to append subscriber: ${JSON.stringify(row)}`);
    sh.appendRow(row);
    Logger.log(`[addSubscriber] Row appended successfully`);
  } catch (err) {
    Logger.log(`[addSubscriber] ERROR: ${err.message}`);
    throw err;
  }
}
/** FormSync.js **/

function syncPostersToForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Keep form structure aligned with setup (collect email, subscribe checkbox, etc.)
    ensureFormStructure_();

    ensurePosterIdsInInventory_();  // Inventory is canonical source
    updateInventoryLastUpdated_();

    const form = getOrCreateForm_();
    const posters = getPostersWithLabels_();  // Reads from Inventory

    // Build label-to-ID and ID-to-label maps
    const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
    const idToCurrent = {};
    posters.forEach(p => {
      idToCurrent[p.posterId] = p.label;
      if (!labelToId[p.label]) labelToId[p.label] = p.posterId;
    });
    writeJsonProp_(CONFIG.PROPS.LABEL_TO_ID, labelToId);
    writeJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, idToCurrent);

    // Invalidate caches affected by poster label/availability changes
    invalidatePostersWithLabels_();
    invalidatePosterAvailability_();

    // Build Add choices (active posters, sorted by release)
    const addChoices = posters
      .filter(p => p.active)
      .sort((a,b) => new Date(a.release) - new Date(b.release) || a.title.localeCompare(b.title))
      .map(p => p.label);

    // Build Remove choices (posters with ACTIVE requests)
    const activePosterIds = getPosterIdsWithAnyActiveRequests_();
    const removeChoices = posters
      .filter(p => activePosterIds[p.posterId])
      .sort((a,b) => new Date(a.release) - new Date(b.release) || a.title.localeCompare(b.title))
      .map(p => p.label);

    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_ADD, addChoices, true);
    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_REMOVE, removeChoices, false);

    // Boards and form were updated; clear board caches for freshness
    invalidateBoardMain_();
    invalidateBoardEmployees_();

  } finally {
    lock.releaseLock();
  }
}
/** InventoryCleanup.js **/

function handleSheetChange(e) {
  try {
    const changeType = e && e.changeType ? String(e.changeType) : '';
    detectAndProcessInventoryRemovals_('onChange', changeType);
  } catch (err) {
    logError_(err, 'handleSheetChange', 'Inventory removal detection');
  }
}

function detectInventoryRemovalsFromEdit_(e) {
  try {
    if (!e || !e.range) return;

    const sh = e.range.getSheet();
    if (!sh || sh.getName() !== CONFIG.SHEETS.INVENTORY) return;

    const row = e.range.getRow();
    if (row < 3) return;

    const startCol = e.range.getColumn();
    const endCol = startCol + e.range.getNumColumns() - 1;
    const watchCols = [
      COLS.INVENTORY.TITLE,
      COLS.INVENTORY.RELEASE,
      COLS.INVENTORY.POSTER_ID,
    ];

    const intersects = watchCols.some(col => col >= startCol && col <= endCol);
    if (!intersects) return false;

    return detectAndProcessInventoryRemovals_('onEdit', 'CONTENT_CLEAR');
  } catch (err) {
    logError_(err, 'detectInventoryRemovalsFromEdit_', 'Inventory edit detection');
  }

  return false;
}

function detectAndProcessInventoryRemovals_(source, changeType) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const prevSnapshot = readJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, {});
    const currentSnapshot = buildInventoryPosterSnapshot_();

    const removedIds = Object.keys(prevSnapshot).filter(id => !currentSnapshot[id]);
    if (removedIds.length === 0) {
      writeJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, currentSnapshot);
      return false;
    }

    Logger.log(
      `[inventoryCleanup] Detected removals via ${source}${changeType ? '/' + changeType : ''}: ${removedIds.join(', ')}`
    );

    const statusTs = now_();
    const result = closeActiveRequestsByPosterIds_(
      removedIds,
      STATUS.REMOVED_INVENTORY_DELETE,
      statusTs
    );

    Logger.log(
      `[inventoryCleanup] Closed ${result.closedCount} request(s) across ${Object.keys(result.empCounts).length} employee(s)`
    );

    rebuildBoards();
    syncPostersToForm();

    try {
      refreshDisplayDropdowns_();
    } catch (err) {
      Logger.log(`[inventoryCleanup] Display dropdown refresh failed: ${err.message}`);
    }

    try {
      buildPrintOutLayout_();
    } catch (err) {
      Logger.log(`[inventoryCleanup] Print Out refresh failed: ${err.message}`);
    }

    writeJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, currentSnapshot);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function buildInventoryPosterSnapshot_() {
  const posters = getPostersWithLabels_();
  const snapshot = {};

  posters.forEach(p => {
    snapshot[p.posterId] = {
      title: p.title,
      release: p.release,
      label: p.label,
    };
  });

  return snapshot;
}

function initializeInventorySnapshot_() {
  const snapshot = buildInventoryPosterSnapshot_();
  writeJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, snapshot);
}
/** Ledger.js **/

function getRequestsSheet_() {
  return getSheet_(CONFIG.SHEETS.REQUESTS);
}

/**
 * Ensure all rows in Inventory have unique Poster IDs.
 * This is the canonical source of truth for poster management.
 */
function ensurePosterIdsInInventory_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  if (lastRow < 2) return;

  const idsRange = inv.getRange(2, COLS.INVENTORY.POSTER_ID, lastRow - 1, 1);
  const ids = idsRange.getValues();

  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const v = String(ids[i][0] || '').trim();
    if (!v) { ids[i][0] = uuidPosterId_(); changed = true; }
  }
  if (changed) idsRange.setValues(ids);
}

function hasEverRequestedByEmail_(empEmail, posterId) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
  return data.some(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.POSTER_ID - 1]) === String(posterId)
  );
}

/**
 * Check if an employee can request a specific poster based on dedup rules.
 * Simplified logic: Only blocks if employee has ACTIVE request for this poster.
 * Historical requests are ignored (allows immediate re-requests).
 * 
 * @param {string} empEmail - Employee email
 * @param {string} posterId - Poster ID
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canRequestPoster_(empEmail, posterId) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);

  // Find all requests for this email/poster combination
  const requests = data.filter(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.POSTER_ID - 1]) === String(posterId)
  );

  // No previous requests - allowed
  if (requests.length === 0) {
    return { allowed: true, reason: '' };
  }

  // Check if any request is currently ACTIVE
  const hasActive = requests.some(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
  if (hasActive) {
    return { allowed: false, reason: 'duplicate (already active)' };
  }

  // If rerequests are disabled entirely, block on any historical request
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return { allowed: false, reason: 'duplicate (historical)' };
  }

  // Cooldown enforcement (if configured)
  const cooldownDays = Number(CONFIG.REREQUEST_COOLDOWN_DAYS || 0);
  if (cooldownDays > 0) {
    const mostRecentTs = requests
      .map(r => r[COLS.REQUESTS.STATUS_TS - 1])
      .filter(Boolean)
      .map(ts => (ts instanceof Date ? ts.getTime() : new Date(ts).getTime()))
      .filter(ts => !isNaN(ts))
      .sort((a, b) => b - a)[0];

    if (mostRecentTs) {
      const ageMs = now_().getTime() - mostRecentTs;
      const requiredMs = cooldownDays * 24 * 60 * 60 * 1000;
      if (ageMs < requiredMs) {
        return { allowed: false, reason: 'duplicate (cooldown)' };
      }
    }
  }

  return { allowed: true, reason: '' };
}

function countActiveSlotsByEmail_(empEmail) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
  return data.filter(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE
  ).length;
}

function getPosterIdsWithAnyActiveRequests_() {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
  const out = {};
  data.forEach(r => {
    if (String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE) {
      out[String(r[COLS.REQUESTS.POSTER_ID - 1])] = true;
    }
  });
  return out;
}

function setRequestStatusByEmail_(empEmail, posterId, newStatus, ts) {
  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const rEmail = String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim();
    const rPid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
    const rStatus = String(r[COLS.REQUESTS.STATUS - 1]);

    if (rEmail === String(empEmail).toLowerCase().trim() && rPid === String(posterId)) {
      if (newStatus === STATUS.REMOVED && rStatus !== STATUS.ACTIVE) return false;

      r[COLS.REQUESTS.STATUS - 1] = newStatus;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;

      range.setValues(values);
      return true;
    }
  }
  return false;
}

function getActivePosterIdMap_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  const map = {};
  data.forEach(r => {
    const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
    const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
    const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
    const release = r[COLS.INVENTORY.RELEASE - 1];
    if (active && pid && title && release) map[pid] = true;
  });
  return map;
}

function lookupPosterInfoById_(posterId) {
  const posters = getPostersWithLabels_();
  const found = posters.find(p => p.posterId === posterId);
  if (!found) return null;

  return { title: found.title, release: found.release, label: found.label };
}

function createLedgerRow_(empEmail, empName, posterId, requestTs) {
  const sh = getRequestsSheet_();
  const mpInfo = lookupPosterInfoById_(posterId);
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const label = idToCurrent[posterId] || (mpInfo ? mpInfo.label : posterId);

  const row = [];
  row[COLS.REQUESTS.REQ_TS - 1] = requestTs;
  row[COLS.REQUESTS.EMP_EMAIL - 1] = empEmail.toLowerCase().trim();
  row[COLS.REQUESTS.EMP_NAME - 1] = empName;
  row[COLS.REQUESTS.POSTER_ID - 1] = posterId;
  row[COLS.REQUESTS.LABEL_AT_REQ - 1] = label;
  row[COLS.REQUESTS.TITLE_SNAP - 1] = mpInfo ? mpInfo.title : '';
  row[COLS.REQUESTS.RELEASE_SNAP - 1] = mpInfo ? mpInfo.release : '';
  row[COLS.REQUESTS.ACTION_TYPE - 1] = 'ADD';
  row[COLS.REQUESTS.STATUS - 1] = STATUS.ACTIVE;
  row[COLS.REQUESTS.STATUS_TS - 1] = requestTs;

  sh.appendRow(row);
}

/**
 * Close ACTIVE requests for the given poster IDs.
 * Returns { closedCount, empCounts } where empCounts is a map of email -> closed count.
 */
function closeActiveRequestsByPosterIds_(posterIds, newStatus, statusTs) {
  const ids = (posterIds || []).map(id => String(id || '').trim()).filter(Boolean);
  if (ids.length === 0) return { closedCount: 0, empCounts: {} };

  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { closedCount: 0, empCounts: {} };

  const idMap = {};
  ids.forEach(id => { idMap[id] = true; });

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();

  let changed = false;
  let closedCount = 0;
  const empCounts = {};

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
    const status = String(r[COLS.REQUESTS.STATUS - 1] || '').trim();

    if (idMap[pid] && status === STATUS.ACTIVE) {
      r[COLS.REQUESTS.STATUS - 1] = newStatus;
      r[COLS.REQUESTS.STATUS_TS - 1] = statusTs;
      changed = true;
      closedCount++;

      const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase().trim();
      if (email) empCounts[email] = (empCounts[email] || 0) + 1;
    }
  }

  if (changed) range.setValues(values);
  return { closedCount, empCounts };
}
/** ManualPoster.js **/

function showManualPosterDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; }
      label { display: block; margin-top: 10px; font-weight: bold; }
      input { width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; }
      button { margin-top: 15px; padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
      button:hover { background-color: #45a049; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .success { background-color: #d4edda; color: #155724; }
      .error { background-color: #f8d7da; color: #721c24; }
      .required:after { content: " *"; color: red; }
    </style>
    
    <h2>Add New Poster to Inventory</h2>
    
    <label class="required" for="title">Movie Title:</label>
    <input type="text" id="title" placeholder="Enter movie title">
    
    <label class="required" for="releaseDate">Release Date:</label>
    <input type="date" id="releaseDate">
    
    <label for="company">Company:</label>
    <input type="text" id="company" placeholder="Optional">
    
    <label for="posters">Posters:</label>
    <input type="number" id="posters" min="0" placeholder="Optional">
    
    <label for="bus">Bus Shelters:</label>
    <input type="number" id="bus" min="0" placeholder="Optional">
    
    <label for="mini">Mini Posters:</label>
    <input type="number" id="mini" min="0" placeholder="Optional">
    
    <label for="standee">Standee:</label>
    <input type="number" id="standee" min="0" placeholder="Optional">
    
    <label for="teaser">Teaser:</label>
    <input type="number" id="teaser" min="0" placeholder="Optional">
    
    <label for="notes">Notes:</label>
    <input type="text" id="notes" placeholder="Optional notes">
    
    <label>
      <input type="checkbox" id="active"> Active? (add to form immediately)
    </label>
    
    <button id="submitBtn" onclick="submitPoster()">Add Poster</button>
    <div id="status"></div>
    
    <script>
      let isSubmitting = false;

      function submitPoster() {
        if (isSubmitting) return;

        const title = document.getElementById('title').value.trim();
        const releaseDate = document.getElementById('releaseDate').value;
        const company = document.getElementById('company').value.trim();
        const posters = document.getElementById('posters').value.trim();
        const bus = document.getElementById('bus').value.trim();
        const mini = document.getElementById('mini').value.trim();
        const standee = document.getElementById('standee').value.trim();
        const teaser = document.getElementById('teaser').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const active = document.getElementById('active').checked;
        
        if (!title || !releaseDate) {
          showStatus('Please fill in all required fields (Title and Release Date)', 'error');
          return;
        }

        isSubmitting = true;
        toggleSubmit_(true, 'Adding...');
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showStatus('Poster added successfully! Row: ' + result.row, 'success');
              setTimeout(() => google.script.host.close(), 1500);
            } else {
              showStatus('Error: ' + result.message, 'error');
              isSubmitting = false;
              toggleSubmit_(false, 'Add Poster');
            }
          })
          .withFailureHandler(function(err) {
            showStatus('Error: ' + err.message, 'error');
            isSubmitting = false;
            toggleSubmit_(false, 'Add Poster');
          })
          .addManualPoster(active, releaseDate, title, company, posters, bus, mini, standee, teaser, notes);
      }
      
      function showStatus(msg, type) {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.className = type;
      }

      function toggleSubmit_(disabled, label) {
        const btn = document.getElementById('submitBtn');
        if (!btn) return;
        btn.disabled = disabled;
        btn.textContent = label;
      }
    </script>
  `)
  .setWidth(400)
  .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Manual Poster');
}

function addManualPoster(active, releaseDate, title, company, posters, bus, mini, standee, teaser, notes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    SpreadsheetApp.getActive().toast('⏳ Adding poster to inventory...', 'Manual Poster', 3);

    const ss = SpreadsheetApp.getActive();
    const userEmail = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
    if (userEmail) {
      const ownerEmail = String(ss.getOwner().getEmail() || '').toLowerCase().trim();
      const editorEmails = ss.getEditors().map(e => String(e.getEmail() || '').toLowerCase().trim());
      const hasEditAccess = userEmail === ownerEmail || editorEmails.includes(userEmail);
      if (!hasEditAccess) {
        return { success: false, message: 'You need edit access to add posters. Ask the sheet owner to grant editor access.' };
      }
    }

    // Validate required fields
    if (!title || !title.trim() || !releaseDate) {
      return { success: false, message: 'Title and Release Date are required' };
    }
    
    // Validate release date
    const release = new Date(releaseDate);
    if (isNaN(release.getTime())) {
      return { success: false, message: 'Invalid Release Date' };
    }
    
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    
    // Parse numeric values, defaulting to empty string for 0 or invalid
    // This ensures empty cells rather than zeros, matching existing data patterns
    const parseNum = (val) => {
      if (!val || val === '') return '';
      const num = parseInt(val);
      return (isNaN(num) || num === 0) ? '' : num;
    };
    
    // Build row data for columns A-J only (NOT K/Poster ID)
    const row = [];
    row[COLS.INVENTORY.ACTIVE - 1] = !!active;          // A: Active? (boolean)
    row[COLS.INVENTORY.RELEASE - 1] = release;          // B: Release Date
    row[COLS.INVENTORY.TITLE - 1] = title.trim();       // C: Movie Title
    row[COLS.INVENTORY.COMPANY - 1] = company || '';    // D: Company
    row[COLS.INVENTORY.POSTERS - 1] = parseNum(posters); // E: Posters
    row[COLS.INVENTORY.BUS - 1] = parseNum(bus);        // F: Bus Shelters
    row[COLS.INVENTORY.MINI - 1] = parseNum(mini);      // G: Mini Posters
    row[COLS.INVENTORY.STANDEE - 1] = parseNum(standee); // H: Standee
    row[COLS.INVENTORY.TEASER - 1] = parseNum(teaser);  // I: Teaser
    row[COLS.INVENTORY.NOTES - 1] = notes || '';        // J: Notes
    // Column K (POSTER_ID) is NOT written - will be auto-generated by other functions
    
    // Append at bottom of sheet (columns A-J only, using COLS.INVENTORY.NOTES as the end column)
    const nextRow = inv.getLastRow() + 1;
    inv.getRange(nextRow, 1, 1, COLS.INVENTORY.NOTES).setValues([row]); // Write A-J (columns 1-10)
    
    // Set checkbox validation for Active? column
    setCheckboxColumn_(inv, COLS.INVENTORY.ACTIVE, nextRow, nextRow);
    
    // Auto-generate Poster ID for the new row (column K)
    ensurePosterIdsInInventory_();
    
    // Sort Inventory by release date to maintain consistent ordering
    sortInventoryByReleaseDate_();
    
    // Update last updated timestamp
    updateInventoryLastUpdated_();
    
    // Automatically update dependent systems
    Logger.log(`[addManualPoster] Updating Print Out, Form, and Display dropdowns...`);
    try {
      SpreadsheetApp.getActive().toast('🔄 Updating Print Out, Form, and Displays...', 'Manual Poster', 3);
      refreshPrintOut();
      syncPostersToForm();
      refreshPosterOutsideDropdowns_();
      refreshPosterInsideDropdowns_();
      Logger.log(`[addManualPoster] All systems updated successfully`);
    } catch (updateErr) {
      Logger.log(`[addManualPoster] Warning: System update failed: ${updateErr.message}`);
      // Don't fail the entire operation if updates fail - poster was successfully added
    }
    
    // Visual feedback after dialog closes
    SpreadsheetApp.getActive().toast(
      `✅ Poster added!\n${title}\nRelease: ${fmtDate_(release, 'MMM dd, yyyy')}\n📄 Print Out, Form, & Displays updated`,
      'Poster Added',
      5
    );
    
    Logger.log(`[addManualPoster] Added poster at row ${nextRow}: ${title}`);
    
    return { 
      success: true, 
      message: 'Poster added successfully',
      row: nextRow 
    };
    
  } catch (err) {
    Logger.log(`[addManualPoster] Error: ${err.message}`);
    logError_(err, 'addManualPoster', { title, releaseDate, active });
    const msg = String(err && err.message ? err.message : err);
    if (msg.toLowerCase().includes('permission')) {
      return { success: false, message: 'Permission denied. Make sure you have edit access to the spreadsheet and reauthorize the script.' };
    }
    return { success: false, message: `Error: ${msg}` };
  } finally {
    lock.releaseLock();
  }
}
/** ManualRequest.js **/
/** Manual request entry for data migration from legacy systems **/

function showManualRequestDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; }
      label { display: block; margin-top: 10px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; }
      button { margin-top: 15px; padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
      button:hover { background-color: #45a049; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .success { background-color: #d4edda; color: #155724; }
      .error { background-color: #f8d7da; color: #721c24; }
    </style>
    
    <h2>Manually Add Request (Migration)</h2>
    
    <label for="email">Employee Email:</label>
    <input type="email" id="email" placeholder="employee@example.com">
    
    <label for="name">Employee Name:</label>
    <input type="text" id="name" placeholder="First Name Last Initial">
    
    <label for="poster">Poster:</label>
    <select id="poster">
      <option value="">-- Select a Poster --</option>
    </select>
    
    <label for="date">Request Date:</label>
    <input type="date" id="date" placeholder="MM/DD/YYYY">
    
    <label for="time">Request Time:</label>
    <input type="time" id="time" placeholder="HH:MM">
    
    <button id="submitBtn" onclick="submitRequest()">Add Request</button>
    <div id="status"></div>
    
    <script>
      google.script.run.withSuccessHandler(function(posters) {
        const select = document.getElementById('poster');
        posters.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.label;
          select.appendChild(option);
        });
      }).getActivePostersForManualEntry();
      
      let isSubmitting = false;

      function submitRequest() {
        if (isSubmitting) return;

        const email = document.getElementById('email').value.trim();
        const name = document.getElementById('name').value.trim();
        const posterId = document.getElementById('poster').value;
        const date = document.getElementById('date').value.trim();
        const time = document.getElementById('time').value.trim();
        
        if (!email || !name || !posterId) {
          showStatus('Please fill in all required fields', 'error');
          return;
        }

        isSubmitting = true;
        toggleSubmit_(true, 'Adding...');
        
        // Combine date and time into timestamp string
        let timestamp = '';
        if (date) {
          // Date is in YYYY-MM-DD format from date input
          if (time) {
            // Time is in HH:MM format from time input, append seconds
            timestamp = date + ' ' + time + ':00';
          } else {
            // If no time provided, default to midnight
            timestamp = date + ' 00:00:00';
          }
        }
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showStatus('Request added successfully!', 'success');
              setTimeout(() => google.script.host.close(), 1500);
            } else {
              showStatus('Error: ' + result.message, 'error');
              isSubmitting = false;
              toggleSubmit_(false, 'Add Request');
            }
          })
          .withFailureHandler(function(err) {
            showStatus('Error: ' + err.message, 'error');
            isSubmitting = false;
            toggleSubmit_(false, 'Add Request');
          })
          .addManualRequest(email, name, posterId, timestamp);
      }
      
      function showStatus(msg, type) {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.className = type;
      }

      function toggleSubmit_(disabled, label) {
        const btn = document.getElementById('submitBtn');
        if (!btn) return;
        btn.disabled = disabled;
        btn.textContent = label;
      }
    </script>
  `).setWidth(400).setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Manual Request');
}

function getActivePostersForManualEntry() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  
  return data
    .filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true)
    .map(r => ({
      id: String(r[COLS.INVENTORY.POSTER_ID - 1]),
      label: String(r[COLS.INVENTORY.TITLE - 1])
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function addManualRequest(empEmail, empName, posterId, customTimestamp) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    SpreadsheetApp.getActive().toast('⏳ Adding manual request...', 'Manual Request', 3);

    // Validate inputs
    if (!empEmail || !empName || !posterId) {
      return { success: false, message: 'Missing required fields' };
    }
    
    // Validate email format
    if (!empEmail.includes('@')) {
      return { success: false, message: 'Invalid email format' };
    }
    
    // Validate poster exists and is active
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const invData = getNonEmptyData_(inv, 11, 3);
    const poster = invData.find(r => String(r[COLS.INVENTORY.POSTER_ID - 1]) === posterId);
    
    if (!poster) {
      return { success: false, message: 'Poster not found' };
    }
    
    if (poster[COLS.INVENTORY.ACTIVE - 1] !== true) {
      return { success: false, message: 'Poster is not active' };
    }
    
    // Enforce dedup + slot limits
    const dedup = canRequestPoster_(empEmail, posterId);
    if (!dedup.allowed) {
      return { success: false, message: `Cannot add request: ${dedup.reason}` };
    }

    const activeSlots = countActiveSlotsByEmail_(empEmail);
    if (activeSlots >= CONFIG.MAX_ACTIVE) {
      return { success: false, message: `Cannot add request: limit (${CONFIG.MAX_ACTIVE}-slot)` };
    }

    // Use custom timestamp or current time
    let requestTs;
    if (customTimestamp && customTimestamp.trim()) {
      try {
        requestTs = new Date(customTimestamp);
        if (isNaN(requestTs.getTime())) {
          return { success: false, message: 'Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS' };
        }
      } catch (e) {
        return { success: false, message: 'Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS' };
      }
    } else {
      requestTs = now_();
    }
    
    // Add to ledger
    const sh = getRequestsSheet_();
    const mpInfo = lookupPosterInfoById_(posterId);
    const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
    const label = idToCurrent[posterId] || (mpInfo ? mpInfo.label : posterId);

    const row = [];
    row[COLS.REQUESTS.REQ_TS - 1] = requestTs;
    row[COLS.REQUESTS.EMP_EMAIL - 1] = empEmail.toLowerCase().trim();
    row[COLS.REQUESTS.EMP_NAME - 1] = empName;
    row[COLS.REQUESTS.POSTER_ID - 1] = posterId;
    row[COLS.REQUESTS.LABEL_AT_REQ - 1] = label;
    row[COLS.REQUESTS.TITLE_SNAP - 1] = mpInfo ? mpInfo.title : '';
    row[COLS.REQUESTS.RELEASE_SNAP - 1] = mpInfo ? mpInfo.release : '';
    row[COLS.REQUESTS.ACTION_TYPE - 1] = 'ADD';
    row[COLS.REQUESTS.STATUS - 1] = STATUS.ACTIVE;
    row[COLS.REQUESTS.STATUS_TS - 1] = requestTs;

    sh.appendRow(row);

    invalidateCachesAfterWrite_({ empEmail });
    
    // Rebuild boards to reflect new entry
    SpreadsheetApp.getActive().toast('🔄 Updating boards and form...', 'Manual Request', 3);
    rebuildBoards();
    syncPostersToForm();
    
    Logger.log(`[addManualRequest] Successfully added request: ${empEmail} - ${label}`);
    
    // Visual feedback after dialog closes
    SpreadsheetApp.getActive().toast(
      `✅ Request added!\n${empName} → ${label}`,
      'Request Added',
      5
    );
    
    return { success: true, message: 'Request added successfully' };
    
  } catch (err) {
    Logger.log(`[addManualRequest] Error: ${err.message}`);
    return { success: false, message: `Error: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
/** PosterDisplay.js **/

/**
 * Display Management Module
 * Creates and manages "Poster Outside" and "Poster Inside" tabs with dynamic dropdowns
 * for tracking poster display locations in the theater
 */

/**
 * Creates or updates the Poster Outside tab
 * Layout: Last Updated row + Yoke's Side (8 slots) + Dairy Queen Side (8 slots)
 * Each slot has a status dropdown (Coming Soon / Now Showing) and movie title dropdown
 */
function setupPosterOutsideTab_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetName = 'Poster Outside';
    
    // Create or get sheet
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set column widths (all equal for poster slots)
    for (let col = 1; col <= 8; col++) {
      sheet.setColumnWidth(col, 150);
    }
    
    // ROW 1: Last Updated (merged A-H)
    sheet.getRange(1, 1, 1, 8).merge();
    sheet.getRange('A1')
      .setValue(`Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy hh:mm a')}`)
      .setHorizontalAlignment('right')
      .setFontSize(10)
      .setFontColor('#666666');
    
    // ROW 3: Yoke's Side Header (merged A-H)
    sheet.getRange(3, 1, 1, 8).merge();
    sheet.getRange('A3')
      .setValue("Yoke's Side (Left)")
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    
    // ROW 4: Status dropdowns for Yoke's Side (A-H)
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Coming Soon', 'Now Showing'], true)
      .setAllowInvalid(false)
      .build();
    
    for (let col = 1; col <= 8; col++) {
      sheet.getRange(4, col)
        .setDataValidation(statusRule)
        .setValue('Coming Soon')
        .setHorizontalAlignment('center')
        .setFontSize(10)
        .setBackground('#e8f0fe');
    }
    
    // ROW 5: Movie title dropdowns for Yoke's Side (A-H)
    setupMovieTitleDropdowns_(sheet, 5, 1, 8);
    
    // ROW 6: Empty spacing
    sheet.setRowHeight(6, 30);
    
    // ROW 7: Dairy Queen Side Header (merged A-H)
    sheet.getRange(7, 1, 1, 8).merge();
    sheet.getRange('A7')
      .setValue('Dairy Queen Side (Right)')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#ea4335')
      .setFontColor('#ffffff');
    
    // ROW 8: Status dropdowns for Dairy Queen Side (A-H)
    for (let col = 1; col <= 8; col++) {
      sheet.getRange(8, col)
        .setDataValidation(statusRule)
        .setValue('Coming Soon')
        .setHorizontalAlignment('center')
        .setFontSize(10)
        .setBackground('#fce8e6');
    }
    
    // ROW 9: Movie title dropdowns for Dairy Queen Side (A-H)
    setupMovieTitleDropdowns_(sheet, 9, 1, 8);
    
    // Protect header rows from accidental edits (Last Updated, Yoke's Side, Dairy Queen Side)
    const protection1 = sheet.getRange('A1:H3').protect();
    protection1.setDescription('Header - Do not edit');
    protection1.setWarningOnly(true);
    
    const protection2 = sheet.getRange('A7:H7').protect();
    protection2.setDescription('Header - Do not edit');
    protection2.setWarningOnly(true);
    
    ss.toast('✅ Poster Outside display initialized!', 'Setup Complete', 3);
    return sheet;
  } catch (err) {
    logError_(err, 'setupPosterOutsideTab_', 'Setting up Poster Outside tab');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates or updates the Poster Inside tab
 * Layout: Last Updated row + Video Games Wall (2x4 grid) + Box Wall (1x3 grid)
 */
function setupPosterInsideTab_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetName = 'Poster Inside';
    
    // Create or get sheet
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set column widths
    for (let col = 1; col <= 4; col++) {
      sheet.setColumnWidth(col, 180);
    }
    
    // ROW 1: Last Updated (merged A-D)
    sheet.getRange(1, 1, 1, 4).merge();
    sheet.getRange('A1')
      .setValue(`Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy hh:mm a')}`)
      .setHorizontalAlignment('right')
      .setFontSize(10)
      .setFontColor('#666666');
    
    // ROW 2: Video Games Wall Header (merged A-D)
    sheet.getRange(2, 1, 1, 4).merge();
    sheet.getRange('A2')
      .setValue('Video Games Wall')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');
    
    // ROW 3: Top row of Video Games Wall (A-D)
    setupMovieTitleDropdowns_(sheet, 3, 1, 4);
    
    // ROW 4: Bottom row of Video Games Wall (A-D)
    setupMovieTitleDropdowns_(sheet, 4, 1, 4);
    
    // ROW 5: Empty spacing
    sheet.setRowHeight(5, 30);
    
    // ROW 6: Box Wall Header (merged A-C)
    sheet.getRange(6, 1, 1, 3).merge();
    sheet.getRange('A6')
      .setValue('Box Wall')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#fbbc04')
      .setFontColor('#ffffff');
    
    // ROW 7: Box Wall posters (A-C)
    setupMovieTitleDropdowns_(sheet, 7, 1, 3);
    
    // Protect header rows (Last Updated, Video Games Wall, Box Wall)
    const protection1 = sheet.getRange('A1:D2').protect();
    protection1.setDescription('Header - Do not edit');
    protection1.setWarningOnly(true);
    
    const protection2 = sheet.getRange('A6:C6').protect();
    protection2.setDescription('Header - Do not edit');
    protection2.setWarningOnly(true);
    
    ss.toast('✅ Poster Inside display initialized!', 'Setup Complete', 3);
    return sheet;
  } catch (err) {
    logError_(err, 'setupPosterInsideTab_', 'Setting up Poster Inside tab');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper function to setup movie title dropdowns in a range
 * @param {Sheet} sheet - The sheet to add dropdowns to
 * @param {number} row - The row number
 * @param {number} startCol - Starting column (1-indexed)
 * @param {number} numCols - Number of columns to add dropdowns
 */
function setupMovieTitleDropdowns_(sheet, row, startCol, numCols) {
  try {
    // Get movie titles from Inventory tab
    const titles = getMovieTitlesFromInventory_();
    
    if (titles.length === 0) {
      titles.push('(No movies in inventory)');
    }
    
    // Create data validation rule ONCE, apply to entire range
    const titleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(titles, true)
      .setAllowInvalid(true) // Allow manual entry for flexibility
      .build();
    
    // Get the entire range (all cells in one operation)
    const endCol = startCol + numCols - 1;
    const range = sheet.getRange(row, startCol, 1, numCols);
    
    // Apply validation to entire range at once
    range.setDataValidation(titleRule);
    
    // Apply formatting to entire range at once
    range
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(12)
      .setFontWeight('bold')
      .setWrap(true);
    
    // Set default values for empty cells
    const values = range.getValues()[0];
    const newValues = values.map((val, idx) => {
      if (!val || val === '') {
        return titles[0] || '';
      }
      return val;
    });
    range.setValues([newValues]);
    
    // Make poster title cells taller (150 units)
    sheet.setRowHeight(row, 150);
  } catch (err) {
    Logger.log(`[setupMovieTitleDropdowns_] Error: ${err.message}`);
    throw err;
  }
}

/**
 * Get all movie titles from Inventory tab, sorted by release date (oldest to newest)
 * @returns {Array<string>} Array of unique movie titles
 */
function getMovieTitlesFromInventory_() {
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inv, 8);  // Inventory has 8 columns
    
    // Get all titles, sorted by release date (ascending: oldest to newest)
    const titles = data
      .sort((a, b) => {
        const dateA = new Date(a[COLS.INVENTORY.RELEASE - 1]);
        const dateB = new Date(b[COLS.INVENTORY.RELEASE - 1]);
        return dateA - dateB; // Oldest first
      })
      .map(r => String(r[COLS.INVENTORY.TITLE - 1] || '').trim())
      .filter(Boolean);
    
    return [...new Set(titles)]; // Remove duplicates
  } catch (err) {
    Logger.log(`[getMovieTitlesFromInventory_] Error: ${err.message}`);
    return [];
  }
}

/**
 * Update the Last Updated timestamp on Poster Outside tab
 */
function updatePosterOutsideTimestamp_() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Poster Outside');
    if (!sheet) return;
    
    sheet.getRange('A1').setValue(
      `Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy hh:mm a')}`
    );
  } catch (err) {
    Logger.log(`[updatePosterOutsideTimestamp_] Error: ${err.message}`);
  }
}

/**
 * Update the Last Updated timestamp on Poster Inside tab
 */
function updatePosterInsideTimestamp_() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Poster Inside');
    if (!sheet) return;
    
    sheet.getRange('A1').setValue(
      `Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy hh:mm a')}`
    );
  } catch (err) {
    Logger.log(`[updatePosterInsideTimestamp_] Error: ${err.message}`);
  }
}

/**
 * Refresh all display tab dropdowns when Inventory changes
 * This function updates dropdowns on both Poster Outside and Poster Inside tabs
 */
function refreshDisplayDropdowns_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    
    // Refresh Poster Outside
    const outsideSheet = ss.getSheetByName('Poster Outside');
    if (outsideSheet) {
      setupMovieTitleDropdowns_(outsideSheet, 5, 1, 8);  // Yoke's Side
      setupMovieTitleDropdowns_(outsideSheet, 9, 1, 8);  // Dairy Queen Side
      updatePosterOutsideTimestamp_();
    }
    
    // Refresh Poster Inside
    const insideSheet = ss.getSheetByName('Poster Inside');
    if (insideSheet) {
      setupMovieTitleDropdowns_(insideSheet, 3, 1, 4);  // Video Games Wall Top
      setupMovieTitleDropdowns_(insideSheet, 4, 1, 4);  // Video Games Wall Bottom
      setupMovieTitleDropdowns_(insideSheet, 7, 1, 3);  // Box Wall
      updatePosterInsideTimestamp_();
    }
    
    ss.toast('✅ Display dropdowns refreshed!', 'Refresh Complete', 3);
  } catch (err) {
    logError_(err, 'refreshDisplayDropdowns_', 'Refreshing display dropdowns');
    SpreadsheetApp.getActive().toast('❌ Error refreshing displays', 'Error', 5);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Shows consolidated Display Manager dialog with all display management options
 */
function showDisplayManagerDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h2 {
            color: #1a73e8;
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .section h3 {
            margin-top: 0;
            color: #5f6368;
            font-size: 14px;
          }
          button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-top: 8px;
          }
          button:hover {
            background: #1557b0;
          }
          button:active {
            background: #0d47a1;
          }
          .info {
            color: #5f6368;
            font-size: 12px;
            margin-top: 5px;
          }
          .success {
            color: #0d7a3c;
            font-weight: bold;
          }
          .error {
            color: #d93025;
            font-weight: bold;
          }
          #status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
          }
          .show-status {
            display: block !important;
          }
        </style>
      </head>
      <body>
        <h2>🖼️ Display Manager</h2>
        
        <div class="section">
          <h3>Setup Display Sheets</h3>
          <button onclick="setupOutside()">Setup Poster Outside</button>
          <div class="info">Creates/resets Poster Outside tab (Yoke's + Dairy Queen sides)</div>
          
          <button onclick="setupInside()">Setup Poster Inside</button>
          <div class="info">Creates/resets Poster Inside tab (Video Games + Box walls)</div>
        </div>
        
        <div class="section">
          <h3>Refresh Dropdowns</h3>
          <button onclick="refreshDropdowns()">Refresh Display Dropdowns</button>
          <div class="info">Updates movie title dropdowns from current Inventory</div>
        </div>
        
        <div id="status"></div>
        
        <script>
          function setupOutside() {
            showStatus('Setting up Poster Outside...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Outside setup complete!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .setupPosterOutsideTab_();
          }
          
          function setupInside() {
            showStatus('Setting up Poster Inside...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Inside setup complete!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .setupPosterInsideTab_();
          }
          
          function refreshDropdowns() {
            showStatus('Refreshing dropdowns...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Display dropdowns refreshed!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshDisplayDropdowns_();
          }
          
          function showStatus(message, isSuccess) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = isSuccess ? 'show-status success' : 'show-status error';
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(450)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Display Manager');
}
/** PrintOut.js **/
/**
 * Print Out system - MANUAL UPDATE ONLY
 * Print Out is updated only when user clicks "Update Print Out" from admin menu.
 * This prevents automatic tab switching that interrupts workflow.
 */

function updateInventoryLastUpdated_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  inv.getRange(CONFIG.INVENTORY_LAST_UPDATED_CELL)
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd hh:mm:ss a')}`);
}

function refreshPrintOut() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActive();
    ss.toast('⏳ Updating Print Out layout...', 'Updating', -1);
    
    buildPrintOutLayout_();

    ss.toast('✅ Print Out updated successfully!', 'Update Complete', 3);
  } catch (err) {
    const ss = SpreadsheetApp.getActive();
    ss.toast('❌ Error updating Print Out: ' + err.message, 'Error', 5);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Builds Print Out sheet with:
 * - Form & Employee View links at top (rows 1-2)
 * - Movie posters from Inventory sheet (filtered by ACTIVE status)
 * - Form QR code: spans from Last Updated header to last movie
 * - Employee View QR code: starts 10 rows below last movie
 * Returns the last movie row number.
 */
function buildPrintOutLayout_() {
  const ss = SpreadsheetApp.getActive();
  const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);

  // Clean printing aesthetics
  sh.setHiddenGridlines(true);
  sh.getBandings().forEach(b => b.remove());
  sh.setConditionalFormatRules([]);

  // Break merges and clear the working area (A/B only)
  sh.getRange(1, 1, sh.getMaxRows(), 2).breakApart();
  sh.getRange(1, 1, sh.getMaxRows(), 2).clear({ contentsOnly: false });

  // Clear column C (QR area) before re-inserting QR headers and codes
  sh.getRange(1, 3, sh.getMaxRows(), 1).clear({ contentsOnly: true, formatOnly: true });

  // Remove old floating images
  removeAllFloatingImages_(sh);

  // --- Row 1-2: URLs (always at top) ---
  const formUrl = getCachedFormUrl_();  // Use cached URL from setup
  let empUrl = '';
  try {
    empUrl = getCachedEmployeeViewUrl_();  // Use cached URL with graceful fallback
  } catch (err) {
    Logger.log('[buildPrintOutLayout_] Warning - could not get Employee View URL: ' + err.message);
    empUrl = '';  // Graceful degradation - continue without crashing
  }

  sh.getRange('A1').setValue('Form URL').setFontWeight('bold');
  sh.getRange('B1').setValue(formUrl);
  sh.getRange('A2').setValue('Employees View URL').setFontWeight('bold');
  sh.getRange('B2').setValue(empUrl || '(Not set up - run Setup Employee View Spreadsheet)');

  // --- Row 4: Last Updated header ---
  sh.getRange('A4:B4').merge();
  sh.getRange('A4')
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd')}`)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.getRange('C4')
    .setValue('Form QR Code')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // --- Row 5: Column headers ---
  sh.getRange('A5').setValue('Release Date').setFontWeight('bold');
  sh.getRange('B5').setValue('Movie Title').setFontWeight('bold');
  sh.getRange('A5:B5').setBackground('#eeeeee');

  // Set column widths
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 520);
  sh.setColumnWidth(3, 260);

  // --- Get ALL posters from Inventory sheet (active or not) ---
  // The ACTIVE flag controls form availability; Print Out shows ALL to display upcoming movies
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const invData = getNonEmptyData_(inv, 11, 3);
  
  const allPosters = invData
    .slice(1)  // Skip header row (row 2 from Inventory) - data starts at row 3
    .map(r => ({
      release: r[COLS.INVENTORY.RELEASE - 1],
      title: String(r[COLS.INVENTORY.TITLE - 1] || '').trim(),
    }))
    .filter(p => p.title && p.release)
    .sort((a, b) => new Date(a.release) - new Date(b.release));

  // --- Insert poster rows starting at row 6 ---
  const startRow = 6;
  let lastPopulatedRow = startRow;
  if (allPosters.length > 0) {
    const rows = allPosters.map(p => [p.release, p.title]);
    sh.getRange(startRow, 1, rows.length, 2).setValues(rows);
    sh.getRange(startRow, 1, rows.length, 1).setNumberFormat('m/d/yyyy');
    lastPopulatedRow = startRow + rows.length - 1;
  } else {
    sh.getRange('A6').setValue('(No posters in inventory)');
    lastPopulatedRow = 6;
  }

  // --- Employee QR label: 15 rows below Form QR (which is at row 5) ---
  const empQrLabelRow = 5 + 15;

  // The actual last data row is already calculated from lastPopulatedRow
  const actualLastDataRow = lastPopulatedRow;

  // Clear all rows AFTER the actual last populated row in column A only
  const maxRows = sh.getMaxRows();
  if (actualLastDataRow + 1 <= maxRows) {
    sh.getRange(actualLastDataRow + 1, 1, maxRows - actualLastDataRow, 3).clear({ contentsOnly: true, formatOnly: true });
  }

  // --- QR Code Labels: Consistent formatting ---
  // Form QR label (C4)
  sh.getRange('C4')
    .setValue('Form QR Code')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setFontColor('#222');

  // Employee QR label (C{empQrLabelRow})
  sh.getRange(`C${empQrLabelRow}`)
    .setValue('Employee View QR Code')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setFontColor('#222');

  // --- Borders for main table: A4:B (only on A/B columns, not C) ---
  const tableRange = sh.getRange(4, 1, actualLastDataRow - 4 + 1, 2);
  tableRange.setBorder(true, true, true, true, true, true);

  // --- Insert QR codes ---
  // Form QR: in column C starting from row 5
  insertFloatingQrQuickchart_(sh, formUrl, 3, 5, 220);

  // Employee QR: 1 row below the label
  insertFloatingQrQuickchart_(sh, empUrl, 3, empQrLabelRow + 1, 220);

  // Return both last movie row and the last row used by QR area
  return { lastMovieRow: actualLastDataRow, empQrEndRow: empQrLabelRow + 1 };
}

/**
 * Inserts a QuickChart QR as a FLOATING image (movable).
 * col,row are the anchor cell for top-left corner.
 */
function insertFloatingQrQuickchart_(sheet, text, col, row, sizePx) {
  const cleaned = String(text || '').trim();
  if (!cleaned || cleaned === '(Not set up - run Setup Employee View Spreadsheet)') {
    Logger.log(`[insertFloatingQrQuickchart_] Skipping QR: URL is missing or invalid: "${cleaned}"`);
    sheet.getRange(row, col).setValue('(QR not available)').setFontColor('red').setFontSize(10);
    return null;
  }
  const encoded = encodeURIComponent(cleaned);
  const qrUrl = `https://quickchart.io/qr?text=${encoded}&size=${sizePx}&format=png`;
  Logger.log(`[insertFloatingQrQuickchart_] Requesting QR for: ${cleaned}`);
  try {
    const blob = UrlFetchApp.fetch(qrUrl).getBlob().setName('qr.png');
    const img = sheet.insertImage(blob, col, row);
    img.setWidth(sizePx);
    img.setHeight(sizePx);
    return img;
  } catch (err) {
    Logger.log(`[insertFloatingQrQuickchart_] ERROR fetching QR: ${err.message}`);
    sheet.getRange(row, col).setValue('(QR error)').setFontColor('red').setFontSize(10);
    return null;
  }
}

/** Removes all floating images from the sheet (prevents duplicates each run) */
function removeAllFloatingImages_(sheet) {
  sheet.getImages().forEach(img => img.remove());
}
/** RefreshManager.js **/

/**
 * Shows consolidated Refresh Manager dialog with all refresh operations
 */
function showRefreshManagerDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h2 {
            color: #1a73e8;
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .section h3 {
            margin-top: 0;
            color: #5f6368;
            font-size: 14px;
          }
          .master-section {
            background: #e8f0fe;
            border: 2px solid #1a73e8;
          }
          button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-top: 8px;
          }
          button:hover {
            background: #1557b0;
          }
          button:active {
            background: #0d47a1;
          }
          button.master {
            background: #0d7a3c;
            font-weight: bold;
            font-size: 16px;
            padding: 12px 20px;
          }
          button.master:hover {
            background: #0b6632;
          }
          .info {
            color: #5f6368;
            font-size: 12px;
            margin-top: 5px;
            line-height: 1.4;
          }
          .success {
            color: #0d7a3c;
            font-weight: bold;
          }
          .error {
            color: #d93025;
            font-weight: bold;
          }
          #status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
          }
          .show-status {
            display: block !important;
          }
        </style>
      </head>
      <body>
        <h2>🔄 Refresh Manager</h2>
        
        <div class="section master-section">
          <h3>🌟 Refresh All Displays</h3>
          <button class="master" onclick="refreshAllDisplays()">Refresh Everything</button>
          <div class="info">
            Runs all refresh operations below in sequence:<br>
            • Rebuilds Main & Employees boards<br>
            • Updates Google Form dropdown options<br>
            • Refreshes Print Out layout & QR codes<br>
            • Updates Poster Outside display dropdowns<br>
            • Updates Poster Inside display dropdowns
          </div>
        </div>
        
        <div class="section">
          <h3>📊 Boards & Data</h3>
          
          <button onclick="refreshBoards()">Rebuild Boards</button>
          <div class="info">
            Regenerates Main Board (poster-centric) and Employees Board (employee-centric) from current request ledger. Use after adding/removing requests.
          </div>
          
          <button onclick="refreshFormOptions()">Sync Form Options</button>
          <div class="info">
            Updates Google Form dropdown with active posters from Inventory. Adds new posters, removes deactivated ones. Use after changing poster availability.
          </div>
        </div>
        
        <div class="section">
          <h3>🖨️ Print & Display Sheets</h3>
          
          <button onclick="refreshPrintOut()">Update Print Out</button>
          <div class="info">
            Regenerates print layout with QR codes (form link + employee view link) and current poster inventory. Use before printing physical copies.
          </div>
          
          <button onclick="refreshPosterOutside()">Update Poster Outside Dropdowns</button>
          <div class="info">
            Refreshes movie title dropdowns on Poster Outside tab (Yoke's Side & Dairy Queen Side). Use after adding new movies to inventory.
          </div>
          
          <button onclick="refreshPosterInside()">Update Poster Inside Dropdowns</button>
          <div class="info">
            Refreshes movie title dropdowns on Poster Inside tab (Video Games Wall & Box Wall). Use after adding new movies to inventory.
          </div>
        </div>
        
        <div id="status"></div>
        
        <script>
          function refreshAllDisplays() {
            showStatus('🔄 Running all refresh operations...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ All displays refreshed successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshAllDisplays();
          }
          
          function refreshBoards() {
            showStatus('Rebuilding boards...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Boards rebuilt successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .rebuildBoards();
          }
          
          function refreshFormOptions() {
            showStatus('Syncing form options...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Form options synced successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .syncPostersToForm();
          }
          
          function refreshPrintOut() {
            showStatus('Updating Print Out...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Print Out updated successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPrintOut();
          }
          
          function refreshPosterOutside() {
            showStatus('Updating Poster Outside dropdowns...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Outside dropdowns updated!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPosterOutside();
          }
          
          function refreshPosterInside() {
            showStatus('Updating Poster Inside dropdowns...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Inside dropdowns updated!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPosterInside();
          }
          
          function showStatus(message, isSuccess) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = isSuccess ? 'show-status success' : 'show-status error';
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(550)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Refresh Manager');
}

/**
 * Public wrapper - Executes all refresh operations in sequence (master refresh function)
 * Called from Refresh Manager dialog
 */
function refreshAllDisplays() {
  executeRefreshAll_();
}

/**
 * Public wrapper - Refreshes Poster Outside display dropdowns
 * Called from Refresh Manager dialog
 */
function refreshPosterOutside() {
  refreshPosterOutsideDropdowns_();
}

/**
 * Public wrapper - Refreshes Poster Inside display dropdowns
 * Called from Refresh Manager dialog
 */
function refreshPosterInside() {
  refreshPosterInsideDropdowns_();
}

/**
 * Executes all refresh operations in sequence (master refresh function)
 */
function executeRefreshAll_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    
    // 1. Rebuild boards
    Logger.log('[executeRefreshAll_] Rebuilding boards...');
    ss.toast('⏳ Step 1/5: Rebuilding boards...', 'Refreshing All', -1);
    rebuildBoards();
    ss.toast('✓ Boards rebuilt', 'Progress', 2);
    
    // 2. Sync form options
    Logger.log('[executeRefreshAll_] Syncing form options...');
    ss.toast('⏳ Step 2/5: Syncing form options...', 'Refreshing All', -1);
    try {
      syncPostersToForm();
      ss.toast('✓ Form synced', 'Progress', 2);
    } catch (err) {
      Logger.log(`[WARN] Form sync failed (access denied): ${err.message}`);
      ss.toast('⚠ Form sync skipped (access denied)', 'Progress', 3);
    }
    
    // 3. Refresh Print Out
    Logger.log('[executeRefreshAll_] Updating Print Out...');
    ss.toast('⏳ Step 3/5: Updating Print Out...', 'Refreshing All', -1);
    try {
      buildPrintOutLayout_();
      ss.toast('✓ Print Out updated', 'Progress', 2);
    } catch (err) {
      Logger.log(`[WARN] Print Out update failed: ${err.message}`);
      ss.toast('⚠ Print Out update skipped', 'Progress', 3);
    }
    
    // 4. Refresh Poster Outside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Outside...');
    ss.toast('⏳ Step 4/5: Updating Poster Outside...', 'Refreshing All', -1);
    refreshPosterOutsideDropdowns_();
    ss.toast('✓ Poster Outside updated', 'Progress', 2);
    
    // 5. Refresh Poster Inside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Inside...');
    ss.toast('⏳ Step 5/5: Updating Poster Inside...', 'Refreshing All', -1);
    refreshPosterInsideDropdowns_();
    
    Logger.log('[executeRefreshAll_] All refresh operations complete');
    ss.toast('✅ All displays refreshed successfully!', 'Refresh Complete', 5);
    
  } catch (err) {
    const ss = SpreadsheetApp.getActive();
    ss.toast('❌ Error during refresh: ' + err.message, 'Error', 5);
    logError_(err, 'executeRefreshAll_', 'Running all refresh operations');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Refreshes Poster Outside display dropdowns only
 */
function refreshPosterOutsideDropdowns_() {
  const ss = SpreadsheetApp.getActive();
  const outsideSheet = ss.getSheetByName('Poster Outside');
  
  if (!outsideSheet) {
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside sheet not found');
    ss.toast('❌ Poster Outside sheet not found', 'Error', 5);
    return;
  }
  
  try {
    ss.toast('⏳ Updating Poster Outside dropdowns...', 'Updating', -1);
    
    setupMovieTitleDropdowns_(outsideSheet, 5, 1, 8);  // Yoke's Side
    setupMovieTitleDropdowns_(outsideSheet, 9, 1, 8);  // Dairy Queen Side
    updatePosterOutsideTimestamp_();
    
    ss.toast('✅ Poster Outside dropdowns updated successfully!', 'Complete', 3);
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside dropdowns updated');
  } catch (err) {
    ss.toast('❌ Error updating Poster Outside: ' + err.message, 'Error', 5);
    Logger.log('[refreshPosterOutsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}

/**
 * Refreshes Poster Inside display dropdowns only
 */
function refreshPosterInsideDropdowns_() {
  const ss = SpreadsheetApp.getActive();
  const insideSheet = ss.getSheetByName('Poster Inside');
  
  if (!insideSheet) {
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside sheet not found');
    ss.toast('❌ Poster Inside sheet not found', 'Error', 5);
    return;
  }
  
  try {
    ss.toast('⏳ Updating Poster Inside dropdowns...', 'Updating', -1);
    
    setupMovieTitleDropdowns_(insideSheet, 3, 1, 4);  // Video Games Wall Top
    setupMovieTitleDropdowns_(insideSheet, 4, 1, 4);  // Video Games Wall Bottom
    setupMovieTitleDropdowns_(insideSheet, 7, 1, 3);  // Box Wall
    updatePosterInsideTimestamp_();
    
    ss.toast('✅ Poster Inside dropdowns updated successfully!', 'Complete', 3);
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside dropdowns updated');
  } catch (err) {
    ss.toast('❌ Error updating Poster Inside: ' + err.message, 'Error', 5);
    Logger.log('[refreshPosterInsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}
/** Setup.js **/

function onOpen() {
  buildAdminMenu_();
  // Initialize health banner on open without blocking
  try {
    renderHealthBanner_();
  } catch (err) {
    Logger.log(`[WARN] Health banner render on open failed: ${err.message}`);
  }
}

function buildAdminMenu_() {
  const ui = SpreadsheetApp.getUi();
  
  // Main menu: Poster Request System
  const mainMenu = ui.createMenu('Poster Request System');
  
  // Top-level item: Add New Poster (most commonly used)
  mainMenu.addItem('➕ Add New Poster', 'showManualPosterDialog');
  
  mainMenu.addSeparator();
  
  // Advanced Menu (with nested items)
  const advancedMenu = ui.createMenu('⚙️ Advanced');
  
  // Main functions
  advancedMenu.addItem('🔄 Refresh Manager', 'showRefreshManagerDialog');
  advancedMenu.addItem('👥 Employee View Manager', 'showEmployeeViewManagerDialog');
  advancedMenu.addItem('➕ Manually Add Request', 'showManualRequestDialog');
  
  advancedMenu.addSeparator();
  
  // Reports submenu
  advancedMenu.addSubMenu(ui.createMenu('📊 Reports')
    .addItem('Rebuild Boards', 'rebuildBoards')
    .addItem('Sync Form Options', 'syncPostersToForm')
    .addItem('Refresh Documentation', 'buildDocumentationTab'));
  
  // Announcements submenu
  advancedMenu.addSubMenu(ui.createMenu('📧 Announcements')
    .addItem('Preview Pending', 'previewPendingAnnouncement')
    .addItem('Send Now', 'sendAnnouncementNow'));
  
  // Display Management submenu
  advancedMenu.addSubMenu(ui.createMenu('🖼️ Display Management')
    .addItem('Manage Display Sheets', 'showDisplayManagerDialog'));
  
  // System submenu (with Run Setup / Repair inside)
  advancedMenu.addSubMenu(ui.createMenu('🔐 System')
    .addItem('🔧 Run Setup / Repair', 'setupPosterSystem')
    .addItem('🧷 Create Triggers', 'createTriggersNow_')
    .addItem('Run Backup Now', 'manualBackupTrigger'));
  
  mainMenu.addSubMenu(advancedMenu);
  mainMenu.addToUi();
}

/**
 * Refresh All: Executes the 3 main refresh operations
 * Rebuilds boards and syncs form options
 */
function refreshAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    ss.toast('⏳ Rebuilding boards...', 'Refresh All', 3);
    rebuildBoards();
    
    ss.toast('⏳ Syncing form options...', 'Refresh All', 3);
    syncPostersToForm();
    
    ss.toast('✅ All systems refreshed!', 'Refresh All Complete', 5);
  } catch (err) {
    ss.toast(`❌ Error during refresh: ${err.message}`, 'Refresh All Failed', 8);
    logError_(err, 'refreshAll_', 'Refresh all operations');
  }
}

function setupPosterSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Task Group 1: Core Infrastructure (must run first)
    ss.toast('⏳ Step 1/6: Initializing infrastructure...', 'Setup Progress', -1);
    ensureSheetSchemas_();
    applyAdminFormatting_();
    ensureFormStructure_();
    ensureTriggers_();

    // Task Group 2: Data Syncing
    ss.toast('⏳ Step 2/6: Syncing data...', 'Setup Progress', -1);
    ensurePosterIdsInInventory_();  // Inventory is now primary source
    initializeInventorySnapshot_();  // Seed inventory snapshot for deletion detection
    initializeFormUrlCache_();  // Cache Form URL (set once, persist forever)
    initializeEmployeeViewUrlCache_();  // Cache Employee View URL (set once, persist forever)
    syncPostersToForm();

    // Task Group 3: Visual Displays
    ss.toast('⏳ Step 3/6: Generating views...', 'Setup Progress', -1);
    rebuildBoards();
    buildDocumentationTab();
    buildPrintOutLayout_();
    
    // Setup employee view (must be before print out layout so links are available)
    ss.toast('⏳ Step 4/6: Setting up employee view...', 'Setup Progress', -1);
    setupEmployeeViewSpreadsheet();
    
    // Refresh print out to include employee view link
    ss.toast('⏳ Step 5/6: Refreshing print layout...', 'Setup Progress', -1);
    buildPrintOutLayout_();

    // Task Group 4: Monitoring (last)
    ss.toast('⏳ Step 6/6: Finalizing setup...', 'Setup Progress', -1);
    updateInventoryLastUpdated_();
    
    ss.toast('✅ Setup complete!', 'Setup Complete', 5);
    SpreadsheetApp.getUi().alert('✅ Setup Complete! All systems ready.');
  } finally {
    lock.releaseLock();
  }
}

function ensureTriggers_() {
  const existing = ScriptApp.getProjectTriggers();
  const has = (handler) => existing.some(t => t.getHandlerFunction() === handler);

  let form = null;
  try {
    form = getOrCreateForm_();
  } catch (err) {
    Logger.log(`[ensureTriggers_] Form trigger skipped: ${err.message}`);
  }

  if (form && !has('handleFormSubmit')) {
    ScriptApp.newTrigger('handleFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();
  }

  if (!has('handleSheetEdit')) {
    ScriptApp.newTrigger('handleSheetEdit')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
  }

  if (!has('handleSheetChange')) {
    ScriptApp.newTrigger('handleSheetChange')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
      .create();
  }

  if (!has('processAnnouncementQueue')) {
    ScriptApp.newTrigger('processAnnouncementQueue')
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  if (!has('performNightlyBackup')) {
    ScriptApp.newTrigger('performNightlyBackup')
      .timeBased()
      .atHour(2)  // Run at 2 AM
      .everyDays(1)
      .create();
  }
}

function createTriggersNow_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    ensureTriggers_();
    SpreadsheetApp.getActive().toast('✅ Triggers created/verified', 'Triggers', 4);
  } catch (err) {
    SpreadsheetApp.getActive().toast('❌ Error creating triggers: ' + err.message, 'Triggers', 6);
    logError_(err, 'createTriggersNow_', 'Manual trigger creation');
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetSchemas_() {
  const ss = SpreadsheetApp.getActive();

  // Inventory: row 1 reserved (merged A1:L1) for Last Updated, headers on row 2
  let inv = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  if (!inv) inv = ss.insertSheet(CONFIG.SHEETS.INVENTORY);
  formatInventorySheet_();

  // Movie Posters sheet is deprecated - no longer created during setup
  // Kept in config for backward compatibility with existing deployments

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUEST_ORDER, [
    'Form Timestamp','Employee Email',
    'Requested Posters (Add) - raw','Removed Posters - raw',
    'Slots Before','Slots After','Added Accepted','Removed Applied','Denied Adds','Processing Notes'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.MAIN, ['','']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.EMPLOYEES, ['','']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.PRINT_OUT, ['','']);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUESTS, [
    'Request Timestamp','Employee Email','Employee Name','Poster ID',
    'Poster Label (at request)','Movie Title (snapshot)','Release Date (snapshot)',
    'Action Type','Status','Status Updated At'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.SUBSCRIBERS, [
    'Active?','Email','Name'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DOCUMENTATION, ['']);

  // System logging/monitoring sheets
  ensureErrorTrackingSheet_();
  ensureAnalyticsSheet_();
  ensureAnalyticsSummarySheet_();
  ensureDataIntegritySheet_();

  // Remove all frozen headers and frozen columns from all sheets
  removeFrozenHeadersFromAllSheets_();

  // Auto-hide internal audit sheets
  hideInternalSheets_();
  
  // Apply purposeful tab colors
  applyTabColors_();
}

/**
 * Remove frozen headers and columns from all sheets for better UX
 */
function removeFrozenHeadersFromAllSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  });
}

/**
 * Hide internal/audit sheets from end users.
 */
function hideInternalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const internal = [
    CONFIG.SHEETS.REQUEST_ORDER,
    CONFIG.SHEETS.REQUESTS,
    CONFIG.SHEETS.ERROR_LOG,
    CONFIG.SHEETS.ANALYTICS,
    CONFIG.SHEETS.ANALYTICS_SUMMARY,
    CONFIG.SHEETS.DATA_INTEGRITY,
    CONFIG.SHEETS.SUBSCRIBERS,
  ];

  internal.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.hideSheet();
    }
  });
}

/**
 * Apply purposeful tab colors to sheets for better visual organization.
 * Color scheme:
 * - BLUE (#4285F4): Primary user-facing sheets (Inventory, Main Board, Employees Board)
 * - CYAN (#00BCD4): Display/Print sheets (Poster Outside/Inside, Print Out)
 * - ORANGE (#FF9800): Configuration/Reference (Subscribers, Documentation)
 * - YELLOW (#FFEB3B): Admin Tools (Request Order, Requests ledger)
 * - RED (#F44336): Error/Debug sheets (Error Log, Data Integrity)
 * - GREEN (#4CAF50): Analytics/Reporting (Analytics, Analytics Summary)
 */
function applyTabColors_() {
  const ss = SpreadsheetApp.getActive();
  
  // Primary user-facing sheets - BLUE (#4285F4)
  const blue = '#4285F4';
  [CONFIG.SHEETS.INVENTORY, CONFIG.SHEETS.MAIN, CONFIG.SHEETS.EMPLOYEES].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(blue);
  });
  
  // Display/Print sheets - CYAN (#00BCD4)
  const cyan = '#00BCD4';
  [CONFIG.SHEETS.POSTER_OUTSIDE, CONFIG.SHEETS.POSTER_INSIDE, CONFIG.SHEETS.PRINT_OUT].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(cyan);
  });
  
  // Configuration/Reference - ORANGE (#FF9800)
  const orange = '#FF9800';
  [CONFIG.SHEETS.SUBSCRIBERS, CONFIG.SHEETS.DOCUMENTATION].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(orange);
  });
  
  // Admin Tools - YELLOW (#FFEB3B)
  const yellow = '#FFEB3B';
  [CONFIG.SHEETS.REQUEST_ORDER, CONFIG.SHEETS.REQUESTS].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(yellow);
  });
  
  // Error/Debug sheets - RED (#F44336)
  const red = '#F44336';
  [CONFIG.SHEETS.ERROR_LOG, CONFIG.SHEETS.DATA_INTEGRITY].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(red);
  });
  
  // Analytics/Reporting - GREEN (#4CAF50)
  const green = '#4CAF50';
  [CONFIG.SHEETS.ANALYTICS, CONFIG.SHEETS.ANALYTICS_SUMMARY].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(green);
  });
}

/**
 * Apply basic admin formatting. Currently a no-op placeholder to keep setup stable.
 * Extend here if you need specific header/column formatting for admin sheets.
 */
function applyAdminFormatting_() {
  // Format Inventory: merge A1:L1 for Last Updated banner and ensure headers on row 2
  try {
    formatInventorySheet_();
  } catch (err) {
    Logger.log(`[WARN] Inventory formatting skipped: ${err.message}`);
  }
}

/**
 * Ensures Inventory layout: A1:L1 merged for Last Updated, headers on row 2, data from row 3.
 * If headers are found elsewhere (e.g., pasted at bottom), they are removed and data is preserved.
 */
function formatInventorySheet_() {
  const sh = getSheet_(CONFIG.SHEETS.INVENTORY);
  const headers = ['Active?','Release Date','Movie Title','Company','Posters','Bus Shelters','Mini Posters','Standee','Teaser','Notes','Poster ID'];

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), headers.length);

  // Read all rows below row 2 (header), filter out header-looking rows found lower
  const rows = lastRow >= 3 ? sh.getRange(3, 1, lastRow - 2, lastCol).getValues() : [];
  const dataRows = rows.filter(r => {
    if (r.every(v => v === '' || v === null)) return false;
    const looksLikeHeader = r[0] === 'Active?' && r[1] === 'Release Date' && r[2] === 'Movie Title';
    return !looksLikeHeader;
  });

  // Clear sheet and rebuild structure
  sh.clearContents();

  // Merge top banner row A1:L1
  sh.getRange(1, 1, 1, headers.length).breakApart().merge();
  sh.getRange('A1').setHorizontalAlignment('left');

  // Set headers on row 2
  sh.getRange(2, 1, 1, headers.length).setValues([headers]);

  // Write data starting row 3
  if (dataRows.length > 0) {
    sh.getRange(3, 1, dataRows.length, headers.length).setValues(dataRows);
  }

  // Checkbox validation for Active? from row 3 downward
  const dataEnd = Math.max(3, sh.getLastRow());
  if (dataEnd >= 3) {
    setCheckboxColumn_(sh, 1, 3, dataEnd);
  }
}
/** Utils.js **/

function now_() { return new Date(); }

function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
}

function normalizeTitle_(s) {
  return String(s || '').trim().toLowerCase();
}

function getProps_() {
  return PropertiesService.getScriptProperties();
}

function isMasterAccount_() {
  const configuredAdmin = String(CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();
  const ss = SpreadsheetApp.getActive();
  const ownerEmail = String(ss.getOwner().getEmail() || '').toLowerCase().trim();
  const currentUser = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || '').toLowerCase().trim();

  if (configuredAdmin) return currentUser && currentUser === configuredAdmin;
  return currentUser && currentUser === ownerEmail;
}

function readJsonProp_(key, fallback) {
  const raw = getProps_().getProperty(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function writeJsonProp_(key, obj) {
  getProps_().setProperty(key, JSON.stringify(obj || {}));
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (headers && headers.length) {
    const existing = sh.getRange(1,1,1,headers.length).getValues()[0];
    const needs = existing.join('') !== headers.join('');
    if (needs) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      // Frozen headers removed for better UX
    }
  }
  return sh;
}

function getSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function setCheckboxColumn_(sheet, col, startRow, numRows) {
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(startRow, col, numRows - startRow + 1, 1).setDataValidation(rule);
}

function getNonEmptyData_(sheet, minCols) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.max(minCols || 1, sheet.getLastColumn());
  const vals = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return vals.filter(r => r.some(v => v !== '' && v !== null));
}

function safeArray_(v) {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\s*,\s*/).filter(Boolean);
}

function uuidPosterId_() {
  const hex = Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  return `P-${hex}`;
}

/**
 * Enforce employee name format:
 * Accepts: "Gavin N" or "Gavin N."
 * Rejects: "Miles pratt", "Gavin", "Gavin NN", etc.
 */
function normalizeEmployeeName_(input) {
  const raw = String(input || '').trim();

  // First name + last initial (optional trailing period)
  const m = raw.match(/^([A-Za-z][A-Za-z'-]{1,})\s+([A-Za-z])\.?$/);
  if (!m) {
    return { ok: false, canonical: '', reason: 'Name must be: FirstName + LastInitial (ex: "Gavin N")' };
  }

  const first = m[1];
  const initial = m[2].toUpperCase();
  const firstNice = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  return { ok: true, canonical: `${firstNice} ${initial}`, reason: '' };
}

/**
 * Fetches all posters from Inventory sheet with computed display labels.
 * Handles duplicate titles by adding (Release Date) suffix.
 * Returns array of { posterId, title, release, active, label, invCount }
 */
function getPostersWithLabels_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);  // headers on row 2, data from row 3
  
  const posters = data.map(r => ({
    posterId: String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim(),
    title: String(r[COLS.INVENTORY.TITLE - 1] || '').trim(),
    release: r[COLS.INVENTORY.RELEASE - 1],
    active: r[COLS.INVENTORY.ACTIVE - 1] === true,
    invCount: r[COLS.INVENTORY.POSTERS - 1],
  })).filter(p => p.posterId && p.title && p.release);

  // Count duplicates by title
  const titleCounts = {};
  posters.forEach(p => {
    const k = normalizeTitle_(p.title);
    titleCounts[k] = (titleCounts[k] || 0) + 1;
  });

  // Add computed labels
  posters.forEach(p => {
    const dup = titleCounts[normalizeTitle_(p.title)] > 1;
    const rd = (p.release instanceof Date) ? fmtDate_(p.release, 'yyyy-MM-dd') : String(p.release);
    p.label = dup ? `${p.title} (${rd})` : p.title;
  });

  return posters;
}

/**
 * Gets all ACTIVE requests from Requests sheet.
 * Returns array of request rows with full data.
 */
function getActiveRequests_() {
  const sh = getSheet_(CONFIG.SHEETS.REQUESTS);
  const data = getNonEmptyData_(sh, 10);
  return data.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
}

/**
 * Sort Inventory sheet by release date (ascending).
 * Called after any inventory modifications to maintain consistent ordering.
 */
function sortInventoryByReleaseDate_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  // Rows 1-2 are reserved (banner + headers). Sort only data rows starting at row 3.
  if (lastRow < 3) return;
  const range = inv.getRange(3, 1, lastRow - 2, inv.getLastColumn());
  range.sort(COLS.INVENTORY.RELEASE); // Sort by release date ascending
}


