# Beta 1.01 Testing Guide

## Manual Testing Checklist

### Error Handling
- [ ] Test form submission with invalid name - verify error logged to Error Log sheet
- [ ] Test form submission with network interruption - verify retry logic works
- [ ] Test board rebuild failure - verify error logged with HIGH severity
- [ ] Verify critical errors send email notification to admin

### Caching
- [ ] Submit multiple forms in quick succession - verify performance improvement
- [ ] Check cache stats after form submissions
- [ ] Verify cache invalidation after form submission (employee counts cleared)
- [ ] Verify cache invalidation after poster edit (poster maps cleared)
- [ ] Test getCacheStats_() function returns valid data

### Analytics
- [ ] Verify form submissions logged to Analytics sheet
- [ ] Verify board rebuilds logged to Analytics sheet
- [ ] Verify announcements logged to Analytics sheet
- [ ] Test getAnalyticsSummary_() for a date range
- [ ] Test getMostRequestedPosters_() returns top posters
- [ ] Test detectAnomalies_() with spike in submissions

### Data Integrity
- [ ] Run "Run Data Integrity Checks" from admin menu
- [ ] Verify orphaned requests detected (create test case)
- [ ] Verify duplicate requests detected (create test case)
- [ ] Test auto-fix functionality
- [ ] Verify results logged to Data Integrity sheet

### Event-Driven Announcements
- [ ] Activate a single poster - verify immediate announcement (< 5 seconds)
- [ ] Activate 3 posters within 1 minute - verify batched announcement
- [ ] Activate 5+ posters at once - verify immediate send
- [ ] Verify fallback time-based trigger still works (wait 1 hour)
- [ ] Test "Send Announcement Now" button
- [ ] Verify queue status tracked in analytics

### Backwards Compatibility
- [ ] Run "Run Setup / Repair" - verify all sheets created
- [ ] Test existing form submission workflow - should work unchanged
- [ ] Test existing board rebuild - should work unchanged
- [ ] Test existing announcement system - should work unchanged
- [ ] Verify existing admin menu items still function

### Integration Testing
- [ ] Submit 10 forms in sequence - verify all systems work together
- [ ] Edit Movie Posters sheet - verify cascade of operations
- [ ] Run setup on fresh spreadsheet - verify all initialization works
- [ ] Test with multiple concurrent users (if possible)

## Performance Benchmarks

Record execution times before and after:

### Before (baseline):
- Form submission: ___ seconds
- Board rebuild: ___ seconds
- Announcement delivery: ___ seconds
- Sheet read operations: ___ per operation

### After (with caching):
- Form submission: ___ seconds (target: 15-20% faster)
- Board rebuild: ___ seconds (target: 25-30% faster)
- Announcement delivery: ___ seconds (target: < 5 seconds)
- Sheet read operations: ___ per operation (target: 40-60% reduction)

## Known Limitations

1. Cache TTLs are fixed at 5-10 minutes - may need adjustment based on usage
2. Event-driven announcements batch within 1-minute window - may delay some notifications
3. Data integrity auto-fix cannot resolve over-capacity assignments
4. Error email notifications go to active user only - may need admin list
5. Analytics sheet may grow large over time - consider archiving strategy

## Rollback Plan

If issues occur:
1. Revert to commit 95f090b (pre-enhancement)
2. Delete new sheets: Error Log, Analytics, Data Integrity
3. Remove new triggers if created
4. Clear all cache entries: clearAllCache_()
