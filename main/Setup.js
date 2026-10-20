/** Setup.js **/

function onOpen() {
  Logger.log(`[onOpen] Poster Request System version: ${CONFIG.VERSION.LABEL} (${CONFIG.VERSION.UPDATED_AT}) - ${CONFIG.VERSION.NOTES}`);
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
    .addItem('Rebuild Boards', 'queueBoardsRefresh')
    .addItem('Sync Form Options', 'queueFormRefresh')
    .addItem('Refresh Documentation', 'buildDocumentationTab'));
  
  // Display Management submenu
  advancedMenu.addSubMenu(ui.createMenu('🖼️ Display Management')
    .addItem('Manage Display Sheets', 'showDisplayManagerDialog'));
  
  // System submenu (with Run Setup / Repair inside)
  advancedMenu.addSubMenu(ui.createMenu('🔐 System')
    .addItem('🔧 Run Setup / Repair', 'setupPosterSystem')
    .addItem('🧷 Create Triggers', 'createTriggersMenu')
    .addItem('🔎 Check Form Access', 'checkFormAccess')
    .addItem('🧹 Remove Legacy Announcement Data', 'removeLegacyAnnouncementArtifacts')
    .addItem('Run Data Integrity Check', 'runDataIntegrityCheckMenu')
    .addItem('Run Backup Now', 'manualBackupTrigger'));
  
  mainMenu.addSubMenu(advancedMenu);
  mainMenu.addToUi();
}

function queueBoardsRefresh_() {
  queueManualPosterRefresh_({ boards: true });
  SpreadsheetApp.getActive().toast('Boards refresh queued.', 'Refresh Manager', 4);
}

function queueFormRefresh_() {
  getProps_().deleteProperty(CONFIG.PROPS.FORM_CHOICES_HASH);
  queueManualPosterRefresh_({ form: true });
  SpreadsheetApp.getActive().toast('Form options refresh queued.', 'Refresh Manager', 4);
}

function queueBoardsRefresh() {
  return queueBoardsRefresh_();
}

function queueFormRefresh() {
  return queueFormRefresh_();
}

function setupPosterSystem() {
  if (!isMasterAccount_()) {
    throw new Error('Run Setup / Repair as the spreadsheet owner/master admin account.');
  }
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

  // Task Group 2: Data Syncing
  ss.toast('⏳ Step 2/5: Syncing data...', 'Setup Progress', -1);
  ensurePosterIdsInInventory_();
  initializeInventorySnapshot_();
  initializeRequestsSnapshot_();
  // TODO(remove after production migration)
  getProps_().deleteProperty('REQUESTS_SNAPSHOT_JSON');
  initializeFormUrlCache_();
  initializeEmployeeViewUrlCache_();

  // Form sync requires owner permissions - skip if access denied
  try {
    getProps_().deleteProperty(CONFIG.PROPS.FORM_CHOICES_HASH);
    queueManualPosterRefresh_({ form: true });
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
  rebuildBoards_();
  buildDocumentationTab();
  buildPrintOutLayout_();
  queueManualPosterRefresh_({ employeeView: true });

  // Task Group 5: Finalization
  ss.toast('⏳ Step 5/5: Finalizing setup...', 'Setup Progress', -1);
  updateInventoryLastUpdated_();
  ensureTriggers_();

  ss.toast('✅ Setup complete!', 'Setup Complete', 5);
  SpreadsheetApp.getUi().alert('✅ Setup Complete! All systems ready.');
}

function ensureTriggers_() {
  if (!isMasterAccount_()) {
    throw new Error('Only the spreadsheet owner/master admin should install or reconcile project triggers.');
  }

  const uniqueHandlers = new Set(['handleFormSubmit', 'handleSheetEdit', 'handleSheetChange']);
  const seen = new Set();
  let deletedLegacyTriggers = 0;
  let deletedDuplicateTriggers = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    const handler = trigger.getHandlerFunction();
    if (handler === 'processAnnouncementQueue') {
      // TODO(remove after production migration)
      ScriptApp.deleteTrigger(trigger);
      deletedLegacyTriggers++;
      return;
    }
    if (handler === 'processNightlyBackupRetryQueue_') {
      // TODO(remove after production migration)
      ScriptApp.deleteTrigger(trigger);
      deletedLegacyTriggers++;
      return;
    }
    if (handler === 'performNightlyBackup' || handler === 'processManualPosterRefresh_') return;
    if (handler === 'retryNightlyBackup_' || handler === 'retryManualPosterRefresh_') return;
    if (!uniqueHandlers.has(handler)) return;
    if (seen.has(handler)) {
      ScriptApp.deleteTrigger(trigger);
      deletedDuplicateTriggers++;
    } else {
      seen.add(handler);
    }
  });
  Logger.log(`[ensureTriggers_] Removed ${deletedDuplicateTriggers} duplicate trigger(s) and ${deletedLegacyTriggers} obsolete announcement trigger(s).`);

  const has = (handler) => ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === handler);

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

  // Recreate rather than selecting an arbitrary handler match: old versions
  // used this handler for one-off lock retries as well as the daily schedule.
  deleteTriggersByHandler_('performNightlyBackup');
  ScriptApp.newTrigger('performNightlyBackup').timeBased().atHour(2).everyDays(1).create();

  deleteTriggersByHandler_('processManualPosterRefresh_');
  ScriptApp.newTrigger('processManualPosterRefresh_').timeBased().everyMinutes(10).create();

  deleteTriggersByHandler_('retryNightlyBackup_');
  ensureSingleOneOffTrigger_('retryManualPosterRefresh_', 60000, hasPendingManualPosterRefreshTasks_());
}

function deleteTriggersByHandler_(handler) {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handler)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function ensureSingleOneOffTrigger_(handler, delayMs, shouldExist) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(0)) {
    Logger.log(`[ensureSingleOneOffTrigger_] Trigger reconciliation is already running for ${handler}.`);
    return false;
  }
  try {
    const triggers = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === handler);
    const actions = planOneOffTriggerActions_(triggers.length, shouldExist);
    triggers.slice(0, actions.deleteCount).forEach(trigger => ScriptApp.deleteTrigger(trigger));
    if (actions.create) {
      ScriptApp.newTrigger(handler).timeBased().after(delayMs).create();
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

function planOneOffTriggerActions_(existingCount, shouldExist) {
  const count = Math.max(0, Number(existingCount) || 0);
  if (!shouldExist) return { deleteCount: count, create: false };
  return { deleteCount: Math.max(0, count - 1), create: count === 0 };
}

function createTriggersNow_() {
  try {
    ensureTriggers_();
    SpreadsheetApp.getActive().toast('✅ Triggers created/verified', 'Triggers', 4);
  } catch (err) {
    SpreadsheetApp.getActive().toast('❌ Error creating triggers: ' + err.message, 'Triggers', 6);
    logError_(err, 'createTriggersNow_', 'Manual trigger creation');
  }
}

function createTriggersMenu() {
  return createTriggersNow_();
}

function removeLegacyAnnouncementArtifacts_() {
  // TODO(remove after production migration)
  const ss = SpreadsheetApp.getActive();
  const removed = [];
  const skipped = [];

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processAnnouncementQueue') {
      // TODO(remove after production migration)
      ScriptApp.deleteTrigger(trigger);
      removed.push('announcement trigger');
    }
  });

  const formId = getEffectiveFormId_();
  if (formId) {
    try {
      const form = FormApp.openById(formId);
      form.getItems().forEach(item => {
        if (String(item.getTitle() || '').trim() === 'Subscribe to Notifications') {
          form.deleteItem(item);
          removed.push('form subscription question');
        }
      });
    } catch (err) {
      skipped.push(`form question (grant the script runner editor access, then retry: ${err.message})`);
    }
  }

  const subscriberSheet = ss.getSheetByName('Subscribers');
  if (subscriberSheet) {
    ss.deleteSheet(subscriberSheet);
    removed.push('Subscribers sheet and stored addresses');
  }

  [
    'ANNOUNCE_QUEUE_JSON',
    'ANNOUNCED_POSTER_IDS_JSON',
    'ANNOUNCE_STOCK_SNAPSHOT_JSON',
    'ANNOUNCE_LAST_BLOCK',
    'ANNOUNCE_INITIALIZED',
    'CUSTOM_ANNOUNCE_QUEUE_JSON',
    'CACHE_ACTIVE_SUBSCRIBERS',
  ].forEach(key => getProps_().deleteProperty(key));

  const summary = [
    removed.length ? `Removed: ${removed.join(', ')}.` : 'No legacy announcement artifacts were found.',
    skipped.length ? `Skipped: ${skipped.join('; ')}.` : '',
  ].filter(Boolean).join('\n');
  SpreadsheetApp.getUi().alert('Announcement cleanup', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

function checkFormAccess_() {
  const runner = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown account');
  const formId = getEffectiveFormId_();
  if (!formId) {
    SpreadsheetApp.getUi().alert('Form access check', 'No form ID is configured. Run setup as the form owner first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  try {
    const form = FormApp.openById(formId);
    SpreadsheetApp.getUi().alert('Form access check', `Access confirmed for ${runner}: ${form.getTitle()}`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    SpreadsheetApp.getUi().alert(
      'Form access check',
      `The script runner (${runner}) cannot open this form. Ask the form owner to grant this account Editor access, then rerun setup.\n\n${err.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function checkFormAccess() {
  return checkFormAccess_();
}

function removeLegacyAnnouncementArtifacts() {
  return removeLegacyAnnouncementArtifacts_();
}

function ensureSheetSchemas_() {
  const ss = SpreadsheetApp.getActive();

  // Inventory: row 1 reserved (merged A1:L1) for Last Updated, headers on row 2
  let inv = ss.getSheetByName(CONFIG.SHEETS.INVENTORY);
  if (!inv) inv = ss.insertSheet(CONFIG.SHEETS.INVENTORY);
  formatInventorySheet_();

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
    'Action Type','Status','Status Updated At','Contact Type','Notes','Request ID'
  ]);
  requestsSheet.setFrozenRows(1);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.REQUEST_SNAPSHOT, [
    'Request ID','Request Timestamp','Contact','Employee Name','Poster ID','Poster Label','Contact Type'
  ]);

  ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DOCUMENTATION, ['']);

  // System logging/monitoring sheets
  ensureErrorTrackingSheet_();
  ensureAnalyticsSheet_();
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
    CONFIG.SHEETS.REQUEST_SNAPSHOT,
    CONFIG.SHEETS.ERROR_LOG,
    CONFIG.SHEETS.ANALYTICS,
    CONFIG.SHEETS.DATA_INTEGRITY,
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
 * - ORANGE (#FF9800): Configuration/Reference (Documentation)
 * - YELLOW (#FFEB3B): Admin Tools (Request Order, Requests ledger)
 * - RED (#F44336): Error/Debug sheets (Error Log, Data Integrity)
 * - GREEN (#4CAF50): Analytics/Reporting (Analytics)
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
  [CONFIG.SHEETS.DOCUMENTATION].forEach(name => {
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
  [CONFIG.SHEETS.ANALYTICS].forEach(name => {
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
