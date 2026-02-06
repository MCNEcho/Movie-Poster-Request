/** Documentation.js **/

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
  r = writeDocPara_(sh, r, `Last updated: ${fmtDate_(now_(), 'yyyy-MM-dd hh:mm:ss a')} (${CONFIG.TIMEZONE})`);
  r++;

  r = writeDocSection_(sh, r, '🚀 Quick Start Guide', [
    '1. AUTHORIZE THE SCRIPT: Extensions → Apps Script → Run any function → Click "Review Permissions" → Allow access.',
    '2. VERIFY ACCOUNT: If receiving "access denied" errors, make sure you are authorized on ALL signed-in Google accounts.',
    '3. CHECK PERMISSIONS: Ensure your account has Editor permissions on this spreadsheet.',
    '4. RUN SETUP: Click "Run Setup / Repair" from the Poster Request System menu (top menu bar). THIS IS ONLY NEEDED ONCE FOR INITIALIZATION.',
    '5. ADD POSTERS: Use "Add New Poster" from the admin menu to add posters to the Inventory tab.',
    '6. ACTIVATE POSTERS: Check the "Active?" checkbox in the Inventory tab for posters that should appear in the form.',
    '7. SHARE FORM: Get the form link from Print Out tab (QR code provided) and share with employees.',
    '8. MONITOR REQUESTS: Check Main and Employees tabs to see active requests.',
    'Need help? Contact Gavin if you encounter issues.',
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

  r = writeDocSection_(sh, r, 'Manager/Admin Guide', [
    '📋 INVENTORY MANAGEMENT:',
    '  • Inventory tab controls what appears in Form Add list (Active? = TRUE) and tracks incoming counts.',
    '  • Poster IDs are internal and auto-generated (hidden column).',
    '  • To activate a poster: set Active? checkbox to TRUE in Inventory tab.',
    '  • To deactivate a poster: set Active? checkbox to FALSE to stop requests.',
    '',
    '📧 ANNOUNCEMENTS:',
    '  • Subscribers tab: checked emails receive announcements when new posters are activated.',
    '  • Use "Preview Pending Announcement" to see draft email before sending.',
    '  • Use "Send Announcement Now" to notify subscribers of new posters.',
    '',
    '🖨️ PRINTING & DISPLAYS:',
    '  • Print Out tab: print-friendly inventory list + QR codes (Form + Employees view).',
    '  • Display Management: Use Poster Outside and Poster Inside tabs to track poster locations.',
    '  • Use "Update Print Out" to refresh the print layout with current data.',
    '',
    '👥 EMPLOYEE VIEW:',
    '  • Setup Employee View: Creates a separate read-only spreadsheet for employees to view boards.',
    '  • Sync Employee View: Updates the employee spreadsheet with current Main/Employees data.',
    '  • Share the Employee View URL with employees for read-only access to request boards.',
    '  • IMPORTANT: Master account must share Employee View spreadsheet with Editor permissions for other admins to sync.',
    '',
    '🎨 TAB COLORS:',
    '  • Blue = Primary data (Main, Employees, Inventory)',
    '  • Cyan = Display management (Poster Outside/Inside)',
    '  • Orange = Configuration (Requests, Analytics)',
    '  • Yellow = Admin tools (Print Out, Documentation)',
    '  • Red = Error tracking',
    '  • Green = Analytics & Reports',
  ]);

  r = writeDocSection_(sh, r, 'Admin Menu — Button Reference', [
    '⚙️ Run Setup / Repair: One-time initialization OR repair if system breaks. Creates sheets, form, triggers, and rebuilds everything.',
    '',
    '📊 REPORTS:',
    '  • Rebuild Main Board: Refresh Main tab showing requests grouped by poster.',
    '  • Rebuild Employees Board: Refresh Employees tab showing requests grouped by employee.',
    '  • Rebuild Both Boards: Updates both Main and Employees tabs from Requests sheet.',
    '  • Show Form Published Link: Displays the public form URL for sharing.',
    '  • Refresh Documentation: Rebuilds this Documentation tab with latest system info.',
    '',
    '🖨️ PRINT & LAYOUT:',
    '  • Print Out & Select Area: Opens print-friendly layout and sets print area.',
    '',
    '📺 DISPLAY MANAGEMENT:',
    '  • Manage Poster Displays: Opens dialog to refresh Poster Outside/Inside dropdown lists.',
    '',
    '📧 ANNOUNCEMENTS:',
    '  • Preview Pending: Shows draft of email announcement with all pending posters.',
    '  • Send Announcement: Sends announcement email to subscribers immediately.',
    '  • Custom Announcement: Send a custom message to all subscribers.',
    '',
    '⚙️ ADVANCED:',
    '  • Run Backup Now: Manually creates a backup of the Requests sheet.',
    '  • Manage Employee View: Opens dialog to setup/sync/view employee-facing spreadsheet.',
    '',
    '🔄 REFRESH MANAGER:',
    '  • Opens dialog with individual refresh operations:',
    '    - Refresh Everything (master button)',
    '    - Rebuild boards',
    '    - Sync form options',
    '    - Update print layout',
    '    - Refresh display dropdowns (Outside/Inside)',
  ]);

  r++;
  r = writeDocFormLink_(sh, r);

  r++;
  r = writeDocSection_(sh, r, '🛠️ Troubleshooting', [
    '❌ COMMON ISSUES:',
    '',
    '1. "Access Denied" or "Permission Denied" Errors:',
    '   • Make sure you have authorized the script: Extensions → Apps Script → Run any function → Allow permissions.',
    '   • Check that you are signed into the correct Google account.',
    '   • If multiple Google accounts are signed in, authorize ALL of them.',
    '   • Verify you have Editor permissions on this spreadsheet.',
    '   • For Employee View sync errors: Master account must share Employee View spreadsheet with Editor permissions.',
    '',
    '2. Poster Not Appearing in Form Add List:',
    '   • Ensure "Active?" checkbox is TRUE in Inventory tab.',
    '   • Verify Title and Release Date are filled in.',
    '   • Run "Sync Form Options Now" from admin menu or Refresh Manager.',
    '',
    '3. No Remove Options in Form:',
    '   • Remove list only shows posters the employee currently has ACTIVE.',
    '   • If employee has no active requests, remove list will be empty.',
    '',
    '4. Form Submissions Not Logging:',
    '   • Triggers may be missing—run "Run Setup / Repair" from admin menu.',
    '   • Check Extensions → Apps Script → Triggers to verify they exist.',
    '',
    '5. Boards Show Old/Incorrect Data:',
    '   • Run "Rebuild Both Boards" from admin menu.',
    '   • Or use "Refresh Everything" from Refresh Manager.',
    '',
    '6. Employee View Not Updating:',
    '   • Non-master accounts need Editor permissions on the Employee View spreadsheet.',
    '   • Master account: Open Employee View in Google Drive → Share → Add emails with Editor access.',
    '   • Run "Sync Employee View" from Manage Employee View dialog.',
    '',
    '7. Announcements Not Sending:',
    '   • Check that subscribers are listed in Subscribers tab.',
    '   • Verify email addresses are correct.',
    '   • Run "Preview Pending Announcement" to see what will be sent.',
    '',
    '8. Print Out QR Codes Not Working:',
    '   • QR codes are generated from cached URLs.',
    '   • If form/employee view was recreated, run "Run Setup / Repair" to refresh links.',
    '',
    '⚠️ STILL HAVING ISSUES?',
    'CONTACT GAVIN if you cannot resolve the problem using the steps above.',
    'Provide details: What were you trying to do? What error message did you see? Which account are you using?',
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
