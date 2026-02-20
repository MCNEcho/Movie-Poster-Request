// === PRESENTATION LAYER MODULE ===
// Consolidates: Boards.js, PrintOut.js, PosterDisplay.js, Documentation.js
// Provides: Board generation, print layouts, display management, documentation

// ===== BOARD GENERATION =====

function rebuildBoards() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[BOARDS] Starting board rebuild...');

    // Disable recalc during build
    SpreadsheetApp.getActive().disableAllDataValidation();

    buildMainBoard_();
    Logger.log('[BOARDS] Main board built');

    buildEmployeesBoard_();
    Logger.log('[BOARDS] Employees board built');

    // Re-enable recalc
    SpreadsheetApp.getActive().enableAllDataValidation();

    logBoardRebuildEvent_('SUCCESS', 'Both boards rebuilt successfully');
    Logger.log('[BOARDS] Board rebuild complete');

  } catch (err) {
    logError_(err, 'rebuildBoards', 'Board rebuild');
    logBoardRebuildEvent_('ERROR', `Build failed: ${err.message}`);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function buildMainBoard_() {
  const sh = getSheet_(CONFIG.SHEETS.MAIN);
  const requests = getActiveRequests_();

  resetBoardArea_(sh, CONFIG.MAIN.DATA_START_ROW, 200);

  // Group by poster ID
  const byPosterId = {};
  requests.forEach(req => {
    const pid = req.posterId;
    if (!byPosterId[pid]) byPosterId[pid] = [];
    byPosterId[pid].push(req);
  });

  const sortedIds = Object.keys(byPosterId).sort();
  let currentRow = CONFIG.MAIN.DATA_START_ROW;

  // Write header
  sh.getRange(CONFIG.MAIN.HEADER_ROW, 1, 1, 6).setValues([[
    'POSTER TITLE',
    'RELEASE DATE',
    'STOCK',
    'ACTIVE REQUESTS',
    'REQUEST LIST',
    'NOTES'
  ]]);
  styleBoardHeaders_(sh.getRange(CONFIG.MAIN.HEADER_ROW, 1, 1, 6));

  // Write each poster group
  sortedIds.forEach(posterId => {
    const group = byPosterId[posterId];
    if (group.length === 0) return;

    const first = group[0];
    const reqCount = group.length;

    const stock = getStockForPosterId_(posterId) || 'N/A';
    const reqList = group.map(r => `• ${r.empEmail}`).join('\n');

    sh.getRange(currentRow, 1).setValue(first.titleSnap || first.labelAtReq);
    sh.getRange(currentRow, 2).setValue(first.releaseSnap);
    sh.getRange(currentRow, 3).setValue(stock);
    sh.getRange(currentRow, 4).setValue(reqCount);
    sh.getRange(currentRow, 5).setValue(reqList);
    sh.getRange(currentRow, 6).setValue(first.adminNotes || '');

    currentRow++;
  });

  Logger.log(`[BOARDS] Main board: wrote ${sortedIds.length} posters`);
}

function buildEmployeesBoard_() {
  const sh = getSheet_(CONFIG.SHEETS.EMPLOYEES);
  const requests = getActiveRequests_();

  resetBoardArea_(sh, CONFIG.EMPLOYEES.DATA_START_ROW, 200);

  // Group by employee email
  const byEmail = {};
  requests.forEach(req => {
    const email = req.empEmail.toLowerCase();
    if (!byEmail[email]) byEmail[email] = { email, name: req.empName, requests: [] };
    byEmail[email].requests.push(req);
  });

  const sortedEmails = Object.keys(byEmail).sort();
  let currentRow = CONFIG.EMPLOYEES.DATA_START_ROW;

  // Write header
  sh.getRange(CONFIG.EMPLOYEES.HEADER_ROW, 1, 1, 5).setValues([[
    'EMPLOYEE NAME',
    'EMAIL',
    'ACTIVE SLOTS',
    'POSTER LIST',
    'ADMIN NOTES'
  ]]);
  styleBoardHeaders_(sh.getRange(CONFIG.EMPLOYEES.HEADER_ROW, 1, 1, 5));

  // Write each employee group
  sortedEmails.forEach(email => {
    const emp = byEmail[email];
    const slotsUsed = emp.requests.length;

    const postList = emp.requests
      .map(r => `• ${r.titleSnap || r.labelAtReq} (${r.releaseSnap || 'TBD'})`)
      .join('\n');

    sh.getRange(currentRow, 1).setValue(emp.name);
    sh.getRange(currentRow, 2).setValue(email);
    sh.getRange(currentRow, 3).setValue(slotsUsed);
    sh.getRange(currentRow, 4).setValue(postList);
    sh.getRange(currentRow, 5).setValue('');

    currentRow++;
  });

  Logger.log(`[BOARDS] Employees board: wrote ${sortedEmails.length} employees`);
}

function resetBoardArea_(sh, startRow, numRows) {
  if (startRow < 1) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;

  sh.getRange(startRow, 1, numRows, lastCol).clearContent();
}

function styleBoardHeaders_(range) {
  range
    .setBackground('#4C90E2')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('CENTER')
    .setVerticalAlignment('MIDDLE');
}

function getStockForPosterId_(posterId) {
  const invSheet = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(invSheet, 11, 3);

  const row = data.find(r => String(r[COLS.INVENTORY.POSTER_ID - 1]) === String(posterId));
  if (!row) return null;

  return row[COLS.INVENTORY.STOCK - 1];
}

// ===== PRINT OUT LAYOUT =====

function updateInventoryLastUpdated_() {
  const sh = getSheet_(CONFIG.SHEETS.INVENTORY);
  const headerRow = 1;
  const tsCol = COLS.INVENTORY.LAST_UPDATED;

  sh.getRange(headerRow, tsCol).setValue(fmtDate_(now_(), CONFIG.DATE_FORMAT));
}

function refreshPrintOut() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[PRINTOUT] Starting print layout refresh...');

    buildPrintOutLayout_();
    updatePosterOutsideTimestamp_();
    updatePosterInsideTimestamp_();
    insertFloatingQrQuickchart_();

    Logger.log('[PRINTOUT] Print layout refresh complete');
  } catch (err) {
    logError_(err, 'refreshPrintOut', 'Print layout refresh');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function buildPrintOutLayout_() {
  const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
  const requests = getActiveRequests_();

  // Sort by release date
  const sorted = sortInventoryByReleaseDate_(
    requests.map(r => ({ ...r, posterId: r.posterId }))
  );

  const startRow = 5; // Leave some room for title/metadata
  sh.getRange(startRow, 1, 1000, 10).clearContent();

  // Write inventory list in print format
  let row = startRow;
  sorted.forEach((item, i) => {
    sh.getRange(row, 1).setValue(i + 1); // Number
    sh.getRange(row, 2).setValue(item.titleSnap || item.labelAtReq);
    sh.getRange(row, 3).setValue(item.releaseSnap);
    sh.getRange(row, 4).setValue(getStockForPosterId_(item.posterId) || 0);
    sh.getRange(row, 5).setValue(''); // Space for quantity taken
    row++;
  });

  // Apply print formatting
  const range = sh.getRange(startRow - 1, 1, row - startRow, 5);
  range.setFontSize(10).setVerticalAlignment('MIDDLE');

  Logger.log(`[PRINTOUT] Wrote ${row - startRow} items to print layout`);
}

function insertFloatingQrQuickchart_() {
  try {
    const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
    const formUrl = getCachedFormUrl_();

    if (!formUrl) {
      Logger.log('[PRINTOUT] No form URL available for QR code');
      return;
    }

    removeAllFloatingImages_();

    // Create QR code via QuickChart
    const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(formUrl)}&size=200`;

    // Insert image at a fixed position (e.g., top-right)
    const image = sh.insertImage(qrUrl, 6, 1);
    image.setHeight(150).setWidth(150);

    Logger.log('[PRINTOUT] QR code inserted');

  } catch (err) {
    Logger.log(`[WARN] QR code insertion failed: ${err.message}`);
  }
}

function removeAllFloatingImages_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.PRINT_OUT);
  if (!sh) return;

  const images = sh.getImages();
  if (!images || images.length === 0) return;

  images.forEach(img => {
    try { img.remove(); } catch (e) {}
  });

  Logger.log(`[PRINTOUT] Removed ${images.length} floating images`);
}

// ===== POSTER DISPLAY MANAGEMENT =====

function setupPosterOutsideTab_() {
  try {
    console.log('[DISPLAY] Setting up Poster Outside tab...');
    const sh = getSheet_(CONFIG.SHEETS.POSTER_OUTSIDE);

    sh.clearContents();

    // Write title
    sh.getRange(1, 1).setValue('CURRENT AVAILABLE POSTERS');
    sh.getRange(1, 1).setFontSize(16).setFontWeight('bold');

    // Create dropdown selector
    setupMovieTitleDropdowns_(sh);

    // Write timestamp
    updatePosterOutsideTimestamp_();

    Logger.log('[DISPLAY] Poster Outside setup complete');
  } catch (err) {
    logError_(err, 'setupPosterOutsideTab_', 'Poster Outside setup');
  }
}

function setupPosterInsideTab_() {
  try {
    Logger.log('[DISPLAY] Setting up Poster Inside tab...');
    const sh = getSheet_(CONFIG.SHEETS.POSTER_INSIDE);

    sh.clearContents();

    // Write title
    sh.getRange(1, 1).setValue('EMPLOYEE VIEW - AVAILABLE POSTERS');
    sh.getRange(1, 1).setFontSize(16).setFontWeight('bold');

    // Create dropdown selector
    setupMovieTitleDropdowns_(sh);

    // Write timestamp
    updatePosterInsideTimestamp_();

    Logger.log('[DISPLAY] Poster Inside setup complete');
  } catch (err) {
    logError_(err, 'setupPosterInsideTab_', 'Poster Inside setup');
  }
}

function setupMovieTitleDropdowns_(sh) {
  try {
    const titles = getMovieTitlesFromInventory_();
    if (titles.length === 0) {
      sh.getRange(3, 1).setValue('(No active posters)');
      return;
    }

    // Write list of movie titles with checkboxes
    let row = 3;
    titles.forEach(title => {
      sh.getRange(row, 1).setValue('☐ ' + title);
      row++;
    });

    Logger.log(`[DISPLAY] Created dropdown list with ${titles.length} titles`);
  } catch (err) {
    Logger.log(`[WARN] Dropdown setup failed: ${err.message}`);
  }
}

function getMovieTitlesFromInventory_() {
  const invSheet = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(invSheet, 11, 3);

  const titles = data
    .filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true)
    .map(r => r[COLS.INVENTORY.TITLE - 1])
    .filter(t => t && String(t).trim().length > 0)
    .sort();

  return Array.from(new Set(titles));
}

function updatePosterOutsideTimestamp_() {
  const sh = getSheet_(CONFIG.SHEETS.POSTER_OUTSIDE);
  sh.getRange(2, 1).setValue(`Last updated: ${fmtDate_(now_(), CONFIG.DATE_FORMAT)}`);
}

function updatePosterInsideTimestamp_() {
  const sh = getSheet_(CONFIG.SHEETS.POSTER_INSIDE);
  sh.getRange(2, 1).setValue(`Last updated: ${fmtDate_(now_(), CONFIG.DATE_FORMAT)}`);
}

function refreshDisplayDropdowns_() {
  try {
    setupMovieTitleDropdowns_(getSheet_(CONFIG.SHEETS.POSTER_OUTSIDE));
    setupMovieTitleDropdowns_(getSheet_(CONFIG.SHEETS.POSTER_INSIDE));
  } catch (err) {
    Logger.log(`[WARN] Failed to refresh display dropdowns: ${err.message}`);
  }
}

function showDisplayManagerDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial; max-width: 500px;">
      <h2>Poster Display Manager</h2>
      <p>Options:</p>
      <ul>
        <li><button onclick="refreshOutside()">Refresh Poster Outside</button></li>
        <li><button onclick="refreshInside()">Refresh Poster Inside</button></li>
        <li><button onclick="both()">Refresh Both</button></li>
      </ul>
      <script>
        function refreshOutside() {
          google.script.run.updatePosterOutsideTimestamp_();
          alert('Poster Outside refreshed!');
        }
        function refreshInside() {
          google.script.run.updatePosterInsideTimestamp_();
          alert('Poster Inside refreshed!');
        }
        function both() {
          google.script.run.updatePosterOutsideTimestamp_();
          google.script.run.updatePosterInsideTimestamp_();
          alert('Both displays refreshed!');
        }
      </script>
    </div>
  `)
    .setWidth(500)
    .setHeight(300);

  SpreadsheetApp.getUi().showModalDialog(html, 'Display Manager');
}

// ===== DOCUMENTATION GENERATION =====

function buildDocumentationTab() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[DOCS] Building documentation tab...');

    const docSh = getSheet_(CONFIG.SHEETS.DOCUMENTATION);
    docSh.clearContents();

    let row = 1;

    writeDocTitle_(docSh, row, 'MOVIE POSTER REQUEST SYSTEM - DOCUMENTATION');
    row += 2;

    row = writeDocSection_(docSh, row, 'OVERVIEW', [
      'This system manages employee poster requests with the following features:',
      `• Each employee can maintain up to ${CONFIG.MAX_ACTIVE} active poster requests`,
      '• Employees submit/remove requests via the linked Google Form',
      '• Real-time board generation showing active requests by poster and employee',
      '• Automatic email announcements when posters become available',
      '• Full audit trail of all requests and changes'
    ]);

    row = writeDocSection_(docSh, row, 'DEDUPLICATION RULES', [
      getDedupRuleDescription_()
    ]);

    row = writeDocSection_(docSh, row, 'FORM SUBMISSION', [
      'To request posters:',
      '1. Fill out your name (First Last)',
      '2. Select posters to ADD to your request list',
      '3. Select any posters to REMOVE from your current list',
      '4. (Optional) Check the subscribe box to receive email announcements'
    ]);

    const formUrl = getCachedFormUrl_();
    if (formUrl) {
      writeDocPara_(docSh, row, `📋 Request Form: ${formUrl}`);
      row++;
    }

    docSh.setColumnWidth(1, 500);
    docSh.setFrozenRows(1);

    Logger.log('[DOCS] Documentation tab complete');
  } catch (err) {
    logError_(err, 'buildDocumentationTab', 'Documentation generation');
  } finally {
    lock.releaseLock();
  }
}

function writeDocTitle_(sh, row, text) {
  sh.getRange(row, 1).setValue(text);
  sh.getRange(row, 1).setFontSize(18).setFontWeight('bold');
}

function writeDocPara_(sh, row, text) {
  sh.getRange(row, 1).setValue(text);
  sh.getRange(row, 1).setFontSize(11).setWrap(true);
}

function writeDocSection_(sh, row, title, paragraphs) {
  // Write section title
  sh.getRange(row, 1).setValue(title);
  sh.getRange(row, 1).setFontSize(14).setFontWeight('bold').setBackground('#D3D3D3');
  row++;

  // Write paragraphs
  paragraphs.forEach(para => {
    writeDocPara_(sh, row, para);
    row++;
  });

  return row + 1;
}

function getDedupSummary_() {
  const sh = getSheet_(CONFIG.SHEETS.REQUESTS);
  const data = getNonEmptyData_(sh, 9);

  const totalReqs = data.length;
  const activeReqs = data.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE).length;
  const removedReqs = data.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.REMOVED).length;

  return `Total requests: ${totalReqs} | Active: ${activeReqs} | Removed: ${removedReqs}`;
}

function getDedupRuleDescription_() {
  return String([
    'Deduplication enforced by email + poster ID combination:',
    `• Each employee can request each poster at most once (unless removed and re-requested)`,
    `• Multiple employees can request the same poster`,
    `• Requests marked REMOVED are not counted towards active limits`,
    `• Cooldown period (if configured): ${CONFIG.REREQUEST_COOLDOWN_DAYS ?? 0} days before re-requesting after removal`
  ].join('\n'));
}

function writeDocFormLink_() {
  const url = getCachedFormUrl_();
  return url ? `Form: ${url}` : '(Form not configured)';
}
```
