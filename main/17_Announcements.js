/** 17_Announcements.js **/

function handleSheetEdit(e) {
  const sh = e.range.getSheet();
  const name = sh.getName();

  if (name === CONFIG.SHEETS.INVENTORY) {
    updateInventoryLastUpdated_();
    sortInventoryByReleaseDate_();           // Auto-sort after edits
    ensurePosterIdsInInventory_();          // Ensure IDs exist
    processInventoryEdit_(e);               // Handle ACTIVE checkbox changes
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
  const row = e.range.getRow();
  if (row < 2) return;

  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const r = inv.getRange(row, 1, 1, 12).getValues()[0];

  const active = r[COLS.INVENTORY.ACTIVE - 1] === true;
  const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
  const title = String(r[COLS.INVENTORY.TITLE - 1] || '').trim();
  const release = r[COLS.INVENTORY.RELEASE - 1];

  if (pid && active && title && release) {
    queueAnnouncement_(pid, title, release);
  }
  
  // Sync form options when Inventory changes
  syncPostersToForm();
  rebuildBoards();
}

function queueAnnouncement_(posterId, title, releaseDate) {
  const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
  if (announced[posterId]) return;

  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  queue[posterId] = {
    title,
    releaseDate: (releaseDate instanceof Date) ? fmtDate_(releaseDate, 'yyyy-MM-dd') : String(releaseDate),
  };
  writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, queue);
}

function previewPendingAnnouncement() {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  const ids = Object.keys(queue);
  if (ids.length === 0) {
    SpreadsheetApp.getUi().alert('No pending posters in the announcement queue.');
    return;
  }
  
  // Dry-run preview with actual template rendering
  const preview = generateAnnouncementPreview_(queue, ids);
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Announcement Preview (Dry-Run)',
    preview,
    ui.ButtonSet.OK
  );
}

function sendAnnouncementNow() {
  processAnnouncementQueue(true);
}

function processAnnouncementQueue(forceSend) {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
  const ids = Object.keys(queue);
  if (ids.length === 0) return;

  const recipients = getActiveSubscriberEmails_();
  if (recipients.length === 0) return;

  try {
    // Process announcements with batching
    if (CONFIG.ANNOUNCEMENT.BATCH_ENABLED && ids.length > 1) {
      processBatchedAnnouncements_(queue, ids, recipients);
    } else {
      // Send individual announcements
      processIndividualAnnouncements_(queue, ids, recipients);
    }

    // Mark all as announced
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    ids.forEach(id => announced[id] = true);
    writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
    
    // Clear queue
    writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    
    // Log successful announcement
    logAnnouncementEvent_(ids.length, recipients.length, 'SUCCESS');
  } catch (err) {
    logError_(err, 'processAnnouncementQueue', { queueSize: ids.length, recipientCount: recipients.length });
    throw err;
  }
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
  const formUrl = getOrCreateForm_().getPublishedUrl();
  
  // Select appropriate template
  const template = ids.length === 1 ? CONFIG.TEMPLATES.SINGLE_POSTER : CONFIG.TEMPLATES.BATCH;
  
  // Build poster list
  const posterList = formatPosterList_(queue, ids);
  
  // Get total active count
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  // Substitute variables
  let subject = template.subject;
  let body = template.body;
  
  if (ids.length === 1) {
    const poster = queue[ids[0]];
    subject = substituteVariables_(subject, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(ids[0]),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      COUNT: '1',
      POSTER_LIST: posterList
    });
    body = substituteVariables_(body, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(ids[0]),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      COUNT: '1',
      POSTER_LIST: posterList
    });
  } else {
    subject = substituteVariables_(subject, {
      COUNT: String(ids.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
    body = substituteVariables_(body, {
      COUNT: String(ids.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
  }
  
  const preview = [
    `Recipients: ${recipients.length} subscriber(s)`,
    `Posters to announce: ${ids.length}`,
    '',
    '--- EMAIL PREVIEW ---',
    `Subject: ${subject}`,
    '',
    'Body:',
    body,
    '--- END PREVIEW ---'
  ].join('\n');
  
  return preview;
}

/**
 * Process batched announcements
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @param {Array<string>} recipients - Email addresses
 */
function processBatchedAnnouncements_(queue, ids, recipients) {
  const batchSize = CONFIG.ANNOUNCEMENT.BATCH_SIZE;
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  
  const formUrl = getOrCreateForm_().getPublishedUrl();
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  batches.forEach((batch, batchIndex) => {
    const template = CONFIG.TEMPLATES.BATCH;
    const posterList = formatPosterList_(queue, batch);
    
    const subject = substituteVariables_(template.subject, {
      COUNT: String(batch.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
    
    const body = substituteVariables_(template.body, {
      COUNT: String(batch.length),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl,
      POSTER_LIST: posterList
    });
    
    // Send with throttling and retry
    sendAnnouncementEmail_(recipients, subject, body);
    
    // Throttle between batches
    if (batchIndex < batches.length - 1) {
      Utilities.sleep(CONFIG.ANNOUNCEMENT.THROTTLE_DELAY_MS);
    }
  });
}

/**
 * Process individual announcements (no batching)
 * @param {object} queue - Announcement queue
 * @param {Array<string>} ids - Poster IDs
 * @param {Array<string>} recipients - Email addresses
 */
function processIndividualAnnouncements_(queue, ids, recipients) {
  const formUrl = getOrCreateForm_().getPublishedUrl();
  const activeCount = getPostersWithLabels_().filter(p => p.active).length;
  
  ids.forEach((id, index) => {
    const poster = queue[id];
    const template = CONFIG.TEMPLATES.SINGLE_POSTER;
    
    const subject = substituteVariables_(template.subject, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(id),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl
    });
    
    const body = substituteVariables_(template.body, {
      TITLE: poster.title,
      RELEASE: poster.releaseDate,
      STOCK: getStockInfo_(id),
      ACTIVE_COUNT: activeCount,
      FORM_LINK: formUrl
    });
    
    // Send with retry
    sendAnnouncementEmail_(recipients, subject, body);
    
    // Throttle between emails
    if (index < ids.length - 1) {
      Utilities.sleep(CONFIG.ANNOUNCEMENT.THROTTLE_DELAY_MS);
    }
  });
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
    const data = getNonEmptyData_(inv, 12);
    
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
  recipients.forEach(email => {
    try {
      retryWithBackoff_(
        () => MailApp.sendEmail(email, subject, body),
        CONFIG.ANNOUNCEMENT.RETRY_ATTEMPTS,
        CONFIG.ANNOUNCEMENT.RETRY_INITIAL_DELAY_MS
      );
    } catch (err) {
      logError_(err, 'sendAnnouncementEmail_', { 
        recipient: email, 
        subject: subject 
      });
      // Continue with other recipients even if one fails
    }
  });
}

/**
 * Log announcement event to Analytics
 * @param {number} posterCount - Number of posters announced
 * @param {number} recipientCount - Number of recipients
 * @param {string} status - Status (SUCCESS/FAILURE)
 */
function logAnnouncementEvent_(posterCount, recipientCount, status) {
  try {
    const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
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
      `Sent announcement for ${posterCount} poster(s) to ${recipientCount} recipient(s)`
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log announcement event: ${err.message}`);
  }
}
