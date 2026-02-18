/** Config.js **/

// Configure this file for your Google Workspace environment.
// DO NOT edit array indices, column order, or sheet names without understanding the impact.

const CONFIG = {
  // =========== CORE SPREADSHEET CONFIGURATION ===========
  // ALL sheet names - these must match exactly in the spreadsheet.
  SHEETS: {
    INVENTORY: 'Inventory',
    MOVIE_POSTERS: 'Movie Posters', // Deprecated, kept for backwards-compat only
    MAIN: 'Main',
    EMPLOYEES: 'Employees',
    PRINT: 'Print Out',
    POSTER_OUTSIDE: 'Poster Outside',
    POSTER_INSIDE: 'Poster Inside',
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

  INVENTORY_LAST_UPDATED_CELL: 'A1',

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

    INVENTORY_SNAPSHOT: 'INVENTORY_SNAPSHOT_JSON',

    ANNOUNCE_QUEUE: 'ANNOUNCE_QUEUE_JSON',
    ANNOUNCED_IDS: 'ANNOUNCED_POSTER_IDS_JSON',
    CUSTOM_ANNOUNCE_QUEUE: 'CUSTOM_ANNOUNCE_QUEUE_JSON',
    BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
    
    // Deferred refresh state (formsubmit marks, background triggers refresh)
    NEEDS_REFRESH: 'SYSTEM_NEEDS_REFRESH_TS',
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
In Stock: {{STOCK}}

Request information:
{{FORM_LINK}}.`
    },
    BATCH: {
      subject: 'New Posters Available!',
      body: `{{ COUNT }} new poster(s) have been added to the request form!

{{ POSTER_LIST }}

Total Active Posters: {{ ACTIVE_COUNT }}

Request here:
{{ FORM_LINK }}`
    }
  },

  // Google Form questions
  FORM: {
    Q_EMPLOYEE_NAME: 'Employee Name (First Name + Last Initial)',
    Q_ADD: 'Which poster(s) would you like to request?',
    Q_REMOVE: 'Which poster(s) would you like to remove from your desk?',
    Q_SUBSCRIBE: 'Subscribe to announcements for new posters?',
  },

  // =========== COLUMN MAPPING FOR SHEETS ===========
  // All column indices (1-based, as shown in Google Sheets)
  // Modify these only if you restructure the sheets
  COLUMNS: {
    INVENTORY: {
      POSTER_ID: 1,
      TITLE: 2,
      RELEASE_DATE: 3,
      STOCK: 4,
      IS_ACTIVE: 5,
      ADDED_TS: 6,
      NOTES: 7,
    },
    REQUESTS: {
      EMP_EMAIL: 2,
      EMP_NAME: 3,
      POSTER_ID: 4,
      POSTER_ID_NEW: 5, // For transition from name-based to ID-based tracking
      LABEL_AT_REQ: 6,
      STATUS: 7,
      REQ_TS: 8,
      TITLE_SNAP: 9,
      RELEASE_SNAP: 10,
      REMOVED_TS: 11,
    },
    PRINT_OUT: {
      TITLE: 1,
      COUNT: 2,
      NAMES_COL: 3,
    },
  },
};

// =========== DERIVED COLUMN INDICES (DO NOT EDIT) ===========
// These are computed for convenience; modify COLUMNS above to change them
const COLS = {
  INVENTORY: (() => {
    const c = CONFIG.COLUMNS.INVENTORY;
    return {
      POSTER_ID: c.POSTER_ID,
      TITLE: c.TITLE,
      RELEASE_DATE: c.RELEASE_DATE,
      STOCK: c.STOCK,
      IS_ACTIVE: c.IS_ACTIVE,
      ADDED_TS: c.ADDED_TS,
      NOTES: c.NOTES,
    };
  })(),
  REQUESTS: (() => {
    const c = CONFIG.COLUMNS.REQUESTS;
    return {
      EMP_EMAIL: c.EMP_EMAIL,
      EMP_NAME: c.EMP_NAME,
      POSTER_ID: c.POSTER_ID,
      LABEL_AT_REQ: c.LABEL_AT_REQ,
      STATUS: c.STATUS,
      REQ_TS: c.REQ_TS,
      TITLE_SNAP: c.TITLE_SNAP,
      RELEASE_SNAP: c.RELEASE_SNAP,
      REMOVED_TS: c.REMOVED_TS,
    };
  })(),
};
