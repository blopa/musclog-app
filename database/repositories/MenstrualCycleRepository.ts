import { Q, Query } from '@nozbe/watermelondb';

import { database } from '../database-instance';
import MenstrualCycle, { type BirthControlType, type SyncGoal } from '../models/MenstrualCycle';

/**
 * Repository for MenstrualCycle queries
 * This file contains static query methods that require the database instance.
 * This pattern avoids circular dependencies between models and the database instance.
 */
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
    lastPeriodStartDate?: number;
    syncGoal?: SyncGoal;
  }): Promise<MenstrualCycle> {
    const now = Date.now();

    return await database.write(async () => {
      return await database.get<MenstrualCycle>('menstrual_cycles').create((cycle) => {
        cycle.avgCycleLength = data.avgCycleLength ?? 28;
        cycle.avgPeriodDuration = data.avgPeriodDuration ?? 5;
        cycle.useHormonalBirthControl = data.useHormonalBirthControl ?? false;
        cycle.birthControlType = data.birthControlType as BirthControlType | undefined;
        cycle.lastPeriodStartDate = data.lastPeriodStartDate ?? now;
        cycle.syncGoal = data.syncGoal;
        cycle.isActive = true;
        cycle.createdAt = now;
        cycle.updatedAt = now;
      });
    });
  }

  static async deactivateAll(): Promise<void> {
    const activeCycles = await this.getActive().fetch();

    await database.write(async () => {
      for (const cycle of activeCycles) {
        await cycle.updateCycle({ isActive: false });
      }
    });
  }
}
