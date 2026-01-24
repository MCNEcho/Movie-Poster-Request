/** 16_BackupManager.js **/

/**
 * Nightly data backup/export to Google Drive
 * Backs up Requests and Subscribers sheets with retention management
 */

/**
 * Main backup function - exports Requests and Subscribers to Drive
 * Called by nightly trigger or manually from menu
 */
function performNightlyBackup() {
  if (!CONFIG.BACKUP.ENABLED) {
    Logger.log('[BACKUP] Backups are disabled in config');
    return;
  }

  const startTime = new Date().getTime();
  const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
  
  try {
    Logger.log('[BACKUP] Starting nightly backup...');
    
    // Ensure backup folder exists
    const folderId = ensureBackupFolder_();
    
    // Backup Requests sheet
    const requestsBackup = backupSheet_(CONFIG.SHEETS.REQUESTS, folderId, timestamp);
    
    // Backup Subscribers sheet
    const subscribersBackup = backupSheet_(CONFIG.SHEETS.SUBSCRIBERS, folderId, timestamp);
    
    // Apply retention policy
    const deletedCount = applyRetentionPolicy_(folderId);
    
    const executionTime = new Date().getTime() - startTime;
    
    // Log success to Analytics
    logBackupEvent_({
      status: 'SUCCESS',
      requestsFile: requestsBackup.name,
      subscribersFile: subscribersBackup.name,
      deletedCount: deletedCount,
      executionTime: executionTime
    });
    
    Logger.log(`[BACKUP] Completed successfully in ${executionTime}ms`);
    Logger.log(`[BACKUP] Deleted ${deletedCount} old backups`);
    
  } catch (err) {
    const executionTime = new Date().getTime() - startTime;
    
    // Log error
    logError_(err, 'performNightlyBackup', {
      timestamp: timestamp,
      executionTime: executionTime
    });
    
    // Log failure to Analytics
    logBackupEvent_({
      status: 'FAILURE',
      error: err.message,
      executionTime: executionTime
    });
    
    Logger.log(`[BACKUP] Failed: ${err.message}`);
    throw err;
  }
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
    
    const notes = details.status === 'SUCCESS'
      ? `Backed up: ${details.requestsFile}, ${details.subscribersFile}. Deleted ${details.deletedCount} old backups.`
      : `Backup failed: ${details.error}`;
    
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
      notes
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
  
  if (!CONFIG.BACKUP.ENABLED) {
    ui.alert('⚠️ Backups Disabled', 
      'Backups are currently disabled in the configuration.', 
      ui.ButtonSet.OK);
    return;
  }
  
  try {
    ui.alert('🔄 Starting Backup', 
      'Creating backups of Requests and Subscribers sheets...', 
      ui.ButtonSet.OK);
    
    performNightlyBackup();
    
    // Get backup folder for display
    const folderId = getProps_().getProperty(CONFIG.PROPS.BACKUP_FOLDER_ID);
    const folder = DriveApp.getFolderById(folderId);
    const folderUrl = folder.getUrl();
    
    ui.alert('✅ Backup Complete', 
      `Backups created successfully!\n\nView backups in Drive:\n${folderUrl}`, 
      ui.ButtonSet.OK);
      
  } catch (err) {
    ui.alert('❌ Backup Failed', 
      `An error occurred during backup:\n\n${err.message}\n\nCheck the Error Log sheet for details.`, 
      ui.ButtonSet.OK);
  }
}
