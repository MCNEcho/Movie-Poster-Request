# Inventory Refactor - Implementation Summary

## Overview
This refactor consolidates poster management by making the **Inventory sheet** the single source of truth for all poster data. The separate **Movie Posters sheet** has been deprecated.

## Changes Made

### 1. Migration System (23_InventoryMigration.js)
- **New file**: Migration function to safely move data from Movie Posters to Inventory
- **Safety features**:
  - Runs only once per deployment (flag: `INVENTORY_MIGRATION_COMPLETED`)
  - Skips posters already in Inventory (checks by Poster ID)
  - Safe to run multiple times
  - Manual reset available via `resetAndRunMigration()`

### 2. Configuration (00_Config.js)
- **SHEETS.MOVIE_POSTERS**: Marked as DEPRECATED with comment
- **SHEETS.INVENTORY**: Marked as PRIMARY canonical source
- Config kept for backward compatibility with existing deployments

### 3. Setup & Initialization (01_Setup.js)
- **setupPosterSystem()**: Added migration step after core infrastructure
- **ensureSheetSchemas_()**: Removed Movie Posters sheet creation
- Setup now only creates Inventory sheet for posters

### 4. Ledger Operations (07_Ledger.js)
- **Removed**: `ensurePosterIds_()` function (Movie Posters variant)
- **Kept**: `ensurePosterIdsInInventory_()` as the only ID generation function
- All poster ID generation now happens in Inventory

### 5. Print & Inventory Sync (13_PrintOutInventory.js)
- **Removed**: `syncInventoryCountsToMoviePosters_()` function
- No longer syncs inventory counts to a separate sheet
- Print operations read directly from Inventory

### 6. Announcements & Edit Handlers (17_Announcements.js)
- **handleSheetEdit()**: Removed Movie Posters edit handler branch
- **Removed**: `processMoviePostersEdit_()` function
- Only `processInventoryEdit_()` remains for handling poster activations
- Announcements queue when Inventory posters are activated

### 7. Form Synchronization (05_SyncForm.js)
- **syncPostersToForm()**: Removed calls to `ensurePosterIds_()` and `syncInventoryCountsToMoviePosters_()`
- Form sync now reads directly from Inventory via `getPostersWithLabels_()`
- Simplified flow: Inventory → Form Options

### 8. Documentation (14_Documentation.js, 12_PrintSelection.js, 02A_CacheManager.js)
- Updated all references from "Movie Posters" to "Inventory"
- Documentation now correctly describes Inventory as the primary sheet
- Comments updated to reflect new architecture

## Data Flow (Before vs After)

### Before (Dual-Sheet System)
```
Movie Posters (Primary) ←→ Inventory (Secondary)
       ↓
   Form Sync
       ↓
  Submissions
       ↓
    Boards
```

### After (Single-Sheet System)
```
Inventory (Primary & Only)
       ↓
   Form Sync
       ↓
  Submissions
       ↓
    Boards
```

## Key Functions Now Using Inventory

| Function | File | Purpose |
|----------|------|---------|
| `getPostersWithLabels_()` | 02_Utils.js | Fetch all posters with display labels |
| `getActivePosterIdMap_()` | 07_Ledger.js | Get map of active poster IDs |
| `ensurePosterIdsInInventory_()` | 07_Ledger.js | Generate missing poster IDs |
| `processInventoryEdit_()` | 17_Announcements.js | Handle poster activation |
| `getMovieTitlesFromInventory_()` | 22_PosterDisplays.js | Populate display dropdowns |
| `getStockInfo_()` | 17_Announcements.js | Get inventory counts for emails |
| `addPosterToInventory_()` | 21_ManualPosterEntry.js | Add new posters via dialog |

## Testing Checklist

### Setup & Migration
- [ ] Run setup on clean deployment (no Movie Posters sheet)
  - Expected: Only Inventory sheet created
- [ ] Run setup on existing deployment (with Movie Posters sheet)
  - Expected: Data migrated from Movie Posters to Inventory
- [ ] Run setup again on migrated deployment
  - Expected: Migration skipped (already completed)

### Form Operations
- [ ] Add poster to Inventory, activate it
  - Expected: Poster appears in form Add list
- [ ] Deactivate poster in Inventory
  - Expected: Poster removed from form Add list
- [ ] Submit form with Add requests
  - Expected: Requests logged, boards updated

### Boards & Displays
- [ ] Rebuild boards after submission
  - Expected: Main/Employees boards show correct data
- [ ] Update Print Out
  - Expected: Inventory posters shown in print layout
- [ ] Setup Poster Outside/Inside tabs
  - Expected: Dropdowns populated with Inventory titles

### Announcements
- [ ] Activate new poster in Inventory
  - Expected: Announcement queued
- [ ] Preview pending announcement
  - Expected: Email preview shows poster details
- [ ] Send announcement
  - Expected: Subscribers receive email

## Backward Compatibility

### Existing Deployments
- Migration automatically runs on first setup after update
- Existing Movie Posters data preserved and moved to Inventory
- Poster IDs maintained across migration
- No manual intervention required

### Movie Posters Sheet
- Not deleted automatically (for safety)
- Can be manually removed after successful migration
- Config reference kept for backward compatibility
- No longer updated or read by system

## Migration Safety Features

1. **Idempotent**: Safe to run multiple times
2. **Guard Flag**: `INVENTORY_MIGRATION_COMPLETED` prevents re-runs
3. **Duplicate Check**: Skips posters already in Inventory by Poster ID
4. **Data Preservation**: Preserves Active status, IDs, titles, dates, notes
5. **Logging**: All actions logged with clear messages
6. **Manual Override**: `resetAndRunMigration()` available for repairs

## Breaking Changes

### None for End Users
- Form interface unchanged
- Submission process unchanged
- Board displays unchanged
- Employee experience identical

### Admins Must Know
- Poster management now happens in **Inventory tab** only
- Active? checkbox in Inventory controls form availability
- Movie Posters sheet no longer updated or monitored
- Display management (Poster Outside/Inside) reads from Inventory

## Rollback Plan (If Needed)

If issues arise, rollback steps:
1. Revert to previous commit: `git revert <commit-hash>`
2. Redeploy scripts
3. Run setup to restore Movie Posters sheet creation
4. Manually sync data back if needed

## Future Cleanup (Optional)

After successful deployment and migration verification:
1. Remove COLS.MOVIE_POSTERS from 00_Config.js (keep for 1-2 months)
2. Delete deprecated Movie Posters sheet manually
3. Remove migration module after all deployments migrated
