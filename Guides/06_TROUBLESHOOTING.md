# Troubleshooting Guide

Solutions for common problems and errors.

---

## Before You Start Troubleshooting

**Most problems can be fixed by:**
1. Click **Poster System** → **Run Setup / Repair**
2. Wait 30-60 seconds
3. Refresh the sheet (F5)

If that doesn't work, continue with specific solutions below.

---

## "Poster System" Menu Doesn't Appear

### Symptom
You open the Google Sheet but don't see the "Poster System" menu at the top.

### Causes
- Code hasn't deployed yet
- Sheet needs to refresh
- Google Account doesn't have permission

### Solutions

**Solution 1: Refresh the Sheet**
1. Press F5 (or Ctrl+R)
2. Wait 5 seconds
3. Check again

**Solution 2: Re-deploy the Code**
1. Open Google Apps Script (script.google.com)
2. Find your project
3. Click **Save** (Ctrl+S)
4. Go back to Sheet
5. Refresh (F5)

**Solution 3: Check Permissions**
- Make sure you're logged into the right Google Account
- The account needs "Edit" access to the Sheet
- The Apps Script project should be owned by that account

---

## New Poster Doesn't Appear in the Form

### Symptom
I added a poster to the Movie Posters sheet, but it doesn't show in the Google Form.

### Most Common Cause
**You forgot to sync the form!**

### Solution
1. Click **Poster System** → **Sync Form Options Now**
2. Wait 2-3 seconds
3. Check the form again
4. Poster should now appear

### If Still Not There

**Check the Movie Posters sheet:**
1. Go to Movie Posters tab
2. Find your poster row
3. Verify:
   - ✅ **Active?** column = TRUE (not FALSE)
   - ✅ **Title** is filled in
   - ✅ **Release Date** is filled in (format: YYYY-MM-DD)

**If any are wrong:**
1. Fix the data
2. Click **Poster System** → **Sync Form Options Now** again

**If still not working:**
1. Click **Poster System** → **Run Setup / Repair**
2. Wait 30 seconds
3. Click **Poster System** → **Sync Form Options Now** again

---

## Employee Says Form Isn't Loading

### Symptom
Employee tries to open the form but gets an error or blank page.

### Causes
- Form link is wrong or expired
- Form isn't published yet
- Network issue
- Browser cache issue

### Solutions

**Solution 1: Check Form is Published**
1. Go to Documentation tab
2. Click the form link
3. You should go to the form edit page (not employee view)
4. If form doesn't exist, click **Poster System** → **Run Setup / Repair**

**Solution 2: Get Fresh Link**
1. Go to Documentation tab
2. Look for the form link
3. Share that exact link with employee
4. Make sure they have a Google Account

**Solution 3: Use QR Code Instead**
1. Go to Print Out tab
2. Print the page (or just screenshot the QR)
3. Employee scans QR with phone
4. Should open form directly

**Solution 4: Browser Cache Issue**
- Tell employee to:
  - Close and reopen browser
  - Try a different browser (Chrome, Firefox, etc.)
  - Clear cache (Ctrl+Shift+Delete)

---

## Form Says Employee Already Has That Poster

### Symptom
Employee tries to request a poster but form says "You already have that poster."

### Cause
They requested it before and haven't removed it yet.

### Solution

**Option 1: Tell Employee to Remove It First**
1. Open the form
2. In "Remove Posters" section, check the poster they want
3. Submit
4. Wait 1 minute
5. Form will now let them request it again

**Option 2: Admin Manual Fix**
1. Go to Requests sheet (unhide if needed)
2. Find their old request for that poster
3. Look at Status column
4. If it's REMOVED, they should be able to request again
5. If it's still ACTIVE, they can't (tell them to remove it in form)

---

## Employee Can Only Add a Few Posters, Not the Full 7

### Symptom
An employee already has 5 posters and tries to add 3 more, but form rejects it.

### Why This Happens
- They're at the slot limit
- 5 posters + 3 new = 8, but max is 7
- The form won't let them exceed 7 total

### Solution
Tell the employee:
1. Remove some posters first (use the "Remove Posters" section)
2. That frees up slots
3. Then they can add new ones

**Example:**
```
Current: 5 posters (3 slots free)
Wants to add: 3 new posters ✅ That works!

Current: 5 posters (3 slots free)
Wants to add: 4 new posters ❌ Won't work!
```

---

## Boards Show Wrong Data or Look Odd

### Symptom
The Main Board and Employees Board look incorrect, missing data, or have formatting issues.

### Causes
- Boards weren't rebuilt after submissions
- Someone manually edited the Requests sheet
- Cache is stale

### Solutions

**Solution 1: Rebuild Boards**
1. Click **Poster System** → **Rebuild Boards Now**
2. Wait 5-10 seconds
3. Refresh sheet (F5)
4. Check boards again

**Solution 2: Refresh All**
1. Click **Poster System** → **Refresh All**
2. This rebuilds boards, syncs form, refreshes health info
3. Wait 10-15 seconds

**Solution 3: Full Repair**
1. Click **Poster System** → **Run Setup / Repair**
2. Wait 30-60 seconds
3. This completely rebuilds everything

---

## Getting "Permission Denied" Error

### Symptom
When trying to sync or rebuild, you get an error about permissions.

### Causes
- Google Apps Script doesn't have permission to edit sheet
- Account doesn't have access to certain resources
- Security restrictions

### Solutions

**Solution 1: Try Again**
- Sometimes it's a temporary glitch
- Wait 1 minute and try again

**Solution 2: Check Sheet Sharing**
- Make sure you have Edit access to the sheet
- If shared with you, make sure it's not view-only
- Check if sheet is in a Google Workspace with restrictions

**Solution 3: Reconnect Permissions**
1. Open Google Apps Script (script.google.com)
2. Find your project
3. Click **Run** on any function (doesn't matter which)
4. It will ask for permissions - approve all
5. Go back to Sheet and try again

---

## Announcements Not Sending

### Symptom
I submitted new posters but nobody got announcement emails.

### Causes
- No subscribers (Subscribers sheet is empty)
- Subscribers aren't getting emails
- Announcement queue is off

### Solutions

**Solution 1: Check Subscribers**
1. Go to Subscribers sheet
2. Make sure there are email addresses listed
3. If empty, add some emails

**Solution 2: Check Who's Subscribed**
- Go to Documentation tab
- Check if any employees checked "Subscribe to Notifications" on their form
- If nobody subscribed, nobody gets emails

**Solution 3: Send Announcement Now**
1. Click **Poster System** → **Send Announcement Now**
2. This forces an immediate send instead of waiting 15 minutes
3. Check if emails arrive

**Solution 4: Check Email Address**
- Email addresses must be valid
- Check for typos in Subscribers sheet
- Make sure company email addresses are correct

---

## System Health Shows Errors

### Symptom
Going to Documentation tab → System Health section shows RED indicators or warnings.

### Common Issues

**❌ "Triggers: ERROR" or "Triggers Installed: 0"**
- Triggers weren't installed properly
- **Fix:** Click **Poster System** → **Run Setup / Repair**

**❌ "Last Error: [Error message]"**
- Something went wrong in a recent operation
- **Fix:** Click the error in Documentation to get more details
- Check if it explains what failed
- Try the operation again or run **Run Setup / Repair**

**❌ "Cache Health: Warning"**
- Cache isn't working well
- **Fix:** Usually temporary - wait 15 minutes
- Or click **Poster System** → **Refresh All** to reset cache

### View Full Error Details
1. Go to Documentation tab
2. Scroll down to System Health
3. If there's an error, click "Last Error" line
4. Check Errors sheet (unhide if needed)
5. See full error message and timestamp

---

## "Run Setup / Repair" Takes Forever

### Symptom
Clicked "Run Setup / Repair" but it's been running for 5+ minutes.

### Causes
- Network is slow
- System is processing many sheets
- Google Apps Script is overloaded

### Solutions

**Solution 1: Wait It Out**
- It might finish. Give it 60 seconds.
- Check if you see a toast notification saying it completed

**Solution 2: Refresh Sheet**
- Press F5 to refresh
- The operation might have completed but notification didn't show
- Check if sheets exist (if "Run Setup" worked)

**Solution 3: Check Logs**
1. Open Google Apps Script (script.google.com)
2. Find your project
3. Click **Logs** (bottom panel)
4. Scroll through to see if any errors happened
5. If you see "Error: ...", that's the problem

**Solution 4: Run Again**
- Wait 5 minutes to be safe
- Then click **Poster System** → **Run Setup / Repair** again

---

## Accidentally Deleted Important Data

### Symptom
I accidentally deleted a row or data from a sheet and want it back.

### Recovery Options

**Option 1: Undo (Fastest)**
- Press Ctrl+Z immediately
- This undoes the deletion

**Option 2: Restore from Backup**
- System backs up every night at 2am
- Go to your Google Drive
- Look for folder: "Movie Poster Backups"
- Find yesterday's backup
- Open it and copy your data back

**Option 3: Rebuild from Requests Sheet**
- The Requests sheet (the audit log) has all historical data
- Click **Poster System** → **Rebuild Boards Now**
- Main Board and Employees Board rebuild from Requests

---

## Employee Names Causing Issues

### Symptom
Employee submitted form with wrong name format and now system is confused.

### How Names Should Be Formatted

**Correct format:**
- FirstName LastInitial
- Examples: "Sarah M", "David Chen", "Maria G."

**Incorrect:**
- ❌ Just first name: "Sarah"
- ❌ Full last name: "Sarah Martinez"
- ❌ All lowercase: "sarah m"
- ❌ No space: "SarahM"

### Fix Submitted Request
1. Go to Requests sheet (unhide if needed)
2. Find the bad entry in Name column
3. Edit to correct format
4. Click **Poster System** → **Rebuild Boards Now**

### Prevent Future Issues
1. Keep this guide handy
2. Share the form with clear instructions
3. The form description includes name format rules
4. If employee puts wrong format, it will be rejected (system validates)

---

## Still Stuck?

If you've tried all solutions above:

1. **Check Documentation Tab**
   - System Health section might explain what's wrong
   - Troubleshooting section has common issues

2. **Check Logs**
   - Open Google Apps Script (script.google.com)
   - Click Logs
   - Look for error messages
   - Search the error message in this guide

3. **Try Full Reset**
   - Click **Poster System** → **Run Setup / Repair**
   - Wait 60 seconds
   - Refresh sheet (F5)
   - Try your operation again

4. **Last Resort: Start Over**
   - Create a new Google Sheet
   - Run the setup script again
   - Recreate data
   - (This works, but takes time)

---

## Prevention: Best Practices

To avoid problems:

✅ **Do this:**
- Run **Sync Form Options Now** after adding/hiding posters
- Run **Refresh All** after multiple changes
- Use **Manually Add Request** for special additions (don't edit sheet directly)
- Back up manually before big changes (click **Run Backup Now**)
- Keep employee name format consistent

❌ **Don't do this:**
- Don't manually edit Requests sheet (system manages it)
- Don't manually edit columns you didn't create
- Don't rename sheets (system expects specific names)
- Don't delete rows from Movie Posters (just set Active? = FALSE)
- Don't change column order or add new columns

---

## Getting Help

- **Detailed guides:** See the Guides folder
- **Configuration issues?** See "Getting Started" guide
- **Admin menu questions?** See "Admin Menu Guide"
- **Adding posters?** See "Adding Posters" guide
- **Understanding form?** See "Understanding the Form" guide
- **Understanding requests?** See "Understanding Requests" guide

