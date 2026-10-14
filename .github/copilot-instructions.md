# Copilot Instructions: Movie Poster Request System

## Project Overview
Google Apps Script system for employee poster requests with strict slot limits, deduplication, auditability, backups, and automation across Sheets/Forms.

**Tech Stack:** GAS (V8), Google Forms/Sheets, ScriptProperties, GmailApp (critical admin error alerts), DriveApp, UrlFetchApp (QuickChart)

---

## Architecture Essentials

### Feature Highlights (from notes)
- **Notes Feature:** Form includes optional notes field for each configured poster slot; notes stored in REQUESTS column 12, displayed in Main/Employees boards column C; ManualRequest supports notes with auto-population for customers ("Customer: [phone]").
- **Form Sync:** Hash `{add, remove, slots}` and skip unchanged writes. Read Form questions once; compare choice arrays and update only changed dropdowns. Setup creates missing items but does not reset existing choices.
- Nightly backups 2am to Drive folder (CSV or Sheet), 7-day retention, manual trigger available; log to Analytics/Error Log.
- Theater display management: "Poster Outside" and "Poster Inside" tabs with dynamic dropdowns for tracking display locations.
- UI/UX: admin menu grouped (Reports/Display Management/System) plus refresh tools; frozen headers removed; Requests/Request Order hidden by default; Print Out auto-formats with QR.

### Module Organization (CamelCase files)
- **Config.js** - Central configuration (CONFIG object, column mappings, sheet references)
- **Setup.js** - Initialization, admin menu, triggers, health banner
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
- **BackupTest.js** - Backup testing suite
- **Boards.js** - Main and Employees board generation from ledger
- **PrintOut.js** - Print layout generation, inventory syncing
- **Documentation.js** - Auto-generated system documentation sheet
- **EmployeeViewSync.js** - Sync to separate employee-facing spreadsheet
- **RefreshManager.js** - Consolidated refresh operations UI and management
- **ManualRequest.js** - Historical request migration dialog with notes support (auto-populates "Customer: [phone]" for customer requests)
- **ManualPoster.js** - Admin dialog for manually adding new posters to Inventory sheet
- **PosterDisplay.js** - Display management for "Poster Outside" and "Poster Inside" tabs (theater display tracking)
- **InventoryCleanup.js** - Handles inventory edits, removal detection, and data cleanup
- **Debug.js** - Cleanup and repair utilities

### Critical Data Flow
```
Google Form Submission
  ↓ (handleFormSubmit)
Parse answers → Validate name → Extract notes → Process removals → Process additions
  ↓
Update Requests sheet (ledger with notes in col 12)
  ↓
Rebuild boards (display notes in col C) → Sync form options
```

### Key Architectural Decisions
1. **Ledger-Based Design:** All requests stored in Requests sheet (audit trail), boards computed from it
2. **Status-Based Filtering:** Requests marked ACTIVE/REMOVED (never deleted), enables historical queries
3. **Inventory is Primary:** INVENTORY sheet is the canonical source for poster data.
4. **Inventory ≠ Constraint:** Inventory sheet is informational only; never blocks requests
5. **Per-Employee Slot Limit:** MAX_ACTIVE (10) limits each employee, NOT per-poster quantities
6. **Dedup by Email+Poster:** Active duplicates are blocked; historical re-requests follow the configured allow/cooldown settings.
7. **Lock-Based Concurrency:** Use the script lock only around critical ledger/snapshot writes; release it before form, board, display, or print refreshes. Never acquire the same lock from a nested helper.
8. **Refresh Reliability:** One owner-installed 10-minute poller drains durable per-task queue properties. Runs stop at 4.5 minutes; tasks retry after 1/5/15/60 minutes and are marked stuck after five failures. Queue updates/acknowledgements compare the claimed nonce/value.
9. **Request Deletion Snapshot:** Requests column M stores a stable Request ID; the hidden Request Deletion Snapshot sheet maps those IDs to audit metadata. Do not store growing request snapshots in ScriptProperties.

### Operational Defaults
- BACKUP: nightly 2am, 7-day retention, CSV default, dedicated Drive folder, manual "Run Backup Now".
- BACKUP RETRIES: shared refresh poller; up to three retries/day with 5/15/60-minute backoff, then wait for the next scheduled run. Retry state resets on a new day and is cleared if a duplicate run finds today's backup already complete/reserved.
- CACHE TTL: CONFIG.CACHE_TTL_MINUTES (invalidate after writes to related data).

---

## Essential Patterns & Conventions

### Configuration Pattern
All settings in `Config.js` under `CONFIG` object:
```javascript
// Access: CONFIG.MAX_ACTIVE (10), CONFIG.FORM_SLOTS (10), CONFIG.SHEETS.REQUESTS
// Edit here, not in code - enables non-technical admin changes
```

### Column Reference Pattern
```javascript
// Instead of magic numbers, use CONFIG.COLS
const email = r[COLS.REQUESTS.EMP_EMAIL - 1];  // 1-indexed columns
const status = r[COLS.REQUESTS.STATUS - 1];
const notes = r[COLS.REQUESTS.NOTES - 1];      // Column 12: optional notes
const contactType = r[COLS.REQUESTS.CONTACT_TYPE - 1]; // Column 11: EMPLOYEE or CUSTOMER
// COLS object maps sheet → column indices
```

### Sheet Operation Pattern
```javascript
// Use the global script lock only around critical ledger/snapshot writes.
// Release it before Form, board, display, Print Out, or Employee View refreshes.
// Never reacquire the same script lock through a nested helper.
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
- **Google Forms API** - Read/write form items, responses (script runner needs Editor access)
- **Google Sheets API** - CRUD operations on 12+ sheets
- **Google Drive API** - Create backup folder, store CSV/Sheet backups
- **QuickChart API** - Generate QR codes (form link, employee view link)

### Data Flow Between Modules
- **Config → All modules** - Config.js provides global settings
- **Ledger → Boards** - Ledger.js queries → Boards.js visualizes
- **Form changes → Boards** - FormSync.js updates form → FormSubmit.js processes → Boards.js rebuilds
- **Sheet edits → Operations** - InventoryCleanup.js detects Inventory edits → FormSync.js (updates form options), Boards.js (rebuilds boards), PrintOut.js (refreshes print display)
- **Analytics logging** - Analytics.js logs all events (submissions, rebuilds, anomalies)
- **Display tracking** - PosterDisplay.js manages "Poster Outside" and "Poster Inside" tabs independently
- **Refresh management** - RefreshManager.js provides consolidated UI for all refresh operations

### Stored Data (ScriptProperties)
```javascript
// Persistent cache/mapping data:
LABEL_TO_ID        // Poster title → Poster ID
ID_TO_CURRENT_LABEL // Poster ID → current title (handles name changes)
FORM_CHOICES_HASH  // Hash of current Add/Remove form choices and slot count
HEALTH_BANNER_DATA  // System metrics (execution times, cache stats)
```

---

## Common Workflows & Commands

### Adding a New Feature
1. Create new file (camelCase naming)
2. Define config in `Config.js` if needed
3. Add menu item in `Setup.js` buildAdminMenu_()
4. Hook into appropriate trigger (form submit, sheet edit, timer)
5. Follow error handling + caching patterns above
6. Test manually by submitting form and verifying expected behavior

### Debugging & Testing
- **Manual Testing:** Submit test form → verify boards rebuild and form options sync
- **Log Inspection:** Extensions → Apps Script → Logs
- **Data Inspection:** Check Requests sheet (ledger), REQUEST_ORDER sheet (submission history)
- **Analytics:** Check Analytics + Analytics Summary sheets for performance metrics and event tracking
- **Admin Menu Map:** Poster Request System menu with ➕ Add New Poster at top, Advanced submenu containing: Refresh Manager, Employee View Manager, Manually Add Request; Reports (queued board rebuild/form sync, Refresh Documentation); Display Management; System (Run Setup/Repair, owner-only trigger reconciliation, form access check, one-time legacy announcement cleanup)

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

⚠️ **Refreshes are queued:** Route post-write view updates through `queueManualPosterRefresh_()`; do not run expensive refreshes while holding the ledger lock.

⚠️ **Notes are optional:** Notes field (REQUESTS col 12) is optional for form submissions but auto-populated for customer entries in ManualRequest ("Customer: [phone]"). Boards display notes in column C.

---

## Testing Checklist Before Merge

- [ ] Multiple employees can request same poster (both ACTIVE)
- [ ] Single employee cannot request same poster twice (if ALLOW_REREQUEST_AFTER_REMOVAL=false)
- [ ] Inventory counts never block requests (test with 1 poster, 10 requests)
- [ ] MAX_ACTIVE enforced per employee (test the 11th request denied at the default 10-slot limit)
- [ ] Boards rebuild automatically after form submit
- [ ] Form options update after Inventory changes
- [ ] Analytics logs all events (check Analytics sheet)
- [ ] Error paths logged to ERROR_LOG sheet
- [ ] Backups run nightly without errors
- [ ] Backup retries are capped at three per day using the shared poller
- [ ] Unchanged Form choices skip Form writes; changed choices never reset to placeholders
- [ ] Refresh worker respects 4.5-minute budget and per-task retry/stuck behavior
- [ ] Request deletion analytics identify the exact stable request ID
- [ ] Requests column M contains stable IDs and the hidden deletion snapshot maps those IDs to audit metadata
- [ ] Employees board headers and employee-facing copy do not expose employee emails or customer phone numbers
- [ ] Health banner displays accurate cache hit rate + execution times
- [ ] Notes field in form submissions saved to REQUESTS col 12 and displayed in boards col C
- [ ] ManualRequest notes auto-populate with "Customer: [phone]" for customer entries
- [ ] Notes display correctly in Main and Employees boards

---

## Key Files to Read First

For understanding the system:
1. **Config.js** - All settings and column mappings
2. **PROJECT_DOCUMENTATION.txt** - Full architecture & rationale
3. **Ledger.js** + **FormSubmit.js** - Core request logic
4. **Boards.js** - How requests become visualizations
5. **Issue #19** - Known bugs, redundancies, and refactor opportunities

---

## When Adding Code
- Always use `CONFIG.*` for settings, never hardcode
- Always use `COLS.*` for sheet column references
- Use short lock-protected sections only for critical ledger/snapshot mutations; never hold the global lock during view refreshes.
- Log important steps: `Logger.log('[functionName] message');`
- Use `logError_()` for exceptions, not `console.error()`
- Cache expensive queries with `setCache_()` / `getCache_()`
- Invalidate related caches on writes: `invalidateCachesAfterWrite_('key')`
