/** 16_AdminHealthBanner.gs **/

/**
 * Admin Health Banner System
 * Displays system health indicators on MAIN sheet for quick monitoring
 */

/**
 * Get trigger freshness information
 * Returns data about installed triggers and their last execution
 * @returns {object} Trigger health data
 */
function getTriggerHealth_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const now = new Date().getTime();
    
    const triggerData = {
      formSubmit: { installed: false, handlerFunction: 'handleFormSubmit' },
      sheetEdit: { installed: false, handlerFunction: 'handleSheetEdit' },
      announcementQueue: { installed: false, handlerFunction: 'processAnnouncementQueue' }
    };
    
    triggers.forEach(trigger => {
      const handler = trigger.getHandlerFunction();
      
      if (handler === 'handleFormSubmit') {
        triggerData.formSubmit.installed = true;
        triggerData.formSubmit.eventType = trigger.getEventType();
      } else if (handler === 'handleSheetEdit') {
        triggerData.sheetEdit.installed = true;
        triggerData.sheetEdit.eventType = trigger.getEventType();
      } else if (handler === 'processAnnouncementQueue') {
        triggerData.announcementQueue.installed = true;
        triggerData.announcementQueue.eventType = trigger.getEventType();
      }
    });
    
    // Calculate overall status
    const allInstalled = triggerData.formSubmit.installed && 
                        triggerData.sheetEdit.installed && 
                        triggerData.announcementQueue.installed;
    
    return {
      status: allInstalled ? 'HEALTHY' : 'WARNING',
      triggersInstalled: triggers.length,
      details: triggerData,
      timestamp: now
    };
  } catch (err) {
    Logger.log(`[ERROR] getTriggerHealth_: ${err.message}`);
    return {
      status: 'ERROR',
      triggersInstalled: 0,
      error: err.message,
      timestamp: new Date().getTime()
    };
  }
}

/**
 * Get cache health statistics
 * @returns {object} Cache health data
 */
function getCacheHealth_() {
  try {
    const stats = getCacheStats_();
    const cacheData = stats.caches;
    
    // Count valid caches
    let validCount = 0;
    let totalCount = 0;
    
    Object.values(cacheData).forEach(cache => {
      totalCount++;
      if (cache.valid) validCount++;
    });
    
    // Determine health status
    let status = 'HEALTHY';
    if (validCount === 0) {
      status = 'WARNING'; // No caches, might be cold start
    }
    
    return {
      status: status,
      validCaches: validCount,
      totalCaches: totalCount,
      timestamp: stats.timestamp
    };
  } catch (err) {
    Logger.log(`[ERROR] getCacheHealth_: ${err.message}`);
    return {
      status: 'ERROR',
      validCaches: 0,
      totalCaches: 0,
      error: err.message,
      timestamp: new Date().getTime()
    };
  }
}

/**
 * Get last error information from Error Log sheet
 * @returns {object} Last error data
 */
function getLastErrorInfo_() {
  try {
    const errorSheet = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const data = getNonEmptyData_(errorSheet, 8);
    
    if (data.length === 0) {
      return {
        status: 'HEALTHY',
        lastErrorTime: null,
        message: 'No errors logged',
        timestamp: new Date().getTime()
      };
    }
    
    // Get most recent error (last row)
    const lastError = data[data.length - 1];
    const errorTimestamp = lastError[0]; // Timestamp column
    const errorType = lastError[1];
    const errorMessage = lastError[3];
    const isResolved = lastError[5];
    
    // Check how old the error is
    const now = new Date().getTime();
    const errorTime = new Date(errorTimestamp).getTime();
    const ageInHours = (now - errorTime) / (1000 * 60 * 60);
    
    // Determine status based on error age and resolution
    let status = 'HEALTHY';
    if (!isResolved && ageInHours < 1) {
      status = 'ERROR';
    } else if (!isResolved && ageInHours < 24) {
      status = 'WARNING';
    }
    
    return {
      status: status,
      lastErrorTime: errorTimestamp,
      errorType: errorType,
      message: errorMessage,
      resolved: isResolved,
      ageInHours: ageInHours.toFixed(1),
      timestamp: now
    };
  } catch (err) {
    Logger.log(`[ERROR] getLastErrorInfo_: ${err.message}`);
    return {
      status: 'ERROR',
      lastErrorTime: null,
      message: `Failed to read error log: ${err.message}`,
      timestamp: new Date().getTime()
    };
  }
}

/**
 * Get announcement queue size
 * @returns {object} Queue data
 */
function getAnnouncementQueueInfo_() {
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const queueSize = Object.keys(queue).length;
    
    // Determine status
    let status = 'HEALTHY';
    if (queueSize > 10) {
      status = 'WARNING'; // Large queue might indicate delivery issues
    }
    
    return {
      status: status,
      queueSize: queueSize,
      items: Object.keys(queue).map(id => queue[id].title),
      timestamp: new Date().getTime()
    };
  } catch (err) {
    Logger.log(`[ERROR] getAnnouncementQueueInfo_: ${err.message}`);
    return {
      status: 'ERROR',
      queueSize: 0,
      error: err.message,
      timestamp: new Date().getTime()
    };
  }
}

/**
 * Collect all health data
 * @returns {object} Complete health status
 */
function collectHealthData_() {
  const triggerHealth = getTriggerHealth_();
  const cacheHealth = getCacheHealth_();
  const errorInfo = getLastErrorInfo_();
  const queueInfo = getAnnouncementQueueInfo_();
  
  // Determine overall status (worst case)
  const statuses = [
    triggerHealth.status,
    cacheHealth.status,
    errorInfo.status,
    queueInfo.status
  ];
  
  let overallStatus = 'HEALTHY';
  if (statuses.includes('ERROR')) {
    overallStatus = 'ERROR';
  } else if (statuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }
  
  return {
    overall: overallStatus,
    triggers: triggerHealth,
    cache: cacheHealth,
    errors: errorInfo,
    queue: queueInfo,
    lastRefresh: fmtDate_(now_(), CONFIG.DATE_FORMAT)
  };
}

/**
 * Render health banner on MAIN sheet
 * DEPRECATED: Health banner is now shown in Documentation tab instead.
 * This function is kept for backwards compatibility but does not render.
 */
function renderHealthBanner_() {
  // Health banner rendering moved to Documentation tab via getSystemHealthSection_()
  // This function is deprecated but kept to avoid breaking existing code
  Logger.log('[HEALTH_BANNER] (Deprecated - health info now in Documentation tab)');
}

/**
 * Refresh health banner (menu action)
 */
function refreshHealthBanner() {
  try {
    SpreadsheetApp.getActive().toast('Refreshing health banner...', 'System Health', 2);
    renderHealthBanner_();
    SpreadsheetApp.getActive().toast('✅ Health banner updated!', 'System Health', 3);
  } catch (err) {
    logError_(err, 'refreshHealthBanner', {});
    SpreadsheetApp.getUi().alert(`Error refreshing health banner: ${err.message}`);
  }
}

/**
 * Initialize health banner on setup
 */
function initializeHealthBanner_() {
  try {
    renderHealthBanner_();
    Logger.log('[HEALTH_BANNER] Initialized');
  } catch (err) {
    Logger.log(`[ERROR] initializeHealthBanner_: ${err.message}`);
  }
}
