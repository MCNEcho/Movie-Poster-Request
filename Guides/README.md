# Guides — Complete Documentation

Welcome! This folder contains in-depth guides for every aspect of the Movie Poster Request System.

---

## 📚 Guide Overview

### For First-Time Users
Start here if you're new to the system:
1. **[Getting Started](GETTING_STARTED.md)** — Setup, configuration, and first-time checklist
2. **[Understanding the Form](UNDERSTANDING_THE_FORM.md)** — What employees see when they request posters

### For Regular Admins
Use these for day-to-day operations:
3. **[Admin Menu Guide](ADMIN_MENU_GUIDE.md)** — What every button does (detailed explanations)
4. **[Adding Posters](ADDING_POSTERS.md)** — Step-by-step: how to add movies to the system
5. **[Understanding Requests](UNDERSTANDING_REQUESTS.md)** — How the system tracks and displays requests

### For Troubleshooting
When something goes wrong:
6. **[Troubleshooting Guide](TROUBLESHOOTING.md)** — Common problems and solutions

### For Advanced Users
Fine-tune the system:
7. **[Advanced Configuration](ADVANCED_CONFIG.md)** — Customize settings in Config.js

---

## 🎯 Quick Navigation by Task

### "I want to..."

**Set up the system for the first time**
→ [Getting Started](GETTING_STARTED.md)

**Add a movie poster**
→ [Adding Posters](ADDING_POSTERS.md)

**Understand what the Admin Menu does**
→ [Admin Menu Guide](ADMIN_MENU_GUIDE.md)

**See how many posters each employee has**
→ [Understanding Requests](UNDERSTANDING_REQUESTS.md)

**Fix something that's broken**
→ [Troubleshooting Guide](TROUBLESHOOTING.md)

**Change the 7-poster limit or other settings**
→ [Advanced Configuration](ADVANCED_CONFIG.md)

**Know what the form looks like for employees**
→ [Understanding the Form](UNDERSTANDING_THE_FORM.md)

---

## 📖 Detailed Guide Descriptions

### 1. Getting Started (GETTING_STARTED.md)

**What's in it:**
- Prerequisites (what you need)
- Step-by-step deployment (running the setup script)
- Configuration (setting spreadsheet ID, time zone, etc.)
- Initial setup checklist
- Verification (how to confirm it worked)
- Adding your first poster
- Sharing with employees
- Key terminology

**Read this if:**
- You're setting up the system for the first time
- You're deploying to a new Google Account
- You need a refresher on the process

**Time to read:** 15 minutes

---

### 2. Admin Menu Guide (ADMIN_MENU_GUIDE.md)

**What's in it:**
- Every button in the Poster System menu
- What each button does (in plain English)
- When to use each button
- What happens when you click it
- How long it takes
- Is it safe to use repeatedly?
- Quick reference table for common problems

**Read this if:**
- You don't understand what a button does
- You're unsure if something is safe to click
- You want to know the difference between "Sync Form" and "Rebuild Boards"

**Time to read:** 20 minutes (or use as reference)

---

### 3. Adding Posters (ADDING_POSTERS.md)

**What's in it:**
- How to open the Movie Posters sheet
- Step-by-step: adding a new poster
- Correct formatting for Title and Release Date
- How to add multiple posters at once
- The critical "Sync" step (and why it matters)
- How to verify it worked
- How to hide a poster without deleting requests
- Troubleshooting if it doesn't appear

**Read this if:**
- You want to add a movie to the system
- A poster you added doesn't show in the form
- You want to know the exact date format required

**Time to read:** 10 minutes

---

### 4. Understanding the Form (UNDERSTANDING_THE_FORM.md)

**What's in it:**
- What the Google Form looks like to employees
- Each question on the form explained
- How employees request posters
- How employees remove posters
- How to update the form (syncing)
- How to share the form with employees (link or QR code)
- What happens behind the scenes when they submit
- Common employee mistakes and fixes

**Read this if:**
- You want to understand what employees see
- An employee is confused about the form
- You're teaching someone else how to use it

**Time to read:** 15 minutes

---

### 5. Understanding Requests (UNDERSTANDING_REQUESTS.md)

**What's in it:**
- Where requests are stored (Requests sheet)
- What data is recorded for each request
- What "ACTIVE" vs "REMOVED" means
- How the Main Board works (visual display)
- How the Employees Board works (personal view)
- Step-by-step walkthrough of a request submission
- Why requests get denied
- How boards automatically update
- How to analyze request patterns

**Read this if:**
- You want to see who requested what
- You're confused about the Main Board or Employees Board
- You want to understand why a request was rejected

**Time to read:** 15 minutes

---

### 6. Troubleshooting Guide (TROUBLESHOOTING.md)

**What's in it:**
- Most common problems and solutions
- Before you troubleshoot (quick fixes to try first)
- "Poster System menu doesn't appear" — causes and fixes
- "New poster doesn't appear in form" — causes and fixes
- "Employee can't open the form" — causes and fixes
- "Boards show wrong data" — causes and fixes
- "Getting permission denied errors" — causes and fixes
- "Announcements not sending" — causes and fixes
- "System Health shows errors" — what they mean and fixes
- Recovery if you accidentally deleted data
- Prevention tips to avoid problems

**Read this if:**
- Something isn't working
- You're getting an error message
- Employee is having trouble with the form
- You want to prevent problems

**Time to read:** 10-20 minutes (depending on your issue)

---

### 7. Advanced Configuration (ADVANCED_CONFIG.md)

**What's in it:**
- Where configuration lives (Config.js)
- How to change the 7-slot limit
- Allow/disallow re-requesting after removal
- Cooldown periods
- Cache settings (speed vs accuracy)
- Announcement batching and timing
- Backup retention
- Advanced: sheet names and column mappings
- How to test configuration changes
- Rolling back if something breaks
- Performance tuning
- What's safe to change vs. what to avoid

**Read this if:**
- You want to change the slot limit
- You want to customize announcement emails
- You want to tune performance
- You need to adjust backup settings

**Time to read:** 15 minutes

---

## 🚀 Common Workflows

### Workflow: First-Time Setup
1. **[Getting Started](GETTING_STARTED.md)** — Follow steps 1-5
2. Open the system and verify everything
3. Read **[Adding Posters](ADDING_POSTERS.md)** to understand how to add posters
4. Ready to use!

### Workflow: Daily Operations
1. Check **Main Board** for active requests
2. Use **[Adding Posters](ADDING_POSTERS.md)** when new movies arrive
3. Announcements send automatically
4. Check **Employees Board** to see who has what

### Workflow: Solving a Problem
1. Go to **[Troubleshooting Guide](TROUBLESHOOTING.md)**
2. Find your problem in the table of contents
3. Follow the solution
4. If still stuck, check **[Admin Menu Guide](ADMIN_MENU_GUIDE.md)** to understand buttons

### Workflow: Customizing Settings
1. Decide what you want to change
2. Go to **[Advanced Configuration](ADVANCED_CONFIG.md)**
3. Find the setting
4. Follow instructions to change it
5. Test your change

---

## ❓ FAQ: Which Guide Should I Read?

| Question | Answer |
|----------|--------|
| How do I set this up? | [Getting Started](GETTING_STARTED.md) |
| What does this button do? | [Admin Menu Guide](ADMIN_MENU_GUIDE.md) |
| How do I add a poster? | [Adding Posters](ADDING_POSTERS.md) |
| What do employees see? | [Understanding the Form](UNDERSTANDING_THE_FORM.md) |
| Why does Sarah have 3 posters? | [Understanding Requests](UNDERSTANDING_REQUESTS.md) |
| It's broken, what do I do? | [Troubleshooting Guide](TROUBLESHOOTING.md) |
| How do I change the limit to 5? | [Advanced Configuration](ADVANCED_CONFIG.md) |
| What does "ACTIVE" mean? | [Understanding Requests](UNDERSTANDING_REQUESTS.md) |
| The form doesn't show the new poster | [Adding Posters](ADDING_POSTERS.md) (Sync step) |
| I want to announce new posters | [Admin Menu Guide](ADMIN_MENU_GUIDE.md) (Send Announcement) |

---

## 💡 Pro Tips

1. **Bookmark these guides** — Add to your browser favorites for quick reference
2. **Share with your team** — Give guides to people who use the system
3. **Read once, reference often** — You don't need to memorize, just know where to find answers
4. **Check Admin Menu Guide first** — It has a table for quick problem solving

---

## Key Concepts (Quick Reference)

**Active Poster** — A poster in the Movie Posters sheet with "Active? = TRUE"

**Active Request** — A poster an employee currently has (not removed)

**Removed Request** — A poster an employee deleted (kept for history, doesn't count)

**Slot** — One space in an employee's collection (default 7)

**Sync** — Updating the form with current posters from the Movie Posters sheet

**Main Board** — Shows all active posters and who has them

**Employees Board** — Shows each employee's posters and slot usage

**Requests Sheet** — The official record (never deletes, just marks as REMOVED)

**REMOVED Status** — A deleted request (still in ledger for audit purposes)

---

## Getting Help Beyond These Guides

- Configuration questions?** Check Config.js comments in Google Apps Script
- **Error messages?** Go to Documentation tab in your Sheet and check System Health section
- **Still stuck?** Try "Run Setup / Repair" button — fixes 90% of issues
- **Last resort?** Check the error logs in Google Apps Script (Script Editor → Logs)

---

## Keeping Guides Up to Date

These guides are maintained alongside the system. If you notice:
- A guide is outdated
- A button is missing
- A process changed

The guides may need updating. Check the main [README.md](../README.md) to see if there are newer instructions there.

---

## Start Here!

**Never used this before?** 
→ Open [Getting Started](GETTING_STARTED.md)

**System is running, want to add a poster?**
→ Open [Adding Posters](ADDING_POSTERS.md)

**Something is broken?**
→ Open [Troubleshooting Guide](TROUBLESHOOTING.md)

**Want to customize settings?**
→ Open [Advanced Configuration](ADVANCED_CONFIG.md)

---

**Happy requesting! 🎬**
