/** 21_ManualPosterEntry.js **/

function showManualPosterDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      label { display: block; margin-top: 15px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; }
      button { margin-top: 20px; padding: 10px 20px; background: #4285f4; color: white; border: none; cursor: pointer; }
      button:hover { background: #357ae8; }
      .required:after { content: " *"; color: red; }
    </style>
    
    <h2>Add New Poster to Inventory</h2>
    
    <label class="required">Movie Title</label>
    <input type="text" id="title" placeholder="Enter movie title">
    
    <label class="required">Release Date</label>
    <input type="date" id="releaseDate">
    
    <label class="required">Poster Quantity</label>
    <input type="number" id="posters" min="0" value="1">
    
    <label>Studio/Company</label>
    <input type="text" id="company" placeholder="Optional">
    
    <label>Bus Shelters</label>
    <input type="number" id="bus" min="0" placeholder="Optional">
    
    <label>Mini Posters</label>
    <input type="number" id="mini" min="0" placeholder="Optional">
    
    <label>Standees</label>
    <input type="number" id="standee" min="0" placeholder="Optional">
    
    <label>Teasers</label>
    <input type="number" id="teaser" min="0" placeholder="Optional">
    
    <label>Received Date</label>
    <input type="date" id="receivedDate">
    
    <label>Notes</label>
    <input type="text" id="notes" placeholder="Optional notes">
    
    <label>
      <input type="checkbox" id="activate"> Activate immediately (add to form)
    </label>
    
    <button onclick="submitPoster()">Add Poster</button>
    
    <script>
      function submitPoster() {
        const data = {
          title: document.getElementById('title').value.trim(),
          releaseDate: document.getElementById('releaseDate').value,
          posters: parseInt(document.getElementById('posters').value) || 1,
          company: document.getElementById('company').value.trim(),
          bus: parseInt(document.getElementById('bus').value) || 0,
          mini: parseInt(document.getElementById('mini').value) || 0,
          standee: parseInt(document.getElementById('standee').value) || 0,
          teaser: parseInt(document.getElementById('teaser').value) || 0,
          receivedDate: document.getElementById('receivedDate').value,
          notes: document.getElementById('notes').value.trim(),
          activate: document.getElementById('activate').checked
        };
        
        if (!data.title || !data.releaseDate) {
          alert('Please fill in required fields (Title and Release Date)');
          return;
        }
        
        google.script.run
          .withSuccessHandler(() => {
            alert('Poster added successfully!');
            google.script.host.close();
          })
          .withFailureHandler((err) => {
            alert('Error: ' + err.message);
          })
          .addPosterToInventory_(data);
      }
    </script>
  `)
  .setWidth(500)
  .setHeight(650);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Poster to Inventory');
}

function addPosterToInventory_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const posterId = uuidPosterId_();
    
    inv.appendRow([
      data.activate,              // ACTIVE checkbox
      new Date(data.releaseDate), // RELEASE
      data.title,                 // TITLE
      data.company,               // COMPANY
      data.posters,               // POSTERS (primary)
      data.bus,                   // BUS
      data.mini,                  // MINI
      data.standee,               // STANDEE
      data.teaser,                // TEASER
      posterId,                   // POSTER_ID
      data.receivedDate ? new Date(data.receivedDate) : '', // RECEIVED
      data.notes                  // NOTES
    ]);
    
    // Set checkbox validation on the new row
    const lastRow = inv.getLastRow();
    setCheckboxColumn_(inv, COLS.INVENTORY.ACTIVE, lastRow, lastRow);
    
    // Sort inventory by release date
    sortInventoryByReleaseDate_();
    
    // If activated, sync to form
    if (data.activate) {
      syncPostersToForm();
      rebuildBoards();
    }
    
    logAnalyticsEvent_({
      eventType: 'POSTER_ADDED',
      notes: `Manual poster entry: ${data.title}`
    });
    
  } finally {
    lock.releaseLock();
  }
}
