/** 07_Boards.gs **/

function rebuildBoards() {
  buildMainBoard_();
  buildEmployeesBoard_();
  syncEmployeeViewSpreadsheet_();
  
  // Refresh health banner after board rebuild
  try {
    renderHealthBanner_();
  } catch (err) {
    Logger.log(`[WARN] Health banner refresh after board rebuild failed: ${err.message}`);
  }
}

function resetBoardArea_(sheet, colsToClear) {
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  const cols = Math.min(colsToClear || 2, maxCols);

  // Break apart all merges in the area
  sheet.getRange(1, 1, maxRows, cols).breakApart();
  
  // Remove all bandings and conditional formatting
  sheet.getBandings().forEach(b => b.remove());
  sheet.setConditionalFormatRules([]);
  
  // Clear ALL content AND formatting in the area
  sheet.getRange(1, 1, maxRows, cols).clear({ contentsOnly: false });
}

function buildMainBoard_() {
  const main = getSheet_(CONFIG.SHEETS.MAIN);
  resetBoardArea_(main, 2);

  const rows = getActiveRequests_();
  Logger.log(`[buildMainBoard] Found ${rows.length} ACTIVE requests`);
  const idToLabel = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});

  const byPoster = {};
  rows.forEach(r => {
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
    (byPoster[pid] = byPoster[pid] || []).push(r);
  });

  const posters = getPostersWithLabels_();
  const posterInfo = {};
  posters.forEach(p => {
    posterInfo[p.posterId] = {
      title: p.title,
      release: p.release,
      inv: p.invCount,
    };
  });

  const posterIds = Object.keys(byPoster).sort((a, b) => {
    const ar = posterInfo[a] ? new Date(posterInfo[a].release) : new Date('2100-01-01');
    const br = posterInfo[b] ? new Date(posterInfo[b].release) : new Date('2100-01-01');
    return ar - br;
  });

  let out = [];
  posterIds.forEach(pid => {
    const info = posterInfo[pid] || {};
    const headerBase = idToLabel[pid] || info.title || pid;
    const header = (info.inv !== '' && info.inv != null) ? `${headerBase} — Inventory: ${info.inv}` : headerBase;

    out.push([header, '']);

    const list = (byPoster[pid] || []).slice().sort(
      (r1, r2) => new Date(r1[COLS.REQUESTS.REQ_TS - 1]) - new Date(r2[COLS.REQUESTS.REQ_TS - 1])
    );

    list.forEach(r => out.push([String(r[COLS.REQUESTS.EMP_NAME - 1]), r[COLS.REQUESTS.REQ_TS - 1]]));

    out.push(['', '']);
    out.push(['', '']);
  });

  if (out.length === 0) out = [['No ACTIVE requests yet', '']];

  main.getRange(1, 1, out.length, 2).setValues(out);

  // Clear all rows below the new data to remove orphaned entries
  const maxRows = main.getMaxRows();
  if (out.length + 1 <= maxRows) {
    main.getRange(out.length + 1, 1, maxRows - out.length, 2).clearContent();
  }

  const used = main.getRange(1, 1, out.length, 2);
  used.setBackground('#ffffff');
  used.setFontWeight('normal');
  used.setHorizontalAlignment('left');
  used.setFontColor('#000000');

  styleBoardHeaders_(main, 'main');
}

function buildEmployeesBoard_() {
  const empSheet = getSheet_(CONFIG.SHEETS.EMPLOYEES);
  resetBoardArea_(empSheet, 2);

  const rows = getActiveRequests_();
  const idToLabel = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});

  // Group by EMPLOYEE NAME (display name), but internally tracked by email
  const byName = {};
  rows.forEach(r => {
    const name = String(r[COLS.REQUESTS.EMP_NAME - 1] || '').trim();
    if (!name) return;
    (byName[name] = byName[name] || []).push(r);
  });

  const names = Object.keys(byName).sort((a,b) => a.localeCompare(b));

  let out = [];
  names.forEach(name => {
    const list = (byName[name] || []).slice().sort(
      (r1, r2) => new Date(r1[COLS.REQUESTS.REQ_TS - 1]) - new Date(r2[COLS.REQUESTS.REQ_TS - 1])
    );

    const usedSlots = list.length;
    out.push([`${name} (${usedSlots}/${CONFIG.MAX_ACTIVE})`, '']);

    list.forEach(r => {
      const pid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
      out.push([idToLabel[pid] || String(r[COLS.REQUESTS.LABEL_AT_REQ - 1]) || pid, r[COLS.REQUESTS.REQ_TS - 1]]);
    });

    out.push(['', '']);
    out.push(['', '']);
  });

  if (out.length === 0) out = [['No ACTIVE requests yet', '']];

  empSheet.getRange(1, 1, out.length, 2).setValues(out);

  // Clear all rows below the new data to remove orphaned entries
  const maxRows = empSheet.getMaxRows();
  if (out.length + 1 <= maxRows) {
    empSheet.getRange(out.length + 1, 1, maxRows - out.length, 2).clearContent();
  }

  const used = empSheet.getRange(1, 1, out.length, 2);
  used.setBackground('#ffffff');
  used.setFontWeight('normal');
  used.setHorizontalAlignment('left');
  used.setFontColor('#000000');

  styleBoardHeaders_(empSheet, 'employees');
}

function styleBoardHeaders_(sheet, mode) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return;

  sheet.setColumnWidths(1, 2, 320);

  const rng = sheet.getRange(1, 1, lastRow, 2);
  const values = rng.getValues();

  for (let r = 1; r <= lastRow; r++) {
    const a = values[r - 1][0];
    const b = values[r - 1][1];

    // Header heuristic: col A has text and col B is blank
    if (a && !b) {
      sheet.getRange(r, 1, 1, 2).merge();
      const cell = sheet.getRange(r, 1);
      cell.setFontWeight('bold');
      cell.setHorizontalAlignment('center');
      cell.setFontColor('#000000');
      cell.setBackground(mode === 'main' ? '#f4cccc' : '#cfe2f3');
    }
  }
}
