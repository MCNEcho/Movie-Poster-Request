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
