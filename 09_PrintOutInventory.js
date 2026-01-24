/** 09_PrintOut_And_InventorySync.gs**/

function updateInventoryLastUpdated_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  inv.getRange(CONFIG.INVENTORY_LAST_UPDATED_CELL)
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
}

function syncInventoryCountsToMoviePosters_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const mp  = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);

  const invData = getNonEmptyData_(inv, 8);

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
}

function refreshPrintOut() {
  const print = getSheet_(CONFIG.SHEETS.PRINT_OUT);

  // Note: Last Updated date is now in cell B4 of the print layout (no longer needed here)
  // Clear H1 if it has old data
  print.getRange(CONFIG.PRINT.LAST_UPDATED_CELL).clearContent();

  // Headers at A6/B6 (or wherever LIST_START_ROW points)
  const startRow = CONFIG.PRINT.LIST_START_ROW;
  print.getRange(startRow, 1).setValue('Release Date');
  print.getRange(startRow, 2).setValue('Movie Title');

  // Clear any old spill area below the headers (prevents "would overwrite data" errors)
  // Clears A(startRow+1):B down a reasonable range
  const clearRows = Math.max(200, print.getMaxRows() - (startRow + 1));
  print.getRange(startRow + 1, 1, clearRows, 2).clearContent();

  // Put the spilling formula in A(startRow+1), not A(startRow)
  print.getRange(startRow + 1, 1).setFormula(
    `=SORT(FILTER(${CONFIG.SHEETS.INVENTORY}!A2:B, ${CONFIG.SHEETS.INVENTORY}!B2:B<>""), 1, TRUE)`
  );

  // Basic formatting
  print.setFrozenRows(0);
  print.setColumnWidths(1, 2, 250);
}
