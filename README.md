# Movie Poster Request System

A Google Apps Script automation solution that manages employee poster requests at a local business. Built to prevent system abuse with strict validation, inventory tracking, and complete audit logging.

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Setup Instructions](#setup-instructions)
- [How It Works](#how-it-works)
- [Usage Guide](#usage-guide)
- [Admin Menu](#admin-menu)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## 📌 Overview

**Problem Solved:** The original poster request system was being abused with unlimited requests, duplicates, and no accountability.

**Solution:** This system introduces:
- **5-poster limit** per employee at any time
- **Deduplication** - can't request the same poster twice
- **Email accountability** - auto-collected from Google Account
- **Complete audit trail** - every request logged
- **Automated workflows** - form syncing, board generation, notifications

Perfect for movie theaters, restaurants, offices, or any business managing physical inventory distribution.

## ✨ Features

### Core Features
- **Google Form Integration** - Employees submit requests via form
- **Smart Validation** - Name format checking, duplicate prevention, limit enforcement
- **Automated Boards** - Main and Employees sheets auto-update from requests
- **Inventory Tracking** - Display available poster counts
- **Employee Visibility** - Read-only sheets showing active requests

### Notifications
- **Email Subscriptions** - Employees opt-in for poster announcements
- **Batched Announcements** - Multiple posters per email with smart batching
- **Template System** - Variable substitution for personalized emails
- **Dry-Run Preview** - Preview emails before sending
- **Retry & Throttling** - Automatic retry with exponential backoff
- **Custom Messages** - Admin can send special announcements

### Print & Distribution
- **Print-Friendly Layout** - Inventory list with movie details
- **QR Codes** - Links to request form and employee view
- **Admin Tools** - One-click print area preparation

### Employee View
- **Separate Spreadsheet** - Shared read-only copy for employees
- **Safe Sharing** - No sensitive admin data exposed
- **Auto-Sync** - Updates automatically with new requests

### Admin Tools
- **Admin Menu** - 13 easy-to-click management buttons
- **Manual Entry** - Add historical requests for migration
- **Repair Function** - One-click system recovery
- **Complete Logging** - Request Order sheet shows all submissions
- **Analytics & Monitoring** - Track system performance and usage
- **Bulk Simulator** - Stress-test system with N randomized submissions

### Analytics & Performance
- **Performance Metrics** - Track execution time, sheet reads, cache hits, lock waits
- **Analytics Sheet** - Detailed event logging with timestamps
- **Analytics Summary** - Aggregated metrics including cache hit rate, avg times
- **Bulk Load Testing** - Simulate multiple submissions to measure quota usage
- **System Health** - Monitor anomalies and unusual patterns

### Data Protection & Backups
- **Automated Nightly Backups** - Requests and Subscribers sheets backed up daily at 2 AM
- **Google Drive Integration** - Backups stored in dedicated Drive folder
- **Retention Management** - Automatic cleanup of backups older than 30 days
- **Manual Backup** - Run backup anytime from admin menu
- **Multiple Formats** - CSV (default) or Google Sheet format
- **Analytics Logging** - All backup events tracked in Analytics sheet

## 🚀 Quick Start

### Prerequisites
- Google Account with access to Google Sheets
- Google Forms enabled
- Google Apps Script access
- Clasp CLI installed (`npm install -g @google/clasp`)

### 1-Minute Setup
1. Copy the Google Sheet template
2. Go to **Extensions > Apps Script**
3. Copy all files from this repo into the script editor
4. Run `setupPosterSystem()` from the admin menu
5. Share the form with employees
6. Done! ✅

## 📖 Setup Instructions

### Full Setup Guide

#### Step 1: Prepare Your Google Sheet
1. Create a new Google Sheet (name it "Poster Request System" or similar)
2. You'll have a blank sheet with Sheet1

#### Step 2: Add the Code
**Option A: Using Clasp (Recommended)**
```bash
# Clone this repo
git clone https://github.com/MCNEcho/Movie-Poster-Request-System.git
cd Movie-Poster-Request-System

# Login to clasp
clasp login

# Create new Google Sheet
clasp create --type sheets --title "Poster Request System"

# Deploy code
clasp push
```

**Option B: Manual Copy-Paste**
1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete any existing code
4. Copy each `.js` file from this repo into separate script files:
   - `00_Config.js`
   - `01_Setup.js`
   - `02_Utils.js`
   - `03_FormManager.js`
   - `04_SyncForm.js`
   - `05_Ledger.js`
   - `06_SubmitHandler.js`
   - `07_Boards.js`
   - `08_Announcements.js`
   - `09_PrintOutInventory.js`
   - `10_Documentation.js`
   - `11_CustomAnnouncements.js`
   - `12_PrintSelection.js`
   - `13_EmployeeViewSync.js`
   - `99_Debugging.js`
4. Save the project

#### Step 3: Initial Setup
1. Go back to your Google Sheet
2. Wait a few seconds, then refresh the page
3. You should see a new menu called **"🎬 Poster System"** in the menu bar
4. Click **"🎬 Poster System" → "Run Setup / Repair"**
5. The system will auto-create all necessary sheets and the form
6. You'll see a message when complete

#### Step 4: Configure Your Posters
1. In your Sheet, go to the **Movie Posters** tab
2. Add your movies:
   - **Active?** - Check to make it available
   - **Poster ID** - Auto-generated (don't edit)
   - **Title** - Movie name
   - **Release Date** - Date of movie release
   - **Inventory Count** - How many posters you have
3. Check the **Active?** box for posters you want employees to request

#### Step 5: Setup Employee View (Optional)
1. Click **"🎬 Poster System" → "Setup Employee View Spreadsheet"**
2. A new spreadsheet will be created automatically
3. Share that new sheet with employees (Viewer permission only)
4. Employees can see Main and Employees tabs (read-only)

#### Step 6: Share the Form
1. Click **"🎬 Poster System" → "Show Form Link"** to get the form URL
2. Or go to the Sheet, open the **Request Order** tab to find the form link
3. Share this form URL with employees via email, intranet, or posters

## 🔧 How It Works

### The Request Lifecycle

#### 1. Employee Submits Form
```
Employee fills out Google Form:
  - Name (must be "FirstName LastInitial" format, e.g., "Gavin N")
  - Select posters to ADD (from Active posters list)
  - Select posters to REMOVE (only shows posters they already have)
  - Optional: Subscribe to poster notifications
  ↓
Form submission triggers handleFormSubmit()
```

#### 2. Validation & Processing
```
System checks:
  ✓ Name format valid?
  ✓ Removing existing posters?
  ✓ Adding inactive posters?
  ✓ Exceeding 5-poster limit?
  ✓ Already requested this poster before?
  ↓
Removals processed first (frees up slots)
Additions processed second (fills freed slots)
Results logged to Request Order sheet
```

#### 3. Boards Rebuild
```
Main Sheet:
  Grouped by Poster Title
  Shows inventory count
  Lists all employees requesting it
  
Employees Sheet:
  Grouped by Employee Name
  Shows slots used (X/5)
  Lists posters they're requesting
```

#### 4. Form Updates
```
Form's "Add" section - updates to show only ACTIVE posters
Form's "Remove" section - updates to show only posters this employee has
```

#### 5. Notifications (Optional)
```
If new poster is activated:
  Announcement is queued
  Every 15 minutes: email sent to all subscribers
  Email shows poster title, release date, and request form link
```

### Key Validation Rules

| Rule | Details |
|------|---------|
| **Name Format** | Must be "FirstName LastInitial" (e.g., "Gavin N" or "Sarah K.") |
| **Email** | Auto-collected from Google Account (can't be manually entered) |
| **5-Poster Limit** | Maximum 5 ACTIVE posters per employee at any time |
| **No Duplicates** | Employee can't request same poster twice (ever) |
| **Active Only** | Form only shows posters with Active? = TRUE |
| **Removal First** | Removals processed before additions (allows swaps) |

### Data Flow Diagram

```
┌─────────────────┐
│  Google Form    │
│  (Employee)     │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────┐
│  handleFormSubmit()             │
│  (Validates & Processes)        │
└────────┬────────────────────────┘
         │
    ┌────┴───────┐
    ↓            ↓
┌──────────┐  ┌──────────┐
│ Remove   │  │   Add    │
│ Requests │  │ Requests │
└────┬─────┘  └────┬─────┘
     │             │
     └──────┬──────┘
            ↓
   ┌─────────────────────┐
   │  Requests Sheet     │
   │  (Audit Log)        │
   └──────┬──────────────┘
          │
    ┌─────┴────────┐
    ↓              ↓
┌──────────────┐  ┌──────────────────┐
│  Main Sheet  │  │  Employees Sheet │
│  (By Poster) │  │  (By Employee)   │
└──────────────┘  └──────────────────┘
    ↓                    ↓
┌───────────────────────────────┐
│  Employee View Spreadsheet    │
│  (Read-Only Copy)             │
└───────────────────────────────┘
```

### Sheet Schemas

#### Requests Sheet (Internal Ledger)
| Column | Purpose |
|--------|---------|
| Timestamp | When request was made |
| Email | Employee's email |
| Name | Employee's name |
| Poster ID | Which poster |
| Label | Poster title (with date if duplicate) |
| Title Snapshot | Title at time of request |
| Release Snapshot | Release date at time of request |
| Action Type | "ADD" or "REMOVE" |
| Status | "ACTIVE" or "REMOVED" |
| Status Timestamp | When status changed |

#### Movie Posters Sheet (Admin)
| Column | Purpose |
|--------|---------|
| Active? | Checkbox to show/hide from form |
| Poster ID | Unique identifier |
| Title | Movie name |
| Release Date | Release date |
| Inventory Count | Physical stock |
| Received | Internal notes |
| Notes | Admin notes |
| Close Queue? | Special feature (trigger announcements) |

#### Main Sheet (Employee View)
```
Poster Title (Inventory: 5)
  Gavin N          1/20/2026
  Sarah K          1/21/2026
  
Avatar (Inventory: 3)
  Miles P          1/19/2026
```

## 📱 Usage Guide

### For Employees

#### Making a Request
1. **Open the Form** - Get link from manager or posters
2. **Enter Your Name** - Format: "FirstName LastInitial" (e.g., "Gavin N")
3. **Select Posters to Add** - Check any available posters
4. **Select Posters to Remove** (Optional) - Uncheck if you want to swap
5. **Subscribe to Notifications** (Optional) - Get emails about new posters
6. **Submit** - Click Submit button

#### Checking Your Requests
1. **View Main Sheet** - See all active requests by poster
2. **View Employees Sheet** - See your requests and slot usage (X/5)
3. **On Form** - Remove section only shows YOUR posters

#### Swapping Posters
```
Want to swap "Movie A" for "Movie B"?
  1. Check "Movie B" in Add section
  2. Check "Movie A" in Remove section
  3. Submit (one submission handles both)
```

#### Invalid Submissions
If your submission is denied:
- Check **Request Order** sheet for the reason
- **"already requested"** - You've requested this poster before
- **"limit (5-slot)"** - You already have 5 active posters
- **"inactive"** - That poster isn't available anymore

### For Admins

#### Daily Tasks
```
1. Check Request Order sheet for new submissions
2. Review Main and Employees sheets for accuracy
3. Add/remove posters in Movie Posters sheet as needed
```

#### Weekly Tasks
```
1. Review Requests sheet for patterns
2. Update Inventory counts in Movie Posters
3. Archive old announcements if needed
4. Check employee feedback
```

#### Monthly Tasks
```
1. Run full board rebuild (if issues detected)
2. Review subscriber list
3. Audit Request Order sheet
4. Export data for reporting
```

## 🎯 Admin Menu

Click **"🎬 Poster System"** in menu bar to see:

### 1. Prepare Print Area (Select & Print)
- Generates print-friendly sheet with movie list
- Includes QR codes for Form and Employee View
- Automatically selects best print area
- Ready to print and post

### 2. Run Setup / Repair
- One-time: Initializes entire system
- Fix: Repairs broken sheets or form
- Creates missing triggers
- Rebuilds everything from scratch

### 3. Sync Form Options Now
- Updates form with current active posters
- Updates Remove list based on current requests
- Runs automatically after submissions
- Use if form seems out of sync

### 4. Rebuild Boards Now
- Refreshes Main and Employees sheets
- Pulls data fresh from Requests sheet
- Clears orphaned rows
- Useful if data looks wrong

### 5. Refresh Print Out
- Updates Print Out sheet with current posters
- Refreshes movie list and inventory counts
- Adds current form and employee view URLs

### 6. Refresh Documentation
- Auto-generates Documentation sheet
- Shows system rules
- Explains all admin menu buttons
- Employee-friendly guide

### 7. Manually Add Request (for migration)
- Dialog to manually add historical requests
- Useful when migrating from old system
- Adds directly to Requests ledger
- Shows what would be added before confirming

### 8. Preview Pending Announcement
- Shows draft of email that will be sent
- Displays fully rendered template with substituted variables
- Shows recipient count and poster list
- Dry-run preview with actual email body
- Helps catch typos before sending

### 9. Send Announcement Now
- Manually trigger email to all subscribers
- Sends immediately (doesn't wait 15 minutes)
- Good for urgent announcements

### 10. Run Bulk Submission Simulator
- **NEW**: Stress-test the system with randomized submissions
- Simulates N submissions with random add/remove poster selections
- Tracks performance metrics: execution time, sheet reads, cache hits, lock waits
- **Dry-run mode**: Test without modifying data (recommended first)
- **Live mode**: Actually processes submissions
- Safety guardrails:
  - Hard cap at 100 simulations per run
  - Warning prompt for N >= 50 in live mode
- Results logged to Analytics sheet
- Use to:
  - Test system under load
  - Measure performance with different N values
  - Validate quota usage before production stress
  - Generate sample data for testing
### 10. Run Backup Now
- Manually trigger backup of Requests and Subscribers sheets
- Creates backups in Google Drive
- Shows backup folder link when complete
- Runs independently of nightly automated backup

### 11. Setup Employee View Spreadsheet
- Creates separate read-only spreadsheet
- One-time setup only
- Copies Main and Employees sheets
- Can be safely shared with all employees

### 12. Sync Employee View Now
- Manually update employee view spreadsheet
- Useful if auto-sync is delayed
- Clears old data and copies fresh

### 13. Show Employee View Link
- Displays URL of employee view spreadsheet
- Easy to copy and share
- Updates automatically in Print Out sheet

## ⚙️ Configuration

### Changing System Limits

**Edit `00_Config.js`:**

#### Change Max Posters Per Employee
```javascript
CONFIG.MAX_ACTIVE = 5;  // Change 5 to desired number (e.g., 3 or 10)
```

#### Change Form Title & Description
```javascript
CONFIG.FORM_META = {
  TITLE: "Poster Request Form - Pasco",
  DESCRIPTION: "Your custom description here"
};
```

#### Change Timezone
```javascript
CONFIG.TIMEZONE = "America/Los_Angeles";  // or your timezone
```

### Sheet Names

All sheet names are configurable in `CONFIG.SHEETS`:
```javascript
CONFIG.SHEETS = {
  REQUESTS: "Requests",
  MOVIE_POSTERS: "Movie Posters",
  MAIN: "Main",
  // ... etc
};
```

If you rename a sheet, update the corresponding value in `CONFIG.SHEETS`.

### Status Codes

Active requests use `"ACTIVE"` status.
Removed requests use `"REMOVED"` status.
These are constants in `STATUS` object and shouldn't be changed.

## 🐛 Troubleshooting

### Form Submission Not Logging

**Problem:** Submitted form but nothing shows in Requests sheet

**Possible Causes:**
- Name format invalid (must be "FirstName LastInitial")
- Triggers not installed
- Lock timeout from previous operation

**Solutions:**
1. Check **Request Order** sheet - should show a row with reason
2. Click **"Run Setup / Repair"** - reinstalls triggers
3. Try submitting again
4. Check execution logs: **Extensions > Apps Script > Executions**

### Posters Not Appearing in Form

**Problem:** Added poster to Movie Posters but it's not in form

**Possible Causes:**
- Active? checkbox is unchecked
- Title or Release Date field is empty
- Form sync hasn't run yet

**Solutions:**
1. Check Movie Posters sheet: **Active? = TRUE**
2. Ensure Title and Release Date are filled
3. Click **"Sync Form Options Now"**
4. Wait 30-60 seconds for form to update
5. Refresh form in browser

### Employee Can't Remove a Poster

**Problem:** Employee has the poster but Remove list doesn't show it

**Possible Causes:**
- Poster was already removed (check Main sheet)
- Form sync is delayed
- Different email used

**Solutions:**
1. Check Main or Employees sheet - see if it's actually there
2. Click **"Sync Form Options Now"**
3. Verify same email address in Requests sheet
4. If wrong employee, manually remove from Requests

### Orphaned Names Appear at Bottom of Sheets

**Problem:** Old employee names at bottom with no poster header

**Possible Causes:**
- Removed poster but rows weren't cleared
- Interrupted board rebuild
- This was a bug in earlier versions (now fixed)

**Solutions:**
1. Click **"Rebuild Boards Now"**
2. Rows should automatically clear
3. If still there, manually delete
4. Run **"Run Setup / Repair"** if persistent

### Email Announcements Not Sending

**Problem:** Queued announcement but no email received

**Possible Causes:**
- No subscribers (check Subscribers sheet)
- Announcement queue is empty
- Time-based trigger disabled
- Email filtering

**Solutions:**
1. Check **Subscribers** sheet - any Active subscribers?
2. Click **"Preview Pending Announcement"** - see if queue has items
3. Click **"Send Announcement Now"** to test
4. Verify trigger exists: **Extensions > Apps Script > Triggers**
5. Check spam folder for emails

### Employee View Not Syncing

**Problem:** Employee view spreadsheet not updating

**Possible Causes:**
- Not set up yet
- Permissions issues
- Sheet copy failed
- Network error

**Solutions:**
1. Click **"Setup Employee View Spreadsheet"**
2. Check logs for errors: **Extensions > Apps Script > Executions**
3. Verify sheets are named "Main" and "Employees"
4. Click **"Sync Employee View Now"** manually
5. Share spreadsheet with employees (Viewer only)

### Permission Errors

**Problem:** "You don't have permission" or similar error

**Causes:**
- Trying to edit employee view spreadsheet (it's read-only)
- Employee view spreadsheet not shared properly

**Solutions:**
1. Employee view is intentionally read-only - don't edit directly
2. Edit Main and Employees sheets in original spreadsheet
3. Click "Sync Employee View Now" to push changes
4. Share employee view with Viewer permission (not Editor)

## 📁 Project Structure

```
poster-request-system/
├── 00_Config.js                 # Configuration & constants
├── 01_Setup.js                  # Setup & initialization
├── 02A_CacheManager.js          # Performance caching layer
├── 02_Utils.js                  # Utility functions
├── 02A_CacheManager.js          # Caching layer for performance
├── 03_FormManager.js            # Form creation & management
├── 04_Analytics.js              # Analytics tracking & monitoring
├── 04_Analytics.js              # Analytics & logging
├── 04_SyncForm.js               # Form option syncing
├── 05_Ledger.js                 # Request ledger queries
├── 06_SubmitHandler.js          # Form submission processing
├── 07_Boards.js                 # Main & Employees board building
├── 08_Announcements.js          # Email batching, templates & sending
├── 09_PrintOutInventory.js      # Print layout generation
├── 10_Documentation.js          # Documentation sheet building
├── 11_CustomAnnouncements.js    # Custom message handling
├── 12_PrintSelection.js         # Print area preparation
├── 13_EmployeeViewSync.js       # Employee view spreadsheet sync
├── 14_ManualRequestEntry.js     # Manual request entry tool
├── 15_DataIntegrity.js          # Data validation & integrity checks
├── 99_Debuging.js               # Debug utilities & logging
├── 99_ErrorHandler.js           # Error handling & retry logic
├── 14_ManualRequestEntry.js     # Manual request entry dialog
├── 15_DataIntegrity.js          # Data integrity checks
├── 16_BulkSimulator.js          # Bulk submission simulator (NEW)
├── 99_Debuging.js               # Debug utilities & logging
├── 99_ErrorHandler.js           # Error handling & logging
├── 15_DataIntegrity.js          # Data validation & integrity checks
├── 16_BackupManager.js          # Nightly backup to Google Drive (NEW)
├── 99_BackupTests.js            # Backup testing suite (NEW)
├── 99_Debugging.js              # Debug utilities & logging
├── 99_ErrorHandler.js           # Error logging & handling
├── 04_Analytics.js              # Analytics & monitoring
├── 02A_CacheManager.js          # Performance caching
├── appsscript.json              # Google Apps Script manifest
├── ANNOUNCEMENT_BATCHING.md     # Announcement batching documentation
├── PROJECT_DOCUMENTATION.txt    # Detailed technical docs
├── BACKUP_TESTING_GUIDE.md      # Backup testing & verification (NEW)
├── BACKUP_IMPLEMENTATION_SUMMARY.md  # Backup feature summary (NEW)
└── README.md                    # This file
```

## 📊 Key Functions

### Core Handlers
- `handleFormSubmit()` - Processes form submissions
- `handleSheetEdit()` - Handles sheet changes
- `processAnnouncementQueue()` - Sends emails every 15 min

### Analytics & Monitoring (NEW)
- `logSubmissionEvent_()` - Log form submission metrics
- `logBulkSimulationEvent_()` - Log bulk simulation results
- `updateAnalyticsSummary_()` - Update aggregated metrics
- `getCacheStats_()` - Get cache hit rates and performance

### Bulk Simulator (NEW)
- `runBulkSimulator()` - Main simulator function with N parameter and dry-run mode
- `generateTestEmployee_()` - Create randomized test employees
- `generateRandomSubmissionData_()` - Generate random add/remove sets
- `simulateSingleSubmission_()` - Simulate one submission with metrics tracking
- `showBulkSimulatorDialog()` - Display admin dialog UI

### Form Processing
- `processSubmission_()` - Main submission processor
- `processRemovals_()` - Removes posters from requests
- `processAdditions_()` - Adds new poster requests
- `syncPostersToForm()` - Updates form options

### Board Building
- `rebuildBoards()` - Rebuilds Main and Employees sheets
- `buildMainBoard_()` - Creates Main sheet view
- `buildEmployeesBoard_()` - Creates Employees sheet view

### Utilities
- `getActiveRequests_()` - Gets all active requests
- `getPostersWithLabels_()` - Gets posters with dedup labels
- `normalizeEmployeeName_()` - Validates name format

## 💡 Tips & Best Practices

### For Admins

1. **Regular Audits**
   - Check Request Order sheet weekly
   - Look for denied submissions
   - Identify patterns in requests

2. **Poster Management**
   - Use meaningful release dates for sorting
   - Keep inventory counts updated
   - Archive old posters (set Active? = FALSE)

3. **Employee View**
   - Update the view monthly
   - Share with all staff
   - Post the link on office bulletin boards

4. **Announcements**
   - Use custom announcements for special movies
   - Send at optimal times (e.g., Monday morning)
   - Keep messages concise

5. **Backups**
   - **Automated Nightly Backups** - System automatically backs up Requests and Subscribers sheets to Google Drive at 2 AM daily
   - **Manual Backups** - Run backup anytime from "Poster System → Run Backup Now" menu
   - **30-Day Retention** - Old backups automatically deleted (configurable)
   - **Google Sheets Auto-Save** - Google Sheets auto-saves all changes (no action needed)
   - **Optional Manual Export** - Export any sheet monthly for extra archival if desired
   - See `BACKUP_TESTING_GUIDE.md` for backup configuration and testing

### For Setup

1. **Test Before Production**
   - Add test posters to Movie Posters
   - Submit test requests yourself
   - Verify form and boards work
   - Then share with employees

2. **Employee Communication**
   - Explain 5-poster limit in advance
   - Provide name format examples
   - Link to Documentation sheet
   - Answer questions proactively

3. **Monitoring**
   - Check Request Order sheet daily first week
   - Monitor email delivery
   - Adjust form questions if needed
   - Gather feedback from employees

## 📞 Support & Issues

If you encounter issues:

1. **Check Troubleshooting section** above
2. **Review logs**: Extensions > Apps Script > Executions
3. **Check Request Order sheet** for denial reasons
4. **Run "Run Setup / Repair"** to fix common issues
5. **Review PROJECT_DOCUMENTATION.txt** for detailed technical info

## 📝 License

This project is provided as-is for local business use.

## 🙏 Credits

Built to solve real-world poster request abuse at a local business.
Designed with simplicity and reliability in mind.

---

**Last Updated:** January 2026  
**Version:** 1.2 (Announcement Batching)  
**Status:** Production Ready ✅

## 🎉 Recent Updates

### Version 1.2 - Announcement Batching (Latest)
- **Template System** with variable substitution ({{TITLE}}, {{RELEASE}}, etc.)
- **Batch Multiple Posters** into single emails (configurable batch size)
- **Dry-Run Preview** showing actual rendered email before sending
- **Retry Logic** with exponential backoff for transient failures
- **Email Throttling** to avoid quota spikes
- **Analytics Logging** for all announcement events
- See [ANNOUNCEMENT_BATCHING.md](./ANNOUNCEMENT_BATCHING.md) for details
