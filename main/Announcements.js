/** Announcements.js **/

function handleSheetEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  const name = sh.getName();

  if (name === CONFIG.SHEETS.INVENTORY) {
    updateInventoryLastUpdated_();
    sortInventoryByReleaseDate_();           // Auto-sort after edits
    ensurePosterIdsInInventory_();          // Ensure IDs exist
    const removalHandled = detectInventoryRemovalsFromEdit_(e); // Detect title/release clears
    if (!removalHandled) {
      processInventoryEdit_(e);             // Handle ACTIVE checkbox changes
    }
    // Print Out now updates manually only - removed automatic refresh
    return;
  }

  // Movie Posters sheet is deprecated - edit handler removed
  // All poster management now happens through Inventory sheet
}

/**
 * Handle Inventory sheet edits - check for poster activation changes
 */
function processInventoryEdit_(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  if (!sh || sh.getName() !== CONFIG.SHEETS.INVENTORY) return;

  const row = e.range.getRow();
  if (row < 3) return;

  const startCol = e.range.getColumn();
  const endCol = startCol + e.range.getNumColumns() - 1;
  const watchedCols = [
    COLS.INVENTORY.ACTIVE,
    COLS.INVENTORY.TITLE,
    COLS.INVENTORY.RELEASE,
    COLS.INVENTORY.POSTER_ID,
    COLS.INVENTORY.POSTERS,
  ];

  const hasRelevantEdit = watchedCols.some(col => col >= startCol && col <= endCol);
  if (!hasRelevantEdit) return;

  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const r = inv.getRange(row, 1, 1, 12).getValues()[0];

  const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
  const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
  const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
  const release = r[COLS.INVENTORY.RELEASE - 1];
  const stockAmount = parseStockAmount_(r[COLS.INVENTORY.POSTERS - 1]);
  const hasRequiredFields = !!(pid && title && release);

  if (pid && active && hasRequiredFields) {
    const releaseDate = (release instanceof Date) ? fmtDate_(release, 'yyyy-MM-dd') : String(release);
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});

    if (!announced[pid]) {
      queueAnnouncement_(pid, {
        type: 'new',
        title,
        releaseDate,
        amount: stockAmount,
      });
    } else {
      const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});
      const priorAmount = parseStockAmount_(stockSnapshot[pid]);

      if (stockAmount !== null && priorAmount !== null && stockAmount > priorAmount) {
        queueAnnouncement_(pid, {
          type: 'restock',
          title,
          oldAmount: priorAmount,
          newAmount: stockAmount,
        });
      }
    }

    updateStockSnapshotForPoster_(pid, stockAmount);
  } else if (pid && !active) {
    removeAnnouncementStateForPosterIds_([pid]);
  }

  pruneAnnouncementStateToActiveInventory_();

  // Sync form options when Inventory changes
  syncPostersToForm();
  rebuildBoards();
}

function queueAnnouncement_(posterId, titleOrEntry, releaseDate) {
  const pid = String(posterId || '').trim();
  if (!pid) return;

  const incoming = normalizeAnnouncementEntry_(titleOrEntry, releaseDate);
  if (!incoming) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    queue[pid] = mergeAnnouncementEntries_(queue[pid], incoming);
    writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
  } finally {
    lock.releaseLock();
  }
}

function normalizeAnnouncementEntry_(titleOrEntry, releaseDate) {
  if (titleOrEntry && typeof titleOrEntry === 'object') {
    const type = String(titleOrEntry.type || '').trim();
    if (type === 'new') {
      return {
        type: 'new',
        title: String(titleOrEntry.title || '').trim(),
        releaseDate: String(titleOrEntry.releaseDate || '').trim(),
        amount: parseStockAmount_(titleOrEntry.amount),
      };
    }

    if (type === 'restock') {
      return {
        type: 'restock',
        title: String(titleOrEntry.title || '').trim(),
        oldAmount: parseStockAmount_(titleOrEntry.oldAmount),
        newAmount: parseStockAmount_(titleOrEntry.newAmount),
      };
    }

    return null;
  }

  return {
    type: 'new',
    title: String(titleOrEntry || '').trim(),
    releaseDate: (releaseDate instanceof Date) ? fmtDate_(releaseDate, 'yyyy-MM-dd') : String(releaseDate || '').trim(),
    amount: null,
  };
}

function mergeAnnouncementEntries_(existing, incoming) {
  if (!existing) return incoming;

  if (existing.type === 'new') {
    return {
      type: 'new',
      title: incoming.title || existing.title,
      releaseDate: existing.releaseDate || incoming.releaseDate || '',
      amount: incoming.amount !== null ? incoming.amount : existing.amount,
    };
  }

  if (existing.type === 'restock') {
    return {
      type: 'restock',
      title: incoming.title || existing.title,
      oldAmount: existing.oldAmount !== null ? existing.oldAmount : incoming.oldAmount,
      newAmount: incoming.newAmount !== null ? incoming.newAmount : existing.newAmount,
    };
  }

  return incoming;
}

function updateStockSnapshotForPoster_(posterId, amount) {
  const pid = String(posterId || '').trim();
  if (!pid) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const snapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});
    if (amount === null) {
      delete snapshot[pid];
    } else {
      snapshot[pid] = amount;
    }
    writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, snapshot);
  } finally {
    lock.releaseLock();
  }
}

function removeAnnouncementStateForPosterIds_(posterIds) {
  if (!Array.isArray(posterIds) || posterIds.length === 0) return;

  const ids = posterIds
    .map(id => String(id || '').trim())
    .filter(Boolean);

  if (ids.length === 0) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const snapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});
    let queueChanged = false;
    let snapshotChanged = false;

    ids.forEach(id => {
      if (Object.prototype.hasOwnProperty.call(queue, id)) {
        delete queue[id];
        queueChanged = true;
      }
      if (Object.prototype.hasOwnProperty.call(snapshot, id)) {
        delete snapshot[id];
        snapshotChanged = true;
      }
    });

    if (queueChanged) writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    if (snapshotChanged) writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, snapshot);
  } finally {
    lock.releaseLock();
  }
}

function pruneAnnouncementStateToActiveInventory_() {
  const activePosterIds = buildActiveInventoryPosterIdMap_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const snapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});
    let queueChanged = false;
    let snapshotChanged = false;

    Object.keys(queue).forEach(id => {
      if (!activePosterIds[id]) {
        delete queue[id];
        queueChanged = true;
      }
    });

    Object.keys(snapshot).forEach(id => {
      if (!activePosterIds[id]) {
        delete snapshot[id];
        snapshotChanged = true;
      }
    });

    if (queueChanged) writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    if (snapshotChanged) writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, snapshot);
  } finally {
    lock.releaseLock();
  }
}

function buildActiveInventoryPosterIdMap_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  const activeMap = {};

  data.forEach(r => {
    const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
    const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
    const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
    const release = r[COLS.INVENTORY.RELEASE - 1];

    if (active && pid && title && release) {
      activeMap[pid] = true;
    }
  });

  return activeMap;
}

function parseStockAmount_(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Bootstrap: seeds ANNOUNCED_IDS and STOCK_SNAPSHOT with all currently active posters
 * WITHOUT queuing anything. Called once the first time reconcile runs on an existing system.
 * Prevents sending an announcement blast for posters that were active before the
 * announcement system was introduced.
 */
function bootstrapAnnouncementState_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  const announced = {};
  const stockSnapshot = {};

  data.forEach(r => {
    const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
    const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
    if (!active || !pid) return;
    announced[pid] = true;
    const amount = parseStockAmount_(r[COLS.INVENTORY.POSTERS - 1]);
    if (amount !== null) stockSnapshot[pid] = amount;
  });

  writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
  writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
  writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  PropertiesService.getScriptProperties().setProperty(CONFIG.PROPS.ANNOUNCE_INITIALIZED, 'true');
  Logger.log(`[bootstrapAnnouncementState_] Bootstrapped ${Object.keys(announced).length} existing posters as already-announced.`);
}

// Lock-free core — callers must hold the script lock before calling.
function reconcileAnnouncementsFromInventory_Impl_() {
  // First-run bootstrap: if the system has never been initialized, mark all
  // currently active posters as already-announced so we don't send a blast
  // for posters that existed before the announcement system was introduced.
  const initialized = PropertiesService.getScriptProperties().getProperty(CONFIG.PROPS.ANNOUNCE_INITIALIZED);
  if (!initialized) {
    bootstrapAnnouncementState_();
    return; // Nothing to queue on first run — bootstrap is silent
  }

    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inv, 11, 3);

    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});

    const activeMap = {};

    data.forEach(r => {
      const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
      const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
      const release = r[COLS.INVENTORY.RELEASE - 1];
      const amount = parseStockAmount_(r[COLS.INVENTORY.POSTERS - 1]);

      if (!pid) return;
      if (!active || !title || !release) return;

      activeMap[pid] = true;
      const releaseDate = (release instanceof Date) ? fmtDate_(release, 'yyyy-MM-dd') : String(release);

      if (!announced[pid]) {
        queue[pid] = mergeAnnouncementEntries_(queue[pid], {
          type: 'new',
          title,
          releaseDate,
          amount,
        });
      } else {
        const priorAmount = parseStockAmount_(stockSnapshot[pid]);
        if (amount !== null && priorAmount !== null && amount > priorAmount) {
          queue[pid] = mergeAnnouncementEntries_(queue[pid], {
            type: 'restock',
            title,
            oldAmount: priorAmount,
            newAmount: amount,
          });
        }
      }

      if (amount === null) {
        delete stockSnapshot[pid];
      } else {
        stockSnapshot[pid] = amount;
      }
    });

    Object.keys(queue).forEach(id => {
      if (!activeMap[id]) delete queue[id];
    });

    Object.keys(stockSnapshot).forEach(id => {
      if (!activeMap[id]) delete stockSnapshot[id];
    });

  writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
  writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
}

function reconcileAnnouncementsFromInventory_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    reconcileAnnouncementsFromInventory_Impl_();
  } finally {
    lock.releaseLock();
  }
}

function previewPendingAnnouncement() {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  const ids = Object.keys(queue);
  if (ids.length === 0) {
    SpreadsheetApp.getUi().alert('No pending posters in the announcement queue.');
    return;
  }
  
  const preview = generateAnnouncementPreview_(queue, ids);
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Announcement Preview (Dry-Run)',
    preview,
    ui.ButtonSet.OK
  );
}

function sendAnnouncementNow() {
  processAnnouncementQueue(true);
}

/**
 * Menu action: marks all currently active posters as already-announced
 * and clears the queue WITHOUT sending any email. Use this after a bulk
 * import or any time you want to reset the baseline without spamming.
 */
function markAllPostersAsAnnounced() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    bootstrapAnnouncementState_();
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('Done: all current active posters marked as already-announced. The queue has been cleared.');
}

function processAnnouncementQueue(forceSend) {
  const shouldForce = forceSend === true;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!shouldForce && !shouldProcessCurrentAnnouncementBlock_()) {
      return;
    }

    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    const recipients = getActiveSubscriberEmails_();
    if (recipients.length === 0) return;

    const content = buildAnnouncementContent_(queue, ids);
    const sendResult = sendAnnouncementEmail_(recipients, content.subject, content.body);
    const fullyDelivered = sendResult.failCount === 0;

    if (fullyDelivered) {
      const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
      const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});

      ids.forEach(id => {
        const entry = queue[id] || {};
        if (entry.type === 'new') {
          announced[id] = true;
          if (entry.amount !== null) stockSnapshot[id] = entry.amount;
        }
        if (entry.type === 'restock' && entry.newAmount !== null) {
          stockSnapshot[id] = entry.newAmount;
        }
        delete queue[id];
      });

      writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
      writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
      writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    }

    const status = fullyDelivered ? 'SUCCESS' : 'PARTIAL_FAILURE';
    const details = fullyDelivered
      ? `Sent ${ids.length} poster update(s) to ${recipients.length} recipient(s).`
      : `Partial failure for ${ids.length} poster update(s): ${sendResult.failCount} failed delivery(ies).`;

    logAnnouncementEvent_(
      ids.length,
      recipients.length,
      status,
      sendResult.successCount,
      sendResult.failCount,
      details
    );
  } catch (err) {
    logError_(err, 'processAnnouncementQueue', { forceSend: shouldForce });
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function shouldProcessCurrentAnnouncementBlock_() {
  const props = getProps_();
  const nowMinutes = Math.floor(now_().getTime() / 60000);
  const currentBlock = Math.floor(nowMinutes / 15);
  const key = CONFIG.PROPS.ANNOUNCE_LAST_BLOCK;
  const lastBlock = Number(props.getProperty(key) || '-1');

  if (lastBlock === currentBlock) return false;

  props.setProperty(key, String(currentBlock));
  return true;
}

function getActiveSubscriberEmails_() {
  const sh = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
  const data = getNonEmptyData_(sh, 3);
  return data
    .filter(r => r[COLS.SUBSCRIBERS.ACTIVE - 1] === true)
    .map(r => String(r[COLS.SUBSCRIBERS.EMAIL - 1] || '').trim())
    .filter(Boolean);
}

/**
 * Generate preview of announcement with template rendering
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Preview text
 */
function generateAnnouncementPreview_(queue, ids) {
  const recipients = getActiveSubscriberEmails_();
  const content = buildAnnouncementContent_(queue, ids);
  
  const preview = [
    `Recipients: ${recipients.length} subscriber(s)`,
    `Posters to announce: ${ids.length}`,
    `New posters: ${content.newCount}`,
    `Restocks: ${content.restockCount}`,
    '',
    '--- EMAIL PREVIEW ---',
    `Subject: ${content.subject}`,
    '',
    'Body:',
    content.body,
    '--- END PREVIEW ---'
  ].join('\n');

  return preview;
}

function buildAnnouncementContent_(queue, ids) {
  const newEntries = [];
  const restockEntries = [];

  ids.forEach(id => {
    const entry = queue[id] || {};
    if (entry.type === 'restock') {
      restockEntries.push({
        posterId: id,
        title: String(entry.title || '').trim() || id,
        oldAmount: parseStockAmount_(entry.oldAmount),
        newAmount: parseStockAmount_(entry.newAmount),
      });
      return;
    }

    newEntries.push({
      posterId: id,
      title: String(entry.title || '').trim() || id,
      releaseDate: String(entry.releaseDate || '').trim(),
      amount: parseStockAmount_(entry.amount),
    });
  });

  const sections = [];

  if (newEntries.length > 0) {
    const newLines = newEntries.map((item, idx) => {
      const releaseText = item.releaseDate || 'TBD';
      return `${idx + 1}. ${item.title} (${releaseText})`;
    });
    sections.push(['New posters now available:', ...newLines].join('\n'));
  }

  if (restockEntries.length > 0) {
    const restockLines = restockEntries.map(item => {
      const oldText = item.oldAmount !== null ? String(item.oldAmount) : '?';
      const newText = item.newAmount !== null ? String(item.newAmount) : '?';
      return `"${item.title}" ${oldText} -> ${newText}`;
    });
    sections.push(['We got more posters for:', ...restockLines].join('\n'));
  }

  const posterList = sections.join('\n\n') || 'No poster updates.';

  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  const formUrl = getFormPublishedUrlSafe_();
  const firstNew = newEntries[0] || null;
  const firstPosterId = ids[0] || '';

  let subjectTemplate = CONFIG.TEMPLATES.BATCH.subject;
  if (newEntries.length === 1 && restockEntries.length === 0) {
    subjectTemplate = CONFIG.TEMPLATES.SINGLE_POSTER.subject;
  } else if (restockEntries.length === 1 && newEntries.length === 0) {
    subjectTemplate = 'Poster Restock: {{TITLE}}';
  }

  const subject = substituteVariables_(subjectTemplate, {
    TITLE: firstNew ? firstNew.title : (restockEntries[0] ? restockEntries[0].title : 'Poster Update'),
    RELEASE: firstNew ? firstNew.releaseDate : '',
    STOCK: firstPosterId ? getStockInfo_(firstPosterId) : 'Available',
    COUNT: String(ids.length),
    ACTIVE_COUNT: activeCount,
    FORM_LINK: formUrl,
    POSTER_LIST: posterList
  });

  const bodyTemplate = restockEntries.length > 0
    ? 'Poster inventory update:\n\n{{POSTER_LIST}}\n\nTotal Active Posters: {{ACTIVE_COUNT}}\n\nRequest here:\n{{FORM_LINK}}'
    : CONFIG.TEMPLATES.DEFAULT.body;

  const body = substituteVariables_(bodyTemplate, {
    TITLE: firstNew ? firstNew.title : (restockEntries[0] ? restockEntries[0].title : 'Poster Update'),
    RELEASE: firstNew ? firstNew.releaseDate : '',
    STOCK: firstPosterId ? getStockInfo_(firstPosterId) : 'Available',
    COUNT: String(ids.length),
    ACTIVE_COUNT: activeCount,
    FORM_LINK: formUrl,
    POSTER_LIST: posterList
  });

  return {
    subject,
    body,
    newCount: newEntries.length,
    restockCount: restockEntries.length,
  };
}

/**
 * Substitute template variables with actual values
 * @param {string} template - Template string with {{VARIABLE}} placeholders
 * @param {object} variables - Variable values
 * @returns {string} Substituted string
 */
function substituteVariables_(template, variables) {
  let result = template;
  
  // First, substitute provided variables
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key] !== undefined && variables[key] !== null 
      ? String(variables[key]) 
      : '[N/A]'; // Fallback for missing data
    result = result.replaceAll(placeholder, value);
  });
  
  // Then, replace any remaining unsubstituted variables with fallback
  result = result.replace(/\{\{[A-Z_]+\}\}/g, '[N/A]');
  
  return result;
}

/**
 * Format poster list for announcements
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Formatted poster list
 */
function formatPosterList_(queue, ids) {
  return ids.map((id, i) => {
    const poster = queue[id];
    return `${i+1}. ${poster.title} (${poster.releaseDate})`;
  }).join('\n');
}

/**
 * Get stock information for a poster
 * @param {string} posterId - Poster ID
 * @returns {string} Stock info
 */
function getStockInfo_(posterId) {
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inv, 11, 3);
    
    const poster = data.find(r => 
      String(r[COLS.INVENTORY.POSTER_ID - 1]).trim() === posterId
    );
    
    if (poster) {
      const invCount = poster[COLS.INVENTORY.POSTERS - 1];
      return invCount !== undefined && invCount !== null && invCount !== '' 
        ? String(invCount) 
        : 'Available';
    }
    
    return 'Available';
  } catch (err) {
    Logger.log(`[WARN] Failed to get stock info for ${posterId}: ${err.message}`);
    return 'Available';
  }
}

/**
 * Send announcement email with retry and backoff
 * @param {Array<string>} recipients - Email addresses
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 */
function sendAnnouncementEmail_(recipients, subject, body) {
  let successCount = 0;
  let failCount = 0;
  const failures = [];

  recipients.forEach(email => {
    try {
      retryWithBackoff_(
        () => MailApp.sendEmail(email, subject, body),
        CONFIG.ANNOUNCEMENT.RETRY_ATTEMPTS,
        CONFIG.ANNOUNCEMENT.RETRY_INITIAL_DELAY_MS
      );
      successCount += 1;
    } catch (err) {
      failCount += 1;
      failures.push({ email, error: String(err.message || err) });
      logError_(err, 'sendAnnouncementEmail_', { 
        recipient: email, 
        subject: subject 
      });
      // Continue with other recipients even if one fails
    }
  });

  return { successCount, failCount, failures };
}

/**
 * Log announcement event to Analytics
 * @param {number} posterCount - Number of posters announced
 * @param {number} recipientCount - Number of recipients
 * @param {string} status - Status (SUCCESS/FAILURE)
 */
function logAnnouncementEvent_(posterCount, recipientCount, status, successCount, failCount, details) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const success = Number(successCount || 0);
    const failed = Number(failCount || 0);
    const note = details || `Sent announcement for ${posterCount} poster(s) to ${recipientCount} recipient(s)`;

    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'ANNOUNCEMENT_SENT',
      '',
      '',
      '',
      '',
      status,
      success,
      failed,
      0,
      note
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log announcement event: ${err.message}`);
  }
}
