/** BackupManager.js **/

/**
 * Nightly data backup/export to Google Drive
 * Backs up request and inventory sheets with retention management
 */

/**
 * Main backup function - exports configured sheets to Drive
 * Called by nightly trigger or manually from menu
 */
function performNightlyBackup() {
  if (!CONFIG.BACKUP.ENABLED) {
    Logger.log('[BACKUP] Backups are disabled in config');
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE);
    return;
  }

  const backupDay = fmtDate_(now_(), 'yyyy-MM-dd');
  const priorRetryState = readJsonProp_(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE, null);
  if (priorRetryState && priorRetryState.day !== backupDay) {
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE);
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
  } else if (priorRetryState && priorRetryState.day === backupDay && priorRetryState.stuck) {
    Logger.log(`[BACKUP] Retry cap already reached for ${backupDay}; waiting for the next scheduled run.`);
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    recordBackupFailure_(backupDay, 'Script lock is busy.');
    return;
  }
  try {
    const props = getProps_();
    if (props.getProperty(CONFIG.PROPS.LAST_NIGHTLY_BACKUP_DATE) === backupDay) {
      Logger.log(`[BACKUP] Skipping duplicate backup; already reserved/completed for ${backupDay}.`);
      props.deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
      props.deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE);
      return;
    }
    props.setProperty(CONFIG.PROPS.LAST_NIGHTLY_BACKUP_DATE, backupDay);
  } finally {
    lock.releaseLock();
  }

  const result = runBackupWork_();
  if (result.success) {
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
    getProps_().deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE);
  } else {
    const props = getProps_();
    if (props.getProperty(CONFIG.PROPS.LAST_NIGHTLY_BACKUP_DATE) === backupDay) {
      props.deleteProperty(CONFIG.PROPS.LAST_NIGHTLY_BACKUP_DATE);
    }
    recordBackupFailure_(backupDay, result.message);
  }
}
function runBackupWork_() {
  const startedAt = Date.now();
  const files = [];
  const errors = [];
  let deletedCount = 0;
  let folderId = '';
  try {
    Logger.log('[BACKUP] Starting backup work...');
    folderId = ensureBackupFolder_();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    CONFIG.BACKUP.SHEETS_TO_BACKUP.forEach(sheetName => {
      try {
        const result = backupSheet_(sheetName, folderId, timestamp);
        if (result && result.name) files.push(result.name);
        else errors.push({ sheet: sheetName, error: 'Invalid result structure' });
      } catch (err) {
        errors.push({ sheet: sheetName, error: err && err.message ? err.message : String(err) });
      }
    });

    if (!files.length && CONFIG.BACKUP.SHEETS_TO_BACKUP.length) {
      throw new Error(errors.map(item => `${item.sheet}: ${item.error}`).join('; ') || 'No backup files were created.');
    }
    deletedCount = applyRetentionPolicy_(folderId);
    const success = errors.length === 0;
    const message = success
      ? `Backup complete: ${files.length} file(s) created; ${deletedCount} old backup(s) removed.`
      : `Backup partially completed: ${files.length} file(s) created; ${errors.length} sheet(s) failed.`;
    logBackupEvent_({
      status: success ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      sheets: CONFIG.BACKUP.SHEETS_TO_BACKUP,
      files,
      errors,
      deletedCount,
      executionTime: Date.now() - startedAt,
    });
    Logger.log(`[BACKUP] ${message}`);
    return { success, files, errors, deletedCount, message, folderId };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    errors.push({ sheet: '', error: message });
    logBackupEvent_({
      status: 'FAILURE',
      sheets: CONFIG.BACKUP.SHEETS_TO_BACKUP,
      files,
      errors,
      deletedCount,
      error: message,
      executionTime: Date.now() - startedAt,
    });
    Logger.log(`[BACKUP] Failed: ${message}`);
    return { success: false, files, errors, deletedCount, message: `Backup failed: ${message}`, folderId };
  }
}

const BACKUP_RETRY_BACKOFF_MINUTES = [5, 15, 60];
const BACKUP_MAX_RETRIES_PER_DAY = 3;

function backupRetryBackoffMinutes_(retryNumber) {
  const index = Math.max(0, Math.min(Number(retryNumber) - 1, BACKUP_RETRY_BACKOFF_MINUTES.length - 1));
  return BACKUP_RETRY_BACKOFF_MINUTES[index];
}

function backupRetryAllowed_(state, day) {
  return !!state && state.day === day && !state.stuck && Number(state.retries || 0) < BACKUP_MAX_RETRIES_PER_DAY;
}

function backupRetryStateForFailure_(existing, day, nowMs, errorMessage) {
  const sameDay = !!(existing && existing.day === day);
  const state = sameDay ? existing : { day, retries: 0 };
  if (!sameDay) {
    return {
      day,
      retries: 0,
      nextAttemptAt: Number(nowMs) + BACKUP_RETRY_BACKOFF_MINUTES[0] * 60000,
      lastError: String(errorMessage || '').slice(0, 300),
      stuck: false,
    };
  }

  const retries = Number(state.retries || 0) + 1;
  if (retries >= BACKUP_MAX_RETRIES_PER_DAY) {
    return { day, retries, nextAttemptAt: 0, lastError: String(errorMessage || '').slice(0, 300), stuck: true };
  }
  return {
    day,
    retries,
    nextAttemptAt: Number(nowMs) + backupRetryBackoffMinutes_(retries + 1) * 60000,
    lastError: String(errorMessage || '').slice(0, 300),
    stuck: false,
  };
}

function recordBackupFailure_(day, errorMessage) {
  if (!isMasterAccount_()) return;
  const props = getProps_();
  const current = readJsonProp_(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE, null);
  const next = backupRetryStateForFailure_(current, day, Date.now(), errorMessage);
  if (next.stuck) {
    props.deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
    props.setProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE, JSON.stringify(next));
    logError_(new Error(`Nightly backup failed after ${BACKUP_MAX_RETRIES_PER_DAY} retries today; will try again at the next scheduled run. Last error: ${next.lastError}`),
      'performNightlyBackup', { day, stuck: true, retries: next.retries });
    Logger.log('[BACKUP] Retry cap reached for today; retry state cleared until next scheduled run.');
    return;
  }

  props.setProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE, JSON.stringify(next));
  props.setProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY, 'true');
  Logger.log(`[BACKUP] Failure recorded for ${day}; retry ${next.retries + 1} due at ${new Date(next.nextAttemptAt).toISOString()}: ${next.lastError}`);
}

function processNightlyBackupRetryQueue_() {
  if (!isMasterAccount_()) return;
  const props = getProps_();
  if (props.getProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY) !== 'true') return;
  const day = fmtDate_(now_(), 'yyyy-MM-dd');
  const state = readJsonProp_(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE, null);
  if (!state || state.day !== day) {
    props.deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY);
    props.deleteProperty(CONFIG.PROPS.NIGHTLY_BACKUP_RETRY_STATE);
    return;
  }
  if (!backupRetryAllowed_(state, day) || Number(state.nextAttemptAt || 0) > Date.now()) return;
  performNightlyBackup();
}

/**
 * Backup a single sheet to Drive
 * @param {string} sheetName - Name of sheet to backup
 * @param {string} folderId - Drive folder ID
 * @param {string} timestamp - Timestamp for filename
 * @returns {object} File metadata {name, id, url}
 */
function backupSheet_(sheetName, folderId, timestamp) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  
  const folder = DriveApp.getFolderById(folderId);
  const fileName = `${sheetName}_${timestamp}`;
  
  if (CONFIG.BACKUP.FORMAT === 'SHEET') {
    // Create Google Sheet copy
    const newSpreadsheet = SpreadsheetApp.create(fileName);
    const newSheet = newSpreadsheet.getActiveSheet();
    
    // Copy data
    const data = sheet.getDataRange().getValues();
    if (data.length > 0 && data[0] && data[0].length > 0) {
      newSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
    
    // Move to backup folder
    const file = DriveApp.getFileById(newSpreadsheet.getId());
    file.moveTo(folder);
    
    Logger.log(`[BACKUP] Created Sheet backup: ${fileName}`);
    
    return {
      name: fileName,
      id: newSpreadsheet.getId(),
      url: newSpreadsheet.getUrl()
    };
    
  } else {
    // Create CSV export (default)
    const data = sheet.getDataRange().getValues();
    const csv = convertToCsv_(data);
    const blob = Utilities.newBlob(csv, 'text/csv', fileName + '.csv');
    const file = folder.createFile(blob);
    
    Logger.log(`[BACKUP] Created CSV backup: ${fileName}.csv`);
    
    return {
      name: fileName + '.csv',
      id: file.getId(),
      url: file.getUrl()
    };
  }
}

/**
 * Convert 2D array to CSV string
 * @param {Array<Array>} data - 2D array of values
 * @returns {string} CSV string
 */
function convertToCsv_(data) {
  return data.map(row => {
    return row.map(cell => {
      const str = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');
}

/**
 * Ensure backup folder exists in Drive, create if needed
 * @returns {string} Folder ID
 */
function ensureBackupFolder_() {
  const props = getProps_();
  let folderId = props.getProperty(CONFIG.PROPS.BACKUP_FOLDER_ID);
  
  // Check if folder exists
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      Logger.log(`[BACKUP] Using existing folder: ${folder.getName()}`);
      return folderId;
    } catch (e) {
      // Folder doesn't exist, create new one
      Logger.log('[BACKUP] Stored folder not found, creating new one');
      folderId = null;
    }
  }
  
  // Create new folder or find existing one
  const folderName = CONFIG.BACKUP.FOLDER_NAME;
  const folders = DriveApp.getFoldersByName(folderName);
  
  let folder;
  if (folders.hasNext()) {
    // Use first existing folder with same name
    // Note: If multiple folders exist, only the first is used
    folder = folders.next();
    Logger.log(`[BACKUP] Found existing folder: ${folderName}`);
  } else {
    // Create new folder
    folder = DriveApp.createFolder(folderName);
    Logger.log(`[BACKUP] Created new folder: ${folderName}`);
  }
  
  // Store folder ID for future lookups
  folderId = folder.getId();
  props.setProperty(CONFIG.PROPS.BACKUP_FOLDER_ID, folderId);
  
  return folderId;
}

/**
 * Delete backups older than retention days
 * @param {string} folderId - Backup folder ID
 * @returns {number} Number of files deleted
 */
function applyRetentionPolicy_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const retentionMs = CONFIG.BACKUP.RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - retentionMs);
  
  let deletedCount = 0;
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    const file = files.next();
    const createdDate = file.getDateCreated();
    
    if (createdDate < cutoffDate) {
      Logger.log(`[BACKUP] Deleting old backup: ${file.getName()} (created ${createdDate})`);
      file.setTrashed(true);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

/**
 * Log backup event to Analytics sheet
 * @param {object} details - Backup details
 */
function logBackupEvent_(details) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    
    let notes;
    if (details.status === 'SUCCESS' || details.status === 'PARTIAL_SUCCESS') {
      notes = `Backed up ${details.sheets.length} sheet(s): ${details.sheets.join(', ')}. Deleted ${details.deletedCount} old backups.`;
      if (details.errors && details.errors.length > 0) {
        notes += ` Errors: ${details.errors.map(e => `${e.sheet} (${e.error})`).join('; ')}`;
      }
    } else {
      notes = `Backup failed: ${details.error}`;
    }
    
    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BACKUP',
      '',
      '',
      '',
      '',
      details.status,
      details.executionTime || 0,
      0,
      0,
      0,
      notes,
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log backup event: ${err.message}`);
  }
}

/**
 * Manual backup trigger from admin menu
 * Shows user-friendly alerts
 */
function manualBackupTrigger() {
  const ui = SpreadsheetApp.getUi();
  const result = agentRunManualBackup();
  const folderUrl = result.folderId ? DriveApp.getFolderById(result.folderId).getUrl() : '';
  const fileList = result.files.length ? `\n\nFiles:\n${result.files.join('\n')}` : '';
  const driveLink = folderUrl ? `\n\nView backups in Drive:\n${folderUrl}` : '';
  ui.alert(result.success ? 'Backup Result' : 'Backup Not Completed',
    `${result.message}${fileList}${driveLink}`, ui.ButtonSet.OK);
}

// End of BackupManager.js.

