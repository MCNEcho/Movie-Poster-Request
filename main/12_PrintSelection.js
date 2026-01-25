/** 12_PrintSelection.gs **/

function prepareAndSelectPrintArea() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
    const { lastMovieRow, empQrEndRow } = buildPrintOutLayout_();

    // Select the printable area
    sh.activate();
    sh.setActiveRange(sh.getRange(4, 1, empQrEndRow - 4 + 1, 3));

    SpreadsheetApp.getActive().toast(
      `Selected print area. Now Ctrl+P → "Selected cells".`,
      'Print Ready',
      8
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Builds Print Out sheet with:
 * - Form & Employee View links at top (rows 1-2)
 * - Movie posters from Movie Posters sheet (filtered by ACTIVE status)
 * - Form QR code: spans from Last Updated header to last movie
 * - Employee View QR code: starts 10 rows below last movie
 * Returns the last movie row number.
 */
function buildPrintOutLayout_() {
  const ss = SpreadsheetApp.getActive();
  const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);

  // Clean printing aesthetics
  sh.setHiddenGridlines(true);
  sh.getBandings().forEach(b => b.remove());
  sh.setConditionalFormatRules([]);

  // Break merges and clear the working area (A/B only)
  sh.getRange(1, 1, sh.getMaxRows(), 2).breakApart();
  sh.getRange(1, 1, sh.getMaxRows(), 2).clear({ contentsOnly: false });

  // Clear column C (QR area) before re-inserting QR headers and codes
  sh.getRange(1, 3, sh.getMaxRows(), 1).clear({ contentsOnly: true, formatOnly: true });

  // Remove old floating images
  removeAllFloatingImages_(sh);

  // --- Row 1-2: URLs (always at top) ---
  const formUrl = getOrCreateForm_().getPublishedUrl();
  const empUrl = getEmployeeViewEmployeesUrl_();

  sh.getRange('A1').setValue('Form URL').setFontWeight('bold');
  sh.getRange('B1').setValue(formUrl);
  sh.getRange('A2').setValue('Employees View URL').setFontWeight('bold');
  sh.getRange('B2').setValue(empUrl || '(Not set up - run Setup Employee View Spreadsheet)');

  // --- Row 4: Last Updated header ---
  sh.getRange('A4:B4').merge();
  sh.getRange('A4')
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd')}`)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.getRange('C4')
    .setValue('Form QR Code')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // --- Row 5: Column headers ---
  sh.getRange('A5').setValue('Release Date').setFontWeight('bold');
  sh.getRange('B5').setValue('Movie Title').setFontWeight('bold');
  sh.getRange('A5:B5').setBackground('#eeeeee');

  // Set column widths
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 520);
  sh.setColumnWidth(3, 260);

  // --- Get ACTIVE posters from Inventory sheet ---
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const invData = getNonEmptyData_(inv, COL_COUNTS.INVENTORY);
  
  const activePosters = invData
    .filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true)
    .map(r => ({
      release: r[COLS.INVENTORY.RELEASE - 1],
      title: String(r[COLS.INVENTORY.TITLE - 1] || '').trim(),
    }))
    .filter(p => p.title && p.release)
    .sort((a, b) => new Date(a.release) - new Date(b.release));

  // --- Insert poster rows starting at row 6 ---
  const startRow = 6;
  let lastPopulatedRow = startRow;
  if (activePosters.length > 0) {
    const rows = activePosters.map(p => [p.release, p.title]);
    sh.getRange(startRow, 1, rows.length, 2).setValues(rows);
    sh.getRange(startRow, 1, rows.length, 1).setNumberFormat('m/d/yyyy');
    lastPopulatedRow = startRow + rows.length - 1;
  } else {
    sh.getRange('A6').setValue('(No active posters)');
    lastPopulatedRow = 6;
  }

  // --- Employee QR label: 15 rows below Form QR (which is at row 5) ---
  const empQrLabelRow = 5 + 15;

  // The actual last data row is already calculated from lastPopulatedRow
  const actualLastDataRow = lastPopulatedRow;

  // Clear all rows AFTER the actual last populated row in column A only
  const maxRows = sh.getMaxRows();
  if (actualLastDataRow + 1 <= maxRows) {
    sh.getRange(actualLastDataRow + 1, 1, maxRows - actualLastDataRow, 3).clear({ contentsOnly: true, formatOnly: true });
  }

  // --- QR Code Labels: Consistent formatting ---
  // Form QR label (C4)
  sh.getRange('C4')
    .setValue('Form QR Code')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setFontColor('#222');

  // Employee QR label (C{empQrLabelRow})
  sh.getRange(`C${empQrLabelRow}`)
    .setValue('Employee View QR Code')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setFontColor('#222');

  // --- Borders for main table: A4:B (only on A/B columns, not C) ---
  const tableRange = sh.getRange(4, 1, actualLastDataRow - 4 + 1, 2);
  tableRange.setBorder(true, true, true, true, true, true);

  // --- Insert QR codes ---
  // Form QR: in column C starting from row 5
  insertFloatingQrQuickchart_(sh, formUrl, 3, 5, 220);

  // Employee QR: 1 row below the label
  insertFloatingQrQuickchart_(sh, empUrl, 3, empQrLabelRow + 1, 220);

  // Return both last movie row and the last row used by QR area
  return { lastMovieRow: actualLastDataRow, empQrEndRow: empQrLabelRow + 1 };
}

/**
 * Inserts a QuickChart QR as a FLOATING image (movable).
 * col,row are the anchor cell for top-left corner.
 */
function insertFloatingQrQuickchart_(sheet, text, col, row, sizePx) {
  const cleaned = String(text || '').trim();
  if (!cleaned || cleaned === '(Not set up - run Setup Employee View Spreadsheet)') {
    Logger.log(`[insertFloatingQrQuickchart_] Skipping QR: URL is missing or invalid: "${cleaned}"`);
    sheet.getRange(row, col).setValue('(QR not available)').setFontColor('red').setFontSize(10);
    return null;
  }
  const encoded = encodeURIComponent(cleaned);
  const qrUrl = `https://quickchart.io/qr?text=${encoded}&size=${sizePx}&format=png`;
  Logger.log(`[insertFloatingQrQuickchart_] Requesting QR for: ${cleaned}`);
  try {
    const blob = UrlFetchApp.fetch(qrUrl).getBlob().setName('qr.png');
    const img = sheet.insertImage(blob, col, row);
    img.setWidth(sizePx);
    img.setHeight(sizePx);
    return img;
  } catch (err) {
    Logger.log(`[insertFloatingQrQuickchart_] ERROR fetching QR: ${err.message}`);
    sheet.getRange(row, col).setValue('(QR error)').setFontColor('red').setFontSize(10);
    return null;
  }
}

/** Removes all floating images from the sheet (prevents duplicates each run) */
function removeAllFloatingImages_(sheet) {
  sheet.getImages().forEach(img => img.remove());
}
