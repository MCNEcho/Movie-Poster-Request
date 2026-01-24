/** 16_BackupManager.js **/

/**
 * Backup Manager - Critical Data Protection
 * 
 * Backs up only the 3 most critical sheets that contain irreplaceable data:
 * - Requests: Core audit ledger
 * - Request Order: Form submission history
 * - Inventory: Physical stock counts
 * 
 * Other sheets are excluded because they can be:
 * - Rebuilt from form responses (Subscribers)
 * - Computed from Requests (Main, Employees)
 * - Auto-generated (Documentation, Analytics, Error Log, Data Integrity)
 */

/**
 * Perform nightly backup of critical sheets.
 * Creates timestamped copies of Requests, Request Order, and Inventory sheets.
 * 
 * @returns {void}
 */
function performNightlyBackup() {
  const startTime = Date.now();
  
  try {
    const ss = SpreadsheetApp.getActive();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    
    // Get or create backup folder
    const folderId = getOrCreateBackupFolder_();
    
    // Only backup critical sheets with irreplaceable data
    const sheetsToBackup = [
      CONFIG.SHEETS.REQUESTS,       // Core audit ledger (irreplaceable)
      CONFIG.SHEETS.REQUEST_ORDER,  // Form submission history (irreplaceable)
      CONFIG.SHEETS.INVENTORY       // Physical stock counts (critical)
    ];
    
    let successCount = 0;
    sheetsToBackup.forEach(sheetName => {
      try {
        backupSheet_(sheetName, folderId, timestamp);
        successCount++;
      } catch (err) {
        logError_(err, 'performNightlyBackup', `Failed to backup ${sheetName}`, 'HIGH');
      }
    });
    
    // Clean up old backups (keep last 30 days)
    cleanupOldBackups_(folderId);
    
    const executionTime = Date.now() - startTime;
    
    // Log analytics
    logAnalyticsEvent_(
      'BACKUP_COMPLETED',
      Session.getActiveUser().getEmail(),
      { sheetsBackedUp: successCount, totalSheets: sheetsToBackup.length },
      executionTime,
      successCount === sheetsToBackup.length
    );
    
    Logger.log(`[performNightlyBackup] Backed up ${successCount}/${sheetsToBackup.length} sheets in ${executionTime}ms`);
    
  } catch (error) {
    logError_(error, 'performNightlyBackup', 'Critical backup failure', 'CRITICAL');
    throw error;
  }
}

/**
 * Backup a single sheet to Drive folder.
 * 
 * @param {string} sheetName - Name of the sheet to backup
 * @param {string} folderId - ID of the backup folder
 * @param {string} timestamp - Timestamp string for filename
 * @returns {void}
 */
function backupSheet_(sheetName, folderId, timestamp) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log(`[backupSheet_] Sheet not found: ${sheetName}`);
    return;
  }
  
  const folder = DriveApp.getFolderById(folderId);
  const filename = `${sheetName}_${timestamp}`;
  
  // Create a temporary spreadsheet with just this sheet
  const tempSs = SpreadsheetApp.create(filename);
  const tempSheet = tempSs.getSheets()[0];
  
  // Copy data
  const data = sheet.getDataRange().getValues();
  if (data.length > 0) {
    tempSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
  
  // Move to backup folder
  const file = DriveApp.getFileById(tempSs.getId());
  file.moveTo(folder);
  
  Logger.log(`[backupSheet_] Backed up ${sheetName} to ${filename}`);
}

/**
 * Get or create the backup folder in Drive.
 * 
 * @returns {string} Folder ID
 */
function getOrCreateBackupFolder_() {
  const ss = SpreadsheetApp.getActive();
  const ssFile = DriveApp.getFileById(ss.getId());
  const parentFolder = ssFile.getParents().hasNext() ? ssFile.getParents().next() : DriveApp.getRootFolder();
  
  const folderName = 'Poster System Backups';
  const folders = parentFolder.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next().getId();
  } else {
    const newFolder = parentFolder.createFolder(folderName);
    return newFolder.getId();
  }
}

/**
 * Clean up backups older than retention period (configurable, default 30 days).
 * 
 * @param {string} folderId - ID of the backup folder
 * @returns {void}
 */
function cleanupOldBackups_(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const now = new Date();
    const retentionDays = CONFIG.BACKUP.RETENTION_DAYS;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - (retentionDays * millisecondsPerDay));
    
    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      const createdDate = file.getDateCreated();
      
      if (createdDate < cutoffDate) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      Logger.log(`[cleanupOldBackups_] Deleted ${deletedCount} old backup files`);
    }
    
  } catch (error) {
    logError_(error, 'cleanupOldBackups_', 'Failed to cleanup old backups', 'MEDIUM');
  }
}

/**
 * Manual trigger for testing backup system.
 * Call this from the script editor or add to admin menu.
 * 
 * @returns {void}
 */
function manualBackupTrigger() {
  const ss = SpreadsheetApp.getActive();
  
  try {
    ss.toast('Starting manual backup...', 'Backup', 3);
    performNightlyBackup();
    ss.toast('✓ Backup complete! Check "Poster System Backups" folder in Drive.', 'Success', 5);
  } catch (error) {
    ss.toast('🚨 Backup failed - see Error Log sheet', 'Error', 5);
    throw error;
  }
}

/**
 * Setup time-based trigger for nightly backups.
 * Run this once to schedule automatic backups at configured hour (default 2 AM) daily.
 * 
 * @returns {void}
 */
function setupBackupTrigger() {
  // Check if trigger already exists
  const existing = ScriptApp.getProjectTriggers();
  const hasBackupTrigger = existing.some(t => t.getHandlerFunction() === 'performNightlyBackup');
  
  if (!hasBackupTrigger) {
    const backupHour = CONFIG.BACKUP.BACKUP_HOUR;
    ScriptApp.newTrigger('performNightlyBackup')
      .timeBased()
      .atHour(backupHour)
      .everyDays(1)
      .create();
    
    Logger.log(`[setupBackupTrigger] Created nightly backup trigger at ${backupHour}:00`);
  } else {
    Logger.log('[setupBackupTrigger] Backup trigger already exists');
  }
}
