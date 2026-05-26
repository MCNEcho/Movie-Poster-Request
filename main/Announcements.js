/** Announcements.js **/

function handleSheetEdit(e) {
  const sh = e.range.getSheet();
  const name = sh.getName();

  if (name === CONFIG.SHEETS.INVENTORY) {
    updateInventoryLastUpdated_();

    const editedCols = getEditedInventoryColumns_(e);
    const watchedCols = [
      COLS.INVENTORY.ACTIVE,
      COLS.INVENTORY.TITLE,
      COLS.INVENTORY.RELEASE,
      COLS.INVENTORY.POSTER_ID,
      COLS.INVENTORY.POSTERS,
    ];

    const relevantEdit = watchedCols.some(col => editedCols.includes(col));
    if (!relevantEdit) return;

    const structuralCols = [
      COLS.INVENTORY.ACTIVE,
      COLS.INVENTORY.TITLE,
      COLS.INVENTORY.RELEASE,
      COLS.INVENTORY.POSTER_ID,
    ];
    const structuralEdit = structuralCols.some(col => editedCols.includes(col));

    if (structuralEdit) {
      sortInventoryByReleaseDate_();
      ensurePosterIdsInInventory_();
    }

    const removalHandled = structuralEdit ? detectInventoryRemovalsFromEdit_(e) : false;
    if (!removalHandled) {
      processInventoryEdit_(e, editedCols);
    }

    return;
  }

  // Movie Posters sheet is deprecated - edit handler removed
  // All poster management now happens through Inventory sheet
}

function getEditedInventoryColumns_(e) {
  if (!e || !e.range) return [];
  const startCol = e.range.getColumn();
  const endCol = startCol + e.range.getNumColumns() - 1;
  const cols = [];
  for (let col = startCol; col <= endCol; col++) cols.push(col);
  return cols;
}

/**
 * Handle Inventory sheet edits - check for poster activation and restock changes
 */
function processInventoryEdit_(e, editedCols) {
  if (!e || !e.range) return;

  const changedCols = editedCols || getEditedInventoryColumns_(e);
  const watchedCols = [
    COLS.INVENTORY.ACTIVE,
    COLS.INVENTORY.TITLE,
    COLS.INVENTORY.RELEASE,
    COLS.INVENTORY.POSTER_ID,
    COLS.INVENTORY.POSTERS,
  ];

  const relevantEdit = watchedCols.some(col => changedCols.includes(col));
  if (!relevantEdit) return;

  const rowStart = Math.max(3, e.range.getRow());
  const rowEnd = e.range.getRow() + e.range.getNumRows() - 1;
  if (rowStart > rowEnd) return;

  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const queue = normalizeAnnouncementQueue_(readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {}));
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});

    let queueChanged = false;
    let snapshotChanged = false;

    for (let row = rowStart; row <= rowEnd; row++) {
      const values = inv.getRange(row, 1, 1, 11).getValues()[0];

      const active = values[COLS.INVENTORY.ACTIVE - 1] === true;
      const posterId = String(values[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      const title = String(values[COLS.INVENTORY.TITLE - 1] || '').trim();
      const release = values[COLS.INVENTORY.RELEASE - 1];
      const releaseDate = formatReleaseDate_(release);
      const amount = normalizeStockCount_(values[COLS.INVENTORY.POSTERS - 1]);

      if (!posterId || !active || !title || !releaseDate) {
        if (posterId) {
          if (queue[posterId]) {
            delete queue[posterId];
            queueChanged = true;
          }
          if (Object.prototype.hasOwnProperty.call(stockSnapshot, posterId)) {
            delete stockSnapshot[posterId];
            snapshotChanged = true;
          }
        }
        continue;
      }

      if (!announced[posterId]) {
        if (queueAnnouncement_(posterId, title, releaseDate, {
          type: 'new',
          amount,
          state: { queue, announced },
        })) {
          queueChanged = true;
        }
      } else {
        const oldAmount = normalizeStockCount_(stockSnapshot[posterId]);
        if (amount !== null && oldAmount !== null && amount > oldAmount) {
          if (queueAnnouncement_(posterId, title, releaseDate, {
            type: 'restock',
            oldAmount,
            newAmount: amount,
            amount,
            state: { queue, announced },
          })) {
            queueChanged = true;
          }
        }
      }

      if (amount !== null) {
        if (stockSnapshot[posterId] !== amount) {
          stockSnapshot[posterId] = amount;
          snapshotChanged = true;
        }
      } else if (Object.prototype.hasOwnProperty.call(stockSnapshot, posterId)) {
        delete stockSnapshot[posterId];
        snapshotChanged = true;
      }
    }

    if (queueChanged) {
      writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    }
    if (snapshotChanged) {
      writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
    }
  } finally {
    lock.releaseLock();
  }

  const structuralCols = [
    COLS.INVENTORY.ACTIVE,
    COLS.INVENTORY.TITLE,
    COLS.INVENTORY.RELEASE,
    COLS.INVENTORY.POSTER_ID,
  ];
  const needsHeavyRefresh = structuralCols.some(col => changedCols.includes(col));
  if (needsHeavyRefresh) {
    syncPostersToForm();
    rebuildBoards();
  }
}

function initializeStockSnapshot_() {
  writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, buildStockSnapshotFromInventory_());
}

function buildStockSnapshotFromInventory_() {
  const snapshot = {};
  const posters = getPostersWithLabels_();

  posters.forEach(poster => {
    const amount = normalizeStockCount_(poster.invCount);
    if (poster.posterId && amount !== null) {
      snapshot[poster.posterId] = amount;
    }
  });

  return snapshot;
}

function normalizeStockCount_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  if (!isFinite(num)) return null;
  const normalized = Math.floor(num);
  return normalized < 0 ? 0 : normalized;
}

function queueAnnouncement_(posterId, title, releaseDate, options) {
  const announcementType = options && options.type ? options.type : 'new';
  const entry = {
    type: announcementType,
    title: String(title || '').trim(),
  };

  if (announcementType === 'new') {
    entry.releaseDate = formatReleaseDate_(releaseDate);
    entry.amount = options && options.amount !== undefined ? options.amount : null;
  } else if (announcementType === 'restock') {
    entry.oldAmount = normalizeStockCount_(options && options.oldAmount);
    entry.newAmount = normalizeStockCount_(options && options.newAmount);
    entry.amount = options && options.amount !== undefined ? options.amount : entry.newAmount;
  }

  if (!entry.title || !posterId) return false;

  if (options && options.state) {
    if (options.state.announced && !options.state.announced[posterId] && announcementType === 'restock') {
      return false;
    }

    const merged = mergeAnnouncementEntry_(options.state.queue[posterId], entry);
    const changed = JSON.stringify(options.state.queue[posterId] || null) !== JSON.stringify(merged);
    options.state.queue[posterId] = merged;
    return changed;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    if (!announced[posterId] && announcementType === 'restock') return false;
    if (announced[posterId] && announcementType === 'new') return false;

    const queue = normalizeAnnouncementQueue_(readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {}));
    const merged = mergeAnnouncementEntry_(queue[posterId], entry);
    const changed = JSON.stringify(queue[posterId] || null) !== JSON.stringify(merged);

    queue[posterId] = merged;
    if (changed) {
      writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    }

    return changed;
  } finally {
    lock.releaseLock();
  }
}

function mergeAnnouncementEntry_(existing, incoming) {
  if (!existing || !existing.type) return incoming;

  if (existing.type === 'new') {
    return {
      type: 'new',
      title: incoming.title || existing.title,
      releaseDate: existing.releaseDate || incoming.releaseDate,
      amount: incoming.amount !== undefined ? incoming.amount : existing.amount,
    };
  }

  if (existing.type === 'restock') {
    return {
      type: 'restock',
      title: incoming.title || existing.title,
      oldAmount: normalizeStockCount_(existing.oldAmount),
      newAmount: incoming.newAmount !== undefined ? normalizeStockCount_(incoming.newAmount) : normalizeStockCount_(existing.newAmount),
      amount: incoming.amount !== undefined ? incoming.amount : existing.amount,
    };
  }

  return incoming;
}

function previewPendingAnnouncement() {
  const queue = normalizeAnnouncementQueue_(readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {}));
  const ids = Object.keys(queue);
  if (ids.length === 0) {
    SpreadsheetApp.getUi().alert('No pending posters in the announcement queue.');
    return;
  }

  const preview = generateAnnouncementPreview_(queue, ids);
  SpreadsheetApp.getUi().alert('Announcement Preview (Dry-Run)', preview, SpreadsheetApp.getUi().ButtonSet.OK);
}

function sendAnnouncementNow() {
  processAnnouncementQueue(true);
}

function processAnnouncementQueue(forceSend) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const props = getProps_();
    const currentBlock = Math.floor(Math.floor(Date.now() / 60000) / 15);
    const blockKey = String(currentBlock);

    if (!forceSend) {
      const lastProcessedBlock = String(props.getProperty(CONFIG.PROPS.ANNOUNCE_LAST_BLOCK) || '');
      if (lastProcessedBlock === blockKey) return;
      props.setProperty(CONFIG.PROPS.ANNOUNCE_LAST_BLOCK, blockKey);
    }

    const queue = normalizeAnnouncementQueue_(readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {}));
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    const recipients = getActiveSubscriberEmails_();
    if (recipients.length === 0) return;

    const payload = buildAnnouncementPayload_(queue, ids);
    const result = sendAnnouncementEmail_(recipients, payload.subject, payload.body);

    const fullyDelivered = result.fail_count === 0 && result.success_count === recipients.length;
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});

    ids.forEach(id => {
      const entry = queue[id];
      if (!entry) return;

      if (entry.type === 'new' && fullyDelivered) {
        announced[id] = true;
      }

      if (entry.type === 'restock') {
        const baseline = normalizeStockCount_(entry.newAmount);
        if (baseline !== null) {
          stockSnapshot[id] = baseline;
        }
      }
    });

    if (fullyDelivered) {
      ids.forEach(id => delete queue[id]);
    }

    writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
    writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
    writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);

    const status = result.fail_count === 0 ? 'SUCCESS' : (result.success_count > 0 ? 'PARTIAL_SUCCESS' : 'FAILURE');
    logAnnouncementEvent_(ids.length, recipients.length, status, result.success_count, result.fail_count, result.failures);
  } catch (err) {
    logError_(err, 'processAnnouncementQueue', { forceSend: !!forceSend });
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function buildAnnouncementPayload_(queue, ids) {
  const formUrl = getFormPublishedUrlSafe_();
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  const sectionData = buildAnnouncementSections_(queue, ids);

  const template = CONFIG.TEMPLATES.ANNOUNCEMENT_UPDATE || CONFIG.TEMPLATES.BATCH;
  const variables = {
    COUNT: String(ids.length),
    ACTIVE_COUNT: activeCount,
    FORM_LINK: formUrl,
    POSTER_LIST: formatPosterList_(queue, ids),
    ANNOUNCEMENT_SECTIONS: sectionData.sectionText,
  };

  return {
    subject: substituteVariables_(template.subject, variables),
    body: substituteVariables_(template.body, variables),
  };
}

function buildAnnouncementSections_(queue, ids) {
  const newIds = ids.filter(id => queue[id] && queue[id].type === 'new');
  const restockIds = ids.filter(id => queue[id] && queue[id].type === 'restock');

  const sections = [];

  if (newIds.length > 0) {
    sections.push('New Posters:');
    sections.push(formatPosterList_(queue, newIds));
  }

  if (restockIds.length > 0) {
    if (sections.length > 0) sections.push('');
    sections.push('Restocked Posters:');
    sections.push(formatRestockList_(queue, restockIds));
  }

  return {
    newCount: newIds.length,
    restockCount: restockIds.length,
    sectionText: sections.join('\n'),
  };
}

/**
 * Generate preview of announcement with template rendering
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Preview text
 */
function generateAnnouncementPreview_(queue, ids) {
  const recipients = getActiveSubscriberEmails_();
  const payload = buildAnnouncementPayload_(queue, ids);

  return [
    `Recipients: ${recipients.length} subscriber(s)`,
    `Posters to announce: ${ids.length}`,
    '',
    '--- EMAIL PREVIEW ---',
    `Subject: ${payload.subject}`,
    '',
    'Body:',
    payload.body,
    '--- END PREVIEW ---'
  ].join('\n');
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
 * Substitute template variables with actual values
 * @param {string} template - Template string with {{VARIABLE}} placeholders
 * @param {object} variables - Variable values
 * @returns {string} Substituted string
 */
function substituteVariables_(template, variables) {
  let result = template;

  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key] !== undefined && variables[key] !== null
      ? String(variables[key])
      : '[N/A]';
    result = result.replaceAll(placeholder, value);
  });

  result = result.replace(/\{\{[A-Z_]+\}\}/g, '[N/A]');

  return result;
}

function formatReleaseDate_(releaseDate) {
  if (releaseDate instanceof Date) return fmtDate_(releaseDate, 'yyyy-MM-dd');
  const s = String(releaseDate || '').trim();
  return s || '';
}

/**
 * Format poster list for announcements
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @returns {string} Formatted poster list
 */
function formatPosterList_(queue, ids) {
  return ids.map((id, i) => {
    const poster = queue[id] || {};
    if (poster.type === 'restock') {
      const oldAmount = normalizeStockCount_(poster.oldAmount);
      const newAmount = normalizeStockCount_(poster.newAmount);
      return `${i + 1}. ${poster.title || '[N/A]'} (${oldAmount === null ? '[N/A]' : oldAmount} -> ${newAmount === null ? '[N/A]' : newAmount})`;
    }
    return `${i + 1}. ${poster.title || '[N/A]'} (${poster.releaseDate || '[N/A]'})`;
  }).join('\n');
}

function formatRestockList_(queue, ids) {
  return ids.map(id => {
    const poster = queue[id] || {};
    const oldAmount = normalizeStockCount_(poster.oldAmount);
    const newAmount = normalizeStockCount_(poster.newAmount);
    return `- ${poster.title || '[N/A]'} ${oldAmount === null ? '[N/A]' : oldAmount} -> ${newAmount === null ? '[N/A]' : newAmount}`;
  }).join('\n');
}

function normalizeAnnouncementQueue_(queue) {
  const normalized = {};

  Object.keys(queue || {}).forEach(id => {
    const item = queue[id] || {};

    if (item.type === 'restock') {
      normalized[id] = {
        type: 'restock',
        title: String(item.title || '').trim(),
        oldAmount: normalizeStockCount_(item.oldAmount),
        newAmount: normalizeStockCount_(item.newAmount),
        amount: normalizeStockCount_(item.amount),
      };
      return;
    }

    normalized[id] = {
      type: 'new',
      title: String(item.title || '').trim(),
      releaseDate: formatReleaseDate_(item.releaseDate),
      amount: normalizeStockCount_(item.amount),
    };
  });

  return normalized;
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
 * @returns {object} Delivery result summary
 */
function sendAnnouncementEmail_(recipients, subject, body) {
  const result = {
    success_count: 0,
    fail_count: 0,
    failures: [],
  };

  recipients.forEach(email => {
    try {
      retryWithBackoff_(
        () => MailApp.sendEmail(email, subject, body),
        CONFIG.ANNOUNCEMENT.RETRY_ATTEMPTS,
        CONFIG.ANNOUNCEMENT.RETRY_INITIAL_DELAY_MS
      );
      result.success_count += 1;
    } catch (err) {
      result.fail_count += 1;
      result.failures.push({ recipient: email, error: String(err.message || err) });
      logError_(err, 'sendAnnouncementEmail_', {
        recipient: email,
        subject,
      });
    }
  });

  return result;
}

/**
 * Log announcement event to Analytics
 * @param {number} posterCount - Number of posters announced
 * @param {number} recipientCount - Number of recipients
 * @param {string} status - Status (SUCCESS/PARTIAL_SUCCESS/FAILURE)
 * @param {number} successCount - Number of successful deliveries
 * @param {number} failCount - Number of failed deliveries
 * @param {Array<object>} failures - Failure details
 */
function logAnnouncementEvent_(posterCount, recipientCount, status, successCount, failCount, failures) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const failureDetails = Array.isArray(failures) && failures.length > 0
      ? ` Failures: ${failures.map(f => f.recipient).join(', ')}`
      : '';

    analytics.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'ANNOUNCEMENT_SENT',
      '',
      '',
      '',
      '',
      status,
      0,
      0,
      0,
      0,
      `Announced ${posterCount} poster(s) to ${recipientCount} recipient(s). success_count=${Number(successCount) || 0}, fail_count=${Number(failCount) || 0}.${failureDetails}`
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log announcement event: ${err.message}`);
  }
}

function pruneAnnouncementQueueEntries_(posterIds) {
  const ids = safeArray_(posterIds).map(id => String(id || '').trim()).filter(Boolean);
  if (ids.length === 0) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const queue = normalizeAnnouncementQueue_(readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {}));
    const stockSnapshot = readJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, {});
    let queueChanged = false;
    let snapshotChanged = false;

    ids.forEach(id => {
      if (queue[id]) {
        delete queue[id];
        queueChanged = true;
      }
      if (Object.prototype.hasOwnProperty.call(stockSnapshot, id)) {
        delete stockSnapshot[id];
        snapshotChanged = true;
      }
    });

    if (queueChanged) {
      writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
    }
    if (snapshotChanged) {
      writeJsonProp_(CONFIG.PROPS.STOCK_SNAPSHOT, stockSnapshot);
    }
  } finally {
    lock.releaseLock();
  }
}
