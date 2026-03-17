import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import type NutritionCheckin from '../models/NutritionCheckin';

export interface NutritionCheckinInput {
  checkinDate: number;
  targetWeight: number;
  targetBodyFat: number;
  targetBmi: number;
  targetFfmi: number;
  completed?: boolean;
}

export class NutritionCheckinService {
  /**
   * Get all check-ins for a nutrition goal, ordered by checkin_date ascending.
   */
  static async getByGoalId(nutritionGoalId: string): Promise<NutritionCheckin[]> {
    return await database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(
        Q.where('nutrition_goal_id', nutritionGoalId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('checkin_date', Q.asc)
      )
      .fetch();
  }

  /**
   * Get a single check-in by id.
   */
  static async getById(id: string): Promise<NutritionCheckin | null> {
    const rows = await database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(Q.where('id', id), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all check-ins with pagination support, ordered by checkin_date descending.
   */
  static async getHistory(limit?: number, offset?: number): Promise<NutritionCheckin[]> {
    let query = database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('checkin_date', Q.desc));

    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Create a new check-in for a nutrition goal.
   */
  static async create(
    nutritionGoalId: string,
    data: NutritionCheckinInput
  ): Promise<NutritionCheckin> {
    return await database.write(async () => {
      const now = Date.now();
      return await database.get<NutritionCheckin>('nutrition_checkins').create((r) => {
        r.nutritionGoalId = nutritionGoalId;
        r.checkinDate = data.checkinDate;
        r.targetWeight = data.targetWeight;
        r.targetBodyFat = data.targetBodyFat;
        r.targetBmi = data.targetBmi;
        r.targetFfmi = data.targetFfmi;
        r.completed = data.completed ?? false;
        r.createdAt = now;
        r.updatedAt = now;
      });
    });
  }

  /**
   * Create multiple check-ins for a nutrition goal in a single batch operation.
   */
  static async createBatch(
    nutritionGoalId: string,
    checkins: NutritionCheckinInput[]
  ): Promise<NutritionCheckin[]> {
    if (checkins.length === 0) {
      return [];
    }

    return await database.write(async () => {
      const now = Date.now();
      const collection = database.get<NutritionCheckin>('nutrition_checkins');

      const preparedRecords = checkins.map((data) =>
        collection.prepareCreate((r) => {
          r.nutritionGoalId = nutritionGoalId;
          r.checkinDate = data.checkinDate;
          r.targetWeight = data.targetWeight;
          r.targetBodyFat = data.targetBodyFat;
          r.targetBmi = data.targetBmi;
          r.targetFfmi = data.targetFfmi;
          r.completed = data.completed ?? false;
          r.createdAt = now;
          r.updatedAt = now;
        })
      );

      await database.batch(...preparedRecords);
      return preparedRecords;
    });
  }

  /**
   * Update a check-in.
   */
  static async update(
    id: string,
    updates: Partial<NutritionCheckinInput>
  ): Promise<NutritionCheckin> {
    return await database.write(async () => {
      const checkin = await database.get<NutritionCheckin>('nutrition_checkins').find(id);

      if (checkin.deletedAt) {
        throw new Error('Cannot update deleted check-in');
      }

      await checkin.update((record) => {
        if (updates.checkinDate !== undefined) {
          record.checkinDate = updates.checkinDate;
        }
        if (updates.targetWeight !== undefined) {
          record.targetWeight = updates.targetWeight;
        }
        if (updates.targetBodyFat !== undefined) {
          record.targetBodyFat = updates.targetBodyFat;
        }
        if (updates.targetBmi !== undefined) {
          record.targetBmi = updates.targetBmi;
        }
        if (updates.targetFfmi !== undefined) {
          record.targetFfmi = updates.targetFfmi;
        }
        if (updates.completed !== undefined) {
          record.completed = updates.completed;
        }
        record.updatedAt = Date.now();
      });

      return checkin;
    });
  }

  /**
   * Soft-delete a check-in.
   */
  static async delete(id: string): Promise<void> {
    await database.write(async () => {
      const checkin = await database.get<NutritionCheckin>('nutrition_checkins').find(id);
      await checkin.markAsDeleted();
    });
  }
}
