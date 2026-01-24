# Improvement Plan Summary - January 23, 2026

## Overview
Created 5 GitHub Issues to address comprehensive improvements across configuration, UI/UX, data management, optimization, and architecture. All work targets **beta-1.01 branch**.

---

## Issue #33: Configuration - Remove Time-Based Gating & Enable Immediate Re-requests
**Priority:** HIGH  
**Complexity:** MEDIUM  
**Est. Time:** 2 hours

### What It Does
- Removes `REREQUEST_COOLDOWN_DAYS` logic entirely
- Sets `ALLOW_REREQUEST_AFTER_REMOVAL` to `true` by default
- **Only blocks:** 7/7 poster limit (no time-based gating)
- **Simplifies dedup logic:** Check if ACTIVE request exists, otherwise allow

### Files Changed
- `00_Config.js` - Update default config values
- `05_Ledger.js` - Simplify `canRequestPoster_()` logic
- `06_SubmitHandler.js` - Remove `hasEverRequestedByEmail_()` calls
- `10_Documentation.js` - Update dedup rule descriptions

### Key Change
```javascript
// BEFORE: Complex dedup with cooldown checks
// AFTER: Simple - only block if already ACTIVE
const hasActive = requests.some(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
if (hasActive) return { allowed: false, reason: 'duplicate (already active)' };
return { allowed: true, reason: '' }; // Otherwise allow
```

---

## Issue #34: UI/UX - Remove Frozen Headers, Hide Internal Tabs, Streamline Admin Menu
**Priority:** HIGH  
**Complexity:** MEDIUM  
**Est. Time:** 3 hours

### What It Does
1. **Removes frozen row headers** from all 12 sheets (grey bars that stick on scroll)
2. **Auto-hides Requests & Request Order tabs** (internal audit sheets)
3. **Auto-formats Print Out tab** (pre-runs layout as if `prepareAndSelectPrintArea()` was called)
4. **Streamlines admin menu** from 13 items → organized submenus with categories

### Files Changed
- `01_Setup.js` - Add frozen header removal, hide tabs, add menu submenus, add `refreshAll_()` utility
- `09_PrintOutInventory.js` - Auto-format Print Out on setup

### Key Improvements
```
BEFORE: 13 flat menu items
  - Prepare Print Area
  - Run Setup
  - Refresh Health Banner
  - Sync Form Options
  - ... (7 more)

AFTER: Organized submenus
  📊 Reports
    ├ Rebuild Boards
    ├ Sync Form Options
    ├ Refresh Documentation
    ├ Refresh Health Banner
  🖨️ Print & Layout
    ├ Prepare Print Area
    ├ Refresh Print Out
  📧 Announcements
    ├ Preview Pending
    ├ Send Now
  ⚙️ Advanced
    └ (6 management tools)
```

---

## Issue #35: Data Management - Selective Backups & Auto-Delete Orphaned Requests
**Priority:** MEDIUM  
**Complexity:** MEDIUM  
**Est. Time:** 2.5 hours

### What It Does
1. **Selective backups:** Only backup `Requests`, `Request Order`, `Inventory` (not all 12 sheets)
2. **Auto-delete orphaned requests:** When poster removed from Movie Posters sheet, all request data for that poster is deleted
3. **Hook into edit detection:** Check for orphaned requests when Movie Posters sheet changes

### Files Changed
- `00_Config.js` - Add `BACKUP.SHEETS_TO_BACKUP` array
- `16_BackupManager.js` - Filter backup to only configured sheets
- `15_DataIntegrity.js` - Enhance `checkForOrphanedRequests_()` to DELETE rows (not just mark REMOVED)
- `08_Announcements.js` - Add call to orphan cleanup on Movie Posters edit

### Key Benefits
- **Smaller backups:** 3 sheets instead of 12+ (saves Drive storage)
- **Faster backups:** Fewer sheets to copy
- **Clean data:** Auto-removes request data when poster no longer exists
- **Zero manual cleanup:** Automatic when poster is deleted

---

## Issue #36: Optimization - Streamline Setup/Repair & Remove Health Banner from Docs
**Priority:** MEDIUM  
**Complexity:** LOW  
**Est. Time:** 2 hours

### What It Does
1. **Optimize `setupPosterSystem()`:** Reduces 8+ granular toast messages → 4 task groups
2. **Removes health banner from Documentation tab:** Health banner is live display, not documentation
3. **Dynamic documentation:** Documentation values always reference CONFIG.js (auto-updates if config changes)

### Files Changed
- `01_Setup.js` - Reorganize `setupPosterSystem()` into 4 task groups
- `10_Documentation.js` - Remove health banner section, make values reference CONFIG

### Setup Task Groups (New)
```javascript
Group 1: Core Infrastructure (sheets, form, triggers)
Group 2: Data Syncing (poster IDs, inventory, form options)
Group 3: Visual Displays (boards, documentation, print layout)
Group 4: Monitoring (health banner initialization)
```

---

## Issue #37: Architecture - Reorganize Files & Strategic Recommendations
**Priority:** LOW  
**Complexity:** LOW  
**Est. Time:** 1.5 hours (reorganization only)

### What It Does
1. **Reorganizes files into 6 logical tiers** (no code changes, just renumbering)
2. **Provides strategic recommendations** for future improvements
3. **Creates dependency hierarchy** for better understanding

### File Reorganization Map
```
TIER 1 - Core Infrastructure (00-03)
├── 00_Config.js
├── 01_Setup.js
├── 02_Utils.js
├── 02A_CacheManager.js
└── 03_ErrorHandler.js (was 99_ErrorHandler.js)

TIER 2 - Form Processing (04-07)
├── 04_FormManager.js
├── 05_SyncForm.js (was 04_SyncForm.js)
├── 06_SubmitHandler.js
└── 07_Ledger.js (was 05_Ledger.js)

TIER 3 - Data Operations (08-10)
├── 08_Analytics.js (was 04_Analytics.js)
├── 09_DataIntegrity.js (was 15_DataIntegrity.js)
└── 10_BackupManager.js (was 16_BackupManager.js)

TIER 4 - Display & UI (11-16)
├── 11_Boards.js (was 07_Boards.js)
├── 12_PrintSelection.js
├── 13_PrintOutInventory.js (was 09_PrintOutInventory.js)
├── 14_Documentation.js (was 10_Documentation.js)
├── 15_EmployeeViewSync.js (was 13_EmployeeViewSync.js)
└── 16_AdminHealthBanner.js

TIER 5 - Announcements (17-18)
├── 17_Announcements.js (was 08_Announcements.js)
└── 18_CustomAnnouncements.js (was 11_CustomAnnouncements.js)

TIER 6 - Admin Tools (19-20)
├── 19_ManualRequestEntry.js (was 14_ManualRequestEntry.js)
└── 20_BulkSimulator.js (was 16_BulkSimulator.js)

TIER 99 - Testing/Debug
├── 99_BackupTests.js
└── 99_Debuging.js
```

### Strategic Recommendations (Future Issues)
1. **Extract Validation Logic** → Create `03B_Validation.js` (consolidate all validation)
2. **Add Config Validators** → Validate CONFIG on startup
3. **Consolidate Sheets** (Future) → Merge Requests+RequestOrder, etc.
4. **Add Config Presets** (Future) → Save/load team size presets
5. **Add Dependency Graph** → Document function call chains
6. **Add Trigger Map** → Document all trigger → function mappings

---

## Implementation Order (Recommended)

### Phase 1: Critical Changes (Week 1)
1. ✅ **Issue #33** - Config changes (no UI impact)
2. ✅ **Issue #34** - UI improvements (visual polish)
3. ✅ **Issue #35** - Data management (cleaner backups)

### Phase 2: Polish (Week 2)
4. ✅ **Issue #36** - Optimization (faster setup)
5. ✅ **Issue #37** - File reorganization (maintainability)

---

## Testing Checklist (Master)

### Config Testing (#33)
- [ ] Remove poster, re-request immediately → ALLOWED
- [ ] Request 8th poster with 7/7 limit → BLOCKED
- [ ] Documentation reflects new dedup rules

### UI Testing (#34)
- [ ] No frozen headers on any sheet
- [ ] Requests/Request Order tabs hidden
- [ ] Print Out auto-formatted on setup
- [ ] Admin menu has submenus and categories

### Data Management Testing (#35)
- [ ] Only Requests/Request Order/Inventory backed up
- [ ] Delete poster from Movie Posters → request data deleted
- [ ] Integrity check triggers orphan cleanup

### Optimization Testing (#36)
- [ ] Setup/Repair completes in <60 seconds
- [ ] Health banner displays on Main sheet
- [ ] Documentation values match CONFIG.js

### Architecture Testing (#37)
- [ ] All files renumbered correctly
- [ ] No circular dependencies
- [ ] All functions still work (no breaking changes)

---

## Branch Information
**All work targets:** `beta-1.01`  
**Do NOT merge to:** `main` (main is protected)  
**Create PRs from:** feature branches to `beta-1.01`

Example:
```bash
git checkout beta-1.01
git pull origin beta-1.01
git checkout -b feature/remove-time-based-gating
# ... make changes ...
git push origin feature/remove-time-based-gating
# Create PR: feature/remove-time-based-gating → beta-1.01
```

---

## Summary Stats
- **Issues Created:** 5
- **Files Affected:** 15+
- **Functions Changed:** 20+
- **Est. Total Time:** 10-12 hours
- **Breaking Changes:** 0 (all backwards compatible after #33)
- **New Functions:** 3 (`refreshAll_()`, `validateConfiguration_()`, enhanced orphan cleanup)

---

**Created:** January 23, 2026  
**Status:** Ready for Implementation  
**Next Step:** Start with Issue #33 (Config changes) for fastest wins
