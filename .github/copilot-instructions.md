# Copilot Instructions: Movie Poster Request System

## Project Overview
Google Apps Script system for employee poster requests with strict slot limits (7), deduplication, auditability, batching announcements, backups, and automation across Sheets/Forms.

**Tech Stack:** GAS (V8), Google Forms/Sheets, ScriptProperties, MailApp/GmailApp, DriveApp, UrlFetchApp (QuickChart)

---

## Architecture Essentials

### Feature Highlights (from notes)
- Announcement batching/templates/dry-run with throttled retries; variables {{TITLE}}, {{RELEASE}}, {{STOCK}}, {{ACTIVE_COUNT}}, {{FORM_LINK}}, {{COUNT}}, {{POSTER_LIST}}. Defaults: batching on, size 5, 1s throttle, 3 retries.
- Nightly backups 2am to Drive folder (CSV or Sheet), 30-day retention, manual trigger available; log to Analytics/Error Log.
- Bulk submission simulator (up to 100, warning ≥50 live) with dry-run, logs execution time/sheet reads/cache hits/lock waits to Analytics.
- UI/UX: admin menu grouped (Reports/Print & Layout/Announcements/Advanced) plus Refresh All; frozen headers removed; Requests/Request Order hidden by default; Print Out auto-formats with QR.

### Module Organization
Core modules (no longer numbered, organized alphabetically):
- **Config.js** - Central configuration (CONFIG object, column mappings, sheet references)
- **Setup.js** - Initialization, admin menu, triggers, deferred refresh
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
- **Boards.js** - Main and Employees board generation from ledger (with Admin Notes column persistence)
- **PrintOut.js** - Print layout generation, inventory syncing, QR code generation
- **Documentation.js** - Auto-generated system documentation sheet
- **EmployeeViewSync.js** - Sync to separate employee-facing spreadsheet
- **Announcements.js** - Email queue processing (batched notifications)
- **PosterDisplay.js** - Display management for Poster Outside/Inside tabs
- **ManualRequest.js** - Historical request entry dialog
- **ManualPoster.js** - Manual poster entry dialog
- **RefreshManager.js** - Refresh coordination and deferred refresh execution
- **UISpinner.js** - Non-blocking CSS spinner UI for long operations (NEW in v2.0)

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

### Operational Defaults
- ANNOUNCEMENT: batching enabled (size 5), throttle 1s, 3 retries with backoff; preview available.
- BACKUP: nightly 2am, 30-day retention, CSV default, dedicated Drive folder, manual "Run Backup Now".
- BULK_SIMULATOR: max 100 runs, warn ≥50 live, dry-run default; metrics logged to Analytics.
- CACHE TTL: CONFIG.CACHE_TTL_MINUTES (invalidate after writes to related data).

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
- **Config → All modules** - Config.js provides global settings
- **Ledger → Boards** - Ledger.js queries → Boards.js visualizes
- **Form changes → Boards** - FormSync.js updates form → FormSubmit.js processes → Boards.js rebuilds
- **Sheet edits → Triggers** - Announcements.js listens to INVENTORY sheet edits → syncs form, rebuilds boards, refreshes print
- **Analytics logging** - Analytics.js logs all events (submissions, rebuilds, anomalies)

### Stored Data (ScriptProperties)
```javascript
// Persistent cache/mapping data:
LABEL_TO_ID        // Poster title → Poster ID
ID_TO_CURRENT_LABEL // Poster ID → current title (handles name changes)
ANNOUNCEMENT_QUEUE  // JSON array of pending announcements
```

---

## Common Workflows & Commands

### Adding a New Feature
1. Create new file with descriptive name (e.g., `FeatureName.js`)
2. Define config in `Config.js` if needed
3. Add menu item in `Setup.js` buildAdminMenu_()
4. Hook into appropriate trigger (form submit, sheet edit, timer)
5. Follow error handling + caching patterns above
6. Test with manual submissions before production

### Debugging & Testing
- **Manual Testing:** Use `prepareAndSelectPrintArea()` → submit test form → check boards
- **Bulk Testing:** Run `showBulkSimulatorDialog()` to stress-test with N submissions
- **Log Inspection:** Extensions → Apps Script → Logs
- **Data Inspection:** Check Requests sheet (ledger), REQUEST_ORDER sheet (submission history)
- **Analytics:** Check Analytics + Analytics Summary sheets for performance metrics
- **Admin Menu Map:** Reports (boards/form/docs), Print & Layout (print area/print out), Announcements (preview/send), Advanced (manual add, bulk sim, backup, employee view, show link) plus top-level Refresh All.

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

---

## Key Files to Read First

For understanding the system:
1. **Config.js** - All settings and column mappings
2. **README.md** - Full architecture overview
3. **Ledger.js** + **FormSubmit.js** - Core request logic
4. **Boards.js** - How requests become visualizations and admin notes persistence
5. **UISpinner.js** - Non-blocking spinner UI implementation

---

## When Adding Code
- Always use `CONFIG.*` for settings, never hardcode
- Always use `COLS.*` for sheet column references
- Wrap sheet ops in locks: `lock.waitLock(30000); try { ... } finally { lock.releaseLock(); }`
- Log important steps: `Logger.log('[functionName] message');`
- Use `logError_()` for exceptions, not `console.error()`
- Cache expensive queries with `setCache_()` / `getCache_()`
- Invalidate related caches on writes: `invalidateCachesAfterWrite_('key')`
