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
    Logger.log('[handleSheetChange] Script lock is busy; queueing row-removal reconciliation.');
    const tasks = {};
    if (inventoryChanged) tasks.inventoryCleanup = true;
    if (requestsChanged) tasks.requestsCleanup = true;
    queueManualPosterRefresh_(tasks);
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

function processQueuedRequestsDeletionScan_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return null;
  let deleted = false;
  try {
    deleted = detectAndProcessRequestsDeletionsLocked_();
  } finally {
    lock.releaseLock();
  }
  if (deleted) queueManualPosterRefresh_({ boards: true, form: true, employeeView: true });
  return deleted;
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
    const snapshotSheet = getSheet_(CONFIG.SHEETS.REQUEST_SNAPSHOT);
    const oldValues = snapshotSheet.getLastRow() < 2
      ? []
      : snapshotSheet.getRange(2, 1, snapshotSheet.getLastRow() - 1, 7).getValues();
    const previous = {};
    oldValues.forEach(row => {
      const id = String(row[0] || '').trim();
      if (id) previous[id] = {
        timestamp: row[1], contact: String(row[2] || '').trim(),
        empName: String(row[3] || '').trim(), posterId: String(row[4] || '').trim(),
        posterLabel: String(row[5] || '').trim(), contactType: String(row[6] || 'EMPLOYEE').toUpperCase(),
      };
    });
    const current = buildRequestsSnapshot_();
    const deletedIds = findDeletedRequestIds_(previous, current);
    if (deletedIds.length === 0) {
      writeRequestsDeletionSnapshot_(current);
      return false;
    }

    // Capture who deleted the row
    const adminEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
    
    Logger.log(`[requestsDeletion] Detected deletion of ${deletedIds.length} request row(s)`);
    Logger.log(`[requestsDeletion] Deleted by user: ${adminEmail}`);

    const statusTs = now_();
    
    // Log each deleted request to Analytics
    try {
      const analytics = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        deletedIds.forEach(requestId => {
          const deletedRequest = previous[requestId];
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
              `Admin ${adminEmail} deleted request ${requestId} from Requests sheet: ${deletedRequest.empName} (${deletedRequest.contact}) → ${deletedRequest.posterLabel}`
            ]);
          }
        });
      }
    } catch (analyticsErr) {
      Logger.log(`[requestsDeletion] Analytics logging failed: ${analyticsErr.message}`);
    }

    writeRequestsDeletionSnapshot_(current);
    return true;
}

/**
 * Build a snapshot of all Requests sheet rows for deletion detection
 */
function buildRequestsSnapshot_() {
  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  const data = lastRow < 2
    ? []
    : sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), COLS.REQUESTS.REQUEST_ID)).getValues();
  const snapshot = {};

  data.forEach(row => {
    const requestId = String(row[COLS.REQUESTS.REQUEST_ID - 1] || '').trim();
    if (!requestId) return;
    snapshot[requestId] = {
      timestamp: row[COLS.REQUESTS.REQ_TS - 1],
      empName: String(row[COLS.REQUESTS.EMP_NAME - 1] || '').trim(),
      contact: String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim(),
      posterId: String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim(),
      posterLabel: String(row[COLS.REQUESTS.LABEL_AT_REQ - 1] || '').trim(),
      contactType: String(row[COLS.REQUESTS.CONTACT_TYPE - 1] || 'EMPLOYEE').toUpperCase(),
    };
  });

  return snapshot;
}

function findDeletedRequestIds_(previous, current) {
  return Object.keys(previous || {}).filter(id => !Object.prototype.hasOwnProperty.call(current || {}, id));
}

function writeRequestsDeletionSnapshot_(snapshot) {
  const sheet = getSheet_(CONFIG.SHEETS.REQUEST_SNAPSHOT);
  const rows = Object.keys(snapshot || {}).map(id => {
    const item = snapshot[id];
    return [id, item.timestamp || '', item.contact || '', item.empName || '', item.posterId || '', item.posterLabel || '', item.contactType || 'EMPLOYEE'];
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 7).setValues([['Request ID','Request Timestamp','Contact','Employee Name','Poster ID','Poster Label','Contact Type']]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  getProps_().setProperty(CONFIG.PROPS.REQUESTS_ROW_COUNT, String(Math.max(0, getRequestsSheet_().getLastRow() - 1)));
}

/**
 * Initialize Requests snapshot on setup
 */
function initializeRequestsSnapshot_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) throw new Error('Cannot initialize request deletion snapshot while another ledger write is running.');
  try {
    ensureRequestIdsLocked_();
    writeRequestsDeletionSnapshot_(buildRequestsSnapshot_());
  } finally {
    lock.releaseLock();
  }
}
