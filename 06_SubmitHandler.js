/** 06_SubmitHandler.gs**/

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
      Logger.log(`[handleFormSubmit] Subscriber added successfully`);
    }

    // For logging (email-keyed)
    const slotsBefore = countActiveSlotsByEmail_(empEmail);

    const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels);
    const slotsAfter = countActiveSlotsByEmail_(empEmail);

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
    console.error(err);
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

/**
 * Process removals from the form submission.
 * Returns array of label strings that were successfully removed.
 */
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

/**
 * Process additions from the form submission.
 * Returns { addedAccepted, deniedAdds } arrays.
 */
function processAdditions_(empEmail, empName, addLabels, decode, formTs) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const activePosterMap = getActivePosterIdMap_();

  Logger.log(`[processAdditions] Starting with ${addLabels.length} labels to add`);
  Logger.log(`[processAdditions] ID to Current Label map: ${JSON.stringify(idToCurrent)}`);
  Logger.log(`[processAdditions] Active Poster Map: ${JSON.stringify(activePosterMap)}`);

  const activeNow = countActiveSlotsByEmail_(empEmail);
  let available = Math.max(0, CONFIG.MAX_ACTIVE - activeNow);
  Logger.log(`[processAdditions] Current active slots: ${activeNow}, Available: ${available}`);

  const deniedAdds = [];
  const addedAccepted = [];

  for (const lbl of addLabels) {
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
    if (hasEverRequestedByEmail_(empEmail, pid)) {
      deniedAdds.push(`${show}: duplicate (historical)`);
      Logger.log(`[processAdditions] DENIED: "${show}" - already requested by this email`);
      continue;
    }

    // Check slot availability
    if (available <= 0) {
      deniedAdds.push(`${show}: limit (5-slot)`);
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

/**
 * Add or update subscriber in Subscribers sheet if not already there
 */
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
