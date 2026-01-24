# Announcement Batching Feature Documentation

## Overview
This enhancement adds batching, template variables, and dry-run preview capabilities to the announcement system.

## Features

### 1. Template System with Variables
Templates support the following variables:
- `{{TITLE}}` - Movie poster title
- `{{RELEASE}}` - Release date
- `{{STOCK}}` - Available stock count
- `{{ACTIVE_COUNT}}` - Total number of active posters
- `{{FORM_LINK}}` - URL to the request form
- `{{COUNT}}` - Number of posters (for batch announcements)
- `{{POSTER_LIST}}` - Formatted list of posters

**Variable Substitution:**
- All variables are safely substituted with actual values
- Missing or null variables are replaced with `[N/A]`
- Any unrecognized placeholders are also replaced with `[N/A]`

### 2. Announcement Batching
When enabled (default), multiple posters can be grouped into a single email:
- **Batch Size:** Configurable (default: 5 posters per email)
- **Auto-batching:** Automatically groups posters when multiple are in the queue
- **Template Selection:** Uses `BATCH` template for multiple posters, `SINGLE_POSTER` for one

**Configuration:**
```javascript
CONFIG.ANNOUNCEMENT = {
  BATCH_ENABLED: true,        // Enable/disable batching
  BATCH_SIZE: 5,              // Max posters per email
  THROTTLE_DELAY_MS: 1000,    // Delay between emails (ms)
  RETRY_ATTEMPTS: 3,          // Number of retry attempts
  RETRY_INITIAL_DELAY_MS: 500 // Initial retry delay (ms)
}
```

### 3. Dry-Run Preview
The `previewPendingAnnouncement()` function now provides:
- Number of recipients
- Number of posters to announce
- Rendered email subject with substituted variables
- Rendered email body with substituted variables
- Full preview before sending

**Usage:** 
Call from Google Apps Script menu: `Preview Pending Announcement`

### 4. Throttling and Backoff
- **Email Throttling:** Configurable delay between emails to avoid quota spikes
- **Retry Logic:** Uses exponential backoff for transient failures
- **Error Recovery:** Individual email failures don't stop the entire batch
- **Configurable Attempts:** Number of retry attempts can be adjusted

### 5. Analytics and Error Logging
All announcement activities are logged:
- **Success Events:** Logged to Analytics sheet with poster count and recipient count
- **Error Events:** Logged to Error Log with full context and stack traces
- **Custom Announcements:** Tracked separately as `CUSTOM_SUCCESS`

**Log Entry Format:**
```
Timestamp | Event Type         | Status         | Notes
----------|-------------------|----------------|---------------------------
...       | ANNOUNCEMENT_SENT | SUCCESS        | Sent for 3 poster(s) to 15 recipient(s)
...       | ANNOUNCEMENT_SENT | CUSTOM_SUCCESS | Sent for 1 poster(s) to 15 recipient(s)
```

## Templates

### SINGLE_POSTER Template
Used when announcing a single poster.

**Subject:** `New Poster Available: {{TITLE}}`

**Body:**
```
A new poster is now available!

Title: {{TITLE}}
Release Date: {{RELEASE}}
Stock: {{STOCK}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}
```

### BATCH Template
Used when announcing multiple posters (2 or more).

**Subject:** `New Posters Available - {{COUNT}} Added!`

**Body:**
```
We've added {{COUNT}} new posters to the request form!

{{POSTER_LIST}}

Total Active Posters: {{ACTIVE_COUNT}}

Request here:
{{FORM_LINK}}
```

### DEFAULT Template
Fallback template (kept for backward compatibility).

**Subject:** `We Have Added More Posters to the Request Form!`

## API Functions

### Core Functions

#### `processAnnouncementQueue(forceSend)`
Main function that processes the announcement queue with batching support.
- Checks if batching is enabled
- Routes to `processBatchedAnnouncements_()` or `processIndividualAnnouncements_()`
- Logs all events to Analytics
- Handles errors gracefully

#### `generateAnnouncementPreview_(queue, ids)`
Generates a dry-run preview of announcements.
- Selects appropriate template
- Substitutes all variables
- Returns formatted preview text

#### `processBatchedAnnouncements_(queue, ids, recipients)`
Processes announcements in batches.
- Splits posters into batches based on `CONFIG.ANNOUNCEMENT.BATCH_SIZE`
- Applies throttling between batches
- Uses retry logic for each batch

#### `processIndividualAnnouncements_(queue, ids, recipients)`
Processes announcements individually (no batching).
- Sends one email per poster
- Applies throttling between emails
- Uses retry logic for each email

### Helper Functions

#### `substituteVariables_(template, variables)`
Safely substitutes template variables with actual values.
- Replaces all `{{VARIABLE}}` placeholders
- Provides `[N/A]` fallback for missing data
- Handles undefined variables gracefully

#### `getStockInfo_(posterId)`
Retrieves stock information for a poster from the Movie Posters sheet.
- Returns inventory count if available
- Returns "Available" as fallback

#### `sendAnnouncementEmail_(recipients, subject, body)`
Sends email with retry and backoff logic.
- Uses `retryWithBackoff_()` from ErrorHandler
- Logs individual failures
- Continues with remaining recipients on failure

#### `logAnnouncementEvent_(posterCount, recipientCount, status)`
Logs announcement events to the Analytics sheet.

## Custom Announcements

Custom announcements also benefit from the new features:
- **Enhanced Preview:** Shows substituted variables
- **Retry Logic:** Uses exponential backoff
- **Throttling:** Respects delay configuration
- **Extended Variables:** Supports `{{FORM_LINK}}` in addition to `{{FORM_URL}}`

## Error Handling

### Transient Errors
Automatically retried with exponential backoff:
- Timeout errors
- Rate limiting (429)
- Server errors (5xx)
- Temporarily unavailable services

### Non-Transient Errors
Logged but not retried:
- Invalid email addresses
- Permission errors
- Content policy violations

### Error Recovery
- Individual email failures don't stop the batch
- Errors are logged with full context
- System continues with remaining recipients

## Configuration Options

All configuration is in `00_Config.js`:

```javascript
ANNOUNCEMENT: {
  BATCH_ENABLED: true,           // Enable batching
  BATCH_SIZE: 5,                 // Posters per email
  THROTTLE_DELAY_MS: 1000,       // Delay between emails (ms)
  RETRY_ATTEMPTS: 3,             // Retry attempts
  RETRY_INITIAL_DELAY_MS: 500,   // Initial retry delay (ms)
}
```

## Testing

Comprehensive tests validate:
1. Single poster template substitution
2. Batch template with multiple posters
3. Missing variable fallback
4. Batching logic with various queue sizes

**Test Results:**
```
✅ Single poster template test passed
✅ Batch template test passed
✅ Missing variable fallback test passed
✅ Batching logic test passed
```

## Best Practices

1. **Preview Before Sending:** Always use `previewPendingAnnouncement()` to verify content
2. **Monitor Analytics:** Check the Analytics sheet for send success rates
3. **Review Error Log:** Regularly check for failed sends and resolve issues
4. **Adjust Throttling:** Increase `THROTTLE_DELAY_MS` if approaching quota limits
5. **Batch Size:** Keep `BATCH_SIZE` reasonable (5-10) to avoid email truncation

## Migration Notes

- Existing announcement queues will work without modification
- Custom announcements remain backward compatible
- No database migrations required
- All new features are opt-in via configuration

## Support

For issues or questions about the announcement batching feature, check:
1. Error Log sheet for specific error messages
2. Analytics sheet for send patterns
3. Console logs (View > Logs in Apps Script editor)
