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
    .addItem('➕ Manually Add Request', 'showManualRequestDialog')
    .addItem('➕ Add New Poster', 'showManualPosterDialog')
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

    // Task Group 1.5: Migration (if needed)
    ss.toast('Checking for data migration...', 'Setup Progress', 3);
    try {
      migratePostersFromMoviePostersToInventory_();
    } catch (err) {
      Logger.log(`[WARN] Migration failed: ${err.message}`);
      // Continue setup even if migration fails
    }

    // Task Group 2: Data Syncing
    ss.toast('Syncing data...', 'Setup Progress', 3);
    ensurePosterIdsInInventory_();  // Inventory is now primary source
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

  // Inventory: row 1 reserved (merged A1:L1) for Last Updated, headers on row 2
  let inv = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  if (!inv) inv = ss.insertSheet(CONFIG.SHEETS.INVENTORY);
  formatInventorySheet_();

  // Movie Posters sheet is deprecated - no longer created during setup
  // Kept in config for backward compatibility with existing deployments

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

/**
 * Hide internal/audit sheets from end users.
 */
function hideInternalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const internal = [
    CONFIG.SHEETS.REQUEST_ORDER,
    CONFIG.SHEETS.REQUESTS,
    CONFIG.SHEETS.ERROR_LOG,
    CONFIG.SHEETS.ANALYTICS,
    CONFIG.SHEETS.ANALYTICS_SUMMARY,
    CONFIG.SHEETS.DATA_INTEGRITY,
    CONFIG.SHEETS.SUBSCRIBERS,
    CONFIG.SHEETS.DOCUMENTATION,
  ];

  internal.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.hideSheet();
    }
  });
}

/**
 * Apply basic admin formatting. Currently a no-op placeholder to keep setup stable.
 * Extend here if you need specific header/column formatting for admin sheets.
 */
function applyAdminFormatting_() {
  // Format Inventory: merge A1:L1 for Last Updated banner and ensure headers on row 2
  try {
    formatInventorySheet_();
  } catch (err) {
    Logger.log(`[WARN] Inventory formatting skipped: ${err.message}`);
  }
}

/**
 * Ensures Inventory layout: A1:L1 merged for Last Updated, headers on row 2, data from row 3.
 * If headers are found elsewhere (e.g., pasted at bottom), they are removed and data is preserved.
 */
function formatInventorySheet_() {
  const sh = getSheet_(CONFIG.SHEETS.INVENTORY);
  const headers = ['Active?','Release Date','Movie Title','Company','Posters','Bus Shelters','Mini Posters','Standee','Teaser','Notes','Poster ID'];

  const lastRow = sh.getLastRow();
  const lastCol = Math.max(sh.getLastColumn(), headers.length);

  // Read all rows below row 2 (header), filter out header-looking rows found lower
  const rows = lastRow >= 3 ? sh.getRange(3, 1, lastRow - 2, lastCol).getValues() : [];
  const dataRows = rows.filter(r => {
    if (r.every(v => v === '' || v === null)) return false;
    const looksLikeHeader = r[0] === 'Active?' && r[1] === 'Release Date' && r[2] === 'Movie Title';
    return !looksLikeHeader;
  });

  // Clear sheet and rebuild structure
  sh.clearContents();

  // Merge top banner row A1:L1
  sh.getRange(1, 1, 1, headers.length).breakApart().merge();
  sh.getRange('A1').setHorizontalAlignment('left');

  // Set headers on row 2
  sh.getRange(2, 1, 1, headers.length).setValues([headers]);

  // Write data starting row 3
  if (dataRows.length > 0) {
    sh.getRange(3, 1, dataRows.length, headers.length).setValues(dataRows);
  }

  // Checkbox validation for Active? from row 3 downward
  const dataEnd = Math.max(3, sh.getLastRow());
  if (dataEnd >= 3) {
    setCheckboxColumn_(sh, 1, 3, dataEnd);
  }
}
