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
      button.toggle-btn { padding: 8px 15px; margin-right: 5px; margin-top: 0px; border: 2px solid #ccc; background: white; color: black; font-weight: bold; }
      button.toggle-btn.active { background-color: #4CAF50; color: white; border-color: #4CAF50; }
      #status { margin-top: 10px; padding: 10px; border-radius: 5px; }
      .success { background-color: #d4edda; color: #155724; }
      .error { background-color: #f8d7da; color: #721c24; }
      .toggle-group { margin-bottom: 15px; }
      .hidden { display: none; }
    </style>
    
    <h2>Manually Add Request</h2>
    
    <div class="toggle-group">
      <label>Request Type:</label>
      <button class="toggle-btn active" id="empBtn" onclick="toggleType('employee')">👤 Employee</button>
      <button class="toggle-btn" id="custBtn" onclick="toggleType('customer')">📱 Customer</button>
    </div>
    
    <div id="empFields">
      <label for="email">Employee Email:</label>
      <input type="email" id="email" placeholder="employee@example.com">
    </div>
    
    <div id="custFields" class="hidden">
      <label for="phone">Customer Phone:</label>
      <input type="tel" id="phone" placeholder="(555) 555-5555">
    </div>
    
    <label for="name">Name:</label>
    <input type="text" id="name" placeholder="First Name Last Initial">
    
    <label for="poster">Poster:</label>
    <select id="poster">
      <option value="">-- Select a Poster --</option>
    </select>
    
    <label for="date">Request Date:</label>
    <input type="date" id="date" placeholder="MM/DD/YYYY">
    
    <label for="time">Request Time:</label>
    <input type="time" id="time" placeholder="HH:MM">
    
    <label for="notes">Notes:</label>
    <input type="text" id="notes" placeholder="Optional notes for this request">
    
    <button id="submitBtn" onclick="submitRequest()">Add Request</button>
    <div id="status"></div>
    
    <script>
      let requestType = 'employee';
      
      google.script.run.withSuccessHandler(function(posters) {
        const select = document.getElementById('poster');
        posters.forEach(p => {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = p.label;
          select.appendChild(option);
        });
      }).getActivePostersForManualEntry();
      
      // Add event listener to phone field to update notes when customer enters phone
      document.addEventListener('DOMContentLoaded', function() {
        const phoneField = document.getElementById('phone');
        if (phoneField) {
          phoneField.addEventListener('input', function() {
            if (requestType === 'customer') {
              updateCustomerNotes();
            }
          });
        }
      });
      
      function toggleType(type) {
        requestType = type;
        const empBtn = document.getElementById('empBtn');
        const custBtn = document.getElementById('custBtn');
        const empFields = document.getElementById('empFields');
        const custFields = document.getElementById('custFields');
        const notesField = document.getElementById('notes');
        
        if (type === 'employee') {
          empBtn.classList.add('active');
          custBtn.classList.remove('active');
          empFields.classList.remove('hidden');
          custFields.classList.add('hidden');
          notesField.placeholder = 'Optional notes for this request';
          notesField.value = '';
          document.getElementById('email').focus();
        } else {
          empBtn.classList.remove('active');
          custBtn.classList.add('active');
          empFields.classList.add('hidden');
          custFields.classList.remove('hidden');
          updateCustomerNotes();
          document.getElementById('phone').focus();
        }
      }
      
      function updateCustomerNotes() {
        const phone = document.getElementById('phone').value.trim();
        const notesField = document.getElementById('notes');
        if (phone) {
          notesField.value = 'Customer: ' + phone;
        } else {
          notesField.value = 'Customer';
        }
      }
      
      let isSubmitting = false;

      function submitRequest() {
        if (isSubmitting) return;

        const contact = requestType === 'employee' 
          ? document.getElementById('email').value.trim() 
          : document.getElementById('phone').value.trim();
        const name = document.getElementById('name').value.trim();
        const posterId = document.getElementById('poster').value;
        const date = document.getElementById('date').value.trim();
        const time = document.getElementById('time').value.trim();
        const notes = document.getElementById('notes').value.trim();
        
        if (!contact || !name || !posterId) {
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
          .addManualRequest(contact, name, posterId, timestamp, requestType, notes);
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

function addManualRequest(contact, empName, posterId, customTimestamp, contactType = 'EMPLOYEE', notes = '') {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    SpreadsheetApp.getActive().toast('⏳ Adding manual request...', 'Manual Request', 3);

    // Validate inputs
    if (!contact || !empName || !posterId) {
      return { success: false, message: 'Missing required fields' };
    }
    
    // Validate contact based on type
    const contactTypeUpper = String(contactType).toUpperCase();
    if (contactTypeUpper === 'EMPLOYEE') {
      if (!contact.includes('@')) {
        return { success: false, message: 'Invalid email format' };
      }
    } else if (contactTypeUpper === 'CUSTOMER') {
      // Basic phone validation: at least 10 digits
      const digits = contact.replace(/\D/g, '');
      if (digits.length < 10) {
        return { success: false, message: 'Invalid phone number (need at least 10 digits)' };
      }
    } else {
      return { success: false, message: 'Invalid contact type (must be EMPLOYEE or CUSTOMER)' };
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
    
    // For employees: check dedup + slot limits using email as identifier
    // For customers: dedup check is skipped (customers can request multiple times)
    if (contactTypeUpper === 'EMPLOYEE') {
      const dedup = canRequestPoster_(contact, posterId);
      if (!dedup.allowed) {
        return { success: false, message: `Cannot add request: ${dedup.reason}` };
      }

      const activeSlots = countActiveSlotsByEmail_(contact);
      if (activeSlots >= CONFIG.MAX_ACTIVE) {
        return { success: false, message: `Cannot add request: limit (${CONFIG.MAX_ACTIVE}-slot)` };
      }
    }
    // Customers skip dedup/slot limit checks - they can request multiple posters

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
    
    // Capture user for audit trail
    const adminEmail = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown').toLowerCase().trim();
    Logger.log(`[addManualRequest] Manual request added by admin: ${adminEmail}`);
    
    // Add to ledger
    const sh = getRequestsSheet_();
    const mpInfo = lookupPosterInfoById_(posterId);
    const idToCurrent = readJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, {});
    const label = idToCurrent[posterId] || (mpInfo ? mpInfo.label : posterId);

    const row = [];
    row[COLS.REQUESTS.REQ_TS - 1] = requestTs;
    row[COLS.REQUESTS.EMP_EMAIL - 1] = contact.toLowerCase().trim();
    row[COLS.REQUESTS.EMP_NAME - 1] = empName;
    row[COLS.REQUESTS.POSTER_ID - 1] = posterId;
    row[COLS.REQUESTS.LABEL_AT_REQ - 1] = label;
    row[COLS.REQUESTS.TITLE_SNAP - 1] = mpInfo ? mpInfo.title : '';
    row[COLS.REQUESTS.RELEASE_SNAP - 1] = mpInfo ? mpInfo.release : '';
    row[COLS.REQUESTS.ACTION_TYPE - 1] = 'ADD';
    row[COLS.REQUESTS.STATUS - 1] = STATUS.ACTIVE;
    row[COLS.REQUESTS.STATUS_TS - 1] = requestTs;
    row[COLS.REQUESTS.CONTACT_TYPE - 1] = contactTypeUpper;
    row[COLS.REQUESTS.NOTES - 1] = String(notes || '').trim();

    sh.appendRow(row);

    // Invalidate caches only for employees (contact is email)
    if (contactTypeUpper === 'EMPLOYEE') {
      invalidateCachesAfterWrite_({ empEmail: contact });
    }
    
    // Rebuild boards to reflect new entry
    SpreadsheetApp.getActive().toast('🔄 Updating boards and form...', 'Manual Request', 3);
    rebuildBoards();
    
    // Form sync requires owner permissions - skip if access denied
    try {
      syncPostersToForm();
    } catch (formErr) {
      Logger.log(`[WARN] Form sync skipped (access denied): ${formErr.message}`);
      // Non-critical - continue without form sync
    }
    
    const typeLabel = contactTypeUpper === 'EMPLOYEE' ? 'Employee' : 'Customer';
    Logger.log(`[addManualRequest] Successfully added ${typeLabel} request: ${contact} - ${label}`);
    
    // Log to Analytics for audit trail
    try {
      const analytics = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.ANALYTICS);
      if (analytics) {
        analytics.appendRow([
          fmtDate_(now_(), CONFIG.DATE_FORMAT),
          'MANUAL_REQUEST',
          adminEmail,
          contactTypeUpper,
          '',
          label,
          'COMPLETE',
          0, 0, 0, 1,
          `Admin ${adminEmail} added manual request for ${contactTypeUpper} ${empName} (${contact}) - Poster: ${label}`
        ]);
      }
    } catch (analyticsErr) {
      Logger.log(`[WARN] Analytics logging failed: ${analyticsErr.message}`);
    }
    
    // Visual feedback after dialog closes
    SpreadsheetApp.getActive().toast(
      `✅ ${typeLabel} Request added!\n${empName} → ${label}`,
      'Request Added',
      5
    );
    
    return { success: true, message: 'Request added successfully' };
    
  } catch (err) {
    Logger.log(`[addManualRequest] Error: ${err.message}`);
    return { success: false, message: `Error: ${err.message}` };
  } finally {
    lock.releaseLock();
  }
}
