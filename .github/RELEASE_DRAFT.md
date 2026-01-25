# v1.1 Changelog

**Release Date:** January 23, 2026

## Added
- 🎓 9 comprehensive user guides (87 KB, 50+ topics)
- 💻 25 source modules with proper organization
- 🛡️ Centralized error handling and logging
- ⚡ TTL-based caching (60-80% quota reduction)
- 📊 Analytics tracking and health dashboard
- 🔧 Data integrity checker and auto-repair
- 📢 Email announcement batching
- 💾 Nightly backups to Google Drive
- 🎯 15+ admin menu buttons
- 📱 Bulk simulator for stress testing

## Changed
- Moved guides to dedicated `/Guides/` folder
- Reorganized configuration (all in `00_Config.js`)
- Grouped admin menu items by category
- Request status now ACTIVE/REMOVED (audit trail)
- Form responses snapshot poster state

## Fixed
- Lock-based concurrency control
- Graceful quota limit handling
- Form response validation
- Auto-detection of orphaned/duplicate requests
- Improved performance with caching

## Removed
- Hardcoded column numbers
- Scattered inline configuration
- Manual error logging
- Sheet operations without locks

---

**No breaking changes • All existing data preserved • Backward compatible**

### Quick Start
```bash
git clone https://github.com/MCNEcho/Movie-Poster-Request.git
./scripts/quickstart_clasp.bat
```

See [Guides/01_GETTING_STARTED.md](../Guides/01_GETTING_STARTED.md) for full setup.

