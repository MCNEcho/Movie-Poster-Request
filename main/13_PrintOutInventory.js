/** 13_PrintOutInventory.js **/

function updateInventoryLastUpdated_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  inv.getRange(CONFIG.INVENTORY_LAST_UPDATED_CELL)
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
}

/**
 * Auto-sort Inventory sheet by Release Date (ascending)
 * Maintains headers and sorts data rows only
 */
function autoSortInventoryByReleaseDate_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  
  if (lastRow <= 1) return; // No data to sort
  
  const dataRange = inv.getRange(2, 1, lastRow - 1, COL_COUNTS.INVENTORY);
  dataRange.sort(COLS.INVENTORY.RELEASE);
}

/**
 * Ensure Inventory has unique Poster IDs for each entry
 * Auto-generates IDs based on Title + Release Date if missing
 */
function ensureInventoryPosterIds_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  
  if (lastRow < 2) return;
  
  const range = inv.getRange(2, 1, lastRow - 1, COL_COUNTS.INVENTORY);
  const values = range.getValues();
  let changed = false;
  
  values.forEach((r, idx) => {
    const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
    const rel = r[COLS.INVENTORY.RELEASE - 1];
    const existingId = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
    
    if (title && rel instanceof Date && !existingId) {
      // Generate ID using shared utility
      const newId = generatePosterId_(title, rel);
      r[COLS.INVENTORY.POSTER_ID - 1] = newId;
      changed = true;
    }
  });
  
  if (changed) range.setValues(values);
}

function syncInventoryCountsToMoviePosters_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const mp  = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);

  const invData = getNonEmptyData_(inv, COL_COUNTS.INVENTORY);

  // Map by Title+ReleaseDate => sum Posters
  const invMap = {};
  invData.forEach(r => {
    const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
    const rel = r[COLS.INVENTORY.RELEASE - 1];
    const posters = r[COLS.INVENTORY.POSTERS - 1];

    if (!title || !(rel instanceof Date)) return;

    const key = `${normalizeTitle_(title)}|${fmtDate_(rel,'yyyy-MM-dd')}`;
    const n = Number(posters || 0);
    invMap[key] = (invMap[key] || 0) + (isNaN(n) ? 0 : n);
  });

  const lastRow = mp.getLastRow();
  if (lastRow < 2) return;

  const range = mp.getRange(2, 1, lastRow - 1, 8);
  const values = range.getValues();
  let changed = false;

  values.forEach(r => {
    const title = String(r[COLS.MOVIE_POSTERS.TITLE - 1] || '').trim();
    const rel = r[COLS.MOVIE_POSTERS.RELEASE - 1];
    if (!title || !(rel instanceof Date)) return;

    const key = `${normalizeTitle_(title)}|${fmtDate_(rel,'yyyy-MM-dd')}`;
    const count = invMap[key] || '';

    if (r[COLS.MOVIE_POSTERS.INV_COUNT - 1] !== count) {
      r[COLS.MOVIE_POSTERS.INV_COUNT - 1] = count;
      changed = true;
    }
  });

  if (changed) range.setValues(values);

  // Inventory sync impacts poster availability; clear related caches
  invalidatePosterAvailability_();
}

function updatePrintOut() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
    const { empQrEndRow } = buildPrintOutLayout_();

    // Keep this lightweight: just rebuild layout; selection is handled by prepareAndSelectPrintArea()
    sh.setActiveSelection(sh.getRange(4, 1, Math.max(2, empQrEndRow - 4 + 1), 3));
    SpreadsheetApp.getActive().toast('Print Out updated. Use "Prepare Print Area" if you need selection.', 'Print Out', 5);
  } finally {
    lock.releaseLock();
  }
}
