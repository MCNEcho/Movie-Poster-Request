# Movie Poster Request System - Complete Reference

## System Features Overview

### 🎯 Core Features
- **Per-Employee Slot Limiting** - Each employee limited to 7 active poster requests
- **Duplicate Prevention** - Email + Poster ID deduplication (historical blocking)
- **Name Validation** - Enforce "FirstName LastInitial" format (e.g., "Gavin N")
- **Email Accountability** - Auto-collected from Google Account, cannot be faked
- **Complete Audit Trail** - Every submission logged in Request Order sheet
- **Inventory Tracking** - Display poster counts (informational only, never blocks)

### 📧 Notification System
- **Email Subscriptions** - Opt-in checkbox in form, stored in Subscribers sheet
- **Batched Announcements** - Multiple posters per email (up to 5 per batch)
- **Template System** - Variable substitution ({{TITLE}}, {{RELEASE}}, {{FORM_LINK}}, etc.)
- **Throttling & Retry** - 1-second delay between emails, 3 retry attempts with backoff
- **Custom Messages** - Admin can queue custom announcements to subscribers
- **Queue System** - Announcements sent every 15 minutes via time-driven trigger

### 📊 Analytics & Monitoring
- **Performance Tracking** - Execution time, sheet reads, cache hits, lock wait times
- **Event Logging** - All submissions, board rebuilds, form syncs logged to Analytics sheet
- **Analytics Summary** - Aggregated metrics (cache hit rate, avg execution times, anomalies)
- **Anomaly Detection** - High submission rates, rapid submissions flagged automatically
- **Most Requested Posters** - Track which posters are most popular
- **Data Archival** - Auto-delete analytics older than 90 days

### 🛡️ Data Protection & Quality
- **Error Handling** - Centralized error logging with admin notifications (CRITICAL severity)
- **Data Integrity Checks** - Detects orphaned requests, duplicates, over-capacity, invalid emails
- **Auto-Repair** - Can automatically fix certain data integrity issues
- **Nightly Backups** - Automated CSV/Sheet backups to Google Drive (2 AM daily)
- **Retention Policy** - Keep backups for 30 days, auto-delete older files
- **Manual Backup** - Admin can trigger backup anytime via menu

### ⚡ Performance Optimization
- **Request Caching** - TTL-based cache (5 minutes) for expensive queries
- **Cache Invalidation** - Smart invalidation on sheet edits (poster changes, submissions)
- **Cached Queries** - Employee slots, poster availability, board data, subscriber lists
- **Cache Stats** - Track hit rate and performance metrics in Analytics Summary

### 🧪 Testing & Simulation
- **Bulk Simulator** - Stress-test with N randomized submissions (up to 100)
- **Dry-Run Mode** - Preview simulations without actually writing to sheets
- **Quota Monitoring** - Track API usage during bulk testing
- **Analytics Logging** - All simulations logged for performance analysis

### 🖨️ Print & Sharing
- **Print Layout** - Formatted inventory list with QR codes
- **QR Code Generation** - Links to form and employee view (QuickChart API)
- **One-Click Preparation** - Auto-select print area and open print dialog
- **Employee View Spreadsheet** - Separate read-only spreadsheet synced from Employees sheet
- **Safe Sharing** - No admin data (Requests ledger, inventory) exposed

### 🔧 Admin Tools
- **Admin Menu** - 13 one-click management functions
- **Manual Request Entry** - Add historical requests for migration/corrections
- **System Repair** - One-click full rebuild (sheets, triggers, form, boards)
- **Health Banner** - Real-time system metrics displayed on Main sheet
- **Documentation** - Auto-generated employee and admin guides

---

## Module Reference

### 00_Config.js - Configuration & Constants
**Purpose:** Central configuration repository for all system settings

**Key Objects:**
- `CONFIG` - All system settings (timezone, form, sheets, limits, flags)
- `COLS` - 1-based column mappings for all sheets
- `STATUS` - Status constants (ACTIVE, REMOVED)

**No Functions** - Pure configuration file

---

### 01_Setup.js - System Initialization
**Purpose:** Setup system on first run and provide admin menu

**Functions:**
- `onOpen()` - Builds admin menu, initializes health banner on spreadsheet open
- `buildAdminMenu_()` - Creates "Poster System" menu with 13 admin actions
- `setupPosterSystem()` - Master setup function (sheets, form, triggers, boards, docs)
- `ensureTriggers_()` - Creates/repairs all triggers (form submit, sheet edit, timers)
- `ensureSheetSchemas_()` - Creates all required sheets with proper headers
- `applyAdminFormatting_()` - Applies formatting to admin sheets (bold headers, etc.)

---

### 02_Utils.js - Utility Functions
**Purpose:** Common helper functions used across all modules

**Functions:**
- `now_()` - Returns current Date object
- `fmtDate_(d, pattern)` - Format date with pattern (e.g., 'MM/dd/yyyy')
- `normalizeTitle_(s)` - Normalize title for comparison (lowercase, trim)
- `getProps_()` - Returns ScriptProperties service
- `readJsonProp_(key, fallback)` - Read JSON from ScriptProperties with fallback
- `writeJsonProp_(key, obj)` - Write object as JSON to ScriptProperties
- `ensureSheetWithHeaders_(ss, name, headers)` - Create sheet if missing, set headers
- `getSheet_(name)` - Get sheet by name from active spreadsheet
- `setCheckboxColumn_(sheet, col, startRow, numRows)` - Create checkbox data validation
- `getNonEmptyData_(sheet, minCols)` - Read all non-empty rows from sheet
- `safeArray_(v)` - Ensure value is array (handles string/null)
- `uuidPosterId_()` - Generate unique poster ID (UUID-like)
- `normalizeEmployeeName_(input)` - Validate and normalize name format (FirstName LastInitial)
- `getPostersWithLabels_()` - Fetch all posters with computed display labels (handles duplicates)
- `getActiveRequests_()` - Fetch all ACTIVE requests from Requests sheet

---

### 02A_CacheManager.js - Performance Caching
**Purpose:** TTL-based caching layer to reduce Google Sheets API quota usage

**Functions:**
- `getCacheTTL_()` - Returns cache TTL in milliseconds (from CONFIG.CACHE_TTL_MINUTES)
- `setCache_(key, value)` - Store value in cache with timestamp
- `getCache_(key)` - Retrieve value from cache (returns null if expired)
- `clearCache_(key)` - Delete specific cache entry
- `clearAllCaches_()` - Delete all cache entries (full invalidation)
- `countActiveSlots_Cached(empEmail)` - Cached version of countActiveSlotsByEmail_
- `invalidateEmployeeSlots_(empEmail)` - Invalidate slot count cache for employee
- `getPosterAvailability_Cached()` - Cached poster availability map
- `invalidatePosterAvailability_()` - Invalidate poster availability cache
- `getBoardMainData_Cached()` - Cached Main board data
- `invalidateBoardMain_()` - Invalidate Main board cache
- `getBoardEmployeesData_Cached()` - Cached Employees board data
- `invalidateBoardEmployees_()` - Invalidate Employees board cache
- `getActiveSubscriberEmails_Cached()` - Cached subscriber list
- `invalidateActiveSubscribers_()` - Invalidate subscriber cache
- `getPostersWithLabels_Cached()` - Cached poster list with labels
- `invalidatePostersWithLabels_()` - Invalidate poster list cache
- `getCacheStats_()` - Get cache statistics (keys, sizes, ages)
- `logCacheStats_()` - Log cache stats to Logger

---

### 03_FormManager.js - Google Form Management
**Purpose:** Create and manage Google Form structure

**Functions:**
- `getEffectiveFormId_()` - Get form ID from CONFIG or ScriptProperties
- `getOrCreateForm_()` - Create form if missing, return Form object
- `setCheckboxChoicesByTitle_(form, itemTitle, choices, required)` - Update checkbox field choices
- `ensureFormStructure_()` - Create/repair form fields (name, add, remove, subscribe)

---

### 04_SyncForm.js - Dynamic Form Syncing
**Purpose:** Keep form options synchronized with Movie Posters sheet

**Functions:**
- `syncPostersToForm()` - Main sync function (updates Add/Remove sections, label-to-ID mappings)

---

### 05_Ledger.js - Request Ledger Operations
**Purpose:** Query and manipulate Requests sheet (the audit trail)

**Functions:**
- `getRequestsSheet_()` - Get Requests sheet object
- `ensurePosterIds_()` - Generate missing poster IDs in Movie Posters sheet
- `hasEverRequestedByEmail_(empEmail, posterId)` - Check if employee ever requested poster (ignores status)
- `canRequestPoster_(empEmail, posterId)` - Check dedup rules (respects ALLOW_REREQUEST, COOLDOWN config)
- `countActiveSlotsByEmail_(empEmail)` - Count ACTIVE requests for employee
- `getPosterIdsWithAnyActiveRequests_()` - Get set of poster IDs with at least one ACTIVE request
- `setRequestStatusByEmail_(empEmail, posterId, newStatus, ts)` - Update request status
- `getActivePosterIdMap_()` - Get map of active poster IDs (from Movie Posters sheet)
- `lookupPosterInfoById_(posterId)` - Get poster title/release by ID
- `createLedgerRow_(empEmail, empName, posterId, requestTs)` - Append new ACTIVE request to ledger

---

### 06_SubmitHandler.js - Form Submission Processing
**Purpose:** Process Google Form submissions, validate, add/remove requests

**Functions:**
- `handleFormSubmit(e)` - Main form submission handler (triggered by form submit)
- `readFormAnswers_(e)` - Parse form response into structured object
- `processSubmission_(empEmail, empName, formTs, addLabels, removeLabels)` - Orchestrate removals + additions
- `processRemovals_(empEmail, removeLabels, decode)` - Process poster removals
- `processAdditions_(empEmail, empName, addLabels, decode, formTs)` - Process poster additions (dedup, slot limit checks)
- `appendRequestOrderLog_(o)` - Log submission to Request Order sheet
- `addSubscriber_(empEmail, empName)` - Add employee to Subscribers sheet

---

### 07_Boards.js - Board Generation
**Purpose:** Rebuild Main and Employees summary sheets from Requests ledger

**Functions:**
- `rebuildBoards()` - Rebuild both Main and Employees boards, sync employee view, refresh health banner
- `resetBoardArea_(sheet, colsToClear)` - Clear board area (break merges, remove formatting)
- `buildMainBoard_()` - Generate Main sheet (grouped by poster)
- `buildEmployeesBoard_()` - Generate Employees sheet (grouped by employee)
- `styleBoardHeaders_(sheet, mode)` - Apply header formatting (bold, background color)

---

### 08_Announcements.js - Email Notifications
**Purpose:** Queue and send announcement emails to subscribers

**Functions:**
- `handleSheetEdit(e)` - Detect Movie Posters or Inventory sheet edits, trigger syncs
- `processMoviePostersEdit_(e)` - Queue announcements when new posters activated
- `queueAnnouncement_(posterId, title, releaseDate)` - Add poster to announcement queue
- `previewPendingAnnouncement()` - Show preview dialog of queued announcements
- `sendAnnouncementNow()` - Force-send queued announcements immediately (bypasses 15-min timer)
- `processAnnouncementQueue(forceSend)` - Process queue (batched or individual emails)
- `getActiveSubscriberEmails_()` - Get list of subscriber emails (ACTIVE = true)
- `generateAnnouncementPreview_(queue, ids)` - Generate preview HTML for pending announcements
- `processBatchedAnnouncements_(queue, ids, recipients)` - Send batched email (multiple posters per email)
- `processIndividualAnnouncements_(queue, ids, recipients)` - Send individual emails (one poster per email)
- `substituteVariables_(template, variables)` - Replace {{VARIABLE}} placeholders in templates
- `formatPosterList_(queue, ids)` - Format poster list for email body
- `getStockInfo_(posterId)` - Get inventory count for poster
- `sendAnnouncementEmail_(recipients, subject, body)` - Send email to all recipients with retry
- `logAnnouncementEvent_(posterCount, recipientCount, status)` - Log announcement to Analytics sheet

---

### 09_PrintOutInventory.js - Print Layout & Inventory Sync
**Purpose:** Generate print-friendly inventory list and sync inventory counts

**Functions:**
- `updateInventoryLastUpdated_()` - Update "Last Updated" timestamp on Inventory sheet
- `syncInventoryCountsToMoviePosters_()` - Sync poster counts from Inventory to Movie Posters sheet
- `refreshPrintOut()` - Rebuild Print Out sheet layout (called when inventory or posters change)

---

### 10_Documentation.js - Auto-Generated Documentation
**Purpose:** Generate employee and admin guides in Documentation sheet

**Functions:**
- `buildDocumentationTab()` - Generate full documentation (system rules, employee guide, admin guide)
- `writeDocTitle_(sh, r, text)` - Write title row (bold, large font)
- `writeDocPara_(sh, r, text)` - Write paragraph row
- `writeDocSection_(sh, r, title, bullets)` - Write section with title + bullet list
- `getDedupSummary_()` - Generate dedup rule summary (short version)
- `getDedupRuleDescription_()` - Generate detailed dedup rule description (based on config flags)

---

### 11_CustomAnnouncements.js - Custom Admin Messages
**Purpose:** Allow admin to send custom messages to subscribers

**Functions:**
- `queueCustomAnnouncement()` - Show dialog to queue custom announcement
- `sendCustomAnnouncementNow()` - Force-send custom announcement immediately
- `previewCustomAnnouncementQueue()` - Show preview of custom announcement queue
- `processCustomAnnouncementQueue(forceSend)` - Process custom announcement queue
- `substituteCustomVariables_(body, formUrl)` - Replace {{FORM_LINK}} and {{DATE}} in custom messages

---

### 12_PrintSelection.js - Print Area Utilities
**Purpose:** Prepare print area and generate QR codes

**Functions:**
- `prepareAndSelectPrintArea()` - Build print layout, select print area, open print dialog
- `buildPrintOutLayout_()` - Generate Print Out sheet with QR codes and inventory list
- `insertFloatingQrQuickchart_(sheet, text, col, row, sizePx)` - Insert QR code image via QuickChart API
- `removeAllFloatingImages_(sheet)` - Remove all floating images from sheet (prevents duplicates)

---

### 13_EmployeeViewSync.js - Employee View Spreadsheet
**Purpose:** Sync Employees board to separate read-only spreadsheet

**Functions:**
- `syncEmployeeViewSpreadsheet_()` - Copy Employees sheet to employee view spreadsheet
- `setupEmployeeViewSpreadsheet()` - Create employee view spreadsheet (one-time setup)
- `openEmployeeViewSpreadsheet()` - Show dialog with link to employee view spreadsheet
- `getEmployeeViewEmployeesUrl_()` - Get URL to Employees tab in employee view spreadsheet
- `getEmployeeViewSpreadsheet_()` - Get employee view spreadsheet object (throws if missing)
- `getOrCreateEmployeeViewSpreadsheet_()` - Create employee view spreadsheet if missing

---

### 14_ManualRequestEntry.js - Historical Request Migration
**Purpose:** Manually add historical requests for data migration

**Functions:**
- `showManualRequestDialog()` - Show dialog for manual request entry
- `getActivePostersForManualEntry()` - Get list of active posters for dropdown (called by dialog)
- `addManualRequest(empEmail, empName, posterId, customTimestamp)` - Add historical request with custom timestamp

---

### 15_DataIntegrity.js - Data Validation & Repair
**Purpose:** Detect and auto-repair data integrity issues

**Functions:**
- `ensureDataIntegritySheet_()` - Create Data Integrity sheet if missing
- `runFullIntegrityCheck_()` - Run all integrity checks (orphans, over-capacity, duplicates, invalid emails, inconsistent state, missing poster IDs)
- `checkForOrphanedRequests_()` - Check for ACTIVE requests with deleted posters (auto-repair: mark REMOVED)
- `checkForOverCapacity_()` - Check for employees over MAX_ACTIVE limit (auto-repair: mark excess as REMOVED_OVER_CAPACITY)
- `checkForDuplicates_()` - Check for duplicate ACTIVE requests (auto-repair: mark duplicates as REMOVED_DUPLICATE)
- `checkInvalidEmails_()` - Check for invalid subscriber emails (no auto-repair)
- `checkInconsistentState_()` - Check for requests with invalid status values (no auto-repair)
- `checkMissingPosterIds_()` - Check for requests with missing/invalid poster IDs (no auto-repair)
- `logIntegrityCheck_(result)` - Log integrity check result to Data Integrity sheet
- `isValidEmail_(email)` - Validate email format (basic regex)
- `generateDataIntegrityReport_()` - Generate summary report of all integrity checks

---

### 16_AdminHealthBanner.js - System Health Metrics
**Purpose:** Display real-time system health metrics on Main sheet

**Functions:**
- `getTriggerHealth_()` - Check if all required triggers are installed
- `getCacheHealth_()` - Get cache statistics (hit rate, keys, sizes)
- `getLastErrorInfo_()` - Get most recent error from Error Log sheet
- `getAnnouncementQueueInfo_()` - Get pending announcement count
- `collectHealthData_()` - Collect all health metrics into object
- `renderHealthBanner_()` - Render health banner on Main sheet (row 1)
- `refreshHealthBanner()` - Refresh health banner (callable from admin menu)
- `initializeHealthBanner_()` - Initialize health banner on first setup

---

### 16_BackupManager.js - Automated Backups
**Purpose:** Nightly backups of critical sheets to Google Drive

**Functions:**
- `performNightlyBackup()` - Main backup function (triggered at 2 AM nightly)
- `backupSheet_(sheetName, folderId, timestamp)` - Backup single sheet as CSV or Google Sheet
- `convertToCsv_(data)` - Convert 2D array to CSV string
- `ensureBackupFolder_()` - Create backup folder in Google Drive (one-time setup)
- `applyRetentionPolicy_(folderId)` - Delete backups older than RETENTION_DAYS
- `logBackupEvent_(details)` - Log backup event to Analytics sheet
- `manualBackupTrigger()` - Manual backup trigger (callable from admin menu)

---

### 16_BulkSimulator.js - Load Testing
**Purpose:** Stress-test system with randomized bulk submissions

**Functions:**
- `generateTestEmployee_(index)` - Generate test employee (name + email)
- `generateRandomSubmissionData_(empEmail, activePosters)` - Generate random add/remove lists
- `getActiveRequestsForEmployee_(empEmail)` - Get employee's current ACTIVE requests
- `simulateSingleSubmission_(empEmail, empName, addLabels, removeLabels, dryRun)` - Simulate one submission
- `runBulkSimulator(N, dryRun)` - Run N simulations (dry-run or live)
- `showBulkSimulatorDialog()` - Show dialog for bulk simulator input

---

### 99_BackupTests.js - Backup Testing Suite
**Purpose:** Manual test functions for backup system

**Functions:**
- `testCsvConversion()` - Test CSV conversion function
- `testBackupFolderCreation()` - Test backup folder creation
- `testSingleSheetBackupCsv()` - Test single sheet backup (CSV format)
- `testSingleSheetBackupSheet()` - Test single sheet backup (Google Sheet format)
- `testRetentionPolicy()` - Test retention policy (delete old backups)
- `testFullBackup()` - Test full backup (all sheets)
- `runAllBackupTests()` - Run all backup tests

---

### 99_Debuging.js - Debug & Repair Utilities
**Purpose:** Manual debug and repair functions for admins

**Functions:**
- `debugFormAndLinks()` - Log form ID and links (for troubleshooting)
- `resetAllTriggers()` - Delete and recreate all triggers
- `testDedupConfig()` - Test deduplication config flags (ALLOW_REREQUEST, COOLDOWN)
- `cleanupInvalidNamesAndOverCap_()` - Clean up invalid names, duplicates, over-capacity requests

---

### 99_ErrorHandler.js - Error Handling Framework
**Purpose:** Centralized error logging and admin notifications

**Functions:**
- `ensureErrorTrackingSheet_()` - Create Error Log sheet if missing
- `logError_(error, functionName, context)` - Log error to Error Log sheet with full context
- `notifyAdminOfError_(error, functionName, severity)` - Send email to admin for CRITICAL errors
- `retryWithBackoff_(fn, maxAttempts, initialDelayMs)` - Retry function with exponential backoff
- `isTransientError_(error)` - Detect transient errors (lock timeout, rate limit, service unavailable)
- `safeFormOperation_(fn, operationName)` - Wrap form operation with error handling
- `safeSheetOperation_(fn, operationName)` - Wrap sheet operation with error handling
- `getAdminEmail_()` - Get admin email from CONFIG or spreadsheet owner
- `cleanupErrorLog_()` - Archive old errors (older than 90 days)

---

## Key Architectural Patterns

### Configuration-Driven Design
All settings in `00_Config.js` under `CONFIG` object. Never hardcode values in code.

### Ledger-Based Audit Trail
All requests stored in Requests sheet with status (ACTIVE/REMOVED). Boards computed from ledger. Never delete requests.

### Lock-Based Concurrency
All sheet operations wrapped in 30-second locks. No parallel operations on sheets.

### TTL-Based Caching
Expensive queries cached for 5 minutes. Cache invalidated on sheet edits.

### Status-Based Filtering
Requests have STATUS column (ACTIVE/REMOVED). Filter by status for queries, never delete rows.

### Deduplication by Email+Poster
Each employee can request each poster once (historically). Check via `canRequestPoster_()` or `hasEverRequestedByEmail_()`.

### Form Response Snapshots
TITLE_SNAP and RELEASE_SNAP preserve poster state at request time (handles renames/deactivations).

### Template-Based Emails
Email templates use {{VARIABLE}} placeholders. Substitute with `substituteVariables_()`.

### Event-Driven Triggers
Form submissions, sheet edits, and timers trigger automated workflows. Triggers created by `ensureTriggers_()`.

---

## Testing Checklist

Before deploying changes, verify:

1. ✅ Multiple employees can request same poster (both ACTIVE)
2. ✅ Single employee cannot request same poster twice (if ALLOW_REREQUEST=false)
3. ✅ Inventory counts never block requests
4. ✅ MAX_ACTIVE enforced per employee (8th request denied)
5. ✅ Boards rebuild after form submit
6. ✅ Form options update after Movie Posters sheet change
7. ✅ Announcements batch correctly (5 posters per email)
8. ✅ Analytics logs all events
9. ✅ Error paths logged to ERROR_LOG
10. ✅ Backups run nightly without errors
11. ✅ Health banner displays accurate metrics

---

## Quick Reference Commands

### Admin Menu Actions
- **Prepare Print Area** → `prepareAndSelectPrintArea()`
- **Run Setup / Repair** → `setupPosterSystem()`
- **Refresh Health Banner** → `refreshHealthBanner()`
- **Sync Form Options** → `syncPostersToForm()`
- **Rebuild Boards** → `rebuildBoards()`
- **Run Bulk Simulator** → `showBulkSimulatorDialog()`
- **Run Backup Now** → `manualBackupTrigger()`

### Common Debug Commands
- **Debug Form & Links** → `debugFormAndLinks()`
- **Reset All Triggers** → `resetAllTriggers()`
- **Test Dedup Config** → `testDedupConfig()`
- **Cleanup Invalid Data** → `cleanupInvalidNamesAndOverCap_()`
- **Run Integrity Check** → `runFullIntegrityCheck_()`

---

**Generated:** January 23, 2026  
**System Version:** Beta-1.01  
**Total Modules:** 20 core modules + 3 test modules  
**Total Functions:** 172 documented functions
