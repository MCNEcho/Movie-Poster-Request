/** 00_Config.gs **/

const CONFIG = {
  TIMEZONE: 'America/Los_Angeles',
  
  // Admin Configuration
  ADMIN_EMAIL: '',  // Leave blank to use Session.getActiveUser().getEmail()

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form - Pasco',
    // Description is generated dynamically - see getFormDescription_()
    DESCRIPTION: '',
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
    ERROR_LOG: 'Error Log',     // script-created
    ANALYTICS: 'Analytics',     // script-created
    DATA_INTEGRITY: 'Data Integrity', // script-created
  },

  MAX_ACTIVE: 7,

  // Deduplication & Re-request Configuration
  ALLOW_REREQUEST_AFTER_REMOVAL: false,  // Allow employees to re-request posters they previously removed
  REREQUEST_COOLDOWN_DAYS: 0,            // Days to wait before re-requesting (0 = no cooldown)

  // Cache Configuration
  CACHE: {
    DEFAULT_TTL: 5 * 60 * 1000,           // 5 minutes default
    EMPLOYEE_COUNT_TTL: 5 * 60 * 1000,    // 5 minutes for employee counts
    POSTER_AVAILABILITY_TTL: 10 * 60 * 1000,  // 10 minutes for poster maps
    BOARD_SNAPSHOT_TTL: 5 * 60 * 1000,    // 5 minutes for board data
  },

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

    CACHE_PREFIX: 'CACHE_',
    LAST_ANALYTICS_FLUSH: 'LAST_ANALYTICS_FLUSH',
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

  ERROR_LOG: {
    TIMESTAMP: 1,
    ERROR_TYPE: 2,
    FUNCTION_NAME: 3,
    ERROR_MESSAGE: 4,
    STACK_TRACE: 5,
    CONTEXT: 6,
    SEVERITY: 7,
  },

  ANALYTICS: {
    TIMESTAMP: 1,
    EVENT_TYPE: 2,
    USER_EMAIL: 3,
    DETAILS: 4,
    EXECUTION_TIME: 5,
    SUCCESS: 6,
  },

  DATA_INTEGRITY: {
    CHECK_TIME: 1,
    CHECK_TYPE: 2,
    STATUS: 3,
    ISSUES_FOUND: 4,
    AUTO_FIXED: 5,
    DETAILS: 6,
  },
};

const STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
};
