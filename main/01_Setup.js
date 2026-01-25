/** 01_Setup.gs **/

function onOpen() {
  buildAdminMenu_();
  // Initialize health banner on open without blocking
  try {
    renderHealthBanner_();
  } catch (err) {
    Logger.log(`[WARN] Health banner render on open failed: ${err.message}`);
  }
}

function buildAdminMenu_() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('Poster System')
    .addItem('🔧 Run Setup / Repair', 'setupPosterSystem')
    .addItem('🔄 Refresh All', 'refreshAll_')
    .addSeparator()
    .addSubMenu(ui.createMenu('📊 Reports')
      .addItem('Rebuild Boards', 'rebuildBoards')
      .addItem('Sync Form Options', 'syncPostersToForm')
      .addItem('Refresh Documentation', 'buildDocumentationTab')
      .addItem('Refresh Health Banner', 'refreshHealthBanner'))
    .addSubMenu(ui.createMenu('🖨️ Print & Layout')
      .addItem('Prepare Print Area', 'prepareAndSelectPrintArea')
      .addItem('Update Print Out', 'refreshPrintOut'))
    .addSubMenu(ui.createMenu('🖼️ Display Management')
      .addItem('Setup Poster Outside', 'setupPosterOutsideTab_')
      .addItem('Setup Poster Inside', 'setupPosterInsideTab_')
      .addItem('Refresh Display Dropdowns', 'refreshDisplayDropdowns_'))
    .addSubMenu(ui.createMenu('📧 Announcements')
      .addItem('Preview Pending', 'previewPendingAnnouncement')
      .addItem('Send Now', 'sendAnnouncementNow'))
    .addSubMenu(ui.createMenu('⚙️ Advanced')
      .addItem('Manually Add Request', 'showManualRequestDialog')
      .addItem('Add New Poster', 'showManualPosterDialog')
      .addItem('Run Bulk Simulator', 'showBulkSimulatorDialog')
      .addItem('Run Backup Now', 'manualBackupTrigger')
      .addItem('Setup Employee View', 'setupEmployeeViewSpreadsheet')
      .addItem('Sync Employee View', 'syncEmployeeViewSpreadsheet_')
      .addItem('Show Employee View Link', 'openEmployeeViewSpreadsheet'))
    .addToUi();
}

/**
 * Refresh All: Executes the 3 main refresh operations
 * Rebuilds boards, syncs form options, and refreshes health banner
 */
function refreshAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    ss.toast('Rebuilding boards...', 'Refresh All', 3);
    rebuildBoards();
    
    ss.toast('Syncing form options...', 'Refresh All', 3);
    syncPostersToForm();
    
    ss.toast('Refreshing health banner...', 'Refresh All', 3);
    refreshHealthBanner();
    
    ss.toast('✅ All systems refreshed!', 'Refresh All Complete', 5);
  } catch (err) {
    ss.toast(`❌ Error during refresh: ${err.message}`, 'Refresh All Failed', 8);
    logError_(err, 'refreshAll_', 'Refresh all operations');
  }
}

function setupPosterSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Task Group 1: Core Infrastructure (must run first)
    ss.toast('Initializing core infrastructure...', 'Setup Progress', 3);
    ensureSheetSchemas_();
    applyAdminFormatting_();
    ensureFormStructure_();
    ensureTriggers_();

    // Task Group 2: Data Syncing
    ss.toast('Syncing data...', 'Setup Progress', 3);
    ensurePosterIds_();
    ensurePosterIdsInInventory_();  // NEW: Generate IDs for Inventory
    syncInventoryCountsToMoviePosters_();
    syncPostersToForm();

    // Task Group 3: Visual Displays
    ss.toast('Generating views...', 'Setup Progress', 3);
    rebuildBoards();
    buildDocumentationTab();
    buildPrintOutLayout_();
    
    // Setup display management tabs
    ss.toast('Setting up display tabs...', 'Setup Progress', 3);
    setupPosterOutsideTab_();
    setupPosterInsideTab_();

    // Task Group 4: Monitoring (last)
    ss.toast('Finalizing setup...', 'Setup Progress', 3);
    updateInventoryLastUpdated_();
    initializeHealthBanner_();
    
    ss.toast('Setup complete!', 'Setup Complete', 5);
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

  if (!has('processAnnouncementQueue')) {
    ScriptApp.newTrigger('processAnnouncementQueue')
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  if (!has('performNightlyBackup')) {
    ScriptApp.newTrigger('performNightlyBackup')
      .timeBased()
      .atHour(2)  // Run at 2 AM
      .everyDays(1)
      .create();
  }
}

function ensureSheetSchemas_() {
  const ss = SpreadsheetApp.getActive();

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.INVENTORY, [
    'Active?','Release Date','Movie Title','Company','Posters','Bus Shelters','Mini Posters','Standee','Teaser','Poster ID','Poster Received Date','Notes'
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

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DOCUMENTATION, ['']);

  // Remove all frozen headers and frozen columns from all sheets
  removeFrozenHeadersFromAllSheets_();

  // Auto-hide internal audit sheets
  hideInternalSheets_();
}

/**
 * Remove frozen headers and columns from all sheets for better UX
 */
function removeFrozenHeadersFromAllSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    sheet.setFrozenRows(0);
    sheet.setFrozenColumns(0);
  });
}
