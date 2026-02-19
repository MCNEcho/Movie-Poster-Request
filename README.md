# Movie Poster Request System

A Google Apps Script system for employee poster requests. It enforces a strict per-employee slot limit (default 7), prevents duplicate requests per poster, keeps a ledger for auditability, batches announcement emails, runs nightly backups, and optimizes read limits via a TTL cache.

**✨ Version 2.0: Enhanced UX with Non-Blocking Spinners & Persistent Admin Notes**

Recent improvements include:
- **Non-Blocking Spinner UI** — All long-running operations now show elegant CSS spinners instead of blocking toast messages. Users can continue working while operations complete.
- **Persistent Admin Notes Column** — Column C on Main and Employees boards now provides a protected space for admin annotations that survive all rebuilds and updates.
- **Project Cleanup** — Removed duplicate files and dead code for better maintainability.

**👉 NEW: Comprehensive Guides Folder**

For detailed, beginner-friendly tutorials on every aspect of the system, see the [**Guides folder**](Guides/README.md). Topics include:
- Getting started with setup
- Every admin menu button explained
- How to add posters step-by-step
- Understanding the employee form
- How requests work and what the boards show
- Troubleshooting common problems
- Advanced configuration

Start with [Guides/GETTING_STARTED.md](Guides/GETTING_STARTED.md) for first-time setup!

## Quick Setup

### Prerequisites
- Node.js (LTS) and npm installed
- Google account with access to Google Apps Script, Sheets, Forms, Drive, and Mail
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
   - `CONFIG.MAX_ACTIVE` slot limit (default 7)
   - `CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL` (allow re-requesting same poster after removal)
   - `CONFIG.REREQUEST_COOLDOWN_DAYS` (cooldown period if re-requests are allowed)
   - ScriptProperties keys for poster label/ID maps and queues
   - Announcement batching, backup retention, cache TTL settings
2. Push code to your Apps Script project:

```bash
clasp push
```

3. In the Google Sheet, use the Admin Menu:
   - Click **Poster System** → **Run Setup / Repair** (non-blocking spinner UX)
   - This creates all sheets, menus, triggers, and form
4. First-time sync:
   - The form will be auto-created with options from the Inventory sheet
   - All boards and dashboards will be generated
   - Admin Notes column will be initialized on Main and Employees boards

## How It Works

### Core Principles
- **Ledger-based audit:** All requests stored in the Requests sheet (never deleted). Status is `ACTIVE` or `REMOVED`.
- **Per-employee limit:** A single employee can have up to `MAX_ACTIVE` active posters (default 7).
- **Dedup by Email+Poster:** The same employee cannot request the same poster twice. Historical duplicates are blocked (cooldown and re-request flags are respected).
- **Inventory is informational:** Inventory never blocks requests. Form submissions are accepted regardless of stock counts.
- **Concurrency:** All sheet operations use a 30-second script lock to avoid race conditions.
- **Caching:** Expensive queries use a TTL cache. Caches are invalidated on related writes to avoid stale views.

### Request Flow
1. **Google Form Submission** → handled by `06_SubmitHandler.js`
2. Parse answers, validate employee name/email, capture subscription preference
3. Apply removals and additions with slot limit and dedup checks
4. Write to the Requests ledger (audit trail)
5. Update subscriber list if employee opted in
6. Rebuild boards and refresh form options
7. Queue and batch announcements when a poster is newly activated
8. Invalidate caches tied to posters, boards, and employee slots

### Operational Automations
- **Announcements** (`17_Announcements.js`)
  - Sends all pending new posters in a single email (no batching)
  - 1s throttle, 3 retries with backoff
  - Template variables: `{{TITLE}}`, `{{RELEASE}}`, `{{STOCK}}`, `{{ACTIVE_COUNT}}`, `{{FORM_LINK}}`, `{{COUNT}}`, `{{POSTER_LIST}}`
  - Dry-run preview available before sending
- **Backups** (`10_BackupManager.js`)
  - Nightly at 2am to a Drive folder (CSV or Sheet), 30-day retention
  - Manual trigger available via Admin Menu → "Run Backup Now"
  - Backup logs tracked in Analytics sheet
- **Bulk Simulator** (`20_BulkSimulator.js`)
  - Stress test up to 100 randomized submissions (warn ≥50 live)
  - Dry-run option; logs execution stats (time, sheet reads, cache hits, lock waits) to Analytics

### Key Modules (selected)
- `Config.js` – Central configuration, column mappings, and property keys
- `Setup.js` – Initialization, Admin Menu, triggers, repair routine
- `Utils.js` – Common sheet ops, poster fetching, validation
- `CacheManager.js` – TTL cache helpers + invalidation after writes
- `ErrorHandler.js` – Central error logging, CRITICAL notifications
- `FormManager.js` – Form creation, email collection setup, subscription checkbox
- `FormSync.js` – Sync form options from Inventory sheet (maintains form structure)
- `FormSubmit.js` – Handle additions/removals, slot/dedup enforcement
- `Ledger.js` – Query ledger, duplicate checks, slot counts
- `Analytics.js` – Event logging, performance metrics
- `BackupManager.js` – Backups, retention, Drive operations
- `Boards.js` – Main and Employees boards generation from ledger (includes Admin Notes column persistence)
- `PrintOut.js` – Print layout generation, inventory syncing, QR codes
- `Documentation.js` – Auto-generated documentation sheet with system health and form link
- `EmployeeViewSync.js` – Sync employee-facing spreadsheet
- `Announcements.js` – Email queue, batched notifications with templates
- `ManualRequestEntry.js` – Dialog for manual request entry (migration)
- `ManualPosterEntry.js` – Dialog for adding new posters
- `PosterDisplay.js` – Display management for Poster Outside/Inside tabs
- `UISpinner.js` – Non-blocking spinner UI for long-running operations (NEW in v2.0)

### Admin Menu (high level)
- **Reports:** Rebuild Boards, Sync Form Options, Refresh Documentation
- **Print & Layout:** Update Print Out (manual refresh, now with spinner UI)
- **Announcements:** Preview Pending, Send Now
- **Advanced:** Manually Add Request, Add New Poster, Run Backup Now, Setup Employee View, Sync Employee View, Show Employee View Link
- **Top-level:** Run Setup / Repair (with spinner), Refresh All (with spinner)

### UI/UX Enhancements (Version 2.0)
- **Non-Blocking Spinner Dialogs:** Long-running operations (Setup, Refresh, Print updates) now display elegant CSS spinners with auto-close instead of blocking toast messages. Users can continue working.
- **Persistent Admin Notes Column:** Column C on Main and Employees boards provides a protected space for admin annotations. Notes persist across:
  - Board rebuilds
  - Form submissions
  - Deferred refresh triggers
  - Setup/repair operations
  - Inventory changes
- **Tab Colors:** Sheets have purposeful color coding for easy navigation
  - BLUE: Primary user-facing (Inventory, Main Board, Employees Board)
  - CYAN: Display/Print (Poster Outside/Inside, Print Out)
  - ORANGE: Configuration/Reference (Subscribers, Documentation)
  - YELLOW: Admin audit logs (Request Order, Requests)
  - RED: Error/Debug (Error Log, Data Integrity)
  - GREEN: Analytics/Reporting
- **Documentation Tab:** Always visible after setup with system health dashboard, configuration reference, and troubleshooting guides
- **Frozen Headers:** Removed from all sheets for cleaner interface
- **Manual Print Updates:** Print Out sheet only updates when triggered to prevent workflow interruption

### Documentation Tab Features
- Complete system guide (employee + manager sections)
- Current configuration settings
- System Health dashboard (triggers, cache, errors, queue status)
- Direct link to edit the Google Form
- Troubleshooting guide
- Requests ledger column reference

### Testing & Verification
- Multiple employees can request the same poster (both `ACTIVE`)
- A single employee cannot request the same poster twice (unless re-request is allowed)
- Inventory counts never block requests
- `MAX_ACTIVE` enforced per employee (8th request denied)
- Boards rebuild automatically after form submit
- Form options update after Movie Posters sheet changes
- Announcements batch correctly for multiple new posters
- Analytics logs events; errors recorded in Error Log
- Nightly backups succeed; retention applies

### Troubleshooting
- Use Admin Menu → "Run Setup / Repair" for one-click fixes
- Check the Requests ledger and Request Order sheets for anomalies
- Inspect Logs via Apps Script editor for error details
- Run `runFullIntegrityCheck_()` to detect and auto-repair duplicates/orphans

## Additional References
- See `.github/copilot-instructions.md` for in-depth developer guidance and conventions.
