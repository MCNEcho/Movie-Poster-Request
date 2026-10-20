/** FormManager.js **/

function getEffectiveFormId_() {
  const cfg = String(CONFIG.FORM_ID || '').trim();
  if (cfg) return cfg;

  const p = getProps_().getProperty(CONFIG.PROPS.FORM_ID);
  return String(p || '').trim();
}

function getFormDescription_() {
  const slots = Number(CONFIG.FORM_SLOTS) || CONFIG.MAX_ACTIVE;
  return `You can have up to ${slots} posters on your request at a time. If you are at the limit and want a different poster, remove one from your selection before choosing another.`;
}

function getOrCreateForm_() {
  const existingId = getEffectiveFormId_();
  if (existingId) {
    try { 
      return FormApp.openById(existingId); 
    } catch (e) {
      // Form not accessible or ID invalid
      if (!isMasterAccount_()) {
        const runner = String(Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || 'unknown account');
        throw new Error(`Form access denied for script runner ${runner}. Ask the form owner to grant this account Editor access, then rerun setup.`);
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
  form.setDescription(getFormDescription_());

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

function createListItem_(form, title) {
  const item = form.addListItem().setTitle(title);
  item.setChoiceValues(['— None available —']);
  item.setRequired(false);
  return item;
}

function setListItemChoices_(item, choices, required = false) {
  const dropdown = (typeof item.asListItem === 'function') ? item.asListItem() : item;
  const uniqueChoices = normalizeFormChoices_(choices);
  const values = uniqueChoices.length === 0
    ? ['— None available —']
    : (required ? uniqueChoices : ['', ...uniqueChoices]);
  if (!areFormChoiceValuesEqual_(dropdown.getChoices().map(choice => choice.getValue()), values)) {
    dropdown.setChoiceValues(values);
  }
  if (dropdown.isRequired() !== !!required) dropdown.setRequired(!!required);
  return dropdown;
}

function areFormChoiceValuesEqual_(current, desired) {
  return Array.isArray(current) && Array.isArray(desired) &&
    current.length === desired.length &&
    current.every((value, index) => value === desired[index]);
}

function computeFormChoicesHash_(addChoices, removeChoices, slots) {
  const source = JSON.stringify({ add: addChoices, remove: removeChoices, slots });
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeFormChoices_(choices) {
  const seen = new Set();
  const unique = [];
  (choices || []).forEach(choice => {
    const display = String(choice === null || choice === undefined ? '' : choice).replace(/\s+/g, ' ').trim();
    if (!display) return;
    const key = display.toLocaleLowerCase();
    if (seen.has(key)) {
      Logger.log(`[FormSync] Ignoring duplicate form choice: "${display}"`);
      return;
    }
    seen.add(key);
    unique.push(display);
  });
  return unique;
}

/**
 * Ensure or update a short answer text item by title
 */
function areRequiredFormItemsMissing_(items) {
  const has = (title, type) => (items || []).some(item =>
    item.getType() === type && String(item.getTitle() || '').trim() === title
  );
  if (!has(CONFIG.FORM.Q_EMPLOYEE_NAME, FormApp.ItemType.TEXT)) return true;
  for (let slot = 1; slot <= CONFIG.FORM_SLOTS; slot++) {
    if (!has(`Request Poster (Add) ${slot}`, FormApp.ItemType.LIST)) return true;
    if (!has(`Request Poster Note ${slot}`, FormApp.ItemType.TEXT)) return true;
    if (!has(`Remove Poster ${slot}`, FormApp.ItemType.LIST)) return true;
  }
  return false;
}

function ensureFormStructure_(formArg, itemsArg) {
  const form = formArg || getOrCreateForm_();
  let items = itemsArg || form.getItems();

  form.setTitle(CONFIG.FORM_META.TITLE);
  form.setDescription(getFormDescription_());
  
  // Collect verified email addresses from Google accounts
  form.setCollectEmail(true);

  // Ensure employee name text item (required)
  const nameTitle = CONFIG.FORM.Q_EMPLOYEE_NAME;
  let nameItem = items.find(it => String(it.getTitle() || '').trim() === nameTitle && it.getType() === FormApp.ItemType.TEXT);
  if (!nameItem) {
    nameItem = form.addTextItem().setTitle(nameTitle);
    items.push(nameItem);
  }
  const nameTextItem = (typeof nameItem.asTextItem === 'function') ? nameItem.asTextItem() : nameItem;
  nameTextItem.setRequired(true);
  const namePattern = "^[A-Za-z][A-Za-z'-]{1,}\\s+[A-Za-z]\\.?$";
  nameTextItem.setValidation(FormApp.createTextValidation()
    .requireTextMatchesPattern(namePattern)
    .setHelpText('Enter first name and last initial, for example Alex R.')
    .build());

  // Remove any deprecated questions and ensure no email field exists
  items.slice().forEach(item => {
    const title = String(item.getTitle() || '').trim();
    if (title === 'Employee ID (Clock-In Password)' ||
      title === 'Subscribe to Notifications' ||
        title.toLowerCase().includes('email') ||
        title.toLowerCase() === 'email address' ||
        title === CONFIG.FORM.Q_ADD ||  // Remove old checkbox-based Add question
        title === CONFIG.FORM.Q_REMOVE) {  // Remove old checkbox-based Remove question
      form.deleteItem(item);
      items = items.filter(existing => existing !== item);
    }
  });

  // Create missing questions only; never replace choices on existing items here.
  for (let i = 1; i <= CONFIG.FORM_SLOTS; i++) {
    const posterTitle = `Request Poster (Add) ${i}`;
    const noteTitle = `Request Poster Note ${i}`;
    if (!items.some(item => item.getType() === FormApp.ItemType.LIST && String(item.getTitle() || '').trim() === posterTitle)) {
      items.push(createListItem_(form, posterTitle));
    }
    if (!items.some(item => item.getType() === FormApp.ItemType.TEXT && String(item.getTitle() || '').trim() === noteTitle)) {
      const noteItem = form.addTextItem().setTitle(noteTitle);
      noteItem.setRequired(false);
      items.push(noteItem);
    }
  }

  for (let i = 1; i <= CONFIG.FORM_SLOTS; i++) {
    const removeTitle = `Remove Poster ${i}`;
    if (!items.some(item => item.getType() === FormApp.ItemType.LIST && String(item.getTitle() || '').trim() === removeTitle)) {
      items.push(createListItem_(form, removeTitle));
    }
  }
  return { form, items };
}
