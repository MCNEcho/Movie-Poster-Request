/** ManualRequest.js **/
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
    
    <label for="date">Request Date:</label>
    <input type="date" id="date" placeholder="MM/DD/YYYY">
    
    <label for="time">Request Time:</label>
    <input type="time" id="time" placeholder="HH:MM">
    
    <button id="submitBtn" onclick="submitRequest()">Add Request</button>
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
      
      let isSubmitting = false;

      function submitRequest() {
        if (isSubmitting) return;

        const email = document.getElementById('email').value.trim();
        const name = document.getElementById('name').value.trim();
        const posterId = document.getElementById('poster').value;
        const date = document.getElementById('date').value.trim();
        const time = document.getElementById('time').value.trim();
        
        if (!email || !name || !posterId) {
          showStatus('Please fill in all required fields', 'error');
          return;
        }

        isSubmitting = true;
        toggleSubmit_(true, 'Adding...');
        
        // Combine date and time into timestamp string
        let timestamp = '';
        if (date) {
          // Date is in YYYY-MM-DD format from date input
          if (time) {
            // Time is in HH:MM format from time input, append seconds
            timestamp = date + ' ' + time + ':00';
          } else {
            // If no time provided, default to midnight
            timestamp = date + ' 00:00:00';
          }
        }
        
        google.script.run
          .withSuccessHandler(function(result) {
            if (result.success) {
              showStatus('Request added successfully!', 'success');
              setTimeout(() => google.script.host.close(), 1500);
            } else {
              showStatus('Error: ' + result.message, 'error');
              isSubmitting = false;
              toggleSubmit_(false, 'Add Request');
            }
          })
          .withFailureHandler(function(err) {
            showStatus('Error: ' + err.message, 'error');
            isSubmitting = false;
            toggleSubmit_(false, 'Add Request');
          })
          .addManualRequest(email, name, posterId, timestamp);
      }
      
      function showStatus(msg, type) {
        const status = document.getElementById('status');
        status.textContent = msg;
        status.className = type;
      }

      function toggleSubmit_(disabled, label) {
        const btn = document.getElementById('submitBtn');
        if (!btn) return;
        btn.disabled = disabled;
        btn.textContent = label;
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
    SpreadsheetApp.getActive().toast('⏳ Adding manual request...', 'Manual Request', 3);

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
    
    // Performance Optimization: Use deferred refresh for admin operations
    // Allows manual request add to complete in ~200-300ms instead of ~2-3s
    markSystemNeedingRefresh_();
    
    Logger.log(`[addManualRequest] Successfully added request: ${empEmail} - ${label}`);
    SpreadsheetApp.getActive().toast(
      `✅ Request added!\n${empName} → ${label}\n🔄 Boards will refresh in 1-5 minutes`,
      'Request Added',
      5
    );
    
    return { success: true, message: 'Request added successfully (refresh pending)' };
    
  } catch (err) {
    Logger.log(`[addManualRequest] Error: ${err.message}`);
    return { success: false, message: `Error: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
