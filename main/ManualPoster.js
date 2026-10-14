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
              const refreshMessage = result.refreshQueued
                ? 'Form and display refreshes are running in the background.'
                : 'Refreshes could not be queued; use Refresh Manager to update dependent views.';
              showStatus('Poster added! ' + refreshMessage + ' Row: ' + result.row, 'success');
              setTimeout(() => google.script.host.close(), 1800);
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
  const startedAt = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let lockReleased = false;
  
  try {
    SpreadsheetApp.getActive().toast('⏳ Adding poster to inventory...', 'Manual Poster', 3);

    const ss = SpreadsheetApp.getActive();
    
    // Capture user for audit trail (use getEffectiveUser with fallback)
    const adminEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
    Logger.log(`[addManualPoster] Manual poster addition initiated by admin: ${adminEmail}`);
    
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
    initializeInventorySnapshot_();
    
    // Update last updated timestamp
    updateInventoryLastUpdated_();

    // Release the shared lock before slower cross-sheet, form, and display work.
    lock.releaseLock();
    lockReleased = true;
    
    // Visual feedback after dialog closes
    SpreadsheetApp.getActive().toast(
      `✅ Poster added!\n${title}\nRelease: ${fmtDate_(release, 'MMM dd, yyyy')}`,
      'Poster Added',
      5
    );
    
    Logger.log(`[addManualPoster] Added poster at row ${nextRow}: ${title} (inventory write path ${Date.now() - startedAt}ms)`);
    
    // Log to Analytics for audit trail
    try {
      const analytics = ss.getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        analytics.appendRow([
          fmtDate_(now_(), CONFIG.DATE_FORMAT),
          'MANUAL_POSTER_ADD',
          adminEmail,
          'Inventory',
          '',
          title.trim(),
          'COMPLETE',
          0, 0, 0, 1,
          `Admin ${adminEmail} added poster to inventory: ${title.trim()} (Release: ${fmtDate_(release, 'MMM dd, yyyy')}, Active: ${!!active})`
        ]);
      }
    } catch (analyticsErr) {
      Logger.log(`[WARN] Analytics logging failed: ${analyticsErr.message}`);
    }

    let refreshQueued = false;
    try {
      queueManualPosterRefresh_();
      refreshQueued = true;
    } catch (queueErr) {
      Logger.log(`[addManualPoster] Warning: background refresh could not be queued: ${queueErr.message}`);
    }
    
    return { 
      success: true, 
      message: 'Poster added successfully',
      row: nextRow,
      refreshQueued,
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
    if (!lockReleased) lock.releaseLock();
  }
}

function queueManualPosterRefresh_(requestedTasks = true, wakeDelayMs = 1000) {
  const entries = createManualPosterRefreshQueueEntries_(requestedTasks, () => Utilities.getUuid());
  if (!entries.length) return false;

  const props = getProps_();
  const prefix = CONFIG.PROPS.MANUAL_POSTER_REFRESH_QUEUE_PREFIX;
  entries.forEach(entry => {
    props.setProperty(`${prefix}${entry.task}`, JSON.stringify({ task: entry.task, queuedAt: Date.now(), nonce: Utilities.getUuid() }));
  });

  scheduleRefreshQueueWakeup_(wakeDelayMs);
  return true;
}

function scheduleRefreshQueueWakeup_(delayMs) {
  if (!isMasterAccount_()) return false;
  const lock = LockService.getScriptLock();
  if (!tryAcquireWithoutWaiting_(lock)) {
    Logger.log('[queueManualPosterRefresh_] Wakeup trigger deferred; durable task entries will be picked up by the owner poller.');
    return false;
  }
  try {
    ensureSingleOneOffTrigger_('retryManualPosterRefresh_', delayMs, true);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function createManualPosterRefreshQueueEntries_(requestedTasks, makeId) {
  const requested = requestedTasks === true
    ? { boards: true, form: true, printOut: true, posterOutside: true, posterInside: true, employeeView: true }
    : requestedTasks === false
      ? { boards: true, form: true, employeeView: true }
      : requestedTasks;
  return Object.keys(requested || {})
    .filter(task => requested[task])
    .map(task => ({ id: makeId(), task, queuedAt: 0 }));
}

function processManualPosterRefresh_() {
  const lock = LockService.getScriptLock();
  if (!tryAcquireWithoutWaiting_(lock)) {
    Logger.log('[processManualPosterRefresh_] Script lock is busy; scheduling a short retry.');
    scheduleManualPosterRefreshRetry_();
    return;
  }
  const props = getProps_();
  const runningAt = Number(props.getProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING) || 0);
  if (runningAt && Date.now() - runningAt < 8 * 60 * 1000) {
    lock.releaseLock();
    return;
  }

  let queueEntries;
  try {
    if (runningAt) props.deleteProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING);
    queueEntries = readPendingManualPosterRefreshEntries_();
    if (queueEntries.length) props.setProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING, String(Date.now()));
  } finally {
    lock.releaseLock();
  }

  if (!queueEntries.length) {
    deleteTriggersByHandler_('retryManualPosterRefresh_');
    return;
  }

  const refreshSteps = [
    ['inventoryCleanup', 'Inventory removal scan', () => processQueuedInventoryRemovalScan_()],
    ['requestsCleanup', 'Requests deletion scan', () => processQueuedRequestsDeletionScan_()],
    ['boards', 'Boards', () => rebuildBoards_()],
    ['printOut', 'Print Out', () => buildPrintOutLayout_(true)],
    ['form', 'Form', () => syncPostersToForm_()],
    ['posterOutside', 'Poster Outside', () => refreshPosterOutsideDropdowns_()],
    ['posterInside', 'Poster Inside', () => refreshPosterInsideDropdowns_()],
    ['employeeView', 'Employee View', () => syncEmployeeViewSpreadsheet_()],
  ];

  const pendingTasks = collectManualPosterRefreshTasks_(queueEntries);
  const completedTasks = {};
  refreshSteps.forEach(([task, name, refresh]) => {
    if (!pendingTasks[task]) return;
    if ((task === 'form' || task === 'employeeView') && !isMasterAccount_()) {
      Logger.log(`[processManualPosterRefresh_] Deferring ${name} refresh to the owner account.`);
      return;
    }
    const stepStartedAt = Date.now();
    try {
      const result = refresh();
      if ((task === 'inventoryCleanup' || task === 'requestsCleanup') && result === null) return;
      if (task === 'employeeView' && result && result.success === false) return;
      completedTasks[task] = true;
      Logger.log(`[processManualPosterRefresh_] ${name} refresh completed in ${Date.now() - stepStartedAt}ms`);
    } catch (err) {
      logError_(err, 'processManualPosterRefresh_', `${name} refresh after manual data change`);
    }
  });

  if (!tryAcquireWithoutWaiting_(lock)) {
    props.deleteProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING);
    Logger.log('[processManualPosterRefresh_] Script lock became busy; queued entries remain for retry.');
    scheduleManualPosterRefreshRetry_();
    return;
  }
  try {
    deleteManualPosterRefreshEntries_(queueEntries, completedTasks);
    props.deleteProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING);
    if (hasPendingManualPosterRefreshTasks_() && isMasterAccount_()) {
      ensureSingleOneOffTrigger_('retryManualPosterRefresh_', 60 * 1000, true);
    } else if (!hasPendingManualPosterRefreshTasks_()) {
      deleteTriggersByHandler_('retryManualPosterRefresh_');
    }
  } finally {
    lock.releaseLock();
  }
}

function scheduleManualPosterRefreshRetry_() {
  if (isMasterAccount_()) ensureSingleOneOffTrigger_('retryManualPosterRefresh_', 5000, true);
}

function tryAcquireWithoutWaiting_(lock) {
  return lock.tryLock(0);
}

function retryManualPosterRefresh_() {
  deleteTriggersByHandler_('retryManualPosterRefresh_');
  processManualPosterRefresh_();
}

function readPendingManualPosterRefreshEntries_() {
  const props = getProps_();
  const prefix = CONFIG.PROPS.MANUAL_POSTER_REFRESH_QUEUE_PREFIX;
  let all = props.getProperties();
  const legacyKey = 'MANUAL_POSTER_REFRESH_QUEUED';
  if (all[legacyKey]) {
    const legacyTasks = { boards: true, form: true, printOut: true, posterOutside: true, posterInside: true, employeeView: true };
    Object.keys(legacyTasks).forEach(task => {
      const key = `${prefix}${task}`;
      if (!all[key]) props.setProperty(key, JSON.stringify({ task, queuedAt: Date.now(), nonce: Utilities.getUuid() }));
    });
    props.deleteProperty(legacyKey);
    all = props.getProperties();
  }
  return Object.keys(all)
    .filter(key => key.startsWith(prefix))
    .map(key => ({ key, value: all[key] }));
}

function deleteManualPosterRefreshEntries_(entries, completedTasks) {
  const props = getProps_();
  (entries || []).forEach(entry => {
    let task = '';
    try {
      const parsed = JSON.parse(entry.value);
      task = String(parsed.task || '').trim();
    } catch (err) {
      if (props.getProperty(entry.key) === entry.value) props.deleteProperty(entry.key);
      return;
    }
    if (shouldAcknowledgeManualPosterRefreshEntry_(entry, completedTasks, props.getProperty(entry.key))) {
      props.deleteProperty(entry.key);
    }
  });
}

function shouldAcknowledgeManualPosterRefreshEntry_(entry, completedTasks, currentValue) {
  if (!entry || !completedTasks) return false;
  let task = String(entry.task || '').trim();
  if (!task) {
    try {
      task = String(JSON.parse(entry.value).task || '').trim();
    } catch (err) {
      return false;
    }
  }
  return !!completedTasks[task] && currentValue === entry.value;
}

function hasPendingManualPosterRefreshTasks_() {
  const prefix = CONFIG.PROPS.MANUAL_POSTER_REFRESH_QUEUE_PREFIX;
  return Object.keys(getProps_().getProperties()).some(key => key.startsWith(prefix));
}

function collectManualPosterRefreshTasks_(entries) {
  const tasks = {};
  (entries || []).forEach(entry => {
    try {
      const queued = JSON.parse(entry.value);
      if (queued && queued.task) tasks[queued.task] = true;
    } catch (err) {
      Logger.log(`[processManualPosterRefresh_] Ignoring malformed queued task ${entry.key}.`);
    }
  });
  return tasks;
}