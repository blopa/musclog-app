import { Q, Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import MenstrualCycle, {
  type BirthControlType,
  type LifeStage,
  type SyncGoal,
} from '@/database/models/MenstrualCycle';
import PeriodLog, { type PeriodLogCreate } from '@/database/models/PeriodLog';
import { fillPeriodLog } from '@/database/repositories/PeriodLogRepository';
import { getCurrentTimezone } from '@/utils/timezone';

export class MenstrualCycleRepository {
  static getActive(): Query<MenstrualCycle> {
    return database
      .get<MenstrualCycle>('menstrual_cycles')
      .query(Q.where('is_active', true), Q.where('deleted_at', Q.eq(null)));
  }

  static getAll(): Query<MenstrualCycle> {
    return database
      .get<MenstrualCycle>('menstrual_cycles')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
  }

  static async createNewCycle(data: {
    avgCycleLength?: number;
    avgPeriodDuration?: number;
    useHormonalBirthControl?: boolean;
    birthControlType?: BirthControlType;
    syncGoal?: SyncGoal;
    lifeStage?: LifeStage;
  }): Promise<MenstrualCycle> {
    const now = Date.now();

    return await database.write(async () => {
      return await database.get<MenstrualCycle>('menstrual_cycles').create((cycle) => {
        cycle.avgCycleLength = data.avgCycleLength ?? 28;
        cycle.avgPeriodDuration = data.avgPeriodDuration ?? 5;
        cycle.useHormonalBirthControl = data.useHormonalBirthControl ?? false;
        cycle.birthControlType = data.birthControlType ?? null;
        cycle.lastPeriodStartDate = null;
        cycle.timezone = getCurrentTimezone();
        cycle.syncGoal = data.syncGoal ?? null;
        cycle.lifeStage = data.lifeStage ?? null;
        cycle.isActive = true;
        cycle.createdAt = now;
        cycle.updatedAt = now;
        cycle.deletedAt = null;
      });
    });
  }

  /**
   * Atomically creates a new cycle and its initial period logs in one write transaction.
   * The cycle's lastPeriodStartDate is derived from the logs (max startDate), not passed separately.
   * Use this for initial setup flows where the cycle and its first logs must either both exist or neither exist.
   */
  static async createNewCycleWithLogs(
    data: {
      avgCycleLength?: number;
      avgPeriodDuration?: number;
      useHormonalBirthControl?: boolean;
      birthControlType?: BirthControlType;
      syncGoal?: SyncGoal;
      lifeStage?: LifeStage;
    },
    logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[]
  ): Promise<MenstrualCycle> {
    const now = Date.now();
    const tz = getCurrentTimezone();
    const lastPeriodStartDate = logs.length > 0 ? Math.max(...logs.map((l) => l.startDate)) : null;

    return await database.write(async () => {
      const preparedCycle = database
        .get<MenstrualCycle>('menstrual_cycles')
        .prepareCreate((cycle) => {
          cycle.avgCycleLength = data.avgCycleLength ?? 28;
          cycle.avgPeriodDuration = data.avgPeriodDuration ?? 5;
          cycle.useHormonalBirthControl = data.useHormonalBirthControl ?? false;
          cycle.birthControlType = data.birthControlType ?? null;
          cycle.lastPeriodStartDate = lastPeriodStartDate;
          cycle.timezone = tz;
          cycle.syncGoal = data.syncGoal ?? null;
          cycle.lifeStage = data.lifeStage ?? null;
          cycle.isActive = true;
          cycle.createdAt = now;
          cycle.updatedAt = now;
          cycle.deletedAt = null;
        });

      const preparedLogs = logs.map((logData) =>
        database.get<PeriodLog>('period_logs').prepareCreate((log) => {
          fillPeriodLog(log, logData, preparedCycle.id, now);
        })
      );

      await database.batch(preparedCycle, ...preparedLogs);
      return preparedCycle;
    });
  }

  static async deactivateAll(): Promise<void> {
    const activeCycles = await this.getActive().fetch();

    await database.write(async (writer) => {
      for (const cycle of activeCycles) {
        await writer.callWriter(() => cycle.updateCycle({ isActive: false }));
      }
    });
  }
}
