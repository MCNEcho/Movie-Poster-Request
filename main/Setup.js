/** Setup.js **/

function onOpen() {
  buildAdminMenu_();
}

function buildAdminMenu_() {
  const ui = SpreadsheetApp.getUi();
  
  // Main menu: Poster Request System
  const mainMenu = ui.createMenu('Poster Request System');
  
  // Top-level item: Add New Poster (most commonly used)
  mainMenu.addItem('➕ Add New Poster', 'showManualPosterDialog');
  
  mainMenu.addSeparator();
  
  // Advanced Menu (with nested items)
  const advancedMenu = ui.createMenu('⚙️ Advanced');
  
  // Main functions
  advancedMenu.addItem('🔄 Refresh Manager', 'showRefreshManagerDialog');
  advancedMenu.addItem('👥 Employee View Manager', 'showEmployeeViewManagerDialog');
  advancedMenu.addItem('➕ Manually Add Request', 'showManualRequestDialog');
  
  advancedMenu.addSeparator();
  
  // Reports submenu
  advancedMenu.addSubMenu(ui.createMenu('📊 Reports')
    .addItem('Rebuild Boards', 'rebuildBoards')
    .addItem('Sync Form Options', 'syncPostersToForm')
    .addItem('Refresh Documentation', 'buildDocumentationTab'));
  
  // Announcements submenu
  advancedMenu.addSubMenu(ui.createMenu('📧 Announcements')
    .addItem('Preview Pending', 'previewPendingAnnouncement')
    .addItem('Send Now', 'sendAnnouncementNow'));
  
  // Display Management submenu
  advancedMenu.addSubMenu(ui.createMenu('🖼️ Display Management')
    .addItem('Manage Display Sheets', 'showDisplayManagerDialog'));
  
  // System submenu (with Run Setup / Repair inside)
  advancedMenu.addSubMenu(ui.createMenu('🔐 System')
    .addItem('🔧 Run Setup / Repair', 'setupPosterSystem')
    .addItem('🧷 Create Triggers', 'createTriggersNow_')
    .addItem('Run Backup Now', 'manualBackupTrigger'));
  
  mainMenu.addSubMenu(advancedMenu);
  mainMenu.addToUi();
}

/**
 * Refresh All: Executes the 3 main refresh operations
 * Rebuilds boards and syncs form options
 */
function refreshAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    ss.toast('⏳ Rebuilding boards...', 'Refresh All', 3);
    rebuildBoards();
    
    ss.toast('⏳ Syncing form options...', 'Refresh All', 3);
    syncPostersToForm();
    
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
    ss.toast('⏳ Step 1/5: Initializing infrastructure...', 'Setup Progress', -1);
    ensureSheetSchemas_();
    applyAdminFormatting_();
    
    // Form operations require owner permissions - skip if access denied
    try {
      ensureFormStructure_();
    } catch (formErr) {
      Logger.log(`[WARN] Form structure setup skipped (access denied): ${formErr.message}`);
      ss.toast('⚠ Form setup skipped (requires owner permissions)', 'Setup Progress', 3);
    }
    
    ensureTriggers_();

    // Task Group 2: Data Syncing
    ss.toast('⏳ Step 2/5: Syncing data...', 'Setup Progress', -1);
    ensurePosterIdsInInventory_();  // Inventory is now primary source
    initializeInventorySnapshot_();  // Seed inventory snapshot for deletion detection
    initializeRequestsSnapshot_();   // Seed requests snapshot for deletion detection
    initializeFormUrlCache_();  // Cache Form URL (set once, persist forever)
    initializeEmployeeViewUrlCache_();  // Cache Employee View URL (set once, persist forever)
    
    // Form sync requires owner permissions - skip if access denied
    try {
      syncPostersToForm();
    } catch (formErr) {
      Logger.log(`[WARN] Form sync skipped (access denied): ${formErr.message}`);
      ss.toast('⚠ Form sync skipped (requires owner permissions)', 'Setup Progress', 3);
    }

    // Task Group 3: Setup employee view (must be before print layout to have all URLs)
    ss.toast('⏳ Step 3/5: Setting up employee view...', 'Setup Progress', -1);
    
    // Employee View operations require owner permissions - skip if access denied
    try {
      setupEmployeeViewSpreadsheet();
    } catch (empViewErr) {
      Logger.log(`[WARN] Employee View setup skipped (access denied): ${empViewErr.message}`);
      ss.toast('⚠ Employee View setup skipped (requires owner permissions)', 'Setup Progress', 3);
    }

    // Task Group 4: Visual Displays (with employee view URL now available)
    ss.toast('⏳ Step 4/5: Generating views...', 'Setup Progress', -1);
    rebuildBoards();
    buildDocumentationTab();
    buildPrintOutLayout_();  // Now has all URLs available - generates QR codes once
    
    // Task Group 5: Finalization
    ss.toast('⏳ Step 5/5: Finalizing setup...', 'Setup Progress', -1);
    updateInventoryLastUpdated_();
    
    ss.toast('✅ Setup complete!', 'Setup Complete', 5);
    SpreadsheetApp.getUi().alert('✅ Setup Complete! All systems ready.');
  } finally {
    lock.releaseLock();
  }
}

function ensureTriggers_() {
  const existing = ScriptApp.getProjectTriggers();
  const has = (handler) => existing.some(t => t.getHandlerFunction() === handler);

  let form = null;
  try {
    form = getOrCreateForm_();
  } catch (err) {
    Logger.log(`[ensureTriggers_] Form trigger skipped: ${err.message}`);
  }

  if (form && !has('handleFormSubmit')) {
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

  if (!has('handleSheetChange')) {
    ScriptApp.newTrigger('handleSheetChange')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
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

function createTriggersNow_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    ensureTriggers_();
    SpreadsheetApp.getActive().toast('✅ Triggers created/verified', 'Triggers', 4);
  } catch (err) {
    SpreadsheetApp.getActive().toast('❌ Error creating triggers: ' + err.message, 'Triggers', 6);
    logError_(err, 'createTriggersNow_', 'Manual trigger creation');
  } finally {
    lock.releaseLock();
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

  const requestsSheet = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUESTS, [
    'Request Timestamp','Employee Email','Employee Name','Poster ID',
    'Poster Label (at request)','Movie Title (snapshot)','Release Date (snapshot)',
    'Action Type','Status','Status Updated At','Contact Type','Notes'
  ]);
  requestsSheet.setFrozenRows(1);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.SUBSCRIBERS, [
    'Active?','Email','Name'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DOCUMENTATION, ['']);

  // System logging/monitoring sheets
  ensureErrorTrackingSheet_();
  ensureAnalyticsSheet_();
  ensureAnalyticsSummarySheet_();
  ensureDataIntegritySheet_();

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

  // Freeze rows 1 and 2 (banner + headers)
  sh.setFrozenRows(2);

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
