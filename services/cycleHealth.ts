import { Platform } from 'react-native';
import {
  deleteRecordsByUuids,
  type HealthConnectRecord,
  initialize,
  insertRecords,
  readRecords,
  type RecordResult,
  type RecordType,
  requestPermission,
} from 'react-native-health-connect';

import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import type { DatedHealthObservation } from '@/utils/cycle/healthObservations';
import type { CycleDayLogDto } from '@/utils/cycle/types';

export const cycleHealthSupported = Platform.OS === 'android';
const TYPES = ['MenstruationFlow', 'BasalBodyTemperature', 'IntermenstrualBleeding'] as const;
async function authorize(accessType: 'read' | 'write') {
  if (!cycleHealthSupported || !(await initialize())) {
    throw new Error('health_unavailable');
  }

  const permissions = await requestPermission(
    TYPES.map((recordType) => ({ recordType, accessType }))
  );
  if (
    !TYPES.every((type) =>
      permissions.some((p) => p.recordType === type && p.accessType === accessType)
    )
  ) {
    throw new Error('health_permission_denied');
  }
}

export async function readCycleHealth(from: number, to: number): Promise<DatedHealthObservation[]> {
  await authorize('read');
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(from).toISOString(),
    endTime: new Date(to).toISOString(),
  };
  const readAll = async <T extends RecordType>(type: T): Promise<RecordResult<T>[]> => {
    const records: RecordResult<T>[] = [];
    let pageToken: string | undefined;
    do {
      const page = await readRecords(type, { timeRangeFilter, pageSize: 1000, pageToken });
      records.push(...page.records);
      pageToken = page.pageToken;
      if (records.length > 30000) {
        throw new Error('health_import_too_large');
      }
    } while (pageToken);

    return records;
  };

  const [flow, temperature, spotting] = await Promise.all([
    readAll('MenstruationFlow'),
    readAll('BasalBodyTemperature'),
    readAll('IntermenstrualBleeding'),
  ]);
  const external = <T extends { metadata?: { id?: string; clientRecordId?: string } }>(
    records: T[]
  ) =>
    records.filter(
      (r) => r.metadata?.id && !r.metadata.clientRecordId?.startsWith('musclog-cycle-')
    );
  return [
    ...external(flow).flatMap((record) => {
      const value = ({ 1: 'light', 2: 'medium', 3: 'heavy' } as Record<number, string>)[
        record.flow ?? 0
      ];
      return value
        ? [
            {
              id: record.metadata!.id!,
              source: 'health_connect' as const,
              kind: 'bleeding' as const,
              value,
              date: localDayStartFromUtcMs(Date.parse(record.time)),
            },
          ]
        : [];
    }),
    ...external(temperature).map((record) => ({
      id: record.metadata!.id!,
      source: 'health_connect' as const,
      kind: 'temperatureC' as const,
      value: record.temperature.inCelsius,
      date: localDayStartFromUtcMs(Date.parse(record.time)),
    })),
    ...external(spotting).map((record) => ({
      id: record.metadata!.id!,
      source: 'health_connect' as const,
      kind: 'bleeding' as const,
      value: 'spotting',
      date: localDayStartFromUtcMs(Date.parse(record.time)),
    })),
  ];
}

export async function writeCycleHealth(logs: CycleDayLogDto[]): Promise<number> {
  await authorize('write');
  const records: HealthConnectRecord[] = [];
  for (const log of logs) {
    const time = new Date(log.date).toISOString();
    const metadata = (kind: string) => ({
      clientRecordId: `musclog-cycle-${log.id}-${kind}`,
      clientRecordVersion: Date.now(),
      recordingMethod: 3,
    });
    if (log.bleeding === 'spotting') {
      records.push({ recordType: 'IntermenstrualBleeding', time, metadata: metadata('spotting') });
    }

    const flow = log.bleeding
      ? ({ light: 1, medium: 2, heavy: 3, very_heavy: 3 } as Record<string, number>)[log.bleeding]
      : undefined;
    if (flow) {
      records.push({ recordType: 'MenstruationFlow', time, flow, metadata: metadata('flow') });
    }

    if (log.observations?.temperatureC != null) {
      records.push({
        recordType: 'BasalBodyTemperature',
        time,
        temperature: { value: log.observations.temperatureC, unit: 'celsius' },
        metadata: metadata('temperature'),
      });
    }
  }

  // Reconcile only this app's identifiers for the selected live logs; never delete by time range.
  for (const log of logs) {
    await deleteRecordsByUuids('MenstruationFlow', [], [`musclog-cycle-${log.id}-flow`]);
    await deleteRecordsByUuids('IntermenstrualBleeding', [], [`musclog-cycle-${log.id}-spotting`]);
    await deleteRecordsByUuids('BasalBodyTemperature', [], [`musclog-cycle-${log.id}-temperature`]);
  }

  for (let start = 0; start < records.length; start += 500) {
    await insertRecords(records.slice(start, start + 500));
  }

  return records.length;
}
