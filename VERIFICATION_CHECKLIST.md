# Verification Checklist for Inventory Refactor

## Pre-Deployment Verification

### Code Integrity
- [x] All functions compile without errors
- [x] No remaining references to `ensurePosterIds_()` (Movie Posters variant)
- [x] No remaining references to `syncInventoryCountsToMoviePosters_()`
- [x] No remaining references to `processMoviePostersEdit_()`
- [x] Migration function uses explicit column mapping (not positional arrays)
- [x] All utility functions (`getProps_`, `setCheckboxColumn_`) exist in codebase

### Architecture Validation
- [x] `getPostersWithLabels_()` reads from Inventory (02_Utils.js:98-124)
- [x] `getActivePosterIdMap_()` reads from Inventory (07_Ledger.js:141-153)
- [x] `ensurePosterIdsInInventory_()` is only ID generator (07_Ledger.js:7-16)
- [x] `processInventoryEdit_()` handles poster activation (17_Announcements.js:35-54)
- [x] `syncPostersToForm()` reads from Inventory (05_SyncForm.js:11)
- [x] `handleSheetEdit()` only listens to Inventory (17_Announcements.js:3-18)

### Documentation
- [x] CONFIG.SHEETS.MOVIE_POSTERS marked as deprecated
- [x] System documentation references Inventory as primary
- [x] Code comments updated to reference Inventory
- [x] Admin guide mentions Inventory for poster management
- [x] REFACTOR_SUMMARY.md created with full details

### Security
- [x] CodeQL security scan passed (0 alerts)
- [x] No SQL injection risks (N/A for GAS)
- [x] No XSS risks in UI dialogs
- [x] Script properties used safely for migration flag

## Post-Deployment Testing (Production)

### Setup & Migration
- [ ] Run `setupPosterSystem()` on clean spreadsheet
  - Verify: Only Inventory sheet created for posters
  - Verify: No Movie Posters sheet created
  - Verify: Setup completes without errors

- [ ] Run `setupPosterSystem()` on existing deployment with Movie Posters
  - Verify: Migration runs successfully
  - Verify: Data moved from Movie Posters to Inventory
  - Verify: Poster IDs preserved
  - Verify: Active status preserved
  - Verify: Migration flag set (INVENTORY_MIGRATION_COMPLETED)

- [ ] Run `setupPosterSystem()` again after migration
  - Verify: Migration skipped (already completed message)
  - Verify: No duplicate data created

### Form Operations
- [ ] Add new poster to Inventory with Active? = TRUE
  - Verify: Poster appears in form "Request Posters (Add)" list
  - Verify: Form sync runs without errors

- [ ] Set Active? = FALSE for a poster in Inventory
  - Verify: Poster removed from form "Request Posters (Add)" list
  - Verify: Poster still appears in Remove list if has active requests

- [ ] Submit form with new poster requests
  - Verify: Requests logged in Requests sheet
  - Verify: Boards rebuild automatically
  - Verify: Employee count updates

### Board & Display Operations
- [ ] Rebuild Main board
  - Verify: Shows posters from Inventory
  - Verify: Shows correct employee names per poster
  - Verify: Inventory counts displayed correctly

- [ ] Rebuild Employees board
  - Verify: Shows employees with their active posters
  - Verify: Slot counts correct (X/7)
  - Verify: No orphaned data

- [ ] Update Print Out
  - Verify: Displays active posters from Inventory
  - Verify: QR codes generated
  - Verify: Formatting correct

- [ ] Setup/Refresh Poster Outside tab
  - Verify: Dropdowns populated with Inventory titles
  - Verify: Sorted by release date (newest first)

- [ ] Setup/Refresh Poster Inside tab
  - Verify: Dropdowns populated with Inventory titles
  - Verify: Layout correct

### Announcement System
- [ ] Activate new poster in Inventory (change Active? to TRUE)
  - Verify: Announcement queued (check script properties)
  - Verify: No errors in Error Log

- [ ] Preview pending announcement
  - Verify: Preview shows correct poster details
  - Verify: Template variables substituted correctly
  - Verify: Subscriber count correct

- [ ] Send announcement manually
  - Verify: Emails sent to subscribers
  - Verify: Email content correct
  - Verify: Queue cleared after send
  - Verify: Poster marked as announced

### Manual Operations
- [ ] Use "Add New Poster" dialog (21_ManualPosterEntry.js)
  - Verify: New poster added to Inventory
  - Verify: Poster ID auto-generated
  - Verify: If activated, appears in form immediately

- [ ] Use "Manually Add Request" dialog (19_ManualRequestEntry.js)
  - Verify: Historical requests can be added
  - Verify: Uses posters from Inventory

### Data Integrity
- [ ] Run data integrity check (if available)
  - Verify: No orphaned requests
  - Verify: All poster IDs in requests match Inventory
  - Verify: No duplicate posters in Inventory

### Error Handling
- [ ] Check Error Log sheet after all operations
  - Verify: No critical errors related to Inventory
  - Verify: No "Movie Posters sheet not found" errors
  - Verify: Migration logged successfully

### Performance
- [ ] Check Analytics sheet
  - Verify: Operations complete in reasonable time
  - Verify: Cache hit rates acceptable
  - Verify: No timeout errors

## Rollback Testing (If Issues Found)

- [ ] If critical issues found:
  1. [ ] Document the issue
  2. [ ] Run `git revert` on problematic commits
  3. [ ] Redeploy previous version
  4. [ ] Verify old system works
  5. [ ] Investigate and fix issues before re-attempting

## Sign-Off

- [ ] All pre-deployment checks passed
- [ ] All post-deployment tests passed
- [ ] No critical errors in Error Log
- [ ] Performance acceptable
- [ ] Admin trained on new Inventory-only workflow
- [ ] Ready for production use

---

**Deployment Date:** _____________
**Tested By:** _____________
**Issues Found:** _____________
**Resolution:** _____________
