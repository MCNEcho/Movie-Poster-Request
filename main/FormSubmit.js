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

    // Mark system needing refresh but don't block on the rebuild
    Logger.log(`[handleFormSubmit] Marking system needing refresh (deferred)`);
    markSystemNeedingRefresh_();
    
    Logger.log(`[handleFormSubmit] Form submission processing complete (refresh deferred)`);
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
