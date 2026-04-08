import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import type { Permission } from 'react-native-health-connect';

import { useSnackbar } from '@/context/SnackbarContext';
import { healthConnectService, HealthConnectStatus } from '@/services/healthConnect';
import { HealthConnectError } from '@/services/healthConnectErrors';

export interface PermissionStats {
  total: number;
  granted: number;
  percentage: number;
  permissions: { recordType: string; read: boolean; write: boolean }[];
}

export interface UseHealthConnectResult {
  // Status
  status: HealthConnectStatus;
  isAvailable: boolean;
  isInitialized: boolean;
  isInitializing: boolean;

  // Permissions (updated for partial support)
  hasAllPermissions: boolean;
  hasAnyPermission: boolean;
  permissionStats: PermissionStats | null;
  isCheckingPermissions: boolean;

  // Actions
  initialize: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  checkPermissions: () => Promise<void>;
  openSettings: () => Promise<void>;
  openDataManagement: () => Promise<void>;

  // Errors
  error: HealthConnectError | null;
  clearError: () => void;
}

/**
 * Hook for managing Health Connect lifecycle
 */
export const useHealthConnectPermissions = (): UseHealthConnectResult => {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [status, setStatus] = useState<HealthConnectStatus>(HealthConnectStatus.NOT_INITIALIZED);
  const [hasAllPermissions, setHasAllPermissions] = useState(false);
  const [hasAnyPermission, setHasAnyPermission] = useState(false);
  const [permissionStats, setPermissionStats] = useState<PermissionStats | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [error, setError] = useState<HealthConnectError | null>(null);

  // Derived states
  const isAvailable = status === HealthConnectStatus.AVAILABLE;
  const isInitialized = status === HealthConnectStatus.AVAILABLE;
  const isInitializing = status === HealthConnectStatus.INITIALIZING;

  /**
   * Initialize Health Connect
   */
  const initialize = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setStatus(HealthConnectStatus.NOT_SUPPORTED);
      return false;
    }

    try {
      setError(null);
      await healthConnectService.initializeHealthConnect();
      setStatus(healthConnectService.getStatus());
      return true;
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Health Connect initialization failed:', hcError);
      setError(hcError);
      setStatus(HealthConnectStatus.ERROR);

      // Show user-friendly error
      if (hcError.code === 'SDK_NOT_AVAILABLE') {
        showSnackbar('error', hcError.getUserMessage());
      }

      return false;
    }
  }, [showSnackbar]);

  /**
   * Check current permissions status
   */
  const checkPermissions = useCallback(async (): Promise<void> => {
    if (!isAvailable) {
      return;
    }

    try {
      setIsCheckingPermissions(true);
      setError(null);

      // Check all and any permissions
      const [hasAll, hasAny, stats] = await Promise.all([
        healthConnectService.hasAllRequiredPermissions(),
        healthConnectService.hasAnyPermission(),
        healthConnectService.getPermissionStats(),
      ]);

      setHasAllPermissions(hasAll);
      setHasAnyPermission(hasAny);
      setPermissionStats(stats);
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error checking permissions:', hcError);
      setError(hcError);
      setHasAllPermissions(false);
      setHasAnyPermission(false);
      setPermissionStats(null);
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [isAvailable]);

  /**
   * Open Health Connect settings
   */
  const openSettings = useCallback(async (): Promise<void> => {
    if (!isAvailable) {
      return;
    }

    try {
      await healthConnectService.openSettings();
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error opening settings:', hcError);
      setError(hcError);
    }
  }, [isAvailable]);

  /**
   * Request Health Connect permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      showSnackbar('error', t('healthConnect.initializeFirst'));
      return false;
    }

    try {
      setError(null);
      const result = await healthConnectService.requestPermissions();

      // Check if mandatory READ permissions are granted: Nutrition, BodyFat, Weight
      const mandatoryPermissions = ['Nutrition', 'BodyFat', 'Weight'];
      const deniedMandatory = result.denied.filter(
        (p: Permission) => p.accessType === 'read' && mandatoryPermissions.includes(p.recordType)
      );

      const hasMandatoryPermissions = deniedMandatory.length === 0;
      setHasAllPermissions(hasMandatoryPermissions);

      if (!hasMandatoryPermissions) {
        const deniedTypes = deniedMandatory.map((p: Permission) => p.recordType).join(', ');
        showSnackbar('error', t('healthConnect.permissionsDenied', { types: deniedTypes }), {
          action: t('healthConnect.openSettings'),
          onAction: () => openSettings(),
          duration: 2000,
        });
      }

      return hasMandatoryPermissions;
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error requesting permissions:', hcError);
      setError(hcError);
      showSnackbar('error', hcError.getUserMessage());
      return false;
    }
  }, [isAvailable, openSettings, showSnackbar, t]);

  /**
   * Open Health Connect data management
   */
  const openDataManagement = useCallback(async (): Promise<void> => {
    if (!isAvailable) {
      return;
    }

    try {
      await healthConnectService.openDataManagement();
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error opening data management:', hcError);
      setError(hcError);
    }
  }, [isAvailable]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-initialize on mount (iOS + Android)
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      initialize();
    }
  }, [initialize]);

  // Check permissions when initialized
  useEffect(() => {
    if (isInitialized) {
      checkPermissions();
    }
  }, [isInitialized, checkPermissions]);

  return {
    // Status
    status,
    isAvailable,
    isInitialized,
    isInitializing,

    // Permissions (updated for partial support)
    hasAllPermissions,
    hasAnyPermission,
    permissionStats,
    isCheckingPermissions,

    // Actions
    initialize,
    requestPermissions,
    checkPermissions,
    openSettings,
    openDataManagement,

    // Errors
    error,
    clearError,
  };
};
