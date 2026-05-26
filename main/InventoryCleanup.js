/** InventoryCleanup.js **/

function handleSheetChange(e) {
  try {
    const changeType = e && e.changeType ? String(e.changeType) : '';
    Logger.log(`[handleSheetChange] Triggered with changeType: ${changeType || 'UNKNOWN'}`);
    
    // Detect Inventory sheet row deletions
    detectAndProcessInventoryRemovals_('onChange', changeType);
    
    // Detect Requests sheet row deletions
    detectAndProcessRequestsDeletions_(changeType);
  } catch (err) {
    logError_(err, 'handleSheetChange', 'Sheet change detection');
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

    // Capture who deleted the row
    const userEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
    
    Logger.log(
      `[inventoryCleanup] Detected removals via ${source}${changeType ? '/' + changeType : ''}: ${removedIds.join(', ')}`
    );
    Logger.log(`[inventoryCleanup] Deleted by user: ${userEmail}`);

    const statusTs = now_();
    const result = closeActiveRequestsByPosterIds_(
      removedIds,
      STATUS.REMOVED_INVENTORY_DELETE,
      statusTs
    );

    Logger.log(
      `[inventoryCleanup] Closed ${result.closedCount} request(s) across ${Object.keys(result.empCounts).length} employee(s)`
    );

    // Log to Analytics sheet for audit trail
    try {
      const analytics = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        const removedLabels = removedIds.map(id => prevSnapshot[id]?.title || id).join(', ');
        analytics.appendRow([
          fmtDate_(statusTs, CONFIG.DATE_FORMAT),
          'INVENTORY_DELETE',
          userEmail,
          'System',
          '',
          removedLabels,
          'COMPLETE',
          0,
          0,
          0,
          result.closedCount,
          `User ${userEmail} deleted ${removedIds.length} poster(s) from Inventory: ${removedLabels}. Closed ${result.closedCount} active request(s).`
        ]);
      }
    } catch (err) {
      Logger.log(`[inventoryCleanup] Analytics logging failed: ${err.message}`);
    }

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

/**
 * Detect and log deletions in the Requests sheet
 */
function detectAndProcessRequestsDeletions_(changeType) {
  Logger.log(`[detectAndProcessRequestsDeletions_] Called with changeType: ${changeType}`);
  
  // Only process on REMOVE_ROW change type (row deletion)
  if (changeType !== 'REMOVE_ROW') {
    Logger.log(`[detectAndProcessRequestsDeletions_] Skipping - not a REMOVE_ROW event`);
    return;
  }
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const prevSnapshot = readJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, {});
    const currentSnapshot = buildRequestsSnapshot_();
    
    Logger.log(`[detectAndProcessRequestsDeletions_] Previous snapshot had ${Object.keys(prevSnapshot).length} rows, current has ${Object.keys(currentSnapshot).length} rows`);
    
    // Find deleted rows (row numbers that were in previous but not in current)
    const deletedRows = Object.keys(prevSnapshot).filter(rowNum => !currentSnapshot[rowNum]);
    if (deletedRows.length === 0) {
      Logger.log(`[detectAndProcessRequestsDeletions_] No deletions detected`);
      writeJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, currentSnapshot);
      return;
    }

    // Capture who deleted the row
    const adminEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
    
    Logger.log(`[requestsDeletion] Detected deletion of ${deletedRows.length} request row(s)`);
    Logger.log(`[requestsDeletion] Deleted by user: ${adminEmail}`);

    const statusTs = now_();
    
    // Log each deleted request to Analytics
    try {
      const analytics = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        deletedRows.forEach(rowNum => {
          const deletedRequest = prevSnapshot[rowNum];
          if (deletedRequest) {
            analytics.appendRow([
              fmtDate_(statusTs, CONFIG.DATE_FORMAT),
              'REQUEST_DELETE',
              adminEmail,
              deletedRequest.contactType || 'EMPLOYEE',
              'System',
              deletedRequest.posterLabel,
              'COMPLETE',
              0, 0, 0, 1,
              `Admin ${adminEmail} deleted request from Requests sheet: ${deletedRequest.empName} (${deletedRequest.contact}) → ${deletedRequest.posterLabel}`
            ]);
          }
        });
      }
    } catch (analyticsErr) {
      Logger.log(`[requestsDeletion] Analytics logging failed: ${analyticsErr.message}`);
    }

    // Update snapshot for next comparison
    writeJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, currentSnapshot);
  } catch (err) {
    Logger.log(`[requestsDeletion] Error: ${err.message}`);
    logError_(err, 'detectAndProcessRequestsDeletions_', 'Requests sheet deletion detection');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Build a snapshot of all Requests sheet rows for deletion detection
 */
function buildRequestsSnapshot_() {
  const sh = getRequestsSheet_();
  const data = sh.getDataRange().getValues();
  const snapshot = {};

  // Skip header row (row 1)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1; // Google Sheets are 1-indexed
    
    // Store minimal data for each row: employee/customer name, contact, poster, status
    snapshot[String(rowNum)] = {
      empName: String(row[COLS.REQUESTS.EMP_NAME - 1] || '').trim(),
      contact: String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim(),
      posterLabel: String(row[COLS.REQUESTS.LABEL_AT_REQ - 1] || '').trim(),
      contactType: String(row[COLS.REQUESTS.CONTACT_TYPE - 1] || 'EMPLOYEE').toUpperCase(),
      status: String(row[COLS.REQUESTS.STATUS - 1] || '').trim(),
    };
  }

  return snapshot;
}

/**
 * Initialize Requests snapshot on setup
 */
function initializeRequestsSnapshot_() {
  const snapshot = buildRequestsSnapshot_();
  writeJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, snapshot);
}
