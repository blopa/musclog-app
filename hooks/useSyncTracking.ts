/**
 * useSyncTracking Hook
 * React hook for managing Health Connect data sync operations and status
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { HealthConnectError } from '../services/healthConnectErrors';
import { healthDataSyncService, SyncResult, SyncStatus } from '../services/healthDataSync';

export interface UseSyncTrackingResult {
  // Sync status
  isSyncing: boolean;
  isSyncEnabled: boolean;
  lastSyncTime: number;
  lastSyncResult: SyncResult | null;

  // Actions
  syncNow: (config?: { lookbackDays?: number }) => Promise<SyncResult>;
  enableSync: () => Promise<void>;
  disableSync: () => Promise<void>;
  refreshSyncStatus: () => Promise<void>;

  // Errors
  error: HealthConnectError | null;
  clearError: () => void;
}

/**
 * Hook for tracking Health Connect sync operations
 */
export const useSyncTracking = (): UseSyncTrackingResult => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<HealthConnectError | null>(null);

  /**
   * Refresh sync status from service
   */
  const refreshSyncStatus = useCallback(async (): Promise<void> => {
    try {
      const [enabled, lastSync, inProgress] = await Promise.all([
        healthDataSyncService.isSyncEnabled(),
        healthDataSyncService.getLastSyncTime(),
        Promise.resolve(healthDataSyncService.isSyncInProgress()),
      ]);

      setIsSyncEnabled(enabled);
      setLastSyncTime(lastSync);
      setIsSyncing(inProgress);
    } catch (err) {
      console.error('Error refreshing sync status:', err);
    }
  }, []);

  /**
   * Trigger manual sync
   */
  const syncNow = useCallback(
    async (config?: { lookbackDays?: number }): Promise<SyncResult> => {
      setError(null);
      setIsSyncing(true);

      try {
        const result = await healthDataSyncService.syncFromHealthConnect(config);
        setLastSyncResult(result);

        if (result.status === SyncStatus.SUCCESS) {
          setLastSyncTime(result.endTime);

          // Show success notification if significant data was synced
          if (result.recordsWritten > 0) {
            Alert.alert(
              'Sync Complete',
              `Successfully synced ${result.recordsWritten} health records.`,
              [{ text: 'OK' }]
            );
          }
        } else if (result.status === SyncStatus.ERROR && result.errors.length > 0) {
          // Show first error to user
          const firstError = result.errors[0];
          Alert.alert('Sync Error', firstError.getUserMessage(), [{ text: 'OK' }]);
          setError(firstError);
        }

        return result;
      } catch (err) {
        const hcError = err as HealthConnectError;
        console.error('Sync failed:', hcError);
        setError(hcError);

        Alert.alert('Sync Failed', hcError.getUserMessage(), [{ text: 'OK' }]);

        // Return error result
        const errorResult: SyncResult = {
          status: SyncStatus.ERROR,
          recordsRead: 0,
          recordsWritten: 0,
          recordsSkipped: 0,
          errors: [hcError],
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
        };
        setLastSyncResult(errorResult);
        return errorResult;
      } finally {
        setIsSyncing(false);
        await refreshSyncStatus();
      }
    },
    [refreshSyncStatus]
  );

  /**
   * Enable automatic syncing
   */
  const enableSync = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await healthDataSyncService.enableSync();
      setIsSyncEnabled(true);

      // Trigger initial sync
      await syncNow({ lookbackDays: 30 });
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error enabling sync:', hcError);
      setError(hcError);
      Alert.alert('Error', 'Failed to enable Health Connect sync.', [{ text: 'OK' }]);
    }
  }, [syncNow]);

  /**
   * Disable automatic syncing
   */
  const disableSync = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await healthDataSyncService.disableSync();
      setIsSyncEnabled(false);
      Alert.alert('Sync Disabled', 'Health Connect sync has been disabled.', [{ text: 'OK' }]);
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error disabling sync:', hcError);
      setError(hcError);
      Alert.alert('Error', 'Failed to disable Health Connect sync.', [{ text: 'OK' }]);
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load initial sync status on mount
  useEffect(() => {
    refreshSyncStatus();
  }, [refreshSyncStatus]);

  // Poll sync status periodically (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSyncing) {
        refreshSyncStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isSyncing, refreshSyncStatus]);

  return {
    // Status
    isSyncing,
    isSyncEnabled,
    lastSyncTime,
    lastSyncResult,

    // Actions
    syncNow,
    enableSync,
    disableSync,
    refreshSyncStatus,

    // Errors
    error,
    clearError,
  };
};
