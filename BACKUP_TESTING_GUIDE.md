# Nightly Backup Feature - Testing & Verification Guide

## Overview
This guide will help you test and verify the nightly backup feature for the Poster Request System.

## Feature Summary
- **Purpose**: Automatically backup Requests and Subscribers sheets to Google Drive nightly
- **Schedule**: Runs at 2 AM daily (configurable)
- **Retention**: Keeps backups for 30 days (configurable)
- **Format**: CSV or Google Sheet copy (configurable)
- **Logging**: All backup events logged to Analytics and Error Log sheets

## Pre-Testing Setup

### 1. Deploy the Code
If using `clasp`:
```bash
clasp push
```

Or manually:
1. Copy all JavaScript files to your Apps Script project
2. Ensure `16_BackupManager.js` and `99_BackupTests.js` are included

### 2. Run Setup
1. Open your Google Sheet
2. Refresh the page (to see new menu items)
3. Click **Poster System → Run Setup / Repair**
4. This will:
   - Create the nightly backup trigger (2 AM daily)
   - Set up all necessary sheets
   - Initialize the system

### 3. Verify Menu Item
Check that the admin menu now includes:
- **"Run Backup Now"** (between "Send Announcement Now" and "Setup Employee View")

## Testing Instructions

### Test 1: CSV Conversion (Quick Test)
1. Open **Extensions → Apps Script**
2. Select the `99_BackupTests.js` file
3. Run function: `testCsvConversion`
4. Check **Execution log** (View → Logs)
5. Expected: "✅ CSV conversion test PASSED"

### Test 2: Backup Folder Creation
1. Open **Extensions → Apps Script**
2. Run function: `testBackupFolderCreation`
3. Check **Execution log**
4. Expected:
   - "✅ Backup folder test PASSED"
   - Folder ID and URL displayed
5. Open the URL to verify folder exists in your Drive
6. Folder name should be: "Poster System Backups"

### Test 3: CSV Backup Test
1. Open **Extensions → Apps Script**
2. Run function: `testSingleSheetBackupCsv`
3. Check **Execution log**
4. Expected: "✅ CSV backup test PASSED"
5. Open the backup folder in Drive
6. Verify a CSV file was created with format: `Subscribers_YYYY-MM-DD_HHMMSS.csv`
7. Download and open the CSV to verify data integrity

### Test 4: Google Sheet Backup Test
1. Open **Extensions → Apps Script**
2. Run function: `testSingleSheetBackupSheet`
3. Check **Execution log**
4. Expected: "✅ Sheet backup test PASSED"
5. Open the backup folder in Drive
6. Verify a Google Sheet was created
7. Open the sheet to verify data was copied correctly

### Test 5: Full Backup Test (Most Important)
#### Option A: From Admin Menu (Recommended)
1. Open your Google Sheet
2. Click **Poster System → Run Backup Now**
3. Alert: "🔄 Starting Backup"
4. Wait for completion
5. Alert: "✅ Backup Complete" with Drive folder link
6. Click the link to verify backups

#### Option B: From Apps Script
1. Open **Extensions → Apps Script**
2. Run function: `testFullBackup`
3. Check **Execution log**
4. Expected: "✅ Full backup test PASSED"

#### Verification After Full Backup:
1. **Check Drive Folder**:
   - Should contain 2 files (or 4 if you ran both CSV and Sheet tests):
     - `Requests_YYYY-MM-DD_HHMMSS.csv` (or `.sheet`)
     - `Subscribers_YYYY-MM-DD_HHMMSS.csv` (or `.sheet`)
   - Download and verify data integrity

2. **Check Analytics Sheet**:
   - Open the Analytics sheet
   - Look for most recent row
   - Expected columns:
     - Event Type: "BACKUP"
     - Request Status: "SUCCESS"
     - Execution Time: (milliseconds)
     - Notes: "Backed up: Requests_..., Subscribers_..."

3. **Check Error Log Sheet**:
   - Should have NO new errors
   - If errors exist, review the error message

### Test 6: Manual Trigger Test
1. From your Google Sheet
2. Click **Poster System → Run Backup Now**
3. Verify alerts appear:
   - "🔄 Starting Backup" 
   - "✅ Backup Complete"
4. Check backup folder has new files
5. Check Analytics sheet has new BACKUP event

### Test 7: Retention Policy Test
Since we can't easily create files with old dates, verify the logic:

1. Open **Extensions → Apps Script**
2. Open `16_BackupManager.js`
3. Find function `applyRetentionPolicy_`
4. Review the logic:
   - Gets files from backup folder
   - Checks each file's creation date
   - Deletes files older than `CONFIG.BACKUP.RETENTION_DAYS`

**To test retention (optional):**
1. Edit `00_Config.js`
2. Temporarily change `RETENTION_DAYS: 30` to `RETENTION_DAYS: 0`
3. Run a backup
4. All existing backup files should be deleted
5. **IMPORTANT**: Change back to `RETENTION_DAYS: 30` immediately

### Test 8: Run All Tests (Complete Suite)
1. Open **Extensions → Apps Script**
2. Run function: `runAllBackupTests`
3. Check **Execution log**
4. Expected: All tests pass with "ALL TESTS COMPLETED"
5. Review each test result in the log

## Configuration Options

### Change Backup Time
Edit `01_Setup.js`, function `ensureTriggers_`:
```javascript
.atHour(2)  // Change to desired hour (0-23)
```

### Change Retention Period
Edit `00_Config.js`:
```javascript
RETENTION_DAYS: 30,  // Change to desired days
```

### Change Backup Format
Edit `00_Config.js`:
```javascript
FORMAT: 'CSV',  // Options: 'CSV' or 'SHEET'
```

### Disable Backups Temporarily
Edit `00_Config.js`:
```javascript
ENABLED: false,  // Set to false to disable
```

### Change Backup Folder Name
Edit `00_Config.js`:
```javascript
FOLDER_NAME: 'Poster System Backups',  // Change to desired name
```

## Verifying Nightly Trigger

### Check Trigger Exists
1. Open **Extensions → Apps Script**
2. Click **Triggers** (clock icon on left sidebar)
3. Look for trigger:
   - Function: `performNightlyBackup`
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: 2am to 3am

### Wait for First Nightly Run
1. After setup, wait until after 2 AM next day
2. Check backup folder for new files
3. Check Analytics sheet for new BACKUP event
4. Verify timestamp is around 2 AM

### View Trigger Execution History
1. Open **Extensions → Apps Script**
2. Click **Executions** (list icon on left sidebar)
3. Filter by: `performNightlyBackup`
4. Review status (should be "Completed")
5. Check execution time and logs

## Troubleshooting

### Backup Fails with Permission Error
**Cause**: Apps Script needs Drive access
**Solution**:
1. Run `testBackupFolderCreation` manually
2. Authorize Drive access when prompted
3. Try backup again

### Backup Folder Not Found
**Cause**: Folder ID not stored or deleted
**Solution**:
1. Check Script Properties: **File → Project properties → Script properties**
2. Look for `BACKUP_FOLDER_ID`
3. If missing or invalid, delete the property
4. Run backup again (will create new folder)

### No Backups in Folder
**Cause**: Backups disabled or trigger not created
**Solution**:
1. Check `CONFIG.BACKUP.ENABLED` is `true`
2. Verify trigger exists (see "Check Trigger Exists" above)
3. Run **Poster System → Run Setup / Repair**

### Analytics Not Logging Backup Events
**Cause**: Analytics sheet doesn't exist
**Solution**:
1. Run **Poster System → Run Setup / Repair**
2. Verify "Analytics" sheet exists
3. Run backup again

### Old Backups Not Being Deleted
**Cause**: Retention policy may not be running
**Solution**:
1. Check `CONFIG.BACKUP.RETENTION_DAYS` value
2. Verify backups are actually older than retention period
3. Check Execution log for any errors in `applyRetentionPolicy_`

### Trigger Not Running at 2 AM
**Cause**: Timezone mismatch or trigger not created
**Solution**:
1. Check `CONFIG.TIMEZONE` matches your timezone
2. Verify trigger exists and is enabled
3. Check quota limits: **Apps Script → Project settings → Quotas**

## Monitoring Best Practices

### Daily Checks (First Week)
1. Check backup folder daily for new files
2. Review Analytics sheet for BACKUP events
3. Verify timestamps are correct
4. Check Error Log for any issues

### Weekly Checks (Ongoing)
1. Verify backups are being created
2. Check backup folder size (shouldn't grow indefinitely)
3. Spot-check backup file integrity
4. Review retention policy effectiveness

### Monthly Tasks
1. Download and archive a backup set externally (extra safety)
2. Review Analytics for backup success rate
3. Adjust retention period if needed
4. Clean up any test backup files

## Security Notes

### Backup Folder Permissions
- By default, only you (the script owner) can access the backup folder
- Share backup folder with authorized admins only
- Never share with "Anyone with the link"

### Data Privacy
- Backups contain ALL data from Requests and Subscribers sheets
- Includes employee emails and names
- Store securely and comply with privacy policies

### Quota Considerations
- Nightly backups count toward Apps Script quotas
- CSV format uses less quota than Sheet format
- Typical backup: ~50-100 KB per sheet (CSV)
- Well within Apps Script limits

## Success Criteria Checklist

After testing, verify these criteria are met:

- [ ] Backup folder created in Google Drive
- [ ] Manual "Run Backup Now" works from menu
- [ ] Both Requests and Subscribers backed up
- [ ] Backup files contain correct data
- [ ] Nightly trigger exists and is scheduled for 2 AM
- [ ] Analytics sheet logs BACKUP events with SUCCESS status
- [ ] Error Log has no backup-related errors
- [ ] Retention policy can delete old files (test with 0-day retention)
- [ ] Configuration options work (format, retention, folder name)
- [ ] No impact on existing workflows (forms still work)

## Support

If you encounter issues not covered in this guide:
1. Check the Error Log sheet for detailed error messages
2. Review Execution log in Apps Script
3. Verify all configuration values are correct
4. Run **Poster System → Run Setup / Repair**
5. Check the main README.md for system troubleshooting

## Summary

The nightly backup feature is now:
- ✅ Configured with sensible defaults (30-day retention, CSV format)
- ✅ Integrated into the admin menu
- ✅ Scheduled to run at 2 AM daily
- ✅ Logging all events to Analytics and Error Log
- ✅ Applying retention policy automatically
- ✅ Non-blocking and quota-safe

The system will automatically maintain rolling backups of your critical data with minimal maintenance required.
