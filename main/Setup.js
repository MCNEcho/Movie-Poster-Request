/** 01_Setup.gs **/

function onOpen() {
  buildAdminMenu_();
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
      .addItem('Refresh Documentation', 'buildDocumentationTab'))
    .addSubMenu(ui.createMenu('🖨️ Print & Layout')
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
 * Refresh All: Executes the 2 main refresh operations
 * Rebuilds boards and syncs form options
 */
function refreshAll_() {
  try {
    Logger.log('[refreshAll] Running refresh via menu action...');
    executeRefreshAll_();
    SpreadsheetApp.getUi().alert('All systems refreshed!');
  } catch (err) {
    logError_(err, 'refreshAll_', 'Refresh all operations', 'CRITICAL');
    SpreadsheetApp.getUi().alert('Refresh failed: ' + err.message);
  }
}

function executeRefreshAll_() {
  try {
    rebuildBoards();
    syncPostersToForm();
    Logger.log('[refreshAll] All systems refreshed successfully');
  } catch (err) {
    throw err;
  }
}

/**
 * Public Setup Entry Point (Backward Compatible)
 * Wrapper around launchSetupWithSpinner_ for compatibility with:
 * - Existing deployments
 * - Menu item references
 * - Trigger configurations
 */
function setupPosterSystem() {
  launchSetupWithSpinner_();
}

/**
 * Launch Setup with Live Progress Spinner
 * Opens a modeless dialog to show real-time setup progress
 */
function launchSetupWithSpinner_() {
  const ui = SpreadsheetApp.getUi();
  const html = HtmlService
    .createHtmlOutputFromFile('SetupSpinner')
    .setWidth(400)
    .setHeight(250);
  ui.showModelessDialog(html, 'Setting Up Poster System...');
}

function setSetupProgress_(message) {
  PropertiesService.getScriptProperties().setProperty('SETUP_PROGRESS', message);
}

function getSetupProgress() {
  return PropertiesService.getScriptProperties().getProperty('SETUP_PROGRESS');
}

function runSetupStep_(label, stepFn) {
  setSetupProgress_(label);
  try {
    stepFn();
  } catch (err) {
    Logger.log(`[ERROR] ${label}: ${err.message}\nStack: ${err.stack || 'N/A'}`);
    throw err;
  }
}

function setupPosterSystemWithProgress() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SETUP_RUNNING', 'true');
  setSetupProgress_('Initializing core infrastructure...');
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
    runSetupStep_('Initializing core infrastructure...', () => {
      ensureSheetSchemas_();
      applyAdminFormatting_();
      ensureFormStructure_();
      ensureTriggers_();
    });

    runSetupStep_('Syncing data with inventory...', () => {
      ensurePosterIdsInInventory_();  // Inventory is now primary source
      syncPostersToForm();
    });

    runSetupStep_('Generating visual displays...', () => {
      rebuildBoards();  // This now includes initializeAdminNotesColumn_()
      buildDocumentationTab();
      buildPrintOutLayout_();
    });
    
    runSetupStep_('Setting up display tabs...', () => {
      setupPosterOutsideTab_();
      setupPosterInsideTab_();
    });

    runSetupStep_('Finalizing setup...', () => {
      updateInventoryLastUpdated_();
    });
    
    Logger.log('[Setup] Setup complete!');
    setSetupProgress_('COMPLETE');
  } catch (err) {
    logError_(err, 'setupPosterSystemWithProgress', 'Setup action', 'CRITICAL');
    setSetupProgress_(`Error: ${err.message}`);
    throw err;
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
    props.deleteProperty('SETUP_RUNNING');
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

  // DEFERRED REFRESH: Time-based trigger to execute pending refreshes
  if (!has('executeDeferredRefresh')) {
    ScriptApp.newTrigger('executeDeferredRefresh')
      .timeBased()
      .everyMinutes(5)  // Check every 5 minutes for pending refreshes
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
  
  // Apply purposeful tab colors
  applyTabColors_();
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
  ];

  internal.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.hideSheet();
    }
  });
}

/**
 * Apply purposeful tab colors to sheets for better visual organization.
 * Color scheme:
 * - BLUE (#4285F4): Primary user-facing sheets (Inventory, Main Board, Employees Board)
 * - CYAN (#00BCD4): Display/Print sheets (Poster Outside/Inside, Print Out)
 * - ORANGE (#FF9800): Configuration/Reference (Subscribers, Documentation)
 * - YELLOW (#FFEB3B): Admin Tools (Request Order, Requests ledger)
 * - RED (#F44336): Error/Debug sheets (Error Log, Data Integrity)
 * - GREEN (#4CAF50): Analytics/Reporting (Analytics, Analytics Summary)
 */
function applyTabColors_() {
  const ss = SpreadsheetApp.getActive();
  
  // Primary user-facing sheets - BLUE (#4285F4)
  const blue = '#4285F4';
  [CONFIG.SHEETS.INVENTORY, CONFIG.SHEETS.MAIN, CONFIG.SHEETS.EMPLOYEES].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(blue);
  });
  
  // Display/Print sheets - CYAN (#00BCD4)
  const cyan = '#00BCD4';
  [CONFIG.SHEETS.POSTER_OUTSIDE, CONFIG.SHEETS.POSTER_INSIDE, CONFIG.SHEETS.PRINT_OUT].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(cyan);
  });
  
  // Configuration/Reference - ORANGE (#FF9800)
  const orange = '#FF9800';
  [CONFIG.SHEETS.SUBSCRIBERS, CONFIG.SHEETS.DOCUMENTATION].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(orange);
  });
  
  // Admin Tools - YELLOW (#FFEB3B)
  const yellow = '#FFEB3B';
  [CONFIG.SHEETS.REQUEST_ORDER, CONFIG.SHEETS.REQUESTS].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(yellow);
  });
  
  // Error/Debug sheets - RED (#F44336)
  const red = '#F44336';
  [CONFIG.SHEETS.ERROR_LOG, CONFIG.SHEETS.DATA_INTEGRITY].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(red);
  });
  
  // Analytics/Reporting - GREEN (#4CAF50)
  const green = '#4CAF50';
  [CONFIG.SHEETS.ANALYTICS, CONFIG.SHEETS.ANALYTICS_SUMMARY].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setTabColor(green);
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

