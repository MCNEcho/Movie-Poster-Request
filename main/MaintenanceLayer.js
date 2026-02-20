// === MAINTENANCE LAYER MODULE ===
// Consolidates: BackupManager.js, Analytics.js, Announcements.js
// Provides: Data backups, event analytics, email announcements

// ===== BACKUP MANAGEMENT =====

function performNightlyBackup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[BACKUP] Starting nightly backup...');

    ensureBackupFolder_();

    const backupType = CONFIG.BACKUP.TYPE || 'CSV';
    const timestamp = fmtDate_(now_(), 'YYYY-MM-DD_HHmmss');

    if (backupType === 'CSV') {
      backupSheet_(CONFIG.SHEETS.REQUESTS, `requests_${timestamp}.csv`);
      backupSheet_(CONFIG.SHEETS.INVENTORY, `inventory_${timestamp}.csv`);
    } else {
      // Sheet-based backup (less efficient, but preserves formatting)
      backupSheet_(CONFIG.SHEETS.REQUESTS, `requests_${timestamp}`);
      backupSheet_(CONFIG.SHEETS.INVENTORY, `inventory_${timestamp}`);
    }

    applyRetentionPolicy_();
    logBackupEvent_('SUCCESS', `Backup completed for ${timestamp}`);

    Logger.log('[BACKUP] Nightly backup complete');
  } catch (err) {
    logError_(err, 'performNightlyBackup', 'Nightly backup', 'CRITICAL');
    logBackupEvent_('ERROR', `Backup failed: ${err.message}`);
  } finally {
    lock.releaseLock();
  }
}

function backupSheet_(sheetName, fileName) {
  const sh = getSheet_(sheetName);
  if (!sh) return;

  const backupFolder = DriveApp.getFolderById(readProp_(CONFIG.PROPS.BACKUP_FOLDER_ID, ''));
  if (!backupFolder) {
    Logger.log(`[WARN] Backup folder not found`);
    return;
  }

  try {
    const data = sh.getDataRange().getValues();
    const csv = convertToCsv_(data);

    const file = backupFolder.createFile(fileName + '.csv', csv, 'text/csv');
    Logger.log(`[BACKUP] Created backup: ${fileName} (${file.getId()})`);

  } catch (err) {
    Logger.log(`[WARN] Failed to backup ${sheetName}: ${err.message}`);
  }
}

function convertToCsv_(data) {
  return data
    .map(row =>
      row.map(cell => {
        const str = String(cell || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(',')
    )
    .join('\n');
}

function ensureBackupFolder_() {
  let folderId = readProp_(CONFIG.PROPS.BACKUP_FOLDER_ID, '');

  if (folderId) {
    try {
      DriveApp.getFolderById(folderId);
      return;
    } catch (e) {
      // Folder deleted or inaccessible
    }
  }

  // Create new backup folder
  const parentFolder = DriveApp.getRootFolder();
  const folder = parentFolder.createFolder(`${CONFIG.FORM_META.APP_NAME} Backups`);
  folderId = folder.getId();

  writeProp_(CONFIG.PROPS.BACKUP_FOLDER_ID, folderId);
  Logger.log(`[BACKUP] Created backup folder: ${folderId}`);
}

function applyRetentionPolicy_() {
  try {
    const folderId = readProp_(CONFIG.PROPS.BACKUP_FOLDER_ID, '');
    if (!folderId) return;

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType('text/csv');
    const now = new Date().getTime();
    const retentionMs = (CONFIG.BACKUP.RETENTION_DAYS || 30) * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      const age = now - file.getLastUpdated().getTime();

      if (age > retentionMs) {
        file.setTrashed(true);
        deletedCount++;
        Logger.log(`[BACKUP] Deleted expired backup: ${file.getName()}`);
      }
    }

    if (deletedCount > 0) {
      Logger.log(`[BACKUP] Retention policy: deleted ${deletedCount} old backups`);
    }

  } catch (err) {
    Logger.log(`[WARN] Retention policy failed: ${err.message}`);
  }
}

function logBackupEvent_(status, details) {
  try {
    const anSh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    anSh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BACKUP',
      status,
      details,
      ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log backup event: ${err.message}`);
  }
}

function manualBackupTrigger() {
  SpreadsheetApp.getUi().alert('Running backup...');
  performNightlyBackup();
  SpreadsheetApp.getUi().alert('Backup complete!');
}

// ===== ANALYTICS TRACKING =====

function ensureAnalyticsSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = ['Timestamp', 'Event Type', 'Status', 'Details', 'Notes'];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS, headers);
}

function ensureAnalyticsSummarySheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = ['Metric', 'Value', 'Last Updated'];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ANALYTICS_SUMMARY, headers);
}

function logSubmissionEvent_(empEmail, addCount, removeCount, slot) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    sh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'FORM_SUBMISSION',
      'SUCCESS',
      `${empEmail}: +${addCount} requests, -${removeCount} removals, slots: ${slot}/${CONFIG.MAX_ACTIVE}`,
      ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log submission event: ${err.message}`);
  }
}

function logBoardRebuildEvent_(status, details) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    sh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BOARD_REBUILD',
      status,
      details,
      ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log board rebuild event: ${err.message}`);
  }
}

function logFormSyncEvent_(status, posterCount) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    sh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'FORM_SYNC',
      status,
      `Updated form options for ${posterCount} active posters`,
      ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log form sync event: ${err.message}`);
  }
}

function updateAnalyticsSummary_() {
  try {
    const sumSh = getSheet_(CONFIG.SHEETS.ANALYTICS_SUMMARY);
    sumSh.clearContents();

    const reqSh = getSheet_(CONFIG.SHEETS.REQUESTS);
    const reqData = getNonEmptyData_(reqSh, 9);

    const totalReqs = reqData.length;
    const activeReqs = reqData.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE).length;
    const removedReqs = totalReqs - activeReqs;

    const invSh = getSheet_(CONFIG.SHEETS.INVENTORY);
    const invData = getNonEmptyData_(invSh, 11, 3);
    const activePosts = invData.filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true).length;

    sumSh.appendRow(['Total Requests Ever', totalReqs, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    sumSh.appendRow(['Active Requests', activeReqs, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    sumSh.appendRow(['Removed Requests', removedReqs, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);
    sumSh.appendRow(['Active Posters', activePosts, fmtDate_(now_(), CONFIG.DATE_FORMAT)]);

    Logger.log('[ANALYTICS] Summary updated');
  } catch (err) {
    Logger.log(`[WARN] Failed to update analytics summary: ${err.message}`);
  }
}

function getMostRequestedPosters_() {
  const reqSh = getSheet_(CONFIG.SHEETS.REQUESTS);
  const data = getNonEmptyData_(reqSh, 9);

  const counts = {};
  data.forEach(r => {
    const pid = String(r[COLS.REQUESTS.POSTER_ID - 1] || '').trim();
    const title = String(r[COLS.REQUESTS.TITLE_SNAP - 1] || '').trim();
    const status = String(r[COLS.REQUESTS.STATUS - 1] || '').trim();

    if (status === STATUS.ACTIVE && pid && title) {
      counts[title] = (counts[title] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count);
}

function detectAnomalies_() {
  const anomalies = [];

  try {
    const reqSh = getSheet_(CONFIG.SHEETS.REQUESTS);
    const data = getNonEmptyData_(reqSh, 9);

    // Anomaly 1: One employee with too many requests
    const empCounts = {};
    data.forEach(r => {
      const email = String(r[COLS.REQUESTS.EMP_EMAIL - 1] || '').toLowerCase();
      const status = String(r[COLS.REQUESTS.STATUS - 1] || '').trim();
      if (status === STATUS.ACTIVE) {
        empCounts[email] = (empCounts[email] || 0) + 1;
      }
    });

    Object.entries(empCounts).forEach(([email, count]) => {
      if (count > CONFIG.MAX_ACTIVE) {
        anomalies.push(`Employee ${email} has ${count} active requests (limit: ${CONFIG.MAX_ACTIVE})`);
      }
    });

    // Anomaly 2: Duplicate requests (same email/poster)
    const seen = {};
    data.forEach(r => {
      const key = `${r[COLS.REQUESTS.EMP_EMAIL - 1]}:${r[COLS.REQUESTS.POSTER_ID - 1]}`;
      const status = String(r[COLS.REQUESTS.STATUS - 1]).trim();
      if (status === STATUS.ACTIVE) {
        if (seen[key]) {
          anomalies.push(`Duplicate: ${key}`);
        } else {
          seen[key] = true;
        }
      }
    });

  } catch (err) {
    Logger.log(`[WARN] Anomaly detection failed: ${err.message}`);
  }

  return anomalies;
}

function generateAnalyticsReport_() {
  const report = [];
  report.push('ANALYTICS REPORT');
  report.push('================\n');

  const mostRequested = getMostRequestedPosters_();
  if (mostRequested.length > 0) {
    report.push('TOP REQUESTED POSTERS:');
    mostRequested.slice(0, 5).forEach((p, i) => {
      report.push(`  ${i + 1}. ${p.title} (${p.count} requests)`);
    });
    report.push('');
  }

  const anomalies = detectAnomalies_();
  if (anomalies.length > 0) {
    report.push('ANOMALIES DETECTED:');
    anomalies.forEach(a => report.push(`  ⚠️ ${a}`));
  } else {
    report.push('✅ No anomalies detected');
  }

  return report.join('\n');
}

function archiveOldAnalytics_() {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(sh);
    const cutoffDate = new Date(now().getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    let rowsToDelete = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      const ts = data[i][0];
      if (ts instanceof Date && ts < cutoffDate) {
        sh.deleteRow(i + 2); // +2 for 0-index and 1-based rows
        rowsToDelete++;
      }
    }

    if (rowsToDelete > 0) {
      Logger.log(`[ANALYTICS] Archived ${rowsToDelete} old records`);
    }

  } catch (err) {
    Logger.log(`[WARN] Failed to archive analytics: ${err.message}`);
  }
}

function logBulkSimulationEvent_(runCount, dryRun, metricsJson) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    sh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'BULK_SIMULATION',
      dryRun ? 'DRY_RUN' : 'LIVE',
      `Ran ${runCount} simulated submissions`,
      metricsJson
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log bulk simulation: ${err.message}`);
  }
}

// ===== ANNOUNCEMENT/EMAIL QUEUE =====

function handleSheetEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const ss = e.source;

  Logger.log(`[ANNOUNCE] Sheet edit detected: ${sheet.getName()}`);

  // If edit is to INVENTORY sheet, trigger form sync and rebuild
  if (sheet.getName() === CONFIG.SHEETS.INVENTORY) {
    Logger.log(`[ANNOUNCE] Inventory sheet edited - syncing form options`);

    try {
      const previousValues = e.oldValues;
      const newValues = e.values;

      Logger.log(`[ANNOUNCE] Old: ${JSON.stringify(previousValues)}, New: ${JSON.stringify(newValues)}`);

      processInventoryEdit_(previousValues, newValues);
    } catch (err) {
      logError_(err, 'handleSheetEdit', 'Inventory edit handling');
    }
  }
}

function processInventoryEdit_(oldVals, newVals) {
  Logger.log('[ANNOUNCE] Processing inventory edit...');

  try {
    // Rebuild boards to reflect inventory changes
    rebuildBoards();
    Logger.log('[ANNOUNCE] Boards rebuilt after inventory edit');

    // Sync poster options in form
    syncPostersToForm();
    Logger.log('[ANNOUNCE] Form synced after inventory edit');

    // Check if new active poster - queue announcement
    if (newVals && newVals[0] && newVals[0][0] === true && oldVals && oldVals[0] && oldVals[0][0] !== true) {
      Logger.log('[ANNOUNCE] Detected new active poster - queueing announcement');
      queueAnnouncement_(`New poster activated! Check the form to request.`, 'NEW_POSTER');
    }

  } catch (err) {
    Logger.log(`[WARN] Error processing inventory edit: ${err.message}`);
  }
}

function queueAnnouncement_(message, category) {
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCEMENT_QUEUE, []);

    queue.push({
      message,
      category,
      queuedAt: now_().getTime(),
      scheduled: false
    });

    writeJsonProp_(CONFIG.PROPS.ANNOUNCEMENT_QUEUE, queue);
    Logger.log(`[ANNOUNCE] Announcement queued: ${category}`);

  } catch (err) {
    Logger.log(`[WARN] Failed to queue announcement: ${err.message}`);
  }
}

function previewPendingAnnouncement() {
  const preview = generateAnnouncementPreview_();
  const ui = SpreadsheetApp.getUi();
  ui.alert(`ANNOUNCEMENT PREVIEW:\n\n${preview}`);
}

function sendAnnouncementNow() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('Send all pending announcements NOW?', ui.ButtonSet.YES_NO);

  if (response === ui.Button.YES) {
    processAnnouncementQueue();
    ui.alert('Announcements sent!');
  }
}

function processAnnouncementQueue() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[ANNOUNCE] Processing announcement queue...');

    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCEMENT_QUEUE, []);
    if (queue.length === 0) {
      Logger.log('[ANNOUNCE] Queue is empty');
      return;
    }

    const batching = CONFIG.ANNOUNCEMENT.BATCHING_ENABLED !== false;
    const batchSize = CONFIG.ANNOUNCEMENT.BATCH_SIZE || 5;

    if (batching) {
      processBatchedAnnouncements_(queue, batchSize);
    } else {
      processIndividualAnnouncements_(queue);
    }

    // Clear queue after processing
    writeJsonProp_(CONFIG.PROPS.ANNOUNCEMENT_QUEUE, []);
    Logger.log('[ANNOUNCE] Queue cleared after processing');

  } catch (err) {
    logError_(err, 'processAnnouncementQueue', 'Announcement queue processing', 'CRITICAL');
  } finally {
    lock.releaseLock();
  }
}

function getActiveSubscriberEmails_() {
  const sh = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
  const data = getNonEmptyData_(sh, 3);

  return data
    .filter(r => r[0] === true) // Active column
    .map(r => String(r[1] || '').trim().toLowerCase()) // Email column
    .filter(email => email && email.includes('@'));
}

function generateAnnouncementPreview_() {
  const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCEMENT_QUEUE, []);

  if (queue.length === 0) return '(No announcements pending)';

  return queue
    .slice(0, 3)
    .map(a => `[${a.category}] ${a.message}`)
    .join('\n');
}

function processBatchedAnnouncements_(queue, batchSize) {
  const batches = [];

  for (let i = 0; i < queue.length; i += batchSize) {
    batches.push(queue.slice(i, i + batchSize));
  }

  Logger.log(`[ANNOUNCE] Processing ${batches.length} batches of announcements`);

  batches.forEach((batch, batchIdx) => {
    const subjects = batch.map(a => a.category).join(', ');
    const body = batch.map(a => `[${a.category}] ${a.message}`).join('\n\n');

    const emails = getActiveSubscriberEmails_();
    emails.forEach(email => {
      try {
        sendAnnouncementEmail_(email, `Movie Poster Updates: ${subjects}`, body);
      } catch (err) {
        Logger.log(`[WARN] Failed to send to ${email}: ${err.message}`);
      }
    });

    // Throttle between batches
    const throttleMs = CONFIG.ANNOUNCEMENT.THROTTLE_MS || 1000;
    Utilities.sleep(throttleMs);
  });
}

function processIndividualAnnouncements_(queue) {
  const emails = getActiveSubscriberEmails_();

  queue.forEach(announcement => {
    const body = `[${announcement.category}] ${announcement.message}`;

    emails.forEach(email => {
      try {
        sendAnnouncementEmail_(email, 'Movie Poster Update', body);
      } catch (err) {
        Logger.log(`[WARN] Failed to send to ${email}: ${err.message}`);
      }
    });

    const throttleMs = CONFIG.ANNOUNCEMENT.THROTTLE_MS || 1000;
    Utilities.sleep(throttleMs);
  });
}

function substituteVariables_(template, vars) {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(`{{${key}}}`, String(value || ''));
  });
  return result;
}

function formatPosterList_(posters) {
  return posters.map(p => `• ${p.title} (${p.release})`).join('\n');
}

function getStockInfo_() {
  const invSh = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(invSh, 11, 3);

  const info = {};
  data.forEach(r => {
    const title = r[COLS.INVENTORY.TITLE - 1];
    const stock = r[COLS.INVENTORY.STOCK - 1];
    if (title && stock) info[String(title).trim()] = stock;
  });

  return info;
}

function sendAnnouncementEmail_(recipientEmail, subject, body) {
  try {
    MailApp.sendEmail(recipientEmail, subject, body, {
      name: CONFIG.FORM_META.APP_NAME || 'Movie Poster System'
    });

    Logger.log(`[ANNOUNCE] Email sent to ${recipientEmail}`);
    logAnnouncementEvent_(recipientEmail, 'SENT', subject);

  } catch (err) {
    logError_(err, 'sendAnnouncementEmail_', `Sending to ${recipientEmail}`);
    logAnnouncementEvent_(recipientEmail, 'FAILED', subject);
    throw err;
  }
}

function logAnnouncementEvent_(recipient, status, details) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    sh.appendRow([
      fmtDate_(now_(), CONFIG.DATE_FORMAT),
      'ANNOUNCEMENT',
      status,
      `To: ${recipient} | ${details}`,
      ''
    ]);
  } catch (err) {
    Logger.log(`[WARN] Failed to log announcement event: ${err.message}`);
  }
}

function invalidateActiveSubscribers_() {
  clearCache_('subscribers');
}
