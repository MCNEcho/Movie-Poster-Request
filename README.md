# Movie Poster Request System

Current project version is tracked in [VERSION.md](VERSION.md).

A Google Apps Script system for employee poster requests with strict per-employee slot limits, duplicate prevention, request ledger auditability, queued view refreshes, nightly backups, and TTL-based caching for quota optimization.

**Key Features:**
- 10-slot per-employee limit with a matching configurable Form slot count
- Deduplication by email + poster to prevent multiple requests from same employee
- Optional notes on each poster request (stored and displayed on boards)
- Theater display management ("Poster Outside" and "Poster Inside" tabs)
- Ledger-based audit trail: all requests tracked, never deleted
- Nightly backups to Google Drive with retention policies
- Cache layer for read optimization
- Comprehensive admin panel with one-click repair
- Employee view sync to separate spreadsheet

## Quick Setup

### Prerequisites
- Node.js (LTS) and npm installed
- Google account with access to Google Apps Script, Sheets, Forms, Drive, and Gmail (for critical admin error alerts)
- `clasp` installed globally:

```bash
npm install -g @google/clasp
```

### Bootstrap (Windows)
Use the helper script to set up or link your Apps Script project.

```powershell
# From repo root
./scripts/quickstart_clasp.bat
```

The script will guide you through:
- Logging into Google (`clasp login`)
- Creating or linking an Apps Script project
- Pushing code to Apps Script

### Configure
1. Open `main/Config.js` and set your environment:
   - Spreadsheet and sheet names/IDs
  - `CONFIG.MAX_ACTIVE` per-employee slot limit (default 10)
  - `CONFIG.FORM_SLOTS` number of add/remove dropdowns (default 10)
   - `CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL` (allow re-requesting same poster after removal)
   - `CONFIG.REREQUEST_COOLDOWN_DAYS` (cooldown period if re-requests are allowed)
  - ScriptProperties keys for poster labels/IDs and queued refresh state
  - Backup retention and cache TTL settings
2. Push code to your Apps Script project:

```bash
clasp push
```

3. In the Google Sheet, use the Admin Menu:
   - Click **Poster Request System** → **Run Setup / Repair**
   - This creates all sheets, menus, triggers, and form
4. First-time sync:
   - The form will be auto-created with options from the Inventory sheet
   - All boards and dashboards will be generated

## How It Works

### Core Principles
- **Ledger-based audit:** All requests stored in the Requests sheet (never deleted). Status is `ACTIVE` or `REMOVED`.
- **Per-employee limit:** A single employee can have up to `MAX_ACTIVE` active posters (default 10).
- **Dedup by Email+Poster:** An employee cannot hold the same poster twice. Re-requesting after removal follows `ALLOW_REREQUEST_AFTER_REMOVAL` and its cooldown setting.
- **Inventory is informational:** Inventory never blocks requests. Form submissions are accepted regardless of stock counts.
- **Concurrency:** Use the global script lock only for short critical ledger/snapshot writes. Boards, Form, Print Out, display, and Employee View refreshes are coalesced through one background worker.
- **Caching:** Expensive queries use a TTL cache. Caches are invalidated on related writes to avoid stale views.

### Request Flow
1. **Google Form Submission** → handled by `FormSubmit.js`
2. Parse form answers and extract poster requests + optional notes
3. Validate employee name and email
4. Check for removals (unchecked posters) and process them
5. Check for additions (newly checked posters) and validate:
  - No slot limit exceeded (max 10 per employee)
   - No duplicate request (same employee + poster never twice)
6. Write all requests to Requests ledger with status (ACTIVE/REMOVED) and notes
7. Rebuild Main and Employees boards from ledger data
8. Update form options from Inventory sheet
9. Queue dependent view refreshes so request processing does not wait on sheet/form refreshes
10. Invalidate caches to ensure fresh data

### Operational Automations
- **Backups** (`BackupManager.js`)
  - Nightly at 2am to a dedicated Drive folder (CSV or Sheet format)
  - 7-day retention policy; older backups automatically deleted
  - Manual trigger available via Admin Menu
  - Backup logs and history tracked for audit

### Key Modules
- `Config.js` – Central configuration, column mappings, sheet references, property keys
- `Setup.js` – Initialization, Admin Menu building, trigger setup, repair routine
- `Utils.js` – Common sheet operations, poster fetching, name validation
- `CacheManager.js` – TTL cache with invalidation helpers
- `ErrorHandler.js` – Centralized error logging and admin notifications
- `FormManager.js` – Google Form creation, field setup, email collection
- `FormSync.js` – Dynamic form option updates from Inventory sheet
- `FormSubmit.js` – Form submission processing, additions/removals, validation
- `Ledger.js` – Request ledger queries, deduplication checks, slot counting
- `Analytics.js` – Event logging and performance metrics
- `BackupManager.js` – Nightly backups to Drive, retention policies
- `BackupTest.js` – Backup testing suite
- `Boards.js` – Main and Employees board generation from ledger
- `PrintOut.js` – Print layout generation, QR code support, inventory syncing
- `Documentation.js` – Auto-generated system documentation sheet
- `EmployeeViewSync.js` – Sync to separate employee-facing spreadsheet
- `RefreshManager.js` – Consolidated refresh operations and UI
- `ManualRequest.js` – Historical request migration dialog with notes support
- `ManualPoster.js` – Admin dialog for manually adding new posters to Inventory
- `PosterDisplay.js` – Theater display management ("Poster Outside" / "Poster Inside")
- `InventoryCleanup.js` – Inventory edit detection and data cleanup
- `Debug.js` – Cleanup and repair utilities

### Admin Menu Structure
- **➕ Add New Poster** – Dialog to manually add new posters to Inventory sheet
- **Reports** (submenu)
  - Rebuild Boards – Queue a serialized rebuild of Main and Employees boards
  - Sync Form Options – Queue a form-options refresh from Inventory
  - Refresh Documentation – Update system documentation sheet
- **Print & Layout** (submenu)
  - Update Print Out – Sync and refresh print layout sheet
- **Display Management** (submenu)
  - Manage Theater Displays – Configure "Poster Outside" and "Poster Inside" display tracking
- **Advanced** (submenu)
  - Manually Add Request – Dialog for historical request entry with optional notes
  - Employee View Manager – Setup and manage employee-facing view
  - Run Backup Now – Manually trigger nightly backup
- **System** (submenu) 
  - Run Setup / Repair – One-click initialization and repair
  - Run Data Integrity Check – Detect and fix orphaned/duplicate requests
- **Refresh All** – Queue serialized board, form, Print Out, display, and Employee View updates

### UI/UX Features
- **Optional Notes on Requests** – Each poster request can include optional notes (e.g., "Matinee only") that are stored and displayed in boards
- **Theater Display Tabs** – Separate "Poster Outside" and "Poster Inside" tabs for tracking display locations with dynamic dropdowns
- **Tab Color Coding** – Purposeful colors for navigation:
  - BLUE: Primary user-facing (Inventory, Main Board, Employees Board)
  - CYAN: Display/Print (Poster Outside/Inside, Print Out)
  - ORANGE: Configuration/Reference (Documentation)
  - YELLOW: Admin audit logs (Request Order, Requests)
  - RED: Error/Debug (Error Log, Data Integrity)
  - GREEN: Analytics/Reporting
- **Documentation Tab** – Configuration reference, troubleshooting guides, and form link
- **Clean Interface** – Frozen headers removed; Requests/Request Order sheets hidden by default
- **Print Out Auto-Format** – Print layout with QR codes for easy sharing and form access

### Documentation
- **Documentation Sheet** – Auto-generated with:
  - Complete system guide (employee and manager sections)
  - Current configuration settings and limits
  - Direct edit link to the Google Form
  - Troubleshooting guide
  - Requests ledger column reference
- **Analytics Tracking** – All events logged (submissions, rebuilds, errors, execution times)
- **Error Logging** – Automated error capture with admin notifications for critical issues

### Testing & Verification
- [ ] Multiple employees can request the same poster (both appear ACTIVE in boards)
- [ ] A single employee cannot request the same poster twice (historical block enforced)
- [ ] Inventory counts never block requests (test with 1 poster, 10 requests)
- [ ] `MAX_ACTIVE` enforced per employee (11th request denied with "limit exceeded")
- [ ] Optional notes are saved and displayed in boards
- [ ] Boards rebuild automatically after form submission
- [ ] Form options update after Inventory sheet changes
- [ ] Analytics logs all events and performance metrics
- [ ] Errors are captured and logged to Error Log sheet
- [ ] Nightly backups run without errors and retain 7 days of backups

### Troubleshooting
- **One-click repair:** Admin Menu → **Run Setup / Repair** – Recreates all sheets, triggers, and form
- **Check for issues:** Admin Menu → System → **Run Data Integrity Check** – Detects and auto-repairs duplicates and orphaned requests
- **Inspect logs:** Extensions → Apps Script → Logs for detailed error traces
- **Manual fixes:** Admin Menu → Advanced → **Manually Add Request** for corrections or migrations
- **Form issues:** If form options are stale, run Admin Menu → Reports → **Sync Form Options**
- **Board display issues:** Run Admin Menu → Refresh All to rebuild all boards and dashboards
- **Cache stale data:** Cache TTL set in `Config.js`; invalidation happens automatically on sheet edits

## Additional References
- See [.github/copilot-instructions.md](.github/copilot-instructions.md) for in-depth developer guidance, code conventions, and architecture patterns
