/** FormSync.js **/

function syncPostersToForm() {
  queueManualPosterRefresh_({ form: true });
  return { queued: true };
}

function syncPostersToForm_() {
  let form = getOrCreateForm_();
  let items = form.getItems();
  let repairedStructure = false;
  if (areRequiredFormItemsMissing_(items)) {
    const repaired = ensureFormStructure_(form, items);
    form = repaired.form;
    items = repaired.items;
    repairedStructure = true;
  }

  const listItems = new Map();
  items.forEach(item => {
    if (item.getType() === FormApp.ItemType.LIST) {
      listItems.set(String(item.getTitle() || '').trim(), item);
    }
  });

  const posters = getPostersWithLabels_();
  const labelToId = readJsonProp_(CONFIG.PROPS.LABEL_TO_ID, {});
  const idToCurrent = {};
  posters.forEach(p => {
    idToCurrent[p.posterId] = p.label;
    if (!labelToId[p.label]) labelToId[p.label] = p.posterId;
  });
  writeJsonProp_(CONFIG.PROPS.LABEL_TO_ID, labelToId);
  writeJsonProp_(CONFIG.PROPS.ID_TO_CURRENT_LABEL, idToCurrent);

  invalidatePostersWithLabels_();
  invalidatePosterAvailability_();

  const sortPosters = list => list
    .sort((a, b) => new Date(a.release) - new Date(b.release) || a.title.localeCompare(b.title))
    .map(p => p.label);
  const addChoices = normalizeFormChoices_(sortPosters(posters.filter(p => p.active)));
  const activePosterIds = getPosterIdsWithAnyActiveRequests_();
  const removeChoices = normalizeFormChoices_(sortPosters(posters.filter(p => activePosterIds[p.posterId])));
  const choicesHash = computeFormChoicesHash_(addChoices, removeChoices, CONFIG.FORM_SLOTS);
  const savedHash = getProps_().getProperty(CONFIG.PROPS.FORM_CHOICES_HASH);

  if (savedHash === choicesHash && !repairedStructure) {
    Logger.log('[syncPostersToForm_] Skipped Form writes; choices and slot count are unchanged.');
    return { skipped: true, hash: choicesHash };
  }

  for (let slot = 1; slot <= CONFIG.FORM_SLOTS; slot++) {
    const addTitle = `Request Poster (Add) ${slot}`;
    const removeTitle = `Remove Poster ${slot}`;
    const addItem = listItems.get(addTitle);
    const removeItem = listItems.get(removeTitle);
    if (!addItem || !removeItem) throw new Error(`Required Form dropdown is missing: ${!addItem ? addTitle : removeTitle}`);
    setListItemChoices_(addItem, addChoices, false);
    setListItemChoices_(removeItem, removeChoices, false);
  }

  getProps_().setProperty(CONFIG.PROPS.FORM_CHOICES_HASH, choicesHash);
  invalidateBoardMain_();
  invalidateBoardEmployees_();
  Logger.log(`[syncPostersToForm_] Updated ${CONFIG.FORM_SLOTS * 2} Form dropdowns (hash ${choicesHash}).`);
  return { skipped: false, hash: choicesHash };
}
