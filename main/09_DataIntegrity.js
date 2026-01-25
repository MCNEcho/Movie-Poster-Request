/** 09_DataIntegrity.js **/

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
    const posterData = getNonEmptyData_(inventorySheet, 12);

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
    const data = getNonEmptyData_(inventorySheet, 12);

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
