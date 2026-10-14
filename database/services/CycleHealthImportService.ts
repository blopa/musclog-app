import type { Model } from '@nozbe/watermelondb';

import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import CycleDayLog from '@/database/models/CycleDayLog';
import { CycleRepository, readDayLogs } from '@/database/repositories/CycleRepository';
import { blankDayLog } from '@/utils/cycle/dayLog';
import {
  type DatedHealthObservation,
  groupHealthObservations,
  mergeHealthObservations,
} from '@/utils/cycle/healthObservations';
import { getCurrentTimezone } from '@/utils/timezone';

export class CycleHealthImportService {
  /** One batch; imported observations never replace a self-reported field or create period starts. */
  static async import(input: DatedHealthObservation[]): Promise<number> {
    const grouped = groupHealthObservations(input);
    await primeCycleEncryption();
    return database.write(async () => {
      const rows = await CycleRepository.dayLogs().fetch();
      const logs = await readDayLogs(rows);
      const now = Date.now();
      const timezone = getCurrentTimezone();
      const changes = await Promise.all(
        [...grouped].map(async ([date, observations]) => {
          const existing = logs.find((log) => log.date === date);
          const { id: ignoredId, ...base } = existing ?? { ...blankDayLog(date), id: '', timezone };
          void ignoredId;
          const health = mergeHealthObservations(
            existing?.observations?.health ?? [],
            observations
          );
          return {
            id: existing?.id,
            cipher: await encryptCyclePayload({
              ...base,
              observations: { ...base.observations, health },
            }),
          };
        })
      );
      const operations: Model[] = changes.map(({ id, cipher }) =>
        id
          ? rows
              .find((row) => row.id === id)!
              .prepareUpdate((r) => {
                r.payload = cipher;
                r.updatedAt = now;
              })
          : database.get<CycleDayLog>('cycle_day_logs').prepareCreate((r) => {
              r.payload = cipher;
              r.createdAt = now;
              r.updatedAt = now;
              r.deletedAt = null;
            })
      );
      if (operations.length) {
        await database.batch(...operations);
      }

      return input.length;
    });
  }
}
