/**
 * Fitness metrics sync from Apple Health (HealthKit) — mirrors Android reconciliation logic.
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  queryQuantitySamples,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
import type {
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit/types';
import { Q } from '@nozbe/watermelondb';

import {
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import Setting from '@/database/models/Setting';
import UserMetric, { type UserMetricType } from '@/database/models/UserMetric';
import { captureException } from '@/utils/sentry';

import { RETRY_CONFIG } from './healthConnectErrors';
import {
  DataValidator,
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

async function canReadQuantity(id: QuantityTypeIdentifier): Promise<boolean> {
  return (
    authorizationStatusFor(id as ObjectTypeIdentifier) === AuthorizationStatus.sharingAuthorized
  );
}

async function canWriteQuantity(id: QuantityTypeIdentifier): Promise<boolean> {
  return (
    authorizationStatusFor(id as ObjectTypeIdentifier) === AuthorizationStatus.sharingAuthorized
  );
}

const HK_METRICS: {
  metricType: MetricType;
  hkId: QuantityTypeIdentifier;
  queryUnit: string;
  toApp: (quantity: number) => { value: number; unit: string };
}[] = [
  {
    metricType: MetricType.HEIGHT,
    hkId: 'HKQuantityTypeIdentifierHeight',
    queryUnit: 'm',
    toApp: (q) => ({ value: HeightConverter.metersToCm(q), unit: 'cm' }),
  },
  {
    metricType: MetricType.WEIGHT,
    hkId: 'HKQuantityTypeIdentifierBodyMass',
    queryUnit: 'kg',
    toApp: (q) => ({ value: q, unit: 'kg' }),
  },
  {
    metricType: MetricType.BODY_FAT,
    hkId: 'HKQuantityTypeIdentifierBodyFatPercentage',
    queryUnit: '%',
    toApp: (q) => ({ value: q, unit: '%' }),
  },
  {
    metricType: MetricType.LEAN_BODY_MASS,
    hkId: 'HKQuantityTypeIdentifierLeanBodyMass',
    queryUnit: 'kg',
    toApp: (q) => ({ value: q, unit: 'kg' }),
  },
  {
    metricType: MetricType.ACTIVE_CALORIES,
    hkId: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    queryUnit: 'kcal',
    toApp: (q) => ({ value: q, unit: 'kcal' }),
  },
  {
    metricType: MetricType.BMR,
    hkId: 'HKQuantityTypeIdentifierBasalEnergyBurned',
    queryUnit: 'kcal',
    toApp: (q) => ({ value: q, unit: 'kcal/day' }),
  },
];

export interface UserMetricWriteParams {
  metricId: string;
  type: string;
  value: number;
  date: number;
  timezone: string;
}

export async function writeUserMetricToHealthConnect(
  params: UserMetricWriteParams
): Promise<string | undefined> {
  if (!(await isWriteSyncEnabled())) {
    return undefined;
  }

  const start = new Date(params.date);
  const end = new Date(params.date);

  try {
    if (params.type === 'weight') {
      if (!(await canWriteQuantity('HKQuantityTypeIdentifierBodyMass'))) {
        return undefined;
      }
      const s = await saveQuantitySample(
        'HKQuantityTypeIdentifierBodyMass',
        'kg',
        params.value,
        start,
        end,
        { HKExternalUUID: params.metricId } as any
      );
      return s?.uuid;
    }
    if (params.type === 'height') {
      if (!(await canWriteQuantity('HKQuantityTypeIdentifierHeight'))) {
        return undefined;
      }
      const s = await saveQuantitySample(
        'HKQuantityTypeIdentifierHeight',
        'm',
        HeightConverter.cmToMeters(params.value),
        start,
        end,
        { HKExternalUUID: params.metricId } as any
      );
      return s?.uuid;
    }
    if (params.type === 'body_fat') {
      if (!(await canWriteQuantity('HKQuantityTypeIdentifierBodyFatPercentage'))) {
        return undefined;
      }
      const s = await saveQuantitySample(
        'HKQuantityTypeIdentifierBodyFatPercentage',
        '%',
        params.value,
        start,
        end,
        { HKExternalUUID: params.metricId } as any
      );
      return s?.uuid;
    }
    if (params.type === 'lean_body_mass') {
      if (!(await canWriteQuantity('HKQuantityTypeIdentifierLeanBodyMass'))) {
        return undefined;
      }
      const s = await saveQuantitySample(
        'HKQuantityTypeIdentifierLeanBodyMass',
        'kg',
        params.value,
        start,
        end,
        { HKExternalUUID: params.metricId } as any
      );
      return s?.uuid;
    }
  } catch (e) {
    captureException(e, {
      data: { context: 'healthConnectFitness.ios.writeUserMetricToHealthConnect' },
    });
    console.warn('[healthConnectFitness.iOS] writeUserMetricToHealthConnect failed:', e);
  }
  return undefined;
}

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

  for (const def of HK_METRICS) {
    try {
      if (!(await canReadQuantity(def.hkId))) {
        totals.skipped += 1;
        continue;
      }

      const counts = await syncMetricTypeWithRetry(def, timeRange, {
        retryAttempts,
        skipValidation,
      });

      totals.totalRead += counts.totalRead;
      totals.written += counts.written;
      totals.updated += counts.updated;
      totals.deleted += counts.deleted;
      totals.skipped += counts.skipped;
    } catch (err) {
      captureException(err, { data: { context: 'healthConnectFitness.ios.syncLoop' } });
      console.warn(`[healthConnectFitness.iOS] Failed to sync ${def.hkId}:`, err);
    }
  }

  return totals;
}

async function syncMetricTypeWithRetry(
  def: (typeof HK_METRICS)[number],
  timeRange: { startTime: number; endTime: number },
  options: { retryAttempts: number; skipValidation: boolean }
): Promise<FitnessSyncCounts> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
    try {
      return await syncOneMetricType(def, timeRange, options.skipValidation);
    } catch (err) {
      lastError = err;
      if (attempt < options.retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

async function syncOneMetricType(
  def: (typeof HK_METRICS)[number],
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

  const samples = await queryQuantitySamples(def.hkId, {
    limit: 0,
    unit: def.queryUnit,
    ascending: false,
    filter: {
      date: {
        startDate: new Date(timeRange.startTime),
        endDate: new Date(timeRange.endTime),
      },
    },
  });

  counts.totalRead = samples.length;

  const hkMap = new Map<string, TransformedMetric>();
  for (const sample of samples) {
    try {
      const { value, unit } = def.toApp(sample.quantity);
      const transformed = {
        type: def.metricType,
        value,
        unit,
        date: sample.startDate.getTime(),
        timezone: TimestampConverter.getTimezone(),
      };
      if (!skipValidation) {
        DataValidator.validateMetricValue(transformed.type, transformed.value);
        DataValidator.validateTimestamp(transformed.date);
      }
      const externalId = sample.uuid;
      hkMap.set(externalId, { ...transformed, externalId });
    } catch {
      counts.skipped++;
    }
  }

  const localMetrics = await database
    .get<UserMetric>('user_metrics')
    .query(
      Q.where('type', def.metricType as UserMetricType),
      Q.where('deleted_at', Q.eq(null)),
      Q.where('date', Q.gte(timeRange.startTime)),
      Q.where('date', Q.lte(timeRange.endTime))
    )
    .fetch();

  const localByExternalId = new Map<string, UserMetric>();
  for (const m of localMetrics) {
    if (m.externalId) {
      localByExternalId.set(m.externalId, m);
    }
  }

  await database.write(async () => {
    const now = Date.now();

    for (const [externalId, record] of hkMap.entries()) {
      const existing = localByExternalId.get(externalId);

      if (!existing) {
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

    for (const [localExternalId, localMetric] of localByExternalId.entries()) {
      if (!hkMap.has(localExternalId)) {
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
