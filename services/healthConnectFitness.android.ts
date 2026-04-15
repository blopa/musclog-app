/**
 * Reads fitness metrics (Height, Weight, BodyFat, etc.) from Health Connect
 * and reconciles them with the local user_metrics table using external_id.
 *
 * Sync behaviour per record type:
 *  - New HC record (externalId not in local DB) → create UserMetric with externalId
 *  - Existing HC record (externalId found locally) → update if value changed
 *  - Local HC-sourced record whose externalId is gone from HC window → soft-delete
 *  - Local user-entered records (external_id IS NULL) → never touched
 */

import { Q } from '@nozbe/watermelondb';
import type { RecordType } from 'react-native-health-connect';
import { RecordingMethod } from 'react-native-health-connect';

import {
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import Setting from '@/database/models/Setting';
import UserMetric, { type UserMetricType } from '@/database/models/UserMetric';
import { handleError } from '@/utils/handleError';

import { healthConnectService } from './healthConnect';
import { RETRY_CONFIG } from './healthConnectErrors';
import {
  DataValidator,
  HealthDataTransformer,
  HeightConverter,
  MetricType,
  TimestampConverter,
} from './healthDataTransform';

export interface FitnessSyncCounts {
  totalRead: number;
  written: number;
  updated: number;
  deleted: number;
  skipped: number;
}

type TransformedMetric = {
  type: MetricType;
  value: number;
  unit: string;
  date: number;
  timezone: string;
  externalId: string | undefined;
};

async function isSettingEnabled(type: string): Promise<boolean> {
  const settings = await database
    .get<Setting>('settings')
    .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return settings.length > 0 && settings[0].value === 'true';
}

async function isReadSyncEnabled(): Promise<boolean> {
  try {
    return (
      (await isSettingEnabled(CONNECT_HEALTH_DATA_SETTING_TYPE)) &&
      (await isSettingEnabled(READ_HEALTH_DATA_SETTING_TYPE))
    );
  } catch {
    return false;
  }
}

async function isWriteSyncEnabled(): Promise<boolean> {
  try {
    return (
      (await isSettingEnabled(CONNECT_HEALTH_DATA_SETTING_TYPE)) &&
      (await isSettingEnabled(WRITE_HEALTH_DATA_SETTING_TYPE))
    );
  } catch {
    return false;
  }
}

/** Maps UserMetricType to its Health Connect RecordType for writing. */
const METRIC_TYPE_TO_HC: Partial<Record<string, RecordType>> = {
  weight: 'Weight',
  height: 'Height',
  body_fat: 'BodyFat',
  lean_body_mass: 'LeanBodyMass',
};

export interface UserMetricWriteParams {
  metricId: string; // WatermelonDB record ID – used as clientRecordId for deduplication
  type: string; // UserMetricType
  value: number; // in app-native units (kg, cm, %, etc.)
  date: number; // unix ms
  timezone: string;
}

/**
 * Write a single user metric to Health Connect.
 * Returns the HC-assigned record ID (to store as externalId), or undefined on failure.
 * Never throws – all errors are caught and logged.
 */
export async function writeUserMetricToHealthConnect(
  params: UserMetricWriteParams
): Promise<string | undefined> {
  const hcType = METRIC_TYPE_TO_HC[params.type];
  if (!hcType) {
    return undefined; // unsupported metric type — no HC mapping
  }

  if (!(await isWriteSyncEnabled())) {
    return undefined;
  }

  const isAvailable = await healthConnectService.checkAvailability();
  if (!isAvailable) {
    return undefined;
  }

  const hasPermission = await healthConnectService.hasPermissionForRecordType(hcType, 'write');
  if (!hasPermission) {
    return undefined;
  }

  try {
    const time = TimestampConverter.unixToIso(params.date);
    const metadata = {
      clientRecordId: params.metricId,
      dataOrigin: 'Musclog',
      recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
    };

    let record: any;

    switch (hcType) {
      case 'Weight':
        record = {
          recordType: 'Weight' as const,
          weight: { value: params.value, unit: 'kilograms' as const },
          time,
          zoneOffset: params.timezone,
          metadata,
        };
        break;
      case 'Height':
        record = {
          recordType: 'Height' as const,
          height: { value: HeightConverter.cmToMeters(params.value), unit: 'meters' as const },
          time,
          zoneOffset: params.timezone,
          metadata,
        };
        break;
      case 'BodyFat':
        record = {
          recordType: 'BodyFat' as const,
          percentage: params.value,
          time,
          zoneOffset: params.timezone,
          metadata,
        };
        break;
      case 'LeanBodyMass':
        record = {
          recordType: 'LeanBodyMass' as const,
          mass: { value: params.value, unit: 'kilograms' as const },
          time,
          zoneOffset: params.timezone,
          metadata,
        };
        break;
      default:
        return undefined;
    }

    const ids = await healthConnectService.insertRecords([record]);
    return ids[0];
  } catch (err) {
    handleError(err, 'healthConnectFitness.android.writeUserMetricToHealthConnect');
    console.warn('[healthConnectFitness] writeUserMetricToHealthConnect failed:', err);
    return undefined;
  }
}

const FITNESS_METRIC_TYPES: {
  hcType: RecordType;
  transformer: (record: any) => Omit<TransformedMetric, 'externalId'>;
}[] = [
  { hcType: 'Height', transformer: HealthDataTransformer.transformHeight },
  { hcType: 'Weight', transformer: HealthDataTransformer.transformWeight },
  { hcType: 'BodyFat', transformer: HealthDataTransformer.transformBodyFat },
  { hcType: 'LeanBodyMass', transformer: HealthDataTransformer.transformLeanBodyMass },
  { hcType: 'TotalCaloriesBurned', transformer: HealthDataTransformer.transformTotalCalories },
  { hcType: 'ActiveCaloriesBurned', transformer: HealthDataTransformer.transformActiveCalories },
  { hcType: 'BasalMetabolicRate', transformer: HealthDataTransformer.transformBMR },
];

/**
 * Sync all supported fitness metric types from Health Connect for the given time window.
 */
export async function syncFitnessMetrics(
  timeRange: { startTime: number; endTime: number },
  options: { retryAttempts?: number; skipValidation?: boolean } = {}
): Promise<FitnessSyncCounts> {
  const { retryAttempts = RETRY_CONFIG.maxAttempts, skipValidation = false } = options;

  if (!(await isReadSyncEnabled())) {
    return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
  }

  const totals: FitnessSyncCounts = {
    totalRead: 0,
    written: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  };

  for (const { hcType, transformer } of FITNESS_METRIC_TYPES) {
    try {
      const hasPermission = await healthConnectService.hasPermissionForRecordType(hcType, 'read');
      if (!hasPermission) {
        totals.skipped += 1;
        continue;
      }

      const counts = await syncMetricTypeWithRetry(hcType, transformer, timeRange, {
        retryAttempts,
        skipValidation,
      });

      totals.totalRead += counts.totalRead;
      totals.written += counts.written;
      totals.updated += counts.updated;
      totals.deleted += counts.deleted;
      totals.skipped += counts.skipped;
    } catch (err) {
      handleError(err, 'healthConnectFitness.android.syncLoop');
      console.warn(`[healthConnectFitness] Failed to sync ${hcType}:`, err);
    }
  }

  return totals;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function syncMetricTypeWithRetry(
  hcType: RecordType,
  transformer: (record: any) => Omit<TransformedMetric, 'externalId'>,
  timeRange: { startTime: number; endTime: number },
  options: { retryAttempts: number; skipValidation: boolean }
): Promise<FitnessSyncCounts> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
    try {
      return await syncOneMetricType(hcType, transformer, timeRange, options.skipValidation);
    } catch (err) {
      lastError = err;
      console.warn(
        `[healthConnectFitness] Attempt ${attempt}/${options.retryAttempts} failed for ${hcType}:`,
        err
      );
      if (attempt < options.retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

async function syncOneMetricType(
  hcType: RecordType,
  transformer: (record: any) => Omit<TransformedMetric, 'externalId'>,
  timeRange: { startTime: number; endTime: number },
  skipValidation: boolean
): Promise<FitnessSyncCounts> {
  const counts: FitnessSyncCounts = {
    totalRead: 0,
    written: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  };

  // 1. Read from Health Connect
  const hcResult = await healthConnectService.readRecords(hcType, {
    operator: 'between',
    startTime: TimestampConverter.unixToIso(timeRange.startTime),
    endTime: TimestampConverter.unixToIso(timeRange.endTime),
  });

  const hcRecords = hcResult.records ?? [];
  counts.totalRead = hcRecords.length;

  // 2. Transform + validate → Map<externalId, TransformedMetric>
  const hcMap = new Map<string, TransformedMetric>();
  for (const hcRecord of hcRecords) {
    try {
      const transformed = transformer(hcRecord);
      if (!skipValidation) {
        DataValidator.validateMetricValue(transformed.type, transformed.value);
        DataValidator.validateTimestamp(transformed.date);
      }
      const externalId: string | undefined = hcRecord.metadata?.id;
      if (!externalId) {
        counts.skipped++;
        continue;
      }
      hcMap.set(externalId, { ...transformed, externalId });
    } catch {
      counts.skipped++;
    }
  }

  if (hcMap.size === 0 && hcRecords.length === 0) {
    // Nothing from HC in this window – still need to delete orphans below
  }

  // 3. Load local HC-sourced metrics for this type in the window
  const localMetrics = await database
    .get<UserMetric>('user_metrics')
    .query(
      Q.where('type', Q.oneOf(Array.from(new Set([...hcMap.values()].map((r) => r.type))))),
      Q.where('deleted_at', Q.eq(null)),
      Q.where('date', Q.gte(timeRange.startTime)),
      Q.where('date', Q.lte(timeRange.endTime))
    )
    .fetch();

  // Separate HC-sourced (have externalId) from user-entered (no externalId)
  const localByExternalId = new Map<string, UserMetric>();
  for (const m of localMetrics) {
    if (m.externalId) {
      localByExternalId.set(m.externalId, m);
    }
  }

  // 4. Reconcile in a single write transaction
  await database.write(async () => {
    const now = Date.now();

    for (const [externalId, record] of hcMap.entries()) {
      const existing = localByExternalId.get(externalId);

      if (!existing) {
        // CREATE
        const encrypted = await encryptUserMetricFields({
          value: record.value,
          unit: record.unit,
          date: record.date,
        });
        await database.get<UserMetric>('user_metrics').create((metric) => {
          metric.type = record.type as UserMetricType;
          metric.externalId = externalId;
          metric.valueRaw = encrypted.value;
          metric.unitRaw = encrypted.unit;
          metric.date = record.date;
          metric.timezone = record.timezone;
          metric.createdAt = now;
          metric.updatedAt = now;
        });
        counts.written++;
      } else {
        // UPDATE if value changed
        const decrypted = await existing.getDecrypted();
        if (Math.abs(decrypted.value - record.value) > 0.0001) {
          const encrypted = await encryptUserMetricFields({
            value: record.value,
            unit: record.unit,
            date: record.date,
          });
          await existing.update((m) => {
            m.valueRaw = encrypted.value;
            m.unitRaw = encrypted.unit;
            m.date = record.date;
            m.timezone = record.timezone;
            m.updatedAt = now;
          });
          counts.updated++;
        }
      }
    }

    // DELETE local HC-sourced records not present in HC response
    for (const [localExternalId, localMetric] of localByExternalId.entries()) {
      if (!hcMap.has(localExternalId)) {
        await localMetric.update((m) => {
          m.deletedAt = now;
          m.updatedAt = now;
        });
        counts.deleted++;
      }
    }
  });

  return counts;
}
