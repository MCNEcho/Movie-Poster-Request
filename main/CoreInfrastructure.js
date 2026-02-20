// === CORE INFRASTRUCTURE MODULE ===
// Consolidates: Config.js, CacheManager.js, ErrorHandler.js, Utils.js
// Provides: Configuration, Caching, Error Handling, Core Utilities

// ===== CONFIG & COLS =====

const CONFIG = {
  TIMEZONE: 'America/Los_Angeles',

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form - Pasco',
    DESCRIPTION:
      'You can only have your name on 7 posters at a time. If you already have all 7 slots maxed out and you want a different poster, remove one from your selection to choose a new one.',
  },

  FORM: {
    Q_EMPLOYEE_NAME: 'Name (First Name + Last Initial)',
    Q_ADD: 'Request Posters (Add)',
    Q_REMOVE: 'Remove Posters',
    Q_SUBSCRIBE: 'Subscribe to Notifications',
  },

  SHEETS: {
    MAIN: 'Main',
    EMPLOYEES: 'Employees',
    REQUEST_ORDER: 'Request Order',
    MOVIE_POSTERS: 'Movie Posters',  // DEPRECATED: Use INVENTORY instead (kept for backward compatibility)
    INVENTORY: 'Inventory',          // PRIMARY: Canonical source for poster data
    PRINT_OUT: 'Print Out',
    POSTER_OUTSIDE: 'Poster Outside',
    POSTER_INSIDE: 'Poster Inside',
    REQUESTS: 'Requests',       // script-created
    SUBSCRIBERS: 'Subscribers', // script-created
    DOCUMENTATION: 'Documentation',
    ERROR_LOG: 'Error Log',     // script-created - Task 1
    ANALYTICS: 'Analytics',     // script-created - Task 3
    ANALYTICS_SUMMARY: 'Analytics Summary', // script-created - Task 3
    DATA_INTEGRITY: 'Data Integrity', // script-created - Task 5
  },

  MAX_ACTIVE: 7,

  // Deduplication configuration (Feature: Config flags for dedup rules)
  ALLOW_REREQUEST_AFTER_REMOVAL: true, // Allow re-requesting a poster after removal
  REREQUEST_COOLDOWN_DAYS: 0, // Days to wait before re-request (0 = immediate if ALLOW_REREQUEST_AFTER_REMOVAL is true)

  // Cache configuration (Task 2 - Performance Optimization)
  CACHE_TTL_MINUTES: 5, // Cache time-to-live in minutes
  
  // Analytics configuration (Task 3 - Logging & Monitoring)
  DATE_FORMAT: 'MM/dd/yyyy HH:mm:ss',
  
  // Admin email for error notifications (Task 1 - Error Handling)
  ADMIN_EMAIL: '', // Leave blank to use spreadsheet owner

  // Bulk Simulator configuration (Task 5 - Bulk Submission Simulator)
  BULK_SIMULATOR: {
    MAX_SIMULATIONS: 100,        // Hard cap on number of simulations per run
    DEFAULT_SIMULATIONS: 10,     // Default number if not specified
    WARNING_THRESHOLD: 50,       // Warn user if N >= this value
    MAX_ADD_PER_SIM: 3,         // Max posters to add in a single simulation
    MAX_REMOVE_PER_SIM: 3,      // Max posters to remove in a single simulation
  },

  // Backup configuration (Task 8 - Nightly Data Backup)
  BACKUP: {
    RETENTION_DAYS: 30,           // Keep backups for 30 days
    FORMAT: 'CSV',                // 'CSV' or 'SHEET' (Google Sheet copy)
    FOLDER_NAME: 'Poster System Backups', // Drive folder name
    ENABLED: true,                // Set to false to disable backups
    SHEETS_TO_BACKUP: [
      'Requests',                 // Complete audit trail
      'Request Order',            // Submission history
      'Inventory'                 // Inventory tracking
    ],
  },

  INVENTORY_LAST_UPDATED_CELL: 'A1',

  PRINT: {
    FORM_URL_CELL: 'B1',
    EMP_VIEW_URL_CELL: 'B2',
    FORM_QR_CELL: 'D1',
    EMP_QR_CELL: 'D2',
    LAST_UPDATED_CELL: 'H1',
    LIST_START_ROW: 6,
  },

  PROPS: {
    FORM_ID: 'POSTER_SYSTEM_FORM_ID',
    EMPLOYEE_VIEW_SSID: 'EMPLOYEE_VIEW_SSID',
    LABEL_TO_ID: 'LABEL_TO_ID_MAP_JSON',
    ID_TO_CURRENT_LABEL: 'ID_TO_CURRENT_LABEL_JSON',

    INVENTORY_SNAPSHOT: 'INVENTORY_SNAPSHOT_JSON',

    ANNOUNCEMENT_QUEUE: 'ANNOUNCE_QUEUE_JSON',
    ANNOUNCED_IDS: 'ANNOUNCED_POSTER_IDS_JSON',
    CUSTOM_ANNOUNCE_QUEUE: 'CUSTOM_ANNOUNCE_QUEUE_JSON',
    BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
  },

  // Announcement batching configuration
  ANNOUNCEMENT: {
    BATCHING_ENABLED: true,
    BATCH_SIZE: 5, // Max posters per email
    THROTTLE_MS: 1000, // Delay between emails
    RETRY_ATTEMPTS: 3,
    RETRY_INITIAL_DELAY_MS: 500,
  },

  // Email templates with variable support
  TEMPLATES: {
    DEFAULT: {
      subject: 'We Have Added More Posters to the Request Form!',
      body: `We Have Added More Posters to the Request Form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    SINGLE_POSTER: {
      subject: 'New Poster Available: {{TITLE}}',
      body: `A new poster is now available!

Title: {{TITLE}}
Release Date: {{RELEASE}}
Stock: {{STOCK}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    BATCH: {
      subject: 'New Posters Available - {{COUNT}} Added!',
      body: `We've added {{COUNT}} new posters to the request form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    }
  },
};

// 1-based column indexes
const COLS = {
  INVENTORY: {
    ACTIVE: 1,        // NEW: Checkbox for activation
    RELEASE: 2,       // Shifted from 1
    TITLE: 3,         // Shifted from 2
    COMPANY: 4,       // Shifted from 3
    POSTERS: 5,       // Shifted from 4 - Primary tracking column
    BUS: 6,           // Shifted from 5
    MINI: 7,          // Shifted from 6
    STANDEE: 8,       // Shifted from 7
    TEASER: 9,        // Shifted from 8
    NOTES: 10,        // Notes moved to column J
    POSTER_ID: 11,    // Poster ID moved to column K
    // Column L reserved/unused; Poster Received Date removed
  },

  MOVIE_POSTERS: {
    ACTIVE: 1,
    POSTER_ID: 2,n    TITLE: 3,
    RELEASE: 4,
    INV_COUNT: 5,
    RECEIVED: 6,
    NOTES: 7,
    CLOSE_QUEUE: 8,
  },

  REQUESTS: {
    REQ_TS: 1,
    EMP_EMAIL: 2,
    EMP_NAME: 3,
    POSTER_ID: 4,
    LABEL_AT_REQ: 5,
    TITLE_SNAP: 6,
    RELEASE_SNAP: 7,
    ACTION_TYPE: 8,
    STATUS: 9,
    STATUS_TS: 10,
  },

  REQUEST_ORDER: {
    FORM_TS: 1,
    EMP_EMAIL: 2,
    ADD_RAW: 3,
    REMOVE_RAW: 4,
    SLOTS_BEFORE: 5,
    SLOTS_AFTER: 6,
    ADDED_ACCEPTED: 7,
    REMOVED_APPLIED: 8,
    DENIED_ADDS: 9,
    NOTES: 10,
  },

  SUBSCRIBERS: { ACTIVE: 1, EMAIL: 2, NAME: 3 },
};

const STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
  REMOVED_INVENTORY_DELETE: 'REMOVED_INVENTORY_DELETE',
};

// ===== CACHE MANAGEMENT =====

const CACHE_CONFIG = {
  EMPLOYEE_SLOTS: 'CACHE_EMPLOYEE_SLOTS',
  POSTER_AVAILABILITY: 'CACHE_POSTER_AVAILABILITY',
  BOARD_MAIN: 'CACHE_BOARD_MAIN',
  BOARD_EMPLOYEES: 'CACHE_BOARD_EMPLOYEES',
  ACTIVE_SUBSCRIBERS: 'CACHE_ACTIVE_SUBSCRIBERS',
  POSTERS_WITH_LABELS: 'CACHE_POSTERS_WITH_LABELS',
  POSTER_ID_MAP: 'CACHE_POSTER_ID_MAP',
};

function getCacheTTL_() {
  return (CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
}

function setCache_(key, value) {
  try {
    const entry = {
      value: value,
      timestamp: now_().getTime(),
      ttl: getCacheTTL_()
    };
    writeJsonProp_(key, entry);
  } catch (err) {
    Logger.log(`[WARN] Cache set failed for ${key}: ${err.message}`);
  }
}

function getCache_(key) {
  try {
    const entry = readJsonProp_(key, null);
    if (!entry) return null;

    const age = now_().getTime() - entry.timestamp;
    if (age > entry.ttl) {
      clearCache_(key);
      return null;
    }

    return entry.value;
  } catch (err) {
    Logger.log(`[WARN] Cache get failed for ${key}: ${err.message}`);
    return null;
  }
}

function clearCache_(key) {
  try {
    getProps_().deleteProperty(key);
  } catch (err) {
    Logger.log(`[WARN] Cache clear failed for ${key}: ${err.message}`);
  }
}

function clearAllCaches_() {
  Object.values(CACHE_CONFIG).forEach(key => {
    clearCache_(key);
  });
  Logger.log('[CACHE] All caches cleared');
}

function countActiveSlots_Cached(empEmail) {
  const key = CACHE_CONFIG.EMPLOYEE_SLOTS;
  let cache = getCache_(key);
  
  if (!cache) {
    cache = {};
  }

  if (cache[empEmail] !== undefined) {
    return cache[empEmail];
  }

  // Compute and cache
  const count = countActiveSlotsByEmail_(empEmail);
  cache[empEmail] = count;
  setCache_(key, cache);
  
  return count;
}

function invalidateEmployeeSlots_(empEmail) {
  const key = CACHE_CONFIG.EMPLOYEE_SLOTS;
  let cache = getCache_(key);
  
  if (cache && cache[empEmail] !== undefined) {
    delete cache[empEmail];
    if (Object.keys(cache).length > 0) {
      setCache_(key, cache);
    } else {
      clearCache_(key);
    }
  }
}

function getPosterAvailability_Cached() {
  const key = CACHE_CONFIG.POSTER_AVAILABILITY;
  let cache = getCache_(key);

  if (cache) return cache;

  // Compute availability from Inventory
  cache = {};
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, COLS.INVENTORY.NOTES || 12);

  data.forEach((row, idx) => {
    const isActive = row[COLS.INVENTORY.ACTIVE - 1];
    const posterId = row[COLS.INVENTORY.POSTER_ID - 1];
    const invCount = row[COLS.INVENTORY.POSTERS - 1];

    if (isActive && posterId && invCount) {
      cache[String(posterId)] = Number(invCount || 0);
    }
  });

  setCache_(key, cache);
  return cache;
}

function invalidatePosterAvailability_() {
  clearCache_(CACHE_CONFIG.POSTER_AVAILABILITY);
}

function getBoardMainData_Cached() {
  const key = CACHE_CONFIG.BOARD_MAIN;
  const cache = getCache_(key);

  if (cache) return cache;

  return null;
}

function invalidateBoardMain_() {
  clearCache_(CACHE_CONFIG.BOARD_MAIN);
}

function getBoardEmployeesData_Cached() {
  const key = CACHE_CONFIG.BOARD_EMPLOYEES;
  const cache = getCache_(key);

  if (cache) return cache;

  return null;
}

function invalidateBoardEmployees_() {
  clearCache_(CACHE_CONFIG.BOARD_EMPLOYEES);
}

function getActiveSubscriberEmails_Cached() {
  const key = CACHE_CONFIG.ACTIVE_SUBSCRIBERS;
  let cache = getCache_(key);

  if (Array.isArray(cache)) return cache;

  // Compute
  const subSheet = getSheet_(CONFIG.SHEETS.SUBSCRIBERS);
  const data = getNonEmptyData_(subSheet, 2);

  cache = data
    .filter(row => row[0] === true) // Active checkbox
    .map(row => String(row[1] || '').trim().toLowerCase())
    .filter(Boolean);

  setCache_(key, cache);
  return cache;
}

function invalidateActiveSubscribers_() {
  clearCache_(CACHE_CONFIG.ACTIVE_SUBSCRIBERS);
}

function getPostersWithLabels_Cached() {
  const key = CACHE_CONFIG.POSTERS_WITH_LABELS;
  let cache = getCache_(key);

  if (Array.isArray(cache) && cache.length > 0) return cache;

  cache = getPostersWithLabels_();
  setCache_(key, cache);
  return cache;
}

function invalidatePostersWithLabels_() {
  clearCache_(CACHE_CONFIG.POSTERS_WITH_LABELS);
}

function invalidateCachesAfterWrite_(opts) {
  try {
    if (opts && opts.empEmail) invalidateEmployeeSlots_(opts.empEmail.toLowerCase().trim());
  } catch (err) {
    Logger.log(`[WARN] Cache invalidation (employee slots) failed: ${err.message}`);
  }

  invalidateBoardMain_();
  invalidateBoardEmployees_();
  invalidatePosterAvailability_();
  invalidatePostersWithLabels_();
}

function getCacheStats_() {
  const stats = {
    timestamp: now_().getTime(),
    caches: {}
  };

  Object.entries(CACHE_CONFIG).forEach(([name, key]) => {
    const entry = readJsonProp_(key, null);
    const isValid = entry && (now_().getTime() - entry.timestamp) <= entry.ttl;
    
    stats.caches[name] = {
      cached: !!entry,
      valid: isValid,
      age_ms: entry ? (now_().getTime() - entry.timestamp) : null,
      ttl_ms: entry ? entry.ttl : null
    };
  });

  return stats;
}

function logCacheStats_() {
  try {
    const stats = getCacheStats_();
    Logger.log('[CACHE] Stats: ' + JSON.stringify(stats));
  } catch (err) {
    Logger.log(`[WARN] Cache stats logging failed: ${err.message}`);
  }
}

// ===== ERROR HANDLING =====

function ensureErrorTrackingSheet_() {
  const ss = SpreadsheetApp.getActive();
  const headers = [
    'Timestamp',
    'Error Type',
    'Function',
    'Message',
    'Stack Trace',
    'Resolved',
    'Resolution Date',
    'Admin Notes'
  ];
  return ensureSheetWithHeaders_(ss, CONFIG.SHEETS.ERROR_LOG, headers);
}

function logError_(error, functionName, context) {
  try {
    const timestamp = now_();
    const errorType = error.constructor.name || 'UnknownError';
    const message = String(error.message || error);
    const stackTrace = String(error.stack || '');

    Logger.log(`[ERROR] ${functionName}: ${message}`);

    // Append to error log sheet
    const errorSheet = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const contextStr = context ? JSON.stringify(context) : '';
    
    errorSheet.appendRow([
      fmtDate_(timestamp, CONFIG.DATE_FORMAT),
      errorType,
      functionName,
      message,
      stackTrace.substring(0, 500), // Truncate to avoid sheet cell limits
      false,
      '',
      contextStr
    ]);
  } catch (logErr) {
    // Fallback to console if logging fails
    Logger.log(`[CRITICAL] Error logging failed: ${logErr.message}`);
  }
}

function notifyAdminOfError_(error, functionName, severity) {
  try {
    // Only send critical errors to avoid email spam
    if (severity !== 'CRITICAL') return;

    const adminEmail = getAdminEmail_();
    if (!adminEmail) return;

    const subject = `🚨 [CRITICAL] Poster System Error: ${functionName}`;
    const body = `
ERROR DETAILS:
==============
Function: ${functionName}
Error Type: ${error.constructor.name || 'Unknown'}
Message: ${error.message || error}
Timestamp: ${new Date()}
Branch: beta-1.01

STACK TRACE:
============
${error.stack || 'No stack trace available'}

Please check the Error Log sheet in the spreadsheet for more details.

This is an automated notification from the Poster Request System.
    `.trim();

    GmailApp.sendEmail(adminEmail, subject, body);
  } catch (emailErr) {
    Logger.log(`[ERROR] Failed to send admin notification: ${emailErr.message}`);
  }
}

function retryWithBackoff_(fn, maxAttempts = 3, initialDelayMs = 500) {
  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxAttempts;
      const isTransient = isTransientError_(err);

      if (isLastAttempt || !isTransient) {
        throw err;
      }

      Logger.log(`[RETRY] Attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms...`);
      Utilities.sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError;
}

function isTransientError_(error) {
  const message = String(error.message || error).toLowerCase();
  
  // Lock timeout errors
  if (message.includes('timeout') || message.includes('lock')) return true;
  
  // Service temporarily unavailable
  if (message.includes('temporarily unavailable')) return true;
  
  // Rate limiting (429)
  if (message.includes('429') || message.includes('too many requests')) return true;
  
  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) return true;

  return false;
}

function safeFormOperation_(fn, operationName) {
  try {
    return fn();
  } catch (err) {
    logError_(err, `safeFormOperation[${operationName}]`, { operation: operationName });
    Logger.log(`[WARN] Form operation failed: ${operationName}`);
    return null;
  }
}

function safeSheetOperation_(fn, operationName) {
  try {
    return fn();
  } catch (err) {
    logError_(err, `safeSheetOperation[${operationName}]`, { operation: operationName });
    Logger.log(`[WARN] Sheet operation failed: ${operationName}`);
    return null;
  }
}

function getAdminEmail_() {
  // Try to get from config or script properties
  return String(CONFIG.ADMIN_EMAIL || getProps_().getProperty('ADMIN_EMAIL') || '').trim();
}

function cleanupErrorLog_() {
  try {
    const errorSheet = getSheet_(CONFIG.SHEETS.ERROR_LOG);
    const data = getNonEmptyData_(errorSheet, 8);
    if (data.length === 0) return;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Mark very old errors as archived (don't delete)
    data.forEach((row, idx) => {
      const rowNum = idx + 2; // Account for header
      const dateStr = row[0];
      try {
        const date = new Date(dateStr);
        if (date < ninetyDaysAgo) {
          // Just mark as old, don't delete
          Logger.log(`[ARCHIVE] Old error from ${dateStr}`);
        }
      } catch (e) {
        // Skip if date parsing fails
      }
    });
  } catch (err) {
    Logger.log(`[WARN] Error log cleanup failed: ${err.message}`);
  }
}

// ===== CORE UTILITIES =====

function now_() { return new Date(); }

function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
}

function normalizeTitle_(s) {
  return String(s || '').trim().toLowerCase();
}

function getProps_() {
  return PropertiesService.getScriptProperties();
}

function isMasterAccount_() {
  const configuredAdmin = String(CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();
  const ss = SpreadsheetApp.getActive();
  const ownerEmail = String(ss.getOwner().getEmail() || '').toLowerCase().trim();
  const currentUser = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || '').toLowerCase().trim();

  if (configuredAdmin) return currentUser && currentUser === configuredAdmin;
  return currentUser && currentUser === ownerEmail;
}

// ===== PROPERTY UTILITIES =====

/**
 * Read a raw string property from ScriptProperties.
 * @param {string} key - Property key
 * @param {string} fallback - Default value if property doesn't exist
 * @return {string} Property value or fallback
 */
function readProp_(key, fallback = '') {
  const val = getProps_().getProperty(key);
  return val !== null ? val : fallback;
}

/**
 * Write a raw string property to ScriptProperties.
 * @param {string} key - Property key
 * @param {string} value - Value to store
 */
function writeProp_(key, value) {
  getProps_().setProperty(key, String(value || ''));
}

/**
 * Delete a property from ScriptProperties.
 * @param {string} key - Property key
 */
function deleteProp_(key) {
  getProps_().deleteProperty(key);
}

/**
 * Read a JSON property from ScriptProperties (parses JSON).
 * @param {string} key - Property key
 * @param {*} fallback - Default value if property doesn't exist or parsing fails
 * @return {*} Parsed JSON value or fallback
 */
function readJsonProp_(key, fallback) {
  const raw = getProps_().getProperty(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

/**
 * Write a JSON property to ScriptProperties (stringifies object).
 * @param {string} key - Property key
 * @param {*} obj - Object to stringify and store
 */
function writeJsonProp_(key, obj) {
  getProps_().setProperty(key, JSON.stringify(obj || {}));
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (headers && headers.length) {
    const existing = sh.getRange(1,1,1,headers.length).getValues()[0];
    const needs = existing.join('') !== headers.join('');
    if (needs) {
      sh.getRange(1,1,1,headers.length).setValues([headers]);
    }
  }
  return sh;
}

function getSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function setCheckboxColumn_(sheet, col, startRow, numRows) {
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sheet.getRange(startRow, col, numRows - startRow + 1, 1).setDataValidation(rule);
}

function getNonEmptyData_(sheet, minCols) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.max(minCols || 1, sheet.getLastColumn());
  const vals = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return vals.filter(r => r.some(v => v !== '' && v !== null));
}

function safeArray_(v) {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\s*,\s*/).filter(Boolean);
}

function uuidPosterId_() {
  const hex = Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  return `P-${hex}`;
}

function normalizeEmployeeName_(input) {
  const raw = String(input || '').trim();

  // First name + last initial (optional trailing period)
  const m = raw.match(/^([A-Za-z][A-Za-z'-]{1,})\s+([A-Za-z])\.?$/);
  if (!m) {
    return { ok: false, canonical: '', reason: 'Name must be: FirstName + LastInitial (ex: "Gavin N")' };
  }

  const first = m[1];
  const initial = m[2].toUpperCase();
  const firstNice = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();

  return { ok: true, canonical: `${firstNice} ${initial}`, reason: '' };
}

function getPostersWithLabels_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const data = getNonEmptyData_(inv, 11, 3);
  
  const posters = data.map(r => ({
    posterId: String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim(),
    title: String(r[COLS.INVENTORY.TITLE - 1] || '').trim(),
    release: r[COLS.INVENTORY.RELEASE - 1],
    active: r[COLS.INVENTORY.ACTIVE - 1] === true,
    invCount: r[COLS.INVENTORY.POSTERS - 1],
  })).filter(p => p.posterId && p.title && p.release);

  // Count duplicates by title
  const titleCounts = {};
  posters.forEach(p => {
    const k = normalizeTitle_(p.title);
    titleCounts[k] = (titleCounts[k] || 0) + 1;
  });

  // Add computed labels
  posters.forEach(p => {
    const dup = titleCounts[normalizeTitle_(p.title)] > 1;
    const rd = (p.release instanceof Date) ? fmtDate_(p.release, 'yyyy-MM-dd') : String(p.release);
    p.label = dup ? `${p.title} (${rd})` : p.title;
  });

  return posters;
}

function getActiveRequests_() {
  const sh = getSheet_(CONFIG.SHEETS.REQUESTS);
  const data = getNonEmptyData_(sh, 10);
  return data.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
}

function sortInventoryByReleaseDate_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  const lastRow = inv.getLastRow();
  if (lastRow < 3) return;
  const range = inv.getRange(3, 1, lastRow - 2, inv.getLastColumn());
  range.sort(COLS.INVENTORY.RELEASE);
}
