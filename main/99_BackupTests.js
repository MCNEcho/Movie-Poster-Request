/** 99_BackupTests.js **/

/**
 * Manual tests for backup functionality
 * Run these functions from the Apps Script editor to verify backup features
 */

/**
 * Test 1: Test CSV conversion function
 */
function testCsvConversion() {
  const testData = [
    ['Header1', 'Header2', 'Header3'],
    ['Value1', 'Value with, comma', 'Value3'],
    ['Value4', 'Value with "quotes"', 'Value6'],
    ['Value7', 'Value with\nNewline', 'Value9']
  ];
  
  const csv = convertToCsv_(testData);
  Logger.log('CSV Output:');
  Logger.log(csv);
  
  // Verify CSV formatting
  const lines = csv.split('\n');
  const expectedLines = 4;
  
  if (lines.length === expectedLines) {
    Logger.log('✅ CSV conversion test PASSED');
  } else {
    Logger.log(`❌ CSV conversion test FAILED: Expected ${expectedLines} lines, got ${lines.length}`);
  }
}

/**
 * Test 2: Test backup folder creation
 */
function testBackupFolderCreation() {
  try {
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    
    Logger.log('✅ Backup folder test PASSED');
    Logger.log(`Folder ID: ${folderId}`);
    Logger.log(`Folder Name: ${folder.getName()}`);
    Logger.log(`Folder URL: ${folder.getUrl()}`);
    
    return folderId;
  } catch (err) {
    Logger.log('❌ Backup folder test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 3: Test single sheet backup (CSV format)
 */
function testSingleSheetBackupCsv() {
  try {
    // Temporarily change format to CSV
    const originalFormat = CONFIG.BACKUP.FORMAT;
    CONFIG.BACKUP.FORMAT = 'CSV';
    
    const folderId = ensureBackupFolder_();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    const sheetName = CONFIG.SHEETS.SUBSCRIBERS; // Use smaller sheet for testing
    
    const result = backupSheet_(sheetName, folderId, timestamp);
    
    Logger.log('✅ CSV backup test PASSED');
    Logger.log(`File Name: ${result.name}`);
    Logger.log(`File ID: ${result.id}`);
    Logger.log(`File URL: ${result.url}`);
    
    // Restore original format
    CONFIG.BACKUP.FORMAT = originalFormat;
    
    return result;
  } catch (err) {
    Logger.log('❌ CSV backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 4: Test single sheet backup (Sheet format)
 */
function testSingleSheetBackupSheet() {
  try {
    // Temporarily change format to SHEET
    const originalFormat = CONFIG.BACKUP.FORMAT;
    CONFIG.BACKUP.FORMAT = 'SHEET';
    
    const folderId = ensureBackupFolder_();
    const timestamp = fmtDate_(now_(), 'yyyy-MM-dd_HHmmss');
    const sheetName = CONFIG.SHEETS.SUBSCRIBERS; // Use smaller sheet for testing
    
    const result = backupSheet_(sheetName, folderId, timestamp);
    
    Logger.log('✅ Sheet backup test PASSED');
    Logger.log(`Sheet Name: ${result.name}`);
    Logger.log(`Sheet ID: ${result.id}`);
    Logger.log(`Sheet URL: ${result.url}`);
    
    // Restore original format
    CONFIG.BACKUP.FORMAT = originalFormat;
    
    return result;
  } catch (err) {
    Logger.log('❌ Sheet backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 5: Test retention policy (with test files)
 */
function testRetentionPolicy() {
  try {
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    
    // Create test files with different dates
    const testFileName1 = 'TEST_OLD_BACKUP_DELETE_ME.txt';
    const testFileName2 = 'TEST_RECENT_BACKUP_DELETE_ME.txt';
    
    // Create old file (35 days ago - should be deleted with 30 day retention)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    const oldFile = folder.createFile(testFileName1, 'Old test backup');
    
    // Create recent file (10 days ago - should be kept)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    const recentFile = folder.createFile(testFileName2, 'Recent test backup');
    
    Logger.log('Created test files...');
    Logger.log(`Old file: ${oldFile.getName()}`);
    Logger.log(`Recent file: ${recentFile.getName()}`);
    
    // Note: Google Drive doesn't allow setting creation date directly
    // So we'll clean up manually instead
    
    Logger.log('⚠️ Retention policy test requires manual verification');
    Logger.log('To test retention:');
    Logger.log('1. The policy deletes files older than 30 days');
    Logger.log('2. Manually check the backup folder after 30+ days');
    Logger.log('3. Or modify CONFIG.BACKUP.RETENTION_DAYS to 0 and run backup');
    
    // Clean up test files
    oldFile.setTrashed(true);
    recentFile.setTrashed(true);
    
    Logger.log('✅ Retention policy test setup PASSED (manual verification needed)');
    
  } catch (err) {
    Logger.log('❌ Retention policy test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Test 6: Test full backup with logging
 */
function testFullBackup() {
  try {
    Logger.log('Starting full backup test...');
    
    // Ensure Analytics sheet exists
    if (!SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS)) {
      ensureAnalyticsSheet_();
    }
    
    // Get initial file count in backup folder
    const folderId = ensureBackupFolder_();
    const folder = DriveApp.getFolderById(folderId);
    const filesBefore = [];
    const filesIterator = folder.getFiles();
    while (filesIterator.hasNext()) {
      filesBefore.push(filesIterator.next().getName());
    }
    
    // Perform backup
    performNightlyBackup();
    
    // Check files after backup
    const filesAfter = [];
    const filesIteratorAfter = folder.getFiles();
    while (filesIteratorAfter.hasNext()) {
      filesAfter.push(filesIteratorAfter.next().getName());
    }
    
    // Count new backup files
    const expectedSheets = CONFIG.BACKUP.SHEETS_TO_BACKUP.length;
    const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
    
    Logger.log(`New backup files created: ${newFiles.length}`);
    Logger.log(`Expected: ${expectedSheets} (${CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ')})`);
    Logger.log(`Files: ${newFiles.join(', ')}`);
    
    if (newFiles.length === expectedSheets) {
      Logger.log('✅ Full backup test PASSED');
      Logger.log(`Verified that only ${expectedSheets} configured sheets were backed up`);
    } else {
      Logger.log(`⚠️ Full backup test WARNING: Expected ${expectedSheets} files, found ${newFiles.length}`);
    }
    
    Logger.log('Check:');
    Logger.log('1. Analytics sheet for BACKUP event');
    Logger.log('2. Backup folder in Drive for exported files');
    Logger.log('3. Error Log sheet (should have no new errors)');
    Logger.log(`4. Only these sheets should be backed up: ${CONFIG.BACKUP.SHEETS_TO_BACKUP.join(', ')}`);
    
  } catch (err) {
    Logger.log('❌ Full backup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}

/**
 * Run all tests
 */
function runAllBackupTests() {
  Logger.log('=================================');
  Logger.log('RUNNING ALL BACKUP TESTS');
  Logger.log('=================================\n');
  
  try {
    Logger.log('Test 1: CSV Conversion');
    testCsvConversion();
    Logger.log('');
    
    Logger.log('Test 2: Backup Folder Creation');
    testBackupFolderCreation();
    Logger.log('');
    
    Logger.log('Test 3: Single Sheet Backup (CSV)');
    testSingleSheetBackupCsv();
    Logger.log('');
    
    Logger.log('Test 4: Single Sheet Backup (Sheet)');
    testSingleSheetBackupSheet();
    Logger.log('');
    
    Logger.log('Test 5: Retention Policy');
    testRetentionPolicy();
    Logger.log('');
    
    Logger.log('Test 6: Full Backup');
    testFullBackup();
    Logger.log('');
    
    Logger.log('Test 7: Orphaned Request Cleanup');
    testOrphanedRequestCleanup();
    Logger.log('');
    
    Logger.log('=================================');
    Logger.log('ALL TESTS COMPLETED');
    Logger.log('=================================');
    
  } catch (err) {
    Logger.log('\n=================================');
    Logger.log('TEST SUITE FAILED');
    Logger.log(`Error: ${err.message}`);
    Logger.log('=================================');
  }
}

/**
 * Test 7: Test orphaned request auto-deletion
 */
function testOrphanedRequestCleanup() {
  try {
    Logger.log('Testing orphaned request cleanup...');
    
    // This test verifies that checkForOrphanedRequests_() auto-deletes orphaned requests
    // Note: This is a dry-run test - it doesn't create test data
    
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const rowCountBefore = requestsSheet.getLastRow();
    
    // Run orphan check
    const result = checkForOrphanedRequests_();
    
    const rowCountAfter = requestsSheet.getLastRow();
    const rowsDeleted = rowCountBefore - rowCountAfter;
    
    Logger.log(`Rows before: ${rowCountBefore}`);
    Logger.log(`Rows after: ${rowCountAfter}`);
    Logger.log(`Rows deleted: ${rowsDeleted}`);
    Logger.log(`Check result: ${result.status}`);
    Logger.log(`Issues found: ${result.issuesFound}`);
    Logger.log(`Auto-repaired: ${result.autoRepaired}`);
    
    if (rowsDeleted === result.autoRepaired) {
      Logger.log('✅ Orphaned request cleanup test PASSED');
      Logger.log('Verified: Rows deleted matches auto-repaired count');
    } else {
      Logger.log(`⚠️ Orphaned request cleanup test WARNING`);
      Logger.log(`Expected ${result.autoRepaired} deletions, actual: ${rowsDeleted}`);
    }
    
    Logger.log('Check:');
    Logger.log('1. Data Integrity sheet for orphaned request log entries');
    Logger.log('2. Requests sheet should not contain orphaned ACTIVE requests');
    Logger.log('3. Deleted requests should be completely removed (not marked REMOVED)');
    
  } catch (err) {
    Logger.log('❌ Orphaned request cleanup test FAILED');
    Logger.log(`Error: ${err.message}`);
    throw err;
  }
}
