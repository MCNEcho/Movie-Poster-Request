/** 08_Announcements_And_Edit.gs **/

function handleSheetEdit(e) {
  try {
    const sh = e.range.getSheet();
    const name = sh.getName();

    if (name === CONFIG.SHEETS.INVENTORY) {
      updateInventoryLastUpdated_();
      syncInventoryCountsToMoviePosters_();
      refreshPrintOut();
      return;
    }

    if (name === CONFIG.SHEETS.MOVIE_POSTERS) {
      ensurePosterIds_();
      updateInventoryLastUpdated_();
      processMoviePostersEdit_(e);

      // Invalidate poster-related caches
      invalidateCachesAfterWrite_('poster');

      syncPostersToForm();
      rebuildBoards();
      refreshPrintOut();
      return;
    }
  } catch (error) {
    logError_(error, 'handleSheetEdit', `Sheet: ${e.range.getSheet().getName()}`, 'MEDIUM');
    console.error(`[handleSheetEdit] Error: ${error.message}`);
  }
}

function processMoviePostersEdit_(e) {
  const row = e.range.getRow();
  if (row < 2) return;

  const mp = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);
  const r = mp.getRange(row, 1, 1, 8).getValues()[0];

  const active = r[COLS.MOVIE_POSTERS.ACTIVE - 1] === true;
  const pid = String(r[COLS.MOVIE_POSTERS.POSTER_ID - 1] || '').trim();
  const title = String(r[COLS.MOVIE_POSTERS.TITLE - 1] || '').trim();
  const release = r[COLS.MOVIE_POSTERS.RELEASE - 1];
  const closeQueue = r[COLS.MOVIE_POSTERS.CLOSE_QUEUE - 1] === true;

  // Check if poster was effectively deleted (title is empty but poster ID exists)
  if (pid && !title) {
    Logger.log(`[processMoviePostersEdit_] Poster ${pid} appears to have been deleted, archiving requests`);
    const archivedCount = archiveRequestsForPoster_(pid);
    if (archivedCount > 0) {
      Logger.log(`[processMoviePostersEdit_] Archived ${archivedCount} requests for deleted poster ${pid}`);
      
      // Track analytics event for poster deletion
      logAnalyticsEvent_('poster_deleted', '', {
        poster_id: pid,
        requests_archived: archivedCount
      }, 0, true);
    }
    return;
  }

  if (pid && active && title && release) {
    queueAnnouncement_(pid, title, release);
    
    // Process announcement queue immediately (event-driven)
    processAnnouncementQueueEventDriven_();
  }
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
  SpreadsheetApp.getUi().alert(
    'Pending Announcement:\n\n' + ids.map((id, i) => `${i+1}. ${queue[id].title}`).join('\n')
  );
}

function sendAnnouncementNow() {
  // Force send by clearing the batch window check
  writeJsonProp_(CONFIG.PROPS.LAST_ANALYTICS_FLUSH, 0);
  processAnnouncementQueue(true);
}

function processAnnouncementQueue(forceSend) {
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    const recipients = getActiveSubscriberEmails_();
    if (recipients.length === 0) return;

    const formUrl = getOrCreateForm_().getPublishedUrl();
    const lines = ids.map((id, i) => `${i+1}. ${queue[id].title}`).join('\n');

    const subject = 'We Have Added More Posters to the Request Form!';
    const body = [
      'We Have Added More Posters to the Request Form!',
      '',
      lines,
      '',
      'Request here:',
      formUrl
    ].join('\n');

    recipients.forEach(email => MailApp.sendEmail(email, subject, body));

    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    ids.forEach(id => announced[id] = true);

    writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
    writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    
    // Track analytics
    trackAnnouncement_(recipients.length, ids.length, true);
  } catch (error) {
    logError_(error, 'processAnnouncementQueue', `Recipients: ${recipients ? recipients.length : 0}`, 'HIGH');
    trackAnnouncement_(0, 0, false);
    throw error;
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
 * Event-driven announcement processing with batching and exponential backoff.
 * Processes announcements immediately when posters are activated.
 * 
 * @returns {void}
 */
function processAnnouncementQueueEventDriven_() {
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const ids = Object.keys(queue);
    
    if (ids.length === 0) {
      Logger.log('[processAnnouncementQueueEventDriven] No announcements in queue');
      return;
    }

    // Check if we should batch announcements (if multiple posters activated in short time)
    const lastProcessTime = readJsonProp_(CONFIG.PROPS.LAST_ANALYTICS_FLUSH, 0);
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime;
    const batchWindowMs = 60000; // 1 minute batch window

    Logger.log(`[processAnnouncementQueueEventDriven] Queue has ${ids.length} items, time since last: ${timeSinceLastProcess}ms`);

    // If within batch window and fewer than 5 posters, wait for more
    if (timeSinceLastProcess < batchWindowMs && ids.length < 5) {
      Logger.log('[processAnnouncementQueueEventDriven] Batching - waiting for more posters');
      return;
    }

    const recipients = getActiveSubscriberEmails_();
    if (recipients.length === 0) {
      Logger.log('[processAnnouncementQueueEventDriven] No active subscribers');
      return;
    }

    // Send announcement with retry logic
    const success = retryWithBackoff_(() => {
      const formUrl = getOrCreateForm_().getPublishedUrl();
      const lines = ids.map((id, i) => `${i+1}. ${queue[id].title}`).join('\n');

      const subject = 'We Have Added More Posters to the Request Form!';
      const body = [
        'We Have Added More Posters to the Request Form!',
        '',
        lines,
        '',
        'Request here:',
        formUrl
      ].join('\n');

      recipients.forEach(email => MailApp.sendEmail(email, subject, body));
      return true;
    }, 3, 2000);

    if (success) {
      // Mark posters as announced
      const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
      ids.forEach(id => announced[id] = true);
      writeJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, announced);
      
      // Clear queue
      writeJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
      
      // Update last process time
      writeJsonProp_(CONFIG.PROPS.LAST_ANALYTICS_FLUSH, now);
      
      // Track analytics
      trackAnnouncement_(recipients.length, ids.length, true);
      
      Logger.log(`[processAnnouncementQueueEventDriven] Successfully sent announcements to ${recipients.length} recipients`);
    }
  } catch (error) {
    logError_(error, 'processAnnouncementQueueEventDriven', 'Event-driven announcement processing', 'HIGH');
    trackAnnouncement_(0, 0, false);
  }
}

