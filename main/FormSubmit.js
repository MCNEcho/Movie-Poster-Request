/** FormSubmit.js **/

function handleFormSubmit(e) {
  const startedAt = Date.now();
  const lock = LockService.getScriptLock();
  let refreshTasks = null;
  lock.waitLock(30000);

  try {
    Logger.log(`[handleFormSubmit] TRIGGERED - processing form submission`);
    const formTs = e && e.response ? e.response.getTimestamp() : now_();
    const answers = readFormAnswers_(e);

    const empEmail = String(answers.empEmail || '').trim().toLowerCase();
    const nameRaw = String(answers.empName || '').trim();
    Logger.log(`[handleFormSubmit] Email: ${empEmail}, Name: ${nameRaw}, RemoveLabels: ${JSON.stringify(answers.removeLabels)}, AddLabels: ${JSON.stringify(answers.addLabels)}`);

    if (!empEmail) {
      const reason = 'No respondent email was provided by the Form.';
      appendRequestOrderLog_({
        formTs,
        empEmail: '',
        empName: nameRaw,
        addRaw: '',
        removeRaw: '',
        slotsBefore: '',
        slotsAfter: '',
        addedAccepted: '',
        removedApplied: '',
        deniedAdds: 'Submission rejected',
        notes: reason,
      });
      logError_(new Error(reason), 'handleFormSubmit', { name: nameRaw, rejected: true });
      logSubmissionEvent_({ empName: nameRaw, status: 'REJECTED_MISSING_EMAIL', executionTime: Date.now() - startedAt, notes: reason });
      return;
    }

    // Validate name format (First Name + Last Initial)
    const nameCheck = normalizeEmployeeName_(nameRaw);
    if (!nameCheck.ok) {
      const reason = `Invalid name format: ${nameCheck.reason}`;
      appendRequestOrderLog_({
        formTs,
        empEmail,
        empName: nameRaw,
        addRaw: '',
        removeRaw: '',
        slotsBefore: '',
        slotsAfter: '',
        addedAccepted: '',
        removedApplied: '',
        deniedAdds: 'Submission rejected',
        notes: reason,
      });
      logError_(new Error(reason), 'handleFormSubmit', { empEmail, name: nameRaw, rejected: true });
      logSubmissionEvent_({ empEmail, empName: nameRaw, status: 'REJECTED_INVALID_NAME', executionTime: Date.now() - startedAt, notes: reason });
      return;
    }

    const empName = nameCheck.canonical;
    const addLabels = safeArray_(answers.addLabels);
    const addNotes = answers.addNotes || {};  // NEW: notes map
    const removeLabels = safeArray_(answers.removeLabels);

    // For logging (email-keyed)
    const requestRows = readRequestRows_();
    const slotsBefore = countActiveSlotsByEmail_(empEmail, requestRows);

    const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels, addNotes, requestRows);
    const slotsAfter = countActiveSlotsByEmail_(empEmail, requestRows);

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

    refreshTasks = { boards: true, form: true, employeeView: true };
    logSubmissionEvent_({
      empEmail,
      empName,
      addLabels,
      removeLabels,
      status: result.deniedAdds.length ? 'PARTIAL' : 'COMPLETE',
      executionTime: Date.now() - startedAt,
      notes: result.notes.join('; '),
    });
  } catch (err) {
    logError_(err, 'handleFormSubmit', 'Form submission');
  } finally {
    lock.releaseLock();
  }

  if (refreshTasks) {
    try {
      queueManualPosterRefresh_(refreshTasks);
    } catch (queueErr) {
      logError_(queueErr, 'handleFormSubmit', 'Queueing post-submission refresh');
    }
  }
}

function readFormAnswers_(e) {
  const out = { empEmail: '', empName: '', addLabels: [], removeLabels: [], addNotes: {} };
  if (!e || !e.response) {
    Logger.log(`[readFormAnswers] No response object`);
    return out;
  }

  const tName = String(CONFIG.FORM.Q_EMPLOYEE_NAME || '').trim();
  Logger.log(`[readFormAnswers] Expected field name - Name: "${tName}"`);

  // Get email from form's built-in email collection
  out.empEmail = String(e.response.getRespondentEmail() || '').trim().toLowerCase();

  const addBySlot = {};
  const addNotes = {};  // Map: posterLabel → note text
  const removeLabels = [];

  e.response.getItemResponses().forEach(r => {
    const title = String(r.getItem().getTitle() || '').trim();
    const resp = r.getResponse();

    Logger.log(`[readFormAnswers] Found form field: "${title}" = ${JSON.stringify(resp)}`);

    if (title === tName) {
      out.empName = resp;
    } else if (title.startsWith('Request Poster (Add)') && resp && String(resp).trim()) {
      const match = title.match(/^Request Poster \(Add\) (\d+)$/);
      if (match) addBySlot[Number(match[1])] = String(resp).trim();
    } else if (title.startsWith('Request Poster Note')) {
      // Capture notes and associate them with their slot numbers
      // Extract the slot number (e.g., "Request Poster Note 1" → 1)
      const match = title.match(/Request Poster Note (\d+)/);
      if (match && resp && String(resp).trim()) {
        const slotNum = parseInt(match[1]);
        // Store note by slot number for later pairing
        addNotes[`slot_${slotNum}`] = String(resp).trim();
      }
    } else if (title.startsWith('Remove Poster') && resp && String(resp).trim()) {
      // Collect non-empty remove selections from the configured dropdown slots.
      removeLabels.push(String(resp).trim());
    }
  });

  const pairedSlots = pairPosterSlotsWithNotes_(addBySlot, addNotes);
  const addLabels = pairedSlots.map(entry => entry.label);
  const notesByLabel = mapFirstNotesByLabel_(pairedSlots);

  // Deduplicate poster selections (same poster selected multiple times = process once)
  out.addLabels = deduplicatePosters_(addLabels);
  out.removeLabels = deduplicatePosters_(removeLabels);
  
  // For deduped posters, keep the note from the first occurrence
  const dedupedAddNotes = {};
  out.addLabels.forEach(label => {
    if (notesByLabel[label]) {
      dedupedAddNotes[label] = notesByLabel[label];
    }
  });
  out.addNotes = dedupedAddNotes;

  Logger.log(`[readFormAnswers] After dedup - Add: ${JSON.stringify(out.addLabels)}, Notes: ${JSON.stringify(out.addNotes)}, Remove: ${JSON.stringify(out.removeLabels)}`);
  return out;
}

function pairPosterSlotsWithNotes_(addBySlot, notesBySlot) {
  return Object.keys(addBySlot || {})
    .map(Number)
    .sort((a, b) => a - b)
    .map(slot => ({
      slot,
      label: addBySlot[slot],
      note: (notesBySlot || {})[`slot_${slot}`] || '',
    }));
}

function mapFirstNotesByLabel_(pairedSlots) {
  const notesByLabel = {};
  (pairedSlots || []).forEach(entry => {
    if (!Object.prototype.hasOwnProperty.call(notesByLabel, entry.label)) {
      notesByLabel[entry.label] = entry.note || '';
    }
  });
  return notesByLabel;
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

function processSubmission_(empEmail, empName, formTs, addLabels, removeLabels, addNotes = {}, requestRows) {
  const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const decode = (lbl) => labelToId[String(lbl || '').trim()] || null;

  // Process removals first
  const removedApplied = processRemovals_(empEmail, removeLabels, decode, requestRows);

  // Process additions after removals
  const { addedAccepted, deniedAdds } = processAdditions_(empEmail, empName, addLabels, decode, formTs, addNotes, requestRows);

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
function processRemovals_(empEmail, removeLabels, decode, requestRows) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const removedApplied = [];

  removeLabels.forEach(lbl => {
    const pid = decode(lbl);
    if (!pid) {
      Logger.log(`[processRemovals] Could not decode label: ${lbl}`);
      return;
    }

    Logger.log(`[processRemovals] Attempting to remove poster ${pid} (${lbl}) for ${empEmail}`);
    const ok = setRequestStatusByEmail_(empEmail, pid, STATUS.REMOVED, now_(), requestRows);
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
function processAdditions_(empEmail, empName, addLabels, decode, formTs, addNotes = {}, requestRows) {
  const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
  const activePosterMap = getActivePosterIdMap_();

  const addQueue = Array.from(new Set((addLabels || []).map(lbl => String(lbl || '').trim()).filter(Boolean)));

  Logger.log(`[processAdditions] Starting with ${addQueue.length} labels to add`);
  Logger.log(`[processAdditions] ID to Current Label map: ${JSON.stringify(idToCurrent)}`);
  Logger.log(`[processAdditions] Active Poster Map: ${JSON.stringify(activePosterMap)}`);
  Logger.log(`[processAdditions] Add Notes map: ${JSON.stringify(addNotes)}`);

  const activeNow = countActiveSlotsByEmail_(empEmail, requestRows);
  Logger.log(`[processAdditions] Current active slots: ${activeNow}, Available: ${Math.max(0, CONFIG.MAX_ACTIVE - activeNow)}`);

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
    const dedupCheck = canRequestPoster_(empEmail, pid, requestRows);
    if (!dedupCheck.allowed) {
      deniedAdds.push(`${show}: ${dedupCheck.reason}`);
      Logger.log(`[processAdditions] DENIED: "${show}" - ${dedupCheck.reason}`);
      continue;
    }

    // Check slot availability
    if (!isWithinSlotLimit_(activeNow + addedAccepted.length, CONFIG.MAX_ACTIVE)) {
      deniedAdds.push(`${show}: limit (${CONFIG.MAX_ACTIVE}-slot)`);
      Logger.log(`[processAdditions] DENIED: "${show}" - no available slots`);
      continue;
    }

    // All checks passed - add the request with note
    Logger.log(`[processAdditions] ACCEPTED: "${show}" - creating ledger row with note: "${note}"`);
    createLedgerRow_(empEmail, empName, pid, formTs, note, requestRows);
    addedAccepted.push(show);
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
// End of form submission helpers.

