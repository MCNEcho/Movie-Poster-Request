/** 21_ManualPosterEntry.js **/

function showManualPosterDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 18px; }
      label { display: block; margin-top: 12px; font-weight: bold; }
      input, select, textarea { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
      button { margin-top: 18px; padding: 10px 18px; background: #4285f4; color: white; border: none; cursor: pointer; }
      button:hover { background: #357ae8; }
      .required:after { content: " *"; color: red; }
      #status { margin-top: 10px; padding: 8px; border-radius: 4px; display: none; }
      .success { background: #e6f4ea; color: #137333; }
      .error { background: #fce8e6; color: #c5221f; }
    </style>
    
    <h2>Add New Poster</h2>
    
    <label class="required">Movie Title</label>
    <input type="text" id="title" placeholder="Enter movie title">
    
    <label class="required">Release Date</label>
    <input type="date" id="releaseDate">
    
    <label>Company</label>
    <input type="text" id="company" placeholder="Optional">
    
    <label>Posters</label>
    <input type="number" id="posters" min="0" placeholder="Optional">
    
    <label>Bus Shelters</label>
    <input type="number" id="bus" min="0" placeholder="Optional">
    
    <label>Mini Posters</label>
    <input type="number" id="mini" min="0" placeholder="Optional">
    
    <label>Standee</label>
    <input type="number" id="standee" min="0" placeholder="Optional">
    
    <label>Teaser</label>
    <input type="number" id="teaser" min="0" placeholder="Optional">
    
    <label>Notes</label>
    <textarea id="notes" rows="2" placeholder="Optional notes"></textarea>
    
    <label>
      <input type="checkbox" id="activate"> Active?
    </label>
    
    <button onclick="submitPoster()">Submit</button>
    <div id="status"></div>
    
    <script>
      function setStatus(msg, type) {
        const box = document.getElementById('status');
        box.textContent = msg;
        box.className = type;
        box.style.display = 'block';
      }

      function submitPoster() {
        const btn = document.querySelector('button');
        if (btn) btn.disabled = true;

        if (!google || !google.script || !google.script.run) {
          alert('Apps Script client runtime not available. Please reload the sheet and try again.');
          if (btn) btn.disabled = false;
          return;
        }

        const title = document.getElementById('title').value.trim();
        const releaseDate = document.getElementById('releaseDate').value;
        if (!title || !releaseDate) {
          setStatus('Title and Release Date are required.', 'error');
          if (btn) btn.disabled = false;
          return;
        }

        const payload = {
          active: document.getElementById('activate').checked,
          releaseDate,
          title,
          company: document.getElementById('company').value.trim(),
          posters: document.getElementById('posters').value,
          bus: document.getElementById('bus').value,
          mini: document.getElementById('mini').value,
          standee: document.getElementById('standee').value,
          teaser: document.getElementById('teaser').value,
          notes: document.getElementById('notes').value.trim(),
        };

        google.script.run
          .withSuccessHandler((res) => {
            if (btn) btn.disabled = false;
            if (res && res.success) {
              setStatus(res.message || 'Poster added.', 'success');
              setTimeout(() => google.script.host.close(), 1000);
            } else {
              setStatus(res && res.message ? res.message : 'Unknown error', 'error');
            }
          })
          .withFailureHandler((err) => {
            if (btn) btn.disabled = false;
            setStatus(err && err.message ? err.message : err, 'error');
          })
          .addManualPoster(
            payload.active,
            payload.releaseDate,
            payload.title,
            payload.company,
            payload.posters,
            payload.bus,
            payload.mini,
            payload.standee,
            payload.teaser,
            payload.notes
          );
      }
    </script>
  `)
    .setWidth(480)
    .setHeight(720);

  SpreadsheetApp.getUi().showModalDialog(html, 'Add Poster to Inventory');
}

function addManualPoster(active, releaseDate, title, company, posters, bus, mini, standee, teaser, notes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    Logger.log('[addManualPoster] invoked');

    if (!String(title || '').trim() || !releaseDate) {
      return { success: false, message: 'Title and Release Date are required.' };
    }

    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const COL_ACTIVE = 1;
    const COL_RELEASE = 2;
    const COL_TITLE = 3;
    const COL_COMPANY = 4;
    const COL_POSTERS = 5;
    const COL_BUS = 6;
    const COL_MINI = 7;
    const COL_STANDEE = 8;
    const COL_TEASER = 9;
    const COL_NOTES = 10;

    const relDate = new Date(releaseDate);
    if (isNaN(relDate.getTime())) {
      return { success: false, message: 'Invalid Release Date.' };
    }

    const toNumber = (v) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    const row = new Array(10).fill('');
    row[COL_ACTIVE - 1] = !!active;
    row[COL_RELEASE - 1] = relDate;
    row[COL_TITLE - 1] = String(title || '').trim();
    row[COL_COMPANY - 1] = String(company || '').trim();
    row[COL_POSTERS - 1] = toNumber(posters);
    row[COL_BUS - 1] = toNumber(bus);
    row[COL_MINI - 1] = toNumber(mini);
    row[COL_STANDEE - 1] = toNumber(standee);
    row[COL_TEASER - 1] = toNumber(teaser);
    row[COL_NOTES - 1] = String(notes || '').trim();

    const nextRow = Math.max(inv.getLastRow() + 1, 3);
    inv.getRange(nextRow, 1, 1, row.length).setValues([row]);

    try { setCheckboxColumn_(inv, COL_ACTIVE, nextRow, nextRow); } catch (e) { Logger.log(`[addManualPoster] checkbox warning: ${e.message}`); }

    Logger.log(`[addManualPoster] wrote row ${nextRow}`);
    return { success: true, message: 'Poster added.', row: nextRow };
  } catch (err) {
    Logger.log(`[addManualPoster] Error: ${err.message}`);
    return { success: false, message: err.message };
  } finally {
    lock.releaseLock();
  }
}
