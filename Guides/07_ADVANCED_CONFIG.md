# Advanced Configuration Guide

Fine-tune system settings for your specific needs.

---

## Where Configuration Lives

All system configuration is in **00_Config.js** file (in Google Apps Script).

**To access:**
1. Go to [script.google.com](https://script.google.com)
2. Find your Movie Poster System project
3. Click on **00_Config.js**
4. All settings are in the `CONFIG` object

---

## Common Configuration Changes

### The 7-Slot Limit: Change It

**What it does:** Controls how many posters each employee can request at once.

**Current setting:**
```javascript
CONFIG.MAX_ACTIVE = 7;
```

**To change to 5 slots:**
```javascript
CONFIG.MAX_ACTIVE = 5;
```

**To change to 10 slots:**
```javascript
CONFIG.MAX_ACTIVE = 10;
```

**How it affects:**
- Employees can't request more than this number of posters
- Form will reject request if it exceeds this
- Employees Board shows this limit (like "3/5 posters")
- Existing posters over the limit won't be removed (but they can't add more until they remove some)

---

### Allow Re-requesting After Removal

**What it does:** Controls whether employees can request the same poster again after removing it.

**Current setting:**
```javascript
CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL = true;
```

**If set to TRUE (allow it):**
- Employee requests Poster A
- Employee removes Poster A
- Employee can immediately request Poster A again
- No waiting required

**If set to FALSE (don't allow it):**
- Employee requests Poster A
- Employee removes Poster A
- Employee gets a cooldown period (see below)
- Can't request Poster A again until cooldown expires

**When to use which:**
- **TRUE:** When posters come and go frequently, and you want employees to be flexible
- **FALSE:** When you want to prevent thrashing (adding/removing same poster repeatedly)

---

### Re-request Cooldown Period

**What it does:** If re-requesting is disabled, how long before they can request the same poster again?

**Current setting:**
```javascript
CONFIG.REREQUEST_COOLDOWN_DAYS = 7;
```

**This means:** After removing a poster, employee must wait 7 days before requesting it again.

**To change to 14 days:**
```javascript
CONFIG.REREQUEST_COOLDOWN_DAYS = 14;
```

**To change to 1 day:**
```javascript
CONFIG.REREQUEST_COOLDOWN_DAYS = 1;
```

**Note:** Only applies if `ALLOW_REREQUEST_AFTER_REMOVAL = false`

---

### Cache Settings: Balancing Speed vs. Accuracy

**What it does:** Caching makes the system faster by remembering data temporarily instead of reading it from sheets every time.

**Current setting:**
```javascript
CONFIG.CACHE_TTL_MINUTES = 5;
```

**This means:** System remembers data for 5 minutes before checking sheets again.

**To make it faster (trust cache longer):**
```javascript
CONFIG.CACHE_TTL_MINUTES = 10;  // Remember for 10 minutes
```

**To make it more accurate (update more often):**
```javascript
CONFIG.CACHE_TTL_MINUTES = 1;   // Update every 1 minute
```

**Trade-offs:**
- **Longer TTL (e.g., 10 min):** Faster system, but data might be slightly stale
- **Shorter TTL (e.g., 1 min):** More up-to-date, but slower performance

**Recommendation:** Keep at 5 minutes (default) for balance

---

### Announcement Settings: Timing and Retries

**What it does:** Controls how announcement emails are sent.

**Current settings:**
```javascript
CONFIG.ANNOUNCEMENT = {
  BATCH_SIZE: 5,           // (DEPRECATED - no longer used)
  THROTTLE_DELAY_MS: 1000, // Wait 1 second between emails
  MAX_RETRIES: 3,          // Try 3 times if failed
  ENABLED: true            // Turn announcements on/off
};
```

**Explanation of each:**

**BATCH_SIZE:**
- ⚠️ **DEPRECATED:** This setting is no longer used
- The system now sends ALL pending new posters in a single email
- No more batching - employees get the full list at once

**THROTTLE_DELAY_MS:**
- Wait time between sending emails (in milliseconds)
- 1000 = 1 second, 5000 = 5 seconds
- Prevents overwhelming email server

To send faster (less wait):
```javascript
THROTTLE_DELAY_MS: 500,  // 0.5 seconds
```

To send slower (more spacing):
```javascript
THROTTLE_DELAY_MS: 2000, // 2 seconds
```

**MAX_RETRIES:**
- How many times to try sending if it fails
- 3 = try 3 times before giving up

**ENABLED:**
- true = announcements work normally
- false = stops all announcements (use for testing)

---

### Backup Settings

**What it does:** How often to back up and how long to keep backups.

**Current settings:**
```javascript
CONFIG.BACKUP = {
  RETENTION_DAYS: 30,    // Keep 30 days of backups
  FORMAT: 'CSV',         // Save as CSV (or 'SHEET')
  ENABLED: true          // Turn backups on/off
};
```

**To keep backups for 60 days:**
```javascript
RETENTION_DAYS: 60,
```

**To save as Google Sheets instead of CSV:**
```javascript
FORMAT: 'SHEET',
```

**To disable backups:**
```javascript
ENABLED: false,
```

---

## Advanced: Sheet Names and IDs

**What it does:** Tells the system which Google Sheet to use and where to save data.

**Current settings:**
```javascript
CONFIG.SPREADSHEET_ID = "YOUR_SHEET_ID_HERE";

CONFIG.SHEETS = {
  MAIN_BOARD: 'Main Board',
  EMPLOYEES_BOARD: 'Employees Board',
  MOVIE_POSTERS: 'Movie Posters',
  INVENTORY: 'Inventory',
  SUBSCRIBERS: 'Subscribers',
  REQUESTS: 'Requests',
  // ... more sheets
};
```

**When to change:**
- Usually never (set during initial setup)
- Only change if you renamed a sheet and want to match the new name

**Changing a sheet name:**
If you renamed "Main Board" to "Master Board", change:
```javascript
MAIN_BOARD: 'Master Board',
```

⚠️ **Warning:** Only rename sheets if you know what you're doing. System depends on these exact names.

---

## Advanced: Column Mappings

**What it does:** Tells the system which column is which (e.g., "Column A is email, Column B is name").

**Current settings:**
```javascript
CONFIG.COLS = {
  REQUESTS: {
    TIMESTAMP: 1,      // Column A
    EMP_EMAIL: 2,      // Column B
    EMP_NAME: 3,       // Column C
    // ... more columns
  },
  MOVIE_POSTERS: {
    POSTER_ID: 1,      // Column A
    TITLE: 2,          // Column B
    RELEASE_DATE: 3,   // Column C
    // ... more columns
  },
  // ... more sheets
};
```

**When to change:**
- Only if you add columns to a sheet
- Only if you move columns around (rarely needed)

⚠️ **Warning:** Changing this can break the system. Only do this if you're comfortable with coding.

---

## Advanced: Property Keys

**What it does:** The system stores some data in Google Apps Script Properties (like a hidden database).

**Current settings:**
```javascript
CONFIG.PROPS = {
  LABEL_TO_ID: 'posterLabelToId',
  ID_TO_CURRENT_LABEL: 'posterIdToCurrentLabel',
  ANNOUNCEMENT_QUEUE: 'announcementQueue',
  // ... more properties
};
```

**When to change:**
- Almost never
- These are internal keys
- Changing them breaks data retrieval

⚠️ **Warning:** Don't change these unless you're sure what you're doing.

---

## Advanced: Email Templates

**What it does:** The announcement emails use templates with variables.

**Current template:**
```javascript
CONFIG.ANNOUNCEMENT = {
  TEMPLATE: `
    New posters are now available!
    {{POSTER_LIST}}
    ...
  `
};
```

**Template variables:**
- `{{TITLE}}` - Movie title
- `{{RELEASE}}` - Release date
- `{{STOCK}}` - Inventory count
- `{{POSTER_LIST}}` - Formatted list of new posters
- `{{FORM_LINK}}` - Link to the Google Form
- `{{COUNT}}` - Number of new posters

**To customize the announcement email:**
1. Open 00_Config.js
2. Find ANNOUNCEMENT section
3. Edit the TEMPLATE text
4. Use variables above to customize

**Example custom template:**
```javascript
TEMPLATE: `
  Hey team! 📽️
  
  These new posters just dropped:
  {{POSTER_LIST}}
  
  Grab yours: {{FORM_LINK}}
  
  Good luck!
`
```

---

## Testing Configuration Changes

After changing any config:

1. **Save in Google Apps Script** (Ctrl+S)
2. **Go back to your Google Sheet**
3. **Refresh the sheet** (F5)
4. **Click Poster System → Refresh All**
5. **Test the change**

**Example: Testing MAX_ACTIVE change**
1. Change MAX_ACTIVE from 7 to 5
2. Save and go to sheet
3. Tell an employee to try requesting 6 posters
4. Should be rejected (now maxed at 5)
5. If it works, change was successful!

---

## Rolling Back Changes

If something breaks after a config change:

1. Open 00_Config.js
2. Change back to previous value
3. Save (Ctrl+S)
4. Go to sheet
5. Refresh (F5)
6. Click **Poster System → Run Setup / Repair**
7. Wait 60 seconds

---

## Common Misunderstandings

### "I changed config but nothing happened"
**Problem:** You saved in Google Apps Script but didn't refresh the Sheet
**Solution:** Go to Sheet, press F5, then try again

### "Announcements aren't working"
**Problem:** Check CONFIG.ANNOUNCEMENT.ENABLED = true
**Solution:** If false, set to true, save, and try again

### "Posters showing as not active"
**Problem:** You changed MAX_ACTIVE but nobody can request
**Solution:** This doesn't affect existing posters. They should still work. Refresh the sheet and try again.

### "I can't find the config file"
**Problem:** You're looking in the wrong place
**Solution:** Go to script.google.com, find your project, look for "00_Config.js" file

---

## Performance Tuning

If system is slow:

**1. Increase cache TTL**
```javascript
CONFIG.CACHE_TTL_MINUTES = 10;  // Caches longer
```

**2. Increase batch size for announcements**
```javascript
BATCH_SIZE: 10,  // Fewer emails to send
```

**3. Increase throttle delay**
```javascript
THROTTLE_DELAY_MS: 2000,  // More spacing between operations
```

**4. Increase backup retention**
```javascript
RETENTION_DAYS: 60,  // Keep more backups (uses more Drive space)
```

---

## When NOT to Change Config

❌ **Don't change if you're not sure**
- Configuration is powerful but fragile
- Wrong values can break the system
- Only change what you understand

❌ **Don't change column mappings**
- Unless you physically moved columns in a sheet
- Changing without moving breaks everything

❌ **Don't change sheet names**
- Only change if you actually renamed the sheet
- System looks for exact sheet names

✅ **Safe to change:**
- MAX_ACTIVE (slot limit)
- ALLOW_REREQUEST_AFTER_REMOVAL
- REREQUEST_COOLDOWN_DAYS
- CACHE_TTL_MINUTES
- ANNOUNCEMENT batching settings
- BACKUP retention
- Email templates

---

## Configuration Defaults Reference

| Setting | Default | Min | Max | Notes |
|---------|---------|-----|-----|-------|
| MAX_ACTIVE | 7 | 1 | 999 | Posters per employee |
| ALLOW_REREQUEST | true | N/A | N/A | Can remove + re-add? |
| COOLDOWN_DAYS | 7 | 0 | 365 | Days before re-request |
| CACHE_TTL | 5 | 1 | 60 | Minutes |
| BATCH_SIZE | 5 | 1 | 50 | Posters per email |
| THROTTLE_MS | 1000 | 100 | 10000 | Milliseconds |
| MAX_RETRIES | 3 | 1 | 10 | Retry attempts |
| RETENTION_DAYS | 30 | 1 | 365 | Backup days |

---

## Getting Help

- **Default values not working?** See "Getting Started" guide
- **Something broke after I changed config?** Roll back to previous value
- **Want to understand the code?** Check comments in 00_Config.js
- **Configuration too complex?** Stick with defaults—they're well-tested!

