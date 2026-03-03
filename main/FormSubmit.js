/** FormSubmit.js **/

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
    const addNotes = answers.addNotes || {};  // NEW: notes map
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

    const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels, addNotes);
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
  const out = { empEmail: '', empName: '', addLabels: [], removeLabels: [], addNotes: {}, subscribe: false };
  if (!e || !e.response) {
    Logger.log(`[readFormAnswers] No response object`);
    return out;
  }

  const tName = String(CONFIG.FORM.Q_EMPLOYEE_NAME || '').trim();
  const tSub = String(CONFIG.FORM.Q_SUBSCRIBE || '').trim();

  Logger.log(`[readFormAnswers] Expected field names - Name: "${tName}", Subscribe: "${tSub}"`);

  // Get email from form's built-in email collection
  out.empEmail = String(e.response.getRespondentEmail() || '').trim().toLowerCase();

  const addLabels = [];
  const addNotes = {};  // Map: posterLabel → note text
  const removeLabels = [];

  e.response.getItemResponses().forEach(r => {
    const title = String(r.getItem().getTitle() || '').trim();
    const resp = r.getResponse();

    Logger.log(`[readFormAnswers] Found form field: "${title}" = ${JSON.stringify(resp)}`);

    if (title === tName) {
      out.empName = resp;
    } else if (title === tSub && resp && resp.length > 0) {
      out.subscribe = true;
    } else if (title.startsWith('Request Poster (Add)')) {
      // Collect non-empty add selections from the 7 dropdowns
      if (resp && String(resp).trim()) {
        const posterLabel = String(resp).trim();
        addLabels.push(posterLabel);
        
        // Extract the slot number (e.g., "Request Poster (Add) 1" → 1)
        const match = title.match(/Request Poster \(Add\) (\d+)/);
        if (match) {
          const slotNum = match[1];
          // Try to get the corresponding note from the note field
          // (Note: The note for this poster will be captured in the next pass)
        }
      }
    } else if (title.startsWith('Request Poster Note')) {
      // Capture notes and associate them with their slot numbers
      // Extract the slot number (e.g., "Request Poster Note 1" → 1)
      const match = title.match(/Request Poster Note (\d+)/);
      if (match && resp && String(resp).trim()) {
        const slotNum = parseInt(match[1]);
        // Store note by slot number for later pairing
        addNotes[`slot_${slotNum}`] = String(resp).trim();
      }
    } else if (title.startsWith('Remove Poster')) {
      // Collect non-empty remove selections from the 7 dropdowns
      if (resp && String(resp).trim()) {
        removeLabels.push(String(resp).trim());
      }
    }
  });

  // Now pair notes with their corresponding posters
  // addLabels[0] was from slot 1, so pair with addNotes['slot_1'], etc.
  addLabels.forEach((label, index) => {
    const slotNum = index + 1;
    const note = addNotes[`slot_${slotNum}`] || '';
    addNotes[label] = note;  // Map poster label to note
  });

  // Deduplicate poster selections (same poster selected multiple times = process once)
  out.addLabels = deduplicatePosters_(addLabels);
  out.removeLabels = deduplicatePosters_(removeLabels);
  
  // For deduped posters, keep the note from the first occurrence
  const dedupedAddNotes = {};
  out.addLabels.forEach(label => {
    if (addNotes[label]) {
      dedupedAddNotes[label] = addNotes[label];
    }
  });
  out.addNotes = dedupedAddNotes;

  Logger.log(`[readFormAnswers] After dedup - Add: ${JSON.stringify(out.addLabels)}, Notes: ${JSON.stringify(out.addNotes)}, Remove: ${JSON.stringify(out.removeLabels)}`);
  return out;
}

/**
 * Deduplicate poster selections: if same poster appears multiple times, keep only first occurrence
 * @param {string[]} labels - Array of poster labels
 * @returns {string[]} - Deduplicated array
 */
function deduplicatePosters_(labels) {
  const seen = new Set();
  return labels.filter(label => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

function processSubmission_(empEmail, empName, formTs, addLabels, removeLabels, addNotes = {}) {
  const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const decode = (lbl) => labelToId[String(lbl || '').trim()] || null;

  // Process removals first
  const removedApplied = processRemovals_(empEmail, removeLabels, decode);

  // Process additions after removals
  const { addedAccepted, deniedAdds } = processAdditions_(empEmail, empName, addLabels, decode, formTs, addNotes);

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
function processAdditions_(empEmail, empName, addLabels, decode, formTs, addNotes = {}) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const activePosterMap = getActivePosterIdMap_();

  const addQueue = Array.from(new Set((addLabels || []).map(lbl => String(lbl || '').trim()).filter(Boolean)));

  Logger.log(`[processAdditions] Starting with ${addQueue.length} labels to add`);
  Logger.log(`[processAdditions] ID to Current Label map: ${JSON.stringify(idToCurrent)}`);
  Logger.log(`[processAdditions] Active Poster Map: ${JSON.stringify(activePosterMap)}`);
  Logger.log(`[processAdditions] Add Notes map: ${JSON.stringify(addNotes)}`);

  const activeNow = countActiveSlotsByEmail_(empEmail);
  let available = Math.max(0, CONFIG.MAX_ACTIVE - activeNow);
  Logger.log(`[processAdditions] Current active slots: ${activeNow}, Available: ${available}`);

  const deniedAdds = [];
  const addedAccepted = [];

  for (const lbl of addQueue) {
    const pid = decode(lbl);
    const show = pid ? (idToCurrent[pid] || String(lbl).trim()) : String(lbl).trim();
    const note = addNotes[lbl] || '';  // Get note for this poster if it exists

    Logger.log(`[processAdditions] Processing label "${lbl}" -> decoded to PID "${pid}", note: "${note}"`);

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

    // All checks passed - add the request with note
    Logger.log(`[processAdditions] ACCEPTED: "${show}" - creating ledger row with note: "${note}"`);
    createLedgerRow_(empEmail, empName, pid, formTs, note);
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
