import {
  deleteObjects,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryQuantitySamples,
  requestAuthorization,
  saveCategorySample,
  saveQuantitySample,
} from '@kingstinct/react-native-healthkit';
import {
  CategoryValueMenstrualFlow,
  CategoryValueNotApplicable,
  type MetadataForCategoryIdentifier,
} from '@kingstinct/react-native-healthkit/types';

import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import type { DatedHealthObservation } from '@/utils/cycle/healthObservations';
import type { CycleDayLogDto } from '@/utils/cycle/types';

export const cycleHealthSupported = true;
const FLOW = 'HKCategoryTypeIdentifierMenstrualFlow';
const SPOTTING = 'HKCategoryTypeIdentifierIntermenstrualBleeding';
const TEMP = 'HKQuantityTypeIdentifierBasalBodyTemperature';
async function authorize(write: boolean) {
  if (!(await isHealthDataAvailableAsync())) {
    throw new Error('health_unavailable');
  }

  await requestAuthorization(
    write ? { toShare: [FLOW, TEMP, SPOTTING] } : { toRead: [FLOW, TEMP, SPOTTING] }
  );
}

export async function readCycleHealth(from: number, to: number): Promise<DatedHealthObservation[]> {
  await authorize(false);
  const options = {
    limit: 30001,
    ascending: true,
    filter: { date: { startDate: new Date(from), endDate: new Date(to), strictStartDate: true } },
  };
  const [flow, temperature, spotting] = await Promise.all([
    queryCategorySamples(FLOW, options),
    queryQuantitySamples(TEMP, { ...options, unit: 'degC' }),
    queryCategorySamples(SPOTTING, options),
  ]);
  if (flow.length + temperature.length + spotting.length > 30000) {
    throw new Error('health_import_too_large');
  }

  return [
    ...flow
      .filter(
        (sample) => !String(sample.metadata.HKSyncIdentifier ?? '').startsWith('musclog-cycle-')
      )
      .flatMap((sample) => {
        const value = (
          {
            [CategoryValueMenstrualFlow.light]: 'light',
            [CategoryValueMenstrualFlow.medium]: 'medium',
            [CategoryValueMenstrualFlow.heavy]: 'heavy',
            [CategoryValueMenstrualFlow.none]: 'none',
          } as Record<number, string>
        )[sample.value];
        return value
          ? [
              {
                id: sample.uuid,
                source: 'healthkit' as const,
                kind: 'bleeding' as const,
                value,
                date: localDayStartFromUtcMs(sample.startDate.getTime()),
              },
            ]
          : [];
      }),
    ...temperature
      .filter(
        (sample) => !String(sample.metadata.HKSyncIdentifier ?? '').startsWith('musclog-cycle-')
      )
      .map((sample) => ({
        id: sample.uuid,
        source: 'healthkit' as const,
        kind: 'temperatureC' as const,
        value: sample.quantity,
        date: localDayStartFromUtcMs(sample.startDate.getTime()),
      })),
    ...spotting
      .filter(
        (sample) => !String(sample.metadata.HKSyncIdentifier ?? '').startsWith('musclog-cycle-')
      )
      .map((sample) => ({
        id: sample.uuid,
        source: 'healthkit' as const,
        kind: 'bleeding' as const,
        value: 'spotting',
        date: localDayStartFromUtcMs(sample.startDate.getTime()),
      })),
  ];
}

export async function writeCycleHealth(logs: CycleDayLogDto[]): Promise<number> {
  await authorize(true);
  let written = 0;
  for (const log of logs) {
    // Remove only this app's previous samples when a manual entry changes type or is cleared.
    for (const [type, kind] of [
      [FLOW, 'flow'],
      [SPOTTING, 'spotting'],
      [TEMP, 'temperature'],
    ] as const) {
      await deleteObjects(type, {
        metadata: { withMetadataKey: 'HKSyncIdentifier', value: `musclog-cycle-${log.id}-${kind}` },
      });
    }

    const start = new Date(log.date);
    const end = new Date(start.getTime() + 1000);
    const metadata = (kind: string) => ({
      HKSyncIdentifier: `musclog-cycle-${log.id}-${kind}`,
      HKSyncVersion: Date.now(),
      HKWasUserEntered: true,
    });
    const value = log.bleeding
      ? (
          {
            none: CategoryValueMenstrualFlow.none,
            light: CategoryValueMenstrualFlow.light,
            medium: CategoryValueMenstrualFlow.medium,
            heavy: CategoryValueMenstrualFlow.heavy,
            very_heavy: CategoryValueMenstrualFlow.heavy,
          } as Partial<Record<string, CategoryValueMenstrualFlow>>
        )[log.bleeding]
      : undefined;
    // The library's generated spotting metadata is Record<string, never>; HealthKit accepts standard sync metadata.
    if (log.bleeding === 'spotting') {
      if (
        !(await saveCategorySample(
          SPOTTING,
          CategoryValueNotApplicable.notApplicable,
          start,
          end,
          metadata('spotting') as unknown as MetadataForCategoryIdentifier<typeof SPOTTING>
        ))
      ) {
        throw new Error('health_write_failed');
      }

      written++;
    } else if (value != null) {
      if (!(await saveCategorySample(FLOW, value, start, end, metadata('flow')))) {
        throw new Error('health_write_failed');
      }

      written++;
    }

    if (log.observations?.temperatureC != null) {
      if (
        !(await saveQuantitySample(
          TEMP,
          'degC',
          log.observations.temperatureC,
          start,
          end,
          metadata('temperature')
        ))
      ) {
        throw new Error('health_write_failed');
      }

      written++;
    }
  }

  return written;
}
