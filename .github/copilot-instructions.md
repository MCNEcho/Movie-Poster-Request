# Copilot Instructions: Movie Poster Request System

## Project Overview
Google Apps Script system for employee poster requests with strict slot limits (7), auditability, announcements, backups, and automation across Sheets/Forms. Inventory is the canonical poster source; the Movie Posters sheet is deprecated.

**Tech Stack:** GAS (V8), Google Forms/Sheets, ScriptProperties, MailApp/GmailApp, DriveApp, UrlFetchApp (QuickChart)

---

## Architecture Essentials

### Feature Highlights
- Announcement templates and dry-run preview with variables {{TITLE}}, {{RELEASE}}, {{STOCK}}, {{ACTIVE_COUNT}}, {{FORM_LINK}}, {{COUNT}}, {{POSTER_LIST}}. When batching is enabled and multiple posters are queued, a single email is sent with the batch template.
- Nightly backups at 2am to Drive folder (CSV or Sheet), 30-day retention, manual trigger available; logged to Analytics and Error Log on failure.
- Refresh Manager dialog consolidates board rebuilds, form sync, Print Out refresh, and display dropdown refresh.
- UI/UX: admin menu with an Advanced submenu; frozen headers removed; internal audit sheets hidden; Print Out layout includes QR codes.

### Module Organization
- **Config.js** - Central configuration (CONFIG object, column mappings, sheet references)
- **Setup.js** - Initialization, admin menu, triggers
- **Utils.js** - Sheet operations, poster fetching, name validation
- **CacheManager.js** - TTL-based caching layer to reduce sheet quota usage
- **ErrorHandler.js** - Centralized error logging and admin notifications
- **FormManager.js** - Google Form creation and field setup
- **FormSync.js** - Dynamic form option updates from Inventory sheet
- **FormSubmit.js** - Form submission processing, validation, additions/removals
- **Ledger.js** - Request ledger queries (counting, checking duplicates)
- **Analytics.js** - Analytics tracking and logging
- **DataIntegrity.js** - Data validation and auto-repair (orphaned requests, duplicates)
- **BackupManager.js** - Nightly backups to Google Drive with retention
- **Boards.js** - Main and Employees board generation from ledger
- **PrintOut.js** - Print layout generation, inventory syncing, QR codes
- **Documentation.js** - Auto-generated system documentation sheet
- **EmployeeViewSync.js** - Sync to separate employee-facing spreadsheet
- **Announcements.js** - Email queue processing (batched notifications)
- **ManualRequest.js** - Historical request migration dialog
- **ManualPoster.js** - Manual poster addition dialog
- **PosterDisplay.js** - Poster Outside/Inside display management
- **RefreshManager.js** - Consolidated refresh operations dialog
- **BackupTest.js** - Backup testing suite
- **Debug.js** - Cleanup and repair utilities

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
3. **Inventory Is Canonical:** Inventory sheet drives poster data and form options; Movie Posters sheet is deprecated
4. **Per-Employee Slot Limit:** MAX_ACTIVE (7) limits each employee, NOT per-poster quantities
5. **Dedup by Email+Poster:** Blocks only if an ACTIVE request exists; historical requests can be allowed by config with optional cooldown
6. **Lock-Based Concurrency:** 30-second lock on all sheet operations; no async parallelization

### Operational Defaults
- ANNOUNCEMENT: batching enabled; throttling and retry settings in CONFIG.ANNOUNCEMENT; preview available.
- BACKUP: nightly 2am, 30-day retention, CSV default, dedicated Drive folder, manual "Run Backup Now".
- BULK_SIMULATOR: max 100 runs, warn at 50+, dry-run default; metrics logged to Analytics (when simulator is used).
- CACHE TTL: CONFIG.CACHE_TTL_MINUTES (invalidate related caches after writes).

---

## Essential Patterns & Conventions

### Configuration Pattern
All settings in `Config.js` under `CONFIG` object:
```javascript
// Access: CONFIG.MAX_ACTIVE (7), CONFIG.SHEETS.REQUESTS, CONFIG.PROPS.LABEL_TO_ID
// Edit here, not in code - enables non-technical admin changes
```

### Column Reference Pattern
```javascript
// Instead of magic numbers, use COLS
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

### Caching Pattern
```javascript
// Expensive queries cached with TTL:
countActiveSlots_Cached(email)  // Uses cache
// Invalidated on writes: invalidateCachesAfterWrite_({ empEmail })
```

### Error Handling Pattern
```javascript
// Use centralized error logger, not console.error
logError_(error, 'functionName', { contextKey: 'value' });
// Logs to ERROR_LOG sheet; notifyAdminOfError_ handles CRITICAL alerts
```

### Dedup Logic Pattern
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
- **Config → All modules** - Config provides global settings
- **Ledger → Boards** - Ledger queries → Boards visualizes
- **Form changes → Boards** - FormSync updates form → FormSubmit processes → Boards rebuilds
- **Sheet edits → Triggers** - Announcements listens to Inventory edits → syncs form, rebuilds boards
- **Analytics logging** - Analytics logs key events (submissions, backups, anomalies)

### Stored Data (ScriptProperties)
```javascript
// Persistent cache/mapping data:
FORM_ID            // Stored form ID when auto-creating
EMPLOYEE_VIEW_SSID // Employee view spreadsheet ID
LABEL_TO_ID        // Poster title → Poster ID
ID_TO_CURRENT_LABEL // Poster ID → current title (handles name changes)
INVENTORY_SNAPSHOT  // Inventory snapshot for delete detection
ANNOUNCE_QUEUE      // Pending announcement queue
ANNOUNCED_IDS       // Already-announced poster IDs
CUSTOM_ANNOUNCE_QUEUE // Optional custom queue
BACKUP_FOLDER_ID    // Drive folder id for backups
```

---

## Common Workflows & Commands

### Adding a New Feature
1. Create new file with descriptive name (e.g., `FeatureName.js`)
2. Define config in `Config.js` if needed
3. Add menu item in `Setup.js` buildAdminMenu_()
4. Hook into appropriate trigger (form submit, sheet edit, timer)
5. Follow error handling + caching patterns above
6. Test with Bulk Simulator (BackupTest.js) before production

### Debugging & Testing
- **Manual Testing:** Check Print Out → submit test form → check boards
- **Log Inspection:** Extensions → Apps Script → Logs
- **Data Inspection:** Check Requests sheet (ledger), Request Order sheet (submission history)
- **Analytics:** Check Analytics + Analytics Summary sheets for performance metrics
- **Admin Menu Map:** Poster Request System → Add New Poster; Advanced → Refresh Manager, Employee View Manager, Manually Add Request; Reports (Rebuild Boards, Sync Form Options, Refresh Documentation); Announcements (Preview Pending, Send Now); Display Management; System (Run Setup / Repair, Create Triggers, Run Backup Now).

### Fixing Broken State
- **One-click repair:** "Run Setup / Repair" in System submenu
- **Manual data fix:** "Manually Add Request" for migration/corrections
- **Full rebuild:** setupPosterSystem() recreates all sheets, triggers, form options
- **Data integrity:** runFullIntegrityCheck_() detects & auto-repairs orphaned/duplicate requests

---

## Critical Gotchas & Non-Standard Patterns

⚠️ **Dedup is per-employee-per-poster, NOT per-poster total:** Multiple employees CAN request same poster; one employee CANNOT request same poster twice while ACTIVE (re-requests allowed only when config permits, optionally with cooldown).

⚠️ **Inventory never blocks:** INVENTORY sheet is canonical for poster metadata and form options, but stock counts are advisory only. The form always accepts requests regardless of current inventory levels.

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
- [ ] Form options update after Inventory sheet change
- [ ] Announcements batch correctly (multiple new posters → single email)
- [ ] Analytics logs all events (check Analytics sheet)
- [ ] Error paths logged to ERROR_LOG sheet
- [ ] Backups run nightly without errors
- [ ] Health banner displays accurate cache hit rate + execution times

---

## Key Files to Read First

For understanding the system:
1. **Config.js** - All settings and column mappings
2. **Guides/README.md** - Documentation index
3. **Ledger.js** + **FormSubmit.js** - Core request logic
4. **Boards.js** - How requests become visualizations
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
