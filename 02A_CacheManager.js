/** 02A_CacheManager.js **/

/**
 * Request Caching Layer for Performance Optimization
 * 
 * Implements TTL-based caching using ScriptProperties to reduce
 * sheet read operations and improve performance.
 */

/**
 * Get a value from cache if it exists and hasn't expired.
 * 
 * @param {string} key - Cache key
 * @returns {*} Cached value or null if not found/expired
 */
function getCached_(key) {
  try {
    const cacheKey = CONFIG.PROPS.CACHE_PREFIX + key;
    const cached = readJsonProp_(cacheKey, null);
    
    if (!cached) return null;
    
    // Check if expired
    const now = Date.now();
    if (cached.expiry && now > cached.expiry) {
      // Expired - remove from cache
      getProps_().deleteProperty(cacheKey);
      return null;
    }
    
    return cached.value;
  } catch (error) {
    console.error(`[getCached] Error retrieving cache for key ${key}: ${error.message}`);
    return null;
  }
}

/**
 * Store a value in cache with TTL.
 * 
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds (optional, uses default if not provided)
 * @returns {void}
 */
function setCached_(key, value, ttl) {
  try {
    const cacheKey = CONFIG.PROPS.CACHE_PREFIX + key;
    const ttlMs = ttl || CONFIG.CACHE.DEFAULT_TTL;
    const expiry = Date.now() + ttlMs;
    
    const cacheEntry = {
      value: value,
      expiry: expiry,
      cached_at: Date.now()
    };
    
    writeJsonProp_(cacheKey, cacheEntry);
  } catch (error) {
    console.error(`[setCached] Error setting cache for key ${key}: ${error.message}`);
  }
}

/**
 * Invalidate a specific cache key.
 * 
 * @param {string} key - Cache key to invalidate
 * @returns {void}
 */
function invalidateCache_(key) {
  try {
    const cacheKey = CONFIG.PROPS.CACHE_PREFIX + key;
    getProps_().deleteProperty(cacheKey);
  } catch (error) {
    console.error(`[invalidateCache] Error invalidating cache for key ${key}: ${error.message}`);
  }
}

/**
 * Invalidate all cache entries matching a pattern.
 * 
 * @param {string} pattern - Pattern to match (e.g., 'employee_' to clear all employee caches)
 * @returns {void}
 */
function invalidateCachePattern_(pattern) {
  try {
    const props = getProps_();
    const allKeys = props.getKeys();
    const prefix = CONFIG.PROPS.CACHE_PREFIX;
    
    allKeys.forEach(key => {
      if (key.startsWith(prefix) && key.includes(pattern)) {
        props.deleteProperty(key);
      }
    });
  } catch (error) {
    console.error(`[invalidateCachePattern] Error invalidating cache pattern ${pattern}: ${error.message}`);
  }
}

/**
 * Clear all cache entries.
 * 
 * @returns {void}
 */
function clearAllCache_() {
  try {
    const props = getProps_();
    const allKeys = props.getKeys();
    const prefix = CONFIG.PROPS.CACHE_PREFIX;
    
    allKeys.forEach(key => {
      if (key.startsWith(prefix)) {
        props.deleteProperty(key);
      }
    });
  } catch (error) {
    console.error(`[clearAllCache] Error clearing all cache: ${error.message}`);
  }
}

/**
 * Get employee active count with caching.
 * 
 * @param {string} empEmail - Employee email
 * @returns {number} Active request count
 */
function countActiveSlotsByEmailCached_(empEmail) {
  const cacheKey = `employee_count_${empEmail}`;
  
  let count = getCached_(cacheKey);
  if (count !== null) {
    return count;
  }
  
  // Cache miss - compute and cache
  count = countActiveSlotsByEmail_(empEmail);
  setCached_(cacheKey, count, CONFIG.CACHE.EMPLOYEE_COUNT_TTL);
  
  return count;
}

/**
 * Get active poster map with caching.
 * 
 * @returns {Object} Map of active poster IDs
 */
function getActivePosterIdMapCached_() {
  const cacheKey = 'active_poster_map';
  
  let map = getCached_(cacheKey);
  if (map !== null) {
    return map;
  }
  
  // Cache miss - compute and cache
  map = getActivePosterIdMap_();
  setCached_(cacheKey, map, CONFIG.CACHE.POSTER_AVAILABILITY_TTL);
  
  return map;
}

/**
 * Get active requests with caching.
 * 
 * @returns {Array} Array of active request rows
 */
function getActiveRequestsCached_() {
  const cacheKey = 'active_requests';
  
  let requests = getCached_(cacheKey);
  if (requests !== null) {
    return requests;
  }
  
  // Cache miss - compute and cache
  requests = getActiveRequests_();
  setCached_(cacheKey, requests, CONFIG.CACHE.BOARD_SNAPSHOT_TTL);
  
  return requests;
}

/**
 * Get posters with labels with caching.
 * 
 * @returns {Array} Array of poster objects with labels
 */
function getPostersWithLabelsCached_() {
  const cacheKey = 'posters_with_labels';
  
  let posters = getCached_(cacheKey);
  if (posters !== null) {
    return posters;
  }
  
  // Cache miss - compute and cache
  posters = getPostersWithLabels_();
  setCached_(cacheKey, posters, CONFIG.CACHE.POSTER_AVAILABILITY_TTL);
  
  return posters;
}

/**
 * Check if employee can request poster with caching.
 * 
 * @param {string} empEmail - Employee email
 * @param {string} posterId - Poster ID
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canRequestPosterCached_(empEmail, posterId) {
  const cacheKey = `can_request_${empEmail}_${posterId}`;
  
  let result = getCached_(cacheKey);
  if (result !== null) {
    return result;
  }
  
  // Cache miss - compute and cache
  result = canRequestPoster_(empEmail, posterId);
  setCached_(cacheKey, result, CONFIG.CACHE.EMPLOYEE_COUNT_TTL);
  
  return result;
}

/**
 * Invalidate caches after write operations.
 * Call this after any operation that modifies request or poster data.
 * 
 * @param {string} operationType - Type of operation: 'request', 'poster', 'all'
 * @returns {void}
 */
function invalidateCachesAfterWrite_(operationType) {
  switch (operationType) {
    case 'request':
      // Invalidate request-related caches
      invalidateCachePattern_('employee_count_');
      invalidateCachePattern_('can_request_');
      invalidateCache_('active_requests');
      break;
    
    case 'poster':
      // Invalidate poster-related caches
      invalidateCache_('active_poster_map');
      invalidateCache_('posters_with_labels');
      invalidateCache_('active_requests');
      break;
    
    case 'all':
      // Invalidate all caches
      clearAllCache_();
      break;
    
    default:
      console.warn(`[invalidateCachesAfterWrite] Unknown operation type: ${operationType}`);
  }
}

/**
 * Get cache statistics for monitoring.
 * 
 * @returns {Object} Cache statistics
 */
function getCacheStats_() {
  try {
    const props = getProps_();
    const allKeys = props.getKeys();
    const prefix = CONFIG.PROPS.CACHE_PREFIX;
    
    let totalEntries = 0;
    let expiredEntries = 0;
    let activeEntries = 0;
    const now = Date.now();
    
    allKeys.forEach(key => {
      if (key.startsWith(prefix)) {
        totalEntries++;
        const cached = readJsonProp_(key, null);
        if (cached && cached.expiry) {
          if (now > cached.expiry) {
            expiredEntries++;
          } else {
            activeEntries++;
          }
        }
      }
    });
    
    return {
      total: totalEntries,
      active: activeEntries,
      expired: expiredEntries,
      timestamp: now_()
    };
  } catch (error) {
    console.error(`[getCacheStats] Error getting cache stats: ${error.message}`);
    return { error: error.message };
  }
}
