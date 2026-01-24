/** 01_Setup.gs **/

function onOpen() {
  buildAdminMenu_();
}

function buildAdminMenu_() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('📋 Poster System');
  
  // Daily operations
  menu.addSubMenu(
    ui.createMenu('🔄 Daily Operations')
      .addItem('Sync Form Options Now', 'syncPostersToForm')
      .addItem('Rebuild Boards Now', 'rebuildBoards')
      .addItem('Refresh Print Out', 'refreshPrintOut')
      .addItem('Refresh Documentation', 'buildDocumentationTab')
  );
  
  // Announcements
  menu.addSubMenu(
    ui.createMenu('📧 Announcements')
      .addItem('Preview Pending Announcement', 'previewPendingAnnouncement')
      .addItem('Send Announcement Now', 'sendAnnouncementNow')
      .addSeparator()
      .addItem('Queue Custom Announcement', 'queueCustomAnnouncement')
      .addItem('Send Custom Announcement Now', 'sendCustomAnnouncementNow')
  );
  
  // Admin tools
  menu.addSubMenu(
    ui.createMenu('🔧 Admin Tools')
      .addItem('Prepare Print Area (Select & Print)', 'prepareAndSelectPrintArea')
      .addItem('Manually Add Request', 'showManualRequestDialog')
      .addItem('Run Data Integrity Check', 'runDataIntegrityChecksMenu')
  );
  
  // Setup (rare)
  menu.addSubMenu(
    ui.createMenu('⚙️ Setup & Advanced')
      .addItem('Run Setup / Repair', 'setupPosterSystem')
      .addItem('Setup Employee View Spreadsheet', 'setupEmployeeViewSpreadsheet')
      .addItem('Sync Employee View Now', 'syncEmployeeViewSpreadsheet_')
      .addItem('Show Employee View Link', 'openEmployeeViewSpreadsheet')
  );
  
  menu.addToUi();
}

function setupPosterSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    ss.toast('Initializing sheets...', 'Setup Progress', 3);
    ensureSheetSchemas_();
    applyAdminFormatting_();

    ss.toast('Creating/repairing form...', 'Setup Progress', 3);
    ensureFormStructure_();

    ss.toast('Syncing poster IDs...', 'Setup Progress', 3);
    ensurePosterIds_();
    syncInventoryCountsToMoviePosters_();
    
    ss.toast('Setting up triggers...', 'Setup Progress', 3);
    ensureTriggers_();

    ss.toast('Syncing form options...', 'Setup Progress', 3);
    syncPostersToForm();
    
    ss.toast('Rebuilding boards...', 'Setup Progress', 3);
    rebuildBoards();
    
    ss.toast('Building documentation...', 'Setup Progress', 3);
    buildDocumentationTab();
    
    ss.toast('Updating inventory...', 'Setup Progress', 3);
    updateInventoryLastUpdated_();
    
    ss.toast('Building print layout...', 'Setup Progress', 3);
    buildPrintOutLayout_();
    
    ss.toast('Running data integrity checks...', 'Setup Progress', 3);
    runDataIntegrityChecks_(true);
    
    SpreadsheetApp.getUi().alert('✅ Setup Complete! All systems ready.');
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
