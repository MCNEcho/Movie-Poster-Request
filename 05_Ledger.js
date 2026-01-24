/** 05_Ledger.gs **/

/**
 * Convert a value to timestamp in milliseconds.
 * @param {Date|string|number} value - Date value
 * @returns {number} Timestamp in milliseconds
 */
function getTimestamp_(value) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number') {
    return value;
  }
  return new Date(value).getTime();
}

function getRequestsSheet_() {
  return getSheet_(CONFIG.SHEETS.REQUESTS);
}

function ensurePosterIds_() {
  const mp = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);
  const lastRow = mp.getLastRow();
  if (lastRow < 2) return;

  const idsRange = mp.getRange(2, COLS.MOVIE_POSTERS.POSTER_ID, lastRow - 1, 1);
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
 * Check if an employee can request a poster, respecting re-request configuration.
 * 
 * @param {string} empEmail - Employee email
 * @param {string} posterId - Poster ID
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canRequestPoster_(empEmail, posterId) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 10);
  
  // Check if employee has any historical request for this poster
  const historicalRequests = data.filter(r =>
    String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === String(empEmail).toLowerCase().trim() &&
    String(r[COLS.REQUESTS.POSTER_ID - 1]) === String(posterId)
  );
  
  if (historicalRequests.length === 0) {
    // No historical request - allowed
    return { allowed: true, reason: '' };
  }
  
  // Check if there's currently an ACTIVE request
  const hasActiveRequest = historicalRequests.some(r =>
    String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE
  );
  
  if (hasActiveRequest) {
    // Already has active request for this poster
    return { allowed: false, reason: 'duplicate (active)' };
  }
  
  // Has historical request but not currently active - check re-request config
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    // Re-request not allowed after removal
    return { allowed: false, reason: 'duplicate (historical)' };
  }
  
  // Re-request is allowed, but check cooldown period
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    // Find the most recent removal timestamp
    const sortedRequests = historicalRequests
      .filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.REMOVED)
      .map(r => ({
        statusTs: r[COLS.REQUESTS.STATUS_TS - 1]
      }))
      .sort((a, b) => {
        const aTime = getTimestamp_(a.statusTs);
        const bTime = getTimestamp_(b.statusTs);
        return bTime - aTime; // Most recent first
      });
    
    if (sortedRequests.length > 0) {
      const mostRecentRemoval = sortedRequests[0].statusTs;
      const removalTime = getTimestamp_(mostRecentRemoval);
      const now = Date.now();
      const daysSinceRemoval = (now - removalTime) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRemoval < CONFIG.REREQUEST_COOLDOWN_DAYS) {
        const daysRemaining = Math.ceil(CONFIG.REREQUEST_COOLDOWN_DAYS - daysSinceRemoval);
        return { 
          allowed: false, 
          reason: `cooldown (wait ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''})` 
        };
      }
    }
  }
  
  // All checks passed - allowed to re-request
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
  const mp = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);
  const data = getNonEmptyData_(mp, 8);
  const map = {};
  data.forEach(r => {
    const active = r[COLS.MOVIE_POSTERS.ACTIVE - 1] === true;
    const pid = String(r[COLS.MOVIE_POSTERS.POSTER_ID - 1] || '').trim();
    const title = String(r[COLS.MOVIE_POSTERS.TITLE - 1] || '').trim();
    const release = r[COLS.MOVIE_POSTERS.RELEASE - 1];
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



