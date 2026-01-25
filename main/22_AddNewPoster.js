/** 22_AddNewPoster.js **/

/**
 * Show dialog for adding a new poster to Inventory
 * Provides user-friendly interface for entering poster details
 */
function showAddNewPosterDialog() {
  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 500px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
          }
          input[type="text"],
          input[type="date"],
          input[type="number"],
          textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
          }
          textarea {
            min-height: 60px;
            resize: vertical;
          }
          .checkbox-group {
            margin-bottom: 15px;
          }
          .checkbox-group label {
            display: inline;
            font-weight: normal;
            margin-left: 5px;
          }
          .button-group {
            margin-top: 20px;
            text-align: right;
          }
          button {
            padding: 10px 20px;
            margin-left: 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .btn-primary {
            background-color: #4285f4;
            color: white;
          }
          .btn-primary:hover {
            background-color: #357ae8;
          }
          .btn-secondary {
            background-color: #f1f3f4;
            color: #202124;
          }
          .btn-secondary:hover {
            background-color: #e8eaed;
          }
          .error {
            color: #d93025;
            font-size: 12px;
            margin-top: 5px;
          }
          .success {
            color: #1e8e3e;
            font-size: 12px;
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <h2>Add New Poster</h2>
        <form id="posterForm">
          <div class="checkbox-group">
            <input type="checkbox" id="active" checked>
            <label for="active">Active? (Include in form and displays)</label>
          </div>
          
          <div class="form-group">
            <label for="releaseDate">Release Date *</label>
            <input type="date" id="releaseDate" required>
          </div>
          
          <div class="form-group">
            <label for="title">Movie Title *</label>
            <input type="text" id="title" required placeholder="Enter movie title">
          </div>
          
          <div class="form-group">
            <label for="company">Company</label>
            <input type="text" id="company" placeholder="e.g., Universal, Disney">
          </div>
          
          <div class="form-group">
            <label for="posters">Posters Count</label>
            <input type="number" id="posters" min="0" placeholder="0">
          </div>
          
          <div class="form-group">
            <label for="busShelters">Bus Shelters Count</label>
            <input type="number" id="busShelters" min="0" placeholder="0">
          </div>
          
          <div class="form-group">
            <label for="miniPosters">Mini Posters Count</label>
            <input type="number" id="miniPosters" min="0" placeholder="0">
          </div>
          
          <div class="form-group">
            <label for="standee">Standee Count</label>
            <input type="number" id="standee" min="0" placeholder="0">
          </div>
          
          <div class="form-group">
            <label for="teaser">Teaser Count</label>
            <input type="number" id="teaser" min="0" placeholder="0">
          </div>
          
          <div class="form-group">
            <label for="receivedDate">Poster Received Date</label>
            <input type="date" id="receivedDate">
          </div>
          
          <div class="form-group">
            <label for="notes">Notes</label>
            <textarea id="notes" placeholder="Any additional notes..."></textarea>
          </div>
          
          <div id="message"></div>
          
          <div class="button-group">
            <button type="button" class="btn-secondary" onclick="google.script.host.close()">Cancel</button>
            <button type="submit" class="btn-primary">Add Poster</button>
          </div>
        </form>
        
        <script>
          document.getElementById('posterForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
              active: document.getElementById('active').checked,
              releaseDate: document.getElementById('releaseDate').value,
              title: document.getElementById('title').value,
              company: document.getElementById('company').value,
              posters: document.getElementById('posters').value || 0,
              busShelters: document.getElementById('busShelters').value || 0,
              miniPosters: document.getElementById('miniPosters').value || 0,
              standee: document.getElementById('standee').value || 0,
              teaser: document.getElementById('teaser').value || 0,
              receivedDate: document.getElementById('receivedDate').value,
              notes: document.getElementById('notes').value
            };
            
            const messageDiv = document.getElementById('message');
            messageDiv.innerHTML = '<div class="success">Adding poster...</div>';
            
            google.script.run
              .withSuccessHandler(function(result) {
                if (result.success) {
                  messageDiv.innerHTML = '<div class="success">' + result.message + '</div>';
                  setTimeout(function() {
                    google.script.host.close();
                  }, 1500);
                } else {
                  messageDiv.innerHTML = '<div class="error">' + result.message + '</div>';
                }
              })
              .withFailureHandler(function(error) {
                messageDiv.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
              })
              .addNewPosterToInventory(data);
          });
        </script>
      </body>
    </html>
  `)
    .setWidth(550)
    .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add New Poster to Inventory');
}

/**
 * Add a new poster to Inventory sheet
 * @param {Object} data - Poster data from form
 * @returns {Object} Result object with success status and message
 */
function addNewPosterToInventory(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    
    // Validate required fields
    if (!data.releaseDate || !data.title) {
      return { success: false, message: 'Release Date and Title are required.' };
    }
    
    // Parse release date
    const releaseDate = new Date(data.releaseDate);
    if (isNaN(releaseDate.getTime())) {
      return { success: false, message: 'Invalid release date.' };
    }
    
    // Parse received date if provided
    let receivedDate = '';
    if (data.receivedDate) {
      receivedDate = new Date(data.receivedDate);
      if (isNaN(receivedDate.getTime())) {
        receivedDate = '';
      }
    }
    
    // Generate Poster ID
    const dateStr = fmtDate_(releaseDate, 'yyyyMMdd');
    const titleSlug = normalizeTitle_(data.title).substring(0, 20).replace(/[^a-z0-9]/gi, '');
    const posterId = `${titleSlug}_${dateStr}`;
    
    // Prepare row data (matches COLS.INVENTORY structure)
    const newRow = [
      data.active || false,                    // ACTIVE
      releaseDate,                              // RELEASE
      data.title,                               // TITLE
      data.company || '',                       // COMPANY
      Number(data.posters) || 0,                // POSTERS
      Number(data.busShelters) || 0,            // BUS
      Number(data.miniPosters) || 0,            // MINI
      Number(data.standee) || 0,                // STANDEE
      Number(data.teaser) || 0,                 // TEASER
      posterId,                                 // POSTER_ID
      receivedDate,                             // RECEIVED
      data.notes || ''                          // NOTES
    ];
    
    // Add to sheet
    inv.appendRow(newRow);
    
    // Auto-sort by release date
    autoSortInventoryByReleaseDate_();
    
    // Update timestamp
    updateInventoryLastUpdated_();
    
    // Sync to Movie Posters
    syncInventoryCountsToMoviePosters_();
    
    // Sync to form
    syncPostersToForm();
    
    // Rebuild boards
    rebuildBoards();
    
    // Refresh display dropdowns if they exist
    try {
      refreshDisplayDropdowns();
    } catch (err) {
      Logger.log(`[WARN] Could not refresh display dropdowns: ${err.message}`);
    }
    
    // Log to analytics
    try {
      const analytics = getSheet_(CONFIG.SHEETS.ANALYTICS);
      analytics.appendRow([
        fmtDate_(now_(), CONFIG.DATE_FORMAT),
        'POSTER_ADDED',
        '',
        '',
        '',
        '',
        'SUCCESS',
        0,
        0,
        0,
        `Added new poster: ${data.title}`
      ]);
    } catch (err) {
      Logger.log(`[WARN] Failed to log to analytics: ${err.message}`);
    }
    
    return { 
      success: true, 
      message: `Successfully added "${data.title}" to Inventory!` 
    };
  } catch (err) {
    logError_(err, 'addNewPosterToInventory', { title: data.title });
    return { 
      success: false, 
      message: `Error adding poster: ${err.message}` 
    };
  } finally {
    lock.releaseLock();
  }
}
