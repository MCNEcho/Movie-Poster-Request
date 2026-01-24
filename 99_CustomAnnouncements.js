/** 99_CustomAnnouncements.js **/

/**
 * Queue a custom announcement (subject + body) using prompts.
 * Supports tokens in body:
 *  - {{FORM_URL}}
 *  - {{EMPLOYEES_URL}}
 */
function queueCustomAnnouncement() {
  const ui = SpreadsheetApp.getUi();

  const subjectResp = ui.prompt(
    'Queue Custom Announcement',
    'Enter the email SUBJECT:',
    ui.ButtonSet.OK_CANCEL
  );
  if (subjectResp.getSelectedButton() !== ui.Button.OK) return;
  const subject = String(subjectResp.getResponseText() || '').trim();
  if (!subject) {
    ui.alert('Subject cannot be blank.');
    return;
  }

  const bodyResp = ui.prompt(
    'Queue Custom Announcement',
    'Enter the email BODY (you can use {{FORM_URL}} and {{EMPLOYEES_URL}}):',
    ui.ButtonSet.OK_CANCEL
  );
  if (bodyResp.getSelectedButton() !== ui.Button.OK) return;
  const body = String(bodyResp.getResponseText() || '').trim();
  if (!body) {
    ui.alert('Body cannot be blank.');
    return;
  }

  const queue = readJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
  queue.push({
    subject,
    body,
    createdAt: now_().toISOString(),
  });
  writeJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, queue);

  ui.alert('Queued! It will send on the next scheduled run (if enabled) or you can use "Send Custom Announcement Now".');
}

function previewCustomAnnouncementQueue() {
  const ui = SpreadsheetApp.getUi();
  const queue = readJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
  if (!queue.length) {
    ui.alert('No pending custom announcements.');
    return;
  }

  const lines = queue.map((m, i) => `${i + 1}. ${m.subject}`).join('\n');
  ui.alert('Pending Custom Announcements:\n\n' + lines);
}

/**
 * Sends all queued custom announcements in one batch run,
 * then clears the custom queue.
 */
function sendCustomAnnouncementNow() {
  processCustomAnnouncementQueue(true);
}

/**
 * Time-driven sender (optional).
 * If you add a trigger for this, it will send queued custom announcements automatically.
 */
function processCustomAnnouncementQueue(forceSend) {
  const queue = readJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
  if (!queue.length) return;

  const recipients = getActiveSubscriberEmails_();
  if (!recipients.length) return;

  const formUrl = getOrCreateForm_().getPublishedUrl();

  queue.forEach(msg => {
    const subject = String(msg.subject || '').trim();
    if (!subject) return;

    let body = String(msg.body || '');
    body = body.replaceAll('{{FORM_URL}}', formUrl);
    body = body.replaceAll('{{EMPLOYEES_URL}}', getEmployeeViewEmployeesUrl_());

    recipients.forEach(email => {
      MailApp.sendEmail(email, subject, body);
    });
  });

  // Clear queue after sending
  writeJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
}
