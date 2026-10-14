import { type Model, Q } from '@nozbe/watermelondb';

import { encryptCyclePayload, primeCycleEncryption } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import { encryptUserMetricFields } from '@/database/encryptionHelpers';
import type CycleContext from '@/database/models/CycleContext';
import type CycleDayLog from '@/database/models/CycleDayLog';
import type CyclePeriod from '@/database/models/CyclePeriod';
import type MenstrualCycle from '@/database/models/MenstrualCycle';
import UserMetric from '@/database/models/UserMetric';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readDayLogs,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { calendarDateFromRecordDay } from '@/utils/calendarDate';
import { planCycleMerge } from '@/utils/cycle/cycleMerge';
import { type ConflictChoice, parseCycleTransfer } from '@/utils/cycle/cycleTransfer';
import { isEmptyDayLog } from '@/utils/cycle/dayLog';
import { cycleConfigSchema } from '@/utils/cycle/preferences';
import { getCurrentTimezone, getTimezoneAt } from '@/utils/timezone';

async function existingData(cycle: MenstrualCycle) {
  const [periodRows, dayRows, contextRows, moodRows, config] = await Promise.all([
    CycleRepository.periods(cycle.id).fetch(),
    CycleRepository.dayLogs().fetch(),
    CycleRepository.contexts(cycle.id).fetch(),
    database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'mood'),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc)
      )
      .fetch(),
    readCycleConfig(cycle),
  ]);
  const points = await Promise.all(
    moodRows.map(async (m) => ({
      id: m.id,
      date: calendarDateFromRecordDay(m.date, m.timezone).getTime(),
      value: (await m.getDecrypted()).value,
    }))
  );
  // Keep the newest mood per day, consistent with the home screen.
  const moods = [...new Map([...points].reverse().map((p) => [p.date, p])).values()];
  const [periods, dayLogs, contexts] = await Promise.all([
    readPeriods(periodRows),
    readDayLogs(dayRows),
    readContexts(contextRows),
  ]);
  return {
    data: { config, periods, dayLogs, contexts, moods },
    periodRows,
    dayRows,
    contextRows,
    moodRows,
  };
}

export class CycleTransferService {
  static async preview(
    cycle: MenstrualCycle,
    text: string,
    choice: ConflictChoice,
    restorePreferences: boolean
  ) {
    const { data } = await existingData(cycle);
    return planCycleMerge(parseCycleTransfer(text), data, choice, restorePreferences).counts;
  }

  /** A cycle-only merge: no reset, no writes to workout/nutrition/profile tables, one commit. */
  static async import(
    cycle: MenstrualCycle,
    text: string,
    choice: ConflictChoice,
    restorePreferences: boolean
  ) {
    const incoming = parseCycleTransfer(text);
    await primeCycleEncryption();
    return database.write(async () => {
      if (cycle.deletedAt != null) {
        throw new Error('cycle_removed');
      }

      const existing = await existingData(cycle);
      const plan = planCycleMerge(incoming, existing.data, choice, restorePreferences);
      cycleConfigSchema.parse(plan.config);
      const now = Date.now();
      const timezone = getCurrentTimezone();
      // Finish all encryption before any prepare operation mutates a model.
      const encryptGroup = async <T extends object>(group: {
        add: T[];
        update: { id: string; value: T }[];
      }) => ({
        add: await Promise.all(
          group.add.map((value) => encryptCyclePayload({ ...value, timezone }))
        ),
        update: await Promise.all(
          group.update.map(async ({ id, value }) => ({
            id,
            cipher: await encryptCyclePayload({ ...value, timezone }),
          }))
        ),
      });
      const [periods, days, contexts, config, moodAdds, moodUpdates] = await Promise.all([
        encryptGroup(plan.periods),
        encryptGroup(plan.dayLogs),
        encryptGroup(plan.contexts),
        encryptCyclePayload(plan.config),
        Promise.all(plan.moods.add.map((point) => encryptUserMetricFields(point))),
        Promise.all(plan.moods.update.map(({ value }) => encryptUserMetricFields(value))),
      ]);
      const operations: Model[] = [];
      const prepareGroup = (
        table: string,
        rows: (CyclePeriod | CycleDayLog | CycleContext)[],
        group: Awaited<ReturnType<typeof encryptGroup>>,
        hasCycleId: boolean
      ) => {
        for (const cipher of group.add) {
          operations.push(
            database.get<CycleDayLog>(table).prepareCreate((r) => {
              if (hasCycleId) {
                (r as unknown as CyclePeriod | CycleContext).cycleId = cycle.id;
              }

              r.payload = cipher;
              r.createdAt = now;
              r.updatedAt = now;
              r.deletedAt = null;
            })
          );
        }

        for (const { id, cipher } of group.update) {
          const row = rows.find((r) => r.id === id)!;
          operations.push(
            row.prepareUpdate((r) => {
              r.payload = cipher;
              r.updatedAt = now;
            })
          );
        }
      };

      prepareGroup('cycle_periods', existing.periodRows, periods, true);
      const clearDays = new Set(
        plan.dayLogs.update.filter(({ value }) => isEmptyDayLog(value)).map(({ id }) => id)
      );
      prepareGroup(
        'cycle_day_logs',
        existing.dayRows,
        { ...days, update: days.update.filter(({ id }) => !clearDays.has(id)) },
        false
      );
      operations.push(
        ...existing.dayRows.filter((r) => clearDays.has(r.id)).map((r) => prepareSoftDelete(r, now))
      );
      prepareGroup('cycle_contexts', existing.contextRows, contexts, true);
      const assignMood = (
        m: UserMetric,
        date: number,
        cipher: { value: string; unit?: string }
      ) => {
        m.type = 'mood';
        m.date = date;
        m.valueRaw = cipher.value;
        m.unitRaw = cipher.unit;
        m.timezone = getTimezoneAt(date);
        m.updatedAt = now;
      };

      plan.moods.add.forEach((point, i) =>
        operations.push(
          database.get<UserMetric>('user_metrics').prepareCreate((m) => {
            assignMood(m, point.date, moodAdds[i]);
            m.createdAt = now;
          })
        )
      );
      plan.moods.update.forEach(({ id, value }, i) =>
        operations.push(
          existing.moodRows
            .find((m) => m.id === id)!
            .prepareUpdate((m) => assignMood(m, value.date, moodUpdates[i]))
        )
      );
      const replacedMoodIds = new Map(plan.moods.update.map(({ id, value }) => [value.date, id]));
      operations.push(
        ...existing.moodRows
          .filter((m) => {
            const keep = replacedMoodIds.get(
              calendarDateFromRecordDay(m.date, m.timezone).getTime()
            );
            return keep != null && keep !== m.id;
          })
          .map((m) => prepareSoftDelete(m, now))
      );
      operations.push(
        cycle.prepareUpdate((r) => {
          r.config = config;
          r.updatedAt = now;
        })
      );
      await database.batch(...operations);
      return plan.counts;
    });
  }
}
