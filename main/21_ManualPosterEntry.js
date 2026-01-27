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
    
    <label>Notes</label>
    <input type="text" id="notes" placeholder="Optional notes">
    
    <label>
      <input type="checkbox" id="activate"> Activate immediately (add to form)
    </label>
    
    <button onclick="submitPoster()">Add Poster</button>
    
    <script>
      function submitPoster() {
        const btn = document.querySelector('button');
        if (btn) btn.disabled = true;

        // Client-side sanity checks to surface silent failures before server call.
        if (!google || !google.script || !google.script.run) {
          alert('Apps Script client runtime not available. Please reload the sheet and try again.');
          if (btn) btn.disabled = false;
          return;
        }

        const data = {
          title: document.getElementById('title').value.trim(),
          releaseDate: document.getElementById('releaseDate').value,
          posters: parseInt(document.getElementById('posters').value) || 1,
          company: document.getElementById('company').value.trim(),
          bus: parseInt(document.getElementById('bus').value) || 0,
          mini: parseInt(document.getElementById('mini').value) || 0,
          standee: parseInt(document.getElementById('standee').value) || 0,
          teaser: parseInt(document.getElementById('teaser').value) || 0,
          notes: document.getElementById('notes').value.trim(),
          activate: document.getElementById('activate').checked
        };
        
        if (!data.title || !data.releaseDate) {
          alert('Please fill in required fields (Title and Release Date)');
          if (btn) btn.disabled = false;
          return;
        }
        
        console.log('[submitPoster] calling server', data);
        google.script.run
          .withSuccessHandler((res) => {
            if (btn) btn.disabled = false;
            if (res && res.success) {
              alert('Poster added successfully! ID: ' + (res.posterId || 'N/A'));
              google.script.host.close();
            } else {
              alert('Error: ' + (res && res.message ? res.message : 'Unknown error'));
            }
          })
          .withFailureHandler((err) => {
            if (btn) btn.disabled = false;
            console.log('[submitPoster] failure', err);
            alert('Error: ' + (err && err.message ? err.message : err));
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
    Logger.log('[addPosterToInventory_] invoked');
    // Validate required fields
    if (!data || !String(data.title || '').trim() || !data.releaseDate) {
      return { success: false, message: 'Title and Release Date are required.' };
    }
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    if (!inv) {
      return { success: false, message: 'Inventory sheet not found' };
    }

    // Header-based mapping (row 2) keeps writes aligned even if columns move.
    const headerRow = 2;
    const headers = inv.getRange(headerRow, 1, 1, inv.getLastColumn()).getValues()[0];
    const norm = (s) => String(s || '').trim().toLowerCase();

    const colByName = {};
    headers.forEach((h, i) => { colByName[norm(h)] = i + 1; });

    const COL_ACTIVE = colByName['active?'];
    const COL_RELEASE = colByName['release date'];
    const COL_TITLE = colByName['movie title'];
    const COL_COMPANY = colByName['company'];
    const COL_POSTERS = colByName['posters'];
    const COL_BUS = colByName['bus shelters'];
    const COL_MINI = colByName['mini posters'];
    const COL_STANDEE = colByName['standee'];
    const COL_TEASER = colByName['teaser'];
    const COL_NOTES = colByName['notes'];
    const COL_POSTERID = colByName['poster id'];

    const missing = [];
    if (!COL_ACTIVE) missing.push('Active?');
    if (!COL_RELEASE) missing.push('Release Date');
    if (!COL_TITLE) missing.push('Movie Title');
    if (!COL_POSTERID) missing.push('Poster ID');
    if (missing.length) {
      return { success: false, message: 'Missing Inventory headers: ' + missing.join(', ') };
    }

    const title = String(data.title).trim();
    const company = String(data.company || '').trim();
    const notes = String(data.notes || '').trim();
    const posters = Number(data.posters) || 0;
    const bus = Number(data.bus) || 0;
    const mini = Number(data.mini) || 0;
    const standee = Number(data.standee) || 0;
    const teaser = Number(data.teaser) || 0;

    const release = new Date(data.releaseDate);
    if (isNaN(release.getTime())) {
      return { success: false, message: 'Invalid Release Date.' };
    }

    const active = !!data.activate;
    const posterId = uuidPosterId_();

    const colCount = headers.length; // Keep within visible A–K layout.
    const row = new Array(colCount).fill('');
    row[COL_ACTIVE - 1] = active;
    row[COL_RELEASE - 1] = release;
    row[COL_TITLE - 1] = title;
    if (COL_COMPANY) row[COL_COMPANY - 1] = company;
    if (COL_POSTERS) row[COL_POSTERS - 1] = posters;
    if (COL_BUS) row[COL_BUS - 1] = bus;
    if (COL_MINI) row[COL_MINI - 1] = mini;
    if (COL_STANDEE) row[COL_STANDEE - 1] = standee;
    if (COL_TEASER) row[COL_TEASER - 1] = teaser;
    if (COL_NOTES) row[COL_NOTES - 1] = notes;
    row[COL_POSTERID - 1] = posterId;

    const nextRow = Math.max(inv.getLastRow() + 1, headerRow + 1);
    inv.getRange(nextRow, 1, 1, colCount).setValues([row]);
    Logger.log(`[addPosterToInventory_] wrote row ${nextRow} cols ${colCount} posterId=${posterId} title="${title}" active=${active}`);

    try { setCheckboxColumn_(inv, COL_ACTIVE, nextRow, nextRow); } catch (e) { Logger.log(`[addPosterToInventory_] checkbox setup warning: ${e.message}`); }

    try { sortInventoryByReleaseDate_(); } catch (e) { Logger.log(`[addPosterToInventory_] sort warning: ${e.message}`); }

    if (active) {
      try { syncPostersToForm(); } catch (e) { Logger.log(`[addPosterToInventory_] syncPostersToForm error: ${e.message}`); }
      try { rebuildBoards(); } catch (e) { Logger.log(`[addPosterToInventory_] rebuildBoards error: ${e.message}`); }
    }

    logAnalyticsEvent_({
      eventType: 'POSTER_ADDED',
      notes: `Manual poster entry: ${title} (${posterId})`
    });

    return { success: true, posterId, row: nextRow, colCount };
  } catch (err) {
    Logger.log(`[addPosterToInventory_] Error: ${err.message}`);
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}
