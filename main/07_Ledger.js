/** 07_Ledger.js **/

function getRequestsSheet_() {
  return getSheet_(CONFIG.SHEETS.REQUESTS);
}

/**
 * Ensure all rows in Inventory have unique Poster IDs.
 * This is the canonical source of truth for poster management.
 */
function ensurePosterIdsInInventory_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  if (lastRow < 2) return;

  const idsRange = inv.getRange(2, COLS.INVENTORY.POSTER_ID, lastRow - 1, 1);
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
function canRequestPoster_(empEmail, posterId) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);

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

function countActiveSlotsByEmail_(empEmail) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 9);
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

function setRequestStatusByEmail_(empEmail, posterId, newStatus, ts) {
  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const rEmail = String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim();
    const rPid = String(r[COLS.REQUESTS.POSTER_ID - 1]);
    const rStatus = String(r[COLS.REQUESTS.STATUS - 1]);

    if (rEmail === String(empEmail).toLowerCase().trim() && rPid === String(posterId)) {
      if (newStatus === STATUS.REMOVED && rStatus !== STATUS.ACTIVE) return false;

      r[COLS.REQUESTS.STATUS - 1] = newStatus;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;

      range.setValues(values);
      return true;
    }
  }
  return false;
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

function createLedgerRow_(empEmail, empName, posterId, requestTs) {
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

  sh.appendRow(row);
}



