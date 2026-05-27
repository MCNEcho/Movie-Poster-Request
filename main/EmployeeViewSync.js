/** EmployeeViewSync.js (CROSS-SPREADSHEET SAFE) **/

/**
 * Creates (if needed) and syncs the employee-view spreadsheet.
 * Uses native sheet.copyTo() to copy Main and Employees sheets.
 * Gracefully handles permission errors for non-master accounts.
 */
function syncEmployeeViewSpreadsheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log(`[syncEmployeeViewSpreadsheet_] Starting sync`);
    const adminSS = SpreadsheetApp.getActive();
    
    let empSS;
    try {
      empSS = getOrCreateEmployeeViewSpreadsheet_();
    } catch (accessErr) {
      // Permission denied - non-master account cannot access Employee View
      const msg = 'Cannot access Employee View (permission denied). Only the master account can sync. Employee View will show stale data until master account syncs.';
      Logger.log(`[syncEmployeeViewSpreadsheet_] WARN: ${msg}`);
      return { success: false, message: msg }; // Exit gracefully with explicit status
    }

    // Add a temporary sheet to allow deleting all others
    let tempSheet = empSS.getSheetByName('TEMP_DELETE_ME');
    if (!tempSheet) {
      tempSheet = empSS.insertSheet('TEMP_DELETE_ME');
    }

    // Delete all other sheets except the temporary one
    empSS.getSheets().forEach(sh => {
      if (sh.getSheetName() !== 'TEMP_DELETE_ME') {
        empSS.deleteSheet(sh);
      }
    });

    // Copy Main sheet
    const mainSheet = adminSS.getSheetByName(CONFIG.SHEETS.MAIN);
    let mainSheetCopy = null;
    if (mainSheet) {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Copying Main sheet`);
      try {
        mainSheetCopy = mainSheet.copyTo(empSS).setName(CONFIG.SHEETS.MAIN);
      } catch (err) {
        Logger.log(`[syncEmployeeViewSpreadsheet_] Error copying Main sheet: ${err.message}`);
      }
    } else {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Main sheet not found in admin spreadsheet`);
    }

    // Copy Employees sheet
    const empSheet = adminSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    let empSheetCopy = null;
    if (empSheet) {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Copying Employees sheet`);
      try {
        empSheetCopy = empSheet.copyTo(empSS).setName(CONFIG.SHEETS.EMPLOYEES);
      } catch (err) {
        Logger.log(`[syncEmployeeViewSpreadsheet_] Error copying Employees sheet: ${err.message}`);
      }
    } else {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Employees sheet not found in admin spreadsheet`);
    }

    // Remove the temporary sheet
    if (tempSheet && empSS.getSheetByName('TEMP_DELETE_ME')) {
      empSS.deleteSheet(tempSheet);
    }

    // Normalize copied tabs so no rows/cols remain hidden and no stale filters
    // can suppress top entries (e.g., first employee header row).
    if (mainSheetCopy) normalizeCopiedSheet_(mainSheetCopy);
    if (empSheetCopy) normalizeCopiedSheet_(empSheetCopy);

    Logger.log(`[syncEmployeeViewSpreadsheet_] Sync complete`);

    // IMPORTANT: this sync recreates Main/Employees sheets in the employee spreadsheet,
    // which can change sheet gid values. Always refresh the Employees-tab URL and cache
    // so QR/Print links never become stale.
    const empEmployeesSheet = empSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    const empUrl = empEmployeesSheet
      ? `${empSS.getUrl()}#gid=${empEmployeesSheet.getSheetId()}`
      : empSS.getUrl();

    // Keep Script Property cache in sync for downstream consumers (PrintOut/QR).
    const props = PropertiesService.getScriptProperties();
    props.setProperty('CACHED_EMPLOYEE_VIEW_URL', empUrl);

    // Keep Print Out Employee View URL in sync on every successful sync.
    const printSheet = adminSS.getSheetByName(CONFIG.SHEETS.PRINT_OUT);
    if (printSheet) {
      printSheet.getRange(CONFIG.PRINT.EMP_VIEW_URL_CELL).setValue(empUrl);
    }
    Logger.log(`[syncEmployeeViewSpreadsheet_] Updated Employee View URL/cache: ${empUrl}`);
    return {
      success: true,
      message: 'Employee View synced successfully.',
      url: empUrl,
    };

  } catch (err) {
    Logger.log(`[syncEmployeeViewSpreadsheet_] ERROR: ${err.message}`);
    // Don't rethrow - allow graceful degradation for permission errors
    // Employee View will just show stale data until master account syncs
    return { success: false, message: `Sync failed: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Makes copied sheet fully visible and removes filters that can hide rows.
 */
function normalizeCopiedSheet_(sheet) {
  try {
    const maxRows = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    if (maxRows > 0) sheet.showRows(1, maxRows);
    if (maxCols > 0) sheet.showColumns(1, maxCols);

    const filter = sheet.getFilter();
    if (filter) filter.remove();
  } catch (err) {
    Logger.log(`[normalizeCopiedSheet_] Warning on ${sheet.getSheetName()}: ${err.message}`);
  }
}

/**
 * One-time setup: creates the employee view spreadsheet if missing,
 * stores its ID in Script Properties, and initializes its sheets.
 */
function setupEmployeeViewSpreadsheet() {
  const empSS = getOrCreateEmployeeViewSpreadsheet_();

  // initial sync
  syncEmployeeViewSpreadsheet_();

  SpreadsheetApp.getUi().alert(
    'Employee View spreadsheet is ready.\n\n' +
    'Share THIS file with employees as Viewer:\n' +
    empSS.getUrl()
  );
}

function openEmployeeViewSpreadsheet() {
  const empSS = getEmployeeViewSpreadsheet_();
  SpreadsheetApp.getUi().alert('Employee View URL:\n' + empSS.getUrl());
}

/**
 * Shows consolidated Employee View Manager dialog with all employee view operations
 */
function showEmployeeViewManagerDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h2 {
            color: #1a73e8;
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .section h3 {
            margin-top: 0;
            color: #5f6368;
            font-size: 14px;
          }
          button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-top: 8px;
          }
          button:hover {
            background: #1557b0;
          }
          button:active {
            background: #0d47a1;
          }
          button.secondary {
            background: #5f6368;
          }
          button.secondary:hover {
            background: #3c4043;
          }
          .info {
            color: #5f6368;
            font-size: 12px;
            margin-top: 5px;
          }
          .success {
            color: #0d7a3c;
            font-weight: bold;
          }
          .error {
            color: #d93025;
            font-weight: bold;
          }
          #status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
          }
          .show-status {
            display: block !important;
          }
          #urlDisplay {
            margin-top: 10px;
            padding: 10px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            word-break: break-all;
            font-size: 12px;
            display: none;
          }
          .show-url {
            display: block !important;
          }
        </style>
      </head>
      <body>
        <h2>⚙️ Employee View Manager</h2>
        
        <div class="section">
          <h3>Setup (One-Time)</h3>
          <button onclick="setupEmployeeView()">Setup Employee View</button>
          <div class="info">Creates new employee-facing spreadsheet (run once)</div>
        </div>
        
        <div class="section">
          <h3>Sync Data</h3>
          <button onclick="syncEmployeeView()">Sync Employee View</button>
          <div class="info">Updates employee view with current board data</div>
        </div>
        
        <div class="section">
          <h3>Access Link</h3>
          <button class="secondary" onclick="showLink()">Show Employee View Link</button>
          <div class="info">Display shareable link to employee spreadsheet</div>
          <div id="urlDisplay"></div>
        </div>
        
        <div id="status"></div>
        
        <script>
          function setupEmployeeView() {
            showStatus('Setting up Employee View...', false);
            google.script.run
              .withSuccessHandler(function(url) {
                showStatus('✅ Employee View setup complete!', true);
                displayUrl(url);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .setupEmployeeViewWithReturn();
          }
          
          function syncEmployeeView() {
            showStatus('Syncing Employee View...', false);
            google.script.run
              .withSuccessHandler(function(result) {
                if (result && result.success) {
                  showStatus('✅ ' + (result.message || 'Employee View synced successfully!'), true);
                } else {
                  const msg = (result && result.message) ? result.message : 'Sync skipped.';
                  showStatus('⚠️ ' + msg, false);
                }
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .syncEmployeeView();
          }
          
          function showLink() {
            showStatus('Fetching Employee View link...', false);
            google.script.run
              .withSuccessHandler(function(url) {
                displayUrl(url);
                showStatus('', false);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .getEmployeeViewUrl();
          }
          
          function showStatus(message, isSuccess) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = isSuccess ? 'show-status success' : 'show-status error';
          }
          
          function displayUrl(url) {
            const urlDiv = document.getElementById('urlDisplay');
            urlDiv.innerHTML = '<strong>Employee View URL:</strong><br>' + 
              '<a href="' + url + '" target="_blank">' + url + '</a>';
            urlDiv.className = 'show-url';
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Employee View Manager');
}

/**
 * PUBLIC wrapper - Setup helper that returns URL for dialog display
 */
function setupEmployeeViewWithReturn() {
  const empSS = getOrCreateEmployeeViewSpreadsheet_();
  syncEmployeeViewSpreadsheet_();
  return empSS.getUrl();
}

/**
 * PUBLIC wrapper - Get Employee View URL for dialog display
 */
function getEmployeeViewUrl() {
  const empSS = getEmployeeViewSpreadsheet_();
  return empSS.getUrl();
}

/**
 * PUBLIC wrapper - Sync employee view from dialog
 */
function syncEmployeeView() {
  return syncEmployeeViewSpreadsheet_();
}

// Keep private versions for backward compatibility
function setupEmployeeViewWithReturn_() {
  return setupEmployeeViewWithReturn();
}

function getEmployeeViewUrl_() {
  return getEmployeeViewUrl();
}

/** Employees tab URL in employee-view spreadsheet (for QR/Print Out) */
function getEmployeeViewEmployeesUrl_() {
  try {
    const empSS = getEmployeeViewSpreadsheet_();
    if (!empSS) return '';
    
    const sh = empSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    if (!sh) {
      Logger.log('[getEmployeeViewEmployeesUrl_] EMPLOYEES sheet not found in employee view. Syncing now...');
      syncEmployeeViewSpreadsheet_();
      const shRetry = empSS.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
      if (!shRetry) return ''; // Still missing, return empty
      return empSS.getUrl() + '#gid=' + shRetry.getSheetId();
    }
    return empSS.getUrl() + '#gid=' + sh.getSheetId();
  } catch (err) {
    Logger.log(`[getEmployeeViewEmployeesUrl_] Error: ${err.message} - Employee View not set up yet`);
    return ''; // Return empty if employee view not set up
  }
}

/**
 * Get cached Employee View URL from properties (set during initial setup)
 * This ensures the URL never changes even if spreadsheet access becomes denied
 */
function getCachedEmployeeViewUrl_() {
  const props = PropertiesService.getScriptProperties();
  let cachedUrl = props.getProperty('CACHED_EMPLOYEE_VIEW_URL');
  
  // If not cached, try to get it now and cache it
  if (!cachedUrl) {
    try {
      cachedUrl = getEmployeeViewEmployeesUrl_();
      if (cachedUrl) {
        props.setProperty('CACHED_EMPLOYEE_VIEW_URL', cachedUrl);
        Logger.log('[getCachedEmployeeViewUrl_] Cached Employee View URL: ' + cachedUrl);
      }
    } catch (err) {
      Logger.log('[getCachedEmployeeViewUrl_] Could not cache URL: ' + err.message);
      // Return empty string - graceful degradation
      return '';
    }
  }
  
  return cachedUrl || '';
}

/**
 * Initialize Employee View URL cache during setup (called once)
 */
function initializeEmployeeViewUrlCache_() {
  try {
    const url = getEmployeeViewEmployeesUrl_();
    if (url) {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('CACHED_EMPLOYEE_VIEW_URL', url);
      Logger.log('[initializeEmployeeViewUrlCache_] Cached Employee View URL: ' + url);
    }
  } catch (err) {
    Logger.log('[initializeEmployeeViewUrlCache_] Warning - could not cache Employee View URL: ' + err.message);
    // Don't throw - graceful degradation during setup
  }
}

/** --- Internal helpers --- **/

function getEmployeeViewSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID);

  if (!id) {
    throw new Error('Employee View spreadsheet not set up yet. Run setupEmployeeViewSpreadsheet() first.');
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Employee View spreadsheet exists but cannot be accessed: ' + e.message);
  }
}

function getOrCreateEmployeeViewSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // Spreadsheet was deleted or access denied
      if (!isMasterAccount_()) {
        throw new Error('Employee View spreadsheet access denied. Contact the master admin to manage it.');
      }
      // Will recreate below for master admin
    }
  }

  if (!isMasterAccount_()) {
    throw new Error('Employee View spreadsheet not set up yet. Contact the master admin to initialize it.');
  }

  const adminSS = SpreadsheetApp.getActive();
  const name = `${adminSS.getName()} (Employee View)`;
  const empSS = SpreadsheetApp.create(name);

  props.setProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID, empSS.getId());
  return empSS;
}
