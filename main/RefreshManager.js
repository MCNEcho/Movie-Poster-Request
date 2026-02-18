/** RefreshManager.js **/

/**
 * Shows consolidated Refresh Manager dialog with all refresh operations
 */
function showRefreshManagerDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Google Sans', Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          h2 {
            color: #1a73e8;
            margin-top: 0;
          }
          .section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .section h3 {
            margin-top: 0;
            color: #5f6368;
            font-size: 14px;
          }
          .master-section {
            background: #e8f0fe;
            border: 2px solid #1a73e8;
          }
          button {
            background: #1a73e8;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            margin-top: 8px;
          }
          button:hover {
            background: #1557b0;
          }
          button:active {
            background: #0d47a1;
          }
          button.master {
            background: #0d7a3c;
            font-weight: bold;
            font-size: 16px;
            padding: 12px 20px;
          }
          button.master:hover {
            background: #0b6632;
          }
          .info {
            color: #5f6368;
            font-size: 12px;
            margin-top: 5px;
            line-height: 1.4;
          }
          .success {
            color: #0d7a3c;
            font-weight: bold;
          }
          .error {
            color: #d93025;
            font-weight: bold;
          }
          #status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            display: none;
          }
          .show-status {
            display: block !important;
          }
        </style>
      </head>
      <body>
        <h2>🔄 Refresh Manager</h2>
        
        <div class="section master-section">
          <h3>🌟 Refresh All Displays</h3>
          <button class="master" onclick="refreshAllDisplays()">Refresh Everything</button>
          <div class="info">
            Runs all refresh operations below in sequence:<br>
            • Rebuilds Main & Employees boards<br>
            • Updates Google Form dropdown options<br>
            • Refreshes Print Out layout & QR codes<br>
            • Updates Poster Outside display dropdowns<br>
            • Updates Poster Inside display dropdowns
          </div>
        </div>
        
        <div class="section">
          <h3>📊 Boards & Data</h3>
          
          <button onclick="refreshBoards()">Rebuild Boards</button>
          <div class="info">
            Regenerates Main Board (poster-centric) and Employees Board (employee-centric) from current request ledger. Use after adding/removing requests.
          </div>
          
          <button onclick="refreshFormOptions()">Sync Form Options</button>
          <div class="info">
            Updates Google Form dropdown with active posters from Inventory. Adds new posters, removes deactivated ones. Use after changing poster availability.
          </div>
        </div>
        
        <div class="section">
          <h3>🖨️ Print & Display Sheets</h3>
          
          <button onclick="refreshPrintOut()">Update Print Out</button>
          <div class="info">
            Regenerates print layout with QR codes (form link + employee view link) and current poster inventory. Use before printing physical copies.
          </div>
          
          <button onclick="refreshPosterOutside()">Update Poster Outside Dropdowns</button>
          <div class="info">
            Refreshes movie title dropdowns on Poster Outside tab (Yoke's Side & Dairy Queen Side). Use after adding new movies to inventory.
          </div>
          
          <button onclick="refreshPosterInside()">Update Poster Inside Dropdowns</button>
          <div class="info">
            Refreshes movie title dropdowns on Poster Inside tab (Video Games Wall & Box Wall). Use after adding new movies to inventory.
          </div>
        </div>
        
        <div id="status"></div>
        
        <script>
          function refreshAllDisplays() {
            showStatus('🔄 Running all refresh operations...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ All displays refreshed successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshAllDisplays();
          }
          
          function refreshBoards() {
            showStatus('Rebuilding boards...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Boards rebuilt successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .rebuildBoards();
          }
          
          function refreshFormOptions() {
            showStatus('Syncing form options...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Form options synced successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .syncFormOptions();
          }
          
          function refreshPrintOut() {
            showStatus('Updating Print Out...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Print Out updated successfully!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPrintOut();
          }
          
          function refreshPosterOutside() {
            showStatus('Updating Poster Outside dropdowns...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Outside dropdowns updated!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPosterOutside();
          }
          
          function refreshPosterInside() {
            showStatus('Updating Poster Inside dropdowns...', false);
            google.script.run
              .withSuccessHandler(function() {
                showStatus('✅ Poster Inside dropdowns updated!', true);
              })
              .withFailureHandler(function(err) {
                showStatus('❌ Error: ' + err.message, false);
              })
              .refreshPosterInside();
          }
          
          function showStatus(message, isSuccess) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = isSuccess ? 'show-status success' : 'show-status error';
          }
        </script>
      </body>
    </html>
  `;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(550)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Refresh Manager');
}

/**
 * Public wrapper - Executes all refresh operations in sequence (master refresh function)
 * Called from Refresh Manager dialog
 */
function refreshAllDisplays() {
  executeRefreshAll_();
}

/**
 * Public wrapper - Refreshes Poster Outside display dropdowns
 * Called from Refresh Manager dialog
 */
function refreshPosterOutside() {
  refreshPosterOutsideDropdowns_();
}

/**
 * Public wrapper - Refreshes Poster Inside display dropdowns
 * Called from Refresh Manager dialog
 */
function refreshPosterInside() {
  refreshPosterInsideDropdowns_();
}

/**
 * Public wrapper - Rebuild boards only
 * Called from Refresh Manager dialog
 */
function rebuildBoards() {
  rebuildBoards_();
}

/**
 * Public wrapper - Sync form options
 * Called from Refresh Manager dialog  
 */
function syncFormOptions() {
  syncPostersToForm();
}

/**
 * Public wrapper - Refresh Print Out only
 * Called from Refresh Manager dialog
 */
function refreshPrintOut() {
  if (typeof buildPrintOutLayout_ === 'function') {
    buildPrintOutLayout_();
  } else {
    // Fallback for module import scenarios
    SpreadsheetApp.getActiveSheet().toast('Print Out layout function not available', 'Error', 5);
  }
}

/**
 * Executes all refresh operations in sequence (master refresh function)
 */
function executeRefreshAll_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    
    // 1. Rebuild boards
    Logger.log('[executeRefreshAll_] Rebuilding boards...');
    ss.toast('⏳ Step 1/5: Rebuilding boards...', 'Refreshing All', -1);
    rebuildBoards_();
    ss.toast('✓ Boards rebuilt', 'Progress', 2);
    
    // 2. Sync form options
    Logger.log('[executeRefreshAll_] Syncing form options...');
    ss.toast('⏳ Step 2/5: Syncing form options...', 'Refreshing All', -1);
    try {
      syncPostersToForm();
      ss.toast('✓ Form synced', 'Progress', 2);
    } catch (err) {
      Logger.log(`[WARN] Form sync failed (access denied): ${err.message}`);
      ss.toast('⚠ Form sync skipped (access denied)', 'Progress', 3);
    }
    
    // 3. Refresh Print Out
    Logger.log('[executeRefreshAll_] Updating Print Out...');
    ss.toast('⏳ Step 3/5: Updating Print Out...', 'Refreshing All', -1);
    try {
      buildPrintOutLayout_();
      ss.toast('✓ Print Out updated', 'Progress', 2);
    } catch (err) {
      Logger.log(`[WARN] Print Out update failed: ${err.message}`);
      ss.toast('⚠ Print Out update skipped', 'Progress', 3);
    }
    
    // 4. Refresh Poster Outside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Outside...');
    ss.toast('⏳ Step 4/5: Updating Poster Outside...', 'Refreshing All', -1);
    refreshPosterOutsideDropdowns_();
    ss.toast('✓ Poster Outside updated', 'Progress', 2);
    
    // 5. Refresh Poster Inside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Inside...');
    ss.toast('⏳ Step 5/5: Updating Poster Inside...', 'Refreshing All', -1);
    refreshPosterInsideDropdowns_();
    
    Logger.log('[executeRefreshAll_] All refresh operations complete');
    ss.toast('✅ All displays refreshed successfully!', 'Refresh Complete', 5);
    
  } catch (err) {
    const ss = SpreadsheetApp.getActive();
    ss.toast('❌ Error during refresh: ' + err.message, 'Error', 5);
    logError_(err, 'executeRefreshAll_', 'Running all refresh operations');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Refreshes Poster Outside display dropdowns only
 */
function refreshPosterOutsideDropdowns_() {
  const ss = SpreadsheetApp.getActive();
  const outsideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_OUTSIDE);
  
  if (!outsideSheet) {
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside sheet not found');
    return;
  }
  
  try {
    setupMovieTitleDropdowns_(outsideSheet, 5, 1, 8);  // Yoke's Side
    setupMovieTitleDropdowns_(outsideSheet, 9, 1, 8);  // Dairy Queen Side
    updatePosterOutsideTimestamp_();
    
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside dropdowns updated');
  } catch (err) {
    Logger.log('[refreshPosterOutsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}

/**
 * Refreshes Poster Inside display dropdowns only
 */
function refreshPosterInsideDropdowns_() {
  const ss = SpreadsheetApp.getActive();
  const insideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_INSIDE);
  
  if (!insideSheet) {
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside sheet not found');
    return;
  }
  
  try {
    setupMovieTitleDropdowns_(insideSheet, 3, 1, 4);  // Video Games Wall Top
    setupMovieTitleDropdowns_(insideSheet, 4, 1, 4);  // Video Games Wall Bottom
    setupMovieTitleDropdowns_(insideSheet, 7, 1, 3);  // Box Wall
    updatePosterInsideTimestamp_();
    
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside dropdowns updated');
  } catch (err) {
    Logger.log('[refreshPosterInsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}

/**
 * Mark system needing refresh (called by background handlers like form submit)
 * Defers expensive rebuilds to Refresh Manager or time-triggered refresh
 */
function markSystemNeedingRefresh_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.PROPS.NEEDS_REFRESH, String(now_()));
  Logger.log('[markSystemNeedingRefresh_] System marked for deferred refresh at ' + now_());
}

/**
 * Check if refresh is needed and do it (called by time-triggered handler)
 * Returns true if refresh was performed, false if not needed
 */
function refreshIfNeeded_(force = false) {
  const props = PropertiesService.getScriptProperties();
  const refreshTs = props.getProperty(CONFIG.PROPS.NEEDS_REFRESH);
  
  if (!force && !refreshTs) {
    Logger.log('[refreshIfNeeded_] No refresh needed');
    return false;
  }
  
  if (force) {
    Logger.log('[refreshIfNeeded_] Force refresh requested');
  } else {
    Logger.log('[refreshIfNeeded_] Refresh needed (marked at ' + refreshTs + ') - executing');
  }
  
  try {
    rebuildBoards_();
    syncPostersToForm();
    props.deleteProperty(CONFIG.PROPS.NEEDS_REFRESH);
    Logger.log('[refreshIfNeeded_] Deferred refresh completed and cleared');
    return true;
  } catch (err) {
    logError_(err, 'refreshIfNeeded_', 'Deferred refresh');
    return false;
  }
}
