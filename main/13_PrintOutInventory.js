/** 13_PrintOutInventory.js **/
/**
 * Print Out system - MANUAL UPDATE ONLY
 * Print Out is updated only when user clicks "Update Print Out" from admin menu.
 * This prevents automatic tab switching that interrupts workflow.
 */

function updateInventoryLastUpdated_() {
  const inv = getSheet_(CONFIG.SHEETS.INVENTORY);
  inv.getRange(CONFIG.INVENTORY_LAST_UPDATED_CELL)
    .setValue(`Last Updated: ${fmtDate_(now_(), 'yyyy-MM-dd HH:mm:ss')}`);
}

function refreshPrintOut() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActive();
    const sh = getSheet_(CONFIG.SHEETS.PRINT_OUT);
    const { empQrEndRow } = buildPrintOutLayout_();

    // Keep this lightweight: just rebuild layout; selection is handled by prepareAndSelectPrintArea()
    sh.setActiveSelection(sh.getRange(4, 1, Math.max(2, empQrEndRow - 4 + 1), 3));
    ss.toast('Print Out updated successfully', 'Update Complete', 3);
  } finally {
    lock.releaseLock();
  }
}
