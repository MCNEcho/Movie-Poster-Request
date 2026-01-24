# Movie Poster Request System

A Google Apps Script system for employee poster requests. It enforces a strict per-employee slot limit (default 7), prevents duplicate requests per poster, keeps a ledger for auditability, batches announcement emails, runs nightly backups, and optimizes read limits via a TTL cache.

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
1. Open `main/00_Config.js` and set your environment:
   - Spreadsheet and sheet names/IDs
   - `CONFIG.MAX_ACTIVE` slot limit (default 7)
   - ScriptProperties keys for poster label/ID maps and queues
2. Push code to your Apps Script project:

```bash
clasp push
```

3. In the Apps Script editor, run initial setup (creates sheets, menus, triggers):
   - `setupPosterSystem()` (in `01_Setup.js`)
   - Open the spreadsheet and use the Admin Menu → "Run Setup / Repair" if needed

4. First-time sync:
   - Admin Menu → Announcements/Refresh → Boards/Form/Print
   - Verify the Google Form was created and options reflect the Movie Posters sheet

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
2. Parse answers, validate employee name/email
3. Apply removals and additions with slot limit and dedup checks
4. Write to the Requests ledger (audit trail)
5. Rebuild boards and refresh form options
6. Queue and batch announcements when a poster is newly activated
7. Invalidate caches tied to posters, boards, and employee slots

### Operational Automations
- **Announcements** (`17_Announcements.js`)
  - Batched send (default size 5), 1s throttle, 3 retries with backoff
  - Template variables: `{{TITLE}}`, `{{RELEASE}}`, `{{STOCK}}`, `{{ACTIVE_COUNT}}`, `{{FORM_LINK}}`, `{{COUNT}}`, `{{POSTER_LIST}}`
- **Backups** (`10_BackupManager.js`)
  - Nightly at 2am to a Drive folder (CSV or Sheet), 30-day retention
  - Manual trigger available via Admin Menu; logs to Analytics/Error Log
- **Bulk Simulator** (`20_BulkSimulator.js`)
  - Stress test up to 100 randomized submissions (warn ≥50 live)
  - Dry-run option; logs execution stats to Analytics
- **Health Banner** (`16_AdminHealthBanner.js`)
  - Displays system metrics (execution times, cache hits)

### Key Modules (selected)
- `00_Config.js` – Central configuration, column mappings, and property keys
- `01_Setup.js` – Initialization, Admin Menu, triggers, repair routine
- `02_Utils.js` – Common sheet ops, poster fetching, validation
- `02A_CacheManager.js` – TTL cache helpers + invalidation after writes
- `03_ErrorHandler.js` – Central error logging, CRITICAL notifications
- `04_FormManager.js` – Form creation and fields setup
- `05_SyncForm.js` – Sync form options from Movie Posters sheet
- `06_SubmitHandler.js` – Handle additions/removals, slot/dedup enforcement
- `07_Ledger.js` – Query ledger, duplicate checks, slot counts
- `08_Analytics.js` – Event logging, performance metrics
- `10_BackupManager.js` – Backups, retention, Drive operations
- `11_Boards.js` – Main Boards generation from ledger
- `13_PrintOutInventory.js` – Print layout generation, inventory syncing
- `15_EmployeeViewSync.js` – Sync employee-facing spreadsheet
- `17_Announcements.js` – Email queue, batched notifications
- `20_BulkSimulator.js` – Stress testing

### Admin Menu (high level)
- **Reports:** Boards, Form, Docs, Health
- **Print & Layout:** Print area, Print Out
- **Announcements:** Preview/Send
- **Advanced:** Manual add, Bulk simulator, Backup, Employee view, Show link
- **Top-level:** Refresh All, Run Setup / Repair

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
- Health banner shows accurate cache hit rate and execution times

### Troubleshooting
- Use Admin Menu → "Run Setup / Repair" for one-click fixes
- Check the Requests ledger and Request Order sheets for anomalies
- Inspect Logs via Apps Script editor for error details
- Run `runFullIntegrityCheck_()` to detect and auto-repair duplicates/orphans

## Additional References
- See `.github/copilot-instructions.md` for in-depth developer guidance and conventions.
