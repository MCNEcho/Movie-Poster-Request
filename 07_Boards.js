/** 07_Boards.gs **/

/**
 * Request a board rebuild with debounce mechanism.
 * Prevents concurrent rebuilds by enforcing a minimum time between rebuilds.
 * If a rebuild is requested within the debounce period, it queues for later.
 */
function requestBoardRebuild() {
  const lastRebuild = Number(getProps_().getProperty(CONFIG.PROPS.LAST_BOARD_REBUILD_TS) || 0);
  const now = new Date().getTime();
  const timeSinceRebuild = now - lastRebuild;
  
  if (timeSinceRebuild > CONFIG.REBUILD_DEBOUNCE_MS) {
    // Enough time has passed - rebuild now
    rebuildBoards();
    getProps_().setProperty(CONFIG.PROPS.LAST_BOARD_REBUILD_TS, String(now));
  } else {
    // Too soon - queue for later
    const pendingRebuild = readJsonProp_(CONFIG.PROPS.PENDING_REBUILD, false);
    if (!pendingRebuild) {
      writeJsonProp_(CONFIG.PROPS.PENDING_REBUILD, true);
      Logger.log('[requestBoardRebuild] Rebuild queued - will check in 30 seconds');
      
      // Clean up any existing triggers before creating new one
      cleanupRebuildTriggers_();
      
      // Schedule check after debounce period
      try {
        ScriptApp.newTrigger('checkPendingRebuild')
          .timeBased()
          .after(CONFIG.REBUILD_DEBOUNCE_MS)
          .create();
      } catch (error) {
        // If trigger creation fails, log but don't fail the submission
        Logger.log(`[requestBoardRebuild] Failed to create trigger: ${error.message}`);
        // Reset pending flag so future requests can try again
        writeJsonProp_(CONFIG.PROPS.PENDING_REBUILD, false);
      }
    } else {
      Logger.log('[requestBoardRebuild] Rebuild already queued');
    }
  }
}

/**
 * Clean up any orphaned checkPendingRebuild triggers.
 * Prevents accumulation of stale triggers.
 */
function cleanupRebuildTriggers_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'checkPendingRebuild') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  } catch (error) {
    Logger.log(`[cleanupRebuildTriggers_] Error: ${error.message}`);
  }
}

/**
 * Check if there's a pending rebuild and execute it.
 * This function is called by time-based trigger.
 */
function checkPendingRebuild() {
  try {
    const pendingRebuild = readJsonProp_(CONFIG.PROPS.PENDING_REBUILD, false);
    
    if (pendingRebuild) {
      Logger.log('[checkPendingRebuild] Executing pending rebuild');
      writeJsonProp_(CONFIG.PROPS.PENDING_REBUILD, false);
      rebuildBoards();
      const now = new Date().getTime();
      getProps_().setProperty(CONFIG.PROPS.LAST_BOARD_REBUILD_TS, String(now));
    }
  } finally {
    // Always clean up triggers, even if rebuild fails
    cleanupRebuildTriggers_();
  }
}

function rebuildBoards() {
  const startTime = Date.now();
  try {
    buildMainBoard_();
    buildEmployeesBoard_();
    syncEmployeeViewSpreadsheet_();
    
    // Track analytics
    const requests = getActiveRequests_();
    const executionTime = Date.now() - startTime;
    trackBoardRebuild_('both', requests.length, executionTime);
  } catch (error) {
    logError_(error, 'rebuildBoards', 'Board rebuild failed', 'HIGH');
    throw error;
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
