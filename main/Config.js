/** Config.js **/

const CONFIG = {
  VERSION: {
    LABEL: 'v2026.10.14.2',
    UPDATED_AT: '2026-10-14',
    NOTES: 'Serialized refreshes, form validation, and ledger reliability fixes',
  },

  TIMEZONE: 'America/Los_Angeles',

  // Leave blank to auto-create form + store its ID in Script Properties.
  // If you WANT to force a specific form, paste its /d/<ID>/ here.
  FORM_ID: '',

  FORM_META: {
    TITLE: 'Poster Request Form',
  },

  FORM_SLOTS: 10,

  FORM: {
    Q_EMPLOYEE_NAME: 'Name (First Name + Last Initial)',
    Q_ADD: 'Request Posters (Add)',
    Q_REMOVE: 'Remove Posters',
  },

  SHEETS: {
    MAIN: 'Main',
    EMPLOYEES: 'Employees',
    REQUEST_ORDER: 'Request Order',
    INVENTORY: 'Inventory',          // PRIMARY: Canonical source for poster data
    PRINT_OUT: 'Print Out',
    POSTER_OUTSIDE: 'Poster Outside',
    POSTER_INSIDE: 'Poster Inside',
    REQUESTS: 'Requests',       // script-created
    DOCUMENTATION: 'Documentation',
    ERROR_LOG: 'Error Log',     // script-created - Task 1
    ANALYTICS: 'Analytics',     // script-created - Task 3
    ANALYTICS_SUMMARY: 'Analytics Summary', // script-created - Task 3
    DATA_INTEGRITY: 'Data Integrity', // script-created - Task 5
  },

  MAX_ACTIVE: 10,

  // Deduplication configuration (Feature: Config flags for dedup rules)
  ALLOW_REREQUEST_AFTER_REMOVAL: true, // Allow re-requesting a poster after removal
  REREQUEST_COOLDOWN_DAYS: 0, // Days to wait before re-request (0 = immediate if ALLOW_REREQUEST_AFTER_REMOVAL is true)

  // Cache configuration (Task 2 - Performance Optimization)
  CACHE_TTL_MINUTES: 5, // Cache time-to-live in minutes
  
  // Analytics configuration (Task 3 - Logging & Monitoring)
  DATE_FORMAT: 'MM/dd/yyyy HH:mm:ss',
  
  // Admin email for error notifications (Task 1 - Error Handling)
  ADMIN_EMAIL: '', // Leave blank to use spreadsheet owner

  // Backup configuration (Task 8 - Nightly Data Backup)
  BACKUP: {
    RETENTION_DAYS: 7,            // Keep backups for 7 days
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
    REQUESTS_SNAPSHOT: 'REQUESTS_SNAPSHOT_JSON',
    INVENTORY_ROW_COUNT: 'INVENTORY_DATA_ROW_COUNT',
    REQUESTS_ROW_COUNT: 'REQUESTS_DATA_ROW_COUNT',
    MANUAL_POSTER_REFRESH_QUEUED: 'MANUAL_POSTER_REFRESH_QUEUED',
    MANUAL_POSTER_REFRESH_RUNNING: 'MANUAL_POSTER_REFRESH_RUNNING',
    DISPLAY_LABEL_TO_ID: 'DISPLAY_LABEL_TO_ID_JSON',
    LAST_NIGHTLY_BACKUP_DATE: 'LAST_NIGHTLY_BACKUP_DATE',

    BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
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
    NOTES: 10,        // Notes moved to column J
    POSTER_ID: 11,    // Poster ID moved to column K
    // Column L reserved/unused; Poster Received Date removed
  },

  REQUESTS: {
    REQ_TS: 1,
    EMP_EMAIL: 2,         // Email for employees, Phone for customers (see CONTACT_TYPE)
    EMP_NAME: 3,
    POSTER_ID: 4,
    LABEL_AT_REQ: 5,
    TITLE_SNAP: 6,
    RELEASE_SNAP: 7,
    ACTION_TYPE: 8,
    STATUS: 9,
    STATUS_TS: 10,
    CONTACT_TYPE: 11,     // 'EMPLOYEE' or 'CUSTOMER' (NEW: distinguishes contact type)
    NOTES: 12,            // Optional notes about the request (NEW: stores poster-specific notes)
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

};

const STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
  REMOVED_INVENTORY_DELETE: 'REMOVED_INVENTORY_DELETE',
}; // Status values used in the request ledger.

// End of shared configuration.

