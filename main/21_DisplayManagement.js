/** 21_DisplayManagement.js **/

/**
 * Setup Poster Outside display sheet
 * Creates sheet with dropdowns populated from ACTIVE Inventory items
 */
function setupPosterOutside() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_OUTSIDE);
    
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.POSTER_OUTSIDE);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set up header
    sheet.getRange('A1').setValue('Poster Outside Display');
    sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
    
    // Add timestamp
    sheet.getRange('A2').setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
    sheet.getRange('A2').setFontSize(10).setFontColor('#666666');
    
    // Add dropdown header
    sheet.getRange('A4').setValue('Select Poster:');
    sheet.getRange('A4').setFontWeight('bold');
    
    // Create dropdown with ACTIVE Inventory items
    const activePosters = getActiveInventoryPosters_();
    if (activePosters.length > 0) {
      const posterTitles = activePosters.map(p => p.title);
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(posterTitles, true)
        .setAllowInvalid(false)
        .build();
      
      sheet.getRange('B4').setDataValidation(rule);
    }
    
    // Format the sheet
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 300);
    
    ss.toast('Poster Outside display setup complete!', 'Display Management', 5);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Setup Poster Inside display sheet
 * Creates sheet with dropdowns populated from ACTIVE Inventory items
 */
function setupPosterInside() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_INSIDE);
    
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.POSTER_INSIDE);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set up header
    sheet.getRange('A1').setValue('Poster Inside Display');
    sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
    
    // Add timestamp
    sheet.getRange('A2').setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
    sheet.getRange('A2').setFontSize(10).setFontColor('#666666');
    
    // Add dropdown header
    sheet.getRange('A4').setValue('Select Poster:');
    sheet.getRange('A4').setFontWeight('bold');
    
    // Create dropdown with ACTIVE Inventory items
    const activePosters = getActiveInventoryPosters_();
    if (activePosters.length > 0) {
      const posterTitles = activePosters.map(p => p.title);
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(posterTitles, true)
        .setAllowInvalid(false)
        .build();
      
      sheet.getRange('B4').setDataValidation(rule);
    }
    
    // Format the sheet
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 300);
    
    ss.toast('Poster Inside display setup complete!', 'Display Management', 5);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Refresh dropdowns in both Poster Outside and Poster Inside sheets
 * Updates dropdown lists to reflect current ACTIVE Inventory items
 */
function refreshDisplayDropdowns() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const outsideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_OUTSIDE);
    const insideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_INSIDE);
    
    // Get ACTIVE Inventory items
    const activePosters = getActiveInventoryPosters_();
    
    if (activePosters.length === 0) {
      ss.toast('No active posters found in Inventory.', 'Display Management', 5);
      return;
    }
    
    const posterTitles = activePosters.map(p => p.title);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(posterTitles, true)
      .setAllowInvalid(false)
      .build();
    
    // Update Poster Outside dropdown
    if (outsideSheet) {
      outsideSheet.getRange('B4').setDataValidation(rule);
      outsideSheet.getRange('A2').setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
    }
    
    // Update Poster Inside dropdown
    if (insideSheet) {
      insideSheet.getRange('B4').setDataValidation(rule);
      insideSheet.getRange('A2').setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
    }
    
    ss.toast(`Display dropdowns refreshed with ${activePosters.length} active poster(s).`, 'Display Management', 5);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get list of ACTIVE posters from Inventory
 * @returns {Array<{title: string, releaseDate: Date}>} Active posters
 */
function getActiveInventoryPosters_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, COL_COUNTS.INVENTORY);
  
  return data
    .filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true)
    .map(r => ({
      title: String(r[COLS.INVENTORY.TITLE - 1] || '').trim(),
      releaseDate: r[COLS.INVENTORY.RELEASE - 1]
    }))
    .filter(p => p.title) // Filter out empty titles
    .sort((a, b) => {
      // Sort by release date
      if (a.releaseDate instanceof Date && b.releaseDate instanceof Date) {
        return a.releaseDate - b.releaseDate;
      }
      return 0;
    });
}
