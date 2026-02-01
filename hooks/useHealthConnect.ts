/**
 * useHealthConnect Hook
 * React hook for managing Health Connect state, initialization, and permissions
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { healthConnectService, HealthConnectStatus } from '../services/healthConnect';
import { HealthConnectError } from '../services/healthConnectErrors';

export interface UseHealthConnectResult {
  // Status
  status: HealthConnectStatus;
  isAvailable: boolean;
  isInitialized: boolean;
  isInitializing: boolean;

  // Permissions
  hasAllPermissions: boolean;
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
export const useHealthConnect = (): UseHealthConnectResult => {
  const [status, setStatus] = useState<HealthConnectStatus>(HealthConnectStatus.NOT_INITIALIZED);
  const [hasAllPermissions, setHasAllPermissions] = useState(false);
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
    // Android only
    if (Platform.OS !== 'android') {
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
        Alert.alert('Health Connect Not Available', hcError.getUserMessage(), [
          { text: 'OK', style: 'default' },
          {
            text: 'Install',
            style: 'default',
            onPress: () => {
              // Open Play Store to install Health Connect
              // This would require Linking.openURL with the Play Store link
              console.log('Open Play Store to install Health Connect');
            },
          },
        ]);
      }

      return false;
    }
  }, []);

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
      const hasAll = await healthConnectService.hasAllRequiredPermissions();
      setHasAllPermissions(hasAll);
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error checking permissions:', hcError);
      setError(hcError);
      setHasAllPermissions(false);
    } finally {
      setIsCheckingPermissions(false);
    }
  }, [isAvailable]);

  /**
   * Request Health Connect permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) {
      Alert.alert('Health Connect Not Available', 'Please initialize Health Connect first.', [
        { text: 'OK' },
      ]);
      return false;
    }

    try {
      setError(null);
      const result = await healthConnectService.requestPermissions();

      const allGranted = result.denied.length === 0;
      setHasAllPermissions(allGranted);

      if (!allGranted && result.denied.length > 0) {
        const deniedTypes = result.denied.map((p) => p.recordType).join(', ');
        Alert.alert(
          'Permissions Required',
          `The following permissions were not granted: ${deniedTypes}. Some features may not work correctly.`,
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Open Settings',
              style: 'default',
              onPress: () => openSettings(),
            },
          ]
        );
      }

      return allGranted;
    } catch (err) {
      const hcError = err as HealthConnectError;
      console.error('Error requesting permissions:', hcError);
      setError(hcError);
      Alert.alert('Permission Error', hcError.getUserMessage(), [{ text: 'OK' }]);
      return false;
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

  // Auto-initialize on mount (Android only)
  useEffect(() => {
    if (Platform.OS === 'android') {
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

    // Permissions
    hasAllPermissions,
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
