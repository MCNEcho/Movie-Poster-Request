/** 02A_CacheManager.gs **/

/**
 * Caching layer for performance optimization
 * Reduces sheet read quota by caching computed results with TTL
 */

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  EMPLOYEE_SLOTS: 'CACHE_EMPLOYEE_SLOTS',
  POSTER_AVAILABILITY: 'CACHE_POSTER_AVAILABILITY',
  BOARD_MAIN: 'CACHE_BOARD_MAIN',
  BOARD_EMPLOYEES: 'CACHE_BOARD_EMPLOYEES',
  ACTIVE_SUBSCRIBERS: 'CACHE_ACTIVE_SUBSCRIBERS',
  POSTERS_WITH_LABELS: 'CACHE_POSTERS_WITH_LABELS',
  POSTER_ID_MAP: 'CACHE_POSTER_ID_MAP',
};

/**
 * Get cache TTL from config (default 5 minutes)
 * @returns {number} TTL in milliseconds
 */
function getCacheTTL_() {
  return (CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
}

/**
 * Set a cache entry with TTL
 * @param {string} key - Cache key from CACHE_CONFIG
 * @param {*} value - Value to cache
 */
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

/**
 * Get a cache entry if still valid
 * @param {string} key - Cache key from CACHE_CONFIG
 * @returns {*} Cached value or null if expired/missing
 */
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

/**
 * Clear a specific cache entry
 * @param {string} key - Cache key from CACHE_CONFIG
 */
function clearCache_(key) {
  try {
    getProps_().deleteProperty(key);
  } catch (err) {
    Logger.log(`[WARN] Cache clear failed for ${key}: ${err.message}`);
  }
}

/**
 * Clear all caches
 */
function clearAllCaches_() {
  Object.values(CACHE_CONFIG).forEach(key => {
    clearCache_(key);
  });
  Logger.log('[CACHE] All caches cleared');
}

/**
 * Get or compute employee active slot count with caching
 * @param {string} empEmail - Employee email
 * @returns {number} Active slot count
 */
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

/**
 * Invalidate employee slots cache for specific email
 * @param {string} empEmail - Employee email to invalidate
 */
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

/**
 * Get or compute poster availability with caching
 * @returns {object} Poster ID to available count map
 */
function getPosterAvailability_Cached() {
  const key = CACHE_CONFIG.POSTER_AVAILABILITY;
  let cache = getCache_(key);

  if (cache) return cache;

  // Compute availability
  cache = {};
  const mp = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);
  const data = getNonEmptyData_(mp, CONFIG.COLS.MOVIE_POSTERS.INV_COUNT);

  data.forEach((row, idx) => {
    const isActive = row[CONFIG.COLS.MOVIE_POSTERS.ACTIVE - 1];
    const posterId = row[CONFIG.COLS.MOVIE_POSTERS.POSTER_ID - 1];
    const invCount = row[CONFIG.COLS.MOVIE_POSTERS.INV_COUNT - 1];

    if (isActive && posterId && invCount) {
      cache[String(posterId)] = Number(invCount || 0);
    }
  });

  setCache_(key, cache);
  return cache;
}

/**
 * Invalidate poster availability cache
 */
function invalidatePosterAvailability_() {
  clearCache_(CACHE_CONFIG.POSTER_AVAILABILITY);
}

/**
 * Get or compute board main data with caching
 * @returns {object} Board data structure
 */
function getBoardMainData_Cached() {
  const key = CACHE_CONFIG.BOARD_MAIN;
  const cache = getCache_(key);

  if (cache) return cache;

  // This would be computed from ledger, implementation depends on buildMainBoard_
  // For now, we'll let the system recompute on cache miss
  return null;
}

/**
 * Invalidate main board cache
 */
function invalidateBoardMain_() {
  clearCache_(CACHE_CONFIG.BOARD_MAIN);
}

/**
 * Get or compute board employees data with caching
 * @returns {object} Board data structure
 */
function getBoardEmployeesData_Cached() {
  const key = CACHE_CONFIG.BOARD_EMPLOYEES;
  const cache = getCache_(key);

  if (cache) return cache;

  return null;
}

/**
 * Invalidate employees board cache
 */
function invalidateBoardEmployees_() {
  clearCache_(CACHE_CONFIG.BOARD_EMPLOYEES);
}

/**
 * Get or compute active subscribers with caching
 * @returns {Array<string>} Array of active subscriber emails
 */
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

/**
 * Invalidate active subscribers cache
 */
function invalidateActiveSubscribers_() {
  clearCache_(CACHE_CONFIG.ACTIVE_SUBSCRIBERS);
}

/**
 * Get or compute posters with labels with caching
 * @returns {Array<object>} Posters with computed labels
 */
function getPostersWithLabels_Cached() {
  const key = CACHE_CONFIG.POSTERS_WITH_LABELS;
  let cache = getCache_(key);

  if (Array.isArray(cache) && cache.length > 0) return cache;

  cache = getPostersWithLabels_();
  setCache_(key, cache);
  return cache;
}

/**
 * Invalidate posters with labels cache
 */
function invalidatePostersWithLabels_() {
  clearCache_(CACHE_CONFIG.POSTERS_WITH_LABELS);
}

/**
 * Convenience invalidation after any write to Requests/Movie Posters/etc.
 * Keeps slot counts, boards, and poster metadata caches fresh.
 * @param {{empEmail?: string}} opts
 */
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

/**
 * Get cache statistics for monitoring
 * @returns {object} Cache stats
 */
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

/**
 * Log cache statistics to analytics
 */
function logCacheStats_() {
  try {
    const stats = getCacheStats_();
    Logger.log('[CACHE] Stats: ' + JSON.stringify(stats));
  } catch (err) {
    Logger.log(`[WARN] Cache stats logging failed: ${err.message}`);
  }
}
