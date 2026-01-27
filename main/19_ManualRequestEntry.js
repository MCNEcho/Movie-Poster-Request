/** 19_ManualRequestEntry.js **/
/** Manual request entry for data migration from legacy systems **/

function showManualRequestDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; }
      label { display: block; margin-top: 10px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box; }
      button { margin-top: 15px; padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
      button:hover { background-color: #45a049; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .success { background-color: #d4edda; color: #155724; }
      .error { background-color: #f8d7da; color: #721c24; }
    </style>
    
    <h2>Manually Add Request (Migration)</h2>
    
    <label for="email">Employee Email:</label>
    <input type="email" id="email" placeholder="employee@example.com">
    
    <label for="name">Employee Name:</label>
    <input type="text" id="name" placeholder="First Name Last Initial">
    
    <label for="poster">Poster:</label>
    <select id="poster">
      <option value="">-- Select a Poster --</option>
    </select>
    
    <label for="timestamp">Request Timestamp (YYYY-MM-DD HH:MM:SS):</label>
    <input type="text" id="timestamp" placeholder="2026-01-20 20:30:00">
    
    <button onclick="submitRequest()">Add Request</button>
    <div id="status"></div>
    
    <script>
      google.script.run.withSuccessHandler(function(posters) {
        const select = document.getElementById('poster');
        posters.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.label;
          select.appendChild(option);
        });
      }).getActivePostersForManualEntry();
      
      function submitRequest() {
        const email = document.getElementById('email').value.trim();
        const name = document.getElementById('name').value.trim();
        const posterId = document.getElementById('poster').value;
        const timestamp = document.getElementById('timestamp').value.trim();
        
        if (!email || !name || !posterId) {
          showStatus('Please fill in all required fields', 'error');
          return;
        }
        
        google.script.run.withSuccessHandler(function(result) {
          if (result.success) {
            showStatus('Request added successfully!', 'success');
            setTimeout(() => google.script.host.close(), 1500);
          } else {
            showStatus('Error: ' + result.message, 'error');
          }
        }).addManualRequest(email, name, posterId, timestamp);
      }
      
      function showStatus(msg, type) {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.className = type;
      }
    </script>
  `).setWidth(400).setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Add Manual Request');
}

function getActivePostersForManualEntry() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  
  return data
    .filter(r => r[COLS.INVENTORY.ACTIVE - 1] === true)
    .map(r => ({
      id: String(r[COLS.INVENTORY.POSTER_ID - 1]),
      label: String(r[COLS.INVENTORY.TITLE - 1])
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function addManualRequest(empEmail, empName, posterId, customTimestamp) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // Validate inputs
    if (!empEmail || !empName || !posterId) {
      return { success: false, message: 'Missing required fields' };
    }
    
    // Validate email format
    if (!empEmail.includes('@')) {
      return { success: false, message: 'Invalid email format' };
    }
    
    // Validate poster exists and is active
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const invData = getNonEmptyData_(inv, 11, 3);
    const poster = invData.find(r => String(r[COLS.INVENTORY.POSTER_ID - 1]) === posterId);
    
    if (!poster) {
      return { success: false, message: 'Poster not found' };
    }
    
    if (poster[COLS.INVENTORY.ACTIVE - 1] !== true) {
      return { success: false, message: 'Poster is not active' };
    }
    
    // Enforce dedup + slot limits
    const dedup = canRequestPoster_(empEmail, posterId);
    if (!dedup.allowed) {
      return { success: false, message: `Cannot add request: ${dedup.reason}` };
    }

    const activeSlots = countActiveSlotsByEmail_(empEmail);
    if (activeSlots >= CONFIG.MAX_ACTIVE) {
      return { success: false, message: `Cannot add request: limit (${CONFIG.MAX_ACTIVE}-slot)` };
    }

    // Use custom timestamp or current time
    let requestTs;
    if (customTimestamp && customTimestamp.trim()) {
      try {
        requestTs = new Date(customTimestamp);
        if (isNaN(requestTs.getTime())) {
          return { success: false, message: 'Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS' };
        }
      } catch (e) {
        return { success: false, message: 'Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS' };
      }
    } else {
      requestTs = now_();
    }
    
    // Add to ledger
    const sh = getRequestsSheet_();
    const mpInfo = lookupPosterInfoById_(posterId);
    const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
    const label = idToCurrent[posterId] || (mpInfo ? mpInfo.label : posterId);

    const row = [];
    row[COLS.REQUESTS.REQ_TS - 1] = requestTs;
    row[COLS.REQUESTS.EMP_EMAIL - 1] = empEmail.toLowerCase().trim();
    row[COLS.REQUESTS.EMP_NAME - 1] = empName;
    row[COLS.REQUESTS.POSTER_ID - 1] = posterId;
    row[COLS.REQUESTS.LABEL_AT_REQ - 1] = label;
    row[COLS.REQUESTS.TITLE_SNAP - 1] = mpInfo ? mpInfo.title : '';
    row[COLS.REQUESTS.RELEASE_SNAP - 1] = mpInfo ? mpInfo.release : '';
    row[COLS.REQUESTS.ACTION_TYPE - 1] = 'ADD';
    row[COLS.REQUESTS.STATUS - 1] = STATUS.ACTIVE;
    row[COLS.REQUESTS.STATUS_TS - 1] = requestTs;

    sh.appendRow(row);

    invalidateCachesAfterWrite_({ empEmail });
    
    // Rebuild boards to reflect new entry
    rebuildBoards();
    syncPostersToForm();
    
    Logger.log(`[addManualRequest] Successfully added request: ${empEmail} - ${label}`);
    return { success: true, message: 'Request added successfully' };
    
  } catch (err) {
    Logger.log(`[addManualRequest] Error: ${err.message}`);
    return { success: false, message: `Error: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
