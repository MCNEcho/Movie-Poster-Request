# Testing Verification Guide for PR: Refactor Print Out and Inventory Migration

## Overview
This guide outlines the testing steps to verify all changes work correctly after merging this PR.

---

## Pre-Testing Setup

1. **Deploy the changes** to your Google Apps Script project
2. **Run Setup**: Click `Poster System` → `Run Setup / Repair` to initialize new columns
3. **Verify Inventory Schema**: Check that Inventory tab now has these columns:
   - Column A: Active? (checkbox)
   - Column B: Release Date
   - Column C: Movie Title
   - Column D: Company
   - Column E: Posters
   - Column F: Bus Shelters
   - Column G: Mini Posters
   - Column H: Standee
   - Column I: Teaser
   - Column J: Poster ID (hidden)
   - Column K: Poster Received Date
   - Column L: Notes

---

## Test Suite

### Test 1: Manual Print Out Update

**Goal**: Verify Print Out only updates when manually triggered.

**Steps**:
1. Edit any cell in the Inventory tab
2. **Expected**: The active sheet should NOT automatically switch to Print Out
3. Click `Poster System` → `Print & Layout` → `Update Print Out`
4. **Expected**: Print Out sheet updates with latest inventory
5. **Expected**: Toast notification: "Print Out updated successfully"

**Pass Criteria**:
- ✅ No automatic tab switching when editing Inventory
- ✅ Print Out updates only when manually triggered
- ✅ Toast notification appears

---

### Test 2: Inventory Auto-Sort

**Goal**: Verify Inventory auto-sorts by release date after edits.

**Steps**:
1. Go to Inventory tab
2. Add a poster with release date 2025-01-01
3. Add another poster with release date 2024-12-15
4. **Expected**: The 2024-12-15 poster appears BEFORE the 2025-01-01 poster (auto-sorted)

**Pass Criteria**:
- ✅ Posters are sorted by release date (earliest first)
- ✅ Sort happens automatically after any edit

---

### Test 3: Form Sync from Inventory

**Goal**: Verify form syncs from Inventory tab, not Movie Posters.

**Steps**:
1. Go to Inventory tab
2. Add a test poster:
   - Check Active? box
   - Release Date: 2025-06-01
   - Title: "Test Movie Alpha"
   - Posters: 5
3. Wait a few seconds for auto-sync OR click `Poster System` → `Reports` → `Sync Form Options`
4. Go to Documentation tab and click the Form link
5. **Expected**: "Test Movie Alpha" appears in the "Request Posters (Add)" dropdown

**Pass Criteria**:
- ✅ New poster appears in form dropdown
- ✅ Poster is read from Inventory, not Movie Posters

---

### Test 4: Add New Poster Dialog

**Goal**: Verify the new poster entry dialog works correctly.

**Steps**:
1. Click `Poster System` → `Advanced` → `Add New Poster`
2. **Expected**: Dialog opens with all fields
3. Fill in:
   - Movie Title: "Test Movie Beta"
   - Release Date: 2025-06-15
   - Poster Quantity: 3
   - Check "Activate immediately"
4. Click "Add Poster"
5. **Expected**: Success message
6. Go to Inventory tab
7. **Expected**: "Test Movie Beta" appears in the list, sorted by release date
8. **Expected**: Active? box is checked
9. Check the form
10. **Expected**: "Test Movie Beta" appears in the dropdown

**Pass Criteria**:
- ✅ Dialog opens and accepts input
- ✅ Poster is added to Inventory
- ✅ Poster has a unique Poster ID (hidden column J)
- ✅ Inventory auto-sorts after addition
- ✅ If activated, poster appears in form

---

### Test 5: Poster ID Generation

**Goal**: Verify unique IDs are generated for Inventory rows.

**Steps**:
1. Go to Inventory tab
2. Right-click column J header → Unhide (if hidden)
3. **Expected**: All existing posters have unique Poster IDs (format: P-XXXXXXXX)
4. Add a new poster manually (without using dialog)
5. Edit any cell in that row
6. **Expected**: Poster ID is auto-generated for the new row

**Pass Criteria**:
- ✅ All existing rows have unique Poster IDs
- ✅ New rows get IDs automatically
- ✅ IDs follow format P-XXXXXXXX (8 hex characters)

---

### Test 6: Boards Display from Inventory

**Goal**: Verify boards display correct poster info from Inventory.

**Steps**:
1. Go to Inventory tab
2. Note the inventory count for an active poster (e.g., "Wicked" has 5 posters)
3. Have an employee request that poster via the form
4. Go to Main board
5. **Expected**: The poster appears with inventory count in the header (e.g., "Wicked — Inventory: 5")

**Pass Criteria**:
- ✅ Boards display posters from Inventory
- ✅ Inventory counts are accurate
- ✅ Poster titles match Inventory

---

### Test 7: Active Checkbox Controls Form

**Goal**: Verify Inventory's Active checkbox controls form availability.

**Steps**:
1. Go to Inventory tab
2. Find an active poster (checkbox checked)
3. Uncheck the Active? box
4. Wait a few seconds OR click `Sync Form Options`
5. Check the form
6. **Expected**: That poster no longer appears in "Request Posters (Add)" dropdown
7. Go back to Inventory and re-check the Active? box
8. Check the form again
9. **Expected**: Poster reappears in the dropdown

**Pass Criteria**:
- ✅ Unchecking Active? removes poster from form
- ✅ Checking Active? adds poster to form
- ✅ Changes sync automatically or with manual sync

---

### Test 8: Manual Request Entry Uses Inventory

**Goal**: Verify manual request entry validates against Inventory.

**Steps**:
1. Click `Poster System` → `Advanced` → `Manually Add Request`
2. **Expected**: Poster dropdown shows only ACTIVE posters from Inventory
3. Select an active poster and fill in employee info
4. **Expected**: Request is added successfully
5. Try to add request for an inactive poster (uncheck Active? first)
6. **Expected**: That poster should not appear in dropdown

**Pass Criteria**:
- ✅ Only active posters from Inventory appear in dropdown
- ✅ Manual request creation works correctly

---

### Test 9: Data Integrity Check Uses Inventory

**Goal**: Verify orphaned request detection uses Inventory.

**Steps**:
1. Add a test poster to Inventory with Active? checked
2. Create a request for that poster
3. Delete that poster row from Inventory
4. Click `Poster System` → `Advanced` → (Run data integrity check if available)
5. **Expected**: System detects orphaned request and removes it

**Pass Criteria**:
- ✅ Orphaned requests are detected based on Inventory
- ✅ Auto-repair removes orphaned requests

---

### Test 10: Print Out Shows Inventory Posters

**Goal**: Verify Print Out displays from Inventory.

**Steps**:
1. Go to Inventory tab and note which posters have Active? checked
2. Click `Poster System` → `Print & Layout` → `Update Print Out`
3. Go to Print Out tab
4. **Expected**: Only ACTIVE posters from Inventory are displayed
5. **Expected**: Posters are sorted by release date
6. **Expected**: QR codes are visible

**Pass Criteria**:
- ✅ Print Out shows only active Inventory posters
- ✅ Sorted by release date
- ✅ Layout is clean and printable

---

### Test 11: Announcement Queue from Inventory

**Goal**: Verify announcements queue when Inventory Active? is checked.

**Steps**:
1. Go to Inventory tab
2. Add a new poster but DON'T check Active? yet
3. Now check the Active? box
4. Click `Poster System` → `Announcements` → `Preview Pending`
5. **Expected**: The new poster is in the announcement queue

**Pass Criteria**:
- ✅ Checking Active? queues announcement
- ✅ Announcement shows correct poster title and release date

---

## Regression Tests

### Regression 1: Existing Requests Unaffected

**Goal**: Verify existing requests still work after migration.

**Steps**:
1. Check Main board and Employees board
2. **Expected**: All existing requests are visible
3. Have an employee remove a poster via the form
4. **Expected**: Request status changes to REMOVED

**Pass Criteria**:
- ✅ Existing requests display correctly
- ✅ Remove functionality still works

---

### Regression 2: Form Submission Still Works

**Goal**: Verify form submissions process correctly.

**Steps**:
1. Open the employee request form
2. Select posters to add
3. Submit the form
4. **Expected**: Requests appear in Requests sheet
5. **Expected**: Boards update automatically

**Pass Criteria**:
- ✅ Form accepts submissions
- ✅ Requests are recorded correctly
- ✅ Boards update

---

## Performance Tests

### Performance 1: Large Inventory Handling

**Goal**: Verify system handles many posters efficiently.

**Steps**:
1. Add 50+ posters to Inventory (use Add New Poster dialog in loop)
2. Check Active? for all
3. **Expected**: Form syncs within reasonable time (< 10 seconds)
4. **Expected**: No errors or timeouts

**Pass Criteria**:
- ✅ System handles large inventory without errors
- ✅ Form sync completes successfully

---

## Edge Cases

### Edge 1: Empty Inventory

**Steps**:
1. Uncheck all Active? boxes in Inventory
2. Check the form
3. **Expected**: "Request Posters (Add)" dropdown shows "(No active posters)" or is empty

---

### Edge 2: Duplicate Titles

**Steps**:
1. Add two posters with same title but different release dates
2. **Expected**: Form shows both with (YYYY-MM-DD) suffix to differentiate

---

### Edge 3: Invalid Date Format

**Steps**:
1. Add poster with invalid date (e.g., "December 25")
2. Check Active? box
3. **Expected**: System handles gracefully (may show error or skip)

---

## Security Verification

### Security 1: CodeQL Clean

**Verification**:
- ✅ CodeQL scan completed with 0 alerts
- ✅ No security vulnerabilities introduced

---

## Final Checklist

Before marking this PR as complete, verify:

- [ ] All 11 main tests pass
- [ ] Both regression tests pass
- [ ] Performance test passes
- [ ] Edge cases handled gracefully
- [ ] Security scan shows 0 alerts
- [ ] Documentation is accurate and up-to-date
- [ ] No console errors in Apps Script logs
- [ ] Movie Posters tab can be hidden (no longer needed)

---

## Rollback Plan

If critical issues are found:

1. Restore Inventory column structure to original (remove Active?, Poster ID, etc.)
2. Update `getPostersWithLabels_()` to read from Movie Posters again
3. Revert menu item back to "Refresh Print Out"
4. Re-enable automatic Print Out updates in handleSheetEdit

---

## Support Contact

For issues or questions:
- Check Documentation tab for system health
- Review Error Log sheet for errors
- Run `Poster System` → `Run Setup / Repair` if things break
