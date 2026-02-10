# Health Connect Quick Reference Guide

## Quick Start

### 1. Using in a Component

```typescript
import { useHealthConnect } from '../../hooks/useHealthConnect';
import { useSyncTracking } from '../../hooks/useSyncTracking';

function MyComponent() {
  const { isAvailable, hasAllPermissions, requestPermissions } = useHealthConnect();
  const { syncNow, isSyncing, lastSyncTime } = useSyncTracking();

  const handleConnect = async () => {
    if (!hasAllPermissions) {
      await requestPermissions();
    }
    await syncNow();
  };

  return (
    <Button onPress={handleConnect} disabled={isSyncing}>
      {isSyncing ? 'Syncing...' : 'Connect Health'}
    </Button>
  );
}
```

### 2. Direct Service Usage

```typescript
import { healthConnectService } from '../services/healthConnect';
import { healthDataSyncService } from '../services/healthDataSync';

// Initialize
await healthConnectService.initializeHealthConnect();

// Request permissions
const { granted, denied } = await healthConnectService.requestPermissions();

// Sync data
const result = await healthDataSyncService.syncFromHealthConnect({
  lookbackDays: 7,
  batchSize: 50,
});

console.log(`Synced ${result.recordsWritten} records`);
```

## Error Handling

### Using try-catch

```typescript
try {
  await healthConnectService.requestPermissions();
} catch (error) {
  if (error instanceof HealthConnectError) {
    console.log(error.code); // Error code
    console.log(error.getUserMessage()); // User-friendly message
    console.log(error.isRetryable()); // Can retry?
    console.log(error.getRetryDelay(1)); // Delay for attempt 1
  }
}
```

### Error Codes

Most common error codes:

- `SDK_NOT_AVAILABLE` - Health Connect not installed
- `PERMISSION_DENIED` - User denied permissions
- `INSUFFICIENT_PERMISSIONS` - Missing required permissions
- `SYNC_IN_PROGRESS` - Concurrent sync attempted
- `OFFLINE` - Device offline
- `INVALID_VALUE_RANGE` - Invalid data value

## Data Transformation

### Read and Transform

```typescript
import { HealthDataTransformer, DataValidator } from '../services/healthDataTransform';

// Transform Health Connect record to app format
const transformed = HealthDataTransformer.transformWeight(hcRecord);
// Returns: { type: 'weight', value: 70.5, unit: 'kg', date: 1234567890, timezone: 'America/New_York' }

// Validate
DataValidator.validateMetricValue('weight', 70.5); // Throws if invalid

// Deduplicate
const unique = HealthDataTransformer.deduplicateRecords(records);
```

### Unit Conversion

```typescript
import { WeightConverter, HeightConverter, UnitSystem } from '../services/healthDataTransform';

// Weight
const lbs = WeightConverter.kgToLbs(70); // 154.32 lbs
const display = WeightConverter.formatWeight(70, UnitSystem.IMPERIAL); // "154.3 lbs"

// Height
const inches = HeightConverter.cmToInches(175); // 68.9 inches
const display = HeightConverter.formatHeight(175, UnitSystem.IMPERIAL); // "5' 9""
```

## Sync Configuration

### Custom Sync Options

```typescript
await healthDataSyncService.syncFromHealthConnect({
  lookbackDays: 14, // Look back 2 weeks
  batchSize: 200, // Process 200 at a time
  retryAttempts: 5, // Retry up to 5 times
  skipValidation: false, // Don't skip validation
});
```

### Enable/Disable Sync

```typescript
// Enable auto-sync
await healthDataSyncService.enableSync();

// Disable auto-sync
await healthDataSyncService.disableSync();

// Check if enabled
const enabled = await healthDataSyncService.isSyncEnabled();

// Get last sync time
const lastSync = await healthDataSyncService.getLastSyncTime();
```

## Permission Patterns

### Check Before Action

```typescript
const hasPermissions = await healthConnectService.hasAllRequiredPermissions();

if (!hasPermissions) {
  // Request permissions first
  await healthConnectService.requestPermissions();
}

// Now safe to sync
await healthDataSyncService.syncFromHealthConnect();
```

### Partial Permissions Handling

```typescript
const { granted, denied } = await healthConnectService.requestPermissions();

if (denied.length > 0) {
  console.log(
    'Missing permissions:',
    denied.map((p) => p.recordType)
  );
  // Show UI to open settings
  await healthConnectService.openSettings();
}
```

## React Hook Patterns

### Status Checking

```typescript
const { status, isAvailable, isInitializing, error } = useHealthConnect();

if (!isAvailable) {
  return <Text>Health Connect not available</Text>;
}

if (isInitializing) {
  return <ActivityIndicator />;
}

if (error) {
  return <Text>{error.getUserMessage()}</Text>;
}
```

### Sync Status Display

```typescript
const { isSyncing, lastSyncTime, lastSyncResult } = useSyncTracking();

return (
  <View>
    <Text>Last Sync: {new Date(lastSyncTime).toLocaleString()}</Text>
    {lastSyncResult && (
      <Text>
        Read: {lastSyncResult.recordsRead},
        Written: {lastSyncResult.recordsWritten},
        Skipped: {lastSyncResult.recordsSkipped}
      </Text>
    )}
    {isSyncing && <ActivityIndicator />}
  </View>
);
```

## Validation Rules

### Metric Ranges

| Metric                 | Min | Max   | Unit     |
| ---------------------- | --- | ----- | -------- |
| height                 | 50  | 300   | cm       |
| weight                 | 20  | 500   | kg       |
| body_fat               | 2   | 70    | %        |
| lean_body_mass         | 10  | 300   | kg       |
| basal_metabolic_rate   | 500 | 10000 | kcal/day |
| total_calories_burned  | 0   | 20000 | kcal     |
| active_calories_burned | 0   | 15000 | kcal     |

### Custom Validation

```typescript
import { DataValidator } from '../services/healthDataTransform';

// Validate value
try {
  DataValidator.validateMetricValue('weight', 70);
} catch (error) {
  console.log('Invalid weight value');
}

// Validate timestamp
DataValidator.validateTimestamp(Date.now()); // OK
DataValidator.validateTimestamp(Date.now() + 10000); // Throws (future)

// Check outlier
const isOutlier = DataValidator.isOutlier(200, [70, 71, 69, 72]); // true
```

## Common Patterns

### Full Setup Flow

```typescript
async function setupHealthConnect() {
  try {
    // 1. Initialize
    await healthConnectService.initializeHealthConnect();

    // 2. Check if available
    if (healthConnectService.getStatus() !== HealthConnectStatus.AVAILABLE) {
      throw new Error('Health Connect not available');
    }

    // 3. Request permissions
    const { granted, denied } = await healthConnectService.requestPermissions();

    if (denied.length > 0) {
      console.warn('Some permissions denied:', denied);
    }

    // 4. Enable sync
    await healthDataSyncService.enableSync();

    // 5. Initial sync
    const result = await healthDataSyncService.syncFromHealthConnect({
      lookbackDays: 30,
    });

    console.log(`Setup complete. Synced ${result.recordsWritten} records.`);
  } catch (error) {
    if (error instanceof HealthConnectError) {
      // TODO: use snackbar here instead
      Alert.alert('Setup Failed', error.getUserMessage());
    }
  }
}
```

### Background Sync (Future)

```typescript
// Register background task
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const SYNC_TASK = 'health-connect-sync';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const enabled = await healthDataSyncService.isSyncEnabled();
    if (!enabled) return BackgroundFetch.BackgroundFetchResult.NoData;

    const result = await healthDataSyncService.syncFromHealthConnect({
      lookbackDays: 1, // Only sync last day in background
    });

    return result.recordsWritten > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register the task
await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
  minimumInterval: 60 * 60 * 4, // 4 hours
  stopOnTerminate: false,
  startOnBoot: true,
});
```

### Manual Sync Button

```typescript
function SyncButton() {
  const { syncNow, isSyncing } = useSyncTracking();
  const [progress, setProgress] = useState('');

  const handleSync = async () => {
    setProgress('Starting sync...');

    const result = await syncNow({ lookbackDays: 7 });

    if (result.status === SyncStatus.SUCCESS) {
      setProgress(`Synced ${result.recordsWritten} records in ${result.duration}ms`);
    } else {
      setProgress('Sync failed');
    }
  };

  return (
    <View>
      <Button onPress={handleSync} disabled={isSyncing}>
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </Button>
      {progress && <Text>{progress}</Text>}
    </View>
  );
}
```

## Debugging Tips

### Enable Verbose Logging

```typescript
// In development, log all errors
if (__DEV__) {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0] instanceof HealthConnectError) {
      originalError('HealthConnect Error:', {
        code: args[0].code,
        message: args[0].message,
        context: args[0].context,
        retryable: args[0].isRetryable(),
      });
    } else {
      originalError(...args);
    }
  };
}
```

### Check Sync Status in Dev Tools

```typescript
// In React Native Debugger or Flipper
import { healthDataSyncService } from './services/healthDataSync';
import { healthConnectService } from './services/healthConnect';

// Add to global for debugging
if (__DEV__) {
  global.healthConnect = {
    service: healthConnectService,
    syncService: healthDataSyncService,
    getStatus: () => healthConnectService.getStatus(),
    getLastSync: () => healthDataSyncService.getLastSyncTime(),
    syncNow: () => healthDataSyncService.syncFromHealthConnect(),
  };
}

// Then in console:
// healthConnect.getStatus()
// healthConnect.syncNow()
```

## Performance Tips

1. **Batch Size**: Adjust based on device performance
   - Fast devices: 200-500 records/batch
   - Average devices: 100 records/batch
   - Slow devices: 50 records/batch

2. **Lookback Days**: Limit for faster syncs
   - Initial sync: 30 days
   - Daily sync: 1-2 days
   - Manual refresh: 7 days

3. **Deduplication**: Always enabled to prevent database bloat

4. **Pagination**: Not yet implemented (future enhancement)

5. **Caching**: Permission status cached in React state

## Security Checklist

- ✅ Health data never leaves device
- ✅ No external API calls with health data
- ✅ User controls via Android Health Connect settings
- ✅ Soft deletes preserve audit trail
- ✅ Minimal permissions requested
- ✅ Permission revocation respected immediately
- ✅ Data encrypted at rest (SQLite with SQLCipher - future)
- ✅ GDPR-compliant (data export/deletion - future)

## Common Troubleshooting

| Issue                    | Solution                                |
| ------------------------ | --------------------------------------- |
| "SDK not available"      | Install Health Connect from Play Store  |
| Permissions not granted  | Call `requestPermissions()` again       |
| Sync fails silently      | Check `hasAllRequiredPermissions()`     |
| Duplicate records        | Verify `deduplicateRecords()` is called |
| Slow sync                | Reduce `lookbackDays` or `batchSize`    |
| Data not showing         | Check validation errors in console      |
| "Sync in progress" error | Wait for current sync to complete       |

## Additional Resources

- [Official Health Connect Docs](https://developer.android.com/health-and-fitness/guides/health-connect)
- [react-native-health-connect](https://matinzd.github.io/react-native-health-connect/)
- [Full Implementation Docs](./HEALTH_CONNECT_IMPLEMENTATION.md)
