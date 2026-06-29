import { Q, Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import PeriodLog, { type PeriodLogCreate } from '@/database/models/PeriodLog';
import { getCurrentTimezone } from '@/utils/timezone';

export class PeriodLogRepository {
  static getForCycle(menstrualCycleId: string): Query<PeriodLog> {
    return database
      .get<PeriodLog>('period_logs')
      .query(
        Q.where('menstrual_cycle_id', menstrualCycleId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('start_date', Q.desc)
      );
  }

  static getActive(menstrualCycleId: string): Query<PeriodLog> {
    return database
      .get<PeriodLog>('period_logs')
      .query(
        Q.where('menstrual_cycle_id', menstrualCycleId),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('end_date', Q.eq(null))
      );
  }

  static async create(data: PeriodLogCreate): Promise<PeriodLog> {
    const now = Date.now();

    return await database.write(async () => {
      return await database.get<PeriodLog>('period_logs').create((log) => {
        log.menstrualCycleId = data.menstrualCycleId;
        log.startDate = data.startDate;
        log.endDate = data.endDate ?? null;
        log.notes = data.notes ?? null;
        log.timezone = data.timezone ?? getCurrentTimezone();
        log.createdAt = now;
        log.updatedAt = now;
        log.deletedAt = null;
      });
    });
  }

  static async createMany(logs: PeriodLogCreate[]): Promise<PeriodLog[]> {
    const now = Date.now();

    return await database.write(async () => {
      const collection = database.get<PeriodLog>('period_logs');

      const preparedLogs = logs.map((data) =>
        collection.prepareCreate((log) => {
          log.menstrualCycleId = data.menstrualCycleId;
          log.startDate = data.startDate;
          log.endDate = data.endDate ?? null;
          log.notes = data.notes ?? null;
          log.timezone = data.timezone ?? getCurrentTimezone();
          log.createdAt = now;
          log.updatedAt = now;
          log.deletedAt = null;
        })
      );

      await database.batch(...preparedLogs);
      return preparedLogs as unknown as PeriodLog[];
    });
  }

  static async fetchForCycle(menstrualCycleId: string): Promise<PeriodLog[]> {
    return await this.getForCycle(menstrualCycleId).fetch();
  }

  /**
   * Soft-deletes a period log and atomically re-anchors the cycle's lastPeriodStartDate
   * to the most recent remaining log (or null if none remain).
   * Always use this instead of calling log.markAsDeleted() directly so the cache stays correct.
   */
  static async deleteLog(log: PeriodLog, cycle: MenstrualCycle): Promise<void> {
    const now = Date.now();
    await database.write(async () => {
      // Fetch remaining logs (excluding the one being deleted) before batching.
      const remaining = await database
        .get<PeriodLog>('period_logs')
        .query(
          Q.where('menstrual_cycle_id', cycle.id),
          Q.where('deleted_at', Q.eq(null)),
          Q.where('id', Q.notEq(log.id))
        )
        .fetch();

      const newAnchor =
        remaining.length > 0 ? Math.max(...remaining.map((l) => l.startDate)) : null;

      const preparedLog = log.prepareUpdate((l) => {
        l.deletedAt = now;
        l.updatedAt = now;
      });

      const preparedCycle = cycle.prepareUpdate((c) => {
        c.lastPeriodStartDate = newAnchor;
        c.updatedAt = now;
      });

      await database.batch(preparedLog, preparedCycle);
    });
  }

  /**
   * Creates a period log and atomically updates the cycle's lastPeriodStartDate in one write.
   * Pass updateAnchor=false to skip the cycle update (e.g. when the new log is not the newest).
   */
  static async createWithCycleAnchor(
    data: PeriodLogCreate,
    cycle: MenstrualCycle,
    updateAnchor: boolean
  ): Promise<PeriodLog> {
    const now = Date.now();
    return await database.write(async () => {
      const preparedLog = database.get<PeriodLog>('period_logs').prepareCreate((log) => {
        log.menstrualCycleId = data.menstrualCycleId;
        log.startDate = data.startDate;
        log.endDate = data.endDate ?? null;
        log.notes = data.notes ?? null;
        log.timezone = data.timezone ?? getCurrentTimezone();
        log.createdAt = now;
        log.updatedAt = now;
        log.deletedAt = null;
      });

      if (updateAnchor) {
        const preparedCycle = cycle.prepareUpdate((c) => {
          c.lastPeriodStartDate = data.startDate;
          c.updatedAt = now;
        });
        await database.batch(preparedLog, preparedCycle);
      } else {
        await database.batch(preparedLog);
      }

      return preparedLog as unknown as PeriodLog;
    });
  }
}
