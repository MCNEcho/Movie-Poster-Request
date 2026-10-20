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
  if (!lock.tryLock(0)) return { success: false, message: 'System is busy. Please try adding the poster again in a moment.' };
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
  const lock = LockService.getScriptLock();
  if (tryAcquireWithoutWaiting_(lock)) {
    try {
      entries.forEach(entry => {
        props.deleteProperty(`${prefix}PENDING_${entry.task}`);
        writeFreshManualPosterRefreshTask_(props, prefix, entry.task);
      });
    } finally {
      lock.releaseLock();
    }
  } else {
    entries.forEach(entry => props.setProperty(`${prefix}PENDING_${entry.task}`, JSON.stringify({
      task: entry.task,
      queuedAt: Date.now(),
      nonce: Utilities.getUuid(),
      attempts: 0,
      lastError: '',
      nextAttemptAt: 0,
    })));
  }

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

function writeFreshManualPosterRefreshTask_(props, prefix, task, queuedAt) {
  props.setProperty(`${prefix}${task}`, JSON.stringify({
    task,
    queuedAt: Number(queuedAt) || Date.now(),
    nonce: Utilities.getUuid(),
    attempts: 0,
    lastError: '',
    nextAttemptAt: 0,
  }));
}

function processManualPosterRefresh_() {
  const workerStartedAt = Date.now();
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
    if (isMasterAccount_()) processNightlyBackupRetryQueue_();
    return;
  }

  const refreshSteps = [
    ['inventoryCleanup', 'Inventory removal scan', () => processQueuedInventoryRemovalScan_()],
    ['requestsCleanup', 'Requests deletion scan', () => processQueuedRequestsDeletionScan_()],
    ['boards', 'Boards', () => rebuildBoards_()],
    ['employeeView', 'Employee View', () => syncEmployeeViewSpreadsheet_()],
    ['printOut', 'Print Out', () => buildPrintOutLayout_(true)],
    ['posterOutside', 'Poster Outside', () => refreshPosterOutsideDropdowns_()],
    ['posterInside', 'Poster Inside', () => refreshPosterInsideDropdowns_()],
    ['form', 'Form', () => syncPostersToForm_()],
  ];

  const pendingTasks = collectManualPosterRefreshTasks_(queueEntries);
  const acknowledgements = [];
  let timeBudgetReached = false;
  for (const [task, name, refresh] of refreshSteps) {
    if (!pendingTasks[task]) continue;
    if (shouldStopRefreshWorker_(workerStartedAt, Date.now())) {
      Logger.log('[processManualPosterRefresh_] Time budget reached; remaining tasks stay queued.');
      timeBudgetReached = true;
      break;
    }
    const entry = queueEntries.find(candidate => manualPosterRefreshEntryTask_(candidate) === task);
    if (!entry) continue;
    let stuck = false;
    try { stuck = JSON.parse(entry.value).stuck === true; } catch (err) {}
    if (stuck || refreshEntryIsNotDue_(entry, Date.now())) continue;
    if ((task === 'form' || task === 'employeeView') && !isMasterAccount_()) {
      Logger.log(`[processManualPosterRefresh_] Deferring ${name} refresh to the owner account.`);
      continue;
    }
    const stepStartedAt = Date.now();
    try {
      const result = refresh();
      const stepError = refreshResultError_(task, result);
      if (stepError) {
        updateRefreshTaskFailure_(entry, stepError);
        continue;
      }
      if (!acknowledgeRefreshTask_(entry)) acknowledgements.push(entry);
      Logger.log(`[processManualPosterRefresh_] ${name} refresh completed in ${Date.now() - stepStartedAt}ms`);
    } catch (err) {
      updateRefreshTaskFailure_(entry, err && err.message ? err.message : err);
    }
  }

  if (!timeBudgetReached && !shouldStopRefreshWorker_(workerStartedAt, Date.now()) && isMasterAccount_()) {
    processNightlyBackupRetryQueue_();
  }

  acknowledgements.forEach(entry => {
    if (!acknowledgeRefreshTask_(entry)) Logger.log(`[processManualPosterRefresh_] Completion acknowledgement remains queued for ${entry.task}.`);
  });
  finishRefreshWorker_(timeBudgetReached || shouldStopRefreshWorker_(workerStartedAt, Date.now()));
}

const REFRESH_WORKER_TIME_BUDGET_MS = 270000;
const REFRESH_TASK_BACKOFF_MINUTES = [1, 5, 15, 60];
const REFRESH_TASK_MAX_ATTEMPTS = 5;
const MANUAL_POSTER_REFRESH_TASK_NAMES = [
  'inventoryCleanup', 'requestsCleanup', 'boards', 'employeeView',
  'printOut', 'posterOutside', 'posterInside', 'form',
];

function isKnownManualPosterRefreshTask_(task) {
  return MANUAL_POSTER_REFRESH_TASK_NAMES.includes(String(task || '').trim());
}

function shouldStopRefreshWorker_(startedAt, nowMs) {
  return Number(nowMs) - Number(startedAt) >= REFRESH_WORKER_TIME_BUDGET_MS;
}

function refreshBackoffMinutes_(attempt) {
  const index = Math.max(0, Math.min(Number(attempt) - 1, REFRESH_TASK_BACKOFF_MINUTES.length - 1));
  return REFRESH_TASK_BACKOFF_MINUTES[index];
}

function refreshAttemptIsStuck_(attempts) {
  return Number(attempts) >= REFRESH_TASK_MAX_ATTEMPTS;
}

function canUpdateRefreshTaskEntry_(entry, currentValue) {
  return !!entry && currentValue === entry.value;
}

function refreshFailureUpdate_(entry, errorMessage, nowMs, makeNonce) {
  let current;
  try { current = JSON.parse(entry.value); } catch (err) { current = {}; }
  const attempts = Number(current.attempts || 0) + 1;
  const stuck = refreshAttemptIsStuck_(attempts);
  return {
    task: current.task || entry.task || '',
    queuedAt: current.queuedAt || 0,
    nonce: makeNonce(),
    attempts,
    lastError: String(errorMessage || 'Unknown refresh error').slice(0, 300),
    nextAttemptAt: stuck ? 0 : Number(nowMs) + refreshBackoffMinutes_(attempts) * 60000,
    stuck,
  };
}

function refreshEntryIsNotDue_(entry, nowMs) {
  try {
    const parsed = JSON.parse(entry.value);
    return Number(parsed.nextAttemptAt || 0) > Number(nowMs);
  } catch (err) {
    return false;
  }
}

function refreshResultError_(task, result) {
  if ((task === 'inventoryCleanup' || task === 'requestsCleanup') && result === null) return 'Could not acquire lock to scan for deleted rows.';
  if (result && result.success === false) return result.message || 'Refresh step reported failure.';
  return '';
}

function updateRefreshTaskFailure_(entry, errorMessage) {
  const lock = LockService.getScriptLock();
  if (!tryAcquireWithoutWaiting_(lock)) {
    Logger.log(`[processManualPosterRefresh_] Could not update retry state for ${entry.task}; keeping its queue entry.`);
    scheduleManualPosterRefreshRetry_();
    return false;
  }
  let update = null;
  try {
    const props = getProps_();
    const currentValue = props.getProperty(entry.key);
    if (!canUpdateRefreshTaskEntry_(entry, currentValue)) return false;

    update = refreshFailureUpdate_(entry, errorMessage, Date.now(), () => Utilities.getUuid());
    if (update.stuck) {
      props.deleteProperty(entry.key);
    } else {
      props.setProperty(entry.key, JSON.stringify(update));
    }
  } finally {
    lock.releaseLock();
  }

  if (!update) return false;
  if (update.stuck) {
    logError_(new Error(`Refresh task ${update.task} stuck after ${update.attempts} failed attempts: ${update.lastError}`),
      'processManualPosterRefresh_', { task: update.task, stuck: true, attempts: update.attempts });
  } else if (update.attempts === 1) {
    logError_(new Error(`Refresh task ${update.task} failed: ${update.lastError}`),
      'processManualPosterRefresh_', { task: update.task, attempts: update.attempts });
  } else {
    Logger.log(`[processManualPosterRefresh_] ${update.task} attempt ${update.attempts} failed; retrying after ${refreshBackoffMinutes_(update.attempts)} minute(s): ${update.lastError}`);
  }
  return true;
}

function acknowledgeRefreshTask_(entry) {
  const lock = LockService.getScriptLock();
  if (!tryAcquireWithoutWaiting_(lock)) return false;
  try {
    const props = getProps_();
    if (props.getProperty(entry.key) !== entry.value) return false;
    props.deleteProperty(entry.key);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function finishRefreshWorker_(timeBudgetReached) {
  const lock = LockService.getScriptLock();
  if (!tryAcquireWithoutWaiting_(lock)) {
    scheduleManualPosterRefreshRetry_();
    return;
  }
  try {
    getProps_().deleteProperty(CONFIG.PROPS.MANUAL_POSTER_REFRESH_RUNNING);
    if (!isMasterAccount_()) return;
    const hasPending = hasPendingManualPosterRefreshTasks_();
    if (hasPending) {
      const nextDelay = timeBudgetReached ? 60000 : nextRefreshRetryDelayMs_();
      ensureSingleOneOffTrigger_('retryManualPosterRefresh_', nextDelay, true);
    } else {
      deleteTriggersByHandler_('retryManualPosterRefresh_');
    }
  } finally {
    lock.releaseLock();
  }
}

function nextRefreshRetryDelayMs_() {
  const prefix = CONFIG.PROPS.MANUAL_POSTER_REFRESH_QUEUE_PREFIX;
  const props = getProps_().getProperties();
  const dueTimes = Object.keys(props).filter(key => key.startsWith(prefix)).map(key => {
    try { return Number(JSON.parse(props[key]).nextAttemptAt || 0); } catch (err) { return 0; }
  }).filter(time => time > 0);
  if (!dueTimes.length) return 60000;
  return Math.max(1000, Math.min(10 * 60 * 1000, Math.min(...dueTimes) - Date.now()));
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
  const stagingPrefix = `${prefix}PENDING_`;
  const stagedKeys = Object.keys(all).filter(key => key.startsWith(stagingPrefix));
  stagedKeys.forEach(key => {
    const stagedValue = all[key];
    try {
      const staged = JSON.parse(stagedValue);
      const task = String(staged.task || key.substring(stagingPrefix.length)).trim();
      const taskKey = `${prefix}${task}`;
      const currentValue = props.getProperty(taskKey);
      let currentQueuedAt = -1;
      if (currentValue) {
        try { currentQueuedAt = Number(JSON.parse(currentValue).queuedAt || 0); } catch (err) {}
      }
      if (!currentValue || Number(staged.queuedAt || 0) >= currentQueuedAt) {
        props.setProperty(taskKey, JSON.stringify(Object.assign({}, staged, {
          task,
          nonce: Utilities.getUuid(),
        })));
      }
    } catch (err) {
      Logger.log(`[processManualPosterRefresh_] Ignoring malformed staged queue record ${key}.`);
    }
    if (props.getProperty(key) === stagedValue) props.deleteProperty(key);
  });
  all = props.getProperties();
  const legacyKey = 'MANUAL_POSTER_REFRESH_QUEUED';
  if (all[legacyKey]) {
    // TODO(remove after production migration)
    const legacyTasks = { boards: true, form: true, printOut: true, posterOutside: true, posterInside: true, employeeView: true };
    Object.keys(legacyTasks).forEach(task => {
      const key = `${prefix}${task}`;
      if (!all[key]) writeFreshManualPosterRefreshTask_(props, prefix, task);
    });
    props.deleteProperty(legacyKey);
    all = props.getProperties();
  }
  Object.keys(all).filter(key => key.startsWith(prefix) && !key.startsWith(stagingPrefix)).forEach(key => {
    const value = all[key];
    let task = '';
    try {
      task = String(JSON.parse(value).task || '').trim();
    } catch (err) {
      Logger.log(`[processManualPosterRefresh_] Deleting malformed refresh queue entry ${key}.`);
    }
    if (task && !isKnownManualPosterRefreshTask_(task)) {
      Logger.log(`[processManualPosterRefresh_] Deleting refresh queue entry ${key} for unknown task "${task}".`);
      task = '';
    }
    if (!task && props.getProperty(key) === value) props.deleteProperty(key);
  });
  all = props.getProperties();
  return Object.keys(all)
    .filter(key => key.startsWith(prefix) && !key.startsWith(stagingPrefix))
    .map(key => ({ key, value: all[key] }));
}

function hasPendingManualPosterRefreshTasks_() {
  const prefix = CONFIG.PROPS.MANUAL_POSTER_REFRESH_QUEUE_PREFIX;
  return Object.keys(getProps_().getProperties()).some(key => key.startsWith(prefix));
}

function manualPosterRefreshEntryTask_(entry) {
  if (!entry) return '';
  if (entry.task) return String(entry.task).trim();
  try {
    const queued = JSON.parse(entry.value);
    return String(queued && queued.task || '').trim();
  } catch (err) {
    return '';
  }
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