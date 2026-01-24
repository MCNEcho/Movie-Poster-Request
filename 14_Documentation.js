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
    '4. Active Posters Only: Only posters with Active? = TRUE in Movie Posters sheet appear in the form.',
    '5. Remove List: Only shows posters the employee has ACTIVE requests for.',
    '6. Inventory is FYI: Inventory counts never block requests. Form always accepts requests regardless of stock.',
    '7. Name Format Required: Employees must enter "FirstName LastInitial" (e.g., "Gavin N"). Wrong format = submission rejected.',
    '8. Email Auto-Collected: Email comes from Google Account, not the form.',
    '9. Status Lifecycle: ACTIVE → REMOVED (when employee removes) or kept ACTIVE (ongoing).',
  ]);

  r = writeDocSection_(sh, r, 'Manager/Admin Guide', [
    'Inventory tab: record incoming counts (FYI only).',
    'Movie Posters tab: controls what appears in Form Add list (Active? = TRUE).',
    'Poster IDs are internal and auto-generated (hidden).',
    'Close Queue: set Active? FALSE to end requesting for that poster.',
    'Subscribers tab: checked emails receive batched announcements every 15 minutes when new posters are activated.',
    'Print Out tab: print-friendly inventory list + QR codes (Form + Employees view).',
  ]);

  r = writeDocSection_(sh, r, 'Current Configuration', [
    `Max Active Requests Per Employee: ${CONFIG.MAX_ACTIVE}`,
    `Allow Re-requests After Removal: ${CONFIG.ALLOW_REREQUEST_AFTER_REMOVAL ? 'YES' : 'NO'}`,
    `Re-request Cooldown Days: ${CONFIG.REREQUEST_COOLDOWN_DAYS} day${CONFIG.REREQUEST_COOLDOWN_DAYS === 1 ? '' : 's'}`,
    `Cache TTL: ${CONFIG.CACHE_TTL_MINUTES} minutes`,
    `Backup Retention: ${CONFIG.BACKUP.RETENTION_DAYS} days`,
    `Backup Format: ${CONFIG.BACKUP.FORMAT}`,
    `Announcement Batch Size: ${CONFIG.ANNOUNCEMENT.BATCH_SIZE} posters per email`,
    'To change these settings, edit values in 00_Config.js and redeploy the script.',
  ]);

  r = writeDocSection_(sh, r, 'Admin Menu — Button Reference', [
    '🖨️ Prepare Print Area (Select & Print): Opens print layout and lets you select which area to print.',
    '⚙️ Run Setup / Repair: One-time initialization OR repair if system breaks. Creates sheets, form, triggers, and rebuilds everything.',
    '↔️ Sync Form Options Now: Manually update form with current ACTIVE posters. Automatically runs after submissions.',
    '🔄 Rebuild Boards Now: Refresh Main and Employees tabs from Requests sheet. Clears old data and rebuilds from scratch.',
    '🔧 Refresh Print Out: Updates Print Out tab with current inventory and ACTIVE poster list.',
    '📄 Refresh Documentation: Rebuilds this Documentation tab with latest system info.',
    '➕ Manually Add Request (for migration): Opens dialog to manually add historical requests (for data migration).',
    '👁️ Preview Pending Announcement: Shows draft of email that will be sent when Close Queue is checked.',
    '📧 Send Announcement Now: Manually trigger email announcement to all ACTIVE subscribers immediately.',
    '🌐 Setup Employee View Spreadsheet: Creates a separate read-only spreadsheet for employees. One-time only.',
    '🔗 Sync Employee View Now: Manually copy current Main/Employees data to employee spreadsheet.',
    '📋 Show Employee View Link: Displays URL of employee-view spreadsheet (share this with employees).',
  ]);

  r = writeDocSection_(sh, r, 'Troubleshooting', [
    'Poster not in Add list: ensure Movie Posters Active? TRUE and Title + Release Date filled; then run Sync Form Options.',
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
  
  return 'Re-requests allowed: employees can request a poster again after removing it.';
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
  
  return '3. Deduplication: Employees can re-request posters immediately after removing them. No historical blocking.';
}
