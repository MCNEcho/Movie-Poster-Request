/** 00_Config.gs **/

const CONFIG = {
  TIMEZONE: 'America/Los_Angeles',

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form - Pasco',
    DESCRIPTION:
      'You can only have your name on 5 posters at a time. If you already have all 5 slots maxed out and you want a different poster, remove one from your selection to choose a new one.',
  },

  FORM: {
    Q_EMPLOYEE_NAME: 'Name (First Name + Last Initial)',
    Q_ADD: 'Request Posters (Add)',
    Q_REMOVE: 'Remove Posters',
    Q_SUBSCRIBE: 'Subscribe to Notifications',
  },

  SHEETS: {
    MAIN: 'Main',
    EMPLOYEES: 'Employees',
    REQUEST_ORDER: 'Request Order',
    MOVIE_POSTERS: 'Movie Posters',
    INVENTORY: 'Inventory',
    PRINT_OUT: 'Print Out',
    REQUESTS: 'Requests',       // script-created
    SUBSCRIBERS: 'Subscribers', // script-created
    DOCUMENTATION: 'Documentation',
  },

  MAX_ACTIVE: 5,

  INVENTORY_LAST_UPDATED_CELL: 'J1',

  PRINT: {
    FORM_URL_CELL: 'B1',
    EMP_VIEW_URL_CELL: 'B2',
    FORM_QR_CELL: 'D1',
    EMP_QR_CELL: 'D2',
    LAST_UPDATED_CELL: 'H1',
    LIST_START_ROW: 6,
  },

  PROPS: {
    FORM_ID: 'POSTER_SYSTEM_FORM_ID',
    EMPLOYEE_VIEW_SSID: 'EMPLOYEE_VIEW_SSID',
    LABEL_TO_ID: 'LABEL_TO_ID_MAP_JSON',
    ID_TO_CURRENT_LABEL: 'ID_TO_CURRENT_LABEL_JSON',

    ANNOUNCE_QUEUE: 'ANNOUNCE_QUEUE_JSON',
    ANNOUNCED_IDS: 'ANNOUNCED_POSTER_IDS_JSON',
    CUSTOM_ANNOUNCE_QUEUE: 'CUSTOM_ANNOUNCE_QUEUE_JSON',
  },
};

// 1-based column indexes
const COLS = {
  INVENTORY: { RELEASE: 1, TITLE: 2, COMPANY: 3, POSTERS: 4, BUS: 5, MINI: 6, STANDEE: 7, TEASER: 8 },

  MOVIE_POSTERS: {
    ACTIVE: 1,
    POSTER_ID: 2,
    TITLE: 3,
    RELEASE: 4,
    INV_COUNT: 5,
    RECEIVED: 6,
    NOTES: 7,
    CLOSE_QUEUE: 8,
  },

  REQUESTS: {
    REQ_TS: 1,
    EMP_EMAIL: 2,
    EMP_NAME: 3,
    POSTER_ID: 4,
    LABEL_AT_REQ: 5,
    TITLE_SNAP: 6,
    RELEASE_SNAP: 7,
    ACTION_TYPE: 8,
    STATUS: 9,
    STATUS_TS: 10,
  },

  REQUEST_ORDER: {
    FORM_TS: 1,
    EMP_EMAIL: 2,
    ADD_RAW: 3,
    REMOVE_RAW: 4,
    SLOTS_BEFORE: 5,
    SLOTS_AFTER: 6,
    ADDED_ACCEPTED: 7,
    REMOVED_APPLIED: 8,
    DENIED_ADDS: 9,
    NOTES: 10,
  },

  SUBSCRIBERS: { ACTIVE: 1, EMAIL: 2, NAME: 3 },
};

const STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
};
