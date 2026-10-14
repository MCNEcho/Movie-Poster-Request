/** InventoryCleanup.js **/

function handleSheetEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== CONFIG.SHEETS.INVENTORY || e.range.getRow() < 3) return;

  const startCol = e.range.getColumn();
  const endCol = startCol + e.range.getNumColumns() - 1;
  const watchedCols = [
    COLS.INVENTORY.ACTIVE,
    COLS.INVENTORY.RELEASE,
    COLS.INVENTORY.TITLE,
    COLS.INVENTORY.POSTERS,
    COLS.INVENTORY.POSTER_ID,
  ];
  if (!watchedCols.some(col => col >= startCol && col <= endCol)) return;

  try {
    updateInventoryLastUpdated_();
    const removalHandledBeforeIdRepair = detectInventoryRemovalsFromEdit_(e);
    if (removalHandledBeforeIdRepair === null) {
      queueManualPosterRefresh_({ inventoryCleanup: true });
      return;
    }
    ensurePosterIdsInInventory_();
    sortInventoryByReleaseDate_();

    const identityCols = [COLS.INVENTORY.RELEASE, COLS.INVENTORY.TITLE, COLS.INVENTORY.POSTER_ID];
    const identityChanged = identityCols.some(col => col >= startCol && col <= endCol);
    const removalHandledAfterIdRepair = identityChanged
      ? detectAndProcessInventoryRemovals_('onEditAfterIdRepair', 'CONTENT_EDIT')
      : false;
    if (removalHandledAfterIdRepair === null) {
      queueManualPosterRefresh_({ inventoryCleanup: true });
      return;
    }

    if (!removalHandledBeforeIdRepair && !removalHandledAfterIdRepair) processInventoryEdit_(e);
  } catch (err) {
    logError_(err, 'handleSheetEdit', 'Inventory edit processing');
  }
}

function processInventoryEdit_(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (!sheet || sheet.getName() !== CONFIG.SHEETS.INVENTORY || e.range.getRow() < 3) return;

  queueManualPosterRefresh_(true);
}

function handleSheetChange(e) {
  const changeType = e && e.changeType ? String(e.changeType) : '';
  if (changeType !== 'REMOVE_ROW') return;

  const ss = SpreadsheetApp.getActive();
  const inventoryCount = Math.max(0, ss.getSheetByName(CONFIG.SHEETS.INVENTORY).getLastRow() - 2);
  const requestsCount = Math.max(0, getRequestsSheet_().getLastRow() - 1);
  const props = getProps_();
  const inventoryChanged = Number(props.getProperty(CONFIG.PROPS.INVENTORY_ROW_COUNT)) !== inventoryCount;
  const requestsChanged = Number(props.getProperty(CONFIG.PROPS.REQUESTS_ROW_COUNT)) !== requestsCount;
  if (!inventoryChanged && !requestsChanged) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    Logger.log('[handleSheetChange] Skipped row-removal scan because the script lock is busy; a later REMOVE_ROW event can retry.');
    return;
  }

  let inventoryRemoved = false;
  let requestsRemoved = false;
  try {
    if (inventoryChanged) inventoryRemoved = detectAndProcessInventoryRemovalsLocked_('onChange', changeType);
    if (requestsChanged) requestsRemoved = detectAndProcessRequestsDeletionsLocked_();
  } catch (err) {
    logError_(err, 'handleSheetChange', 'Row deletion detection');
  } finally {
    lock.releaseLock();
  }

  if (inventoryRemoved) queueManualPosterRefresh_(true);
  else if (requestsRemoved) queueManualPosterRefresh_({ boards: true, form: true, employeeView: true });
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
  if (!lock.tryLock(0)) {
    Logger.log(`[inventoryCleanup] Skipped ${source} removal scan because the script lock is busy.`);
    return null;
  }
  let removed = false;
  try {
    removed = detectAndProcessInventoryRemovalsLocked_(source, changeType);
  } finally {
    lock.releaseLock();
  }

  if (removed) queueManualPosterRefresh_(true);
  return removed;
}

function processQueuedInventoryRemovalScan_() {
  const result = detectAndProcessInventoryRemovals_('queued', 'CONTENT_CLEAR');
  if (result === null) queueManualPosterRefresh_({ inventoryCleanup: true });
  return result;
}

function detectAndProcessInventoryRemovalsLocked_(source, changeType) {
  const prevSnapshot = readJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, {});
  const currentSnapshot = buildInventoryPosterSnapshot_();
  const removedIds = Object.keys(prevSnapshot).filter(id => !currentSnapshot[id]);
  const userEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
  let removed = false;

  if (removedIds.length > 0) {
    removed = true;
    Logger.log(`[inventoryCleanup] Detected removals via ${source}${changeType ? '/' + changeType : ''}: ${removedIds.join(', ')}`);
    const statusTs = now_();
    const result = closeActiveRequestsByPosterIds_(removedIds, STATUS.REMOVED_INVENTORY_DELETE, statusTs);
    Logger.log(`[inventoryCleanup] Closed ${result.closedCount} request(s) across ${Object.keys(result.empCounts).length} employee(s)`);

    try {
      const analytics = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        const removedLabels = removedIds.map(id => prevSnapshot[id]?.title || id).join(', ');
        analytics.appendRow([
          fmtDate_(statusTs, CONFIG.DATE_FORMAT), 'INVENTORY_DELETE', userEmail, 'System', '', removedLabels,
          'COMPLETE', 0, 0, 0, result.closedCount,
          `User ${userEmail} deleted ${removedIds.length} poster(s) from Inventory: ${removedLabels}. Closed ${result.closedCount} active request(s).`
        ]);
      }
    } catch (err) {
      Logger.log(`[inventoryCleanup] Analytics logging failed: ${err.message}`);
    }
  }

  writeJsonProp_(CONFIG.PROPS.INVENTORY_SNAPSHOT, currentSnapshot);
  getProps_().setProperty(CONFIG.PROPS.INVENTORY_ROW_COUNT, String(Math.max(0, getSheet_(CONFIG.SHEETS.INVENTORY).getLastRow() - 2)));
  return removed;
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
  getProps_().setProperty(CONFIG.PROPS.INVENTORY_ROW_COUNT, String(Math.max(0, getSheet_(CONFIG.SHEETS.INVENTORY).getLastRow() - 2)));
}

/**
 * Detect and log deletions in the Requests sheet
 */
function detectAndProcessRequestsDeletionsLocked_() {
    const prevSnapshot = readJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, {});
    const currentSnapshot = buildRequestsSnapshot_();
    
    Logger.log(`[detectAndProcessRequestsDeletions_] Previous snapshot had ${Object.keys(prevSnapshot).length} rows, current has ${Object.keys(currentSnapshot).length} rows`);
    
    // Find deleted rows (row numbers that were in previous but not in current)
    const deletedRows = Object.keys(prevSnapshot).filter(rowNum => !currentSnapshot[rowNum]);
    if (deletedRows.length === 0) {
      writeJsonProp_(CONFIG.PROPS.REQUESTS_SNAPSHOT, currentSnapshot);
      getProps_().setProperty(CONFIG.PROPS.REQUESTS_ROW_COUNT, String(Math.max(0, getRequestsSheet_().getLastRow() - 1)));
      return false;
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
    getProps_().setProperty(CONFIG.PROPS.REQUESTS_ROW_COUNT, String(Math.max(0, getRequestsSheet_().getLastRow() - 1)));
    return deletedRows.length > 0;
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
  getProps_().setProperty(CONFIG.PROPS.REQUESTS_ROW_COUNT, String(Math.max(0, getRequestsSheet_().getLastRow() - 1)));
}
