# 📚 Guides Folder — Quick Reference

## What's Inside

```
Guides/
├── README.md                         [Start here]
│   └─ Navigation guide, FAQ, quick links
│
├── 01_GETTING_STARTED.md            [First time setup]
│   └─ Deployment, configuration, verification
│
├── 02_ADMIN_MENU_GUIDE.md           [Every button explained]
│   ├─ Top level buttons (Setup, Refresh All)
│   ├─ Reports menu (Rebuild, Sync, Refresh)
│   ├─ Print & Layout menu (Print area, inventory)
│   ├─ Announcements menu (Preview, Send)
│   ├─ Advanced menu (Add, Backup, Employee View)
│   └─ Quick problem solver table
│
├── 03_ADDING_POSTERS.md             [How to add movies]
│   ├─ Opening Movie Posters sheet
│   ├─ Correct title/date formatting
│   ├─ The critical "Sync" step
│   ├─ Verification
│   └─ Troubleshooting
│
├── 04_UNDERSTANDING_THE_FORM.md     [What employees see]
│   ├─ Form structure (questions)
│   ├─ How to request/remove
│   ├─ How to subscribe to emails
│   ├─ Scenarios (add only, remove only, swap)
│   ├─ How to share with employees
│   └─ Preview mode for admins
│
├── 05_UNDERSTANDING_REQUESTS.md     [How data works]
│   ├─ Requests sheet (official record)
│   ├─ ACTIVE vs REMOVED status
│   ├─ Main Board (all posters)
│   ├─ Employees Board (per person)
│   ├─ Request submission flow
│   ├─ Why requests get denied
│   └─ Viewing historical data
│
├── 06_TROUBLESHOOTING.md            [Fix problems]
│   ├─ Menu doesn't appear
│   ├─ Poster doesn't show in form
│   ├─ Form won't load
│   ├─ Employee can only add a few posters
│   ├─ Boards show wrong data
│   ├─ Announcements not sending
│   ├─ System health shows errors
│   ├─ Permission denied errors
│   ├─ Data recovery
│   └─ Prevention tips
│
└── 07_ADVANCED_CONFIG.md            [Customize settings]
    ├─ Change 7-slot limit to 5 or 10
    ├─ Allow/disallow re-requesting
    ├─ Cooldown periods
    ├─ Cache performance tuning
    ├─ Announcement batching
    ├─ Backup retention
    ├─ Email templates
    └─ When NOT to change config
```

---

## 🎯 Find Your Answer in 30 Seconds

| Question | Read This |
|----------|-----------|
| How do I set this up? | `01_GETTING_STARTED.md` |
| What does the ___ button do? | `02_ADMIN_MENU_GUIDE.md` |
| How do I add a poster? | `03_ADDING_POSTERS.md` |
| What do employees see? | `04_UNDERSTANDING_THE_FORM.md` |
| Who has which poster? | `05_UNDERSTANDING_REQUESTS.md` |
| Something is broken! | `06_TROUBLESHOOTING.md` |
| Change 7-poster limit to 5 | `07_ADVANCED_CONFIG.md` |
| Main Board shows wrong data | `06_TROUBLESHOOTING.md` → Boards Section |
| New poster doesn't appear | `03_ADDING_POSTERS.md` → Sync step |
| Employee form won't load | `06_TROUBLESHOOTING.md` → Form Won't Load |

---

## 📖 Reading Time

- **Getting Started** — 15 min (first time only)
- **Admin Menu** — 20 min reference (skim as needed)
- **Adding Posters** — 10 min per poster
- **Understanding Form** — 15 min (optional)
- **Understanding Requests** — 15 min (optional)
- **Troubleshooting** — 5-10 min per issue
- **Advanced Config** — 15 min (optional)

---

## ✅ What Each Guide Covers

### 01 Getting Started
- Install and deploy
- Configure spreadsheet
- Run initial setup
- Verify it worked
- Add first poster
- Share with employees

### 02 Admin Menu
- 15+ buttons documented
- When to click each one
- What happens after
- How long it takes
- Is it safe?
- Pro tips

### 03 Adding Posters
- Open the right sheet
- Enter data correctly
- Required date format
- The "Sync" step (critical!)
- Multiple posters at once
- Hide vs delete

### 04 Understanding Form
- Questions employees see
- How to request
- How to remove
- How to subscribe
- How to share
- Common mistakes

### 05 Understanding Requests
- Where data stored
- Status types
- Board displays
- Request processing
- Why denied?
- Analytics

### 06 Troubleshooting
- 10+ problems solved
- Step-by-step fixes
- Permissions issues
- Email problems
- Data recovery
- Prevention

### 07 Advanced Config
- Change slot limit
- Re-request settings
- Cache tuning
- Email templates
- Backup settings
- What's safe to change

---

## 🚀 Common Workflows

**"I'm setting up for the first time"**
1. Read: 01_GETTING_STARTED.md
2. Follow: All 6 steps
3. Verify: Checklist at end
4. Done! ✅

**"I want to add a new movie today"**
1. Read: 03_ADDING_POSTERS.md (quick reference)
2. Follow: Steps 1-5
3. Remember: The SYNC step is critical!
4. Done! ✅

**"Something is broken"**
1. Go to: 06_TROUBLESHOOTING.md
2. Find: Your problem in the list
3. Follow: The solution steps
4. Done! ✅

**"I want to change the 7-poster limit"**
1. Go to: 07_ADVANCED_CONFIG.md
2. Find: The MAX_ACTIVE setting
3. Edit: 00_Config.js
4. Follow: Save and test instructions
5. Done! ✅

---

## 💡 Pro Tips

1. **Bookmark Guides/README.md** — Quick navigation to everything
2. **Bookmark 02_ADMIN_MENU_GUIDE.md** — Reference for daily operations
3. **Print 03_ADDING_POSTERS.md** — Keep next to desk for checklist
4. **Share 01_GETTING_STARTED.md** — Send to others who need to use system
5. **Use 06_TROUBLESHOOTING.md first** — Fixes 90% of issues

---

## 📱 How Guides Help Different Roles

### **System Administrator**
- Read: 01, 02, 07
- Reference: 02, 06 (daily)
- Skills: Setup, buttons, troubleshooting, config

### **Movie Manager (Adds Posters)**
- Read: 03
- Reference: 03, 06 (daily)
- Skills: Adding movies, syncing, fixing

### **Announcement Manager (Sends Emails)**
- Read: 02 (Announcements section)
- Reference: 02, 06 (daily)
- Skills: Preview, send, troubleshoot

### **Support Person (Helps Employees)**
- Read: 04, 05
- Reference: 04, 05, 06 (when helping)
- Skills: Form, requests, explaining

### **Employee (Uses Form)**
- Read: 04
- Reference: None needed
- Skills: Request, remove, subscribe

---

## 🔗 Cross-References

**In 01_GETTING_STARTED.md:**
→ See 03_ADDING_POSTERS for more details on adding
→ See 02_ADMIN_MENU_GUIDE for menu reference

**In 03_ADDING_POSTERS.md:**
→ See README for date format help
→ See 02_ADMIN_MENU_GUIDE for Sync Form button details
→ See 06_TROUBLESHOOTING if poster doesn't appear

**In 06_TROUBLESHOOTING.md:**
→ See 02_ADMIN_MENU_GUIDE to understand buttons better
→ See 03_ADDING_POSTERS for format questions
→ See 04_UNDERSTANDING_THE_FORM for employee questions

---

## ❓ Frequently Looked Up

1. **How to sync the form?** → 03_ADDING_POSTERS.md, Step 5
2. **What does "Run Setup / Repair" do?** → 02_ADMIN_MENU_GUIDE.md, Top Level
3. **Why is poster hidden?** → 05_UNDERSTANDING_REQUESTS.md
4. **Employee name format?** → 04_UNDERSTANDING_THE_FORM.md
5. **Change slot limit?** → 07_ADVANCED_CONFIG.md, MAX_ACTIVE
6. **Announcements not sending?** → 06_TROUBLESHOOTING.md, Announcements section
7. **Where is Requests sheet?** → 05_UNDERSTANDING_REQUESTS.md, first section
8. **How to share form?** → 04_UNDERSTANDING_THE_FORM.md, Sharing section

---

## 📊 Guides by Complexity

**Beginner** (Easy to understand)
- 01_GETTING_STARTED.md
- 03_ADDING_POSTERS.md
- 04_UNDERSTANDING_THE_FORM.md

**Intermediate** (Some technical knowledge)
- 02_ADMIN_MENU_GUIDE.md
- 05_UNDERSTANDING_REQUESTS.md
- 06_TROUBLESHOOTING.md

**Advanced** (Configuration, customization)
- 07_ADVANCED_CONFIG.md

---

## ✨ What Makes These Guides Special

✅ **Real examples** for every concept
✅ **Step-by-step** walkthroughs (not just descriptions)
✅ **Plain English** (no jargon or code unless explained)
✅ **Problem solver** sections (when X, do Y)
✅ **Tables and lists** for quick scanning
✅ **Cross-references** between related guides
✅ **FAQ sections** for quick answers
✅ **Pro tips** from experienced use
✅ **Troubleshooting** for common mistakes
✅ **Prevention tips** to avoid problems

---

**👉 Ready to start? Open `README.md` in the Guides folder!**
