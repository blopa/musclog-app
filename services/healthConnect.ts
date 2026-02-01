/**
 * Health Connect Core Service
 * Wrapper around react-native-health-connect with comprehensive error handling
 */

import { Platform } from 'react-native';
import {
  aggregateRecord,
  deleteRecordsByTimeRange,
  deleteRecordsByUuids,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  openHealthConnectDataManagement,
  openHealthConnectSettings,
  type Permission,
  readRecords,
  type ReadRecordsResult,
  requestPermission,
  revokeAllPermissions,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import {
  HealthConnectError,
  HealthConnectErrorCode,
  HealthConnectErrorFactory,
} from './healthConnectErrors';

/**
 * Health Connect initialization status
 */
export enum HealthConnectStatus {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZING = 'INITIALIZING',
  AVAILABLE = 'AVAILABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  NOT_INSTALLED = 'NOT_INSTALLED',
  ERROR = 'ERROR',
}

/**
 * Time range filter interface
 */
export interface TimeRangeFilter {
  operator: 'between';
  startTime: string; // ISO string
  endTime: string; // ISO string
}

/**
 * Required permissions for musclog app
 */
export const REQUIRED_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Height' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'BodyFat' },
  { accessType: 'read', recordType: 'Nutrition' },
  { accessType: 'write', recordType: 'Nutrition' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'write', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'write', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'LeanBodyMass' },
  { accessType: 'write', recordType: 'LeanBodyMass' },
];

/**
 * Health Connect Service
 * Singleton service for managing Health Connect interactions
 */
class HealthConnectService {
  private status: HealthConnectStatus = HealthConnectStatus.NOT_INITIALIZED;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Get current Health Connect status
   */
  getStatus(): HealthConnectStatus {
    return this.status;
  }

  /**
   * Check if Health Connect is available on device
   */
  async checkAvailability(): Promise<HealthConnectStatus> {
    // Health Connect is Android-only
    if (Platform.OS !== 'android') {
      this.status = HealthConnectStatus.NOT_SUPPORTED;
      return this.status;
    }

    try {
      const sdkStatus = await getSdkStatus();

      switch (sdkStatus) {
        case SdkAvailabilityStatus.SDK_AVAILABLE:
          this.status = HealthConnectStatus.AVAILABLE;
          break;
        case SdkAvailabilityStatus.SDK_UNAVAILABLE:
        case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
          this.status = HealthConnectStatus.NOT_INSTALLED;
          break;
        default:
          this.status = HealthConnectStatus.ERROR;
      }

      return this.status;
    } catch (error) {
      console.error('Error checking Health Connect availability:', error);
      this.status = HealthConnectStatus.ERROR;
      throw HealthConnectErrorFactory.sdkNotAvailable(error as Error);
    }
  }

  /**
   * Initialize Health Connect SDK
   * Safe to call multiple times - will reuse existing initialization
   */
  async initializeHealthConnect(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Already initialized successfully
    if (this.status === HealthConnectStatus.AVAILABLE) {
      return Promise.resolve();
    }

    // Create new initialization promise
    this.initializationPromise = (async () => {
      try {
        this.status = HealthConnectStatus.INITIALIZING;

        // First check availability
        const availabilityStatus = await this.checkAvailability();

        if (availabilityStatus === HealthConnectStatus.NOT_SUPPORTED) {
          throw new HealthConnectError(
            HealthConnectErrorCode.SDK_NOT_AVAILABLE,
            'Health Connect is not supported on this platform',
            { retryable: false }
          );
        }

        if (availabilityStatus === HealthConnectStatus.NOT_INSTALLED) {
          throw new HealthConnectError(
            HealthConnectErrorCode.SDK_NOT_AVAILABLE,
            'Health Connect is not installed on this device',
            { retryable: false }
          );
        }

        // Initialize the SDK
        const isInitialized = await initialize();

        if (!isInitialized) {
          throw new HealthConnectError(
            HealthConnectErrorCode.INITIALIZATION_FAILED,
            'Failed to initialize Health Connect SDK',
            { retryable: true }
          );
        }

        this.status = HealthConnectStatus.AVAILABLE;
      } catch (error) {
        this.status = HealthConnectStatus.ERROR;
        this.initializationPromise = null; // Allow retry
        throw error instanceof HealthConnectError
          ? error
          : HealthConnectErrorFactory.unknownError(error as Error);
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Request permissions for Health Connect data access
   */
  async requestPermissions(
    permissions: Permission[] = REQUIRED_PERMISSIONS
  ): Promise<{ granted: Permission[]; denied: Permission[] }> {
    try {
      await this.ensureInitialized();

      const grantedPermissions = await requestPermission(permissions);

      // Compare requested vs granted to identify denied permissions
      const granted: Permission[] = [];
      const denied: Permission[] = [];

      for (const requested of permissions) {
        const isGranted = grantedPermissions.some(
          (p) => p.recordType === requested.recordType && p.accessType === requested.accessType
        );

        if (isGranted) {
          granted.push(requested);
        } else {
          denied.push(requested);
        }
      }

      if (denied.length > 0) {
        console.warn('Some Health Connect permissions were denied:', denied);
      }

      return { granted, denied };
    } catch (error) {
      console.error('Error requesting Health Connect permissions:', error);
      throw new HealthConnectError(
        HealthConnectErrorCode.PERMISSION_REQUEST_FAILED,
        'Failed to request Health Connect permissions',
        {
          originalError: error as Error,
          retryable: true,
        }
      );
    }
  }

  /**
   * Get currently granted permissions
   */
  async getGrantedPermissions(): Promise<Permission[]> {
    try {
      await this.ensureInitialized();
      return (await getGrantedPermissions()) as Permission[];
    } catch (error) {
      console.error('Error getting granted permissions:', error);
      throw HealthConnectErrorFactory.unknownError(error as Error);
    }
  }

  /**
   * Check if all required permissions are granted
   */
  async hasAllRequiredPermissions(): Promise<boolean> {
    try {
      const granted = await this.getGrantedPermissions();

      return REQUIRED_PERMISSIONS.every((required) =>
        granted.some(
          (g) => g.recordType === required.recordType && g.accessType === required.accessType
        )
      );
    } catch (error) {
      console.error('Error checking required permissions:', error);
      return false;
    }
  }

  /**
   * Revoke all Health Connect permissions
   */
  async revokeAllPermissions(): Promise<void> {
    try {
      await this.ensureInitialized();
      await revokeAllPermissions();
    } catch (error) {
      console.error('Error revoking permissions:', error);
      throw HealthConnectErrorFactory.unknownError(error as Error);
    }
  }

  /**
   * Read records from Health Connect
   */
  async readRecords(
    recordType: string,
    timeRangeFilter: TimeRangeFilter
  ): Promise<ReadRecordsResult<any>> {
    try {
      await this.ensureInitialized();

      // Validate time range
      if (timeRangeFilter.startTime >= timeRangeFilter.endTime) {
        throw new HealthConnectError(
          HealthConnectErrorCode.INVALID_TIME_RANGE,
          'Start time must be before end time',
          { retryable: false, context: { timeRangeFilter } }
        );
      }

      const result = await readRecords(recordType as any, {
        timeRangeFilter,
      });
      return result;
    } catch (error) {
      if (error instanceof HealthConnectError) {
        throw error;
      }
      console.error(`Error reading ${recordType} records:`, error);
      throw HealthConnectErrorFactory.readFailed(recordType, error as Error);
    }
  }

  /**
   * Insert records to Health Connect
   */
  async insertRecords(records: any[]): Promise<string[]> {
    try {
      await this.ensureInitialized();

      if (records.length === 0) {
        return [];
      }

      const recordIds = await insertRecords(records);
      return recordIds;
    } catch (error) {
      console.error('Error inserting records:', error);
      throw new HealthConnectError(
        HealthConnectErrorCode.WRITE_FAILED,
        'Failed to insert records to Health Connect',
        {
          originalError: error as Error,
          retryable: true,
          context: { recordCount: records.length },
        }
      );
    }
  }

  /**
   * Aggregate records for analysis
   */
  async aggregateRecords(
    recordType: string,
    timeRangeFilter: TimeRangeFilter,
    metricTypes?: string[]
  ): Promise<any> {
    try {
      await this.ensureInitialized();

      const result = await aggregateRecord({
        recordType: recordType as any,
        timeRangeFilter,
        dataOriginFilter: [], // Include all data sources
      });

      return result;
    } catch (error) {
      console.error(`Error aggregating ${recordType} records:`, error);
      throw HealthConnectErrorFactory.readFailed(recordType, error as Error);
    }
  }

  /**
   * Delete records by UUIDs
   */
  async deleteRecordsByUuids(recordType: string, recordIdsList: string[]): Promise<void> {
    try {
      await this.ensureInitialized();

      if (recordIdsList.length === 0) {
        return;
      }

      await deleteRecordsByUuids(recordType as any, recordIdsList, []);
    } catch (error) {
      console.error(`Error deleting ${recordType} records by UUIDs:`, error);
      throw HealthConnectErrorFactory.writeFailed(recordType, error as Error);
    }
  }

  /**
   * Delete records by time range
   */
  async deleteRecordsByTimeRange(
    recordType: string,
    timeRangeFilter: TimeRangeFilter
  ): Promise<void> {
    try {
      await this.ensureInitialized();

      await deleteRecordsByTimeRange(recordType as any, timeRangeFilter);
    } catch (error) {
      console.error(`Error deleting ${recordType} records by time range:`, error);
      throw HealthConnectErrorFactory.writeFailed(recordType, error as Error);
    }
  }

  /**
   * Open Health Connect settings
   */
  async openSettings(): Promise<void> {
    try {
      await this.ensureInitialized();
      await openHealthConnectSettings();
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
      throw HealthConnectErrorFactory.unknownError(error as Error);
    }
  }

  /**
   * Open Health Connect data management
   */
  async openDataManagement(): Promise<void> {
    try {
      await this.ensureInitialized();
      await openHealthConnectDataManagement();
    } catch (error) {
      console.error('Error opening Health Connect data management:', error);
      throw HealthConnectErrorFactory.unknownError(error as Error);
    }
  }

  /**
   * Ensure Health Connect is initialized before operation
   */
  private async ensureInitialized(): Promise<void> {
    if (this.status === HealthConnectStatus.AVAILABLE) {
      return;
    }

    await this.initializeHealthConnect();
  }
}

// Export singleton instance
export const healthConnectService = new HealthConnectService();
