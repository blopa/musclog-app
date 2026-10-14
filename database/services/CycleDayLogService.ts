import { type Model, Q } from '@nozbe/watermelondb';

import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import type CycleDayLog from '@/database/models/CycleDayLog';
import UserMetric from '@/database/models/UserMetric';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { CycleRepository, readDayLogs } from '@/database/repositories/CycleRepository';
import { dayKeyRange, localDayStartFromUtcMs, utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { isEmptyDayLog } from '@/utils/cycle/dayLog';
import { observationsSchema } from '@/utils/cycle/preferences';
import type { CycleDayLogDto } from '@/utils/cycle/types';
import { getCurrentTimezone, getTimezoneAt } from '@/utils/timezone';

export type DayLogInput = Omit<CycleDayLogDto, 'id' | 'timezone'>;

type DayLogPayload = Omit<CycleDayLogDto, 'id'>;

export class CycleDayLogService {
  /**
   * Saves one day. An emptied form deletes the day's record (and `noSymptoms` counts as content),
   * so deselecting everything really clears it. One live record per day is enforced inside the
   * writer; a stray duplicate is retired in the same batch.
   */
  static async save(input: DayLogInput, mood?: number | null): Promise<void> {
    if (input.observations) {
      observationsSchema.parse(input.observations);
    }

    if (mood != null && (!Number.isInteger(mood) || mood < 0 || mood > 4)) {
      throw new Error('invalid_mood');
    }

    await primeCycleEncryption();
    const date = localDayStartFromUtcMs(input.date);

    const encryptedMood =
      mood != null ? await encryptUserMetricFields({ value: mood, date }) : null;
    await database.write(() => CycleDayLogService.persist(input, mood, encryptedMood));
  }

  /** Quick actions resolve against the latest committed day inside the writer. */
  static async patch(
    date: number,
    update: (existing: CycleDayLogDto | undefined) => DayLogInput
  ): Promise<DayLogInput> {
    await primeCycleEncryption();
    return database.write(async () => {
      const existing = (await readDayLogs(await CycleRepository.dayLogs().fetch())).find(
        (log) => log.date === localDayStartFromUtcMs(date)
      );
      const input = update(existing);
      await CycleDayLogService.persist(input, undefined, null);
      return input;
    });
  }

  private static async persist(
    input: DayLogInput,
    mood: number | null | undefined,
    encryptedMood: Awaited<ReturnType<typeof encryptUserMetricFields>> | null
  ): Promise<void> {
    const date = localDayStartFromUtcMs(input.date);

    const records = await CycleRepository.dayLogs().fetch();
    const dtos = await readDayLogs(records);
    const matching = records.filter((r) =>
      dtos.some((d) => d.id === r.id && localDayStartFromUtcMs(d.date) === date)
    );
    const [keep, ...duplicates] = matching;
    const payload: DayLogPayload = {
      ...input,
      date,
      timezone: getCurrentTimezone(),
      note: input.note.trim(),
    };
    const encrypted = isEmptyDayLog(input) ? null : await encryptCyclePayload(payload);
    const dayKey = utcDayKeyFromLocalDate(new Date(date));
    const range = dayKeyRange(dayKey, dayKey);
    const moodRecords =
      mood === undefined
        ? []
        : await database
            .get<UserMetric>('user_metrics')
            .query(
              Q.where('type', 'mood'),
              Q.where('deleted_at', Q.eq(null)),
              ...dayRangeClauses(range),
              Q.sortBy('date', Q.desc),
              Q.sortBy('updated_at', Q.desc)
            )
            .fetch();
    const moods = range.filterRecords(moodRecords);
    const now = Date.now();
    const operations: Model[] = duplicates.map((r) => prepareSoftDelete(r, now));

    if (encrypted == null) {
      if (keep) {
        operations.push(prepareSoftDelete(keep, now));
      }
    } else {
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

    // Mood and cycle observations commit together. Undefined leaves the shared metric alone;
    // null clears all mood entries on this day, including duplicates.
    if (mood !== undefined) {
      const [existingMood, ...duplicateMoods] = moods;
      const remove = mood == null ? moods : duplicateMoods;
      operations.push(...remove.map((m) => prepareSoftDelete(m, now)));
      if (encryptedMood) {
        const assign = (m: UserMetric) => {
          m.type = 'mood';
          m.valueRaw = encryptedMood.value;
          m.unitRaw = encryptedMood.unit;
          m.date = date;
          m.timezone = getTimezoneAt(date);
          m.updatedAt = now;
        };

        operations.push(
          existingMood
            ? existingMood.prepareUpdate(assign)
            : database.get<UserMetric>('user_metrics').prepareCreate((m) => {
                assign(m);
                m.createdAt = now;
                m.deletedAt = undefined;
              })
        );
      }
    }

    if (operations.length > 0) {
      await database.batch(...operations);
    }
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
