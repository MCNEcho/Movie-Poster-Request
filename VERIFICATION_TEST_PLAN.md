# Verification Test Plan: Print Out, Inventory, and Display Tabs Integration

## Test Environment
- Repository: Movie-Poster-Request
- Branch: copilot/verify-print-out-inventory-display
- Date: 2026-01-25

## Test Checklist

### 1. Configuration Updates ✅
- [x] CONFIG.SHEETS includes POSTER_OUTSIDE and POSTER_INSIDE
- [x] COLS.INVENTORY has 12 columns
- [x] COL_COUNTS.INVENTORY = 12
- [x] MAX_TITLE_SLUG_LENGTH = 20
- [x] INVENTORY_LAST_UPDATED_CELL = 'N1'

### 2. Menu Structure
**Test Steps:**
1. Open Google Sheets with the Poster System
2. Navigate to "Poster System" menu
3. Verify menu structure:
   - [ ] Print & Layout → "Update Print Out" (not "Refresh Print Out")
   - [ ] Display Management → "Setup Outside", "Setup Inside", "Refresh Dropdowns"
   - [ ] Advanced → "Add New Poster" (first item)

### 3. Inventory Behavior
**Test Steps:**
1. Navigate to Inventory sheet
2. Verify columns:
   - [ ] Column A: Active? (checkbox)
   - [ ] Column B: Release Date
   - [ ] Column C: Movie Title
   - [ ] Column D: Company
   - [ ] Column E: Posters
   - [ ] Column F: Bus Shelters
   - [ ] Column G: Mini Posters
   - [ ] Column H: Standee
   - [ ] Column I: Teaser
   - [ ] Column J: Poster ID (hidden)
   - [ ] Column K: Poster Received Date
   - [ ] Column L: Notes
   - [ ] Column N: Last Updated timestamp

3. Test auto-sort:
   - [ ] Add a new poster with a date earlier than existing posters
   - [ ] Edit the sheet and verify it auto-sorts by Release Date (column B)

4. Test Poster ID auto-generation:
   - [ ] Add a poster without Poster ID
   - [ ] Edit the sheet and verify Poster ID is auto-generated in format: `{titleSlug}_{YYYYMMDD}`

### 4. Add New Poster Dialog
**Test Steps:**
1. Go to Advanced → "Add New Poster"
2. Verify dialog opens with fields:
   - [ ] Active? (checkbox, default checked)
   - [ ] Release Date (required)
   - [ ] Movie Title (required)
   - [ ] Company
   - [ ] Posters Count
   - [ ] Bus Shelters Count
   - [ ] Mini Posters Count
   - [ ] Standee Count
   - [ ] Teaser Count
   - [ ] Poster Received Date
   - [ ] Notes

3. Test form submission:
   - [ ] Fill in required fields (Release Date, Movie Title)
   - [ ] Click "Add Poster"
   - [ ] Verify poster is added to Inventory
   - [ ] Verify Poster ID is auto-generated
   - [ ] Verify sheet is auto-sorted by Release Date
   - [ ] Verify success message

### 5. Print Out Manual Update
**Test Steps:**
1. Go to Print & Layout → "Update Print Out"
2. Verify:
   - [ ] Print Out sheet is updated
   - [ ] Lists only ACTIVE posters from Inventory
   - [ ] Posters are sorted by Release Date
   - [ ] No automatic refresh when editing Inventory

3. Test manual-only behavior:
   - [ ] Edit an Inventory row (change a value)
   - [ ] Verify Print Out is NOT automatically updated
   - [ ] Manually run "Update Print Out"
   - [ ] Verify Print Out is now updated

### 6. Display Tabs
**Test Steps:**
1. Go to Display Management → "Setup Outside"
   - [ ] Verify Poster Outside sheet is created
   - [ ] Verify header "Poster Outside Display"
   - [ ] Verify timestamp "Last Updated"
   - [ ] Verify dropdown at B4 with ACTIVE Inventory items

2. Go to Display Management → "Setup Inside"
   - [ ] Verify Poster Inside sheet is created
   - [ ] Verify header "Poster Inside Display"
   - [ ] Verify timestamp "Last Updated"
   - [ ] Verify dropdown at B4 with ACTIVE Inventory items

3. Test dropdown refresh:
   - [ ] Add a new ACTIVE poster to Inventory
   - [ ] Go to Display Management → "Refresh Dropdowns"
   - [ ] Verify both dropdowns now include the new poster
   - [ ] Verify timestamps are updated

4. Test ACTIVE filtering:
   - [ ] Uncheck ACTIVE on an Inventory poster
   - [ ] Run "Refresh Dropdowns"
   - [ ] Verify the poster is removed from both dropdowns

### 7. Form + Announcements
**Test Steps:**
1. Edit Inventory and add a new ACTIVE poster
2. Verify:
   - [ ] No automatic Print Out refresh
   - [ ] Announcement is queued for the poster
   - [ ] syncPostersToForm() is called
   - [ ] Movie Posters sheet is updated with inventory counts

### 8. Code Consistency
**Verification:**
- [x] No references to "refreshPrintOut" in menu code
- [x] All display code uses CONFIG.SHEETS.POSTER_OUTSIDE and CONFIG.SHEETS.POSTER_INSIDE
- [x] handleSheetEdit for Inventory does NOT call updatePrintOut()
- [x] handleSheetEdit for Movie Posters does NOT call updatePrintOut()
- [x] All column references use COLS.INVENTORY
- [x] All column counts use COL_COUNTS.INVENTORY

### 9. Security & Quality
- [x] CodeQL checker passed with 0 alerts
- [x] No hardcoded column counts (using COL_COUNTS)
- [x] No hardcoded magic numbers (using CONFIG constants)
- [x] Shared utility functions (generatePosterId_)

## Expected Results

### Menu Structure
```
Poster System
├── 🔧 Run Setup / Repair
├── 🔄 Refresh All
├── 📊 Reports
│   ├── Rebuild Boards
│   ├── Sync Form Options
│   ├── Refresh Documentation
│   └── Refresh Health Banner
├── 🖨️ Print & Layout
│   ├── Prepare Print Area
│   └── Update Print Out
├── 🖼️ Display Management
│   ├── Setup Outside
│   ├── Setup Inside
│   └── Refresh Dropdowns
├── 📧 Announcements
│   ├── Preview Pending
│   └── Send Now
└── ⚙️ Advanced
    ├── Add New Poster
    ├── Manually Add Request
    ├── Run Bulk Simulator
    ├── Run Backup Now
    ├── Setup Employee View
    ├── Sync Employee View
    └── Show Employee View Link
```

### Inventory Structure (12 columns)
| Active? | Release Date | Movie Title | Company | Posters | Bus Shelters | Mini Posters | Standee | Teaser | Poster ID | Received Date | Notes |
|---------|-------------|-------------|---------|---------|--------------|--------------|---------|--------|-----------|---------------|-------|
| ☑       | 2026-03-15  | Example     | Studio  | 5       | 2            | 10           | 1       | 3      | example_20260315 | 2026-01-10 | Test |

## Test Results

### Automated Checks
- ✅ Syntax validation: All files pass
- ✅ Code review: All issues addressed
- ✅ Security scan: 0 vulnerabilities

### Manual Testing
(To be completed by tester)

## Notes
- Movie Posters remains the source for form options (by design)
- Inventory is the source for physical inventory counts and display tabs
- Print Out now reads from Inventory ACTIVE items instead of Movie Posters
- All automatic Print Out refresh hooks have been removed (manual-only)
