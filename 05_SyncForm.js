/** 04_SyncForm.gs **/

function syncPostersToForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensurePosterIds_();
    syncInventoryCountsToMoviePosters_();
    updateInventoryLastUpdated_();

    const form = getOrCreateForm_();
    const posters = getPostersWithLabels_();

    // Build label-to-ID and ID-to-label maps
    const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
    const idToCurrent = {};
    posters.forEach(p => {
      idToCurrent[p.posterId] = p.label;
      if (!labelToId[p.label]) labelToId[p.label] = p.posterId;
    });
    writeJsonProp_(CONFIG.PROPS.LABEL_TO_ID, labelToId);
    writeJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, idToCurrent);

    // Build Add choices (active posters, sorted by release)
    const addChoices = posters
      .filter(p => p.active)
      .sort((a,b) => new Date(a.release) - new Date(b.release) || a.title.localeCompare(b.title))
      .map(p => p.label);

    // Build Remove choices (posters with ACTIVE requests)
    const activePosterIds = getPosterIdsWithAnyActiveRequests_();
    const removeChoices = posters
      .filter(p => activePosterIds[p.posterId])
      .sort((a,b) => new Date(a.release) - new Date(b.release) || a.title.localeCompare(b.title))
      .map(p => p.label);

    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_ADD, addChoices, true);
    setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_REMOVE, removeChoices, false);

  } finally {
    lock.releaseLock();
  }
}
