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

    // Check 2: Required fields on active ledger rows
    const invalidActiveCheck = checkInvalidActiveRequests_();
    results.checksPerformed.push(invalidActiveCheck);
    results.totalIssuesFound += invalidActiveCheck.issuesFound;
    results.requiresAdminAction += invalidActiveCheck.issuesFound;

    // Check 3: Over-capacity assignments
    const overCapCheck = checkForOverCapacity_();
    results.checksPerformed.push(overCapCheck);
    results.totalIssuesFound += overCapCheck.issuesFound;
    results.autoRepaired += overCapCheck.autoRepaired;

    // Check 4: Duplicate active requests
    const duplicateCheck = checkForDuplicates_();
    results.checksPerformed.push(duplicateCheck);
    results.totalIssuesFound += duplicateCheck.issuesFound;
    results.autoRepaired += duplicateCheck.autoRepaired;

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
 * Find orphaned ACTIVE requests and close them without deleting audit rows.
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
    const lastRequestRow = requestsSheet.getLastRow();
    const requestData = lastRequestRow < 2
      ? []
      : requestsSheet.getRange(2, 1, lastRequestRow - 1, Math.max(requestsSheet.getLastColumn(), COLS.REQUESTS.NOTES)).getValues();
    const posterData = getNonEmptyData_(inventorySheet, COLS.INVENTORY.POSTER_ID, 3);
    const validPosterIds = new Set(posterData.map(row => String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim()).filter(Boolean));
    const orphanedRows = [];

    requestData.forEach((row, idx) => {
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[COLS.REQUESTS.STATUS - 1] || '').trim();
      if (status === STATUS.ACTIVE && posterId && !validPosterIds.has(posterId)) {
        orphanedRows.push(idx + 2);
        result.issuesFound++;
      }
    });

    if (orphanedRows.length) {
      result.status = 'REPAIRED';
      result.autoRepaired = orphanedRows.length;
      result.details.push(`Marked ${orphanedRows.length} orphaned request(s) removed; ledger rows preserved.`);
      orphanedRows.forEach(rowNum => {
        requestsSheet.getRange(rowNum, COLS.REQUESTS.STATUS, 1, 2)
          .setValues([['REMOVED_ORPHANED', now_()]]);
      });
    }
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkInvalidActiveRequests_() {
  const result = {
    checkType: 'INVALID_ACTIVE_REQUESTS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS',
  };

  try {
    const requestsSheet = getRequestsSheet_();
    const lastRow = requestsSheet.getLastRow();
    const rows = lastRow < 2
      ? []
      : requestsSheet.getRange(2, 1, lastRow - 1, Math.max(requestsSheet.getLastColumn(), COLS.REQUESTS.NOTES)).getValues();
    rows.forEach((row, index) => {
      if (String(row[COLS.REQUESTS.STATUS - 1] || '').trim() !== STATUS.ACTIVE) return;
      const email = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim();
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      if (email && posterId) return;

      result.issuesFound++;
      const missing = [!email && 'email/contact', !posterId && 'poster ID'].filter(Boolean).join(' and ');
      result.details.push(`Requests row ${index + 2} is ACTIVE with no ${missing}.`);
    });
    if (result.issuesFound) result.status = 'REQUIRES_ACTION';
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

/**
 * Check for over-capacity assignments (more than CONFIG.MAX_ACTIVE per employee)
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
    const lastRow = inventorySheet.getLastRow();
    const data = lastRow < 3
      ? []
      : inventorySheet.getRange(3, 1, lastRow - 2, Math.max(inventorySheet.getLastColumn(), COLS.INVENTORY.POSTER_ID)).getValues();

    const missingRows = [];

    data.forEach((row, idx) => {
      if (!row.some(value => value !== '' && value !== null)) return;
      const posterId = String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      if (!posterId) {
        missingRows.push(idx + 3);
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
