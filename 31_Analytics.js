/** 31_Analytics.js **/

/**
 * Comprehensive Logging & Audit Dashboard
 * 
 * Tracks system metrics, usage patterns, and performance data.
 */

/**
 * Log an analytics event.
 * 
 * @param {string} eventType - Type of event (e.g., 'form_submission', 'board_rebuild', 'error')
 * @param {string} userEmail - User email (optional)
 * @param {Object} details - Additional event details
 * @param {number} executionTime - Execution time in milliseconds (optional)
 * @param {boolean} success - Whether the operation succeeded
 * @returns {void}
 */
function logAnalyticsEvent_(eventType, userEmail, details, executionTime, success = true) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const timestamp = now_();
    
    const row = [];
    row[COLS.ANALYTICS.TIMESTAMP - 1] = timestamp;
    row[COLS.ANALYTICS.EVENT_TYPE - 1] = eventType;
    row[COLS.ANALYTICS.USER_EMAIL - 1] = userEmail || '';
    row[COLS.ANALYTICS.DETAILS - 1] = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    row[COLS.ANALYTICS.EXECUTION_TIME - 1] = executionTime || '';
    row[COLS.ANALYTICS.SUCCESS - 1] = success;
    
    sh.appendRow(row);
  } catch (error) {
    console.error(`[logAnalyticsEvent] Failed to log event: ${error.message}`);
  }
}

/**
 * Track a form submission event.
 * 
 * @param {string} empEmail - Employee email
 * @param {boolean} success - Whether submission was successful
 * @param {Object} details - Submission details (added, removed, denied)
 * @param {number} executionTime - Time taken to process
 * @returns {void}
 */
function trackFormSubmission_(empEmail, success, details, executionTime) {
  logAnalyticsEvent_('form_submission', empEmail, details, executionTime, success);
}

/**
 * Track a board rebuild event.
 * 
 * @param {string} boardType - Type of board ('main', 'employees', or 'both')
 * @param {number} requestCount - Number of requests processed
 * @param {number} executionTime - Time taken to rebuild
 * @returns {void}
 */
function trackBoardRebuild_(boardType, requestCount, executionTime) {
  const details = {
    board_type: boardType,
    request_count: requestCount
  };
  logAnalyticsEvent_('board_rebuild', '', details, executionTime, true);
}

/**
 * Track an announcement event.
 * 
 * @param {number} recipientCount - Number of recipients
 * @param {number} posterCount - Number of posters announced
 * @param {boolean} success - Whether emails were sent successfully
 * @returns {void}
 */
function trackAnnouncement_(recipientCount, posterCount, success) {
  const details = {
    recipients: recipientCount,
    posters: posterCount
  };
  logAnalyticsEvent_('announcement_sent', '', details, null, success);
}

/**
 * Track poster request patterns.
 * 
 * @param {string} posterId - Poster ID
 * @param {string} posterTitle - Poster title
 * @param {string} action - Action type ('add' or 'remove')
 * @returns {void}
 */
function trackPosterRequest_(posterId, posterTitle, action) {
  const details = {
    poster_id: posterId,
    poster_title: posterTitle,
    action: action
  };
  logAnalyticsEvent_('poster_request', '', details, null, true);
}

/**
 * Track cache hit/miss statistics.
 * 
 * @param {string} cacheKey - Cache key accessed
 * @param {boolean} hit - Whether it was a cache hit
 * @returns {void}
 */
function trackCacheAccess_(cacheKey, hit) {
  const details = {
    cache_key: cacheKey,
    result: hit ? 'hit' : 'miss'
  };
  logAnalyticsEvent_('cache_access', '', details, null, true);
}

/**
 * Get analytics summary for a date range.
 * 
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Analytics summary
 */
function getAnalyticsSummary_(startDate, endDate) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(sh, 6);
    
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    const filtered = data.filter(r => {
      const ts = r[COLS.ANALYTICS.TIMESTAMP - 1];
      const time = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
      return time >= start && time <= end;
    });
    
    const summary = {
      total_events: filtered.length,
      form_submissions: 0,
      board_rebuilds: 0,
      announcements: 0,
      errors: 0,
      success_rate: 0,
      avg_execution_time: 0
    };
    
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let successCount = 0;
    
    filtered.forEach(r => {
      const eventType = r[COLS.ANALYTICS.EVENT_TYPE - 1];
      const success = r[COLS.ANALYTICS.SUCCESS - 1];
      const execTime = r[COLS.ANALYTICS.EXECUTION_TIME - 1];
      
      if (eventType === 'form_submission') summary.form_submissions++;
      if (eventType === 'board_rebuild') summary.board_rebuilds++;
      if (eventType === 'announcement_sent') summary.announcements++;
      if (eventType === 'error') summary.errors++;
      
      if (success) successCount++;
      
      if (execTime && typeof execTime === 'number') {
        totalExecutionTime += execTime;
        executionTimeCount++;
      }
    });
    
    summary.success_rate = filtered.length > 0 ? (successCount / filtered.length * 100).toFixed(2) : 0;
    summary.avg_execution_time = executionTimeCount > 0 ? (totalExecutionTime / executionTimeCount).toFixed(2) : 0;
    
    return summary;
  } catch (error) {
    console.error(`[getAnalyticsSummary] Error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Get most frequently requested posters.
 * 
 * @param {number} limit - Number of top posters to return (default: 10)
 * @returns {Array} Array of {poster_id, poster_title, count}
 */
function getMostRequestedPosters_(limit = 10) {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(sh, 6);
    
    const posterCounts = {};
    
    data.forEach(r => {
      const eventType = r[COLS.ANALYTICS.EVENT_TYPE - 1];
      if (eventType === 'poster_request') {
        const details = r[COLS.ANALYTICS.DETAILS - 1];
        try {
          const parsed = JSON.parse(details);
          if (parsed.poster_id && parsed.action === 'add') {
            const key = `${parsed.poster_id}|${parsed.poster_title}`;
            posterCounts[key] = (posterCounts[key] || 0) + 1;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });
    
    // Convert to array and sort
    const sorted = Object.entries(posterCounts)
      .map(([key, count]) => {
        const [poster_id, poster_title] = key.split('|');
        return { poster_id, poster_title, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return sorted;
  } catch (error) {
    console.error(`[getMostRequestedPosters] Error: ${error.message}`);
    return [];
  }
}

/**
 * Detect anomalies in request patterns.
 * 
 * @returns {Object} Anomaly detection results
 */
function detectAnomalies_() {
  try {
    const sh = getSheet_(CONFIG.SHEETS.ANALYTICS);
    const data = getNonEmptyData_(sh, 6);
    
    // Get last 24 hours of data
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentData = data.filter(r => {
      const ts = r[COLS.ANALYTICS.TIMESTAMP - 1];
      const time = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
      return time >= oneDayAgo;
    });
    
    // Count submissions per hour
    const hourlySubmissions = {};
    recentData.forEach(r => {
      const eventType = r[COLS.ANALYTICS.EVENT_TYPE - 1];
      if (eventType === 'form_submission') {
        const ts = r[COLS.ANALYTICS.TIMESTAMP - 1];
        const hour = new Date(ts).getHours();
        hourlySubmissions[hour] = (hourlySubmissions[hour] || 0) + 1;
      }
    });
    
    // Calculate average and detect spikes
    const counts = Object.values(hourlySubmissions);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length || 0;
    const threshold = avg * 3; // 3x average is considered a spike
    
    const anomalies = {
      has_spike: false,
      spike_hours: [],
      avg_hourly_rate: avg.toFixed(2),
      threshold: threshold.toFixed(2)
    };
    
    Object.entries(hourlySubmissions).forEach(([hour, count]) => {
      if (count > threshold) {
        anomalies.has_spike = true;
        anomalies.spike_hours.push({ hour, count });
      }
    });
    
    return anomalies;
  } catch (error) {
    console.error(`[detectAnomalies] Error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Get announcement queue status.
 * 
 * @returns {Object} Queue status with pending count and last process time
 */
function getAnnouncementQueueStatus_() {
  try {
    const queue = readJsonProp_(CONFIG.PROPS.ANNOUNCE_QUEUE, {});
    const announced = readJsonProp_(CONFIG.PROPS.ANNOUNCED_IDS, {});
    const lastProcessTime = readJsonProp_(CONFIG.PROPS.LAST_ANALYTICS_FLUSH, 0);
    
    return {
      pending_count: Object.keys(queue).length,
      pending_posters: Object.values(queue).map(p => p.title),
      announced_count: Object.keys(announced).length,
      last_process_time: lastProcessTime ? new Date(lastProcessTime) : null,
      time_since_last_ms: lastProcessTime ? Date.now() - lastProcessTime : null
    };
  } catch (error) {
    console.error(`[getAnnouncementQueueStatus] Error: ${error.message}`);
    return { error: error.message };
  }
}
