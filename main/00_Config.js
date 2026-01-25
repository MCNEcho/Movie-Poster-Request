/** 00_Config.gs **/

const CONFIG = {
  TIMEZONE: 'America/Los_Angeles',

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form - Pasco',
    DESCRIPTION:
      'You can only have your name on 7 posters at a time. If you already have all 7 slots maxed out and you want a different poster, remove one from your selection to choose a new one.',
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
    ERROR_LOG: 'Error Log',     // script-created - Task 1
    ANALYTICS: 'Analytics',     // script-created - Task 3
    ANALYTICS_SUMMARY: 'Analytics Summary', // script-created - Task 3
    DATA_INTEGRITY: 'Data Integrity', // script-created - Task 5
  },

  MAX_ACTIVE: 7,

  // Deduplication configuration (Feature: Config flags for dedup rules)
  ALLOW_REREQUEST_AFTER_REMOVAL: true, // Allow re-requesting a poster after removal
  REREQUEST_COOLDOWN_DAYS: 0, // Days to wait before re-request (0 = immediate if ALLOW_REREQUEST_AFTER_REMOVAL is true)

  // Cache configuration (Task 2 - Performance Optimization)
  CACHE_TTL_MINUTES: 5, // Cache time-to-live in minutes
  
  // Analytics configuration (Task 3 - Logging & Monitoring)
  DATE_FORMAT: 'MM/dd/yyyy HH:mm:ss',
  
  // Admin email for error notifications (Task 1 - Error Handling)
  ADMIN_EMAIL: '', // Leave blank to use spreadsheet owner

  // Bulk Simulator configuration (Task 5 - Bulk Submission Simulator)
  BULK_SIMULATOR: {
    MAX_SIMULATIONS: 100,        // Hard cap on number of simulations per run
    DEFAULT_SIMULATIONS: 10,     // Default number if not specified
    WARNING_THRESHOLD: 50,       // Warn user if N >= this value
    MAX_ADD_PER_SIM: 3,         // Max posters to add in a single simulation
    MAX_REMOVE_PER_SIM: 3,      // Max posters to remove in a single simulation
  },

  // Backup configuration (Task 8 - Nightly Data Backup)
  BACKUP: {
    RETENTION_DAYS: 30,           // Keep backups for 30 days
    FORMAT: 'CSV',                // 'CSV' or 'SHEET' (Google Sheet copy)
    FOLDER_NAME: 'Poster System Backups', // Drive folder name
    ENABLED: true,                // Set to false to disable backups
    SHEETS_TO_BACKUP: [
      'Requests',                 // Complete audit trail
      'Request Order',            // Submission history
      'Inventory'                 // Inventory tracking
    ],
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
    BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
  },

  // Announcement batching configuration
  ANNOUNCEMENT: {
    BATCH_ENABLED: true,
    BATCH_SIZE: 5, // Max posters per email
    THROTTLE_DELAY_MS: 1000, // Delay between emails
    RETRY_ATTEMPTS: 3,
    RETRY_INITIAL_DELAY_MS: 500,
  },

  // Email templates with variable support
  TEMPLATES: {
    DEFAULT: {
      subject: 'We Have Added More Posters to the Request Form!',
      body: `We Have Added More Posters to the Request Form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    SINGLE_POSTER: {
      subject: 'New Poster Available: {{TITLE}}',
      body: `A new poster is now available!

Title: {{TITLE}}
Release Date: {{RELEASE}}
Stock: {{STOCK}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    },
    BATCH: {
      subject: 'New Posters Available - {{COUNT}} Added!',
      body: `We've added {{COUNT}} new posters to the request form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}`
    }
  },
};

// 1-based column indexes
const COLS = {
  INVENTORY: {
    ACTIVE: 1,        // NEW: Checkbox for activation
    RELEASE: 2,       // Shifted from 1
    TITLE: 3,         // Shifted from 2
    COMPANY: 4,       // Shifted from 3
    POSTERS: 5,       // Shifted from 4 - Primary tracking column
    BUS: 6,           // Shifted from 5
    MINI: 7,          // Shifted from 6
    STANDEE: 8,       // Shifted from 7
    TEASER: 9,        // Shifted from 8
    POSTER_ID: 10,    // NEW: Unique ID column
    RECEIVED: 11,     // NEW: Optional received date
    NOTES: 12,        // NEW: Optional notes
  },

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
