// === SETUP AND TRIGGERS MODULE ===
// Consolidates: Setup.js, RefreshManager.js, FormManager.js, FormSync.js
// Provides: System initialization, menu building, trigger wiring, form management, form syncing

// ===== SYSTEM INITIALIZATION =====

function onOpen() {
  buildAdminMenu_();
}

function buildAdminMenu_() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📋 Movie Posters')
    .addSubMenu(
      ui.createMenu('📊 Reports')
        .addItem('Main Board', 'showMainBoard_')
        .addItem('Employees Board', 'showEmployeesBoard_')
        .addItem('Form Responses', 'showFormResponses_')
        .addItem('Documentation', 'showDocumentation_')
        .addItem('Analytics Report', 'showAnalyticsReport_')
    )
    .addSubMenu(
      ui.createMenu('🖨️ Print & Layout')
        .addItem('Prepare Print Area', 'prepareAndSelectPrintArea')
        .addItem('View Print Out', 'showPrintOut_')
        .addItem('Refresh Print Layout', 'refreshPrintOut')
    )
    .addSubMenu(
      ui.createMenu('📮 Announcements')
        .addItem('Preview Announcements', 'previewPendingAnnouncement')
        .addItem('Send Now', 'sendAnnouncementNow')
        .addItem('View Queue', 'showAnnouncementQueue_')
    )
    .addSubMenu(
      ui.createMenu('⚙️ Advanced')
        .addItem('Manually Add Request', 'showManualRequestDialog')
        .addItem('Manually Add Poster', 'showManualPosterDialog')
        .addItem('Run Backup Now', 'manualBackupTrigger')
        .addItem('Sync Employee View', 'syncEmployeeView')
        .addItem('Show Form Link', 'showFormLinkDialog')
        .addItem('Run Integrity Check', 'showIntegrityCheckDialog_')
        .addItem('Bulk Submission Simulator', 'showBulkSimulatorDialog')
    )
    .addSeparator()
    .addItem('🔄 Refresh All', 'executeRefreshAll_')
    .addSeparator()
    .addItem('⚡ Run Setup / Repair', 'setupPosterSystem')
    .addToUi();
}

function setupPosterSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[SETUP] Starting system setup/repair...');

    ensureSheetSchemas_();
    ensureTriggers_();
    getOrCreateForm_();
    syncPostersToForm();

    buildDocumentationTab();
    removeFrozenHeadersFromAllSheets_();
    hideInternalSheets_();
    applyTabColors_();
    applyAdminFormatting_();
    formatInventorySheet_();

    SpreadsheetApp.getUi().alert('✅ Setup complete!');
    Logger.log('[SETUP] System setup complete');

  } catch (err) {
    logError_(err, 'setupPosterSystem', 'System setup', 'CRITICAL');
    SpreadsheetApp.getUi().alert(`❌ Setup failed: ${err.message}`);
  } finally {
    lock.releaseLock();
  }
}

function ensureTriggers_() {
  const ss = SpreadsheetApp.getActive();
  const ssId = ss.getId();

  const existingTriggers = ScriptApp.getProjectTriggers();

  const needsFormTrigger = !existingTriggers.some(t =>
    t.getHandlerFunction() === 'handleFormSubmit' &&
    t.getTriggerSource() === ScriptApp.TriggerSource.FORMS
  );

  const needsSheetEditTrigger = !existingTriggers.some(t =>
    t.getHandlerFunction() === 'handleSheetEdit' &&
    t.getTriggerSource() === ScriptApp.TriggerSource.SPREADSHEET &&
    t.getEventType() === ScriptApp.EventType.ON_CHANGE
  );

  const needsTimeoutTrigger = !existingTriggers.some(t =>
    t.getHandlerFunction() === 'processAnnouncementQueue' &&
    t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK
  );

  const needsNightlyTrigger = !existingTriggers.some(t =>
    t.getHandlerFunction() === 'performNightlyBackup' &&
    t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK
  );

  if (needsFormTrigger) {
    Logger.log('[TRIGGERS] Creating form submission trigger');
    const form = getOrCreateForm_();
    ScriptApp.newTrigger('handleFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();
  }

  if (needsSheetEditTrigger) {
    Logger.log('[TRIGGERS] Creating sheet edit trigger');
    ScriptApp.newTrigger('handleSheetEdit')
      .forSpreadsheet(ss)
      .onChange()
      .create();
  }

  if (needsTimeoutTrigger) {
    Logger.log('[TRIGGERS] Creating 15-minute clock trigger');
    ScriptApp.newTrigger('processAnnouncementQueue')
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  if (needsNightlyTrigger) {
    Logger.log('[TRIGGERS] Creating 2 AM nightly trigger');
    ScriptApp.newTrigger('performNightlyBackup')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .create();
  }

  Logger.log(`[TRIGGERS] Trigger setup complete (checked: form=${needsFormTrigger}, sheet=${needsSheetEditTrigger}, 15min=${needsTimeoutTrigger}, nightly=${needsNightlyTrigger})`);
}

function createTriggersNow_() {
  // Force creation of all triggers
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(t => {
    try {
      ScriptApp.deleteTrigger(t);
      Logger.log(`[TRIGGERS] Deleted existing trigger: ${t.getHandlerFunction()}`);
    } catch (e) {}
  });

  ensureTriggers_();
}

function ensureSheetSchemas_() {
  const ss = SpreadsheetApp.getActive();

  Logger.log('[SCHEMA] Ensuring sheet schemas...');

  // Ensure all core sheets exist with proper headers
  [
    CONFIG.SHEETS.REQUESTS,
    CONFIG.SHEETS.INVENTORY,
    CONFIG.SHEETS.REQUEST_ORDER,
    CONFIG.SHEETS.SUBSCRIBERS,
    CONFIG.SHEETS.MAIN,
    CONFIG.SHEETS.EMPLOYEES,
    CONFIG.SHEETS.PRINT_OUT,
    CONFIG.SHEETS.POSTER_OUTSIDE,
    CONFIG.SHEETS.POSTER_INSIDE,
    CONFIG.SHEETS.DOCUMENTATION,
    CONFIG.SHEETS.ANALYTICS,
    CONFIG.SHEETS.ANALYTICS_SUMMARY,
    CONFIG.SHEETS.DATA_INTEGRITY
  ].forEach(sheetName => {
    let sh = ss.getSheetByName(sheetName);

    if (!sh) {
      Logger.log(`[SCHEMA] Creating sheet: ${sheetName}`);
      sh = ss.insertSheet(sheetName);
    }

    // Set basic formatting
    sh.setColumnWidth(1, 100);
  });

  Logger.log('[SCHEMA] Sheet schema check complete');
}

function removeFrozenHeadersFromAllSheets_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();

  sheets.forEach(sh => {
    sh.setFrozenRows(0);
  });

  Logger.log('[FORMAT] Removed frozen headers from all sheets');
}

function hideInternalSheets_() {
  const ss = SpreadsheetApp.getActive();

  [CONFIG.SHEETS.REQUEST_ORDER, CONFIG.SHEETS.ANALYTICS, CONFIG.SHEETS.ANALYTICS_SUMMARY, CONFIG.SHEETS.DATA_INTEGRITY]
    .forEach(sheetName => {
      try {
        const sh = ss.getSheetByName(sheetName);
        if (sh) sh.hideSheet();
        Logger.log(`[FORMAT] Hid sheet: ${sheetName}`);
      } catch (e) {}
    });

  Logger.log('[FORMAT] Internal sheets hidden');
}

function applyTabColors_() {
  const ss = SpreadsheetApp.getActive();

  const colors = {
    [CONFIG.SHEETS.INVENTORY]: '#FFE699',
    [CONFIG.SHEETS.MAIN]: '#B6D7A8',
    [CONFIG.SHEETS.EMPLOYEES]: '#A4C2F4',
    [CONFIG.SHEETS.REQUESTS]: '#F8CBAD',
    [CONFIG.SHEETS.PRINT_OUT]: '#EA9999'
  };

  Object.entries(colors).forEach(([sheetName, color]) => {
    try {
      const sh = ss.getSheetByName(sheetName);
      if (sh) sh.setTabColor(color);
      Logger.log(`[FORMAT] Colored sheet: ${sheetName} -> ${color}`);
    } catch (e) {}
  });

  Logger.log('[FORMAT] Tab colors applied');
}

function applyAdminFormatting_() {
  const ss = SpreadsheetApp.getActive();
  Logger.log('[FORMAT] Applying admin-focused formatting...');

  // Bold headers, alternating row colors, auto-resizing, etc.
  [CONFIG.SHEETS.MAIN, CONFIG.SHEETS.EMPLOYEES]
    .forEach(sheetName => {
      const sh = ss.getSheetByName(sheetName);
      if (!sh) return;

      sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
      sh.setColumnWidths(1, sh.getLastColumn(), 150);
    });

  Logger.log('[FORMAT] Admin formatting complete');
}

function formatInventorySheet_() {
  const sh = getSheet_(CONFIG.SHEETS.INVENTORY);

  // Header formatting
  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn());
  headerRow.setFontWeight('bold').setBackground('#E8E8E8');

  // Column widths
  sh.setColumnWidth(COLS.INVENTORY.TITLE, 200);
  sh.setColumnWidth(COLS.INVENTORY.RELEASE, 100);
  sh.setColumnWidth(COLS.INVENTORY.STOCK, 80);

  Logger.log('[FORMAT] Inventory sheet formatted');
}

// ===== REFRESH MANAGEMENT =====

function showRefreshManagerDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial; font-size: 13px; padding: 20px;">
      <h3>Refresh Manager</h3>
      <p>Select which displays to refresh:</p>
      <div style="margin: 15px 0;">
        <label><input type="checkbox" name="outside" checked> Poster Outside</label><br>
        <label><input type="checkbox" name="inside" checked> Poster Inside</label><br>
        <label><input type="checkbox" name="boards" checked> Boards</label><br>
        <label><input type="checkbox" name="print" checked> Print Layout</label><br>
        <label><input type="checkbox" name="form" checked> Form Options</label>
      </div>
      <button onclick="refresh()" style="padding: 8px 15px; background: #4285F4; color: white; border: none; border-radius: 3px; cursor: pointer;">
        🔄 Refresh Selected
      </button>
      <script>
        function refresh() {
          const outside = document.querySelector('input[name="outside"]').checked;
          const inside = document.querySelector('input[name="inside"]').checked;
          const boards = document.querySelector('input[name="boards"]').checked;
          const print = document.querySelector('input[name="print"]').checked;
          const form = document.querySelector('input[name="form"]').checked;

          if (outside) google.script.run.updatePosterOutsideTimestamp_();
          if (inside) google.script.run.updatePosterInsideTimestamp_();
          if (boards) google.script.run.rebuildBoards();
          if (print) google.script.run.refreshPrintOut();
          if (form) google.script.run.syncPostersToForm();

          google.script.host.close();
        }
      </script>
    </div>
  `)
    .setWidth(400)
    .setHeight(350);

  SpreadsheetApp.getUi().showModalDialog(html, 'Refresh Manager');
}

function refreshAllDisplays() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[REFRESH] Refreshing all displays...');

    rebuildBoards();
    refreshPrintOut();
    refreshDisplayDropdowns_();
    syncPostersToForm();

    Logger.log('[REFRESH] All displays refreshed');
  } catch (err) {
    logError_(err, 'refreshAllDisplays', 'Display refresh');
  } finally {
    lock.releaseLock();
  }
}

function refreshPosterOutside() {
  updatePosterOutsideTimestamp_();
  Logger.log('[REFRESH] Poster Outside refreshed');
}

function refreshPosterInside() {
  updatePosterInsideTimestamp_();
  Logger.log('[REFRESH] Poster Inside refreshed');
}

function executeRefreshAll_() {
  SpreadsheetApp.getUi().alert('Refreshing all displays...');
  refreshAllDisplays();
  SpreadsheetApp.getUi().alert('✅ All displays refreshed!');
}

function refreshPosterOutsideDropdowns_() {
  try {
    const sh = getSheet_(CONFIG.SHEETS.POSTER_OUTSIDE);
    const titles = getMovieTitlesFromInventory_();

    sh.getRange(3, 1, titles.length, 1).clearContent();
    titles.forEach((title, idx) => {
      sh.getRange(3 + idx, 1).setValue('☐ ' + title);
    });

    Logger.log('[REFRESH] Poster Outside dropdowns refreshed');
  } catch (err) {
    Logger.log(`[WARN] Failed to refresh Poster Outside dropdowns: ${err.message}`);
  }
}

function refreshPosterInsideDropdowns_() {
  try {
    const sh = getSheet_(CONFIG.SHEETS.POSTER_INSIDE);
    const titles = getMovieTitlesFromInventory_();

    sh.getRange(3, 1, titles.length, 1).clearContent();
    titles.forEach((title, idx) => {
      sh.getRange(3 + idx, 1).setValue('☐ ' + title);
    });

    Logger.log('[REFRESH] Poster Inside dropdowns refreshed');
  } catch (err) {
    Logger.log(`[WARN] Failed to refresh Poster Inside dropdowns: ${err.message}`);
  }
}

// ===== FORM MANAGEMENT =====

function getEffectiveFormId_() {
  return readProp_(CONFIG.PROPS.FORM_ID, CONFIG.FORM_META.FORM_ID_FALLBACK || '');
}

function getOrCreateForm_() {
  let formId = getEffectiveFormId_();

  // Try to access existing form
  if (formId) {
    try {
      return FormApp.openById(formId);
    } catch (err) {
      Logger.log(`[FORM] Existing form ${formId} not accessible: ${err.message}`);
    }
  }

  // Create new form
  Logger.log('[FORM] Creating new form...');

  const form = FormApp.create(`${CONFIG.FORM_META.APP_NAME || 'Movie Poster'} Requests`);
  formId = form.getId();

  writeProp_(CONFIG.PROPS.FORM_ID, formId);
  form.setCollectEmail(true);

  ensureFormStructure_(form);

  Logger.log(`[FORM] Created form: ${formId}`);

  return form;
}

function getFormPublishedUrlSafe_() {
  try {
    const form = getOrCreateForm_();
    return form.getPublishedUrl();
  } catch (err) {
    Logger.log(`[FORM] Could not get published URL: ${err.message}`);
    return null;
  }
}

function getCachedFormUrl_() {
  const cached = getCache_('form_url');

  if (cached && cached.expiration > now_().getTime()) {
    return cached.value;
  }

  const url = getFormPublishedUrlSafe_();

  if (url) {
    setCache_('form_url', url, 60); // Cache for 60 minutes
  }

  return url;
}

function initializeFormUrlCache_() {
  const url = getFormPublishedUrlSafe_();
  if (url) setCache_('form_url', url, 60);
}

function setCheckboxChoicesByTitle_(form, questionTitle, choices) {
  const items = form.getItems(FormApp.ItemType.CHECKBOX);

  const item = items.find(i => i.getTitle() === questionTitle);
  if (!item) {
    Logger.log(`[FORM] Question "${questionTitle}" not found - creating`);
    form.addCheckboxItem().setTitle(questionTitle).setChoices(
      choices.map(c => form.createChoice(c))
    );
    return;
  }

  const checkboxItem = item.asCheckboxItem();
  checkboxItem.setChoices(
    choices.map(c => form.createChoice(c))
  );

  Logger.log(`[FORM] Updated "${questionTitle}" with ${choices.length} choices`);
}

function ensureSubscribeQuestion_(form) {
  const items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);

  const existingSubscribe = items.find(i =>
    i.getTitle().toLowerCase().includes('subscribe') ||
    i.getTitle().toLowerCase().includes('announcement')
  );

  if (existingSubscribe) return;

  Logger.log('[FORM] Creating Subscribe question');

  form.addMultipleChoiceItem()
    .setTitle(CONFIG.FORM.Q_SUBSCRIBE || 'Subscribe to announcements?')
    .setChoices([
      form.createChoice('Yes'),
      form.createChoice('No', false)
    ])
    .setRequired(false);
}

function ensureFormStructure_(form) {
  Logger.log('[FORM] Ensuring form structure...');

  // Employee name
  form.addTextItem()
    .setTitle(CONFIG.FORM.Q_EMPLOYEE_NAME || 'Your Name')
    .setRequired(true);

  // Add posters (checkboxes)
  const activePosterLabels = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const choices = Object.keys(activePosterLabels).sort();

  form.addCheckboxItem()
    .setTitle(CONFIG.FORM.Q_ADD || 'Add to your requests')
    .setChoices(choices.map(c => form.createChoice(c)))
    .setRequired(false);

  // Remove posters (checkboxes)
  form.addCheckboxItem()
    .setTitle(CONFIG.FORM.Q_REMOVE || 'Remove from your requests')
    .setChoices(choices.map(c => form.createChoice(c)))
    .setRequired(false);

  // Subscribe
  ensureSubscribeQuestion_(form);

  Logger.log('[FORM] Form structure ensured');
}

// ===== FORM SYNCING =====

function syncPostersToForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[FORMSYNC] Starting form sync...');

    const form = getOrCreateForm_();
    const posters = getPostersWithLabels_();

    // Map poster titles to IDs
    const labelToId = {};
    const idToCurrent = {};

    posters.forEach(p => {
      labelToId[p.label] = p.posterId;
      idToCurrent[p.posterId] = p.label;
    });

    writeJsonProp_(CONFIG.PROPS.LABEL_TO_ID, labelToId);
    writeJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, idToCurrent);

    // Update form question choices
    const labels = Object.keys(labelToId).sort();

    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_ADD || 'Add to your requests', labels);
    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_REMOVE || 'Remove from your requests', labels);

    logFormSyncEvent_('SUCCESS', posters.length);
    Logger.log(`[FORMSYNC] Form sync complete (${posters.length} active posters)`);

  } catch (err) {
    logError_(err, 'syncPostersToForm', 'Form sync');
    logFormSyncEvent_('ERROR', 0);
  } finally {
    lock.releaseLock();
  }
}

// ===== HELPER DIALOGS =====

function showMainBoard_() {
  const sh = getSheet_(CONFIG.SHEETS.MAIN);
  SpreadsheetApp.getActive().setActiveSheet(sh);
}

function showEmployeesBoard_() {
  const sh = getSheet_(CONFIG.SHEETS.EMPLOYEES);
  SpreadsheetApp.getActive().setActiveSheet(sh);
}

function showFormResponses_() {
  const form = getOrCreateForm_();
  SpreadsheetApp.getUi().alert(`Form link: ${form.getPublishedUrl()}`);
}

function showDocumentation_() {
  const sh = getSheet_(CONFIG.SHEETS.DOCUMENTATION);
  SpreadsheetApp.getActive().setActiveSheet(sh);
}

function showAnalyticsReport_() {
  const report = generateAnalyticsReport_();
  SpreadsheetApp.getUi().alert(report);
}

function showPrintOut_() {
  const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
  SpreadsheetApp.getActive().setActiveSheet(sh);
}

function showAnnouncementQueue_() {
  const preview = generateAnnouncementPreview_();
  SpreadsheetApp.getUi().alert(`Pending announcements:\n\n${preview}`);
}

function showFormLinkDialog() {
  const url = getCachedFormUrl_();
  SpreadsheetApp.getUi().alert(`Form Link:\n\n${url || '(Not configured)'}`);
}

function showIntegrityCheckDialog_() {
  const results = runFullIntegrityCheck_();
  const summary = `Integrity Check Results:\n` +
    `Total issues found: ${results.totalIssuesFound}\n` +
    `Auto-repaired: ${results.autoRepaired}\n` +
    `Requires admin action: ${results.requiresAdminAction}`;

  SpreadsheetApp.getUi().alert(summary);
}

function showBulkSimulatorDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial; font-size: 12px; padding: 20px; max-width: 500px;">
      <h3>Bulk Submission Simulator</h3>
      <p>Simulate multiple form submissions for testing.</p>
      
      <label>Number of submissions (max 100):</label>
      <input type="number" id="count" min="1" max="100" value="10" style="width: 100%; padding: 5px; margin: 10px 0;">
      
      <label><input type="checkbox" id="dryrun" checked> Dry-run (preview only)</label>
      
      <div style="margin-top: 15px;">
        <button onclick="run()" style="padding: 8px 15px; background: #4285F4; color: white; border: none; border-radius: 3px; cursor: pointer; width: 100%;">
          Run Simulation
        </button>
      </div>
      
      <script>
        function run() {
          const count = parseInt(document.getElementById('count').value) || 10;
          const dryRun = document.getElementById('dryrun').checked;
          
          if (count >= 50 && !dryRun) {
            if (!confirm('WARNING: Running 50+ live submissions. Continue?')) return;
          }
          
          google.script.run.runBulkSimulation_(count, dryRun);
          google.script.host.close();
        }
      </script>
    </div>
  `).setWidth(400).setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Simulator');
}

function prepareAndSelectPrintArea() {
  try {
    Logger.log('[PRINTSETUP] Preparing print area...');

    const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
    SpreadsheetApp.getActive().setActiveSheet(sh);

    const range = sh.getRange('A1:F200');
    sh.setNamedRange('PrintArea', range);

    Logger.log('[PRINTSETUP] Print area prepared');
    SpreadsheetApp.getUi().alert('✅ Print area ready!');

  } catch (err) {
    logError_(err, 'prepareAndSelectPrintArea', 'Print area setup');
  }
}

function runBulkSimulation_(count, dryRun) {
  Logger.log(`[BULK] Starting bulk simulation: ${count} submissions, dryRun=${dryRun}`);
  
  const startTime = now_();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < count; i++) {
    try {
      const email = `test${i}@example.com`;
      const name = `Test User ${i}`;

      if (!dryRun) {
        const formTs = now_();
        createLedgerRow_(email, name, '12345', formTs);
        successCount++;
      } else {
        successCount++;
      }
    } catch (err) {
      Logger.log(`[BULK] Simulation ${i} failed: ${err.message}`);
      failCount++;
    }
  }

  const duration = now_().getTime() - startTime.getTime();

  const metrics = {
    count,
    dryRun,
    successCount,
    failCount,
    durationMs: duration
  };

  logBulkSimulationEvent_(count, dryRun, JSON.stringify(metrics));

  const msg = `Bulk simulation complete!\n` +
    `Success: ${successCount}, Failed: ${failCount}\n` +
    `Duration: ${duration}ms`;

  SpreadsheetApp.getUi().alert(msg);
  Logger.log(`[BULK] Simulation complete: ${JSON.stringify(metrics)}`);
}

function syncEmployeeView() {
  try {
    const requests = getActiveRequests_();
    const empViewSh = getSheet_(CONFIG.SHEETS.EMPLOYEE_VIEW || 'Employee View');

    empViewSh.clearContents();

    let row = 1;
    empViewSh.getRange(row, 1, 1, 4).setValues([['Email', 'Name', 'Active Slots', 'Posters']]);
    row++;

    const byEmail = {};
    requests.forEach(req => {
      const email = req.empEmail.toLowerCase();
      if (!byEmail[email]) {
        byEmail[email] = { email, name: req.empName, requests: [] };
      }
      byEmail[email].requests.push(req);
    });

    Object.values(byEmail).forEach(emp => {
      const posterStr = emp.requests.map(r => r.titleSnap || r.labelAtReq).join(', ');
      empViewSh.getRange(row, 1, 1, 4).setValues([[emp.email, emp.name, emp.requests.length, posterStr]]);
      row++;
    });

    SpreadsheetApp.getUi().alert('✅ Employee view synced!');
    Logger.log('[EMPVIEW] Employee view synced');

  } catch (err) {
    logError_(err, 'syncEmployeeView', 'Employee view sync');
  }
}
