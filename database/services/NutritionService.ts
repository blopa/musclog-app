import { Q } from '@nozbe/watermelondb';
import { differenceInCalendarDays } from 'date-fns';
import { Platform } from 'react-native';

import { database } from '@/database';
import { encryptNutritionLogSnapshot } from '@/database/encryptionHelpers';
import Food from '@/database/models/Food';
import NutritionLog, { MealType } from '@/database/models/NutritionLog';
import { writeNutritionLogToHealthConnect } from '@/services/healthConnectNutrition';
import {
  localDayClosedRangeMaxMs,
  localDayStartFromUtcMs,
  localDayStartMs,
} from '@/utils/calendarDate';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';
import { widgetEvents } from '@/utils/widgetEvents';

function triggerWidgetUpdate(): void {
  widgetEvents.emitNutritionWidgetUpdate();
}

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

/**
 * Scale every log in the meal proportionally so combined gram weight matches `newTotalGrams`.
 * Top-level export avoids rare cases where a class static is missing on the runtime object.
 */
export async function scaleMealNutritionLogsToTotalGrams(
  entries: { log: NutritionLog; gramWeight: number }[],
  newTotalGrams: number
): Promise<void> {
  const totalGrams = entries.reduce((sum, e) => sum + e.gramWeight, 0);
  if (totalGrams <= 0) {
    throw new Error('Meal has no weight');
  }
  if (newTotalGrams <= 0) {
    throw new Error('Invalid target weight');
  }
  const ratio = newTotalGrams / totalGrams;

  const prepared = await Promise.all(
    entries.map(async ({ log, gramWeight }) => {
      const newGramWeight = gramWeight * ratio;
      let newAmount = newGramWeight;
      let portionId: string | undefined = log.portionId;

      if (log.portionId) {
        try {
          const portion = await log.portion;
          const pg = portion?.gramWeight;
          if (pg && pg > 0) {
            newAmount = roundToDecimalPlaces(newGramWeight / pg, 6);
          } else {
            portionId = undefined;
            newAmount = roundToDecimalPlaces(newGramWeight, 6);
          }
        } catch {
          portionId = undefined;
          newAmount = roundToDecimalPlaces(newGramWeight, 6);
        }
      } else {
        newAmount = roundToDecimalPlaces(newGramWeight, 6);
      }

      return { log, newAmount, portionId };
    })
  );

  await database.write(async () => {
    const now = Date.now();
    await database.batch(
      ...prepared.map(({ log, newAmount, portionId }) =>
        log.prepareUpdate((record) => {
          record.amount = newAmount;
          record.portionId = portionId;
          record.updatedAt = now;
        })
      )
    );
  });

  triggerWidgetUpdate();
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
    externalId?: string,
    groupId?: string,
    loggedMealName?: string
  ): Promise<NutritionLog> {
    const dateTimestamp = localDayStartMs(date);

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
        record.groupId = groupId;
        record.loggedMealName = loggedMealName;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });

    if (Platform.OS === 'android') {
      triggerWidgetUpdate();
    }

    // Health Connect / Apple Health (user-entered only — health-sourced records
    // already have externalId set and must not be written back to avoid an echo loop).
    if ((Platform.OS === 'android' || Platform.OS === 'ios') && !externalId) {
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

    return log;
  }

  /**
   * Get all nutrition logs for a specific date
   */
  static async getNutritionLogsForDate(date: Date): Promise<NutritionLog[]> {
    const dateTimestamp = localDayStartMs(date);
    const maxInclusive = localDayClosedRangeMaxMs(date);

    return await retryOnResetError(() =>
      database
        .get<NutritionLog>('nutrition_logs')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('date', Q.between(dateTimestamp, maxInclusive))
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
    const startTimestamp = localDayStartMs(startDate);
    const maxInclusive = localDayClosedRangeMaxMs(endDate);

    return await retryOnResetError(() =>
      database
        .get<NutritionLog>('nutrition_logs')
        .query(
          Q.where('deleted_at', Q.eq(null)),
          Q.where('date', Q.between(startTimestamp, maxInclusive))
        )
        .fetch()
    );
  }

  /**
   * Get nutrition logs for a specific meal type on a date
   */
  static async getNutritionLogsForMeal(date: Date, mealType: MealType): Promise<NutritionLog[]> {
    const dateTimestamp = localDayStartMs(date);
    const maxInclusive = localDayClosedRangeMaxMs(date);

    return await database
      .get<NutritionLog>('nutrition_logs')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.between(dateTimestamp, maxInclusive)),
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
    alcohol: number;
    byMealType: Record<
      MealType,
      {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        alcohol: number;
      }
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
        alcohol: 0,
        byMealType: {
          breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          snack: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          other: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
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
          totals.alcohol += nutrients.alcohol;

          totals.byMealType[mealType].calories += nutrients.calories;
          totals.byMealType[mealType].protein += nutrients.protein;
          totals.byMealType[mealType].carbs += nutrients.carbs;
          totals.byMealType[mealType].fat += nutrients.fat;
          totals.byMealType[mealType].fiber += nutrients.fiber;
          totals.byMealType[mealType].alcohol += nutrients.alcohol;
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
        alcohol: 0,
        byMealType: {
          breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          snack: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
          other: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
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

    const days = differenceInCalendarDays(endDate, startDate) + 1;

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

    triggerWidgetUpdate();

    return updatedLog;
  }

  /**
   * Delete nutrition log
   */
  static async deleteNutritionLog(id: string): Promise<void> {
    const log = await database.get<NutritionLog>('nutrition_logs').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await log.markAsDeleted();

    triggerWidgetUpdate();
  }

  /**
   * @see scaleMealNutritionLogsToTotalGrams
   */
  static async scaleNutritionLogsProportionalToTotalGrams(
    entries: { log: NutritionLog; gramWeight: number }[],
    newTotalGrams: number
  ): Promise<void> {
    return scaleMealNutritionLogsToTotalGrams(entries, newTotalGrams);
  }

  /**
   * Merge duplicate nutrition logs (same food) within a meal.
   * Updates the first log of each duplicate group with the combined gram weight,
   * clears its portionId so amount is interpreted as grams, then deletes the rest.
   */
  static async mergeDuplicateNutritionLogs(
    toUpdate: { log: NutritionLog; newAmount: number }[],
    toDelete: NutritionLog[]
  ): Promise<void> {
    const now = Date.now();
    await database.write(async () => {
      await database.batch(
        ...toUpdate.map(({ log, newAmount }) =>
          log.prepareUpdate((record) => {
            record.amount = newAmount;
            record.portionId = undefined;
            record.updatedAt = now;
          })
        ),
        ...toDelete.map((log) =>
          log.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        )
      );
    });

    triggerWidgetUpdate();
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

    triggerWidgetUpdate();
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
    const dateTimestamp = localDayStartMs(targetDate);

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
            record.groupId = log.groupId;
            record.loggedMealName = log.loggedMealName;
            record.createdAt = now;
            record.updatedAt = now;
          })
        )
      );
    });

    triggerWidgetUpdate();
  }

  /**
   * Move nutrition logs to a new date and/or meal type.
   */
  static async moveNutritionLogsToDate(
    logs: NutritionLog[],
    targetDate: Date,
    targetMealType: MealType
  ): Promise<void> {
    const dateTimestamp = localDayStartMs(targetDate);

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

    triggerWidgetUpdate();
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
    const dateTimestamp = localDayStartMs(targetDate);

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
            record.groupId = log.groupId;
            record.loggedMealName = log.loggedMealName;
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

    triggerWidgetUpdate();
  }

  /**
   * Get recent foods (for quick logging)
   */
  static async getRecentFoods(
    limit: number = 10,
    date?: Date,
    mealType?: MealType
  ): Promise<{ food: Food; lastGramWeight: number }[]> {
    // If a date is provided, limit recent logs to that date (today by default).
    let query = database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)));

    if (date) {
      const dateTimestamp = localDayStartMs(date);
      const maxInclusive = localDayClosedRangeMaxMs(date);
      query = query.extend(Q.where('date', Q.between(dateTimestamp, maxInclusive)));
    }

    if (mealType) {
      query = query.extend(Q.where('type', mealType));
    }

    // We take a larger batch to find unique food IDs up to the requested limit.
    const recentLogs = await query
      .extend(Q.sortBy('created_at', Q.desc), Q.take(limit * 5))
      .fetch();

    // Keep the most recent log per food ID (already sorted desc, so first occurrence wins).
    const mostRecentLogByFoodId = new Map<string, NutritionLog>();
    for (const log of recentLogs) {
      if (log.foodId && !mostRecentLogByFoodId.has(log.foodId)) {
        mostRecentLogByFoodId.set(log.foodId, log);
      }
    }

    const foodIds = [...mostRecentLogByFoodId.keys()].slice(0, limit);

    const settled = await Promise.all(
      foodIds.map(async (foodId) => {
        try {
          const food = await database.get<Food>('foods').find(foodId);
          if (food.deletedAt) {
            return null;
          }

          const log = mostRecentLogByFoodId.get(foodId)!;
          const lastGramWeight = await log.getGramWeight();
          return { food, lastGramWeight };
        } catch {
          // Food might have been deleted, skip
          return null;
        }
      })
    );

    return settled.filter((item): item is { food: Food; lastGramWeight: number } => item !== null);
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
      nutrients: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        alcohol: number;
      };
      gramWeight: number;
      displayName: string;
    }[]
  > {
    // If a date is provided, limit recent logs to that date (today by default).
    let query = database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)));

    if (date) {
      const dateTimestamp = localDayStartMs(date);
      const maxInclusive = localDayClosedRangeMaxMs(date);
      query = query.extend(Q.where('date', Q.between(dateTimestamp, maxInclusive)));
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

    const uniqueDayStarts = [
      ...new Set(logs.map((log) => localDayStartFromUtcMs(log.date ?? 0))),
    ].sort((a, b) => b - a);

    let streak = 0;
    const expectedStart = localDayStartMs(new Date());

    for (const dayStart of uniqueDayStarts) {
      const diff = differenceInCalendarDays(new Date(expectedStart), new Date(dayStart));
      if (diff === streak) {
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
        log.date = localDayStartFromUtcMs(originalLog.date);
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
    amount: number = 100, // Default to 100g for custom meals
    options?: { groupId?: string; loggedMealName?: string }
  ): Promise<NutritionLog> {
    const dateTimestamp = localDayStartMs(date);

    // If foodId is provided, log directly using the existing food
    if (mealData.foodId) {
      return await NutritionService.logFood(
        mealData.foodId,
        date,
        mealType,
        amount,
        undefined,
        undefined,
        options?.groupId,
        options?.loggedMealName
      );
    }

    const log = await database.write(async () => {
      const now = Date.now();

      // Normalize macros to 100g (convention for both Food model and snapshot)
      const normalizedCalories = (mealData.calories / amount) * 100;
      const normalizedProtein = (mealData.protein / amount) * 100;
      const normalizedCarbs = (mealData.carbs / amount) * 100;
      const normalizedFat = (mealData.fat / amount) * 100;
      const normalizedFiber = ((mealData.fiber ?? 0) / amount) * 100;

      // Create a temporary food entry for the AI-generated meal
      const tempFood = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = true;
        food.name = mealData.name;
        food.brand = undefined;
        food.barcode = undefined;
        food.calories = normalizedCalories;
        food.protein = normalizedProtein;
        food.carbs = normalizedCarbs;
        food.fat = normalizedFat;
        food.fiber = normalizedFiber;
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
        loggedCalories: normalizedCalories,
        loggedProtein: normalizedProtein,
        loggedCarbs: normalizedCarbs,
        loggedFat: normalizedFat,
        loggedFiber: normalizedFiber,
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
        record.groupId = options?.groupId;
        record.loggedMealName = options?.loggedMealName;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });

    if (Platform.OS === 'android') {
      triggerWidgetUpdate();
    }

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
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
    }

    return log;
  }

  /**
   * Normalize AI meal ingredients so that ingredients with a known foodId use
   * the database food's per-100g macros scaled to the ingredient's gram amount.
   * This ensures the chat preview total matches what will actually be logged.
   */
  static async normalizeAiMealIngredients<
    T extends {
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      grams: number;
      foodId?: string;
    },
  >(ingredients: T[]): Promise<T[]> {
    return Promise.all(
      ingredients.map(async (ingredient) => {
        if (!ingredient.foodId) {
          return ingredient;
        }
        try {
          const food = await database.get<Food>('foods').find(ingredient.foodId);
          const scale = ingredient.grams / 100;
          return {
            ...ingredient,
            kcal: roundToDecimalPlaces((food.calories ?? 0) * scale),
            protein: roundToDecimalPlaces((food.protein ?? 0) * scale),
            carbs: roundToDecimalPlaces((food.carbs ?? 0) * scale),
            fat: roundToDecimalPlaces((food.fat ?? 0) * scale),
            fiber: roundToDecimalPlaces((food.fiber ?? 0) * scale),
          };
        } catch {
          // Food not found — fall back to LLM values
          return ingredient;
        }
      })
    );
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
    mealType: MealType,
    options?: { groupId?: string; loggedMealName?: string }
  ): Promise<NutritionLog[]> {
    const dateTimestamp = localDayStartMs(date);
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
              record.groupId = options?.groupId;
              record.loggedMealName = options?.loggedMealName;
              record.createdAt = now;
              record.updatedAt = now;
            });
            createdLogs.push(log);
            continue;
          } catch (error) {
            console.warn(
              `[NutritionService] Could not find food with ID ${ingredient.foodId}, falling back to custom food creation.`
            );
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

        // Create encrypted snapshot for the nutrition log (convention is per 100g)
        const encrypted = await encryptNutritionLogSnapshot({
          loggedFoodName: ingredient.name,
          loggedCalories: (ingredient.calories / ingredient.grams) * 100,
          loggedProtein: (ingredient.protein / ingredient.grams) * 100,
          loggedCarbs: (ingredient.carbs / ingredient.grams) * 100,
          loggedFat: (ingredient.fat / ingredient.grams) * 100,
          loggedFiber: ((ingredient.fiber ?? 0) / ingredient.grams) * 100,
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
          record.groupId = options?.groupId;
          record.loggedMealName = options?.loggedMealName;
          record.createdAt = now;
          record.updatedAt = now;
        });

        createdLogs.push(log);
      }

      return createdLogs;
    });

    if (Platform.OS === 'android') {
      triggerWidgetUpdate();
    }

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
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
          console.error('Error syncing log to health platform:', error);
        }
      }
    }

    return logs;
  }
}
