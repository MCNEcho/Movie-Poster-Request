# Copilot Instructions: Movie Poster Request System

## Project Overview
A **Google Apps Script** system that manages employee poster requests with strict validation, audit logging, and automated workflows. Built to prevent abuse (unlimited requests, duplicates) through per-employee slot limits (7 posters max) and deduplication rules.

**Tech Stack:** Google Apps Script (V8 runtime), Google Forms, Google Sheets, ScriptProperties, Mail API, QuickChart API

---

## Architecture Essentials

### Module Organization (Numbered Files = Execution Order)
- **00_Config.js** - Central configuration (CONFIG object, column mappings, sheet references)
- **01_Setup.js** - Initialization, admin menu, triggers, health banner
- **02_Utils.js** - Sheet operations, poster fetching, name validation
- **02A_CacheManager.js** - TTL-based caching layer to reduce sheet quota usage
- **03_ErrorHandler.js** - Centralized error logging and admin notifications
- **04_FormManager.js** - Google Form creation and field setup
- **05_SyncForm.js** - Dynamic form option updates from Movie Posters sheet
- **06_SubmitHandler.js** - Form submission processing, validation, additions/removals
- **07_Ledger.js** - Request ledger queries (counting, checking duplicates)
- **08_Analytics.js** - Analytics tracking and logging
- **09_DataIntegrity.js** - Data validation and auto-repair (orphaned requests, duplicates)
- **10_BackupManager.js** - Nightly backups to Google Drive with retention
- **11_Boards.js** - Main and Employees board generation from ledger
- **12_PrintSelection.js** - Print area selection utilities
- **13_PrintOutInventory.js** - Print layout generation, inventory syncing
- **14_Documentation.js** - Auto-generated system documentation sheet
- **15_EmployeeViewSync.js** - Sync to separate employee-facing spreadsheet
- **16_AdminHealthBanner.js** - System health metrics display
- **17_Announcements.js** - Email queue processing (batched notifications)
- **18_CustomAnnouncements.js** - Admin custom message handler
- **19_ManualRequestEntry.js** - Historical request migration dialog
- **20_BulkSimulator.js** - Stress test with randomized submissions
- **99_BackupTests.js** - Backup testing suite
- **99_Debuging.js** - Cleanup and repair utilities

### Critical Data Flow
```
Google Form Submission
  ↓ (handleFormSubmit)
Parse answers → Validate name → Process removals → Process additions
  ↓
Update Requests sheet (ledger)
  ↓
Rebuild boards → Sync form options
  ↓
Queue announcements (if new poster activated)
```

### Key Architectural Decisions
1. **Ledger-Based Design:** All requests stored in Requests sheet (audit trail), boards computed from it
2. **Status-Based Filtering:** Requests marked ACTIVE/REMOVED (never deleted), enables historical queries
3. **Inventory ≠ Constraint:** Inventory sheet is informational only; never blocks requests
4. **Per-Employee Slot Limit:** MAX_ACTIVE (7) limits each employee, NOT per-poster quantities
5. **Dedup by Email+Poster:** Each employee can request each poster once (historical block)
6. **Lock-Based Concurrency:** 30-second lock on all sheet operations; no async parallelization

---

## Essential Patterns & Conventions

### Configuration Pattern
All settings in `00_Config.js` under `CONFIG` object:
```javascript
// Access: CONFIG.MAX_ACTIVE (7), CONFIG.SHEETS.REQUESTS, CONFIG.PROPS.LABEL_TO_ID
// Edit here, not in code - enables non-technical admin changes
```

### Column Reference Pattern
```javascript
// Instead of magic numbers, use CONFIG.COLS
const email = r[COLS.REQUESTS.EMP_EMAIL - 1];  // 1-indexed columns
const status = r[COLS.REQUESTS.STATUS - 1];
// COLS object maps sheet → column indices
```

### Sheet Operation Pattern
```javascript
const lock = LockService.getScriptLock();
lock.waitLock(30000);
try {
  // Sheet operations here
} finally {
  lock.releaseLock();
}
```

### Caching Pattern (Task 2)
```javascript
// Expensive queries cached with TTL:
countActiveSlots_Cached_(email)  // Uses cache
// Invalidated on sheet edits: invalidateCachesAfterWrite_('poster')
```

### Error Handling Pattern (Task 1)
```javascript
// Use centralized error logger, not console.error
logError_(error, 'functionName', 'context', 'CRITICAL|MEDIUM|LOW');
// Logs to ERROR_LOG sheet + notifies admin if CRITICAL
```

### Dedup Logic Pattern (CRITICAL)
```javascript
// Email + Poster combo check (prevent same employee requesting same poster twice)
const canRequest = canRequestPoster_(empEmail, posterId);
if (!canRequest.allowed) {
  // Deny with reason: 'duplicate (already active)', 'duplicate (historical)', 'duplicate (cooldown)'
}
```

---

## Integration Points

### External Dependencies
- **Google Forms API** - Read/write form items, responses
- **Google Sheets API** - CRUD operations on 12+ sheets
- **Google Mail API** - Send announcements (batched every 15 min)
- **Google Drive API** - Create backup folder, store CSV/Sheet backups
- **QuickChart API** - Generate QR codes (form link, employee view link)

### Data Flow Between Modules
- **Config → All modules** - 00_Config provides global settings
- **Ledger → Boards** - 07_Ledger.js queries → 11_Boards.js visualizes
- **Form changes → Boards** - 05_SyncForm updates form → 06_SubmitHandler processes → 11_Boards rebuilds
- **Sheet edits → Triggers** - 17_Announcements.js listens to MOVIE_POSTERS sheet edits → syncs form, rebuilds boards, refreshes print
- **Analytics logging** - 08_Analytics.js logs all events (submissions, rebuilds, anomalies)

### Stored Data (ScriptProperties)
```javascript
// Persistent cache/mapping data:
LABEL_TO_ID        // Poster title → Poster ID
ID_TO_CURRENT_LABEL // Poster ID → current title (handles name changes)
ANNOUNCEMENT_QUEUE  // JSON array of pending announcements
HEALTH_BANNER_DATA  // System metrics (execution times, cache stats)
```

---

## Common Workflows & Commands

### Adding a New Feature
1. Create new file with `XX_FeatureName.js` (follow numbering)
2. Define config in `00_Config.js` if needed
3. Add menu item in `01_Setup.js` buildAdminMenu_()
4. Hook into appropriate trigger (form submit, sheet edit, timer)
5. Follow error handling + caching patterns above
6. Test with Bulk Simulator (20_BulkSimulator.js) before production

### Debugging & Testing
- **Manual Testing:** Use `prepareAndSelectPrintArea()` → submit test form → check boards
- **Bulk Testing:** Run `showBulkSimulatorDialog()` to stress-test with N submissions
- **Log Inspection:** Extensions → Apps Script → Logs
- **Data Inspection:** Check Requests sheet (ledger), REQUEST_ORDER sheet (submission history)
- **Analytics:** Check Analytics + Analytics Summary sheets for performance metrics

### Fixing Broken State
- **One-click repair:** "Run Setup / Repair" button in admin menu
- **Manual data fix:** "Manually Add Request" for migration/corrections
- **Full rebuild:** setupPosterSystem() recreates all sheets, triggers, form options
- **Data integrity:** runFullIntegrityCheck_() detects & auto-repairs orphaned/duplicate requests

---

## Critical Gotchas & Non-Standard Patterns

⚠️ **Dedup is per-employee-per-poster, NOT per-poster total:** Multiple employees CAN request same poster; one employee CANNOT request same poster twice (unless ALLOW_REREQUEST_AFTER_REMOVAL=true).

⚠️ **Inventory never blocks:** INVENTORY sheet is FYI only. Form always accepts requests regardless of stock count.

⚠️ **Column indices are 1-based:** `COLS.REQUESTS.EMAIL = 2` means column B in Sheets, but `r[COLS.REQUESTS.EMAIL - 1]` when reading arrays (0-indexed).

⚠️ **Status not deleted:** Removed requests marked STATUS='REMOVED', never deleted. Enables historical queries & audits.

⚠️ **Form responses are snapshots:** TITLE_SNAP and RELEASE_SNAP preserve poster state at request time (handles renames/deactivations).

⚠️ **Lock timeout is 30 seconds:** All sheet operations must complete in 30s. Cache misses + slow queries risk timeouts.

---

## Testing Checklist Before Merge

- [ ] Multiple employees can request same poster (both ACTIVE)
- [ ] Single employee cannot request same poster twice (if ALLOW_REREQUEST_AFTER_REMOVAL=false)
- [ ] Inventory counts never block requests (test with 1 poster, 10 requests)
- [ ] MAX_ACTIVE enforced per employee (test 8th request denied with "limit (7-slot)")
- [ ] Boards rebuild automatically after form submit
- [ ] Form options update after MOVIE_POSTERS sheet change
- [ ] Announcements batch correctly (multiple new posters → single email)
- [ ] Analytics logs all events (check Analytics sheet)
- [ ] Error paths logged to ERROR_LOG sheet
- [ ] Backups run nightly without errors
- [ ] Health banner displays accurate cache hit rate + execution times

---

## Key Files to Read First

For understanding the system:
1. **00_Config.js** - All settings and column mappings
2. **PROJECT_DOCUMENTATION.txt** - Full architecture & rationale
3. **07_Ledger.js** + **06_SubmitHandler.js** - Core request logic
4. **11_Boards.js** - How requests become visualizations
5. **Issue #19** - Known bugs, redundancies, and refactor opportunities

---

## When Adding Code
- Always use `CONFIG.*` for settings, never hardcode
- Always use `COLS.*` for sheet column references
- Wrap sheet ops in locks: `lock.waitLock(30000); try { ... } finally { lock.releaseLock(); }`
- Log important steps: `Logger.log('[functionName] message');`
- Use `logError_()` for exceptions, not `console.error()`
- Cache expensive queries with `setCache_()` / `getCache_()`
- Invalidate related caches on writes: `invalidateCachesAfterWrite_('key')`
