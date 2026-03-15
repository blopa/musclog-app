import { Q } from '@nozbe/watermelondb';
import { Platform } from 'react-native';

import { writeNutritionLogToHealthConnect } from '../../services/healthConnectNutrition';
import { requestNutritionWidgetUpdate } from '../../widgets/widget-update-helpers';
import { encryptNutritionLogSnapshot } from '../encryptionHelpers';
import { database } from '../index';
import Food from '../models/Food';
import NutritionLog, { MealType } from '../models/NutritionLog';

/**
 * Helper function to retry database queries that fail during database reset.
 * WatermelonDB throws an error when queries are attempted during reset.
 * This function retries the query with exponential backoff.
 */
async function retryOnResetError<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      const isResetError =
        error?.message?.includes('database is being reset') ||
        error?.message?.includes('underlyingAdapter');

      if (isResetError && attempt < maxRetries - 1) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

export class NutritionService {
  /**
   * Log food consumption. Stores a snapshot of the food's macros/micros per 100g at log time.
   */
  static async logFood(
    foodId: string,
    date: Date,
    mealType: MealType,
    amount: number,
    portionId?: string,
    externalId?: string
  ): Promise<NutritionLog> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    const log = await database.write(async () => {
      const food = await database.get<Food>('foods').find(foodId);
      const now = Date.now();
      const encrypted = await encryptNutritionLogSnapshot({
        loggedFoodName: food.name ?? undefined,
        loggedCalories: food.calories ?? 0,
        loggedProtein: food.protein ?? 0,
        loggedCarbs: food.carbs ?? 0,
        loggedFat: food.fat ?? 0,
        loggedFiber: food.fiber ?? 0,
        loggedMicros: food.micros,
      });

      return await database.get<NutritionLog>('nutrition_logs').create((record) => {
        record.foodId = foodId;
        record.externalId = externalId;
        record.date = dateTimestamp;
        record.type = mealType;
        record.amount = amount;
        record.portionId = portionId;
        record.loggedFoodNameRaw = encrypted.loggedFoodName;
        record.loggedCaloriesRaw = encrypted.loggedCalories;
        record.loggedProteinRaw = encrypted.loggedProtein;
        record.loggedCarbsRaw = encrypted.loggedCarbs;
        record.loggedFatRaw = encrypted.loggedFat;
        record.loggedFiberRaw = encrypted.loggedFiber;
        record.loggedMicrosRaw = encrypted.loggedMicrosJson;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });

    // Write to Health Connect (Android only, user-entered records only — HC-sourced records
    // already have externalId set and must not be written back to avoid an echo loop).
    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();

      if (!externalId) {
        const [nutrients, snapshot] = await Promise.all([
          log.getNutrients(),
          log.getDecryptedSnapshot(),
        ]);

        const hcId = await writeNutritionLogToHealthConnect({
          logId: log.id,
          date: dateTimestamp,
          mealType,
          foodName: snapshot.loggedFoodName ?? '',
          calories: nutrients.calories,
          protein: nutrients.protein,
          carbs: nutrients.carbs,
          fat: nutrients.fat,
          fiber: nutrients.fiber,
        }).catch(() => undefined);

        if (hcId) {
          await database.write(async () => {
            await log.update((record) => {
              record.externalId = hcId;
            });
          });
        }
      }
    }

    return log;
  }

  /**
   * Get all nutrition logs for a specific date
   */
  static async getNutritionLogsForDate(date: Date): Promise<NutritionLog[]> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;

    return await retryOnResetError(() =>
      database
        .get<NutritionLog>('nutrition_logs')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('date', Q.between(dateTimestamp, nextDayTimestamp - 1))
        )
        .fetch()
    );
  }

  /**
   * Get nutrition logs with pagination (for Manage Food Data modal).
   * Ordered by date desc, then created_at desc. Most recent first.
   */
  static async getNutritionLogsPaginated(limit: number, offset: number): Promise<NutritionLog[]> {
    let query = database
      .get<NutritionLog>('nutrition_logs')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('created_at', Q.desc)
      );

    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
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

    return await retryOnResetError(() =>
      database
        .get<NutritionLog>('nutrition_logs')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('date', Q.between(startTimestamp, endTimestamp - 1))
        )
        .fetch()
    );
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
    const updatedLog = await database.write(async () => {
      const log = await database.get<NutritionLog>('nutrition_logs').find(id);

      if (log.deletedAt) {
        throw new Error('Cannot update deleted nutrition log');
      }

      await log.update((record) => {
        if (updates.amount !== undefined) {
          record.amount = updates.amount;
        }
        if (updates.mealType !== undefined) {
          record.type = updates.mealType;
        }
        if (updates.portionId !== undefined) {
          record.portionId = updates.portionId;
        }
        record.updatedAt = Date.now();
      });

      return log;
    });

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }

    return updatedLog;
  }

  /**
   * Delete nutrition log
   */
  static async deleteNutritionLog(id: string): Promise<void> {
    const log = await database.get<NutritionLog>('nutrition_logs').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await log.markAsDeleted();

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }
  }

  /**
   * Delete multiple nutrition logs at once (e.g. all items in a meal section)
   */
  static async deleteNutritionLogsBatch(logs: NutritionLog[]): Promise<void> {
    const now = Date.now();
    await database.write(async () => {
      await database.batch(
        ...logs.map((log) =>
          log.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        )
      );
    });

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }
  }

  /**
   * Copy nutrition logs to a new date and/or meal type.
   * Copies the encrypted snapshot fields as-is so no re-encryption is needed.
   */
  static async copyNutritionLogsToDate(
    logs: NutritionLog[],
    targetDate: Date,
    targetMealType: MealType
  ): Promise<void> {
    const dateTimestamp = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).getTime();

    await database.write(async () => {
      const now = Date.now();
      await database.batch(
        ...logs.map((log) =>
          database.get<NutritionLog>('nutrition_logs').prepareCreate((record) => {
            record.foodId = log.foodId;
            record.date = dateTimestamp;
            record.type = targetMealType;
            record.amount = log.amount;
            record.portionId = log.portionId;
            record.loggedFoodNameRaw = log.loggedFoodNameRaw;
            record.loggedCaloriesRaw = log.loggedCaloriesRaw;
            record.loggedProteinRaw = log.loggedProteinRaw;
            record.loggedCarbsRaw = log.loggedCarbsRaw;
            record.loggedFatRaw = log.loggedFatRaw;
            record.loggedFiberRaw = log.loggedFiberRaw;
            record.loggedMicrosRaw = log.loggedMicrosRaw;
            record.createdAt = now;
            record.updatedAt = now;
          })
        )
      );
    });

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }
  }

  /**
   * Move nutrition logs to a new date and/or meal type.
   */
  static async moveNutritionLogsToDate(
    logs: NutritionLog[],
    targetDate: Date,
    targetMealType: MealType
  ): Promise<void> {
    const dateTimestamp = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).getTime();

    await database.write(async () => {
      const now = Date.now();
      await database.batch(
        ...logs.map((log) =>
          log.prepareUpdate((record) => {
            record.date = dateTimestamp;
            record.type = targetMealType;
            record.updatedAt = now;
          })
        )
      );
    });

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }
  }

  /**
   * Split nutrition logs: move `splitPercentage`% to a new date/meal type while
   * reducing the original logs to the remaining percentage. Both operations are
   * performed in a single atomic batch write.
   */
  static async splitNutritionLogsToDate(
    logs: NutritionLog[],
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage: number
  ): Promise<void> {
    const splitRatio = splitPercentage / 100;
    const remainRatio = 1 - splitRatio;
    const dateTimestamp = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).getTime();

    await database.write(async () => {
      const now = Date.now();
      await database.batch(
        // Create new logs at splitRatio of the original amount
        ...logs.map((log) =>
          database.get<NutritionLog>('nutrition_logs').prepareCreate((record) => {
            record.foodId = log.foodId;
            record.date = dateTimestamp;
            record.type = targetMealType;
            record.amount = log.amount * splitRatio;
            record.portionId = log.portionId;
            record.loggedFoodNameRaw = log.loggedFoodNameRaw;
            record.loggedCaloriesRaw = log.loggedCaloriesRaw;
            record.loggedProteinRaw = log.loggedProteinRaw;
            record.loggedCarbsRaw = log.loggedCarbsRaw;
            record.loggedFatRaw = log.loggedFatRaw;
            record.loggedFiberRaw = log.loggedFiberRaw;
            record.loggedMicrosRaw = log.loggedMicrosRaw;
            record.createdAt = now;
            record.updatedAt = now;
          })
        ),
        // Reduce original logs to remainRatio of the original amount
        ...logs.map((log) =>
          log.prepareUpdate((record) => {
            record.amount = log.amount * remainRatio;
            record.updatedAt = now;
          })
        )
      );
    });

    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();
    }
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
   * Get recent nutrition logs with gramWeight (for recent tracked foods display)
   */
  static async getRecentNutritionLogs(
    limit: number = 10,
    date?: Date
  ): Promise<
    {
      log: NutritionLog;
      food: Food | null;
      nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      gramWeight: number;
      displayName: string;
    }[]
  > {
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

    const resolved = await Promise.all(
      recentLogs.map(async (log) => {
        let food: Food | null = null;
        try {
          food = await log.food;
        } catch {
          // Food may be deleted; we still show the log using snapshot name and nutrients
        }

        const [nutrients, gramWeight, displayName] = await Promise.all([
          log.getNutrients(),
          log.getGramWeight(),
          log.getDisplayName(),
        ]);

        return { log, food, nutrients, gramWeight, displayName };
      })
    );

    return resolved;
  }

  /**
   * Get favorite foods
   */
  static async getFavoriteFoods(limit: number = 10, offset: number = 0): Promise<Food[]> {
    if (!database) {
      return [];
    }

    let query = database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_favorite', true));

    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Get favorite foods count
   */
  static async getFavoriteFoodsCount(): Promise<number> {
    if (!database) {
      return 0;
    }

    const favoriteFoods = await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_favorite', true))
      .fetch();

    return favoriteFoods.length;
  }

  /**
   * Get most eaten foods
   */
  static async getMostEatenFoods(limit: number = 10): Promise<{ food: Food; count: number }[]> {
    // TODO: This is a simplified version - consider adding a counter table for accurate counts
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

    if (logs.length === 0) {
      return 0;
    }

    const uniqueDates = [...new Set(logs.map((log) => log.date ?? 0))].sort(
      (a, b) => (b ?? 0) - (a ?? 0)
    );

    let streak = 0;
    let expectedDate = new Date();
    expectedDate.setUTCHours(0, 0, 0, 0);

    for (const dateTimestamp of uniqueDates) {
      const currentDate = new Date(dateTimestamp ?? Date.now());
      currentDate.setUTCHours(0, 0, 0, 0);

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

  /**
   * Duplicate nutrition log (create a copy)
   */
  static async duplicateNutritionLog(id: string): Promise<NutritionLog> {
    return await database.write(async () => {
      const originalLog = await database.get<NutritionLog>('nutrition_logs').find(id);

      if (originalLog.deletedAt) {
        throw new Error('Cannot duplicate deleted nutrition log');
      }

      const now = Date.now();

      // Create new nutrition log with same data and snapshot (copy ciphertext)
      return await database.get<NutritionLog>('nutrition_logs').create((log) => {
        log.foodId = originalLog.foodId;
        log.amount = originalLog.amount;
        log.portionId = originalLog.portionId;
        log.type = originalLog.type;
        log.date = originalLog.date;
        log.loggedFoodNameRaw = originalLog.loggedFoodNameRaw;
        log.loggedCaloriesRaw = originalLog.loggedCaloriesRaw ?? '';
        log.loggedProteinRaw = originalLog.loggedProteinRaw ?? '';
        log.loggedCarbsRaw = originalLog.loggedCarbsRaw ?? '';
        log.loggedFatRaw = originalLog.loggedFatRaw ?? '';
        log.loggedFiberRaw = originalLog.loggedFiberRaw ?? '';
        log.loggedMicrosRaw = originalLog.loggedMicrosRaw;
        log.createdAt = now;
        log.updatedAt = now;
      });
    });
  }

  /**
   * Log a custom AI-generated meal. Creates a temporary food entry and logs it.
   */
  static async logCustomMeal(
    mealData: {
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      foodId?: string;
    },
    date: Date,
    mealType: MealType,
    amount: number = 100 // Default to 100g for custom meals
  ): Promise<NutritionLog> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    // If foodId is provided, log directly using the existing food
    if (mealData.foodId) {
      return await NutritionService.logFood(mealData.foodId, date, mealType, amount);
    }

    const log = await database.write(async () => {
      const now = Date.now();

      // Create a temporary food entry for the AI-generated meal
      const tempFood = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = true;
        food.name = mealData.name;
        food.brand = undefined;
        food.barcode = undefined;
        food.calories = mealData.calories;
        food.protein = mealData.protein;
        food.carbs = mealData.carbs;
        food.fat = mealData.fat;
        food.fiber = mealData.fiber ?? 0;
        food.micros = {
          sugar: 0,
          sodium: 0,
        };
        food.isFavorite = false;
        food.createdAt = now;
        food.updatedAt = now;
      });

      // Create encrypted snapshot for the nutrition log
      const encrypted = await encryptNutritionLogSnapshot({
        loggedFoodName: mealData.name,
        loggedCalories: mealData.calories,
        loggedProtein: mealData.protein,
        loggedCarbs: mealData.carbs,
        loggedFat: mealData.fat,
        loggedFiber: mealData.fiber ?? 0,
        loggedMicros: {},
      });

      return await database.get<NutritionLog>('nutrition_logs').create((record) => {
        record.foodId = tempFood.id;
        record.date = dateTimestamp;
        record.type = mealType;
        record.amount = amount;
        record.loggedFoodNameRaw = encrypted.loggedFoodName;
        record.loggedCaloriesRaw = encrypted.loggedCalories;
        record.loggedProteinRaw = encrypted.loggedProtein;
        record.loggedCarbsRaw = encrypted.loggedCarbs;
        record.loggedFatRaw = encrypted.loggedFat;
        record.loggedFiberRaw = encrypted.loggedFiber;
        record.loggedMicrosRaw = encrypted.loggedMicrosJson;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });

    // Write to Health Connect (Android only)
    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();

      const [nutrients, snapshot] = await Promise.all([
        log.getNutrients(),
        log.getDecryptedSnapshot(),
      ]);

      await writeNutritionLogToHealthConnect({
        logId: log.id,
        date: dateTimestamp,
        mealType,
        foodName: snapshot.loggedFoodName ?? '',
        calories: nutrients.calories,
        protein: nutrients.protein,
        carbs: nutrients.carbs,
        fat: nutrients.fat,
        fiber: nutrients.fiber,
      }).catch(() => undefined); // Silently ignore Health Connect errors
    }

    return log;
  }

  /**
   * Log multiple custom AI-generated meals in a batch.
   */
  static async logCustomMealsBatch(
    ingredients: {
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      grams: number;
      foodId?: string;
    }[],
    date: Date,
    mealType: MealType
  ): Promise<NutritionLog[]> {
    const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const now = Date.now();

    const logs = await database.write(async () => {
      const createdLogs: NutritionLog[] = [];

      for (const ingredient of ingredients) {
        // If foodId is provided, find the food and create a log snapshot
        if (ingredient.foodId) {
          try {
            const food = await database.get<Food>('foods').find(ingredient.foodId);
            const encrypted = await encryptNutritionLogSnapshot({
              loggedFoodName: food.name ?? ingredient.name,
              loggedCalories: food.calories ?? 0,
              loggedProtein: food.protein ?? 0,
              loggedCarbs: food.carbs ?? 0,
              loggedFat: food.fat ?? 0,
              loggedFiber: food.fiber ?? 0,
              loggedMicros: food.micros,
            });

            const log = await database.get<NutritionLog>('nutrition_logs').create((record) => {
              record.foodId = food.id;
              record.date = dateTimestamp;
              record.type = mealType;
              record.amount = ingredient.grams;
              record.loggedFoodNameRaw = encrypted.loggedFoodName;
              record.loggedCaloriesRaw = encrypted.loggedCalories;
              record.loggedProteinRaw = encrypted.loggedProtein;
              record.loggedCarbsRaw = encrypted.loggedCarbs;
              record.loggedFatRaw = encrypted.loggedFat;
              record.loggedFiberRaw = encrypted.loggedFiber;
              record.loggedMicrosRaw = encrypted.loggedMicrosJson;
              record.createdAt = now;
              record.updatedAt = now;
            });
            createdLogs.push(log);
            continue;
          } catch (error) {
            console.warn(`[NutritionService] Could not find food with ID ${ingredient.foodId}, falling back to custom food creation.`);
          }
        }

        // Create a temporary food entry for each ingredient
        const tempFood = await database.get<Food>('foods').create((food) => {
          food.isAiGenerated = true;
          food.name = ingredient.name;
          food.brand = undefined;
          food.barcode = undefined;
          food.calories = (ingredient.calories / ingredient.grams) * 100; // Normalize to 100g
          food.protein = (ingredient.protein / ingredient.grams) * 100;
          food.carbs = (ingredient.carbs / ingredient.grams) * 100;
          food.fat = (ingredient.fat / ingredient.grams) * 100;
          food.fiber = ((ingredient.fiber ?? 0) / ingredient.grams) * 100;
          food.micros = {
            sugar: 0,
            sodium: 0,
          };
          food.isFavorite = false;
          food.createdAt = now;
          food.updatedAt = now;
        });

        // Create encrypted snapshot for the nutrition log
        const encrypted = await encryptNutritionLogSnapshot({
          loggedFoodName: ingredient.name,
          loggedCalories: ingredient.calories,
          loggedProtein: ingredient.protein,
          loggedCarbs: ingredient.carbs,
          loggedFat: ingredient.fat,
          loggedFiber: ingredient.fiber ?? 0,
          loggedMicros: {},
        });

        const log = await database.get<NutritionLog>('nutrition_logs').create((record) => {
          record.foodId = tempFood.id;
          record.date = dateTimestamp;
          record.type = mealType;
          record.amount = ingredient.grams;
          record.loggedFoodNameRaw = encrypted.loggedFoodName;
          record.loggedCaloriesRaw = encrypted.loggedCalories;
          record.loggedProteinRaw = encrypted.loggedProtein;
          record.loggedCarbsRaw = encrypted.loggedCarbs;
          record.loggedFatRaw = encrypted.loggedFat;
          record.loggedFiberRaw = encrypted.loggedFiber;
          record.loggedMicrosRaw = encrypted.loggedMicrosJson;
          record.createdAt = now;
          record.updatedAt = now;
        });

        createdLogs.push(log);
      }

      return createdLogs;
    });

    // Update widgets and Health Connect
    if (Platform.OS === 'android') {
      await requestNutritionWidgetUpdate();

      for (const log of logs) {
        try {
          const [nutrients, snapshot] = await Promise.all([
            log.getNutrients(),
            log.getDecryptedSnapshot(),
          ]);

          await writeNutritionLogToHealthConnect({
            logId: log.id,
            date: dateTimestamp,
            mealType,
            foodName: snapshot.loggedFoodName ?? '',
            calories: nutrients.calories,
            protein: nutrients.protein,
            carbs: nutrients.carbs,
            fat: nutrients.fat,
            fiber: nutrients.fiber,
          }).catch(() => undefined);
        } catch (error) {
          console.error('Error syncing log to Health Connect:', error);
        }
      }
    }

    return logs;
  }
}
