import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '../context/SnackbarContext';
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
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
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

          // Show success notification - silently skip unavailable metrics
          if (result.recordsWritten > 0 || result.recordsSkipped > 0) {
            const message =
              result.recordsWritten > 0
                ? t('snackbar.syncedRecords', { count: result.recordsWritten })
                : t('snackbar.noNewData');

            showSnackbar('success', message);
          }
        } else if (result.status === SyncStatus.ERROR && result.errors.length > 0) {
          // Show first error to user (but only if it's a real error, not missing permission)
          const firstError = result.errors[0];
          // Silent skip for permission errors - don't show alert
          if (
            firstError.code !== 'INSUFFICIENT_PERMISSIONS' &&
            firstError.code !== 'PERMISSION_DENIED'
          ) {
            showSnackbar('error', firstError.getUserMessage());
            setError(firstError);
          }
        }

        return result;
      } catch (err) {
        const hcError = err as HealthConnectError;
        console.error('Sync failed:', hcError);

        // Silent skip for no permissions scenario
        if (hcError.code === 'INSUFFICIENT_PERMISSIONS' || hcError.code === 'PERMISSION_DENIED') {
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
        }

        setError(hcError);
        showSnackbar('error', hcError.getUserMessage());

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
    [refreshSyncStatus, showSnackbar, t]
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
      showSnackbar('error', t('snackbar.failedToEnableSync'));
    }
  }, [showSnackbar, syncNow, t]);

  /**
   * Disable automatic syncing
   */
  const disableSync = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await healthDataSyncService.disableSync();
      setIsSyncEnabled(false);
      showSnackbar('success', t('snackbar.syncDisabledMessage'));
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error disabling sync:', hcError);
      setError(hcError);
      showSnackbar('error', t('snackbar.failedToDisableSync'));
    }
  }, [showSnackbar, t]);

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
