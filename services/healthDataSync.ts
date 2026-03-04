import { Q } from '@nozbe/watermelondb';

import {
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
} from '../constants/settings';
import { database } from '../database';
import Setting from '../database/models/Setting';
import i18n from '../lang/lang';
import { healthConnectService } from './healthConnect';
import {
  HealthConnectError,
  HealthConnectErrorCode,
  HealthConnectErrorFactory,
  RETRY_CONFIG,
} from './healthConnectErrors';
import { syncFitnessMetrics } from './healthConnectFitness';
import { syncNutritionFromHealthConnect } from './healthConnectNutrition';

/**
 * Setting types for Health Connect sync tracking
 */
export const HC_LAST_SYNC_TYPE = 'health_connect_last_sync';

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
  retryAttempts?: number; // Max retry attempts (default: 3)
  skipValidation?: boolean; // Skip validation (default: false)
}

/** Upsert a boolean setting (stored as 'true'/'false') by type key. */
async function upsertBooleanSetting(type: string, value: boolean): Promise<void> {
  const now = Date.now();
  const existing = await database
    .get<Setting>('settings')
    .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
    .fetch();

  await database.write(async () => {
    if (existing.length > 0) {
      await existing[0].update((s) => {
        s.value = value ? 'true' : 'false';
        s.updatedAt = now;
      });
    } else {
      await database.get<Setting>('settings').create((s) => {
        s.type = type as any;
        s.value = value ? 'true' : 'false';
        s.createdAt = now;
        s.updatedAt = now;
      });
    }
  });
}

/**
 * Health Data Sync Service
 */
class HealthDataSyncService {
  private syncInProgress = false;
  private lastSyncTime: number = 0;

  /**
   * Check if Health Connect sync is enabled (master toggle = connect_health_data).
   */
  async isSyncEnabled(): Promise<boolean> {
    try {
      const settings = await database
        .get<Setting>('settings')
        .query(Q.where('type', CONNECT_HEALTH_DATA_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      return settings.length > 0 && settings[0].value === 'true';
    } catch (error) {
      console.error('Error checking sync enabled status:', error);
      return false;
    }
  }

  /**
   * Enable Health Connect sync (sets connect_health_data + read_health_data).
   * Called from the onboarding flow after the user grants permissions.
   */
  async enableSync(): Promise<void> {
    await upsertBooleanSetting(CONNECT_HEALTH_DATA_SETTING_TYPE, true);
    await upsertBooleanSetting(READ_HEALTH_DATA_SETTING_TYPE, true);
  }

  /**
   * Disable Health Connect sync (sets connect_health_data = false).
   */
  async disableSync(): Promise<void> {
    await upsertBooleanSetting(CONNECT_HEALTH_DATA_SETTING_TYPE, false);
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

      // Check if at least one permission is granted (no longer requiring all)
      const hasAnyPermission = await healthConnectService.hasAnyPermission();
      if (!hasAnyPermission) {
        throw new HealthConnectError(
          HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS,
          i18n.t('snackbar.healthConnect.noPermissionsGranted'),
          { retryable: false }
        );
      }

      // Calculate time range
      const endTime = Date.now();
      const startTimeMs = endTime - lookbackDays * 24 * 60 * 60 * 1000;
      const timeRange = { startTime: startTimeMs, endTime };

      // Sync fitness metrics (Height, Weight, BodyFat, etc.)
      try {
        const fitnessResult = await syncFitnessMetrics(timeRange, {
          retryAttempts,
          skipValidation,
        });
        result.recordsRead += fitnessResult.totalRead;
        result.recordsWritten += fitnessResult.written + fitnessResult.updated;
        result.recordsSkipped += fitnessResult.skipped + fitnessResult.deleted;
      } catch (error) {
        console.error('Error syncing fitness metrics:', error);
        if (error instanceof HealthConnectError) {
          result.errors.push(error);
        } else {
          result.errors.push(HealthConnectErrorFactory.unknownError(error as Error));
        }
      }

      // Sync nutrition logs (Nutrition records from Health Connect)
      try {
        const nutritionResult = await syncNutritionFromHealthConnect(timeRange, {
          retryAttempts,
        });
        result.recordsRead += nutritionResult.totalRead;
        result.recordsWritten += nutritionResult.written + nutritionResult.updated;
        result.recordsSkipped += nutritionResult.skipped + nutritionResult.deleted;
      } catch (error) {
        console.error('Error syncing nutrition:', error);
        if (error instanceof HealthConnectError) {
          result.errors.push(error);
        } else {
          result.errors.push(HealthConnectErrorFactory.unknownError(error as Error));
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
}

// Export singleton instance
export const healthDataSyncService = new HealthDataSyncService();
