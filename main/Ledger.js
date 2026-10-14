/** Ledger.js **/

function getRequestsSheet_() {
  return getSheet_(CONFIG.SHEETS.REQUESTS);
}

function readRequestRows_() {
  const sheet = getRequestsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), COLS.REQUESTS.NOTES)).getValues();
}

/**
 * Ensure all rows in Inventory have unique Poster IDs.
 * This is the canonical source of truth for poster management.
 */
function ensurePosterIdsInInventory_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  if (lastRow < 3) return;

  const idsRange = inv.getRange(3, COLS.INVENTORY.POSTER_ID, lastRow - 2, 1);
  const ids = idsRange.getValues();

  let changed = false;
  for (let i = 0; i < ids.length; i++) {
    const v = String(ids[i][0] || '').trim();
    if (!v) { ids[i][0] = uuidPosterId_(); changed = true; }
  }
  if (changed) idsRange.setValues(ids);
}

function hasEverRequestedByEmail_(empEmail, posterId) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
  return data.some(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.POSTER_ID - 1]) === String(posterId)
  );
}

/**
 * Check if an employee can request a specific poster based on dedup rules.
 * Simplified logic: Only blocks if employee has ACTIVE request for this poster.
 * Historical requests are ignored (allows immediate re-requests).
 * 
 * @param {string} empEmail - Employee email
 * @param {string} posterId - Poster ID
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canRequestPoster_(empEmail, posterId, requestRows) {
  const data = requestRows || getNonEmptyData_(getRequestsSheet_(), COLS.REQUESTS.STATUS);

  // Find all requests for this email/poster combination
  const requests = data.filter(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.POSTER_ID - 1]) === String(posterId)
  );

  // No previous requests - allowed
  if (requests.length === 0) {
    return { allowed: true, reason: '' };
  }

  // Check if any request is currently ACTIVE
  const hasActive = requests.some(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
  if (hasActive) {
    return { allowed: false, reason: 'duplicate (already active)' };
  }

  // If rerequests are disabled entirely, block on any historical request
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return { allowed: false, reason: 'duplicate (historical)' };
  }

  // Cooldown enforcement (if configured)
  const cooldownDays = Number(CONFIG.REREQUEST_COOLDOWN_DAYS || 0);
  if (cooldownDays > 0) {
    const mostRecentTs = requests
      .map(r => r[COLS.REQUESTS.STATUS_TS - 1])
      .filter(Boolean)
      .map(ts => (ts instanceof Date ? ts.getTime() : new Date(ts).getTime()))
      .filter(ts => !isNaN(ts))
      .sort((a, b) => b - a)[0];

    if (mostRecentTs) {
      const ageMs = now_().getTime() - mostRecentTs;
      const requiredMs = cooldownDays * 24 * 60 * 60 * 1000;
      if (ageMs < requiredMs) {
        return { allowed: false, reason: 'duplicate (cooldown)' };
      }
    }
  }

  return { allowed: true, reason: '' };
}

function countActiveSlotsByEmail_(empEmail, requestRows) {
  const data = requestRows || getNonEmptyData_(getRequestsSheet_(), COLS.REQUESTS.STATUS);
  return data.filter(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE
  ).length;
}

function getPosterIdsWithAnyActiveRequests_() {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
  const out = {};
  data.forEach(r => {
    if (String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE) {
      out[String(r[COLS.REQUESTS.POSTER_ID - 1])] = true;
    }
  });
  return out;
}

function setRequestStatusByEmail_(empEmail, posterId, newStatus, ts, requestRows) {
  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  const rows = requestRows || sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const email = String(empEmail).toLowerCase().trim();

  const rowIndex = findActiveRequestIndex_(rows, email, posterId);
  if (rowIndex < 0) return false;

  sh.getRange(rowIndex + 2, COLS.REQUESTS.STATUS, 1, 2).setValues([[newStatus, ts]]);
  rows[rowIndex][COLS.REQUESTS.STATUS - 1] = newStatus;
  rows[rowIndex][COLS.REQUESTS.STATUS_TS - 1] = ts;
  return true;
}

function findActiveRequestIndex_(rows, empEmail, posterId) {
  const email = String(empEmail || '').toLowerCase().trim();
  const id = String(posterId || '').trim();
  return rows.findIndex(row =>
    String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase().trim() === email &&
    String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim() === id &&
    String(row[COLS.REQUESTS.STATUS - 1] || '').trim() === STATUS.ACTIVE
  );
}

function isWithinSlotLimit_(activeCount, maxActive = CONFIG.MAX_ACTIVE) {
  return Number(activeCount) < Number(maxActive);
}

function getActivePosterIdMap_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  const map = {};
  data.forEach(r => {
    const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
    const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
    const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
    const release = r[COLS.INVENTORY.RELEASE - 1];
    if (active && pid && title && release) map[pid] = true;
  });
  return map;
}

function lookupPosterInfoById_(posterId) {
  const posters = getPostersWithLabels_();
  const found = posters.find(p => p.posterId === posterId);
  if (!found) return null;

  return { title: found.title, release: found.release, label: found.label };
}

function createLedgerRow_(empEmail, empName, posterId, requestTs, note = '', requestRows) {
  const sh = getRequestsSheet_();
  const mpInfo = lookupPosterInfoById_(posterId);
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const label = idToCurrent[posterId] || (mpInfo ? mpInfo.label : posterId);

  const row = [];
  row[COLS.REQUESTS.REQ_TS - 1] = requestTs;
  row[COLS.REQUESTS.EMP_EMAIL - 1] = empEmail.toLowerCase().trim();
  row[COLS.REQUESTS.EMP_NAME - 1] = empName;
  row[COLS.REQUESTS.POSTER_ID - 1] = posterId;
  row[COLS.REQUESTS.LABEL_AT_REQ - 1] = label;
  row[COLS.REQUESTS.TITLE_SNAP - 1] = mpInfo ? mpInfo.title : '';
  row[COLS.REQUESTS.RELEASE_SNAP - 1] = mpInfo ? mpInfo.release : '';
  row[COLS.REQUESTS.ACTION_TYPE - 1] = 'ADD';
  row[COLS.REQUESTS.STATUS - 1] = STATUS.ACTIVE;
  row[COLS.REQUESTS.STATUS_TS - 1] = requestTs;
  row[COLS.REQUESTS.CONTACT_TYPE - 1] = 'EMPLOYEE';
  row[COLS.REQUESTS.NOTES - 1] = String(note || '').trim();

  sh.appendRow(row);
  if (requestRows) requestRows.push(row);
}

/**
 * Close ACTIVE requests for the given poster IDs.
 * Returns { closedCount, empCounts } where empCounts is a map of email -> closed count.
 */
function closeActiveRequestsByPosterIds_(posterIds, newStatus, statusTs) {
  const ids = (posterIds || []).map(id => String(id || '').trim()).filter(Boolean);
  if (ids.length === 0) return { closedCount: 0, empCounts: {} };

  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { closedCount: 0, empCounts: {} };

  const idMap = {};
  ids.forEach(id => { idMap[id] = true; });

  const range = sh.getRange(2, 1, lastRow - 1, Math.max(sh.getLastColumn(), COLS.REQUESTS.NOTES));
  const values = range.getValues();
  const rowsToClose = [];
  let closedCount = 0;
  const empCounts = {};

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
    const status = String(r[COLS.REQUESTS.STATUS - 1] || '').trim();

    if (idMap[pid] && status === STATUS.ACTIVE) {
      rowsToClose.push(i + 2);
      closedCount++;

      const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase().trim();
      if (email) empCounts[email] = (empCounts[email] || 0) + 1;
    }
  }

  rowsToClose.forEach(rowNum => {
    sh.getRange(rowNum, COLS.REQUESTS.STATUS, 1, 2).setValues([[newStatus, statusTs]]);
  });
  return { closedCount, empCounts };
}



