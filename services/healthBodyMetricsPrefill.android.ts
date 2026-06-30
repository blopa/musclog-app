import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { healthConnectService } from './healthConnect';
import { HealthDataTransformer, TimestampConverter } from './healthDataTransform';

export interface HealthBodyMetrics {
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
}

export async function fetchHealthBodyMetrics(): Promise<HealthBodyMetrics> {
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 90 * MS_PER_SOLAR_DAY);
    const timeRange = {
      operator: 'between' as const,
      startTime: TimestampConverter.unixToIso(past.getTime()),
      endTime: TimestampConverter.unixToIso(now.getTime()),
    };

    const [weightRes, heightRes, bodyFatRes] = await Promise.allSettled([
      healthConnectService.readRecords('Weight', timeRange),
      healthConnectService.readRecords('Height', timeRange),
      healthConnectService.readRecords('BodyFat', timeRange),
    ]);

    const weightRecords = weightRes.status === 'fulfilled' ? weightRes.value.records : [];
    const heightRecords = heightRes.status === 'fulfilled' ? heightRes.value.records : [];
    const bodyFatRecords = bodyFatRes.status === 'fulfilled' ? bodyFatRes.value.records : [];

    const lastWeight = weightRecords.at(-1);
    const lastHeight = heightRecords.at(-1);
    const lastBodyFat = bodyFatRecords.at(-1);

    return {
      weightKg: lastWeight ? HealthDataTransformer.transformWeight(lastWeight).value : undefined,
      heightCm: lastHeight ? HealthDataTransformer.transformHeight(lastHeight).value : undefined,
      bodyFatPct: lastBodyFat
        ? HealthDataTransformer.transformBodyFat(lastBodyFat).value
        : undefined,
    };
  } catch {
    return {};
  }
}
