import { database } from '../index';
import NutritionGoal from '../models/NutritionGoal';
import { Q } from '@nozbe/watermelondb';

export interface NutritionGoalInput {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  eatingPhase: 'cut' | 'maintain' | 'bulk';
  targetWeight: number;
  targetBodyFat: number;
  targetBMI: number;
  targetFFMI: number;
  targetDate?: number | null;
}

export class NutritionGoalService {
  /**
   * Get the current nutrition goals (effective_until IS NULL).
   */
  static async getCurrent(): Promise<NutritionGoal | null> {
    const rows = await database
      .get<NutritionGoal>('nutrition_goals')
      .query(Q.where('effective_until', Q.eq(null)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Save a new snapshot of goals. Supersedes the current one (sets effective_until = now).
   */
  static async saveGoals(data: NutritionGoalInput): Promise<NutritionGoal> {
    const now = Date.now();
    return await database.write(async () => {
      const current = await database
        .get<NutritionGoal>('nutrition_goals')
        .query(Q.where('effective_until', Q.eq(null)), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      if (current.length > 0) {
        await current[0].update((r) => {
          r.effectiveUntil = now;
          r.updatedAt = now;
        });
      }

      return await database.get<NutritionGoal>('nutrition_goals').create((r) => {
        r.totalCalories = data.totalCalories;
        r.protein = data.protein;
        r.carbs = data.carbs;
        r.fats = data.fats;
        r.fiber = data.fiber;
        r.eatingPhase = data.eatingPhase;
        r.targetWeight = data.targetWeight;
        r.targetBodyFat = data.targetBodyFat;
        r.targetBmi = data.targetBMI;
        r.targetFfmi = data.targetFFMI;
        r.targetDate = data.targetDate ?? null;
        r.effectiveUntil = null;
        r.createdAt = now;
        r.updatedAt = now;
      });
    });
  }

  /**
   * Get history of goals (for retrospective). Most recent first.
   */
  static async getHistory(limit?: number): Promise<NutritionGoal[]> {
    let query = database
      .get<NutritionGoal>('nutrition_goals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
    if (limit != null) {
      query = query.extend(Q.take(limit));
    }
    return await query.fetch();
  }

  /**
   * Get goals history with pagination support (similar to WorkoutService.getWorkoutHistory).
   * Most recent first.
   */
  static async getGoalsHistory(limit?: number, offset?: number): Promise<NutritionGoal[]> {
    let query = database.get<NutritionGoal>('nutrition_goals').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.desc) // Most recent first
    );

    // Apply pagination (same pattern as WorkoutService.getWorkoutHistory)
    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        // Apply both skip and take together - skip must come before take
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }
}
