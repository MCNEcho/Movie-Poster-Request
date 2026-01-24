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

  if (pid && active && title && release) {
    queueAnnouncement_(pid, title, release);
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
