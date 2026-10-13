import { database } from '@/database/database-instance';
import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import type CycleDayLog from '@/database/models/CycleDayLog';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { CycleRepository, readDayLogs } from '@/database/repositories/CycleRepository';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import { isEmptyDayLog } from '@/utils/cycle/dayLog';
import type { CycleDayLogDto } from '@/utils/cycle/types';
import { getCurrentTimezone } from '@/utils/timezone';

export type DayLogInput = Omit<CycleDayLogDto, 'id' | 'timezone'>;

type DayLogPayload = Omit<CycleDayLogDto, 'id'>;

export class CycleDayLogService {
  /**
   * Saves one day. An emptied form deletes the day's record (and `noSymptoms` counts as content),
   * so deselecting everything really clears it. One live record per day is enforced inside the
   * writer; a stray duplicate is retired in the same batch.
   */
  static async save(input: DayLogInput): Promise<void> {
    await primeCycleEncryption();
    const date = localDayStartFromUtcMs(input.date);

    await database.write(async () => {
      const records = await CycleRepository.dayLogs().fetch();
      const dtos = await readDayLogs(records);
      const matching = records.filter((r) =>
        dtos.some((d) => d.id === r.id && localDayStartFromUtcMs(d.date) === date)
      );
      const [keep, ...duplicates] = matching;
      const now = Date.now();
      const operations = duplicates.map((r) => prepareSoftDelete(r, now));

      if (isEmptyDayLog(input)) {
        if (keep) {
          operations.push(prepareSoftDelete(keep, now));
        }
      } else {
        const payload: DayLogPayload = {
          ...input,
          date,
          timezone: getCurrentTimezone(),
          note: input.note.trim(),
        };
        const encrypted = await encryptCyclePayload(payload);
        if (keep) {
          operations.push(
            keep.prepareUpdate((r) => {
              r.payload = encrypted;
              r.updatedAt = now;
            })
          );
        } else {
          operations.push(
            database.get<CycleDayLog>('cycle_day_logs').prepareCreate((r) => {
              r.payload = encrypted;
              r.createdAt = now;
              r.updatedAt = now;
              r.deletedAt = null;
            })
          );
        }
      }

      if (operations.length > 0) {
        await database.batch(...operations);
      }
    });
  }

  static async clear(date: number): Promise<void> {
    await CycleDayLogService.save({
      date,
      bleeding: null,
      symptoms: [],
      noSymptoms: false,
      pain: null,
      energy: null,
      note: '',
    });
  }
}
