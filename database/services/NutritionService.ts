import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Food from '../models/Food';
import FoodPortion from '../models/FoodPortion';
import NutritionLog, { MealType } from '../models/NutritionLog';

export class NutritionService {
  /**
   * Log food consumption
   */
  static async logFood(
    foodId: string,
    date: Date,
    mealType: MealType,
    amount: number,
    portionId?: string
  ): Promise<NutritionLog> {
    return await database.write(async () => {
      const now = Date.now();
      const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      return await database.get<NutritionLog>('nutrition_logs').create((log) => {
        log.foodId = foodId;
        log.date = dateTimestamp;
        log.type = mealType;
        log.amount = amount;
        log.portionId = portionId;
        log.createdAt = now;
        log.updatedAt = now;
      });
    });
  }

  /**
   * Get all nutrition logs for a specific date
   */
  static async getNutritionLogsForDate(date: Date): Promise<NutritionLog[]> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;

    return await database
      .get<NutritionLog>('nutrition_logs')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.between(dateTimestamp, nextDayTimestamp - 1))
      )
      .fetch();
  }

  /**
   * Get nutrition logs for a date range
   */
  static async getNutritionLogsForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<NutritionLog[]> {
    const startTimestamp = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    ).getTime();
    const endTimestamp =
      new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() +
      24 * 60 * 60 * 1000;

    return await database
      .get<NutritionLog>('nutrition_logs')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.between(startTimestamp, endTimestamp - 1))
      )
      .fetch();
  }

  /**
   * Get nutrition logs for a specific meal type on a date
   */
  static async getNutritionLogsForMeal(date: Date, mealType: MealType): Promise<NutritionLog[]> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;

    return await database
      .get<NutritionLog>('nutrition_logs')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.between(dateTimestamp, nextDayTimestamp - 1)),
        Q.where('type', mealType)
      )
      .fetch();
  }

  /**
   * Calculate total nutrients for a date
   */
  static async getDailyNutrients(date: Date): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    byMealType: Record<
      MealType,
      { calories: number; protein: number; carbs: number; fat: number; fiber: number }
    >;
  }> {
    try {
      const logs = await this.getNutritionLogsForDate(date);

      const totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        byMealType: {
          breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          snack: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          other: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        },
      };

      for (const log of logs) {
        try {
          const nutrients = await log.getNutrients();
          const mealType = log.type ?? 'breakfast';

          totals.calories += nutrients.calories;
          totals.protein += nutrients.protein;
          totals.carbs += nutrients.carbs;
          totals.fat += nutrients.fat;
          totals.fiber += nutrients.fiber;

          totals.byMealType[mealType].calories += nutrients.calories;
          totals.byMealType[mealType].protein += nutrients.protein;
          totals.byMealType[mealType].carbs += nutrients.carbs;
          totals.byMealType[mealType].fat += nutrients.fat;
          totals.byMealType[mealType].fiber += nutrients.fiber;
        } catch (error) {
          // Skip individual log errors to prevent total failure
          console.error('Error calculating nutrients for log:', error);
          continue;
        }
      }

      return totals;
    } catch (error) {
      console.error('Error getting daily nutrients:', error);
      // Return default values on error
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        byMealType: {
          breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          snack: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          other: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        },
      };
    }
  }

  /**
   * Calculate nutrients for a date range
   */
  static async getRangeNutrients(
    startDate: Date,
    endDate: Date
  ): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    dailyAverages: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  }> {
    const logs = await this.getNutritionLogsForDateRange(startDate, endDate);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    for (const log of logs) {
      const nutrients = await log.getNutrients();
      totalCalories += nutrients.calories;
      totalProtein += nutrients.protein;
      totalCarbs += nutrients.carbs;
      totalFat += nutrients.fat;
      totalFiber += nutrients.fiber;
    }

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    return {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      fiber: totalFiber,
      dailyAverages: {
        calories: totalCalories / days,
        protein: totalProtein / days,
        carbs: totalCarbs / days,
        fat: totalFat / days,
        fiber: totalFiber / days,
      },
    };
  }

  /**
   * Update nutrition log
   */
  static async updateNutritionLog(
    id: string,
    updates: {
      amount?: number;
      mealType?: MealType;
      portionId?: string;
    }
  ): Promise<NutritionLog> {
    return await database.write(async () => {
      const log = await database.get<NutritionLog>('nutrition_logs').find(id);

      if (log.deletedAt) {
        throw new Error('Cannot update deleted nutrition log');
      }

      await log.update((record) => {
        if (updates.amount !== undefined) record.amount = updates.amount;
        if (updates.mealType !== undefined) record.type = updates.mealType;
        if (updates.portionId !== undefined) record.portionId = updates.portionId;
        record.updatedAt = Date.now();
      });

      return log;
    });
  }

  /**
   * Delete nutrition log
   */
  static async deleteNutritionLog(id: string): Promise<void> {
    return await database.write(async () => {
      const log = await database.get<NutritionLog>('nutrition_logs').find(id);
      await log.markAsDeleted();
    });
  }

  /**
   * Get recent foods (for quick logging)
   */
  static async getRecentFoods(limit: number = 10, date?: Date): Promise<Food[]> {
    // If a date is provided, limit recent logs to that date (today by default).
    let query = database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)));

    if (date) {
      const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;
      query = query.extend(Q.where('date', Q.between(dateTimestamp, nextDayTimestamp - 1)));
    }

    const recentLogs = await query.extend(Q.sortBy('created_at', Q.desc), Q.take(limit)).fetch();

    const foodIds = [...new Set(recentLogs.map((log) => log.foodId))];
    const foods: Food[] = [];

    for (const foodId of foodIds) {
      try {
        const food = await database.get<Food>('foods').find(foodId ?? '');
        if (!food.deletedAt) {
          foods.push(food);
        }
      } catch (error) {
        // Food might have been deleted, skip
      }
    }

    return foods;
  }

  /**
   * Get most eaten foods
   */
  static async getMostEatenFoods(limit: number = 10): Promise<{ food: Food; count: number }[]> {
    // This is a simplified version - in a real app you might want to add a counter table
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const foodCounts = new Map<string, number>();

    for (const log of logs) {
      const count = foodCounts.get(log.foodId ?? '') || 0;
      foodCounts.set(log.foodId ?? '', count + 1);
    }

    const sortedFoods = Array.from(foodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const results: { food: Food; count: number }[] = [];

    for (const [foodId, count] of sortedFoods) {
      try {
        const food = await database.get<Food>('foods').find(foodId);
        if (!food.deletedAt) {
          results.push({ food, count });
        }
      } catch (error) {
        // Food might have been deleted, skip
      }
    }

    return results;
  }

  /**
   * Get most eaten foods filtered by meal type
   */
  static async getMostEatenFoodsByMealType(
    mealType: MealType,
    limit: number = 10
  ): Promise<{ food: Food; count: number }[]> {
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('type', mealType))
      .fetch();

    const foodCounts = new Map<string, number>();

    for (const log of logs) {
      const count = foodCounts.get(log.foodId ?? '') || 0;
      foodCounts.set(log.foodId ?? '', count + 1);
    }

    const sortedFoods = Array.from(foodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const results: { food: Food; count: number }[] = [];

    for (const [foodId, count] of sortedFoods) {
      try {
        const food = await database.get<Food>('foods').find(foodId);
        if (!food.deletedAt) {
          results.push({ food, count });
        }
      } catch (error) {
        // Food might have been deleted, skip
      }
    }

    return results;
  }

  /**
   * Get nutrition streak (consecutive days with logged food)
   */
  static async getNutritionStreak(): Promise<number> {
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('date', Q.desc))
      .fetch();

    if (logs.length === 0) return 0;

    const uniqueDates = [...new Set(logs.map((log) => log.date ?? 0))].sort(
      (a, b) => (b ?? 0) - (a ?? 0)
    );

    let streak = 0;
    let expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    for (const dateTimestamp of uniqueDates) {
      const currentDate = new Date(dateTimestamp ?? Date.now());
      currentDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (expectedDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
