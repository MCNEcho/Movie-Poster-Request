/**
 * DEBUG.JS - DEBUGGING UTILITIES
 * ACTIVE DEBUGGING FUNCTIONS

function debugFormAndLinks() {
  const form = getOrCreateForm_();
  Logger.log("FORM EDIT URL: " + form.getEditUrl());
  Logger.log("FORM LIVE URL: " + form.getPublishedUrl());
  Logger.log("SPREADSHEET URL: " + SpreadsheetApp.getActive().getUrl());
}

function resetAllTriggers() {
  ensureTriggers_();
  Logger.log('Triggers reconciled by the configured master account.');
}

/**
 * Test function for dedup configuration feature
 * Tests various scenarios with different CONFIG settings
 */
function testDedupConfig() {
  Logger.log('=== Testing Dedup Configuration ===');
  Logger.log(`Current settings: ALLOW_REREQUEST_AFTER_REMOVAL=${CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL}, COOLDOWN_DAYS=${CONFIG.REREQUEST_COOLDOWN_DAYS}`);
  
  // Test scenarios:
  // 1. No previous request - should always allow
  const test1 = canRequestPoster_('newuser@test.com', 'test-poster-id-1');
  Logger.log(`Test 1 (no previous request): ${test1.allowed ? 'PASS' : 'FAIL'} - ${test1.reason || 'allowed'}`);
  
  // 2. When ALLOW_REREQUEST_AFTER_REMOVAL=false (default), historical requests should be blocked
  Logger.log('\nTest 2: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=false (strict mode)');
  Logger.log('  - Scenario: User previously requested and removed a poster');
  Logger.log('  - Expected: Should be blocked with "duplicate (historical)"');
  Logger.log('  - To test fully, would need actual data in Requests sheet');
  
  // 3. When ALLOW_REREQUEST_AFTER_REMOVAL=true and COOLDOWN_DAYS=0
  Logger.log('\nTest 3: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=true, COOLDOWN_DAYS=0');
  Logger.log('  - Scenario: User previously requested and removed a poster');
  Logger.log('  - Expected: Should be allowed immediately');
  
  // 4. When ALLOW_REREQUEST_AFTER_REMOVAL=true and COOLDOWN_DAYS>0
  Logger.log('\nTest 4: Testing with ALLOW_REREQUEST_AFTER_REMOVAL=true, COOLDOWN_DAYS=7');
  Logger.log('  - Scenario: User removed poster 3 days ago');
  Logger.log('  - Expected: Should be blocked with "cooldown (4 days remaining)"');
  
  Logger.log('\n=== Dedup Config Test Complete ===');
  Logger.log('Review logs above to verify behavior matches expectations');
  Logger.log('To test with real data, add test requests in Requests sheet');
}

function testLedgerAndFormHelpersInMemory_() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`Regression test failed: ${message}`);
  };

  const removedThenActiveRows = [
    ['', 'xander@example.com', 'Xander A', 'poster-1', '', '', '', '', STATUS.REMOVED],
    ['', 'xander@example.com', 'Xander A', 'poster-1', '', '', '', '', STATUS.ACTIVE],
  ];
  assert(findActiveRequestIndex_(removedThenActiveRows, 'Xander@example.com', 'poster-1') === 1,
    'removal matching must skip old REMOVED rows and find the ACTIVE request');

  const reRequestRows = [
    ['', 'xander@example.com', 'Xander A', 'poster-1', '', '', '', '', STATUS.REMOVED],
  ];
  assert(canRequestPoster_('xander@example.com', 'poster-1', reRequestRows).allowed,
    'an inactive historical request must not block a configured re-request');

  const paired = pairPosterSlotsWithNotes_(
    { 2: 'Second Movie', 5: 'Fifth Movie' },
    { slot_2: 'note for second', slot_5: 'note for fifth' }
  );
  assert(paired.length === 2 && paired[0].slot === 2 && paired[0].note === 'note for second',
    'sparse poster selections must retain their actual form slot when notes are paired');
  assert(paired[1].slot === 5 && paired[1].note === 'note for fifth',
    'later sparse slots must pair with their matching notes');
  const firstNotes = mapFirstNotesByLabel_([
    { slot: 1, label: 'Same Movie', note: '' },
    { slot: 4, label: 'Same Movie', note: 'later duplicate note' },
  ]);
  assert(firstNotes['Same Movie'] === '', 'duplicate selections must keep the first slot note, even when blank');

  const fullSlots = Array.from({ length: CONFIG.MAX_ACTIVE }, (_, index) => [
    new Date(index), 'slots@example.com', 'Slots T', `poster-${index}`, '', '', '', '', STATUS.ACTIVE,
  ]);
  assert(countActiveSlotsByEmail_('slots@example.com', fullSlots) === CONFIG.MAX_ACTIVE,
    'slot counting must read the in-memory ledger accurately at the configured maximum');
  assert(!isWithinSlotLimit_(countActiveSlotsByEmail_('slots@example.com', fullSlots)),
    'the configured maximum must reject an additional request');
  assert(isWithinSlotLimit_(countActiveSlotsByEmail_('slots@example.com', fullSlots.slice(1))),
    'one freed slot must allow one more request');
  const formChoices = normalizeFormChoices_([' Movie  One ', 'movie one', 'Movie Two']);
  assert(formChoices.length === 2 && formChoices[0] === 'Movie One', 'form choices must dedupe ignoring case and repeated whitespace');

  let requestedStartRow = 0;
  const fakeSheet = {
    getLastRow: () => 4,
    getLastColumn: () => 2,
    getRange: (row, column, rowCount, colCount) => {
      requestedStartRow = row;
      return { getValues: () => [['Poster A', 'P-1'], ['Poster B', 'P-2']] };
    },
  };
  const inventoryRows = getNonEmptyData_(fakeSheet, 2, 3);
  assert(requestedStartRow === 3 && inventoryRows.length === 2,
    'inventory data reads must begin at row 3 instead of including the header');
  assert(remapDisplaySelection_('Old Movie Title', { 'old movie title': 'P-1' },
    { 'P-1': 'New Movie Title' }, { 'new movie title': 'P-1' }, '') === 'New Movie Title',
    'display selections must follow stable poster IDs after title changes');

  Logger.log('PASS: in-memory ledger and form regression tests');
  return true;
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
    } else if (reqTs < prior.reqTs) {
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

  queueManualPosterRefresh_(false);
}
