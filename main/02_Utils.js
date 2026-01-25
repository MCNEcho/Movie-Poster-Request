/** 02_Utils.gs **/

function now_() { return new Date(); }

function fmtDate_(d, pattern) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, pattern);
}

function normalizeTitle_(s) {
  return String(s || '').trim().toLowerCase();
}

/**
 * Generate a unique Poster ID from title and release date
 * @param {string} title - Movie title
 * @param {Date} releaseDate - Release date
 * @returns {string} Generated poster ID
 */
function generatePosterId_(title, releaseDate) {
  const dateStr = fmtDate_(releaseDate, 'yyyyMMdd');
  const titleSlug = normalizeTitle_(title).substring(0, CONFIG.MAX_TITLE_SLUG_LENGTH).replace(/[^a-z0-9]/gi, '');
  return `${titleSlug}_${dateStr}`;
}

function getProps_() {
  return PropertiesService.getScriptProperties();
}

function readJsonProp_(key, fallback) {
  const raw = getProps_().getProperty(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

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
      // Frozen headers removed for better UX
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

/**
 * Enforce employee name format:
 * Accepts: "Gavin N" or "Gavin N."
 * Rejects: "Miles pratt", "Gavin", "Gavin NN", etc.
 */
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

/**
 * Fetches all posters from Movie Posters sheet with computed display labels.
 * Handles duplicate titles by adding (Release Date) suffix.
 * Returns array of { posterId, title, release, active, label }
 */
function getPostersWithLabels_() {
  const mp = getSheet_(CONFIG.SHEETS.MOVIE_POSTERS);
  const data = getNonEmptyData_(mp, 8);
  
  const posters = data.map(r => ({
    posterId: String(r[COLS.MOVIE_POSTERS.POSTER_ID - 1] || '').trim(),
    title: String(r[COLS.MOVIE_POSTERS.TITLE - 1] || '').trim(),
    release: r[COLS.MOVIE_POSTERS.RELEASE - 1],
    active: r[COLS.MOVIE_POSTERS.ACTIVE - 1] === true,
    invCount: r[COLS.MOVIE_POSTERS.INV_COUNT - 1],
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

/**
 * Gets all ACTIVE requests from Requests sheet.
 * Returns array of request rows with full data.
 */
function getActiveRequests_() {
  const sh = getSheet_(CONFIG.SHEETS.REQUESTS);
  const data = getNonEmptyData_(sh, 10);
  return data.filter(r => String(r[COLS.REQUESTS.STATUS - 1]) === STATUS.ACTIVE);
}
