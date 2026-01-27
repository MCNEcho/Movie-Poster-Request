# Getting Started: Movie Poster Request System

Welcome! This guide will walk you through everything you need to know to get the system up and running for the first time.

## What Is This System?

The Movie Poster Request System is a tool that allows employees to request movie posters through a simple Google Form. It keeps track of who has which posters, limits how many each person can have, and automatically sends emails to announce new posters.

**In plain English:**
- Employees fill out a form to ask for posters
- The system tracks what posters each person has
- No one can request the same poster twice
- Each employee can have up to 7 active posters at a time
- When a new poster becomes available, everyone gets notified by email

---

## Step 1: Deploy the Code to Google Apps Script

### What You Need
- A Google Account
- Google Sheet (we'll use this as our main control center)
- 5 minutes to set up

### How to Deploy

1. **Open Terminal/Command Prompt** and navigate to the project folder
   ```
   cd "c:\Users\gavin\OneDrive\Desktop\GH Poster Repo\Movie-Poster-Request"
   ```

2. **Run the setup script**
   ```
   .\scripts\quickstart_clasp.bat
   ```
   
   This will:
   - Ask you to log in to Google
   - Create or link an Apps Script project
   - Upload all the code automatically

3. **Wait for completion** (you'll see "Pushed 26 files" when done)

### Troubleshooting Deployment
- **"clasp not found" error:** Run `npm install -g @google/clasp` first
- **Login issues:** Make sure you're using the Google Account associated with your project
- **Connection timeout:** Check your internet connection and try again

---

## Step 2: Configure the System

Once code is deployed, you need to tell the system where your Google Sheet is and customize settings.

### Edit Configuration File

1. Open the deployed code in Google Apps Script:
   - Go to [script.google.com](https://script.google.com)
   - Find and open your project (should be named something like "Movie Poster System")
   - Click on `00_Config.js` file

2. Change these settings:
   ```javascript
   // Line 1-5: Replace with your actual Google Sheet ID
   CONFIG.SPREADSHEET_ID = "your_sheet_id_here";
   
   // Line 10: How many posters each employee can have at once
   CONFIG.MAX_ACTIVE = 7;  // Can be 5, 10, or any number you want
   
   // Line 20: Your timezone (for timestamps)
   CONFIG.TIMEZONE = "America/New_York";  // Change to your timezone
   ```

**Need to find your Sheet ID?**
   - Open your Google Sheet
   - Look at the URL: `https://docs.google.com/spreadsheets/d/`**`1a2b3c4d5e6f7g8h9i0j`**`/edit`
   - The long number in the middle is your Sheet ID

### Save and Deploy

1. In Google Apps Script, click **Save** (Ctrl+S)
2. Click the **Deploy** button (looks like a rocket icon)
3. Select "New Deployment" → "Type: Head"

---

## Step 3: Run the Initial Setup

Now that code is deployed and configured, initialize the system:

1. **Refresh your Google Sheet** (F5 or browser refresh)
   - You should now see a new menu: **Poster System** at the top

2. **Click Poster System** → **Run Setup / Repair**
   - This will create all the internal sheets
   - Create the Google Form
   - Set up automatic triggers
   - Build the display boards

3. **Wait 30-60 seconds** for everything to initialize

4. **Notice the color-coded tabs:**
   - **BLUE tabs** (Inventory, Main Board, Employees Board) - Primary sheets you'll use most
   - **CYAN tabs** (Poster Outside/Inside, Print Out) - Display and printing
   - **ORANGE tabs** (Subscribers, Documentation) - Configuration and help
   - **YELLOW tabs** (hidden) - Admin audit logs
   - **RED tabs** (hidden) - Error tracking
   - **GREEN tabs** (hidden) - Analytics
   
   These colors help you quickly find what you need!
   - You'll see a toast notification when complete

---

## Step 4: Verify Setup Worked

Check if everything is set up correctly:

### Look for these sheets (tabs at bottom):
- ✅ **Movie Posters** — Add posters here
- ✅ **Requests** — Shows who requested what
- ✅ **Main Board** — Visual display of active posters
- ✅ **Employees Board** — Shows each employee's posters
- ✅ **Documentation** — Instructions and system health
- ✅ **Print Out** — Print-friendly version

### Try it yourself:
1. Look at the **Documentation** tab
2. Scroll down and find the form link that says "Click here to edit the Poster Request Form"
3. Click it — you should go to the Google Form

---

## Step 5: Add Your First Poster

Ready to add a movie poster to the system?

1. Go to the **Movie Posters** sheet tab
2. You'll see columns like:
   - **Title** (movie name)
   - **Release Date** 
   - **Active?** (TRUE or FALSE)
   - **Stock** (how many copies)

3. **Add a row:**
   ```
   Title           Release Date    Active?    Stock
   Avengers        2024-05-03      TRUE       5
   ```

4. Click **Poster System** → **Sync Form Options Now**
   - This updates the form so employees can see the new poster

5. Done! The new poster now appears in the form

---

## Step 6: Share the Form with Employees

Employees need to be able to submit requests. You have two options:

### Option A: Share the Form Directly
1. Go to **Documentation** tab
2. Click the form link
3. Click **Share** (top right)
4. Copy the shareable link
5. Send to employees

### Option B: Use the QR Code
1. Go to **Print Out** tab
2. You'll see a QR code near the top
3. Print this page and post it somewhere
4. Employees scan the QR with their phone to open the form

---

## Next Steps

Now that everything is set up:
- **Employees can submit requests** through the form
- **You can view responses** in the Main Board and Employees Board
- **Announcements are automatic** when new posters are added
- **Everything is backed up every night** to Google Drive

---

## Key Terms You'll See

| Term | Meaning |
|------|---------|
| **Active Poster** | A poster that's available for employees to request (Active? = TRUE) |
| **Active Request** | A poster that an employee currently has |
| **Removed Request** | A poster an employee deleted from their list |
| **Slot** | One "spot" for a poster (each employee has 7 slots) |
| **Ledger** | The Requests sheet — the official record of all requests |
| **Sync** | Update the form with the latest posters from Movie Posters sheet |

---

## Troubleshooting: Things Went Wrong

### Setup failed / "Run Setup / Repair" button doesn't appear
- **Solution:** Refresh your Google Sheet (F5), then try again

### Can't find the Poster System menu
- **Solution:** The code may not have deployed correctly. Try running the deployment script again.

### Form isn't showing new posters after I added them
- **Solution:** Click **Poster System** → **Sync Form Options Now** to update the form

### Employees say form isn't loading
- **Solution:** Check the form link in the Documentation tab. Make sure it's shared with View access.

---

## Getting Help

- **Detailed guides:** Check the Guides folder for specific topics (admin menu, adding posters, etc.)
- **System status:** Go to Documentation tab → scroll down to "System Health" section
- **Stuck?** All sheets have comments explaining columns and data

---

**You're all set!** The system is ready to use. Continue to the next guides for specific tasks.
