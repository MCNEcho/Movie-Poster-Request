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
    const tempSheet = empSS.insertSheet('TEMP_DELETE_ME');

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
    empSS.deleteSheet(tempSheet);

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
      // Spreadsheet was deleted; will recreate below
    }
  }

  const adminSS = SpreadsheetApp.getActive();
  const name = `${adminSS.getName()} (Employee View)`;
  const empSS = SpreadsheetApp.create(name);

  props.setProperty(CONFIG.PROPS.EMPLOYEE_VIEW_SSID, empSS.getId());
  return empSS;
}
