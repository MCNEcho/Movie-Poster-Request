/** DEBUG.JS - SAFE TEST AND DIAGNOSTIC HELPERS **/

function resetAllTriggers() {
  ensureTriggers_();
  Logger.log('Triggers reconciled by the configured master account.');
}

function testLedgerAndFormHelpersInMemory_() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`Regression test failed: ${message}`);
  };
  const rows = [
    ['', 'xander@example.com', 'Xander A', 'poster-1', '', '', '', '', STATUS.REMOVED],
    ['', 'xander@example.com', 'Xander A', 'poster-1', '', '', '', '', STATUS.ACTIVE],
  ];
  assert(findActiveRequestIndex_(rows, 'Xander@example.com', 'poster-1') === 1, 'removed history must not hide the active request');
  assert(canRequestPoster_('xander@example.com', 'poster-1', [rows[0]]).allowed, 'inactive history must permit configured re-requests');

  const paired = pairPosterSlotsWithNotes_({ 2: 'Second Movie', 5: 'Fifth Movie' }, { slot_2: 'second note', slot_5: 'fifth note' });
  assert(paired.length === 2 && paired[0].slot === 2 && paired[0].note === 'second note' && paired[1].slot === 5 && paired[1].note === 'fifth note', 'sparse slots must retain paired notes');
  assert(mapFirstNotesByLabel_([{ slot: 1, label: 'Same', note: '' }, { slot: 4, label: 'Same', note: 'later' }])['Same'] === '', 'duplicate labels must retain first note');

  const fullSlots = Array.from({ length: CONFIG.MAX_ACTIVE }, (_, i) => [new Date(i), 'slots@example.com', 'Slots T', `poster-${i}`, '', '', '', '', STATUS.ACTIVE]);
  assert(countActiveSlotsByEmail_('slots@example.com', fullSlots) === CONFIG.MAX_ACTIVE && !isWithinSlotLimit_(CONFIG.MAX_ACTIVE) && isWithinSlotLimit_(CONFIG.MAX_ACTIVE - 1), 'slot limit must enforce configured cap');
  const choices = normalizeFormChoices_([' Movie  One ', 'movie one', 'Movie Two']);
  assert(choices.length === 2 && choices[0] === 'Movie One', 'Form choices must normalize whitespace and duplicates');
  const hash = computeFormChoicesHash_(['A', 'B'], ['A'], 10);
  assert(hash === computeFormChoicesHash_(['A', 'B'], ['A'], 10) && hash !== computeFormChoicesHash_(['B', 'A'], ['A'], 10) && hash !== computeFormChoicesHash_(['A', 'B'], ['A'], 9), 'Form hash must reflect ordered choices and slot count');
  assert(areFormChoiceValuesEqual_(['', 'A'], ['', 'A']) && !areFormChoiceValuesEqual_(['', 'A'], ['', 'B']), 'Form choices must compare by ordered value');

  let startRow = 0;
  const fakeSheet = { getLastRow: () => 4, getLastColumn: () => 2, getRange: row => { startRow = row; return { getValues: () => [['Poster A', 'P-1'], ['Poster B', 'P-2']] }; } };
  assert(getNonEmptyData_(fakeSheet, 2, 3).length === 2 && startRow === 3, 'Inventory reads must begin at row 3');
  assert(remapDisplaySelection_('Old Title', { 'old title': 'P-1' }, { 'P-1': 'New Title' }, { 'new title': 'P-1' }, '') === 'New Title', 'display labels must follow stable poster IDs');
  const deleted = findDeletedRequestIds_({ requestA: {}, requestB: {}, requestC: {} }, { requestA: {}, requestC: {}, requestD: {} });
  assert(deleted.length === 1 && deleted[0] === 'requestB', 'deletion scans must identify stable request ID');

  let id = 0;
  const queued = createManualPosterRefreshQueueEntries_({ boards: true, form: true, no: false }, () => `q${++id}`);
  assert(queued.length === 2 && queued[0].task === 'boards' && queued[1].task === 'form', 'queue must include selected tasks only');
  const entries = [{ key: 'a', value: JSON.stringify({ task: 'boards' }) }, { key: 'b', value: JSON.stringify({ task: 'form' }) }, { key: 'c', value: JSON.stringify({ task: 'boards' }) }];
  const coalesced = collectManualPosterRefreshTasks_(entries);
  assert(coalesced.boards && coalesced.form && Object.keys(coalesced).length === 2, 'duplicate queue tasks must coalesce');
  assert(manualPosterRefreshEntryTask_(entries[0]) === 'boards' && manualPosterRefreshEntryTask_({ value: 'bad json' }) === '', 'queue task parsing must safely handle malformed data');
  assert(isKnownManualPosterRefreshTask_('boards') && !isKnownManualPosterRefreshTask_('unknown'), 'unknown tasks must be rejected');
  assert(planOneOffTriggerActions_(3, true).deleteCount === 2 && planOneOffTriggerActions_(2, false).deleteCount === 2 && planOneOffTriggerActions_(0, true).create, 'one-off trigger actions must reconcile correctly');

  const failed = { task: 'form', value: JSON.stringify({ task: 'form', attempts: 0, nonce: 'old' }) };
  assert(!canUpdateRefreshTaskEntry_(failed, JSON.stringify({ task: 'form', nonce: 'new' })), 'failure update must not overwrite newer nonce');
  const failure = refreshFailureUpdate_(failed, 'test', 1000, () => 'new');
  assert(failure.attempts === 1 && failure.nextAttemptAt === 61000 && failure.lastError === 'test', 'failure must store retry metadata');
  assert([1, 2, 3, 4, 5].map(refreshBackoffMinutes_).join(',') === '1,5,15,60,60' && !refreshAttemptIsStuck_(4) && refreshAttemptIsStuck_(5), 'refresh retry backoff and attempt cap must be bounded');
  assert(!shouldStopRefreshWorker_(1000, 270999) && shouldStopRefreshWorker_(1000, 271000), 'worker must stop at 270 seconds');
  let lockWait = null;
  assert(!tryAcquireWithoutWaiting_({ tryLock: ms => { lockWait = ms; return false; } }) && lockWait === 0, 'worker lock must not wait');

  const employeeHeader = buildEmployeeGroupHeader_({ name: 'Alex R', contactType: 'EMPLOYEE', contact: 'alex@example.com' }, true, 2);
  const customerHeader = buildEmployeeGroupHeader_({ name: 'Customer', contactType: 'CUSTOMER', contact: '555-0100' }, false, 1);
  assert(employeeHeader.includes('Alex R') && employeeHeader.includes('2/') && !employeeHeader.includes('alex@example.com'), 'employee board must not expose email');
  assert(customerHeader.includes('Customer') && !customerHeader.includes('555-0100'), 'customer board must not expose phone');

  const day = '2026-10-14';
  const nextDay = '2026-10-15';
  let state = backupRetryStateForFailure_(null, day, 1000, 'initial failure');
  assert(backupRetryAllowed_(state, day) && backupRetryBackoffMinutes_(1) === 5, 'first backup retry must use five minutes');
  state = backupRetryStateForFailure_(state, day, 2000, 'retry one failed');
  assert(backupRetryAllowed_(state, day) && backupRetryBackoffMinutes_(2) === 15, 'second backup retry must use 15 minutes');
  state = backupRetryStateForFailure_(state, day, 3000, 'retry two failed');
  assert(backupRetryAllowed_(state, day) && backupRetryBackoffMinutes_(3) === 60, 'third backup retry must use 60 minutes');
  state = backupRetryStateForFailure_(state, day, 4000, 'retry three failed');
  assert(state.stuck && !backupRetryAllowed_(state, day), 'backup retries must stop after three');
  const next = backupRetryStateForFailure_(state, nextDay, 5000, 'next day');
  assert(next.day === nextDay && next.retries === 0 && backupRetryAllowed_(next, nextDay), 'backup retry state must reset next day');
  return true;
}

function runRegressionTests() {
  try {
    testLedgerAndFormHelpersInMemory_();
    return { pass: true, message: 'In-memory regression tests passed.' };
  } catch (err) {
    return { pass: false, message: err && err.message ? err.message : String(err) };
  }
}

function agentReadErrorLogTail(count) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ERROR_LOG);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(0, Math.min(Math.floor(Number(count) || 0), lastRow - 1));
  if (!rowCount) return [];
  return sheet.getRange(lastRow - rowCount + 1, 1, rowCount, Math.max(1, sheet.getLastColumn())).getValues();
}

function agentSnapshotRequests() {
  const sheet = getRequestsSheet_();
  const rowCount = sheet.getLastRow();
  const values = rowCount ? sheet.getRange(1, 1, rowCount, Math.max(sheet.getLastColumn(), COLS.REQUESTS.REQUEST_ID)).getValues() : [];
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values), Utilities.Charset.UTF_8);
  return { rowCount, hash: Utilities.base64Encode(digest) };
}

function agentRunIntegrityCheckReportOnly() {
  return runFullIntegrityCheck_();
}

function agentRunManualBackup() {
  if (!CONFIG.BACKUP.ENABLED) {
    return { success: false, files: [], errors: [], deletedCount: 0, message: 'Backups are disabled in configuration.' };
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    return { success: false, files: [], errors: [], deletedCount: 0, message: 'The system is busy. Please try the manual backup again in a minute.' };
  }
  try {
    return runBackupWork_();
  } finally {
    lock.releaseLock();
  }
}

function agentReadLastNightlyBackupDate() {
  return getProps_().getProperty(CONFIG.PROPS.LAST_NIGHTLY_BACKUP_DATE) || '';
}
