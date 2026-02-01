/**
 * Health Data Sync Service
 * Orchestrates bi-directional sync between Health Connect and local database
 */

import { Q } from '@nozbe/watermelondb';

import { database } from '../database/database-instance';
import Setting from '../database/models/Setting';
import UserMetric from '../database/models/UserMetric';
import { healthConnectService } from './healthConnect';
import {
  HealthConnectError,
  HealthConnectErrorCode,
  HealthConnectErrorFactory,
  RETRY_CONFIG,
} from './healthConnectErrors';
import {
  DataValidator,
  HealthDataTransformer,
  MetricType,
  TimestampConverter,
} from './healthDataTransform';

/**
 * Setting types for Health Connect sync tracking
 */
export const HC_SYNC_ENABLED_TYPE = 'health_connect_sync_enabled';
export const HC_LAST_SYNC_TYPE = 'health_connect_last_sync';
export const HC_SYNC_IN_PROGRESS_TYPE = 'health_connect_sync_in_progress';

/**
 * Sync status enum
 */
export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

/**
 * Sync result interface
 */
export interface SyncResult {
  status: SyncStatus;
  recordsRead: number;
  recordsWritten: number;
  recordsSkipped: number;
  errors: HealthConnectError[];
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Sync configuration
 */
interface SyncConfig {
  lookbackDays?: number; // How many days to look back (default: 30)
  batchSize?: number; // Records to process at once (default: 100)
  retryAttempts?: number; // Max retry attempts (default: 3)
  skipValidation?: boolean; // Skip validation (default: false)
}

/**
 * Health Data Sync Service
 */
class HealthDataSyncService {
  private syncInProgress = false;
  private lastSyncTime: number = 0;

  /**
   * Check if Health Connect sync is enabled
   */
  async isSyncEnabled(): Promise<boolean> {
    try {
      const settings = await database
        .get<Setting>('settings')
        .query(Q.where('type', HC_SYNC_ENABLED_TYPE), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      return settings.length > 0 && settings[0].value === 'true';
    } catch (error) {
      console.error('Error checking sync enabled status:', error);
      return false;
    }
  }

  /**
   * Enable Health Connect sync
   */
  async enableSync(): Promise<void> {
    const now = Date.now();
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', HC_SYNC_ENABLED_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSettings.length > 0) {
        await existingSettings[0].update((setting) => {
          setting.value = 'true';
          setting.updatedAt = now;
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = HC_SYNC_ENABLED_TYPE;
          setting.value = 'true';
          setting.createdAt = now;
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Disable Health Connect sync
   */
  async disableSync(): Promise<void> {
    const now = Date.now();
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', HC_SYNC_ENABLED_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSettings.length > 0) {
        await existingSettings[0].update((setting) => {
          setting.value = 'false';
          setting.updatedAt = now;
        });
      }
    });
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number> {
    try {
      const settings = await database
        .get<Setting>('settings')
        .query(Q.where('type', HC_LAST_SYNC_TYPE), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      if (settings.length === 0 || !settings[0].value) {
        return 0;
      }

      return parseInt(settings[0].value, 10);
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return 0;
    }
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTime(timestamp: number): Promise<void> {
    const existingSettings = await database
      .get<Setting>('settings')
      .query(Q.where('type', HC_LAST_SYNC_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    await database.write(async () => {
      if (existingSettings.length > 0) {
        await existingSettings[0].update((setting) => {
          setting.value = timestamp.toString();
          setting.updatedAt = Date.now();
        });
      } else {
        await database.get<Setting>('settings').create((setting) => {
          setting.type = HC_LAST_SYNC_TYPE;
          setting.value = timestamp.toString();
          setting.createdAt = Date.now();
          setting.updatedAt = Date.now();
        });
      }
    });
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Full sync from Health Connect to local database
   */
  async syncFromHealthConnect(config: SyncConfig = {}): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.syncInProgress) {
      throw HealthConnectErrorFactory.syncInProgress();
    }

    const {
      lookbackDays = 30,
      batchSize = 100,
      retryAttempts = RETRY_CONFIG.maxAttempts,
      skipValidation = false,
    } = config;

    const startTime = Date.now();
    this.syncInProgress = true;

    const result: SyncResult = {
      status: SyncStatus.SYNCING,
      recordsRead: 0,
      recordsWritten: 0,
      recordsSkipped: 0,
      errors: [],
      startTime,
      endTime: 0,
      duration: 0,
    };

    try {
      // Check if sync is enabled
      const syncEnabled = await this.isSyncEnabled();
      if (!syncEnabled) {
        console.log('Health Connect sync is disabled');
        result.status = SyncStatus.SUCCESS;
        return result;
      }

      // Verify permissions
      const hasPermissions = await healthConnectService.hasAllRequiredPermissions();
      if (!hasPermissions) {
        throw new HealthConnectError(
          HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS,
          'Missing required Health Connect permissions',
          { retryable: false }
        );
      }

      // Calculate time range
      const endTime = Date.now();
      const startTime = endTime - lookbackDays * 24 * 60 * 60 * 1000;

      // Sync each metric type
      const metricTypes: { hcType: string; transformer: (record: any) => any }[] = [
        {
          hcType: 'Height',
          transformer: HealthDataTransformer.transformHeight,
        },
        {
          hcType: 'Weight',
          transformer: HealthDataTransformer.transformWeight,
        },
        {
          hcType: 'BodyFat',
          transformer: HealthDataTransformer.transformBodyFat,
        },
        {
          hcType: 'LeanBodyMass',
          transformer: HealthDataTransformer.transformLeanBodyMass,
        },
        {
          hcType: 'TotalCaloriesBurned',
          transformer: HealthDataTransformer.transformTotalCalories,
        },
        {
          hcType: 'ActiveCaloriesBurned',
          transformer: HealthDataTransformer.transformActiveCalories,
        },
        {
          hcType: 'BasalMetabolicRate',
          transformer: HealthDataTransformer.transformBMR,
        },
      ];

      for (const { hcType, transformer } of metricTypes) {
        try {
          const records = await this.syncMetricTypeWithRetry(
            hcType,
            { startTime, endTime },
            transformer,
            {
              retryAttempts,
              skipValidation,
            }
          );

          result.recordsRead += records.totalRead;
          result.recordsWritten += records.written;
          result.recordsSkipped += records.skipped;
        } catch (error) {
          console.error(`Error syncing ${hcType}:`, error);
          if (error instanceof HealthConnectError) {
            result.errors.push(error);
          } else {
            result.errors.push(HealthConnectErrorFactory.unknownError(error as Error));
          }
        }
      }

      // Update last sync time
      await this.updateLastSyncTime(Date.now());

      result.status = result.errors.length === 0 ? SyncStatus.SUCCESS : SyncStatus.ERROR;
    } catch (error) {
      console.error('Critical error during Health Connect sync:', error);
      result.status = SyncStatus.ERROR;
      if (error instanceof HealthConnectError) {
        result.errors.push(error);
      } else {
        result.errors.push(HealthConnectErrorFactory.unknownError(error as Error));
      }
    } finally {
      this.syncInProgress = false;
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
    }

    return result;
  }

  /**
   * Sync a specific metric type with retry logic
   */
  private async syncMetricTypeWithRetry(
    recordType: string,
    timeRange: { startTime: number; endTime: number },
    transformer: (record: any) => any,
    options: { retryAttempts: number; skipValidation: boolean }
  ): Promise<{ totalRead: number; written: number; skipped: number }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
      try {
        return await this.syncMetricType(
          recordType,
          timeRange,
          transformer,
          options.skipValidation
        );
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Attempt ${attempt}/${options.retryAttempts} failed for ${recordType}:`,
          error
        );

        // Check if error is retryable
        if (error instanceof HealthConnectError && !error.isRetryable()) {
          throw error; // Don't retry non-retryable errors
        }

        // Wait before retry with exponential backoff
        if (attempt < options.retryAttempts) {
          const delay =
            error instanceof HealthConnectError
              ? error.getRetryDelay(attempt)
              : 1000 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    throw lastError || HealthConnectErrorFactory.unknownError();
  }

  /**
   * Sync a specific metric type from Health Connect
   */
  private async syncMetricType(
    recordType: string,
    timeRange: { startTime: number; endTime: number },
    transformer: (record: any) => any,
    skipValidation: boolean
  ): Promise<{ totalRead: number; written: number; skipped: number }> {
    // Read records from Health Connect
    const hcRecords = await healthConnectService.readRecords(recordType, {
      operator: 'between',
      startTime: TimestampConverter.unixToIso(timeRange.startTime),
      endTime: TimestampConverter.unixToIso(timeRange.endTime),
    });

    const totalRead = hcRecords.records?.length || 0;
    let written = 0;
    let skipped = 0;

    if (totalRead === 0) {
      return { totalRead, written, skipped };
    }

    // Transform and validate records
    const transformedRecords: {
      type: MetricType;
      value: number;
      unit: string;
      date: number;
      timezone: string;
    }[] = [];

    for (const hcRecord of hcRecords.records || []) {
      try {
        const transformed = transformer(hcRecord);

        // Validate if not skipping
        if (!skipValidation) {
          DataValidator.validateMetricValue(transformed.type, transformed.value);
          DataValidator.validateTimestamp(transformed.date);
        }

        transformedRecords.push(transformed);
      } catch (error) {
        console.warn(`Skipping invalid record for ${recordType}:`, error);
        skipped++;
      }
    }

    // Deduplicate by timestamp
    const deduplicated = HealthDataTransformer.deduplicateRecords(transformedRecords);
    skipped += transformedRecords.length - deduplicated.length;

    // Check for existing records in database to prevent duplicates
    const existingRecords = await this.getExistingMetrics(
      deduplicated.map((r) => r.type),
      deduplicated.map((r) => r.date)
    );

    const existingTimestamps = new Set(existingRecords.map((r) => r.date));

    // Filter out records that already exist
    const newRecords = deduplicated.filter((r) => !existingTimestamps.has(r.date));
    skipped += deduplicated.length - newRecords.length;

    // Batch write to database
    if (newRecords.length > 0) {
      await database.write(async () => {
        for (const record of newRecords) {
          await database.get<UserMetric>('user_metrics').create((metric) => {
            metric.type = record.type;
            metric.value = record.value;
            metric.unit = record.unit;
            metric.date = record.date;
            metric.timezone = record.timezone;
            metric.createdAt = Date.now();
            metric.updatedAt = Date.now();
          });
          written++;
        }
      });
    }

    return { totalRead, written, skipped };
  }

  /**
   * Get existing metrics from database to check for duplicates
   */
  private async getExistingMetrics(types: MetricType[], dates: number[]): Promise<UserMetric[]> {
    if (types.length === 0 || dates.length === 0) {
      return [];
    }

    const uniqueTypes = Array.from(new Set(types));
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);

    return await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', Q.oneOf(uniqueTypes)),
        Q.where('date', Q.gte(minDate)),
        Q.where('date', Q.lte(maxDate)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
  }

  /**
   * Write local metric to Health Connect
   * (For future implementation - writing app data to Health Connect)
   */
  async syncToHealthConnect(metric: UserMetric): Promise<boolean> {
    // TODO: Implement writing to Health Connect
    // This would convert app format back to Health Connect format and insert
    console.log('Syncing to Health Connect not yet implemented:', metric.type);
    return false;
  }
}

// Export singleton instance
export const healthDataSyncService = new HealthDataSyncService();
