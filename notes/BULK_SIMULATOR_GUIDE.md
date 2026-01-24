# Bulk Submission Simulator - Usage Guide

## Overview
The Bulk Submission Simulator is a stress-testing tool that generates N randomized poster submissions and logs detailed performance metrics to help monitor system health and quota usage.

## Features
- **Randomized Submissions**: Generates realistic add/remove poster selections
- **Performance Metrics**: Tracks execution time, sheet reads, cache hits, and lock wait times
- **Dry-Run Mode**: Test without modifying data (recommended for first run)
- **Safety Guardrails**: 
  - Hard cap at 100 simulations per run
  - Warning prompt when N >= 50 in live mode
- **Analytics Integration**: All metrics logged to Analytics sheet with automatic summary updates

## How to Use

### Step 1: Access the Simulator
1. Open your Poster Request System spreadsheet
2. Click **"Poster System"** menu in the top menu bar
3. Select **"Run Bulk Submission Simulator"**

### Step 2: Configure Simulation
In the dialog that appears:

**Number of Simulations (N):**
- Enter the number of submissions to simulate (1-100)
- Default: 10
- Recommended for first test: 5-10 in dry-run mode

**Dry Run Mode:**
- ☑ **Checked** (Recommended): Simulates without modifying data
- ☐ **Unchecked**: Actually processes submissions (use carefully)

### Step 3: Run Simulation
1. Click **"Run Simulation"** button
2. If N >= 50 in live mode, confirm the warning prompt
3. Wait for completion (status updates in dialog)
4. View results in the dialog:
   - Success/Error counts
   - Total execution time
   - Average execution time
   - Sheet reads
   - Cache hits
   - Lock wait time

### Step 4: Review Analytics
After simulation completes:
1. Navigate to **Analytics** sheet
2. Look for "BULK_SIMULATION" event type entries
3. Review the metrics columns
4. Navigate to **Analytics Summary** sheet to see aggregated stats

## Metrics Explained

### Execution Time (ms)
- Total time to process all N submissions
- Average time per submission shown in results
- Use to: Identify performance bottlenecks

### Sheet Reads
- Number of spreadsheet read operations
- Higher values indicate more quota usage
- Use to: Estimate Google Sheets API quota consumption

### Cache Hits
- Number of times cached data was used instead of reading from sheets
- Higher is better (reduces quota usage)
- Use to: Evaluate cache effectiveness

### Lock Wait Time (ms)
- Time spent waiting to acquire script lock
- Should be minimal (< 100ms per submission)
- High values indicate contention issues
- Use to: Identify concurrency bottlenecks

## Use Cases

### 1. Pre-Production Load Testing
**Goal**: Verify system handles expected load
```
Configuration:
- N: 50 (simulate peak hour traffic)
- Dry-Run: Checked
- Expected: < 30 second total time, < 500ms avg
```

### 2. Quota Usage Estimation
**Goal**: Estimate Google Sheets API quota consumption
```
Configuration:
- N: 20 (simulate typical daily traffic)
- Dry-Run: Checked
- Check: Total sheet reads should be < 2000
```

### 3. Cache Performance Validation
**Goal**: Verify caching is working effectively
```
Configuration:
- N: 25
- Dry-Run: Checked
- Check: Cache hit rate should be > 30%
```

### 4. Stress Testing Under Load
**Goal**: Find breaking points
```
Configuration:
- N: 100 (maximum allowed)
- Dry-Run: Checked
- Monitor: Lock wait times and error rate
```

### 5. Generate Test Data
**Goal**: Populate system with sample requests
```
Configuration:
- N: 10-20
- Dry-Run: Unchecked (LIVE MODE)
- Note: Creates actual test employee requests
```

## Safety Guidelines

### Always Start with Dry-Run
- First simulation should ALWAYS use dry-run mode
- Verify metrics are reasonable before live mode
- Check for errors in dry-run before proceeding

### Monitor Quota Usage
- Google Sheets API has daily quotas
- Each simulation consumes quota
- Dry-run uses minimal quota
- Live mode uses full quota per submission

### Recommended Limits
- **Development/Testing**: N <= 25
- **Performance Testing**: N <= 50 (dry-run)
- **Stress Testing**: N <= 100 (dry-run)
- **Production Load Testing**: N <= 10 (live mode)

### Warning Signs
Stop testing if you observe:
- Average execution time > 2000ms
- Lock wait time > 500ms
- Error rate > 10%
- Cache hit rate < 10%

## Interpreting Results

### Good Performance Indicators
✅ Avg execution time: 300-800ms
✅ Lock wait time: < 100ms per submission
✅ Error rate: 0%
✅ Cache hit rate: > 30%
✅ Sheet reads: < 10 per submission

### Performance Issues
⚠️ Avg execution time: > 1500ms
- **Cause**: System may be slow or under heavy load
- **Action**: Optimize code, increase cache TTL

⚠️ Lock wait time: > 300ms
- **Cause**: High contention from concurrent access
- **Action**: Reduce concurrent submissions, optimize lock usage

⚠️ Error rate: > 5%
- **Cause**: Data validation failures, lock timeouts
- **Action**: Check logs for specific errors, increase lock timeout

⚠️ Cache hit rate: < 20%
- **Cause**: Cache expiring too quickly or not being used
- **Action**: Increase CACHE_TTL_MINUTES in config

## Troubleshooting

### "Lock timeout" errors
**Problem**: Simulator cannot acquire script lock
**Solutions**:
- Reduce N value
- Wait a few minutes for other operations to complete
- Check if other processes are running

### "No active posters available"
**Problem**: No posters marked as Active in Movie Posters sheet
**Solutions**:
- Add at least one poster to Movie Posters sheet
- Set Active? checkbox to TRUE for at least one poster

### Very high execution times
**Problem**: Each submission takes several seconds
**Solutions**:
- Check internet connection
- Verify no other scripts are running
- Consider increasing cache TTL
- Review data volume in sheets

### Dialog doesn't appear
**Problem**: Menu item doesn't show dialog
**Solutions**:
- Refresh spreadsheet page
- Check browser console for errors
- Verify script permissions are granted

## Best Practices

1. **Test incrementally**: Start small (N=5), increase gradually
2. **Use dry-run first**: Always test with dry-run before live mode
3. **Monitor analytics**: Check Analytics Summary regularly
4. **Document results**: Note metrics for comparison over time
5. **Schedule wisely**: Run during off-peak hours to avoid quota issues
6. **Clean up test data**: Remove test employee requests after validation

## Configuration

To modify simulator behavior, edit `00_Config.js`:

```javascript
BULK_SIMULATOR: {
  MAX_SIMULATIONS: 100,        // Hard cap (don't increase)
  DEFAULT_SIMULATIONS: 10,     // Default N value
  WARNING_THRESHOLD: 50,       // Prompt user at this N
  MAX_ADD_PER_SIM: 3,         // Max posters added per submission
  MAX_REMOVE_PER_SIM: 3,      // Max posters removed per submission
}
```

## Metrics in Analytics Sheet

Bulk simulation events appear in the Analytics sheet with:
- **Event Type**: BULK_SIMULATION
- **Posters Requested**: Total posters added across all N simulations
- **Posters Removed**: Total posters removed across all N simulations
- **Request Status**: DRY_RUN or COMPLETE
- **Execution Time (ms)**: Total time for all N simulations
- **Sheet Reads**: Total sheet reads across all N simulations
- **Cache Hits**: Total cache hits across all N simulations
- **Lock Wait Time (ms)**: Total lock wait time across all N simulations
- **Notes**: Summary with N, average time, and error count

## FAQ

**Q: Will dry-run mode consume quota?**
A: Yes, but minimal. Dry-run reads data for validation but doesn't write.

**Q: Can I run multiple simulations simultaneously?**
A: No, the script lock prevents concurrent execution. Run sequentially.

**Q: How do I clear test employee data?**
A: Manually delete rows from Requests sheet where email contains "test.sim."

**Q: What's the maximum safe N value?**
A: Depends on system. Start with 10, increase to 50 max in dry-run. Live mode: 10 max recommended.

**Q: How often can I run simulations?**
A: No hard limit, but be mindful of daily API quotas. A few simulations per day is safe.

**Q: Does simulator affect real employee data?**
A: In dry-run mode: No. In live mode: Only creates test employee entries (test.sim.* emails).

## Support

If you encounter issues:
1. Check **Extensions > Apps Script > Executions** for error logs
2. Review Analytics sheet for error patterns
3. Verify configuration in 00_Config.js
4. Reduce N value and try dry-run mode
5. Check PROJECT_DOCUMENTATION.txt for technical details

---

**Last Updated**: January 2026
**Version**: 1.0
**Feature**: Bulk Submission Simulator
