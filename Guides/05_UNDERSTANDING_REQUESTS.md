# Understanding Requests and Boards

How the system records requests and displays them in the Main Board and Employees Board.

---

## Where Do Requests Get Recorded?

### The Requests Sheet (The Official Record)

The **Requests** sheet is where every single request is recorded. It's like an audit log—nothing ever gets deleted, just marked as "REMOVED" when an employee deletes it.

**Why keep deleted requests?**
- You have a complete history
- You can see who requested what and when
- You can spot patterns (which posters are popular?)
- It's like an audit trail for the business

### Important: Requests Sheet is Hidden by Default

The Requests sheet is hidden from view because it's technical. **You can unhide it if needed:**

1. Right-click the sheet tabs at the bottom
2. Click "Unhide" and select "Requests"
3. Now you see all the request data

---

## What Data Is Recorded in Requests Sheet?

Each row is one request. Here are the columns:

| Column | Meaning | Example |
|--------|---------|---------|
| **Timestamp** | When the form was submitted | 2025-01-23 3:45 PM |
| **Email** | Employee's Google email | sarah.m@company.com |
| **Name** | Employee's name (from form) | Sarah M |
| **Poster ID** | Internal unique ID (auto-generated) | 12345 |
| **Poster Label** | What we call the poster | AVATAR_3 |
| **Title** | Movie title (from Movie Posters sheet) | Avatar: The Way of Water |
| **Release Date** | Release date (from Movie Posters sheet) | 2024-12-20 |
| **Action Type** | What the employee did | ADD |
| **Status** | Is it active or removed? | ACTIVE |
| **Status Updated** | When status changed (if removed) | 2025-01-24 2:15 PM |

---

## What Does Each Status Mean?

### Status = ACTIVE
- Employee currently has this poster
- It counts toward their 7-slot limit
- It shows on their Employees Board row
- They can remove it anytime

### Status = REMOVED
- Employee deleted this poster
- It's historical data (for audit trail)
- It does NOT count toward their slot limit
- It does NOT show on Employees Board
- It freed up a slot for a new poster

---

## The Main Board (Visual Display)

### What It Shows

The **Main Board** sheet shows a table of all active posters:

```
Available Posters        Who Requested It    Count
─────────────────────────────────────────────────
Avatar 3                 Sarah M, Alex J     2
                         Jamie L
Dune 2                   Casey M             1
Sonic 3                  David Chen          1
                         Maria G
```

**Column 1: Available Posters**
- All active posters (where someone has at least one ACTIVE request)
- Posters with no ACTIVE requests don't show

**Column 2: Who Requested It**
- Names of employees who have that poster
- One name per line
- Only shows active requests (not removed ones)

**Column 3: Count**
- How many employees have that poster
- Helps you see which are most popular

---

## The Employees Board (Personal View)

### What It Shows

The **Employees Board** sheet shows each employee's active posters:

```
Employee Name       Posters They Have              Count / Limit
─────────────────────────────────────────────────────────────
Alex J              Avatar 3, Sonic 3              2/7
Casey M             Dune 2                         1/7
David Chen          Sonic 3, Nosferatu, Avatar 3  3/7
Jamie L             Avatar 3                       1/7
Maria G             Sonic 3, Wicked                2/7
Sarah M             Avatar 3, Dune 2               2/7
```

**Column 1: Employee Name**
- List of all employees who have made at least one request

**Column 2: Posters They Have**
- All posters with ACTIVE status
- Comma-separated list
- Shows current inventory for that employee

**Column 3: Count / Limit**
- How many they have vs. how many they can have
- "2/7" = 2 out of 7 slots filled
- If they have 7, they're at the limit and can't add more

---

## Walkthrough: What Happens When an Employee Submits

### The Scenario

Alex J opens the form and:
- Already has: Avatar 3, Dune 2
- Requests to ADD: Sonic 3, Wicked
- Requests to REMOVE: Dune 2

### Step 1: System Processes Removals First

```
BEFORE:
Alex J: Avatar 3, Dune 2 [2/7]

AFTER (removals):
Status = REMOVED for Dune 2 request
Alex J: Avatar 3 [1/7]
```

Dune 2 request is marked REMOVED but stays in Requests sheet (historical).

### Step 2: System Processes Additions

```
Can add Sonic 3? Check:
- Is it active? YES ✅
- Does Alex already have Sonic 3? NO ✅
- Do they have a free slot? YES (1/7 used) ✅
Result: APPROVED - add Sonic 3

Can add Wicked? Check:
- Is it active? YES ✅
- Does Alex already have Wicked? NO ✅
- Do they have a free slot? YES (2/7 used) ✅
Result: APPROVED - add Wicked
```

### Step 3: Requests Sheet Updated

Two new rows added:
```
Timestamp: 2025-01-23 3:45 PM, Email: alex.j@company.com, Name: Alex J
Poster: Sonic 3, Status: ACTIVE, Action: ADD

Timestamp: 2025-01-23 3:45 PM, Email: alex.j@company.com, Name: Alex J
Poster: Wicked, Status: ACTIVE, Action: ADD
```

### Step 4: Boards Rebuild Automatically

**Main Board updates:**
```
Sonic 3: Alex J, [other employees who have it]
Wicked: Alex J, [other employees who have it]
Dune 2: [only shows other employees now, not Alex]
```

**Employees Board updates:**
```
Alex J: Avatar 3, Sonic 3, Wicked [3/7]
```

### Step 5: Announcements Queued

If Sonic 3 or Wicked are NEW active posters:
- An announcement email is added to the queue
- Subscribers get notified within 15 minutes
- Email says: "New posters available: Sonic 3, Wicked"

---

## Why Would a Request Be Denied?

### Scenario 1: Employee Already Has It

**Request:** "I want Avatar 3"
**System check:** "Do you already have Avatar 3?"
**Answer:** "Yes, you have it already"
**Result:** ❌ DENIED (Can't request same poster twice)

**What they can do:** Remove it first, then can request again

---

### Scenario 2: No Slots Available

**Employee has:** Poster 1, 2, 3, 4, 5, 6, 7 (7/7)
**Request:** "I want Sonic 3"
**System check:** "Do you have a free slot?"
**Answer:** "No, you're at the limit (7/7)"
**Result:** ❌ DENIED (Too many posters)

**What they can do:** Remove one poster first, then can add the new one

---

### Scenario 3: Poster Isn't Active

**Request:** "I want a poster that was deactivated"
**System check:** "Is that poster active?"
**Answer:** "No, it's set to Active? = FALSE"
**Result:** ❌ DENIED (Poster not available)

**What they can do:** Wait for admin to reactivate it, or request a different poster

---

## How Boards Automatically Update

After every submission:

1. System reads the entire Requests sheet
2. Filters to only ACTIVE requests (ignores REMOVED)
3. Groups by employee
4. Groups by poster
5. Recreates both boards from scratch
6. Fills with current data

**This means:** Boards are always accurate. Even if someone manually edits the sheet, boards rebuild to match.

---

## Looking at Historical Data

Want to see what an employee removed?

1. **Unhide the Requests sheet** (right-click tabs, select "Unhide Requests")
2. **Look at Status column:**
   - ACTIVE = current
   - REMOVED = deleted
3. **See the timeline:**
   - Timestamp shows when added
   - Status Updated shows when removed

---

## Key Metrics

### How to Understand the Numbers

| Metric | What It Means |
|--------|---------------|
| **Sarah has 3/7 posters** | Using 3 of her 7 allowed slots |
| **Sonic 3 has 4 requests** | 4 employees currently have Sonic 3 |
| **Avatar 3 has 6 requests** | 6 employees currently have Avatar 3 (it's popular!) |
| **Dune 2 has 1 request** | 1 employee currently has Dune 2 (not popular yet) |

---

## Common Questions

**Q: Why does a removed poster still show in the Requests sheet?**
A: That's intentional. You need a historical record of everything. It helps with audits and spotting trends.

**Q: Can I manually edit the Requests sheet?**
A: You can, but don't. The system manages it. If you need to fix something, use "Manually Add Request" from the Admin Menu.

**Q: Why do the boards look different after I submit a form?**
A: They're rebuilding! After every submission, the boards clear and rebuild from the Requests sheet. It usually takes 2-5 seconds.

**Q: What if two people submit at the exact same time?**
A: The system uses locks to prevent this. Submissions are processed one at a time, in order.

**Q: Can an employee have the same poster twice?**
A: No. The system checks for duplicates. If they want it again after removing it, it's allowed (depending on your cooldown settings).

---

## Analyzing Request Patterns

The system lets you see patterns:

**Most Popular Posters**
- Check Main Board → Count column
- Posters with highest numbers are most requested

**Most Active Employees**
- Check Employees Board → Count column
- See who's collecting posters

**Request Trends**
- Check Requests sheet → Timestamp column
- See when requests come in (busy times vs. quiet)

**Historical Data**
- Check Requests sheet → Status column
- See which posters people remove most (maybe not popular long-term?)

---

## Troubleshooting

**Q: The boards show old data**
A: Click **Poster System** → **Rebuild Boards Now** to force an update

**Q: I see someone twice on Main Board**
A: Usually means they had the poster, removed it, and re-requested it. Check Requests sheet for full history.

**Q: An employee shows on Employees Board with 0/7 posters**
A: They may have removed all their posters. System keeps the employee listed for context.

---

## Next Steps

- **Want to understand the form?** See "Understanding the Form" guide
- **Want to manage which posters show?** See "Adding Posters" guide
- **Want to check system health?** Go to Documentation tab and scroll to System Health

