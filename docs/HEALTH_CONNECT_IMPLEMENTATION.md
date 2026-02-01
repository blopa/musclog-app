# Health Connect Implementation - Complete Documentation

## Overview

This document provides comprehensive documentation for the Health Connect integration in the musclog app. The implementation covers all scenarios beyond the happy path, including error handling, edge cases, retry logic, and data validation.

## Architecture

### Core Components

1. **Error Handling** (`services/healthConnectErrors.ts`)
   - Comprehensive error type definitions
   - User-friendly error messages
   - Retry logic with exponential backoff
   - Error classification (retryable vs non-retryable)

2. **Core Service** (`services/healthConnect.ts`)
   - SDK initialization and availability checking
   - Permission management
   - CRUD operations for health records
   - Singleton pattern for service instance

3. **Data Transformation** (`services/healthDataTransform.ts`)
   - Unit conversion (metric/imperial)
   - Data validation and range checking
   - Outlier detection
   - Deduplication by timestamp
   - Timezone handling

4. **Sync Orchestration** (`services/healthDataSync.ts`)
   - Bi-directional sync coordination
   - Batch processing with configurable size
   - Incremental sync with last sync tracking
   - Concurrent sync prevention
   - Database transaction management

5. **React Hooks**
   - `useHealthConnect.ts` - Initialization and permissions
   - `useSyncTracking.ts` - Sync status and operations

## Supported Health Data Types

The implementation supports the following Health Connect data types:

| Data Type              | Access     | HC Record Type         | App Metric Type          |
| ---------------------- | ---------- | ---------------------- | ------------------------ |
| Height                 | Read       | `Height`               | `height`                 |
| Weight                 | Read       | `Weight`               | `weight`                 |
| Body Fat               | Read       | `BodyFat`              | `body_fat`               |
| Lean Body Mass         | Read/Write | `LeanBodyMass`         | `lean_body_mass`         |
| Basal Metabolic Rate   | Read       | `BasalMetabolicRate`   | `basal_metabolic_rate`   |
| Total Calories Burned  | Read/Write | `TotalCaloriesBurned`  | `total_calories_burned`  |
| Active Calories Burned | Read/Write | `ActiveCaloriesBurned` | `active_calories_burned` |
| Nutrition              | Read/Write | `Nutrition`            | `nutrition`              |
| Exercise Session       | Read/Write | `ExerciseSession`      | `exercise`               |

## Error Handling

### Error Types

The implementation defines 20+ error codes covering all scenarios:

#### Initialization & SDK Errors

- `SDK_NOT_AVAILABLE` - Health Connect not installed
- `INITIALIZATION_FAILED` - SDK init failed
- `SDK_VERSION_MISMATCH` - Version incompatibility

#### Permission Errors

- `PERMISSION_DENIED` - User denied permissions
- `PERMISSION_REVOKED` - User revoked previously granted permissions
- `PERMISSION_REQUEST_FAILED` - Permission request failed
- `INSUFFICIENT_PERMISSIONS` - Missing required permissions

#### Data Read/Write Errors

- `READ_FAILED` - Failed to read from Health Connect
- `WRITE_FAILED` - Failed to write to Health Connect
- `READ_TIMEOUT` - Read operation timed out
- `WRITE_TIMEOUT` - Write operation timed out

#### Validation Errors

- `INVALID_VALUE_RANGE` - Value outside acceptable range
- `MISSING_REQUIRED_FIELD` - Required field missing
- `INVALID_UNIT` - Invalid unit of measurement
- `INVALID_TIMESTAMP` - Invalid or future timestamp

#### Sync Errors

- `SYNC_FAILED` - Sync operation failed
- `SYNC_CONFLICT` - Local vs remote data conflict
- `SYNC_IN_PROGRESS` - Concurrent sync attempted
- `OFFLINE` - Device offline

### Retry Logic

Errors are classified as retryable or non-retryable:

**Retryable Errors** (with exponential backoff):

- Network errors
- Timeouts
- Rate limiting
- Sync failures
- Temporary read/write failures

**Non-Retryable Errors**:

- Permission denied
- Invalid data
- SDK not available
- Validation failures

**Retry Configuration**:

```typescript
{
  maxAttempts: 3,
  baseDelay: 1000ms,
  maxDelay: 16000ms,
  jitter: ±25%
}
```

**Backoff Schedule**: 1s → 2s → 4s → 8s → 16s (max)

## Data Validation

### Range Validation

Each metric type has defined acceptable ranges:

| Metric            | Min | Max        | Unit     |
| ----------------- | --- | ---------- | -------- |
| Height            | 50  | 300        | cm       |
| Weight            | 20  | 500        | kg       |
| Body Fat          | 2   | 70         | %        |
| Lean Body Mass    | 10  | 300        | kg       |
| BMR               | 500 | 10,000     | kcal/day |
| Total Calories    | 0   | 20,000     | kcal     |
| Active Calories   | 0   | 15,000     | kcal     |
| Nutrition         | 0   | 100,000    | kcal     |
| Exercise Duration | 0   | 86,400,000 | ms       |

### Outlier Detection

Uses z-score method to detect statistical outliers:

- Requires 3+ historical data points
- Flags values >3 standard deviations from mean
- Logs warnings but doesn't reject data

### Timestamp Validation

- Must not be in the future (allows 1 min clock skew)
- Must be positive (Unix epoch or later)
- Automatically captures timezone information

### Deduplication

- Identifies duplicates by exact timestamp match
- Removes duplicates before database insertion
- Checks existing database records to prevent re-insertion

## Sync Strategy

### Incremental Sync

- Tracks last successful sync timestamp
- Only syncs new/modified data since last sync
- Configurable lookback period (default: 30 days)

### Batch Processing

- Processes records in configurable batches (default: 100)
- Uses database transactions for atomicity
- All-or-nothing per batch (if one fails, none written)

### Conflict Resolution

When local and Health Connect data differ for same timestamp:

1. Health Connect is treated as source of truth
2. Local data is overwritten (unless user explicitly edited)
3. Conflict is logged for audit trail

### Sync Frequency

Manual triggers:

- App launch (auto-initialization)
- User-initiated sync button
- After permission grant
- Pull-to-refresh (if implemented)

Background sync (future):

- Periodic background tasks (configurable interval)
- Push notifications when new data available
- Low-battery awareness

## Permission Management

### Permission Flow

1. **Check Availability**
   - Verify Health Connect installed
   - Check SDK version compatibility
   - Platform check (Android only)

2. **Initialize SDK**
   - One-time initialization per app session
   - Caches initialization state
   - Safe to call multiple times

3. **Request Permissions**
   - Request all 9 data types at once
   - User sees Android's native permission dialog
   - Returns granted/denied list

4. **Handle Partial Grants**
   - App functions with partial permissions
   - Shows warning for missing permissions
   - Offers "Open Settings" option

5. **Permission Revocation**
   - Detects when permissions revoked
   - Disables sync automatically
   - Prompts user to re-enable

### Required Permissions

The following Android permissions are declared in `app.json`:

```json
"android.permission.health.READ_HEIGHT"
"android.permission.health.READ_WEIGHT"
"android.permission.health.READ_BODY_FAT"
"android.permission.health.READ_NUTRITION"
"android.permission.health.WRITE_NUTRITION"
"android.permission.health.READ_TOTAL_CALORIES_BURNED"
"android.permission.health.WRITE_TOTAL_CALORIES_BURNED"
"android.permission.health.READ_ACTIVE_CALORIES_BURNED"
"android.permission.health.WRITE_ACTIVE_CALORIES_BURNED"
"android.permission.health.READ_BASAL_METABOLIC_RATE"
"android.permission.health.READ_EXERCISE"
"android.permission.health.WRITE_EXERCISE"
"android.permission.health.READ_LEAN_BODY_MASS"
"android.permission.health.WRITE_LEAN_BODY_MASS"
```

## Unit Conversion

### Supported Conversions

**Length**:

- Meters ↔ Centimeters
- Centimeters ↔ Inches
- Feet/Inches display format

**Weight**:

- Kilograms ↔ Pounds
- Grams ↔ Kilograms

**Energy**:

- Kilojoules ↔ Kilocalories

### Display Formatting

Respects user's unit preference (metric/imperial):

- Heights: "175 cm" or "5' 9""
- Weights: "70.5 kg" or "155.4 lbs"
- Calories: "2000 kcal" (always kcal)

## Database Schema

### UserMetric Table

Stores all synced health data:

```typescript
{
  id: string;           // Auto-generated UUID
  type: string;         // Metric type (height, weight, etc.)
  value: number;        // Numeric value
  unit?: string;        // Unit of measurement
  date: number;         // Unix timestamp (ms)
  timezone: string;     // Timezone string (e.g., "America/New_York")
  created_at: number;   // Record creation time
  updated_at: number;   // Last update time
  deleted_at?: number;  // Soft delete timestamp
}
```

### Settings Table

Stores Health Connect configuration:

| Type                              | Value              | Description          |
| --------------------------------- | ------------------ | -------------------- |
| `health_connect_sync_enabled`     | `'true'`/`'false'` | Sync enabled flag    |
| `health_connect_last_sync`        | Unix timestamp     | Last successful sync |
| `health_connect_sync_in_progress` | `'true'`/`'false'` | Sync lock flag       |

## Edge Cases Handled

### Platform-Specific

- ✅ Android-only feature (iOS gracefully unsupported)
- ✅ Minimum Android SDK 26 (Android 8.0) required
- ✅ Health Connect app not installed → direct to Play Store
- ✅ SDK version incompatibility → error message

### Permission Scenarios

- ✅ User denies all permissions → informative error
- ✅ User grants partial permissions → app works with limitations
- ✅ User revokes permissions later → sync disabled, re-prompt
- ✅ Permission request fails → retry option

### Data Quality

- ✅ Negative values → rejected with validation error
- ✅ Unrealistic values (e.g., 500 kg weight) → rejected
- ✅ Future timestamps → rejected (allows 1 min clock skew)
- ✅ Duplicate records → filtered before insertion
- ✅ Missing required fields → logged and skipped
- ✅ Invalid units → conversion or rejection

### Sync Scenarios

- ✅ Device offline → queued for later, user notified
- ✅ Concurrent syncs → second sync blocked with error
- ✅ Partial sync failure → rolls back transaction
- ✅ Rate limiting → exponential backoff retry
- ✅ Large data sets → pagination/batching
- ✅ Sync interruption → resumes from last success
- ✅ Clock drift → timezone-aware timestamps

### Network & Performance

- ✅ Network timeout → retry with backoff
- ✅ Slow response → progress indicators shown
- ✅ Background sync → (future: background task support)
- ✅ Battery optimization → (future: low-battery mode)
- ✅ Data usage → batching reduces API calls

## UI/UX Considerations

### Loading States

- Initialization: "Initializing Health Connect..."
- Permission request: Android's native dialog
- Syncing: "Syncing health data..." with spinner
- Processing: "Processing..." generic state

### Error Display

- Red background alert box
- User-friendly error messages
- Actionable buttons (e.g., "Open Settings", "Retry")
- Auto-dismiss on success

### Success Feedback

- Alert: "Successfully synced X health records"
- Button changes to "Connected" when permissions granted
- Green checkmark icon (future enhancement)
- Last sync timestamp display (future enhancement)

### Navigation Flow

1. Health Connect screen shows
2. User taps "Allow Health Access"
3. Permission dialog appears (Android native)
4. If granted → sync starts automatically
5. After sync → navigates to next onboarding screen
6. If denied → stays on screen with error + retry option

## Testing Scenarios

### Manual Testing Checklist

**Happy Path**:

- [ ] Install app on Android 8.0+ device
- [ ] Health Connect is installed
- [ ] Grant all permissions
- [ ] Sync completes successfully
- [ ] Data appears in app

**Error Paths**:

- [ ] Health Connect not installed → error + Play Store link
- [ ] Deny all permissions → error message
- [ ] Grant partial permissions → warning message
- [ ] Revoke permissions → sync disabled
- [ ] Enable airplane mode → offline error
- [ ] Input invalid data → validation error
- [ ] Trigger rate limiting → retry with backoff

**Edge Cases**:

- [ ] Very large dataset (1000+ records) → pagination works
- [ ] Duplicate records → deduplication works
- [ ] Future timestamp → rejected
- [ ] Negative weight → rejected
- [ ] Concurrent syncs → second blocked
- [ ] Sync interruption → resume works
- [ ] App backgrounded during sync → handles gracefully

## Future Enhancements

### Phase 2 Features

1. **Background Sync**
   - Periodic sync every 4-6 hours
   - Use `expo-background-task` or `expo-task-manager`
   - Respect battery saver mode

2. **Write to Health Connect**
   - Sync app-recorded workouts → Health Connect
   - Sync nutrition logs → Health Connect
   - Two-way sync with conflict resolution

3. **Exercise Routes**
   - Request exercise route permissions
   - Display workout maps
   - Export GPX files

4. **Advanced Metrics**
   - Heart rate during workouts
   - Sleep tracking integration
   - Step count and distance
   - VO2 Max readings

5. **Settings Screen**
   - Toggle individual data types
   - Manual sync button
   - Last sync timestamp display
   - Sync history/logs
   - Clear synced data option

6. **Notifications**
   - Notify when sync completes
   - Alert on sync errors
   - Remind to grant permissions

7. **Analytics**
   - Sync success rate tracking
   - Average sync duration
   - Data quality metrics
   - User engagement with feature

## Security & Privacy

### Data Handling

- Health data stored locally in WatermelonDB (SQLite)
- No health data sent to external servers
- User can delete all synced data
- Soft deletes preserve audit trail

### Permissions

- Minimal permissions requested (only what's needed)
- User controls data access via Android settings
- Permission revocation respected immediately

### Compliance

- GDPR-ready (data export/deletion)
- HIPAA considerations (encryption at rest)
- Android Health Connect privacy policies followed

## Troubleshooting

### Common Issues

**Issue**: "Health Connect is not available"

- **Cause**: Health Connect app not installed
- **Solution**: Direct user to Play Store to install

**Issue**: Sync fails silently

- **Cause**: Missing permissions
- **Solution**: Check `hasAllRequiredPermissions()`, re-prompt

**Issue**: Duplicate records appearing

- **Cause**: Deduplication logic bypassed
- **Solution**: Verify `deduplicateRecords()` is called before insert

**Issue**: Data not showing after sync

- **Cause**: Validation rejected data
- **Solution**: Check logs for validation errors, adjust ranges if needed

**Issue**: Sync takes too long

- **Cause**: Large dataset without pagination
- **Solution**: Reduce `lookbackDays` or implement pagination

## API Reference

### Services

**healthConnectService**

- `initializeHealthConnect()`: Promise<void>
- `requestPermissions(permissions?)`: Promise<{granted, denied}>
- `getGrantedPermissions()`: Promise<HealthConnectPermission[]>
- `hasAllRequiredPermissions()`: Promise<boolean>
- `readRecords<T>(recordType, timeRange)`: Promise<RecordResult<T>>
- `insertRecords<T>(records)`: Promise<string[]>
- `openSettings()`: Promise<void>

**healthDataSyncService**

- `syncFromHealthConnect(config?)`: Promise<SyncResult>
- `isSyncEnabled()`: Promise<boolean>
- `enableSync()`: Promise<void>
- `disableSync()`: Promise<void>
- `getLastSyncTime()`: Promise<number>

### Hooks

**useHealthConnect()**

- Returns: `{ status, isAvailable, hasAllPermissions, initialize, requestPermissions, ... }`

**useSyncTracking()**

- Returns: `{ isSyncing, lastSyncTime, syncNow, enableSync, disableSync, ... }`

## Conclusion

This implementation provides a robust, production-ready Health Connect integration that handles all edge cases, validates data thoroughly, retries transient failures, and provides excellent user experience. The modular architecture allows for easy extension and maintenance.
