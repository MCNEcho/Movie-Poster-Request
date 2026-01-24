/** 18_CustomAnnouncements.js **/

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

/**
 * Sends all queued custom announcements in one batch run,
 * then clears the custom queue.
 */
function sendCustomAnnouncementNow() {
  processCustomAnnouncementQueue(true);
}

/**
 * Preview custom announcements with template rendering
 */
function previewCustomAnnouncementQueue() {
  const ui = SpreadsheetApp.getUi();
  const queue = readJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
  if (!queue.length) {
    ui.alert('No pending custom announcements.');
    return;
  }

  const recipients = getActiveSubscriberEmails_();
  const formUrl = getOrCreateForm_().getPublishedUrl();
  
  // Generate preview with variable substitution
  const previews = queue.map((msg, i) => {
    let subject = String(msg.subject || '').trim();
    let body = String(msg.body || '');
    
    // Substitute variables
    body = substituteCustomVariables_(body, formUrl);
    
    return `${i + 1}. Subject: ${subject}\n   Preview:\n   ${body.substring(0, 100)}...`;
  }).join('\n\n');
  
  ui.alert(`Pending Custom Announcements (${recipients.length} recipients):\n\n${previews}`);
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

  try {
    queue.forEach((msg, index) => {
      const subject = String(msg.subject || '').trim();
      if (!subject) return;

      let body = substituteCustomVariables_(String(msg.body || ''), formUrl);

      // Send with retry and throttling
      recipients.forEach(email => {
        try {
          retryWithBackoff_(
            () => MailApp.sendEmail(email, subject, body),
            CONFIG.ANNOUNCEMENT.RETRY_ATTEMPTS,
            CONFIG.ANNOUNCEMENT.RETRY_INITIAL_DELAY_MS
          );
        } catch (err) {
          logError_(err, 'processCustomAnnouncementQueue', {
            recipient: email,
            subject: subject
          });
        }
      });
      
      // Throttle between messages
      if (index < queue.length - 1) {
        Utilities.sleep(CONFIG.ANNOUNCEMENT.THROTTLE_DELAY_MS);
      }
    });

    // Log event
    logAnnouncementEvent_(queue.length, recipients.length, 'CUSTOM_SUCCESS');
    
    // Clear queue after sending
    writeJsonProp_(CONFIG.PROPS.CUSTOM_ANNOUNCE_QUEUE, []);
  } catch (err) {
    logError_(err, 'processCustomAnnouncementQueue', { queueSize: queue.length });
    throw err;
  }
}

/**
 * Substitute custom announcement variables
 * @param {string} body - Template body
 * @param {string} formUrl - Form URL
 * @returns {string} Substituted body
 */
function substituteCustomVariables_(body, formUrl) {
  let result = body;
  result = result.replaceAll('{{FORM_URL}}', formUrl);
  result = result.replaceAll('{{EMPLOYEES_URL}}', getEmployeeViewEmployeesUrl_());
  
  // Also support FORM_LINK for consistency with regular announcements
  result = result.replaceAll('{{FORM_LINK}}', formUrl);
  
  return result;
}
