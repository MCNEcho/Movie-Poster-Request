/** 15_DataIntegrity.js **/

/**
 * Data Validation & Integrity Checking Framework
 * 
 * Automated data validation checks to ensure system integrity.
 * Detects orphaned requests, duplicate data, and over-capacity assignments.
 */

/**
 * Run all data integrity checks.
 * 
 * @param {boolean} autoFix - Whether to automatically fix minor issues
 * @returns {Object} Check results summary
 */
function runDataIntegrityChecks_(autoFix = false) {
  const startTime = Date.now();
  const results = {
    timestamp: now_(),
    checks_run: 0,
    issues_found: 0,
    issues_fixed: 0,
    checks: []
  };
  
  // Run individual checks
  results.checks.push(checkOrphanedRequests_(autoFix));
  results.checks.push(checkEmailFormats_(autoFix));
  results.checks.push(checkDuplicateActiveRequests_(autoFix));
  results.checks.push(checkRequestCounts_(autoFix));
  results.checks.push(checkOverCapacity_(autoFix));
  
  // Calculate totals
  results.checks.forEach(check => {
    results.checks_run++;
    results.issues_found += check.issues_found;
    results.issues_fixed += check.issues_fixed;
  });
  
  // Log to Data Integrity sheet
  logIntegrityCheck_(results);
  
  // Log analytics event
  const executionTime = Date.now() - startTime;
  logAnalyticsEvent_('data_integrity_check', '', {
    issues_found: results.issues_found,
    issues_fixed: results.issues_fixed
  }, executionTime, true);
  
  return results;
}

/**
 * Check for orphaned requests (requests with deleted posters).
 * 
 * @param {boolean} autoFix - Whether to auto-fix issues
 * @returns {Object} Check results
 */
function checkOrphanedRequests_(autoFix) {
  const result = {
    check_type: 'orphaned_requests',
    status: 'PASS',
    issues_found: 0,
    issues_fixed: 0,
    details: []
  };
  
  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const requestsData = getNonEmptyData_(requestsSheet, 10);
    const posterIds = getPostersWithLabels_().map(p => p.posterId);
    const posterIdSet = new Set(posterIds);
    
    requestsData.forEach((r, idx) => {
      const status = r[COLS.REQUESTS.STATUS - 1];
      const posterId = r[COLS.REQUESTS.POSTER_ID - 1];
      
      // Only check ACTIVE requests
      if (status === STATUS.ACTIVE && !posterIdSet.has(posterId)) {
        result.issues_found++;
        result.details.push(`Row ${idx + 2}: Active request for deleted poster ${posterId}`);
        result.status = 'FAIL';
        
        // Auto-fix by marking as REMOVED
        if (autoFix) {
          r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
          r[COLS.REQUESTS.STATUS_TS - 1] = now_();
          result.issues_fixed++;
        }
      }
    });
    
    // Write back fixes if any
    if (autoFix && result.issues_fixed > 0) {
      const range = requestsSheet.getRange(2, 1, requestsData.length, requestsSheet.getLastColumn());
      range.setValues(requestsData);
      result.details.push(`Auto-fixed: Marked ${result.issues_fixed} orphaned requests as REMOVED`);
      
      // Notify admin of auto-repair
      notifyAdminOfAutoRepair_('orphaned_requests', result.issues_fixed, result.details);
    }
    
  } catch (error) {
    result.status = 'ERROR';
    result.details.push(`Error: ${error.message}`);
    logError_(error, 'checkOrphanedRequests_', 'Data integrity check', 'MEDIUM');
  }
  
  return result;
}

/**
 * Check email format in Subscribers sheet.
 * 
 * @param {boolean} autoFix - Whether to auto-fix issues
 * @returns {Object} Check results
 */
function checkEmailFormats_(autoFix) {
  const result = {
    check_type: 'email_formats',
    status: 'PASS',
    issues_found: 0,
    issues_fixed: 0,
    details: []
  };
  
  try {
    const subscribersSheet = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
    const data = getNonEmptyData_(subscribersSheet, 3);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    data.forEach((r, idx) => {
      const email = String(r[COLS.SUBSCRIBERS.EMAIL - 1] || '').trim();
      
      if (email && !emailRegex.test(email)) {
        result.issues_found++;
        result.details.push(`Row ${idx + 2}: Invalid email format: ${email}`);
        result.status = 'FAIL';
        
        // Auto-fix by marking as inactive
        if (autoFix) {
          r[COLS.SUBSCRIBERS.ACTIVE - 1] = false;
          result.issues_fixed++;
        }
      }
    });
    
    // Write back fixes if any
    if (autoFix && result.issues_fixed > 0) {
      const range = subscribersSheet.getRange(2, 1, data.length, subscribersSheet.getLastColumn());
      range.setValues(data);
      result.details.push(`Auto-fixed: Deactivated ${result.issues_fixed} subscribers with invalid emails`);
      
      // Notify admin of auto-repair
      notifyAdminOfAutoRepair_('email_formats', result.issues_fixed, result.details);
    }
    
  } catch (error) {
    result.status = 'ERROR';
    result.details.push(`Error: ${error.message}`);
    logError_(error, 'checkEmailFormats_', 'Data integrity check', 'MEDIUM');
  }
  
  return result;
}

/**
 * Check for duplicate active requests per employee/poster.
 * 
 * @param {boolean} autoFix - Whether to auto-fix issues
 * @returns {Object} Check results
 */
function checkDuplicateActiveRequests_(autoFix) {
  const result = {
    check_type: 'duplicate_active_requests',
    status: 'PASS',
    issues_found: 0,
    issues_fixed: 0,
    details: []
  };
  
  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 10);
    
    const activeRequests = {};
    const duplicates = [];
    
    data.forEach((r, idx) => {
      const status = r[COLS.REQUESTS.STATUS - 1];
      if (status === STATUS.ACTIVE) {
        const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim();
        const posterId = r[COLS.REQUESTS.POSTER_ID - 1];
        const key = `${email}|${posterId}`;
        
        if (activeRequests[key]) {
          result.issues_found++;
          result.details.push(`Row ${idx + 2}: Duplicate active request for ${email} - ${posterId}`);
          result.status = 'FAIL';
          duplicates.push(idx);
          
          // Auto-fix by marking the duplicate as REMOVED (keep the first one)
          if (autoFix) {
            r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
            r[COLS.REQUESTS.STATUS_TS - 1] = now_();
            result.issues_fixed++;
          }
        } else {
          activeRequests[key] = idx;
        }
      }
    });
    
    // Write back fixes if any
    if (autoFix && result.issues_fixed > 0) {
      const range = requestsSheet.getRange(2, 1, data.length, requestsSheet.getLastColumn());
      range.setValues(data);
      result.details.push(`Auto-fixed: Removed ${result.issues_fixed} duplicate active requests`);
      
      // Notify admin of auto-repair
      notifyAdminOfAutoRepair_('duplicate_active_requests', result.issues_fixed, result.details);
    }
    
  } catch (error) {
    result.status = 'ERROR';
    result.details.push(`Error: ${error.message}`);
    logError_(error, 'checkDuplicateActiveRequests_', 'Data integrity check', 'MEDIUM');
  }
  
  return result;
}

/**
 * Verify request counts match between sheets.
 * 
 * @param {boolean} autoFix - Whether to auto-fix issues
 * @returns {Object} Check results
 */
function checkRequestCounts_(autoFix) {
  const result = {
    check_type: 'request_counts',
    status: 'PASS',
    issues_found: 0,
    issues_fixed: 0,
    details: []
  };
  
  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const requestsData = getNonEmptyData_(requestsSheet, 10);
    
    // Count active requests
    const activeCount = requestsData.filter(r => r[COLS.REQUESTS.STATUS - 1] === STATUS.ACTIVE).length;
    
    // Get count from Main board
    const mainSheet = getSheet_(CONFIG.SHEETS.MAIN);
    const mainData = getNonEmptyData_(mainSheet, 2);
    
    // Count non-header rows (employee names)
    const mainCount = mainData.filter(r => {
      const col1 = String(r[0] || '').trim();
      const col2 = r[1];
      // It's a request row if col1 is not empty and col2 is a date
      return col1 && col2 instanceof Date;
    }).length;
    
    if (activeCount !== mainCount) {
      result.issues_found++;
      result.details.push(`Mismatch: Requests sheet has ${activeCount} active, Main board shows ${mainCount}`);
      result.status = 'WARNING';
      
      // Auto-fix by rebuilding boards
      if (autoFix) {
        rebuildBoards();
        result.issues_fixed++;
        result.details.push(`Auto-fixed: Rebuilt boards to sync counts`);
        
        // Notify admin of auto-repair
        notifyAdminOfAutoRepair_('request_counts', 1, result.details);
      }
    }
    
  } catch (error) {
    result.status = 'ERROR';
    result.details.push(`Error: ${error.message}`);
    logError_(error, 'checkRequestCounts_', 'Data integrity check', 'MEDIUM');
  }
  
  return result;
}

/**
 * Detect over-capacity assignments (more than 5 requests per employee).
 * 
 * @param {boolean} autoFix - Whether to auto-fix issues
 * @returns {Object} Check results
 */
function checkOverCapacity_(autoFix) {
  const result = {
    check_type: 'over_capacity',
    status: 'PASS',
    issues_found: 0,
    issues_fixed: 0,
    details: []
  };
  
  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 10);
    
    const employeeCounts = {};
    
    data.forEach(r => {
      const status = r[COLS.REQUESTS.STATUS - 1];
      if (status === STATUS.ACTIVE) {
        const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim();
        employeeCounts[email] = (employeeCounts[email] || 0) + 1;
      }
    });
    
    Object.entries(employeeCounts).forEach(([email, count]) => {
      if (count > CONFIG.MAX_ACTIVE) {
        result.issues_found++;
        result.details.push(`Employee ${email} has ${count} active requests (max: ${CONFIG.MAX_ACTIVE})`);
        result.status = 'FAIL';
      }
    });
    
    // Note: Auto-fix for over-capacity is complex and requires business logic
    // (which requests to remove?), so we don't auto-fix this issue
    if (result.issues_found > 0) {
      result.details.push('Manual review required: Cannot auto-fix over-capacity assignments');
    }
    
  } catch (error) {
    result.status = 'ERROR';
    result.details.push(`Error: ${error.message}`);
    logError_(error, 'checkOverCapacity_', 'Data integrity check', 'MEDIUM');
  }
  
  return result;
}

/**
 * Log integrity check results to Data Integrity sheet.
 * 
 * @param {Object} results - Check results
 * @returns {void}
 */
function logIntegrityCheck_(results) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.DATA_INTEGRITY);
    
    results.checks.forEach(check => {
      const row = [];
      row[COLS.DATA_INTEGRITY.CHECK_TIME - 1] = results.timestamp;
      row[COLS.DATA_INTEGRITY.CHECK_TYPE - 1] = check.check_type;
      row[COLS.DATA_INTEGRITY.STATUS - 1] = check.status;
      row[COLS.DATA_INTEGRITY.ISSUES_FOUND - 1] = check.issues_found;
      row[COLS.DATA_INTEGRITY.AUTO_FIXED - 1] = check.issues_fixed;
      row[COLS.DATA_INTEGRITY.DETAILS - 1] = check.details.join(' | ');
      
      sh.appendRow(row);
    });
  } catch (error) {
    console.error(`[logIntegrityCheck] Failed to log: ${error.message}`);
  }
}

/**
 * Menu function to run data integrity checks on demand.
 * 
 * @returns {void}
 */
function runDataIntegrityChecksMenu() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Run Data Integrity Checks',
    'Do you want to automatically fix minor issues?',
    ui.ButtonSet.YES_NO
  );
  
  const autoFix = response === ui.Button.YES;
  
  ui.alert('Running data integrity checks...');
  const results = runDataIntegrityChecks_(autoFix);
  
  const message = [
    `Checks completed: ${results.checks_run}`,
    `Issues found: ${results.issues_found}`,
    `Issues fixed: ${results.issues_fixed}`,
    '',
    'Check the Data Integrity sheet for details.'
  ].join('\n');
  
  ui.alert('Data Integrity Check Complete', message, ui.ButtonSet.OK);
}

/**
 * Send email notification to admin when auto-repairs occur.
 * 
 * @param {string} checkType - Type of integrity check
 * @param {number} issuesFixed - Number of issues fixed
 * @param {Array} details - Details array from check
 * @returns {void}
 */
function notifyAdminOfAutoRepair_(checkType, issuesFixed, details) {
  try {
    const adminEmail = CONFIG.ADMIN_EMAIL || Session.getActiveUser().getEmail();
    const subject = `[AUTO-REPAIR] Poster System Data Integrity: ${checkType}`;
    const body = [
      'The Poster Request System automatically repaired data integrity issues:',
      '',
      `Check Type: ${checkType}`,
      `Issues Fixed: ${issuesFixed}`,
      `Time: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`,
      '',
      'Details:',
      ...details.map(d => `  - ${d}`),
      '',
      'These repairs were made automatically. Please review the Data Integrity sheet for full details.',
      '',
      'If you see this frequently, consider investigating the root cause.'
    ].join('\n');
    
    MailApp.sendEmail(adminEmail, subject, body);
  } catch (emailError) {
    console.error(`Failed to send auto-repair notification: ${emailError.message}`);
  }
}
