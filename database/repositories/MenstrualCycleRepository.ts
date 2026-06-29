import { Q, Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import MenstrualCycle, {
  type BirthControlType,
  type LifeStage,
  type SyncGoal,
} from '@/database/models/MenstrualCycle';
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
    birthControlType?: string;
    lastPeriodStartDate?: number | null;
    syncGoal?: SyncGoal;
    lifeStage?: LifeStage;
  }): Promise<MenstrualCycle> {
    const now = Date.now();

    return await database.write(async () => {
      return await database.get<MenstrualCycle>('menstrual_cycles').create((cycle) => {
        cycle.avgCycleLength = data.avgCycleLength ?? 28;
        cycle.avgPeriodDuration = data.avgPeriodDuration ?? 5;
        cycle.useHormonalBirthControl = data.useHormonalBirthControl ?? false;
        cycle.birthControlType = (data.birthControlType as BirthControlType) ?? null;
        cycle.lastPeriodStartDate = data.lastPeriodStartDate ?? null;
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

  static async deactivateAll(): Promise<void> {
    const activeCycles = await this.getActive().fetch();

    await database.write(async (writer) => {
      for (const cycle of activeCycles) {
        await writer.callWriter(() => cycle.updateCycle({ isActive: false }));
      }
    });
  }
}
