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

  r = writeDocSection_(sh, r, '🚀 Quick Start', [
    '1. Run Setup: Click "Run Setup / Repair" from the Poster Request System menu (top menu bar).',
    '2. Add Posters: Use "Add New Poster" from the menu to add posters to the Inventory tab.',
    '3. Activate Posters: Check the "Active?" box in the Inventory tab for posters that should appear in the form.',
    '4. Share Form: Get the form link from Print Out and share with employees.',
  ]);

  r++;
  r = writeDocFormLink_(sh, r);

  r++;
  r = writeDocSection_(sh, r, '⚠️ Authorization', [
    'Make sure to authorize the script: Extensions → Apps Script → Run any function → Allow permissions.',
    'If authorization errors occur, ensure ALL logged-in Google accounts are authorized.',
    'Verify you have Editor permissions on this spreadsheet.',
  ]);

  r++;
  r = writeDocSection_(sh, r, '❓ Need Help?', [
    'If you are having issues with anything, contact Gavin.',
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
