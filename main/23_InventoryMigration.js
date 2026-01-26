/** 23_InventoryMigration.js **/

/**
 * Migration Module: Move poster data from Movie Posters sheet to Inventory sheet
 * This ensures Inventory becomes the single source of truth for poster data.
 */

/**
 * Migrate poster data from Movie Posters sheet to Inventory sheet.
 * Only runs once per deployment (checked via script property).
 * Safe to run multiple times - checks for existing data before inserting.
 */
function migratePostersFromMoviePostersToInventory_() {
  const props = getProps_();
  const MIGRATION_FLAG = 'INVENTORY_MIGRATION_COMPLETED';
  
  // Check if migration already completed
  if (props.getProperty(MIGRATION_FLAG) === 'true') {
    Logger.log('[Migration] Already completed, skipping');
    return { migrated: 0, skipped: 0, reason: 'Already completed' };
  }
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const ss = SpreadsheetApp.getActive();
    const mpSheet = ss.getSheetByName(CONFIG.SHEETS.MOVIE_POSTERS);
    
    // If Movie Posters sheet doesn't exist, mark as complete
    if (!mpSheet) {
      Logger.log('[Migration] Movie Posters sheet does not exist, marking as complete');
      props.setProperty(MIGRATION_FLAG, 'true');
      return { migrated: 0, skipped: 0, reason: 'Movie Posters sheet not found' };
    }
    
    const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
    const mpData = getNonEmptyData_(mpSheet, 8);
    
    // If no data to migrate, mark as complete
    if (mpData.length === 0) {
      Logger.log('[Migration] No data in Movie Posters sheet, marking as complete');
      props.setProperty(MIGRATION_FLAG, 'true');
      return { migrated: 0, skipped: 0, reason: 'No data to migrate' };
    }
    
    // Build map of existing Inventory posters by Poster ID
    const invData = getNonEmptyData_(inv, 12);
    const invPosterIds = new Set();
    invData.forEach(r => {
      const pid = String(r[COLS.INVENTORY.POSTER_ID - 1] || '').trim();
      if (pid) invPosterIds.add(pid);
    });
    
    let migrated = 0;
    let skipped = 0;
    
    // Process each Movie Posters row
    mpData.forEach(r => {
      const active = r[COLS.MOVIE_POSTERS.ACTIVE - 1] === true;
      const posterId = String(r[COLS.MOVIE_POSTERS.POSTER_ID - 1] || '').trim();
      const title = String(r[COLS.MOVIE_POSTERS.TITLE - 1] || '').trim();
      const release = r[COLS.MOVIE_POSTERS.RELEASE - 1];
      const invCount = r[COLS.MOVIE_POSTERS.INV_COUNT - 1];
      const received = r[COLS.MOVIE_POSTERS.RECEIVED - 1];
      const notes = String(r[COLS.MOVIE_POSTERS.NOTES - 1] || '').trim();
      
      // Skip if essential data missing
      if (!posterId || !title) {
        Logger.log(`[Migration] Skipping row with missing data: posterId=${posterId}, title=${title}`);
        skipped++;
        return;
      }
      
      // Skip if already exists in Inventory
      if (invPosterIds.has(posterId)) {
        Logger.log(`[Migration] Skipping ${title} - already exists in Inventory (${posterId})`);
        skipped++;
        return;
      }
      
      // Add to Inventory using explicit column mapping for clarity
      const newRow = Array(12).fill('');
      newRow[COLS.INVENTORY.ACTIVE - 1] = active;
      newRow[COLS.INVENTORY.RELEASE - 1] = release;
      newRow[COLS.INVENTORY.TITLE - 1] = title;
      newRow[COLS.INVENTORY.COMPANY - 1] = '';  // Not in old schema
      newRow[COLS.INVENTORY.POSTERS - 1] = invCount || 0;
      newRow[COLS.INVENTORY.BUS - 1] = '';  // Not in old schema
      newRow[COLS.INVENTORY.MINI - 1] = '';  // Not in old schema
      newRow[COLS.INVENTORY.STANDEE - 1] = '';  // Not in old schema
      newRow[COLS.INVENTORY.TEASER - 1] = '';  // Not in old schema
      newRow[COLS.INVENTORY.POSTER_ID - 1] = posterId;
      newRow[COLS.INVENTORY.RECEIVED - 1] = received;
      newRow[COLS.INVENTORY.NOTES - 1] = notes;
      
      inv.appendRow(newRow);
      
      Logger.log(`[Migration] Migrated: ${title} (${posterId})`);
      migrated++;
      
      // Add to our tracking set
      invPosterIds.add(posterId);
    });
    
    // Set checkbox validation on newly added rows
    const lastRow = inv.getLastRow();
    if (migrated > 0 && lastRow >= 2) {
      setCheckboxColumn_(inv, COLS.INVENTORY.ACTIVE, 2, lastRow);
    }
    
    // Sort Inventory by release date after migration
    sortInventoryByReleaseDate_();
    
    // Mark migration as complete
    props.setProperty(MIGRATION_FLAG, 'true');
    
    Logger.log(`[Migration] Complete: ${migrated} migrated, ${skipped} skipped`);
    return { migrated, skipped, reason: 'Success' };
    
  } catch (err) {
    logError_(err, 'migratePostersFromMoviePostersToInventory_', 'Migration failed');
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manual trigger to force re-run migration (resets flag first).
 * Use with caution - only for fixing bad migrations.
 */
function resetAndRunMigration() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Reset Migration',
    'This will reset the migration flag and re-run the migration from Movie Posters to Inventory. ' +
    'Only use if you need to fix a failed migration. Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (result !== ui.Button.YES) {
    ui.alert('Migration reset cancelled.');
    return;
  }
  
  try {
    const props = getProps_();
    props.deleteProperty('INVENTORY_MIGRATION_COMPLETED');
    
    const result = migratePostersFromMoviePostersToInventory_();
    
    ui.alert(
      'Migration Complete',
      `Migrated: ${result.migrated}\nSkipped: ${result.skipped}\nReason: ${result.reason}`,
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Migration Failed', err.message, ui.ButtonSet.OK);
    logError_(err, 'resetAndRunMigration', 'Manual migration trigger');
  }
}
