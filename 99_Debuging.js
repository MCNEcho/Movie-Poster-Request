/**
 * ACTIVE DEBUGGING FUNCTIONS
 */

function debugFormAndLinks() {
  const form = getOrCreateForm_();
  Logger.log("FORM EDIT URL: " + form.getEditUrl());
  Logger.log("FORM LIVE URL: " + form.getPublishedUrl());
  Logger.log("SPREADSHEET URL: " + SpreadsheetApp.getActive().getUrl());
}

function resetAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const form = getOrCreateForm_();

  ScriptApp.newTrigger('handleFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger('handleSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  ScriptApp.newTrigger('processAnnouncementQueue')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("Triggers reset. FORM LIVE URL: " + form.getPublishedUrl());
}

/**
 * ============================================================================
 * ONE-TIME MIGRATION / CLEANUP FUNCTION (Archive - no longer maintained)
 * ============================================================================
 * This function was used to migrate legacy data.
 * It is NO LONGER CALLED automatically and is kept for reference only.
 * 
 * If you need to run legacy cleanup:
 *  1. Call: cleanupInvalidNamesAndOverCap_()
 *  2. Check logs for what was changed
 *  3. Review the "Requests" sheet afterward
 * ============================================================================
 */

function cleanupInvalidNamesAndOverCap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.REQUESTS);
  if (!sh) throw new Error('Missing Requests sheet');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    Logger.log('No ledger rows to clean.');
    return;
  }

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();
  const ts = now_();

  // Helper: normalize any weird whitespace (including NBSP)
  const cleanSpaces = (s) =>
    String(s || '')
      .replace(/\u00A0/g, ' ')     // NBSP -> space
      .replace(/\s+/g, ' ')        // collapse runs
      .trim();

  // Track ACTIVE rows by email and dedupe by email+poster
  const activeByEmail = {}; // email -> [{ idx, reqTs }]
  const firstSeenByEmailPoster = {}; // `${email}|${posterId}` -> { idx, reqTs }
  let changed = false;

  for (let i = 0; i < values.length; i++) {
    const r = values[i];

    const status = String(r[COLS.REQUESTS.STATUS - 1] || '');
    if (status !== STATUS.ACTIVE) continue;

    const email = cleanSpaces(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase();
    if (!email) {
      // Empty email => remove ACTIVE row
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
      continue;
    }

    const rawName = cleanSpaces(r[COLS.REQUESTS.EMP_NAME - 1]);
    const chk = normalizeEmployeeName_(rawName);

    if (!chk.ok) {
      // Invalid name format => remove ACTIVE row
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
      continue;
    }

    // Normalize stored name to canonical
    if (rawName !== chk.canonical) {
      r[COLS.REQUESTS.EMP_NAME - 1] = chk.canonical;
      changed = true;
    }

    const posterId = cleanSpaces(r[COLS.REQUESTS.POSTER_ID - 1]);

    const reqTsVal = r[COLS.REQUESTS.REQ_TS - 1];
    const reqTs = (reqTsVal instanceof Date) ? reqTsVal : new Date(reqTsVal || 0);

    // --- DEDUPE by (email + posterId) keep OLDEST ---
    const dedupeKey = `${email}|${posterId}`;
    const prior = firstSeenByEmailPoster[dedupeKey];

    if (!prior) {
      firstSeenByEmailPoster[dedupeKey] = { idx: i, reqTs };
    } else {
      // Keep the OLDEST request
      if (reqTs < prior.reqTs) {
        // Current is older => remove prior
        const priorRow = values[prior.idx];
        priorRow[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
        priorRow[COLS.REQUESTS.STATUS_TS - 1] = ts;
        changed = true;

        // Current becomes the keeper
        firstSeenByEmailPoster[dedupeKey] = { idx: i, reqTs };
      } else {
        // Prior is older => remove current
        r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
        r[COLS.REQUESTS.STATUS_TS - 1] = ts;
        changed = true;
        continue; // do not count it towards activeByEmail
      }
    }

    // Collect remaining ACTIVE rows per email for 5-cap enforcement
    (activeByEmail[email] = activeByEmail[email] || []).push({ idx: i, reqTs });
  }

  // --- Enforce MAX_ACTIVE per email: keep OLDEST 5 ACTIVE ---
  Object.keys(activeByEmail).forEach(email => {
    const arr = activeByEmail[email].sort((a, b) => a.reqTs - b.reqTs);
    if (arr.length <= CONFIG.MAX_ACTIVE) return;

    const overflow = arr.slice(CONFIG.MAX_ACTIVE);
    overflow.forEach(o => {
      const r = values[o.idx];
      r[COLS.REQUESTS.STATUS - 1] = STATUS.REMOVED;
      r[COLS.REQUESTS.STATUS_TS - 1] = ts;
      changed = true;
    });
  });

  if (changed) {
    range.setValues(values);
    Logger.log('Cleanup applied: invalid names removed + duplicates removed + over-cap trimmed.');
  } else {
    Logger.log('Cleanup found nothing to change.');
  }

  rebuildBoards();
  syncPostersToForm();
}
