/** 04_FormManager.js **/

/**
 * Get the form description with dynamic MAX_ACTIVE value.
 * @returns {string} Form description
 */
function getFormDescription_() {
  const maxActive = CONFIG.MAX_ACTIVE;
  return `You can only have your name on ${maxActive} posters at a time. If you already have all ${maxActive} slots maxed out and you want a different poster, remove one from your selection to choose a new one.`;
}

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
      // Form was deleted or ID is invalid - clear it and create a new one
      Logger.log('Form not found (ID: ' + existingId + '). Creating new form...');
      getProps_().deleteProperty(CONFIG.PROPS.FORM_ID);
    }
  }

  // Create new form
  const form = FormApp.create(CONFIG.FORM_META.TITLE);
  form.setDescription(getFormDescription_());

  getProps_().setProperty(CONFIG.PROPS.FORM_ID, form.getId());

  Logger.log('Created new form. EDIT URL: ' + form.getEditUrl());
  Logger.log('NEW FORM_ID: ' + form.getId());
  return form;
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

function ensureFormStructure_() {
  const form = getOrCreateForm_();

  form.setTitle(CONFIG.FORM_META.TITLE);
  form.setDescription(getFormDescription_());
  
  // Collect verified email addresses from Google accounts
  form.setCollectEmail(true);
  // NOTE: To require Google sign-in, manually configure in Form Settings:
  // Settings > Responses > "Collect email addresses" > check "Respondents will be required to sign in with Google as verified"

  // Ensure employee name text item
  const nameTitle = CONFIG.FORM.Q_EMPLOYEE_NAME;
  const nameItems = form.getItems(FormApp.ItemType.TEXT);
  let nameItem = nameItems.find(it => String(it.getTitle() || '').trim() === nameTitle);
  if (!nameItem) nameItem = form.addTextItem().setTitle(nameTitle);
  const nameTextItem = (typeof nameItem.asTextItem === 'function') ? nameItem.asTextItem() : nameItem;
  nameTextItem.setRequired(true);

  // Remove any deprecated questions and ensure no email field exists
  // (Email is auto-collected via form.setCollectEmail(true) above)
  form.getItems().forEach(item => {
    const title = String(item.getTitle() || '').trim();
    if (title === 'Employee ID (Clock-In Password)' || 
        title.toLowerCase().includes('email') ||
        title.toLowerCase() === 'email address') {
      form.deleteItem(item);
    }
  });

  // Set up Add/Remove posters checkboxes
  setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_ADD, ['— placeholder —'], false);
  setCheckboxChoicesByTitle_(form, CONFIG.FORM.Q_REMOVE, ['— placeholder —'], false);
  
  // Set up notification subscription checkbox
  const subTitle = CONFIG.FORM.Q_SUBSCRIBE;
  const subItems = form.getItems(FormApp.ItemType.CHECKBOX);
  let subscribeItem = subItems.find(it => String(it.getTitle() || '').trim() === subTitle);
  if (!subscribeItem) {
    subscribeItem = form.addCheckboxItem().setTitle(subTitle);
  }
  const subCb = (typeof subscribeItem.asCheckboxItem === 'function') ? subscribeItem.asCheckboxItem() : subscribeItem;
  subCb.setChoices([subCb.createChoice('Yes, subscribe me to notifications')]);
  subCb.setRequired(false);
}
