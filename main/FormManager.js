/** FormManager.js **/

function getEffectiveFormId_() {
  const cfg = String(CONFIG.FORM_ID || '').trim();
  if (cfg) return cfg;

  const p = getProps_().getProperty(CONFIG.PROPS.FORM_ID);
  return String(p || '').trim();
}

function getOrCreateForm_() {
  const existingId = getEffectiveFormId_();
  if (existingId) {
    try { 
      return FormApp.openById(existingId); 
    } catch (e) {
      // Form not accessible or ID invalid
      if (!isMasterAccount_()) {
        throw new Error('Form access denied. Contact the master admin to manage the form.');
      }
      Logger.log('Form not found or inaccessible (ID: ' + existingId + '). Creating new form...');
      getProps_().deleteProperty(CONFIG.PROPS.FORM_ID);
    }
  }

  if (!isMasterAccount_()) {
    throw new Error('Form not set up yet. Contact the master admin to initialize the form.');
  }

  // Create new form
  const form = FormApp.create(CONFIG.FORM_META.TITLE);
  form.setDescription(CONFIG.FORM_META.DESCRIPTION);

  getProps_().setProperty(CONFIG.PROPS.FORM_ID, form.getId());

  Logger.log('Created new form. EDIT URL: ' + form.getEditUrl());
  Logger.log('NEW FORM_ID: ' + form.getId());
  return form;
}

function getFormPublishedUrlSafe_() {
  const id = getEffectiveFormId_();
  if (!id) return '';
  try {
    return FormApp.openById(id).getPublishedUrl();
  } catch (e) {
    // Fall back to viewform URL if user lacks access
    return `https://docs.google.com/forms/d/${id}/viewform`;
  }
}

/**
 * Get cached Form URL from properties (set during initial setup)
 * This ensures the URL never changes even if form is modified
 */
function getCachedFormUrl_() {
  const props = PropertiesService.getScriptProperties();
  let cachedUrl = props.getProperty('CACHED_FORM_URL');
  
  // If not cached, get it now and cache it
  if (!cachedUrl) {
    cachedUrl = getFormPublishedUrlSafe_();
    if (cachedUrl) {
      props.setProperty('CACHED_FORM_URL', cachedUrl);
    }
  }
  
  return cachedUrl;
}

/**
 * Initialize Form URL cache during setup (called once)
 */
function initializeFormUrlCache_() {
  const url = getFormPublishedUrlSafe_();
  if (url) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('CACHED_FORM_URL', url);
    Logger.log('[initializeFormUrlCache_] Cached Form URL: ' + url);
  }
}

function setCheckboxChoicesByTitle_(form, itemTitle, choices, required) {
  const target = String(itemTitle || '').trim();
  if (!target) throw new Error('Missing checkbox item title');

  const items = form.getItems(FormApp.ItemType.CHECKBOX);
  let item = items.find(it => String(it.getTitle() || '').trim() === target);
  if (!item) item = form.addCheckboxItem().setTitle(target);

  const cb = (typeof item.asCheckboxItem === 'function') ? item.asCheckboxItem() : item;

  if (!choices || choices.length === 0) {
    cb.setChoices([cb.createChoice('— None available —')]);
    cb.setRequired(false);
    return;
  }

  cb.setChoices(choices.map(c => cb.createChoice(c)));
  cb.setRequired(!!required);
}

/**
 * Set or update a dropdown list item by title
 */
function setDropdownChoicesByTitle_(form, itemTitle, choices, required = false) {
  const target = String(itemTitle || '').trim();
  if (!target) throw new Error('Missing dropdown item title');

  const items = form.getItems(FormApp.ItemType.LIST);
  let item = items.find(it => String(it.getTitle() || '').trim() === target);
  if (!item) item = form.addListItem().setTitle(target);

  const dropdown = (typeof item.asListItem === 'function') ? item.asListItem() : item;

  if (!choices || choices.length === 0) {
    dropdown.setChoices([dropdown.createChoice('— None available —')]);
    dropdown.setRequired(false);
    return;
  }

  const choiceObjs = choices.map(c => dropdown.createChoice(c));
  // Always add an empty option for optional dropdowns
  if (!required) {
    choiceObjs.unshift(dropdown.createChoice(''));
  }
  dropdown.setChoices(choiceObjs);
  dropdown.setRequired(!!required);
}

/**
 * Ensure or update a short answer text item by title
 */
function setShortAnswerByTitle_(form, itemTitle, required = false) {
  const target = String(itemTitle || '').trim();
  if (!target) throw new Error('Missing short answer item title');

  const items = form.getItems(FormApp.ItemType.TEXT);
  let item = items.find(it => String(it.getTitle() || '').trim() === target);
  if (!item) item = form.addTextItem().setTitle(target);

  const textItem = (typeof item.asTextItem === 'function') ? item.asTextItem() : item;
  textItem.setRequired(!!required);
  return textItem;
}

function ensureSubscribeQuestion_(form) {
  const subTitle = CONFIG.FORM.Q_SUBSCRIBE;
  const subItems = form.getItems(FormApp.ItemType.CHECKBOX);
  let subscribeItem = subItems.find(it => String(it.getTitle() || '').trim() === subTitle);
  if (!subscribeItem) {
    subscribeItem = form.addCheckboxItem().setTitle(subTitle);
  }
  const subCb = (typeof subscribeItem.asCheckboxItem === 'function') ? subscribeItem.asCheckboxItem() : subscribeItem;
  subCb.setChoices([subCb.createChoice('Yes, subscribe me to notifications')]);
  subCb.setRequired(false);
  return subCb;
}

function ensureFormStructure_() {
  const form = getOrCreateForm_();

  form.setTitle(CONFIG.FORM_META.TITLE);
  form.setDescription(CONFIG.FORM_META.DESCRIPTION);
  
  // Collect verified email addresses from Google accounts
  form.setCollectEmail(true);

  // Ensure employee name text item (required)
  const nameTitle = CONFIG.FORM.Q_EMPLOYEE_NAME;
  const nameItems = form.getItems(FormApp.ItemType.TEXT);
  let nameItem = nameItems.find(it => String(it.getTitle() || '').trim() === nameTitle);
  if (!nameItem) nameItem = form.addTextItem().setTitle(nameTitle);
  const nameTextItem = (typeof nameItem.asTextItem === 'function') ? nameItem.asTextItem() : nameItem;
  nameTextItem.setRequired(true);

  // Remove any deprecated questions and ensure no email field exists
  form.getItems().forEach(item => {
    const title = String(item.getTitle() || '').trim();
    if (title === 'Employee ID (Clock-In Password)' || 
        title.toLowerCase().includes('email') ||
        title.toLowerCase() === 'email address' ||
        title === CONFIG.FORM.Q_ADD ||  // Remove old checkbox-based Add question
        title === CONFIG.FORM.Q_REMOVE) {  // Remove old checkbox-based Remove question
      form.deleteItem(item);
    }
  });

  // Create 7 Add Poster dropdowns with optional notes
  for (let i = 1; i <= 7; i++) {
    const posterTitle = `Request Poster (Add) ${i}`;
    const noteTitle = `Request Poster Note ${i}`;
    
    // Set up dropdown for poster selection
    setDropdownChoicesByTitle_(form, posterTitle, ['— placeholder —'], false);
    
    // Set up optional short answer for note
    setShortAnswerByTitle_(form, noteTitle, false);
  }

  // Create 7 Remove Poster dropdowns
  for (let i = 1; i <= 7; i++) {
    const removeTitle = `Remove Poster ${i}`;
    setDropdownChoicesByTitle_(form, removeTitle, ['— placeholder —'], false);
  }

  // Set up Subscribe question (optional)
  ensureSubscribeQuestion_(form);
}
