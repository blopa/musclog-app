import { Q, Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import MenstrualCycle, {
  type BirthControlType,
  type LifeStage,
  type SyncGoal,
} from '@/database/models/MenstrualCycle';
import PeriodLog, { type PeriodLogCreate } from '@/database/models/PeriodLog';
import { normalizeInitialPeriodLogs } from '@/database/repositories/periodLogNormalization';
import { hasOverlappingPeriodLog } from '@/database/repositories/periodLogOverlap';
import { fillPeriodLog } from '@/database/repositories/PeriodLogRepository';
import { getCurrentTimezone } from '@/utils/timezone';

type NewCycleInput = {
  avgCycleLength?: number;
  avgPeriodDuration?: number;
  useHormonalBirthControl?: boolean;
  birthControlType?: BirthControlType;
  syncGoal?: SyncGoal;
  lifeStage?: LifeStage;
};

function assertNoFutureInitialLogs(logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[]): void {
  const now = Date.now();

  for (const log of logs) {
    if (log.startDate > now) {
      throw new Error('period_date_in_future');
    }
  }
}

function assertNoOverlappingInitialLogs(logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[]): void {
  for (let index = 0; index < logs.length; index++) {
    const log = logs[index];
    const earlierLogs = logs.slice(0, index).map((existingLog, existingIndex) => ({
      id: `initial-${existingIndex}`,
      startDate: existingLog.startDate,
      endDate: existingLog.endDate ?? null,
    }));

    if (hasOverlappingPeriodLog(earlierLogs, log)) {
      throw new Error('period_log_overlaps_existing');
    }
  }
}

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

  static async createNewCycle(data: NewCycleInput): Promise<MenstrualCycle> {
    const now = Date.now();

    return await database.write(async () => {
      return await database.get<MenstrualCycle>('menstrual_cycles').create((cycle) => {
        cycle.avgCycleLength = data.avgCycleLength ?? 28;
        cycle.avgPeriodDuration = data.avgPeriodDuration ?? 5;
        cycle.useHormonalBirthControl = data.useHormonalBirthControl ?? false;
        cycle.birthControlType = data.birthControlType ?? null;
        cycle.lastPeriodStartDate = 0;
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
    data: NewCycleInput,
    logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[]
  ): Promise<MenstrualCycle> {
    const now = Date.now();
    const tz = getCurrentTimezone();
    const normalizedLogs = normalizeInitialPeriodLogs(logs, data.avgPeriodDuration ?? 5, now);
    assertNoFutureInitialLogs(normalizedLogs);
    assertNoOverlappingInitialLogs(normalizedLogs);

    const lastPeriodStartDate =
      normalizedLogs.length > 0 ? Math.max(...normalizedLogs.map((l) => l.startDate)) : 0;

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

      const preparedLogs = normalizedLogs.map((logData) =>
        database.get<PeriodLog>('period_logs').prepareCreate((log) => {
          fillPeriodLog(log, logData, preparedCycle.id, now);
        })
      );

      await database.batch(preparedCycle, ...preparedLogs);
      return preparedCycle;
    });
  }

  /**
   * Atomically deactivates any existing active cycles and replaces them with a newly
   * created cycle and optional initial period logs. This prevents the app from ending
   * up with zero active cycles if validation fails during replacement.
   */
  static async replaceActiveCycle(
    data: NewCycleInput,
    logs: Omit<PeriodLogCreate, 'menstrualCycleId'>[] = []
  ): Promise<MenstrualCycle> {
    const now = Date.now();
    const tz = getCurrentTimezone();
    const normalizedLogs = normalizeInitialPeriodLogs(logs, data.avgPeriodDuration ?? 5, now);
    assertNoFutureInitialLogs(normalizedLogs);
    assertNoOverlappingInitialLogs(normalizedLogs);

    const lastPeriodStartDate =
      normalizedLogs.length > 0 ? Math.max(...normalizedLogs.map((l) => l.startDate)) : 0;

    return await database.write(async () => {
      const activeCycles = await this.getActive().fetch();

      const preparedDeactivations = activeCycles.map((cycle) =>
        cycle.prepareUpdate((currentCycle) => {
          currentCycle.isActive = false;
          currentCycle.updatedAt = now;
        })
      );

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

      const preparedLogs = normalizedLogs.map((logData) =>
        database.get<PeriodLog>('period_logs').prepareCreate((log) => {
          fillPeriodLog(log, logData, preparedCycle.id, now);
        })
      );

      await database.batch(...preparedDeactivations, preparedCycle, ...preparedLogs);
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
