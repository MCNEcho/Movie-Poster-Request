# How to Add Posters to the System

Step-by-step guide to add movie posters so employees can request them.

---

## Understanding the Process

When you add a poster, here's what happens:

1. **You add it to the Inventory sheet** (the "master list")
2. **You activate it with the checkbox** (makes it available)
3. **The system auto-syncs the form** (updates automatically)
4. **The poster appears in the employee form**
5. **Employees can now request it**

Simple! Let's do it.

---

## Quick Method: Use the Dialog (Recommended)

The easiest way to add posters is through the built-in dialog:

1. Click **Poster System** menu at the top
2. Select **Advanced** → **Add New Poster**
3. Fill in the form:
   - **Movie Title** (required)
   - **Release Date** (required)
   - **Poster Quantity** (required)
   - Company, Bus Shelters, Mini Posters, etc. (optional)
   - **Check "Activate immediately"** to make it available right away
4. Click **Add Poster**

**Done!** The poster is added, sorted by release date, and ready for requests.

---

## Manual Method: Edit Inventory Sheet Directly

If you prefer to add posters manually or add multiple at once:

### Step 1: Open the Inventory Sheet

1. Open your Google Sheet for the Movie Poster System
2. Find the **Inventory** tab at the bottom
3. Click it to open

You should see columns like:
- **Active?** (checkbox - controls if it shows in the form)
- **Release Date** (when it comes out)
- **Movie Title** (movie name)
- **Company** (studio/distributor)
- **Posters** (how many copies you have)
- **Poster ID** (auto-generated, hidden)
- **Notes** (optional, for any details)

---

### Step 2: Add a New Poster Row

Find the first empty row and add your poster:

```
Column          What to Enter       Example
─────────────────────────────────────────────
Active?         TRUE (check box)     ☑
Release Date    Date format         2024-12-20
Title           Movie name          The Brutalist
Company         Studio name         A24
Posters         Number of copies    5
Notes           Any notes (optional) Director's cut
```

### Important Details

**Active?:** Check the box to make it available in the form
- ☑ Checked = poster appears in the form
- ☐ Unchecked = poster hidden from form (but won't delete old requests)

**Release Date:** Use YYYY-MM-DD format (year-month-day)
- ✅ 2024-12-25
- ✅ 2025-01-15
- ❌ 12/25/24 (wrong format)
- ❌ December 25 (too casual)

**Title:** Just the movie name, exactly as you want it to appear
- ✅ "Avatar: The Way of Water"
- ✅ "Dune: Part Two"
- ❌ "avatar" (wrong capitalization)

**Posters:** How many physical copies you have (just for your records)
- Can be any number
- This number NEVER blocks requests - employees can request even if stock is 0

---

### Step 3: Add Multiple Posters Quickly

If you're adding several at once:

```
Active?  Release Date    Title                          Posters
──────────────────────────────────────────────────────────────────
☑        2024-12-20      The Brutalist                  3
☑        2024-12-20      Mufasa: The Lion King          5
☑        2024-12-25      Nosferatu                      2
☑        2024-12-20      Sonic 3                        4
☑        2024-11-22      Wicked                         6
```

The inventory automatically sorts by release date after you make changes.

---

### Step 4: Save Your Changes

1. After adding posters, make sure you're still in the Inventory sheet
2. Google Sheets auto-saves, but you can press **Ctrl+S** to be sure
3. The system automatically syncs the form when you check the Active? box

---

## What Just Happened?

When you check the Active? box on a poster:
- The system automatically sorts the inventory by release date
- The form updates with the new poster in the dropdown
- Announcement is queued to notify subscribers (sent every 15 minutes)

---

## Verify It Worked

### Option A: Check the Form Directly
1. Go to **Documentation** tab
2. Scroll down and find "Form Link"
3. Click **"Click here to edit the Poster Request Form"**
4. Look at the "Request Posters (Add)" dropdown
5. Your new poster should be in the list!

### Option B: Check Main Board
1. Go to **Main Board** tab
2. Your new poster should appear once employees request it

---

## What If Your Poster Doesn't Show Up?

### Checklist:
- ❓ Is Active? checked (not unchecked)?
  - **Solution:** Go back to Inventory sheet, check the box, sheet auto-saves.

- ❓ Is the format correct?
  - **Solution:** Check Title, Release Date (YYYY-MM-DD format). Fix and save.

- ❓ Are there any red error indicators on the sheet?
  - **Solution:** Click the red error indicator for details and fix the issue.

### If Still Stuck:
1. Click **Poster System** → **Reports** → **Sync Form Options**
2. Wait a few seconds
3. Check the form again

---

## Hiding a Poster (Without Deleting Old Requests)

If you want to stop taking requests for a poster but keep historical data:

1. Go to **Inventory** sheet
2. Find the poster
3. **Uncheck** the Active? box
4. The form automatically updates (poster disappears from form)

**What happens:**
- Poster disappears from the form
- Old requests for that poster stay in the Requests sheet (historical record)
- The poster still appears on the Employees Board for people who already have it

---

## Important Rules

### ✅ DO:
- Use proper Title capitalization (title case or sentence case)
- Use Release Date in YYYY-MM-DD format
- Check Active? box for posters you want in the form
- Uncheck Active? box for posters no longer available
- Use the Add New Poster dialog for quick additions

### ❌ DON'T:
- Leave Title blank (causes errors)
- Use dates like "12/25/24" or "December 25" (wrong format)
- Manually edit the "Poster ID" column (it auto-generates and is hidden)
- Expect inventory to block requests (it won't - stock is just for reference)

---

## Quick Reference: Common Tasks

| Task | Steps |
|------|-------|
| Add new poster (quick) | Poster System → Advanced → Add New Poster → fill form |
| Add new poster (manual) | Go to Inventory → check Active?, enter Title, Release Date, Posters |
| Stop taking requests | Inventory → find poster → uncheck Active? |
| Update movie details | Inventory → edit Release Date or Notes |
| Add multiple posters | Inventory → enter all rows → check Active? for each |
| Check if poster is in form | Documentation → click form link → check dropdown list |

---

## Troubleshooting

**Q: I added a poster but it doesn't show in the form.**
A: Make sure the Active? checkbox is checked. The form should update automatically within a few seconds. If not, go to Reports → Sync Form Options.

**Q: The form shows old posters I already removed.**
A: Uncheck their Active? checkbox. That hides them but keeps old requests in the historical record.

**Q: Can I use any date format?**
A: No, must be YYYY-MM-DD (year first, then month, then day). Example: 2025-01-15 for January 15, 2025.

**Q: What if I accidentally delete a poster row?**
A: Undo with Ctrl+Z. The system keeps a backup every night, so you can also recover from that.

**Q: Why would I set Posters to 0 if I don't have copies?**
A: You can! Employees can still request even if Posters=0. It's just informational. This lets you "pre-announce" posters coming soon.

---

## Next Steps

- Ready to see requests? Check "Understanding Requests" guide
- Want to announce new posters? See Admin Menu guide
- Need to manage employees? See "Employee Management" guide

