/** 22_PosterDisplays.js **/

/**
 * Display Management Module
 * Creates and manages "Poster Outside" and "Poster Inside" tabs with dynamic dropdowns
 * for tracking poster display locations in the theater
 */

/**
 * Creates or updates the Poster Outside tab
 * Layout: Last Updated row + Yoke's Side (8 slots) + Dairy Queen Side (8 slots)
 * Each slot has a status dropdown (Coming Soon / Now Showing) and movie title dropdown
 */
function setupPosterOutsideTab_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetName = 'Poster Outside';
    
    // Create or get sheet
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set column widths (all equal for poster slots)
    for (let col = 1; col <= 8; col++) {
      sheet.setColumnWidth(col, 150);
    }
    
    // ROW 1: Last Updated (merged A-H)
    sheet.getRange(1, 1, 1, 8).merge();
    sheet.getRange('A1')
      .setValue(`Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy HH:mm')}`)
      .setHorizontalAlignment('right')
      .setFontSize(10)
      .setFontColor('#666666');
    
    // ROW 3: Yoke's Side Header (merged A-H)
    sheet.getRange(3, 1, 1, 8).merge();
    sheet.getRange('A3')
      .setValue("Yoke's Side (Left)")
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');
    
    // ROW 4: Status dropdowns for Yoke's Side (A-H)
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Coming Soon', 'Now Showing'], true)
      .setAllowInvalid(false)
      .build();
    
    for (let col = 1; col <= 8; col++) {
      sheet.getRange(4, col)
        .setDataValidation(statusRule)
        .setValue('Coming Soon')
        .setHorizontalAlignment('center')
        .setFontSize(10)
        .setBackground('#e8f0fe');
    }
    
    // ROW 5: Movie title dropdowns for Yoke's Side (A-H)
    setupMovieTitleDropdowns_(sheet, 5, 1, 8);
    
    // ROW 6: Empty spacing
    sheet.setRowHeight(6, 30);
    
    // ROW 7: Dairy Queen Side Header (merged A-H)
    sheet.getRange(7, 1, 1, 8).merge();
    sheet.getRange('A7')
      .setValue('Dairy Queen Side (Right)')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#ea4335')
      .setFontColor('#ffffff');
    
    // ROW 8: Status dropdowns for Dairy Queen Side (A-H)
    for (let col = 1; col <= 8; col++) {
      sheet.getRange(8, col)
        .setDataValidation(statusRule)
        .setValue('Coming Soon')
        .setHorizontalAlignment('center')
        .setFontSize(10)
        .setBackground('#fce8e6');
    }
    
    // ROW 9: Movie title dropdowns for Dairy Queen Side (A-H)
    setupMovieTitleDropdowns_(sheet, 9, 1, 8);
    
    // Protect header rows from accidental edits (Last Updated, Yoke's Side, Dairy Queen Side)
    const protection1 = sheet.getRange('A1:H3').protect();
    protection1.setDescription('Header - Do not edit');
    protection1.setWarningOnly(true);
    
    const protection2 = sheet.getRange('A7:H7').protect();
    protection2.setDescription('Header - Do not edit');
    protection2.setWarningOnly(true);
    
    ss.toast('Poster Outside tab setup complete', 'Setup Complete', 3);
    return sheet;
  } catch (err) {
    logError_(err, 'setupPosterOutsideTab_', 'Setting up Poster Outside tab');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates or updates the Poster Inside tab
 * Layout: Last Updated row + Video Games Wall (2x4 grid) + Box Wall (1x3 grid)
 */
function setupPosterInsideTab_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const sheetName = 'Poster Inside';
    
    // Create or get sheet
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Clear existing content
    sheet.clear();
    
    // Set column widths
    for (let col = 1; col <= 4; col++) {
      sheet.setColumnWidth(col, 180);
    }
    
    // ROW 1: Last Updated (merged A-D)
    sheet.getRange(1, 1, 1, 4).merge();
    sheet.getRange('A1')
      .setValue(`Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy HH:mm')}`)
      .setHorizontalAlignment('right')
      .setFontSize(10)
      .setFontColor('#666666');
    
    // ROW 2: Video Games Wall Header (merged A-D)
    sheet.getRange(2, 1, 1, 4).merge();
    sheet.getRange('A2')
      .setValue('Video Games Wall')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#34a853')
      .setFontColor('#ffffff');
    
    // ROW 3: Top row of Video Games Wall (A-D)
    setupMovieTitleDropdowns_(sheet, 3, 1, 4);
    
    // ROW 4: Bottom row of Video Games Wall (A-D)
    setupMovieTitleDropdowns_(sheet, 4, 1, 4);
    
    // ROW 5: Empty spacing
    sheet.setRowHeight(5, 30);
    
    // ROW 6: Box Wall Header (merged A-C)
    sheet.getRange(6, 1, 1, 3).merge();
    sheet.getRange('A6')
      .setValue('Box Wall')
      .setHorizontalAlignment('center')
      .setFontSize(14)
      .setFontWeight('bold')
      .setBackground('#fbbc04')
      .setFontColor('#ffffff');
    
    // ROW 7: Box Wall posters (A-C)
    setupMovieTitleDropdowns_(sheet, 7, 1, 3);
    
    // Protect header rows (Last Updated, Video Games Wall, Box Wall)
    const protection1 = sheet.getRange('A1:D2').protect();
    protection1.setDescription('Header - Do not edit');
    protection1.setWarningOnly(true);
    
    const protection2 = sheet.getRange('A6:C6').protect();
    protection2.setDescription('Header - Do not edit');
    protection2.setWarningOnly(true);
    
    ss.toast('Poster Inside tab setup complete', 'Setup Complete', 3);
    return sheet;
  } catch (err) {
    logError_(err, 'setupPosterInsideTab_', 'Setting up Poster Inside tab');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper function to setup movie title dropdowns in a range
 * @param {Sheet} sheet - The sheet to add dropdowns to
 * @param {number} row - The row number
 * @param {number} startCol - Starting column (1-indexed)
 * @param {number} numCols - Number of columns to add dropdowns
 */
function setupMovieTitleDropdowns_(sheet, row, startCol, numCols) {
  try {
    // Get movie titles from Inventory tab
    const titles = getMovieTitlesFromInventory_();
    
    if (titles.length === 0) {
      titles.push('(No movies in inventory)');
    }
    
    const titleRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(titles, true)
      .setAllowInvalid(true) // Allow manual entry for flexibility
      .build();
    
    for (let col = startCol; col < startCol + numCols; col++) {
      const cell = sheet.getRange(row, col);
      const currentValue = cell.getValue();
      
      cell
        .setDataValidation(titleRule)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setFontSize(12)
        .setFontWeight('bold')
        .setWrap(true);
      
      // Only set default value if cell is empty
      if (!currentValue) {
        cell.setValue(titles[0] || '');
      }
    }
    
    // Make poster title cells taller (150 units)
    sheet.setRowHeight(row, 150);
  } catch (err) {
    Logger.log(`[setupMovieTitleDropdowns_] Error: ${err.message}`);
    throw err;
  }
}

/**
 * Get all movie titles from Inventory tab, sorted by release date (newest first)
 * @returns {Array<string>} Array of unique movie titles
 */
function getMovieTitlesFromInventory_() {
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const data = getNonEmptyData_(inv, 8);  // Inventory has 8 columns
    
    // Get all titles, sorted by release date
    const titles = data
      .sort((a, b) => {
        const dateA = new Date(a[COLS.INVENTORY.RELEASE - 1]);
        const dateB = new Date(b[COLS.INVENTORY.RELEASE - 1]);
        return dateB - dateA; // Newest first
      })
      .map(r => String(r[COLS.INVENTORY.TITLE - 1] || '').trim())
      .filter(Boolean);
    
    return [...new Set(titles)]; // Remove duplicates
  } catch (err) {
    Logger.log(`[getMovieTitlesFromInventory_] Error: ${err.message}`);
    return [];
  }
}

/**
 * Update the Last Updated timestamp on Poster Outside tab
 */
function updatePosterOutsideTimestamp_() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Poster Outside');
    if (!sheet) return;
    
    sheet.getRange('A1').setValue(
      `Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy HH:mm')}`
    );
  } catch (err) {
    Logger.log(`[updatePosterOutsideTimestamp_] Error: ${err.message}`);
  }
}

/**
 * Update the Last Updated timestamp on Poster Inside tab
 */
function updatePosterInsideTimestamp_() {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName('Poster Inside');
    if (!sheet) return;
    
    sheet.getRange('A1').setValue(
      `Last Updated: ${fmtDate_(now_(), 'MM/dd/yyyy HH:mm')}`
    );
  } catch (err) {
    Logger.log(`[updatePosterInsideTimestamp_] Error: ${err.message}`);
  }
}

/**
 * Refresh all display tab dropdowns when Inventory changes
 * This function updates dropdowns on both Poster Outside and Poster Inside tabs
 */
function refreshDisplayDropdowns_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    
    // Refresh Poster Outside
    const outsideSheet = ss.getSheetByName('Poster Outside');
    if (outsideSheet) {
      setupMovieTitleDropdowns_(outsideSheet, 5, 1, 8);  // Yoke's Side
      setupMovieTitleDropdowns_(outsideSheet, 9, 1, 8);  // Dairy Queen Side
      updatePosterOutsideTimestamp_();
    }
    
    // Refresh Poster Inside
    const insideSheet = ss.getSheetByName('Poster Inside');
    if (insideSheet) {
      setupMovieTitleDropdowns_(insideSheet, 3, 1, 4);  // Video Games Wall Top
      setupMovieTitleDropdowns_(insideSheet, 4, 1, 4);  // Video Games Wall Bottom
      setupMovieTitleDropdowns_(insideSheet, 7, 1, 3);  // Box Wall
      updatePosterInsideTimestamp_();
    }
    
    ss.toast('Display dropdowns refreshed successfully', 'Refresh Complete', 3);
  } catch (err) {
    logError_(err, 'refreshDisplayDropdowns_', 'Refreshing display dropdowns');
    SpreadsheetApp.getActive().toast('Error refreshing dropdowns', 'Error', 5);
  } finally {
    lock.releaseLock();
  }
}
