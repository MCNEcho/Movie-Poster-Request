# Admin Menu Guide: Every Button Explained

The **Poster System** menu is your control center. Here's what every button does, in plain English.

---

## Top Level Buttons (Always Visible)

### 🔧 Run Setup / Repair
**What it does:** Initializes the entire system OR fixes it if something breaks.

**When to use it:**
- When you very first set up the system
- If sheets are missing
- If the form isn't working
- If the menu disappeared
- If boards aren't updating

**What happens:**
- Creates all sheets (if missing)
- Creates/fixes the Google Form
- Sets up automatic triggers (watches for changes)
- Rebuilds the Main Board and Employees Board
- Sets up Health monitoring

**How long:** 30-60 seconds

**Safe to run anytime?** Yes! It won't delete your data.

---

### 🔄 Refresh All
**What it does:** Updates everything that might be out of date.

**When to use it:**
- After adding new posters
- After employees submit many requests
- After you make manual edits to sheets
- When something looks wrong but you didn't change anything

**What happens:**
- Rebuilds the Main Board and Employees Board (refreshes all request data)
- Updates the form with current posters
- Refreshes system health info in Documentation tab

**How long:** 5-10 seconds

---

## Reports Menu

### 📊 Rebuild Boards Now
**What it does:** Recreates the visual displays (Main Board and Employees Board).

**When to use it:**
- Formatting looks odd on boards
- Numbers don't match what you expected
- You manually edited the Requests sheet

**What happens:**
- Clears the Main Board and Employees Board completely
- Re-reads all requests from the Requests sheet (the official record)
- Rebuilds the displays from scratch

**How long:** 5-10 seconds

**Safe?** Yes, it doesn't delete requests. It just redisplays them.

---

### 📋 Sync Form Options Now
**What it does:** Updates the Google Form with current posters.

**When to use it:**
- After adding a new poster to Movie Posters sheet
- After hiding a poster (setting Active? to FALSE)
- Employees say a poster doesn't appear in the form

**What happens:**
- Reads all posters from Movie Posters sheet where Active? = TRUE
- Updates the form's "Request Posters (Add)" dropdown
- Employees see the new list next time they open the form

**How long:** 2-3 seconds

---

### 📄 Refresh Documentation
**What it does:** Updates the Documentation tab with latest system info.

**When to use it:**
- System Health section looks empty or old
- You want to see the latest status
- After running other operations

**What happens:**
- Refreshes the system health dashboard (shows trigger status, cache health, errors)
- Updates configuration settings display
- Updates form link

**How long:** 2-3 seconds

---

### 💚 Refresh Health Banner
**What it does:** Updates system health info (same as Refresh Documentation).

**When to use it:**
- You want the latest system status
- Checking if there are any errors

**What happens:**
- Collects latest trigger status, cache stats, error info
- Updates Documentation tab with health section

**How long:** 1-2 seconds

---

## Print & Layout Menu

### 🖨️ Prepare Print Area (Select & Print)
**What it does:** Opens the print layout and lets you choose what to print.

**When to use it:**
- You want to print the inventory/poster list
- Making a poster board or poster list to post somewhere
- Need a physical copy of what's active

**What happens:**
- Opens the Print Out sheet
- Lets you select which area to print
- Shows print preview

**How long:** Instant

**Tips:**
- The Print Out sheet has QR codes you can scan
- It shows which posters are currently active
- Contains inventory counts

---

### 🔧 Refresh Print Out
**What it does:** Updates the Print Out sheet with latest inventory and posters.

**When to use it:**
- After adding new posters
- After updating inventory counts
- Before printing (to ensure it's current)

**What happens:**
- Updates the Print Out sheet with current active posters
- Updates inventory numbers
- Updates QR codes

**How long:** 2-3 seconds

---

## Announcements Menu

### 👁️ Preview Pending Announcement
**What it does:** Shows you the draft email that will be sent when new posters are announced.

**When to use it:**
- Before sending announcements
- To check what employees will receive
- To verify new posters are being announced

**What happens:**
- Shows a popup with the draft announcement email
- Shows which posters will be included
- Shows who will receive it

**How long:** Instant

---

### 📧 Send Announcement Now
**What it does:** Immediately sends the pending announcement email to all subscribers.

**When to use it:**
- You want to announce new posters to employees right now
- You don't want to wait for the automatic 15-minute batch send
- You just added exciting new posters

**What happens:**
- Sends email to all subscribers with pending announcements
- Email includes list of new posters
- Clears the pending queue

**How long:** A few seconds (emails send in background)

**Note:** Announcements are usually sent automatically every 15 minutes. This just sends immediately.

---

## Advanced Menu

### ➕ Manually Add Request
**What it does:** Opens a dialog to add a request manually (for data migration).

**When to use it:**
- You have historical requests from before the system existed
- You want to add a request without using the form
- Fixing/recovering lost data

**What happens:**
- Opens a popup form
- You enter: Employee name, employee email, poster title
- The request is added to the Requests sheet
- Boards rebuild automatically

**How long:** 1 minute

**Careful:** Make sure you use the exact format (FirstName LastInitial) or it will be rejected.

---

### 🎯 Run Bulk Simulator
**What it does:** Stress test the system with fake requests (for testing).

**When to use it:**
- You want to test how the system handles many requests
- You're testing performance
- You want to see what the boards look like with lots of data

**What happens:**
- Opens a dialog asking how many fake submissions to create
- Can create up to 100 at once
- Creates realistic-looking requests with random posters
- Option to do a "dry run" (see what would happen without actually submitting)

**How long:** Depends on number of requests (usually 30-60 seconds for 50 requests)

**Safe to use:** Yes, but the test requests will be in your data. You can manually delete them from the Requests sheet if needed.

---

### 💾 Run Backup Now
**What it does:** Creates an immediate backup of all your data to Google Drive.

**When to use it:**
- Before making big changes
- You want a snapshot of current state
- Manual backup (system does this automatically every night too)

**What happens:**
- Creates a backup folder in your Google Drive
- Saves all sheets as a CSV file (or Google Sheet, depending on config)
- Names it with today's date
- Keeps last 30 days of backups (deletes older ones automatically)

**How long:** 5-10 seconds

---

### 🌐 Setup Employee View Spreadsheet
**What it does:** Creates a separate read-only spreadsheet for employees to view (one-time setup).

**When to use it:**
- First time setting up the system
- You want employees to see a simplified view of active posters
- Only needs to run once!

**What happens:**
- Creates a new Google Sheet with "Employee View" in the name
- Syncs Main Board and Employees Board data to it
- Sets it to read-only (employees can see but not edit)
- Saves the link for sharing

**How long:** 5-10 seconds

**Run this:** Only once during initial setup.

---

### 🔗 Sync Employee View Now
**What it does:** Updates the employee-facing spreadsheet with latest data.

**When to use it:**
- After new requests are submitted
- After deleting/removing posters
- Before sharing the link with employees (to ensure current)

**What happens:**
- Copies latest Main Board and Employees Board
- Pastes to the employee-facing spreadsheet
- Employees see up-to-date list of active posters

**How long:** 2-3 seconds

---

### 📋 Show Employee View Link
**What it does:** Displays the URL of the employee-facing spreadsheet.

**When to use it:**
- You need to share the link with employees
- You forgot the link
- Sending new employee onboarding info

**What happens:**
- Shows a popup with the clickable link
- You can copy and paste it to share with employees

**How long:** Instant

---

## Quick Reference: When Something Is Wrong

| Problem | Solution |
|---------|----------|
| New poster doesn't appear in form | Click **Sync Form Options Now** |
| Boards show wrong data | Click **Rebuild Boards Now** |
| Something looks broken | Click **Run Setup / Repair** |
| Want to announce new posters | Click **Send Announcement Now** |
| Before printing the poster list | Click **Refresh Print Out** |
| Making a backup before big changes | Click **Run Backup Now** |
| Employee spreadsheet out of date | Click **Sync Employee View Now** |
| Want to check system health | Click **Refresh Documentation** and look at health section |

---

## Pro Tips

1. **"Run Setup / Repair" is your friend** - If anything seems broken, try this first. It won't delete your data.

2. **Run "Refresh All" after big operations** - If you add many new posters or modify things, refresh to make sure everything is in sync.

3. **Announcements happen automatically** - You don't need to manually send emails. The system does it every 15 minutes. Use "Send Announcement Now" only for urgent announcements.

4. **Backups are automatic** - The system backs up every night at 2am. The "Run Backup Now" button is just for manual backups if you're about to make risky changes.

5. **Documentation tab is your dashboard** - Go there to see system health, configuration, and a form link. It updates automatically.

---

## Need Help?

- **Question about a button?** Come back to this guide.
- **Want to add a poster?** See the "Adding Posters" guide.
- **Want to understand requests?** See the "Understanding Requests" guide.
- **System health looks bad?** Go to Documentation tab and check the health section.

