# How to Add Posters to the System

Step-by-step guide to add movie posters so employees can request them.

---

## Understanding the Process

When you add a poster, here's what happens:

1. **You add it to the Movie Posters sheet** (the "master list")
2. **You tell the system to sync** (update the form)
3. **The poster appears in the employee form**
4. **Employees can now request it**

Simple! Let's do it.

---

## Step 1: Open the Movie Posters Sheet

1. Open your Google Sheet for the Movie Poster System
2. Find the **Movie Posters** tab at the bottom
3. Click it to open

You should see columns like:
- **Poster ID** (auto-generated, leave blank)
- **Title** (movie name)
- **Release Date** (when it comes out)
- **Stock** (how many copies you have)
- **Active?** (TRUE or FALSE - this controls if it shows in the form)
- **Notes** (optional, for any details)

---

## Step 2: Add a New Poster Row

Find the first empty row and add your poster:

```
Column          What to Enter       Example
─────────────────────────────────────────────
Poster ID       (leave blank)       
Title           Movie name          The Brutalist
Release Date    Date format         2024-12-20
Stock           Number of copies    5
Active?         TRUE or FALSE        TRUE
Notes           Any notes (optional) Director's cut
```

### Important Details

**Title:** Just the movie name, exactly as you want it to appear
- ✅ "Avatar: The Way of Water"
- ✅ "Dune: Part Two"
- ❌ "avatar" (wrong capitalization)

**Release Date:** Use YYYY-MM-DD format (year-month-day)
- ✅ 2024-12-25
- ✅ 2025-01-15
- ❌ 12/25/24 (wrong format)
- ❌ December 25 (too casual)

**Active?:** Either TRUE or FALSE (not "Yes/No" or "1/0")
- TRUE = poster appears in the form
- FALSE = poster hidden from form (but won't delete old requests)

**Stock:** How many physical copies you have (just for your records)
- Can be any number
- This number NEVER blocks requests - employees can request even if stock is 0

---

## Step 3: Add Multiple Posters Quickly

If you're adding several at once:

```
Title                          Release Date    Active?    Stock
────────────────────────────────────────────────────────────────
The Brutalist                  2024-12-20      TRUE       3
Mufasa: The Lion King          2024-12-20      TRUE       5
Nosferatu                       2024-12-25      TRUE       2
Sonic 3                         2024-12-20      TRUE       4
Wicked                          2024-11-22      TRUE       6
```

Then sync the form once (instead of syncing after each poster).

---

## Step 4: Save Your Changes

1. After adding posters, make sure you're still in the Movie Posters sheet
2. Google Sheets auto-saves, but you can press **Ctrl+S** to be sure

---

## Step 5: Sync the Form (THE CRITICAL STEP!)

**This is what makes your new posters appear in the employee form.**

1. Click the **Poster System** menu at the top
2. Click **Sync Form Options Now**
3. Wait 2-3 seconds for completion
4. You should see: "✅ Form synced!" message

### What Just Happened?
The system read your Movie Posters sheet and updated the Google Form. Any poster with Active? = TRUE now appears in the form.

---

## Step 6: Verify It Worked

### Option A: Check the Form Directly
1. Go to **Documentation** tab
2. Scroll down and find "Form Link"
3. Click **"Click here to edit the Poster Request Form"**
4. Look at the "Request Posters (Add)" dropdown
5. Your new poster should be in the list!

### Option B: Check Main Board
1. Go to **Main Board** tab
2. Your new poster should appear in the "Available Posters" section

---

## What If Your Poster Doesn't Show Up?

### Checklist:
- ❓ Did you click **Sync Form Options Now**?
  - **Solution:** If you forgot, click it now. The poster should appear immediately.

- ❓ Is Active? set to TRUE (not FALSE)?
  - **Solution:** Go back to Movie Posters sheet, change to TRUE, and sync again.

- ❓ Is the format correct?
  - **Solution:** Check Title, Release Date (YYYY-MM-DD format). Fix and sync again.

- ❓ Are there any red error indicators on the sheet?
  - **Solution:** Click the red error indicator for details and fix the issue.

### If Still Stuck:
1. Click **Poster System** → **Run Setup / Repair**
2. Wait 30 seconds
3. Then click **Sync Form Options Now** again

---

## Example Walkthrough: Adding "Avatar 3"

**Step 1:** Open Movie Posters sheet
- I see columns: Poster ID, Title, Release Date, Stock, Active?, Notes

**Step 2:** Find first empty row (row 15)
- I'll add data there

**Step 3:** Enter the poster info
```
Poster ID: (leave blank, it auto-generates)
Title: Avatar: The Way of Water
Release Date: 2024-12-20
Stock: 4
Active?: TRUE
Notes: (blank)
```

**Step 4:** Save
- Ctrl+S (Google usually saves automatically)

**Step 5:** Sync the form
- Click Poster System → Sync Form Options Now
- Wait for "✅ Form synced!" message

**Step 6:** Verify
- Open Documentation tab → click form link
- Look in "Request Posters (Add)" dropdown
- I see "Avatar: The Way of Water" ✅

**Done!** Employees can now request it.

---

## Hiding a Poster (Without Deleting Old Requests)

If you want to stop taking requests for a poster but keep historical data:

1. Go to **Movie Posters** sheet
2. Find the poster
3. Change **Active?** to FALSE
4. Click **Poster System** → **Sync Form Options Now**

**What happens:**
- Poster disappears from the form
- Old requests for that poster stay in the Requests sheet (historical record)
- The poster still appears on the Employees Board for people who already have it

---

## Important Rules

### ✅ DO:
- Use proper Title capitalization (title case or sentence case)
- Use Release Date in YYYY-MM-DD format
- Run **Sync Form Options Now** after adding/hiding posters
- Set Active? to TRUE for posters you want in the form
- Set Active? to FALSE for posters no longer available

### ❌ DON'T:
- Leave Title blank (causes errors)
- Use dates like "12/25/24" or "December 25" (wrong format)
- Forget to sync the form (poster won't appear)
- Manually edit the "Poster ID" column (it auto-generates)
- Expect inventory to block requests (it won't - stock is just for reference)

---

## Quick Reference: Common Tasks

| Task | Steps |
|------|-------|
| Add new poster | Go to Movie Posters → enter Title, Release Date, Active?=TRUE → Sync Form |
| Stop taking requests for a poster | Movie Posters → find poster → set Active?=FALSE → Sync Form |
| Update movie details | Movie Posters → edit Release Date or Notes → Sync Form (if Title changed) |
| Add multiple posters at once | Movie Posters → enter all rows → Sync Form once |
| Check if poster is in form | Documentation → click form link → check dropdown list |

---

## Troubleshooting

**Q: I added a poster but it doesn't show in the form.**
A: Did you click Sync Form Options Now? That's the critical step. The form doesn't update automatically—you have to tell the system to sync it.

**Q: The form shows old posters I already removed.**
A: Change their Active? to FALSE and sync again. That hides them but keeps old requests in the historical record.

**Q: Can I use any date format?**
A: No, must be YYYY-MM-DD (year first, then month, then day). Example: 2025-01-15 for January 15, 2025.

**Q: What if I accidentally delete a poster row?**
A: Undo with Ctrl+Z. The system keeps a backup every night, so you can also recover from that.

**Q: Why would I set Stock to 0 if I don't have copies?**
A: You can! Employees can still request even if Stock=0. It's just informational. This lets you "pre-announce" posters coming soon.

---

## Next Steps

- Ready to see requests? Check "Understanding Requests" guide
- Want to announce new posters? See Admin Menu guide
- Need to manage employees? See "Employee Management" guide

