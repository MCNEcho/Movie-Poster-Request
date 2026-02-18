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
          <h3>📊 Rebuild Main & Employees Boards</h3>
          <div class="info">
            Refreshes request data and updates employee view. Does NOT update form options.
          </div>
          <button onclick="runRefresh('rebuildBoards')">Rebuild Boards</button>
        </div>

        <div class="section">
          <h3>📋 Sync Form Options</h3>
          <div class="info">
            Updates Google Form dropdown options to match current Inventory. Only needed after adding/removing posters.
          </div>
          <button onclick="runRefresh('syncPostersToForm')">Sync Form Options</button>
        </div>

        <div class="section">
          <h3>🖨️ Refresh Print Out</h3>
          <div class="info">
            Regenerates Print Out layout, inventory counts, and QR codes. Use this if posters or requests were manually edited.
          </div>
          <button onclick="runRefresh('refreshPrintOut')">Refresh Print Out</button>
        </div>

        <div class="section">
          <h3>🎬 Refresh Poster Outside</h3>
          <div class="info">
            Updates the Poster Outside display dropdowns. Run if form options were just updated.
          </div>
          <button onclick="runRefresh('refreshPosterOutsideDropdowns')">Refresh Poster Outside</button>
        </div>

        <div class="section">
          <h3>🎨 Refresh Poster Inside</h3>
          <div class="info">
            Updates the Poster Inside display dropdowns. Run if form options were just updated.
          </div>
          <button onclick="runRefresh('refreshPosterInsideDropdowns')">Refresh Poster Inside</button>
        </div>

        <div id="status"></div>

        <script>
          function runRefresh(op) {
            const statusEl = document.getElementById('status');
            statusEl.innerHTML = '<p>Starting ' + op + '...</p>';
            statusEl.className = 'show-status';
            google.script.run
              .withSuccessHandler(function() {
                statusEl.innerHTML = '<p class="success">✅ Complete!</p>';
                setTimeout(() => statusEl.className = '', 2000);
              })
              .withFailureHandler(function(err) {
                statusEl.innerHTML = '<p class="error">❌ Error: ' + err + '</p>';
              })
              [op]();
          }

          function refreshAllDisplays() {
            const statusEl = document.getElementById('status');
            statusEl.innerHTML = '<p>Running all refreshes...</p>';
            statusEl.className = 'show-status';
            google.script.run
              .withSuccessHandler(function() {
                statusEl.innerHTML = '<p class="success">✅ All refreshes complete!</p>';
                setTimeout(() => statusEl.className = '', 2000);
              })
              .withFailureHandler(function(err) {
                statusEl.innerHTML = '<p class="error">❌ Error: ' + err + '</p>';
              })
              .refreshAllDisplays_();
          }
        </script>
      </body>
    </html>
  `;
  
  const ui = SpreadsheetApp.getUi();
  ui.showModelessDialog(HtmlService.createHtmlOutput(html), '🔄 Refresh Manager');
}

/**
 * All-in-one refresh function called from dialog
 */
function refreshAllDisplays_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('🔄 Running all refreshes...', 'In Progress', -1);
    Logger.log('[refreshAllDisplays_] Starting comprehensive refresh');

    rebuildBoards();
    Logger.log('[refreshAllDisplays_] Boards rebuilt');

    syncPostersToForm();
    Logger.log('[refreshAllDisplays_] Form synced');

    refreshPrintOut();
    Logger.log('[refreshAllDisplays_] Print Out refreshed');

    refreshPosterOutsideDropdowns_();
    Logger.log('[refreshAllDisplays_] Poster Outside refreshed');

    refreshPosterInsideDropdowns_();
    Logger.log('[refreshAllDisplays_] Poster Inside refreshed');

    ss.toast('✅ All displays refreshed successfully', 'Complete', 3);
    Logger.log('[refreshAllDisplays_] All refreshes completed');
  } catch (err) {
    ss.toast('❌ Error during refresh: ' + err.message, 'Error', 5);
    logError_(err, 'refreshAllDisplays_', 'Comprehensive refresh');
  }
}

function rebuildBoards() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('Rebuilding boards...', 'In Progress', 3);
    const oldMain = ss.getSheetByName(CONFIG.SHEETS.MAIN);
    const oldEmps = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);

    const main = getSheet_(CONFIG.SHEETS.MAIN);
    const empSheet = getSheet_(CONFIG.SHEETS.EMPLOYEES);
    
    global.rebuildBoards();
  } catch (err) {
    ss.toast('❌ Error rebuilding boards: ' + err.message, 'Error', 5);
    logError_(err, 'rebuildBoards', 'Rebuild via Refresh Manager');
  }
}

function syncPostersToForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('Syncing form options...', 'In Progress', 3);
    global.syncPostersToForm();
  } catch (err) {
    ss.toast('❌ Error syncing form: ' + err.message, 'Error', 5);
    logError_(err, 'syncPostersToForm', 'Sync via Refresh Manager');
  }
}

function refreshPrintOut() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('Refreshing Print Out...', 'In Progress', 3);
    global.rebuildPrintOutLayout();
  } catch (err) {
    ss.toast('❌ Error refreshing Print Out: ' + err.message, 'Error', 5);
    logError_(err, 'refreshPrintOut', 'Print Out refresh via Refresh Manager');
  }
}

function refreshPosterOutsideDropdowns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('Updating Poster Outside dropdowns...', 'In Progress', 3);

    const outsideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_OUTSIDE);
    if (!outsideSheet) {
      Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside sheet not found - skipping');
      return;
    }

    const posters = getPostersWithLabels_();
    const list = posters.map(p => p.title);

    setupMovieTitleDropdowns_(outsideSheet, 1, 1, 4);  // Movie Posters Wall

    updatePosterOutsideTimestamp_();

    ss.toast('✅ Poster Outside dropdowns updated successfully!', 'Complete', 3);
    Logger.log('[refreshPosterOutsideDropdowns_] Poster Outside dropdowns updated');
  } catch (err) {
    ss.toast('❌ Error updating Poster Outside: ' + err.message, 'Error', 5);
    Logger.log('[refreshPosterOutsideDropdowns_] Error: ' + err.message);
    throw err;
  }
}

function refreshPosterInsideDropdowns_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    ss.toast('Updating Poster Inside dropdowns...', 'In Progress', 3);

    const insideSheet = ss.getSheetByName(CONFIG.SHEETS.POSTER_INSIDE);
    if (!insideSheet) {
      Logger.log('[refreshPosterInsideDropdowns_] Poster Inside sheet not found - skipping');
      return;
    }

    setupMovieTitleDropdowns_(insideSheet, 1, 1, 4);  // Hallway Wall Top
    setupMovieTitleDropdowns_(insideSheet, 2, 1, 4);  // Hallway Wall Bottom
    setupMovieTitleDropdowns_(insideSheet, 3, 1, 4);  // Video Games Wall Top
    setupMovieTitleDropdowns_(insideSheet, 4, 1, 4);  // Video Games Wall Bottom
    setupMovieTitleDropdowns_(insideSheet, 7, 1, 3);  // Box Wall
    updatePosterInsideTimestamp_();
    
    ss.toast('✅ Poster Inside dropdowns updated successfully!', 'Complete', 3);
    Logger.log('[refreshPosterInsideDropdowns_] Poster Inside dropdowns updated');
  } catch (err) {
    ss.toast('❌ Error updating Poster Inside: ' + err.message, 'Error', 5);
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
    rebuildBoards();
    syncPostersToForm();
    props.deleteProperty(CONFIG.PROPS.NEEDS_REFRESH);
    Logger.log('[refreshIfNeeded_] Deferred refresh completed and cleared');
    return true;
  } catch (err) {
    logError_(err, 'refreshIfNeeded_', 'Deferred refresh');
    return false;
  }
}
