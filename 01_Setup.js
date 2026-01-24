/** 01_Setup.gs **/

function onOpen() {
  buildAdminMenu_();
}

function buildAdminMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('Poster System')
    .addItem('Prepare Print Area (Select & Print)', 'prepareAndSelectPrintArea')
    .addItem('Run Setup / Repair', 'setupPosterSystem')
    .addSeparator()
    .addItem('Sync Form Options Now', 'syncPostersToForm')
    .addItem('Rebuild Boards Now', 'rebuildBoards')
    .addItem('Refresh Print Out', 'refreshPrintOut')
    .addItem('Refresh Documentation', 'buildDocumentationTab')
    .addSeparator()
    .addItem('Manually Add Request (for migration)', 'showManualRequestDialog')
    .addSeparator()
    .addItem('Run Data Integrity Checks', 'runDataIntegrityChecksMenu')
    .addSeparator()
    .addItem('Preview Pending Announcement', 'previewPendingAnnouncement')
    .addItem('Send Announcement Now', 'sendAnnouncementNow')
    .addSeparator()
    .addSeparator()
    .addItem('Setup Employee View Spreadsheet', 'setupEmployeeViewSpreadsheet')
    .addItem('Sync Employee View Now', 'syncEmployeeViewSpreadsheet_')
    .addItem('Show Employee View Link', 'openEmployeeViewSpreadsheet')

    .addToUi();
}

function setupPosterSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActive();
    const startTime = Date.now();
    
    const tasks = [
      { name: 'Initializing sheets', fn: ensureSheetSchemas_ },
      { name: 'Applying formatting', fn: applyAdminFormatting_ },
      { name: 'Setting up form', fn: ensureFormStructure_ },
      { name: 'Ensuring poster IDs', fn: ensurePosterIds_ },
      { name: 'Syncing inventory', fn: syncInventoryCountsToMoviePosters_ },
      { name: 'Setting up triggers', fn: ensureTriggers_ },
      { name: 'Syncing form options', fn: syncPostersToForm },
      { name: 'Rebuilding boards', fn: rebuildBoards },
      { name: 'Preparing print area', fn: prepareAndSelectPrintArea },
      { name: 'Building documentation', fn: buildDocumentationTab },
      { name: 'Running data integrity checks', fn: () => runDataIntegrityChecks_(true) },
    ];
    
    let completed = 0;
    tasks.forEach(task => {
      try {
        ss.toast(`${task.name}...`, 'Setup Progress', 3);
        task.fn();
        completed++;
      } catch (err) {
        logError_(err, 'setupPosterSystem', `Task: ${task.name}`, 'MEDIUM');
        ss.toast(`⚠️ ${task.name} failed - see logs`, 'Error', 3);
        // Continue despite error
      }
    });
    
    const executionTime = Date.now() - startTime;
    ss.toast(`✓ Setup complete! (${completed}/${tasks.length} tasks, ${executionTime}ms)`, 'Success', 5);
    
    logAnalyticsEvent_(
      'SETUP_REPAIR',
      Session.getActiveUser().getEmail(),
      { tasksCompleted: completed, totalTasks: tasks.length },
      executionTime,
      completed === tasks.length
    );
    
  } catch (err) {
    logError_(err, 'setupPosterSystem', 'Critical setup error', 'CRITICAL');
    SpreadsheetApp.getActive().toast('🚨 Setup failed - see logs', 'Critical Error', 5);
  } finally {
    lock.releaseLock();
  }
}

function ensureTriggers_() {
  const form = getOrCreateForm_();
  const existing = ScriptApp.getProjectTriggers();
  const has = (handler) => existing.some(t => t.getHandlerFunction() === handler);

  if (!has('handleFormSubmit')) {
    ScriptApp.newTrigger('handleFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();
  }

  if (!has('handleSheetEdit')) {
    ScriptApp.newTrigger('handleSheetEdit')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
  }

  // Time-based trigger for announcement queue (DEPRECATED - now event-driven)
  // Keeping as fallback for any queued announcements that weren't sent immediately
  if (!has('processAnnouncementQueue')) {
    ScriptApp.newTrigger('processAnnouncementQueue')
      .timeBased()
      .everyHours(1) // Changed from 15 minutes to 1 hour as fallback only
      .create();
  }
}

function ensureSheetSchemas_() {
  const ss = SpreadsheetApp.getActive();

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.INVENTORY, [
    'Release Date','Movie Title','Company','Posters','Bus Shelters','Mini Posters','Standee','Teaser'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.MOVIE_POSTERS, [
    'Active?','Poster ID','Movie Title','Release Date','Inventory Count (FYI)','Poster Received Date','Notes','Close Queue?'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUEST_ORDER, [
    'Form Timestamp','Employee Email',
    'Requested Posters (Add) - raw','Removed Posters - raw',
    'Slots Before','Slots After','Added Accepted','Removed Applied','Denied Adds','Processing Notes'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.MAIN, ['','']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.EMPLOYEES, ['','']);
  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.PRINT_OUT, ['','']);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUESTS, [
    'Request Timestamp','Employee Email','Employee Name','Poster ID',
    'Poster Label (at request)','Movie Title (snapshot)','Release Date (snapshot)',
    'Action Type','Status','Status Updated At'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.SUBSCRIBERS, [
    'Active?','Email','Name'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ERROR_LOG, [
    'Timestamp','Error Type','Function Name','Error Message','Stack Trace','Context','Severity'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS, [
    'Timestamp','Event Type','User Email','Details','Execution Time (ms)','Success'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DATA_INTEGRITY, [
    'Check Time','Check Type','Status','Issues Found','Auto Fixed','Details'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DOCUMENTATION, ['']);
}

function applyAdminFormatting_() {
  const ss = SpreadsheetApp.getActive();
  const inv = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  const mp  = ss.getSheetByName(CONFIG.SHEETS.MOVIE_POSTERS);
  const subs= ss.getSheetByName(CONFIG.SHEETS.SUBSCRIBERS);

  inv.getRange(CONFIG.INVENTORY_LAST_UPDATED_CELL).setNote('Auto-updated by Apps Script');

  setCheckboxColumn_(mp, COLS.MOVIE_POSTERS.ACTIVE, 2, mp.getMaxRows());
  setCheckboxColumn_(mp, COLS.MOVIE_POSTERS.CLOSE_QUEUE, 2, mp.getMaxRows());

  // Hide Poster ID column (B)
  mp.hideColumns(COLS.MOVIE_POSTERS.POSTER_ID);

  setCheckboxColumn_(subs, COLS.SUBSCRIBERS.ACTIVE, 2, subs.getMaxRows());
}
