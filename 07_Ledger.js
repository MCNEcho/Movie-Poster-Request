/** 07_Ledger.js **/

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
 * Check if an employee can request a specific poster based on dedup rules.
 * Respects CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL and CONFIG.REREQUEST_COOLDOWN_DAYS.
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
  
  // If re-requests after removal are not allowed, deny
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return { allowed: false, reason: 'duplicate (historical)' };
  }
  
  // Re-requests are allowed - check cooldown period
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    // Find the most recent removal timestamp
    const removedRequests = requests.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.REMOVED);
    
    if (removedRequests.length > 0) {
      // Get the most recent removal timestamp
      let mostRecentRemoval = null;
      removedRequests.forEach(r => {
        const statusTs = r[COLS.REQUESTS.STATUS_TS - 1];
        if (statusTs && (!mostRecentRemoval || statusTs > mostRecentRemoval)) {
          mostRecentRemoval = statusTs;
        }
      });
      
      if (mostRecentRemoval) {
        const now = now_();
        const daysSinceRemoval = (now - mostRecentRemoval) / (1000 * 60 * 60 * 24);
        
        if (daysSinceRemoval < CONFIG.REREQUEST_COOLDOWN_DAYS) {
          const daysRemaining = Math.ceil(CONFIG.REREQUEST_COOLDOWN_DAYS - daysSinceRemoval);
          return { 
            allowed: false, 
            reason: `cooldown (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining)` 
          };
        }
      }
    }
  }
  
  // All checks passed - re-request is allowed
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



