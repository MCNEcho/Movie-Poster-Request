/** 14_Documentation.js **/

function buildDocumentationTab() {
  const ss = SpreadsheetApp.getActive();
  const name = CONFIG.SHEETS.DOCUMENTATION;

  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  sh.clear({ contentsOnly: false });
  sh.setColumnWidths(1, 1, 900);
  sh.getRange(1, 1, sh.getMaxRows(), 1).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(1);

  let r = 1;

  r = writeDocTitle_(sh, r, 'Poster Request System — Documentation');
  r = writeDocPara_(sh, r, `Last updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')} (${CONFIG.TIMEZONE})`);
  r++;

  r = writeDocSection_(sh, r, 'Quick Summary', [
    'Employees request posters through a Google Form. Requests are first-come-first-serve.',
    `Employees can have up to ${CONFIG.MAX_ACTIVE} ACTIVE requests at a time (${CONFIG.MAX_ACTIVE}-slot system).`,
    'If a submission includes Remove + Add, removals are applied first (freeing slots), then adds are processed.',
    getDedupSummary_(),
    'Inventory counts are FYI only and never block requests.',
    'Remove list is intentionally short: only posters with at least one ACTIVE request by anyone.',
  ]);

  r = writeDocSection_(sh, r, 'Employee Guide', [
    'Open the Poster Request Form (QR code is on the Print Out tab).',
    'Your email address is automatically collected from your Google account.',
    'Enter your Name in the REQUIRED format: FirstName + LastInitial (ex: "Gavin N" or "Gavin N.").',
    'If the name format is wrong (ex: "Miles pratt" or just "Gavin"), the system will NOT save your requests.',
    'To request posters: check titles under "Request Posters (Add)" and submit.',
    'Optionally check "Subscribe to Notifications" to receive email announcements when new posters are added.',
    'To swap posters: select posters to remove AND posters to add in the same submission. Removals happen first.',
    `Check the Employees tab to see your ACTIVE posters and slot count (used/${CONFIG.MAX_ACTIVE}).`,
  ]);

  r = writeDocSection_(sh, r, 'System Rules', [
    `1. Maximum Active Requests: Each employee can have up to ${CONFIG.MAX_ACTIVE} ACTIVE posters at a time.`,
    '2. Request Order: Removals are processed FIRST, then additions. This frees slots for new posters.',
    getDedupRuleDescription_(),
    '4. Active Posters Only: Only posters with Active? = TRUE in Inventory sheet appear in the form.',
    '5. Remove List: Only shows posters the employee has ACTIVE requests for.',
    '6. Inventory is FYI: Inventory counts never block requests. Form always accepts requests regardless of stock.',
    '7. Name Format Required: Employees must enter "FirstName LastInitial" (e.g., "Gavin N"). Wrong format = submission rejected.',
    '8. Email Auto-Collected: Email comes from Google Account, not the form.',
    '9. Status Lifecycle: ACTIVE → REMOVED (when employee removes) or kept ACTIVE (ongoing).',
  ]);

  r = writeDocSection_(sh, r, 'Manager/Admin Guide', [
    'Inventory tab: controls what appears in Form Add list (Active? = TRUE) and tracks incoming counts.',
    'Poster IDs are internal and auto-generated (hidden column).',
    'To activate a poster: set Active? checkbox to TRUE in Inventory tab.',
    'To deactivate a poster: set Active? checkbox to FALSE to end requesting for that poster.',
    'Subscribers tab: checked emails receive announcements with FULL list of all new posters when they are activated.',
    'Print Out tab: print-friendly inventory list + QR codes (Form + Employees view).',
    'Display Management: Use Poster Outside and Poster Inside tabs to track poster locations in the theater.',
    'Tab Colors: Sheets are color-coded for easy navigation (check Documentation for color meanings).',
  ]);

  r = writeDocSection_(sh, r, 'Current Configuration', [
    `Max Active Requests Per Employee: ${CONFIG.MAX_ACTIVE}`,
    `Allow Re-requests After Removal: ${CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL ? 'YES' : 'NO'}`,
    `Re-request Cooldown Days: ${CONFIG.REREQUEST_COOLDOWN_DAYS} day${CONFIG.REREQUEST_COOLDOWN_DAYS === 1 ? '' : 's'}`,
    `Cache TTL: ${CONFIG.CACHE_TTL_MINUTES} minutes`,
    `Backup Retention: ${CONFIG.BACKUP.RETENTION_DAYS} days`,
    `Backup Format: ${CONFIG.BACKUP.FORMAT}`,
    `Announcement Behavior: Sends ALL pending posters in a single email (no batching)`,
    'Tab Colors: Color-coded sheets for easy navigation (Blue=Primary, Cyan=Display, Orange=Config, Yellow=Admin, Red=Errors, Green=Analytics)',
    'To change these settings, edit values in 00_Config.js and redeploy the script.',
  ]);

  r = writeDocSection_(sh, r, 'Admin Menu — Button Reference', [
    '⚙️ Run Setup / Repair: One-time initialization OR repair if system breaks. Creates sheets, form, triggers, and rebuilds everything.',
    '🔄 Refresh All: Updates everything (boards, form options, health info) in one click.',
    '↔️ Sync Form Options Now: Manually update form with current ACTIVE posters. Automatically runs after submissions.',
    '🔄 Rebuild Boards Now: Refresh Main and Employees tabs from Requests sheet. Clears old data and rebuilds from scratch.',
    '🔧 Update Print Out: Updates Print Out tab with current inventory and ACTIVE poster list (manual operation).',
    '📄 Refresh Documentation: Rebuilds this Documentation tab with latest system info.',
    '➕ Manually Add Request (for migration): Opens dialog to manually add historical requests (for data migration).',
    '🎬 Add New Poster: Opens dialog to add a new poster to Inventory with guided form.',
    '👁️ Preview Pending Announcement: Shows draft of email that will be sent with ALL pending posters.',
    '📧 Send Announcement Now: Sends announcement email with FULL list of all pending posters to subscribers immediately.',
    '🌐 Setup Employee View Spreadsheet: Creates a separate read-only spreadsheet for employees. One-time only.',
    '🔗 Sync Employee View Now: Manually copy current Main/Employees data to employee spreadsheet.',
    '📋 Show Employee View Link: Displays URL of employee-view spreadsheet (share this with employees).',
  ]);

  r = writeDocSection_(sh, r, 'System Health & Links', getSystemHealthSection_());

  r++;
  r = writeDocFormLink_(sh, r);

  r++;
  r = writeDocSection_(sh, r, 'Troubleshooting', [
    'Poster not in Add list: ensure Inventory Active? TRUE and Title + Release Date filled; then run Sync Form Options.',
    'No Remove options: only posters with ACTIVE requests appear there.',
    'Form submissions not logging: triggers may be missing—run setupPosterSystem or reset triggers.',
    'Formatting odd on boards: run Rebuild Boards Now.',
  ]);

  r = writeDocSection_(sh, r, 'Requests Sheet (Data) — Column Reference', [
    'Request Timestamp: When the form was submitted.',
    'Employee Email: Google account email (auto-collected).',
    'Employee Name: Name entered on form (must be "FirstName LastInitial").',
    'Poster ID: Internal unique ID (auto-generated).',
    'Poster Label (at request): What the poster was called when added.',
    'Movie Title (snapshot): Title of poster at request time.',
    'Release Date (snapshot): Release date at request time.',
    'Action Type: Always "ADD" (what was requested).',
    'Status: ACTIVE = current request, REMOVED = employee deleted it.',
    'Status Updated At: When status changed (when removed).',
  ]);

  sh.getRange(1, 1, r, 1).setFontFamily('Arial').setFontSize(11);
}

function writeDocTitle_(sh, r, text) {
  sh.getRange(r, 1).setValue(text)
    .setFontSize(16).setFontWeight('bold')
    .setBackground('#d9ead3')
    .setHorizontalAlignment('left');
  return r + 1;
}

function writeDocPara_(sh, r, text) {
  sh.getRange(r, 1).setValue(text).setFontColor('#444444');
  return r + 1;
}

function writeDocSection_(sh, r, title, bullets) {
  sh.getRange(r, 1).setValue(title)
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#cfe2f3');
  r++;

  const body = bullets.map(b => `• ${b}`).join('\n');
  sh.getRange(r, 1).setValue(body);
  r++;

  sh.getRange(r, 1).setValue('');
  return r + 1;
}

/**
 * Generate dedup summary text based on CONFIG settings
 */
function getDedupSummary_() {
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return 'Dedupe is permanent: an employee can request the same poster only once ever.';
  }
  
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    return `Re-requests allowed after removal with ${CONFIG.REREQUEST_COOLDOWN_DAYS}-day cooldown period.`;
  }
  
  return 'You can request the same poster again after removing it, with no waiting period.';
}

/**
 * Generate dedup rule description based on CONFIG settings
 */
function getDedupRuleDescription_() {
  if (!CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL) {
    return '3. Deduplication: An employee can request each poster ONE TIME EVER. Historical requests block future requests.';
  }
  
  if (CONFIG.REREQUEST_COOLDOWN_DAYS > 0) {
    return `3. Deduplication: Employees can re-request posters after removal. Cooldown period: ${CONFIG.REREQUEST_COOLDOWN_DAYS} day${CONFIG.REREQUEST_COOLDOWN_DAYS === 1 ? '' : 's'} after removal.`;
  }
  
  return '3. Deduplication: You can request the same poster again immediately after removing it. No waiting period.';
}

/**
 * Generate system health section for documentation
 */
function getSystemHealthSection_() {
  try {
    const health = collectHealthData_();
    
    if (!health || !health.triggers) {
      return [
        'System Health: Data loading...',
        'Click "Refresh Documentation" to refresh this section.'
      ];
    }
    
    const lines = [];
    
    // Triggers
    lines.push(`Triggers Installed: ${health.triggers.triggersInstalled || '?'} (${health.triggers.status || 'UNKNOWN'})`);
    if (health.triggers.details) {
      lines.push(`  • Form Submissions: ${health.triggers.details.formSubmit.installed ? '✅' : '❌'}`);
      lines.push(`  • Sheet Edits: ${health.triggers.details.sheetEdit.installed ? '✅' : '❌'}`);
      lines.push(`  • Announcements: ${health.triggers.details.announcementQueue.installed ? '✅' : '❌'}`);
    }
    
    // Cache
    if (health.cache) {
      lines.push(`Cache Health: ${health.cache.validCaches || '?'}/${health.cache.totalCaches || '?'} valid (${health.cache.status || 'UNKNOWN'})`);
    }
    
    // Errors
    if (health.lastError) {
      if (health.lastError.status === 'HEALTHY') {
        lines.push(`Last Error: None (✅ System clean)`);
      } else if (health.lastError.error && health.lastError.error.includes('Missing sheet')) {
        lines.push(`Last Error: Error Log sheet not yet created (will be created on first error)`);
      } else {
        lines.push(`Last Error: ${health.lastError.errorType || 'Unknown'} - ${health.lastError.message || 'No details'}`);
        if (health.lastError.ageInHours) {
          lines.push(`  Logged: ${health.lastError.ageInHours} hours ago`);
        }
        lines.push(`  Status: ${health.lastError.resolved ? 'Resolved' : 'UNRESOLVED'}`);
      }
    }
    
    // Queue
    if (health.queue) {
      lines.push(`Announcement Queue: ${health.queue.queueSize || '0'} item${(health.queue.queueSize || 0) !== 1 ? 's' : ''} pending`);
    }
    
    lines.push('');
    lines.push('Click "Refresh Documentation" from admin menu to update this section.');
    
    return lines;
  } catch (err) {
    return [
      `System Health: ${err.message}`,
      '(Health data will refresh after first operations)'
    ];
  }
}

/**
 * Write form edit link section
 */
function writeDocFormLink_(sh, r) {
  const formId = getEffectiveFormId_();
  
  if (!formId) {
    sh.getRange(r, 1).setValue('Form Link')
      .setFontSize(13).setFontWeight('bold')
      .setBackground('#cfe2f3');
    r++;
    sh.getRange(r, 1).setValue('Form not yet created. Run "Setup / Repair" to create it.');
    r++;
    sh.getRange(r, 1).setValue('');
    return r + 1;
  }
  
  const formUrl = `https://docs.google.com/forms/d/${formId}/edit`;
  
  sh.getRange(r, 1).setValue('Form Link')
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#cfe2f3');
  r++;
  
  const linkText = 'Click here to edit the Poster Request Form';
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(linkText)
    .setLinkUrl(0, linkText.length, formUrl)
    .build();
  
  sh.getRange(r, 1).setRichTextValue(richText);
  
  r++;
  
  sh.getRange(r, 1).setValue('');
  return r + 1;
}
