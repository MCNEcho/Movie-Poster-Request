/** 15_EmployeeViewSync.js (CROSS-SPREADSHEET SAFE) **/

/**
 * Creates (if needed) and syncs the employee-view spreadsheet.
 * Uses native sheet.copyTo() to copy Main and Employees sheets.
 */
function syncEmployeeViewSpreadsheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log(`[syncEmployeeViewSpreadsheet_] Starting sync`);
    const adminSS = SpreadsheetApp.getActive();
    const empSS = getOrCreateEmployeeViewSpreadsheet_();

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
    if (mainSheet) {
      Logger.log(`[syncEmployeeViewSpreadsheet_] Copying Main sheet`);
      try {
        mainSheet.copyTo(empSS).setName(CONFIG.SHEETS.MAIN);
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

    Logger.log(`[syncEmployeeViewSpreadsheet_] Sync complete`);

    // After sync, update Print Out tab B2 with Employees sheet URL
    const empUrl = getEmployeeViewEmployeesUrl_();
    const printSheet = adminSS.getSheetByName(CONFIG.SHEETS.PRINT_OUT);
    if (printSheet && empUrl) {
      printSheet.getRange(CONFIG.PRINT.EMP_VIEW_URL_CELL).setValue(empUrl);
      Logger.log(`[syncEmployeeViewSpreadsheet_] Updated Print Out tab B2 with Employee View URL: ${empUrl}`);
    }

  } catch (err) {
    Logger.log(`[syncEmployeeViewSpreadsheet_] ERROR: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
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
              .setupEmployeeViewWithReturn_();
          }
          
          function syncEmployeeView() {
            showStatus('Syncing Employee View...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Employee View synced successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .syncEmployeeViewSpreadsheet_();
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
              .getEmployeeViewUrl_();
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
 * Setup helper that returns URL for dialog display
 */
function setupEmployeeViewWithReturn_() {
  const empSS = getOrCreateEmployeeViewSpreadsheet_();
  syncEmployeeViewSpreadsheet_();
  return empSS.getUrl();
}

/**
 * Get Employee View URL for dialog display
 */
function getEmployeeViewUrl_() {
  const empSS = getEmployeeViewSpreadsheet_();
  return empSS.getUrl();
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
