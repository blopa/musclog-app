import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';

import { HeightConverter } from './healthDataTransform';

export interface HealthBodyMetrics {
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
}

export async function fetchHealthBodyMetrics(): Promise<HealthBodyMetrics> {
  try {
    const now = new Date();
    const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const queryOpts = {
      limit: 1,
      ascending: false,
      filter: { date: { startDate: past, endDate: now } },
    };

    const [weights, heights, bodyFats] = await Promise.allSettled([
      queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        ...queryOpts,
        unit: 'kg',
      }),
      queryQuantitySamples('HKQuantityTypeIdentifierHeight', {
        ...queryOpts,
        unit: 'm',
      }),
      queryQuantitySamples('HKQuantityTypeIdentifierBodyFatPercentage', {
        ...queryOpts,
        unit: '%',
      }),
    ]);

    const lastWeight = weights.status === 'fulfilled' ? weights.value[0] : null;
    const lastHeight = heights.status === 'fulfilled' ? heights.value[0] : null;
    const lastBodyFat = bodyFats.status === 'fulfilled' ? bodyFats.value[0] : null;

    return {
      weightKg: lastWeight?.quantity,
      heightCm: lastHeight ? HeightConverter.metersToCm(lastHeight.quantity) : undefined,
      bodyFatPct: lastBodyFat?.quantity,
    };
  } catch {
    return {};
  }
}
