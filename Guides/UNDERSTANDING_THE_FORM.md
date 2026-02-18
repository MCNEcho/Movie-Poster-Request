# Understanding the Employee Form

Complete guide to the Google Form that employees use to request posters.

---

## What Is the Form?

The form is what **employees see and interact with**. They use it to:
1. **Request posters** they want
2. **Remove posters** they don't want anymore
3. **Subscribe to announcements** (optional)

---

## Where to Find the Form

### Option 1: Documentation Tab
1. Go to **Documentation** sheet tab
2. Scroll down to find "Form Link"
3. Click **"Click here to edit the Poster Request Form"**

### Option 2: Scan QR Code
1. Go to **Print Out** sheet tab
2. You'll see a QR code
3. Scan with your phone camera
4. It opens the form automatically

### Option 3: Form URL
The form URL is: `https://docs.google.com/forms/d/{FORM_ID}/`
- You can see this in the Documentation tab
- It's the shareable link employees use

---

## The Form Structure (What Employees See)

### Part 1: Employee Information

**Question 1: Email Address**
- Automatically collected from Google account (no input field shown)
- Requires Google sign-in to use the form
- Employees don't type this
- The system uses this to track who submitted
- Note: The form is configured to collect email via form settings, not as a visible question

**Question 2: Employee Name (REQUIRED)**
- Must be in format: "FirstName LastInitial"
- Examples:
  - ✅ "Sarah M"
  - ✅ "David Chen"
  - ✅ "Maria G."
  - ❌ "sarah" (wrong - needs last initial)
  - ❌ "Sarah Martinez" (wrong - full last name)

If format is wrong: form rejects it and shows error

---

### Part 2: Poster Selection

**Question 3: Request Posters (Add)**
- Multiple choice
- Shows all posters where Active? = TRUE in Movie Posters sheet
- Employee can select multiple
- Employee can select none (if only removing)

Example list:
```
☐ Avatar: The Way of Water
☐ Dune: Part Two
☐ Nosferatu
☐ The Brutalist
☐ Sonic 3
```

**What "Request Posters (Add)" means:**
- These are the posters the employee wants to ADD to their collection
- If they already have a poster and select it again, form rejects it (no duplicates)

---

**Question 4: Remove Posters (If Any)**
- Checkbox list
- Shows ONLY posters the employee currently has (ACTIVE requests)
- Employee can select multiple to remove
- Employee can select none (if only adding)

Example:
```
☐ Avatar: The Way of Water
☐ Dune: Part Two
```
(Only shows posters they already have)

---

### Part 3: Notifications

**Question 5: Subscribe to Notifications (Optional)**
- Single checkbox: "Yes, subscribe me to notifications"
- If checked: employee gets emails when new posters are added
- If unchecked: employee doesn't get announcements
- This doesn't control request ability, just email preference
- The system maintains this question automatically when syncing form options
- Once subscribed, employee stays subscribed unless manually removed from Subscribers sheet

---

## How the Form Works (Step by Step)

### Scenario 1: Employee Adds a Poster

1. Employee opens form
2. Enters name: "Alex J"
3. Checks "Avatar: The Way of Water" in Request Posters (Add)
4. Doesn't check anything in Remove Posters
5. Checks "Subscribe to Notifications"
6. Clicks **Submit**

**What happens in the system:**
- Request is logged in Requests sheet
- Alex J now has Avatar in their ACTIVE requests
- Employees Board shows "Alex J: Avatar" 
- If Avatar is newly active, an announcement email is queued

---

### Scenario 2: Employee Swaps Posters

1. Employee opens form
2. Enters name: "Jamie L"
3. Checks "Sonic 3" in Request Posters (Add)
4. Checks "Dune: Part Two" in Remove Posters
5. Clicks **Submit**

**What happens in the system:**
- FIRST: Dune: Part Two is marked as REMOVED
- THEN: Sonic 3 is marked as ACTIVE
- Jamie now has Sonic 3 instead of Dune
- Their ACTIVE count stays the same (still 1 poster)

---

### Scenario 3: Employee Only Removes a Poster

1. Employee opens form
2. Enters name: "Casey M"
3. Doesn't check anything in Request Posters (Add)
4. Checks "Nosferatu" in Remove Posters
5. Clicks **Submit**

**What happens:**
- Nosferatu is marked as REMOVED
- Casey now has fewer active posters
- Freed up a slot for adding something else later

---

## Important Rules Employees See in the Form

The form description shows:
- "You can have up to 7 ACTIVE posters at a time"
- "If you submit removes + adds, removals happen first"
- "You can only request each poster once (unless you remove it first)"
- "Your email is collected automatically from your Google account"

---

## Updating the Form (As Admin)

### When to Update

**Sync Form Options** when:
- You add new posters to Movie Posters sheet
- You hide a poster (set Active? = FALSE)
- You change a poster's title
- You want changes to show immediately

**How to update:**
1. Click **Poster System** → **Sync Form Options Now**
2. Form updates automatically
3. Employees see new/hidden posters next time they open

---

## What You Can't Change in the Form

❌ The structure (questions, order) - system manages this
❌ The email collection - it's required
❌ The slot limit - that's in config
❌ The name format requirement

**You CAN change:**
✅ Posters that appear (Movie Posters sheet, Active? column)
✅ Form title/description (if you manually edit form, then re-sync)
✅ Subscribers email list (Subscribers sheet)

---

## Sharing the Form with Employees

### Option 1: Direct Share Link

In Documentation tab, click the form link and:
1. Click **Share** (top right)
2. Copy the shareable link
3. Send to employees

### Option 2: QR Code

In Print Out tab:
1. Print the page
2. Post it somewhere visible
3. Employees scan with phone
4. Form opens automatically

### Option 3: Email / Slack / Teams

You can send:
- "Fill out this form to request posters: [link]"
- Or just the QR code printout

---

## Troubleshooting: Employee Issues

### "I don't see a poster in the form"
**Reason:** That poster has Active? = FALSE in Movie Posters sheet
**Solution:** Go to Movie Posters sheet, set Active? = TRUE, then sync form

### "The form says I already have that poster"
**Reason:** They requested it before and never removed it
**Solution:** They need to remove it first, then can request again (or it gets unblocked after cooldown period)

### "My name format is being rejected"
**Reason:** Name isn't "FirstName LastInitial" format
**Solution:** They need to use exact format. Examples:
- Sarah M (not Sarah, not Sarah Martinez)
- David Chen (Chen is last initial, not full name)

### "I can only add a few posters, not 7"
**Reason:** They already have some ACTIVE. Adding new + existing = slot count
**Solution:** They need to remove some first to make room

### "Form isn't loading"
**Reason:** Network issue or form might be temporarily down
**Solution:** Refresh browser or try again in a few minutes

---

## Admin: How to Preview Employee Experience

Want to see what employees see?

1. In the Documentation tab, click the form link
2. It opens in edit mode (you see the "edit" URL)
3. Click **Preview** (eye icon at top right)
4. Now you see the form as employees see it
5. Try a test submission!

---

## How Requests Get Recorded

When an employee submits the form:

1. **Form submission is captured** (automatic)
2. **System processes the submission** within seconds
3. **Requests sheet is updated** with the new data
4. **Boards rebuild automatically** to show updated data
5. **If new posters activated:** Announcement is queued

Everything happens in the background—employees don't see the technical details.

---

## Key Takeaways

| Concept | Explanation |
|---------|-------------|
| **Active Poster** | A poster in Movie Posters sheet with Active? = TRUE |
| **Active Request** | A poster an employee currently has |
| **Duplicate Block** | Can't request same poster twice (unless removed first) |
| **Slot** | One space for a poster (employees get 7) |
| **Submit** | The form button employees click to send their requests |
| **Sync** | You telling the system to update the form with new posters |
| **Removed** | A poster the employee deleted from their list |

---

## Next Steps

- **Want to check submissions?** See "Understanding Requests" guide
- **Need to update posters?** See "Adding Posters" guide
- **Want to send announcements?** See "Admin Menu Guide"

