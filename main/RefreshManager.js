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
              .syncPostersToForm();
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
 * Executes all refresh operations in sequence (master refresh function)
 */
function executeRefreshAll_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    
    // 1. Rebuild boards
    Logger.log('[executeRefreshAll_] Rebuilding boards...');
    rebuildBoards();
    Logger.log('[executeRefreshAll_] Boards rebuilt');
    
    // 2. Sync form options
    Logger.log('[executeRefreshAll_] Syncing form options...');
    try {
      syncPostersToForm();
      Logger.log('[executeRefreshAll_] Form synced');
    } catch (err) {
      Logger.log(`[WARN] Form sync failed (access denied): ${err.message}`);
    }
    
    // 3. Refresh Print Out
    Logger.log('[executeRefreshAll_] Updating Print Out...');
    try {
      buildPrintOutLayout_();
      Logger.log('[executeRefreshAll_] Print Out updated');
    } catch (err) {
      Logger.log(`[WARN] Print Out update failed: ${err.message}`);
    }
    
    // 4. Refresh Poster Outside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Outside...');
    refreshPosterOutsideDropdowns_();
    Logger.log('[executeRefreshAll_] Poster Outside updated');
    
    // 5. Refresh Poster Inside dropdowns
    Logger.log('[executeRefreshAll_] Updating Poster Inside...');
    refreshPosterInsideDropdowns_();
    
    Logger.log('[executeRefreshAll_] All refresh operations complete');
    
  } catch (err) {
    Logger.log(`[executeRefreshAll_] Error: ${err.message}`);
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
  const outsideSheet = ss.getSheetByName('Poster Outside');
  
  if (!outsideSheet) {
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside sheet not found');
    return;
  }
  
  try {
    Logger.log('[refreshPosterOutsideDropdowns_] Updating Poster Outside dropdowns...');
    
    // Performance Optimization: Cache inventory read for all dropdowns
    const titles = getMovieTitlesFromInventory_();
    setupMovieTitleDropdowns_(outsideSheet, 5, 1, 8, titles);  // Yoke's Side
    setupMovieTitleDropdowns_(outsideSheet, 9, 1, 8, titles);  // Dairy Queen Side
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
  const insideSheet = ss.getSheetByName('Poster Inside');
  
  if (!insideSheet) {
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside sheet not found');
    return;
  }
  
  try {
    Logger.log('[refreshPosterInsideDropdowns_] Updating Poster Inside dropdowns...');
    
    // Performance Optimization: Cache inventory read for all dropdowns
    const titles = getMovieTitlesFromInventory_();
    setupMovieTitleDropdowns_(insideSheet, 3, 1, 4, titles);  // Video Games Wall Top
    setupMovieTitleDropdowns_(insideSheet, 4, 1, 4, titles);  // Video Games Wall Bottom
    setupMovieTitleDropdowns_(insideSheet, 7, 1, 3, titles);  // Box Wall
    updatePosterInsideTimestamp_();
    
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside dropdowns updated');
  } catch (err) {
    Logger.log('[refreshPosterInsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}
/**
 * DEFERRED REFRESH ARCHITECTURE (Performance Optimization)
 * Marks the system as needing a refresh without blocking current operation
 * Actual refresh executes via time-based trigger (every 1-5 minutes)
 */
function markSystemNeedingRefresh_() {
  try {
    const props = getProps_();
    props.setProperty(CONFIG.PROPS.NEEDS_REFRESH, 'true');
    Logger.log('[markSystemNeedingRefresh_] System marked for deferred refresh');
  } catch (err) {
    Logger.log(`[WARN] Failed to mark system for refresh: ${err.message}`);
    // Don't throw - deferred refresh failure should not block operations
  }
}

/**
 * Executes deferred refresh if system is marked as needing it
 * Called by time-based trigger (every 1-5 minutes)
 * Performance: Non-blocking for form submissions and admin operations
 */
function executeDeferredRefresh() {
  const lock = LockService.getScriptLock();
  
  // Try to get lock but don't wait - if another process is running, skip this cycle
  if (!lock.tryLock(1000)) {
    Logger.log('[executeDeferredRefresh] Locked by another process, skipping this cycle');
    return;
  }
  
  try {
    const props = getProps_();
    const needsRefresh = props.getProperty(CONFIG.PROPS.NEEDS_REFRESH);
    
    if (needsRefresh === 'true') {
      Logger.log('[executeDeferredRefresh] Executing deferred refresh...');
      
      // Clear flag BEFORE refresh to prevent duplicate execution
      props.deleteProperty(CONFIG.PROPS.NEEDS_REFRESH);
      
      // Execute full refresh
      executeRefreshAll_();
      
      Logger.log('[executeDeferredRefresh] Deferred refresh complete');
    } else {
      Logger.log('[executeDeferredRefresh] No refresh needed, skipping');
    }
  } catch (err) {
    logError_(err, 'executeDeferredRefresh', 'Executing deferred system refresh');
  } finally {
    lock.releaseLock();
  }
}