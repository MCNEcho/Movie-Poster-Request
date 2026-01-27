/** 21_ManualPosterEntry.js **/

function showManualPosterDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; }
      label { display: block; margin-top: 10px; font-weight: bold; }
      input { width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; }
      button { margin-top: 15px; padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
      button:hover { background-color: #45a049; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .success { background-color: #d4edda; color: #155724; }
      .error { background-color: #f8d7da; color: #721c24; }
      .required:after { content: " *"; color: red; }
    </style>
    
    <h2>Add New Poster to Inventory</h2>
    
    <label class="required" for="title">Movie Title:</label>
    <input type="text" id="title" placeholder="Enter movie title">
    
    <label class="required" for="releaseDate">Release Date:</label>
    <input type="date" id="releaseDate">
    
    <label for="company">Company:</label>
    <input type="text" id="company" placeholder="Optional">
    
    <label for="posters">Posters:</label>
    <input type="number" id="posters" min="0" placeholder="Optional">
    
    <label for="bus">Bus Shelters:</label>
    <input type="number" id="bus" min="0" placeholder="Optional">
    
    <label for="mini">Mini Posters:</label>
    <input type="number" id="mini" min="0" placeholder="Optional">
    
    <label for="standee">Standee:</label>
    <input type="number" id="standee" min="0" placeholder="Optional">
    
    <label for="teaser">Teaser:</label>
    <input type="number" id="teaser" min="0" placeholder="Optional">
    
    <label for="notes">Notes:</label>
    <input type="text" id="notes" placeholder="Optional notes">
    
    <label>
      <input type="checkbox" id="active"> Active? (add to form immediately)
    </label>
    
    <button onclick="submitPoster()">Add Poster</button>
    <div id="status"></div>
    
    <script>
      function submitPoster() {
        const title = document.getElementById('title').value.trim();
        const releaseDate = document.getElementById('releaseDate').value;
        const company = document.getElementById('company').value.trim();
        const posters = document.getElementById('posters').value.trim();
        const bus = document.getElementById('bus').value.trim();
        const mini = document.getElementById('mini').value.trim();
        const standee = document.getElementById('standee').value.trim();
        const teaser = document.getElementById('teaser').value.trim();
        const notes = document.getElementById('notes').value.trim();
        const active = document.getElementById('active').checked;
        
        if (!title || !releaseDate) {
          showStatus('Please fill in all required fields (Title and Release Date)', 'error');
          return;
        }
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showStatus('Poster added successfully! Row: ' + result.row, 'success');
              setTimeout(() => google.script.host.close(), 1500);
            } else {
              showStatus('Error: ' + result.message, 'error');
            }
          })
          .withFailureHandler(function(err) {
            showStatus('Error: ' + err.message, 'error');
          })
          .addManualPoster(active, releaseDate, title, company, posters, bus, mini, standee, teaser, notes);
      }
      
      function showStatus(msg, type) {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.className = type;
      }
    </script>
  `)
  .setWidth(400)
  .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Manual Poster');
}

function addManualPoster(active, releaseDate, title, company, posters, bus, mini, standee, teaser, notes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    // Validate required fields
    if (!title || !title.trim() || !releaseDate) {
      return { success: false, message: 'Title and Release Date are required' };
    }
    
    // Validate release date
    const release = new Date(releaseDate);
    if (isNaN(release.getTime())) {
      return { success: false, message: 'Invalid Release Date' };
    }
    
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    
    // Parse numeric values, defaulting to empty string for 0 or invalid
    // This ensures empty cells rather than zeros, matching existing data patterns
    const parseNum = (val) => {
      if (!val || val === '') return '';
      const num = parseInt(val);
      return (isNaN(num) || num === 0) ? '' : num;
    };
    
    // Build row data for columns A-J only (NOT K/Poster ID)
    const row = [];
    row[COLS.INVENTORY.ACTIVE - 1] = !!active;          // A: Active? (boolean)
    row[COLS.INVENTORY.RELEASE - 1] = release;          // B: Release Date
    row[COLS.INVENTORY.TITLE - 1] = title.trim();       // C: Movie Title
    row[COLS.INVENTORY.COMPANY - 1] = company || '';    // D: Company
    row[COLS.INVENTORY.POSTERS - 1] = parseNum(posters); // E: Posters
    row[COLS.INVENTORY.BUS - 1] = parseNum(bus);        // F: Bus Shelters
    row[COLS.INVENTORY.MINI - 1] = parseNum(mini);      // G: Mini Posters
    row[COLS.INVENTORY.STANDEE - 1] = parseNum(standee); // H: Standee
    row[COLS.INVENTORY.TEASER - 1] = parseNum(teaser);  // I: Teaser
    row[COLS.INVENTORY.NOTES - 1] = notes || '';        // J: Notes
    // Column K (POSTER_ID) is NOT written - will be auto-generated by other functions
    
    // Append at bottom of sheet (columns A-J only, using COLS.INVENTORY.NOTES as the end column)
    const nextRow = inv.getLastRow() + 1;
    inv.getRange(nextRow, 1, 1, COLS.INVENTORY.NOTES).setValues([row]); // Write A-J (columns 1-10)
    
    // Set checkbox validation for Active? column
    setCheckboxColumn_(inv, COLS.INVENTORY.ACTIVE, nextRow, nextRow);
    
    // Auto-generate Poster ID for the new row (column K)
    ensurePosterIdsInInventory_();
    
    // Update last updated timestamp
    updateInventoryLastUpdated_();
    
    Logger.log(`[addManualPoster] Added poster at row ${nextRow}: ${title}`);
    
    return { 
      success: true, 
      message: 'Poster added successfully',
      row: nextRow 
    };
    
  } catch (err) {
    Logger.log(`[addManualPoster] Error: ${err.message}`);
    return { success: false, message: `Error: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}