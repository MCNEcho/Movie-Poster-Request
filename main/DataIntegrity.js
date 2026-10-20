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
function runFullIntegrityCheck_() {
  const checks = [
    checkForOrphanedRequests_(),
    checkInvalidActiveRequests_(),
    checkForOverCapacity_(),
    checkForDuplicates_(),
    checkRequestIds_(),
    checkMissingPosterIds_(),
  ];
  const results = {
    timestamp: now_(),
    checksPerformed: checks,
    totalIssuesFound: checks.reduce((sum, check) => sum + check.issuesFound, 0),
    autoRepaired: checks.reduce((sum, check) => sum + check.autoRepaired, 0),
    requiresAdminAction: checks.filter(check => check.status === 'REQUIRES_ACTION')
      .reduce((sum, check) => sum + check.issuesFound, 0),
  };
  Logger.log(`[INTEGRITY] Report-only check complete. Issues: ${results.totalIssuesFound}; generated inventory IDs: ${results.autoRepaired}.`);
  return results;
}

function runDataIntegrityCheckMenu() {
  const result = runFullIntegrityCheck_();
  const summary = result.checksPerformed.map(check =>
    `${check.checkType}: ${check.issuesFound} finding(s)${check.details.length ? ` — ${check.details.join('; ')}` : ''}`
  ).join('\n');
  SpreadsheetApp.getUi().alert(
    'Data Integrity Check',
    `Report-only check complete. Findings: ${result.totalIssuesFound}. Generated Inventory IDs: ${result.autoRepaired}.\n\n${summary}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return result;
}

function readRequestsForIntegrity_() {
  const sheet = getRequestsSheet_();
  const lastRow = sheet.getLastRow();
  const width = Math.max(sheet.getLastColumn(), COLS.REQUESTS.REQUEST_ID);
  return lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, width).getValues()
    .map((row, index) => ({ row, rowNumber: index + 2 }));
}

function integrityResult_(checkType) {
  return { checkType, issuesFound: 0, autoRepaired: 0, details: [], status: 'PASS' };
}

function finishIntegrityCheck_(result) {
  if (result.issuesFound && result.status === 'PASS') result.status = 'REQUIRES_ACTION';
  logIntegrityCheck_(result);
  return result;
}

function checkForOrphanedRequests_() {
  const result = integrityResult_('ORPHANED_REQUESTS');
  try {
    const inventorySheet = getSheet_(CONFIG.SHEETS.INVENTORY);
    const posterData = getNonEmptyData_(inventorySheet, COLS.INVENTORY.POSTER_ID, 3);
    const validPosterIds = new Set(posterData.map(row => String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim()).filter(Boolean));
    readRequestsForIntegrity_().forEach(({ row, rowNumber }) => {
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[COLS.REQUESTS.STATUS - 1] || '').trim();
      if (status === STATUS.ACTIVE && posterId && !validPosterIds.has(posterId)) {
        result.issuesFound++;
        result.details.push(`Requests row ${rowNumber} is ACTIVE but its poster ID is missing from Inventory.`);
      }
    });
  } catch (err) { result.status = 'ERROR'; result.details.push(`Error: ${err.message}`); }
  return finishIntegrityCheck_(result);
}

function checkInvalidActiveRequests_() {
  const result = integrityResult_('INVALID_ACTIVE_REQUESTS');
  try {
    readRequestsForIntegrity_().forEach(({ row, rowNumber }) => {
      if (String(row[COLS.REQUESTS.STATUS - 1] || '').trim() !== STATUS.ACTIVE) return;
      const email = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim();
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      if (email && posterId) return;

      result.issuesFound++;
      const missing = [!email && 'email/contact', !posterId && 'poster ID'].filter(Boolean).join(' and ');
      result.details.push(`Requests row ${rowNumber} is ACTIVE with no ${missing}.`);
    });
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }
  return finishIntegrityCheck_(result);
}

function checkForOverCapacity_() {
  const result = integrityResult_('OVER_CAPACITY');
  try {
    const employeeSlots = new Map();
    readRequestsForIntegrity_().forEach(({ row, rowNumber }) => {
      const contact = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim().toLowerCase();
      const contactType = String(row[COLS.REQUESTS.CONTACT_TYPE - 1] || 'EMPLOYEE').trim().toUpperCase();
      if (contactType === 'CUSTOMER' || String(row[COLS.REQUESTS.STATUS - 1] || '').trim() !== STATUS.ACTIVE || !contact) return;
      const key = `${contactType}:${contact}`;
      if (!employeeSlots.has(key)) employeeSlots.set(key, []);
      employeeSlots.get(key).push(rowNumber);
    });
    employeeSlots.forEach((rows, contact) => {
      if (rows.length > CONFIG.MAX_ACTIVE) {
        const excessRows = rows.slice(CONFIG.MAX_ACTIVE);
        result.issuesFound += excessRows.length;
        result.details.push(`${contact}: active requests exceed ${CONFIG.MAX_ACTIVE}; excess Requests rows: ${excessRows.join(', ')}.`);
      }
    });
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }
  return finishIntegrityCheck_(result);
}

function checkForDuplicates_() {
  const result = integrityResult_('DUPLICATE_REQUESTS');
  try {
    const seen = new Map();
    readRequestsForIntegrity_().forEach(({ row, rowNumber }) => {
      const contact = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim().toLowerCase();
      const contactType = String(row[COLS.REQUESTS.CONTACT_TYPE - 1] || 'EMPLOYEE').trim().toUpperCase();
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      if (contactType === 'CUSTOMER' || String(row[COLS.REQUESTS.STATUS - 1] || '').trim() !== STATUS.ACTIVE || !contact || !posterId) return;
      const key = `${contactType}:${contact}:${posterId}`;
      if (seen.has(key)) {
        result.issuesFound++;
        result.details.push(`Duplicate ACTIVE request at Requests row ${rowNumber}; earlier matching row ${seen.get(key)}.`);
      } else seen.set(key, rowNumber);
    });
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }
  return finishIntegrityCheck_(result);
}

function checkRequestIds_() {
  const result = integrityResult_('REQUEST_IDS');
  try {
    const idsToRows = new Map();
    readRequestsForIntegrity_().forEach(({ row, rowNumber }) => {
      if (!row.some(value => value !== null && String(value).trim() !== '')) return;
      const requestId = String(row[COLS.REQUESTS.REQUEST_ID - 1] || '').trim();
      if (!requestId) {
        result.issuesFound++;
        result.details.push(`Requests row ${rowNumber} has no Request ID.`);
        return;
      }
      if (idsToRows.has(requestId)) {
        result.issuesFound++;
        result.details.push(`Request ID ${requestId} is duplicated at Requests rows ${idsToRows.get(requestId)} and ${rowNumber}.`);
      } else idsToRows.set(requestId, rowNumber);
    });
  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }
  return finishIntegrityCheck_(result);
}

function checkMissingPosterIds_() {
  const result = integrityResult_('MISSING_POSTER_IDS');
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

      result.details.push(`Generated missing Inventory poster IDs in rows ${missingRows.join(', ')}.`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  return finishIntegrityCheck_(result);
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

// End of DataIntegrity.js.

