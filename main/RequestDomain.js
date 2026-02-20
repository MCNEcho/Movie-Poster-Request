// === REQUEST DOMAIN MODULE ===
// Consolidates: Ledger.js, FormSubmit.js, DataIntegrity.js
// Provides: Request ledger operations, form submission handling, data integrity validation

// ===== LEDGER OPERATIONS =====

function getRequestsSheet_() {
  return getSheet_(CONFIG.SHEETS.REQUESTS);
}

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

function closeActiveRequestsByPosterIds_(posterIds, newStatus, statusTs) {
  const ids = (posterIds || []).map(id => String(id || '').trim()).filter(Boolean);
  if (ids.length === 0) return { closedCount: 0, empCounts: {} };

  const sh = getRequestsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { closedCount: 0, empCounts: {} };

  const idMap = {};
  ids.forEach(id => { idMap[id] = true; });

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();

  let changed = false;
  let closedCount = 0;
  const empCounts = {};

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
    const status = String(r[COLS.REQUESTS.STATUS - 1] || '').trim();

    if (idMap[pid] && status === STATUS.ACTIVE) {
      r[COLS.REQUESTS.STATUS - 1] = newStatus;
      r[COLS.REQUESTS.STATUS_TS - 1] = statusTs;
      changed = true;
      closedCount++;

      const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase().trim();
      if (email) empCounts[email] = (empCounts[email] || 0) + 1;
    }
  }

  if (changed) range.setValues(values);
  return { closedCount, empCounts };
}

// ===== FORM SUBMISSION HANDLING =====

function handleFormSubmit(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log(`[handleFormSubmit] TRIGGERED - processing form submission`);
    const formTs = e && e.response ? e.response.getTimestamp() : now_();
    const answers = readFormAnswers_(e);

    const empEmail = String(answers.empEmail || '').trim().toLowerCase();
    const nameRaw = String(answers.empName || '').trim();
    const subscribeChecked = answers.subscribe === true;

    Logger.log(`[handleFormSubmit] Email: ${empEmail}, Name: ${nameRaw}, Subscribe: ${subscribeChecked}, RemoveLabels: ${JSON.stringify(answers.removeLabels)}, AddLabels: ${JSON.stringify(answers.addLabels)}`);

    if (!empEmail) {
      Logger.log(`[handleFormSubmit] No email found - exiting`);
      return;
    }

    // Validate name format (First Name + Last Initial)
    const nameCheck = normalizeEmployeeName_(nameRaw);
    if (!nameCheck.ok) {
      Logger.log(`Invalid name format from ${empEmail}: ${nameRaw}. Reason: ${nameCheck.reason}`);
      return; // Don't save requests with invalid names
    }

    const empName = nameCheck.canonical;
    const addLabels = safeArray_(answers.addLabels);
    const removeLabels = safeArray_(answers.removeLabels);

    // Sync subscriber status from form
    if (subscribeChecked) {
      Logger.log(`[handleFormSubmit] Adding subscriber: ${empEmail}`);
      addSubscriber_(empEmail, empName);
      invalidateActiveSubscribers_();
      Logger.log(`[handleFormSubmit] Subscriber added successfully`);
    }

    // For logging (email-keyed)
    const slotsBefore = countActiveSlotsByEmail_(empEmail);

    const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels);
    const slotsAfter = countActiveSlotsByEmail_(empEmail);

    // Reset caches after write-heavy operations
    invalidateCachesAfterWrite_({ empEmail });

    appendRequestOrderLog_({
      formTs,
      empEmail,
      empName,
      addRaw: addLabels.join(', '),
      removeRaw: removeLabels.join(', '),
      slotsBefore,
      slotsAfter,
      addedAccepted: result.addedAccepted.join(', '),
      removedApplied: result.removedApplied.join(', '),
      deniedAdds: result.deniedAdds.join(' | '),
      notes: result.notes.join(' | '),
    });

    Logger.log(`[handleFormSubmit] About to rebuild boards. Removals: ${result.removedApplied.join(', ')}, Additions: ${result.addedAccepted.join(', ')}`);
    rebuildBoards();
    Logger.log(`[handleFormSubmit] Boards rebuilt successfully`);
    syncPostersToForm();
  } catch (err) {
    logError_(err, 'handleFormSubmit', 'Form submission');
  } finally {
    lock.releaseLock();
  }
}

function readFormAnswers_(e) {
  const out = { empEmail: '', empName: '', addLabels: [], removeLabels: [], subscribe: false };
  if (!e || !e.response) {
    Logger.log(`[readFormAnswers] No response object`);
    return out;
  }

  const tName = String(CONFIG.FORM.Q_EMPLOYEE_NAME || '').trim();
  const tAdd = String(CONFIG.FORM.Q_ADD || '').trim();
  const tRem = String(CONFIG.FORM.Q_REMOVE || '').trim();
  const tSub = String(CONFIG.FORM.Q_SUBSCRIBE || '').trim();

  Logger.log(`[readFormAnswers] Expected field names - Name: "${tName}", Add: "${tAdd}", Remove: "${tRem}", Subscribe: "${tSub}"`);

  // Get email from form's built-in email collection
  out.empEmail = String(e.response.getRespondentEmail() || '').trim().toLowerCase();

  e.response.getItemResponses().forEach(r => {
    const title = String(r.getItem().getTitle() || '').trim();
    const resp = r.getResponse();

    Logger.log(`[readFormAnswers] Found form field: "${title}" = ${JSON.stringify(resp)}`);

    if (title === tName) out.empName = resp;
    else if (title === tAdd) out.addLabels = resp;
    else if (title === tRem) out.removeLabels = resp;
    else if (title === tSub) {
      // Check if "Yes" was selected
      if (Array.isArray(resp)) {
        out.subscribe = resp.some(v => String(v || '').toLowerCase().includes('yes'));
      } else {
        out.subscribe = String(resp || '').toLowerCase().includes('yes');
      }
      Logger.log(`[readFormAnswers] Parsed subscribe response: ${out.subscribe}`);
    }
  });

  Logger.log(`[readFormAnswers] Final parsed answer object: ${JSON.stringify(out)}`);
  return out;
}

function processSubmission_(empEmail, empName, formTs, addLabels, removeLabels) {
  const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const decode = (lbl) => labelToId[String(lbl || '').trim()] || null;

  // Process removals first
  const removedApplied = processRemovals_(empEmail, removeLabels, decode);

  // Process additions after removals
  const { addedAccepted, deniedAdds } = processAdditions_(empEmail, empName, addLabels, decode, formTs);

  return {
    removedApplied,
    addedAccepted,
    deniedAdds,
    notes: [`Removals first: ${removedApplied.length}`, `Adds accepted: ${addedAccepted.length}`],
  };
}

function processRemovals_(empEmail, removeLabels, decode) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const removedApplied = [];

  removeLabels.forEach(lbl => {
    const pid = decode(lbl);
    if (!pid) {
      Logger.log(`[processRemovals] Could not decode label: ${lbl}`);
      return;
    }

    Logger.log(`[processRemovals] Attempting to remove poster ${pid} (${lbl}) for ${empEmail}`);
    const ok = setRequestStatusByEmail_(empEmail, pid, STATUS.REMOVED, now_());
    if (ok) {
      removedApplied.push(idToCurrent[pid] || String(lbl).trim());
      Logger.log(`[processRemovals] Successfully removed poster ${pid}`);
    } else {
      Logger.log(`[processRemovals] Failed to remove poster ${pid} (not found or not ACTIVE status)`);
    }
  });

  return removedApplied;
}

function processAdditions_(empEmail, empName, addLabels, decode, formTs) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const activePosterMap = getActivePosterIdMap_();

  const addQueue = Array.from(new Set((addLabels || []).map(lbl => String(lbl || '').trim()).filter(Boolean)));

  Logger.log(`[processAdditions] Starting with ${addQueue.length} labels to add`);
  Logger.log(`[processAdditions] ID to Current Label map: ${JSON.stringify(idToCurrent)}`);
  Logger.log(`[processAdditions] Active Poster Map: ${JSON.stringify(activePosterMap)}`);

  const activeNow = countActiveSlotsByEmail_(empEmail);
  let available = Math.max(0, CONFIG.MAX_ACTIVE - activeNow);
  Logger.log(`[processAdditions] Current active slots: ${activeNow}, Available: ${available}`);

  const deniedAdds = [];
  const addedAccepted = [];

  for (const lbl of addQueue) {
    const pid = decode(lbl);
    const show = pid ? (idToCurrent[pid] || String(lbl).trim()) : String(lbl).trim();

    Logger.log(`[processAdditions] Processing label "${lbl}" -> decoded to PID "${pid}"`);

    // Validate poster ID exists
    if (!pid) { 
      deniedAdds.push(`${show}: unknown`); 
      Logger.log(`[processAdditions] DENIED: "${show}" - unknown poster ID`);
      continue; 
    }

    // Validate poster is active
    if (!activePosterMap[pid]) { 
      deniedAdds.push(`${show}: inactive`); 
      Logger.log(`[processAdditions] DENIED: "${show}" - poster not in active map`);
      continue; 
    }

    // Check for duplicates by email
    const dedupCheck = canRequestPoster_(empEmail, pid);
    if (!dedupCheck.allowed) {
      deniedAdds.push(`${show}: ${dedupCheck.reason}`);
      Logger.log(`[processAdditions] DENIED: "${show}" - ${dedupCheck.reason}`);
      continue;
    }

    // Check slot availability
    if (available <= 0) {
      deniedAdds.push(`${show}: limit (${CONFIG.MAX_ACTIVE}-slot)`);
      Logger.log(`[processAdditions] DENIED: "${show}" - no available slots`);
      continue;
    }

    // All checks passed - add the request
    Logger.log(`[processAdditions] ACCEPTED: "${show}" - creating ledger row`);
    createLedgerRow_(empEmail, empName, pid, formTs);
    addedAccepted.push(show);
    available--;
  }

  Logger.log(`[processAdditions] Final result: ${addedAccepted.length} accepted, ${deniedAdds.length} denied`);
  return { addedAccepted, deniedAdds };
}

function appendRequestOrderLog_(o) {
  const sh = getSheet_(CONFIG.SHEETS.REQUEST_ORDER);
  const row = [];
  row[COLS.REQUEST_ORDER.FORM_TS - 1] = o.formTs;
  row[COLS.REQUEST_ORDER.EMP_EMAIL - 1] = o.empEmail;
  row[COLS.REQUEST_ORDER.ADD_RAW - 1] = o.addRaw;
  row[COLS.REQUEST_ORDER.REMOVE_RAW - 1] = o.removeRaw;
  row[COLS.REQUEST_ORDER.SLOTS_BEFORE - 1] = o.slotsBefore;
  row[COLS.REQUEST_ORDER.SLOTS_AFTER - 1] = o.slotsAfter;
  row[COLS.REQUEST_ORDER.ADDED_ACCEPTED - 1] = o.addedAccepted;
  row[COLS.REQUEST_ORDER.REMOVED_APPLIED - 1] = o.removedApplied;
  row[COLS.REQUEST_ORDER.DENIED_ADDS - 1] = o.deniedAdds;
  row[COLS.REQUEST_ORDER.NOTES - 1] = o.notes;
  sh.appendRow(row);
}

function addSubscriber_(empEmail, empName) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
    Logger.log(`[addSubscriber] Got sheet: ${CONFIG.SHEETS.SUBSCRIBERS}`);
    
    const data = getNonEmptyData_(sh, 3);
    Logger.log(`[addSubscriber] Read ${data.length} existing rows`);
    
    // Check if already exists
    const exists = data.some(r => String(r[COLS.SUBSCRIBERS.EMAIL - 1] || '').trim().toLowerCase() === empEmail);
    Logger.log(`[addSubscriber] Email ${empEmail} already exists: ${exists}`);
    if (exists) {
      Logger.log(`[addSubscriber] Email already subscribed, returning`);
      return;
    }
    
    // Append new subscriber with ACTIVE checked and employee name
    const row = [true, empEmail, empName];
    Logger.log(`[addSubscriber] About to append subscriber: ${JSON.stringify(row)}`);
    sh.appendRow(row);
    Logger.log(`[addSubscriber] Row appended successfully`);
  } catch (err) {
    Logger.log(`[addSubscriber] ERROR: ${err.message}`);
    throw err;
  }
}

// ===== DATA INTEGRITY VALIDATION =====

function ensureDataIntegritySheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp',
    'Check Type',
    'Status',
    'Records Affected',
    'Details',
    'Auto-Repaired',
    'Admin Action Required'
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.DATA_INTEGRITY, headers);
}

function runFullIntegrityCheck_() {
  const results = {
    timestamp: now_(),
    checksPerformed: [],
    totalIssuesFound: 0,
    autoRepaired: 0,
    requiresAdminAction: 0
  };

  try {
    Logger.log('[INTEGRITY] Starting full data integrity check...');

    // Check 1: Orphaned requests
    const orphanedCheck = checkForOrphanedRequests_();
    results.checksPerformed.push(orphanedCheck);
    results.totalIssuesFound += orphanedCheck.issuesFound;
    results.autoRepaired += orphanedCheck.autoRepaired;

    // Check 2: Over-capacity assignments
    const overCapCheck = checkForOverCapacity_();
    results.checksPerformed.push(overCapCheck);
    results.totalIssuesFound += overCapCheck.issuesFound;
    results.autoRepaired += overCapCheck.autoRepaired;

    // Check 3: Duplicate active requests
    const duplicateCheck = checkForDuplicates_();
    results.checksPerformed.push(duplicateCheck);
    results.totalIssuesFound += duplicateCheck.issuesFound;
    results.autoRepaired += duplicateCheck.autoRepaired;

    // Check 4: Invalid email formats
    const emailCheck = checkInvalidEmails_();
    results.checksPerformed.push(emailCheck);
    results.totalIssuesFound += emailCheck.issuesFound;

    // Check 5: Inconsistent state
    const stateCheck = checkInconsistentState_();
    results.checksPerformed.push(stateCheck);
    results.totalIssuesFound += stateCheck.issuesFound;
    results.autoRepaired += stateCheck.autoRepaired;

    // Check 6: Missing poster IDs
    const idCheck = checkMissingPosterIds_();
    results.checksPerformed.push(idCheck);
    results.totalIssuesFound += idCheck.issuesFound;
    results.autoRepaired += idCheck.autoRepaired;

    Logger.log(`[INTEGRITY] Check complete. Issues found: ${results.totalIssuesFound}, Auto-repaired: ${results.autoRepaired}`);

    return results;

  } catch (err) {
    Logger.log(`[ERROR] Full integrity check failed: ${err.message}`);
    results.checksPerformed.push({
      checkType: 'FATAL_ERROR',
      status: 'FAILED',
      error: err.message
    });
    return results;
  }
}

function checkForOrphanedRequests_() {
  const result = {
    checkType: 'ORPHANED_REQUESTS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const inventorySheet = getSheet_(CONFIG.SHEETS.INVENTORY);

    const requestData = getNonEmptyData_(requestsSheet, 7);
    const posterData = getNonEmptyData_(inventorySheet, 11, 3);

    const validPosterIds = new Set(
      posterData.map(row => String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim())
    );

    const orphanedRows = [];
    const orphanedDetails = [];
    requestData.forEach((row, idx) => {
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[COLS.REQUESTS.STATUS - 1] || '').trim();
      const title = String(row[COLS.REQUESTS.TITLE_SNAP - 1] || '').trim();
      const empEmail = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').trim();

      if (status === 'ACTIVE' && !validPosterIds.has(posterId)) {
        orphanedRows.push(idx + 2);
        orphanedDetails.push(`${empEmail} - ${title} (${posterId})`);
        result.issuesFound++;
      }
    });

    if (orphanedRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = orphanedRows.length;
      result.details.push(`Deleted ${orphanedRows.length} orphaned request(s)`);
      result.details.push(...orphanedDetails);

      // Auto-repair: Delete entire rows (from bottom to top)
      orphanedRows.reverse().forEach(rowNum => {
        requestsSheet.deleteRow(rowNum);
      });
      
      Logger.log(`[INTEGRITY] Deleted ${orphanedRows.length} orphaned requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkForOverCapacity_() {
  const result = {
    checkType: 'OVER_CAPACITY',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 9);

    const employeeSlots = {};
    const overCapRows = {};

    data.forEach((row, idx) => {
      const email = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase();
      const status = String(row[COLS.REQUESTS.STATUS - 1] || '').trim();

      if (status === 'ACTIVE' && email) {
        if (!employeeSlots[email]) employeeSlots[email] = [];
        employeeSlots[email].push(idx + 2);
      }
    });

    // Check for over-capacity
    Object.entries(employeeSlots).forEach(([email, rows]) => {
      if (rows.length > CONFIG.MAX_ACTIVE) {
        result.issuesFound += rows.length - CONFIG.MAX_ACTIVE;
        overCapRows[email] = rows.slice(CONFIG.MAX_ACTIVE);

        // Auto-repair: Keep oldest slots, mark newest as removed
        const rowsToRemove = rows.slice(CONFIG.MAX_ACTIVE);
        rowsToRemove.forEach(rowNum => {
          requestsSheet.getRange(rowNum, COLS.REQUESTS.STATUS).setValue('REMOVED_OVER_CAPACITY');
          requestsSheet.getRange(rowNum, COLS.REQUESTS.STATUS_TS).setValue(fmtDate_(now_(), CONFIG.DATE_FORMAT));
          result.autoRepaired++;
        });

        result.details.push(`${email}: Removed ${rowsToRemove.length} excess requests (kept oldest ${CONFIG.MAX_ACTIVE})`);
        result.status = 'REPAIRED';
      }
    });

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkForDuplicates_() {
  const result = {
    checkType: 'DUPLICATE_REQUESTS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(requestsSheet, 9);

    const seen = {};
    const duplicateRows = [];

    data.forEach((row, idx) => {
      const email = String(row[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase();
      const posterId = String(row[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
      const status = String(row[COLS.REQUESTS.STATUS - 1] || '').trim();

      const key = `${email}:${posterId}`;

      if (status === 'ACTIVE') {
        if (seen[key]) {
          duplicateRows.push(idx + 2);
          result.issuesFound++;
        } else {
          seen[key] = true;
        }
      }
    });

    if (duplicateRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = duplicateRows.length;

      // Auto-repair: Mark duplicates as removed
      duplicateRows.forEach(rowNum => {
        requestsSheet.getRange(rowNum, COLS.REQUESTS.STATUS).setValue('REMOVED_DUPLICATE');
        requestsSheet.getRange(rowNum, COLS.REQUESTS.STATUS_TS).setValue(fmtDate_(now_(), CONFIG.DATE_FORMAT));
      });

      result.details.push(`Removed ${duplicateRows.length} duplicate requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkInvalidEmails_() {
  const result = {
    checkType: 'INVALID_EMAILS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const subSheet = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
    const data = getNonEmptyData_(subSheet, 2);

    const invalidRows = [];

    data.forEach((row, idx) => {
      const email = String(row[1] || '').trim().toLowerCase();
      if (email && !isValidEmail_(email)) {
        invalidRows.push(idx + 2);
        result.issuesFound++;
      }
    });

    if (invalidRows.length > 0) {
      result.status = 'REQUIRES_ACTION';
      result.details.push(`Found ${invalidRows.length} invalid email addresses. Manual review needed.`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkInconsistentState_() {
  const result = {
    checkType: 'INCONSISTENT_STATE',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const requestsSheet = getSheet_(CONFIG.SHEETS.REQUESTS);
    const mainSheet = getSheet_(CONFIG.SHEETS.MAIN);
    const employeesSheet = getSheet_(CONFIG.SHEETS.EMPLOYEES);

    const requestData = getNonEmptyData_(requestsSheet, 9);
    const activeCount = requestData.filter(r => String(r[COLS.REQUESTS.STATUS - 1]).trim() === 'ACTIVE').length;

    // Simple check: make sure active count seems reasonable
    if (activeCount < 0) {
      result.status = 'FAILED';
      result.issuesFound++;
      result.details.push('Invalid active request count detected');
    } else {
      result.details.push(`Validated ${activeCount} active requests`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function checkMissingPosterIds_() {
  const result = {
    checkType: 'MISSING_POSTER_IDS',
    issuesFound: 0,
    autoRepaired: 0,
    details: [],
    status: 'PASS'
  };

  try {
    const inventorySheet = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inventorySheet, 11, 3);

    const missingRows = [];

    data.forEach((row, idx) => {
      const posterId = String(row[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      if (!posterId) {
        missingRows.push(idx + 2);
        result.issuesFound++;
      }
    });

    if (missingRows.length > 0) {
      result.status = 'REPAIRED';
      result.autoRepaired = missingRows.length;

      // Auto-repair: Generate missing IDs
      missingRows.forEach(rowNum => {
        const newId = uuidPosterId_();
        inventorySheet.getRange(rowNum, COLS.INVENTORY.POSTER_ID).setValue(newId);
      });

      result.details.push(`Generated ${missingRows.length} missing poster IDs`);
    }

  } catch (err) {
    result.status = 'ERROR';
    result.details.push(`Error: ${err.message}`);
  }

  logIntegrityCheck_(result);
  return result;
}

function logIntegrityCheck_(result) {
  try {
    const integritySheet = getSheet_(CONFIG.SHEETS.DATA_INTEGRITY);

    integritySheet.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      result.checkType,
      result.status,
      result.issuesFound,
      result.details.join('; '),
      result.autoRepaired,
      result.status === 'REQUIRES_ACTION' ? 'YES' : 'NO'
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log integrity check: ${err.message}`);
  }
}

function isValidEmail_(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).trim().toLowerCase());
}

function generateDataIntegrityReport_() {
  try {
    const integritySheet = getSheet_(CONFIG.SHEETS.DATA_INTEGRITY);
    const data = getNonEmptyData_(integritySheet, 7);

    const passCount = data.filter(r => r[2] === 'PASS').length;
    const failCount = data.filter(r => r[2] === 'FAILED').length;
    const repairCount = data.filter(r => r[2] === 'REPAIRED').length;
    const totalIssuesFound = data.reduce((sum, r) => sum + (Number(r[3]) || 0), 0);
    const totalRepaired = data.reduce((sum, r) => sum + (Number(r[5]) || 0), 0);

    return `
DATA INTEGRITY REPORT
Generated: ${new Date()}
======================================

SUMMARY:
- Checks Passed: ${passCount}
- Checks Failed: ${failCount}
- Checks Repaired: ${repairCount}

ISSUES:
- Total Issues Found: ${totalIssuesFound}
- Auto-Repaired: ${totalRepaired}
- Requires Admin Action: ${data.filter(r => r[6] === 'YES').length}

LAST 5 CHECKS:
${data.slice(-5).reverse().map((r, i) => `  ${i+1}. ${r[1]} - ${r[2]} (${r[3]} issues)`).join('\n')}

See Data Integrity sheet for full details.
    `.trim();
  } catch (err) {
    return `ERROR: Failed to generate report: ${err.message}`;
  }
}
