/** 16_BulkSimulator.gs **/

/**
 * Bulk Submission Simulator for stress-testing and load metrics
 * Generates N randomized submissions and logs performance metrics to Analytics
 */

/**
 * Generate random test employee data
 * @param {number} index - Employee index for unique naming
 * @returns {object} Employee data with email and name
 */
function generateTestEmployee_(index) {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const lastInitials = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  
  const firstName = firstNames[index % firstNames.length];
  const lastInitial = lastInitials[Math.floor(index / firstNames.length) % lastInitials.length];
  const empName = `${firstName} ${lastInitial}`;
  const empEmail = `test.sim.${index}@example.com`;
  
  return { empEmail, empName };
}

/**
 * Generate randomized add/remove sets for a test submission
 * @param {string} empEmail - Employee email
 * @param {Array<object>} activePosters - Available active posters
 * @returns {object} Object with addLabels and removeLabels arrays
 */
function generateRandomSubmissionData_(empEmail, activePosters) {
  if (!activePosters || activePosters.length === 0) {
    return { addLabels: [], removeLabels: [] };
  }
  
  const config = CONFIG.BULK_SIMULATOR;
  const addLabels = [];
  const removeLabels = [];
  
  // Get current requests for this employee
  const currentRequests = getActiveRequestsForEmployee_(empEmail);
  const currentPosterIds = currentRequests.map(r => r.posterId);
  
  // Generate removals (from current requests)
  if (currentRequests.length > 0) {
    const numRemoves = Math.min(
      Math.floor(Math.random() * (config.MAX_REMOVE_PER_SIM + 1)),
      currentRequests.length
    );
    
    for (let i = 0; i < numRemoves; i++) {
      const randomIndex = Math.floor(Math.random() * currentRequests.length);
      const request = currentRequests.splice(randomIndex, 1)[0];
      removeLabels.push(request.label);
    }
  }
  
  // Generate additions (from active posters not currently requested)
  const availablePosters = activePosters.filter(p => !currentPosterIds.includes(p.posterId));
  if (availablePosters.length > 0) {
    const currentSlots = currentRequests.length;
    const slotsAfterRemoval = currentSlots - removeLabels.length;
    const availableSlots = Math.max(0, CONFIG.MAX_ACTIVE - slotsAfterRemoval);
    const numAdds = Math.min(
      Math.floor(Math.random() * (config.MAX_ADD_PER_SIM + 1)),
      availableSlots,
      availablePosters.length
    );
    
    const shuffled = availablePosters.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < numAdds; i++) {
      addLabels.push(shuffled[i].label);
    }
  }
  
  return { addLabels, removeLabels };
}

/**
 * Get active requests for a specific employee
 * @param {string} empEmail - Employee email
 * @returns {Array<object>} Active requests
 */
function getActiveRequestsForEmployee_(empEmail) {
  const sh = getRequestsSheet_();
  const data = getNonEmptyData_(sh, 10);
  
  return data
    .filter(r => 
      String(r[COLS.REQUESTS.EMP_EMAIL - 1]).toLowerCase().trim() === empEmail.toLowerCase().trim() &&
      String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE
    )
    .map(r => ({
      posterId: String(r[COLS.REQUESTS.POSTER_ID - 1]),
      label: String(r[COLS.REQUESTS.LABEL_AT_REQ - 1])
    }));
}

/**
 * Simulate a single form submission with metrics tracking
 * @param {string} empEmail - Employee email
 * @param {string} empName - Employee name
 * @param {Array<string>} addLabels - Posters to add
 * @param {Array<string>} removeLabels - Posters to remove
 * @param {boolean} dryRun - If true, don't actually modify data
 * @returns {object} Simulation metrics
 */
function simulateSingleSubmission_(empEmail, empName, addLabels, removeLabels, dryRun) {
  const metrics = {
    executionTime: 0,
    sheetReads: 0,
    cacheHits: 0,
    lockWaitTime: 0,
    success: false,
    error: null
  };
  
  const startTime = now_().getTime();
  let lockAcquireStart = null;
  
  try {
    // Track lock acquisition time
    lockAcquireStart = now_().getTime();
    const lock = LockService.getScriptLock();
    const lockAcquired = lock.tryLock(5000); // 5 second timeout
    
    if (!lockAcquired) {
      metrics.error = 'Lock timeout';
      metrics.executionTime = now_().getTime() - startTime;
      return metrics;
    }
    
    metrics.lockWaitTime = now_().getTime() - lockAcquireStart;
    
    try {
      if (!dryRun) {
        // Perform actual submission processing
        const formTs = now_();
        const result = processSubmission_(empEmail, empName, formTs, addLabels, removeLabels);
        
        // Track sheet reads (approximate based on operations)
        metrics.sheetReads = 3 + removeLabels.length + addLabels.length;
        
        // Check cache usage (approximate)
        const cacheStats = getCacheStats_();
        metrics.cacheHits = Object.values(cacheStats.caches).filter(c => c.valid).length;
        
        metrics.success = true;
      } else {
        // Dry run - just validate
        metrics.sheetReads = 2; // Minimal reads for validation
        metrics.success = true;
      }
    } finally {
      lock.releaseLock();
    }
    
  } catch (err) {
    metrics.error = err.message || String(err);
  }
  
  metrics.executionTime = now_().getTime() - startTime;
  return metrics;
}

/**
 * Run bulk submission simulator
 * @param {number} N - Number of submissions to simulate
 * @param {boolean} dryRun - If true, don't modify data (default: false)
 * @returns {object} Summary of simulation results
 */
function runBulkSimulator(N, dryRun) {
  dryRun = dryRun === true;
  
  // Apply guardrails
  const config = CONFIG.BULK_SIMULATOR;
  const originalN = N;
  
  if (!N || N < 1) {
    N = config.DEFAULT_SIMULATIONS;
  }
  
  if (N > config.MAX_SIMULATIONS) {
    throw new Error(`Simulation count exceeds maximum allowed (${config.MAX_SIMULATIONS}). Requested: ${N}`);
  }
  
  if (N >= config.WARNING_THRESHOLD && !dryRun) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'High Simulation Count Warning',
      `You are about to run ${N} simulations in LIVE mode. This may consume significant quota.\\n\\nContinue?`,
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      throw new Error('Simulation cancelled by user');
    }
  }
  
  const startTime = now_().getTime();
  const results = {
    simulationCount: N,
    dryRun: dryRun,
    successCount: 0,
    errorCount: 0,
    totalExecutionTime: 0,
    totalSheetReads: 0,
    totalCacheHits: 0,
    totalLockWaitTime: 0,
    totalAdds: 0,
    totalRemoves: 0,
    errors: [],
    avgExecutionTime: 0
  };
  
  try {
    // Get active posters once
    const activePosters = getPostersWithLabels_().filter(p => p.active);
    
    if (activePosters.length === 0) {
      throw new Error('No active posters available for simulation');
    }
    
    Logger.log(`[BULK_SIM] Starting ${N} simulations (dry-run: ${dryRun})`);
    
    // Run N simulations
    for (let i = 0; i < N; i++) {
      const employee = generateTestEmployee_(i);
      const submissionData = generateRandomSubmissionData_(employee.empEmail, activePosters);
      
      const metrics = simulateSingleSubmission_(
        employee.empEmail,
        employee.empName,
        submissionData.addLabels,
        submissionData.removeLabels,
        dryRun
      );
      
      // Aggregate metrics
      results.totalExecutionTime += metrics.executionTime;
      results.totalSheetReads += metrics.sheetReads;
      results.totalCacheHits += metrics.cacheHits;
      results.totalLockWaitTime += metrics.lockWaitTime;
      results.totalAdds += submissionData.addLabels.length;
      results.totalRemoves += submissionData.removeLabels.length;
      
      if (metrics.success) {
        results.successCount++;
      } else {
        results.errorCount++;
        results.errors.push(`Sim ${i + 1}: ${metrics.error}`);
      }
      
      // Progress logging every 10 simulations
      if ((i + 1) % 10 === 0) {
        Logger.log(`[BULK_SIM] Progress: ${i + 1}/${N} simulations completed`);
      }
    }
    
    // Calculate averages
    results.avgExecutionTime = results.successCount > 0 
      ? Math.round(results.totalExecutionTime / results.successCount)
      : 0;
    
    // Log to Analytics
    logBulkSimulationEvent_(results);
    
    Logger.log(`[BULK_SIM] Completed: ${results.successCount} success, ${results.errorCount} errors`);
    
  } catch (err) {
    results.errors.push(`Fatal: ${err.message}`);
    Logger.log(`[BULK_SIM] Fatal error: ${err.message}`);
    throw err;
  }
  
  return results;
}

/**
 * Show bulk simulator dialog (called from admin menu)
 */
function showBulkSimulatorDialog() {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input[type="number"] { width: 100%; padding: 8px; box-sizing: border-box; }
      input[type="checkbox"] { margin-right: 8px; }
      .buttons { margin-top: 20px; }
      button { padding: 10px 20px; margin-right: 10px; }
      .primary { background-color: #4CAF50; color: white; border: none; cursor: pointer; }
      .primary:hover { background-color: #45a049; }
      .secondary { background-color: #f1f1f1; border: 1px solid #ccc; cursor: pointer; }
      .warning { color: #f44336; font-size: 12px; margin-top: 5px; }
      .info { color: #666; font-size: 12px; margin-top: 5px; }
    </style>
    
    <h2>Bulk Submission Simulator</h2>
    <p>Stress-test the system with randomized submissions and capture performance metrics.</p>
    
    <div class="form-group">
      <label for="simCount">Number of Simulations (N):</label>
      <input type="number" id="simCount" min="1" max="${CONFIG.BULK_SIMULATOR.MAX_SIMULATIONS}" 
             value="${CONFIG.BULK_SIMULATOR.DEFAULT_SIMULATIONS}" />
      <div class="info">Maximum: ${CONFIG.BULK_SIMULATOR.MAX_SIMULATIONS}</div>
    </div>
    
    <div class="form-group">
      <label>
        <input type="checkbox" id="dryRun" checked />
        Dry Run Mode (recommended for first test)
      </label>
      <div class="info">Dry run simulates without modifying data</div>
    </div>
    
    <div class="buttons">
      <button class="primary" onclick="runSimulation()">Run Simulation</button>
      <button class="secondary" onclick="google.script.host.close()">Cancel</button>
    </div>
    
    <div id="status" style="margin-top: 20px;"></div>
    
    <script>
      function runSimulation() {
        const simCount = parseInt(document.getElementById('simCount').value);
        const dryRun = document.getElementById('dryRun').checked;
        const status = document.getElementById('status');
        
        if (simCount < 1 || simCount > ${CONFIG.BULK_SIMULATOR.MAX_SIMULATIONS}) {
          status.innerHTML = '<div class="warning">Invalid simulation count</div>';
          return;
        }
        
        if (simCount >= ${CONFIG.BULK_SIMULATOR.WARNING_THRESHOLD} && !dryRun) {
          if (!confirm('You are about to run ' + simCount + ' simulations in LIVE mode. This may consume significant quota. Continue?')) {
            return;
          }
        }
        
        status.innerHTML = '<div style="color: blue;">Running simulation...</div>';
        
        google.script.run
          .withSuccessHandler(function(result) {
            status.innerHTML = '<div style="color: green;"><strong>Simulation Complete!</strong><br/>' +
              'Success: ' + result.successCount + '<br/>' +
              'Errors: ' + result.errorCount + '<br/>' +
              'Total Time: ' + result.totalExecutionTime + 'ms<br/>' +
              'Avg Time: ' + result.avgExecutionTime + 'ms<br/>' +
              'Sheet Reads: ' + result.totalSheetReads + '<br/>' +
              'Cache Hits: ' + result.totalCacheHits + '<br/>' +
              'Lock Wait: ' + result.totalLockWaitTime + 'ms<br/>' +
              '<br/>Check Analytics sheet for detailed metrics.</div>';
          })
          .withFailureHandler(function(error) {
            status.innerHTML = '<div class="warning">Error: ' + error.message + '</div>';
          })
          .runBulkSimulator(simCount, dryRun);
      }
    </script>
  `)
    .setWidth(500)
    .setHeight(450);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Submission Simulator');
}
