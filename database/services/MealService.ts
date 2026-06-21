import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Meal from '@/database/models/Meal';
import MealFood from '@/database/models/MealFood';
import { handleError } from '@/utils/handleError';

import { REPAIR_DESCRIPTORS, retryAfterRepair } from './DatabaseRepairService';

export class MealService {
  private static validateMealFoodItems(
    foodItems: {
      foodId: string;
      amount: number;
      portionId?: string;
    }[]
  ): void {
    if (foodItems.length === 0) {
      throw new Error('Cannot save meal without any food items');
    }

    const invalidFoodItem = foodItems.find(
      (item) => !item.foodId || !Number.isFinite(item.amount) || item.amount <= 0
    );

    if (invalidFoodItem) {
      throw new Error(
        `Cannot save meal with invalid food item: foodId="${invalidFoodItem.foodId}", amount=${invalidFoodItem.amount}`
      );
    }
  }

  private static async assertMealHasExpectedFoods(
    mealId: string,
    expectedFoodCount: number,
    context: string
  ): Promise<void> {
    const savedMeal = await this.getMealWithFoods(mealId);

    if (!savedMeal) {
      throw new Error(`${context}: meal could not be reloaded after save`);
    }

    const actualFoodCount = savedMeal.foods.length;
    if (actualFoodCount === 0) {
      throw new Error(`${context}: meal was saved without any meal_food rows`);
    }

    if (actualFoodCount !== expectedFoodCount) {
      throw new Error(
        `${context}: expected ${expectedFoodCount} meal_food rows but found ${actualFoodCount}`
      );
    }
  }

  /**
   * Create a new meal
   */
  static async createMeal(
    name: string,
    description?: string,
    preparedWeightGrams?: number,
    options?: {
      nutritionBasis?: 'per_recipe' | 'per_serving' | 'per_gram';
      recipeServingsCount?: number;
      defaultPortionName?: string;
      servingGrams?: number;
      imageUrl?: string;
    }
  ): Promise<Meal> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<Meal>('meals').create((meal) => {
        meal.isAiGenerated = false;
        meal.name = name;
        meal.description = description ?? '';
        meal.imageUrl = options?.imageUrl;
        meal.isFavorite = false;
        meal.preparedWeightGrams = preparedWeightGrams;
        meal.nutritionBasis = options?.nutritionBasis ?? 'per_recipe';
        meal.recipeServingsCount = options?.recipeServingsCount ?? 1;
        meal.defaultPortionName = options?.defaultPortionName;
        meal.servingGrams = options?.servingGrams;
        meal.createdAt = now;
        meal.updatedAt = now;
      });
    });
  }

  /**
   * Add food to meal
   */
  static async addFoodToMeal(
    mealId: string,
    foodId: string,
    amount: number,
    portionId?: string
  ): Promise<MealFood> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<MealFood>('meal_foods').create((mealFood) => {
        mealFood.mealId = mealId;
        mealFood.foodId = foodId;
        mealFood.amount = amount;
        mealFood.portionId = portionId;
        mealFood.createdAt = now;
        mealFood.updatedAt = now;
      });
    });
  }

  /**
   * Get all meals (non-deleted)
   */
  static async getAllMeals(): Promise<Meal[]> {
    return this.getAllMealsInternal();
  }

  private static async getAllMealsInternal(repairAttempted = false): Promise<Meal[]> {
    try {
      return await database
        .get<Meal>('meals')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch();
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.meals, () =>
          this.getAllMealsInternal(true)
        );
        if (repaired) {
          return repaired;
        }
      }
      throw error;
    }
  }

  /**
   * Get meals with pagination (for Manage Meal Data modal).
   * Ordered by created_at desc. Most recent first.
   */
  static async getMealsPaginated(limit: number, offset: number): Promise<Meal[]> {
    let query = database
      .get<Meal>('meals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));

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
   * Get favorite meals
   */
  static async getFavoriteMeals(): Promise<Meal[]> {
    return await database
      .get<Meal>('meals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_favorite', true))
      .fetch();
  }

  /**
   * Search meals by name
   */
  static async searchMeals(searchTerm: string): Promise<Meal[]> {
    return await database
      .get<Meal>('meals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', Q.like(`%${searchTerm}%`)))
      .fetch();
  }

  /**
   * Get meal by ID with foods
   */
  static async getMealImageUrl(mealId: string): Promise<string | undefined> {
    try {
      const meal = await database.get<Meal>('meals').find(mealId);
      if (meal.deletedAt) {
        return undefined;
      }

      return meal.imageUrl ?? undefined;
    } catch {
      return undefined;
    }
  }

  static async getMealWithFoods(mealId: string): Promise<{ meal: Meal; foods: MealFood[] } | null> {
    return this.getMealWithFoodsInternal(mealId);
  }

  private static async getMealWithFoodsInternal(
    mealId: string,
    repairAttempted = false
  ): Promise<{ meal: Meal; foods: MealFood[] } | null> {
    try {
      const meal = await database.get<Meal>('meals').find(mealId);

      if (meal.deletedAt) {
        return null;
      }

      const allFoods = await meal.mealFoods.fetch();
      const foods = allFoods.filter((f) => !f.deletedAt);

      return { meal, foods };
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await retryAfterRepair(error, REPAIR_DESCRIPTORS.meals, () =>
          this.getMealWithFoodsInternal(mealId, true)
        );

        if (repaired !== undefined) {
          return repaired;
        }
      }
      await handleError(error, 'MealService.getMealWithFoods', {
        showSnackbar: false,
      });

      return null;
    }
  }

  /**
   * Update meal
   */
  static async updateMeal(
    mealId: string,
    updates: {
      name?: string;
      description?: string;
      preparedWeightGrams?: number | null;
      imageUrl?: string | null;
      nutritionBasis?: 'per_recipe' | 'per_serving' | 'per_gram';
      recipeServingsCount?: number | null;
      defaultPortionName?: string | null;
      servingGrams?: number | null;
    }
  ): Promise<Meal> {
    return await database.write(async () => {
      const meal = await database.get<Meal>('meals').find(mealId);

      if (meal.deletedAt) {
        throw new Error('Cannot update deleted meal');
      }

      await meal.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }

        if (updates.description !== undefined) {
          record.description = updates.description;
        }

        if ('imageUrl' in updates) {
          record.imageUrl = updates.imageUrl ?? undefined;
        }

        if ('preparedWeightGrams' in updates) {
          record.preparedWeightGrams = updates.preparedWeightGrams ?? undefined;
        }

        if ('nutritionBasis' in updates && updates.nutritionBasis !== undefined) {
          record.nutritionBasis = updates.nutritionBasis;
        }

        if ('recipeServingsCount' in updates) {
          record.recipeServingsCount = updates.recipeServingsCount ?? undefined;
        }

        if ('defaultPortionName' in updates) {
          record.defaultPortionName = updates.defaultPortionName ?? undefined;
        }

        if ('servingGrams' in updates) {
          record.servingGrams = updates.servingGrams ?? undefined;
        }

        record.updatedAt = Date.now();
      });

      return meal;
    });
  }

  /**
   * Update meal food amount
   */
  static async updateMealFoodAmount(mealFoodId: string, amount: number): Promise<MealFood> {
    // Keep the deleted-state guard and the write in one transaction so the row can't be
    // deleted between the check and the update. `MealFood.updateAmount` is a @writer, so it
    // must join this transaction via callWriter rather than nest a new one (which would stall).
    return await database.write(async (writer) => {
      const mealFood = await database.get<MealFood>('meal_foods').find(mealFoodId);

      if (mealFood.deletedAt) {
        throw new Error('Cannot update deleted meal food');
      }

      await writer.callWriter(() => mealFood.updateAmount(amount));

      return mealFood;
    });
  }

  /**
   * Remove food from meal
   */
  static async removeFoodFromMeal(mealFoodId: string): Promise<void> {
    const mealFood = await database.get<MealFood>('meal_foods').find(mealFoodId);
    await mealFood.markAsDeleted();
  }

  /**
   * Delete meal (soft delete)
   */
  static async deleteMeal(mealId: string): Promise<void> {
    const meal = await database.get<Meal>('meals').find(mealId);
    await meal.markAsDeleted();
  }

  /**
   * Toggle meal favorite status
   */
  static async toggleMealFavorite(mealId: string): Promise<Meal> {
    // `Meal.toggleFavorite` is a @writer (opens its own transaction); calling it
    // inside database.write() would nest writers and stall the queue.
    const meal = await database.get<Meal>('meals').find(mealId);
    await meal.toggleFavorite();
    return meal;
  }

  /**
   * Duplicate meal (create a copy)
   */
  static async duplicateMeal(mealId: string, newName?: string): Promise<Meal> {
    const originalMeal = await database.get<Meal>('meals').find(mealId);

    if (originalMeal.deletedAt) {
      throw new Error('Cannot duplicate deleted meal');
    }

    const originalFoods = await originalMeal.mealFoods.fetch();
    const now = Date.now();
    const mealCollection = database.get<Meal>('meals');
    const mealFoodCollection = database.get<MealFood>('meal_foods');

    const newMeal = mealCollection.prepareCreate((meal) => {
      meal.isAiGenerated = false;
      meal.name = newName || `${originalMeal.name} (Copy)`;
      meal.description = originalMeal.description;
      meal.isFavorite = false;
      meal.preparedWeightGrams = originalMeal.preparedWeightGrams;
      meal.nutritionBasis = originalMeal.nutritionBasis;
      meal.recipeServingsCount = originalMeal.recipeServingsCount;
      meal.defaultPortionName = originalMeal.defaultPortionName;
      meal.servingGrams = originalMeal.servingGrams;
      meal.createdAt = now;
      meal.updatedAt = now;
    });

    const newMealFoods = originalFoods
      .filter((mf) => !mf.deletedAt)
      .map((mf) =>
        mealFoodCollection.prepareCreate((newMealFood) => {
          newMealFood.mealId = newMeal.id;
          newMealFood.foodId = mf.foodId;
          newMealFood.amount = mf.amount;
          newMealFood.portionId = mf.portionId;
          newMealFood.createdAt = now;
          newMealFood.updatedAt = now;
        })
      );

    await database.write(async () => {
      await database.batch(newMeal, ...newMealFoods);
    });
    return newMeal;
  }

  /**
   * Create a meal from a collection of foods
   */
  static async createMealFromFoods(
    name: string,
    foodItems: {
      foodId: string;
      amount: number;
      portionId?: string;
    }[],
    description?: string,
    isAiGenerated = false,
    preparedWeightGrams?: number,
    options?: {
      nutritionBasis?: 'per_recipe' | 'per_serving' | 'per_gram';
      recipeServingsCount?: number;
      defaultPortionName?: string;
      servingGrams?: number;
      imageUrl?: string;
    }
  ): Promise<Meal> {
    this.validateMealFoodItems(foodItems);

    const now = Date.now();
    const mealCollection = database.get<Meal>('meals');
    const mealFoodCollection = database.get<MealFood>('meal_foods');

    const meal = mealCollection.prepareCreate((mealRecord) => {
      mealRecord.isAiGenerated = isAiGenerated;
      mealRecord.name = name;
      mealRecord.description = description ?? '';
      mealRecord.imageUrl = options?.imageUrl;
      mealRecord.isFavorite = false;
      mealRecord.preparedWeightGrams = preparedWeightGrams;
      mealRecord.nutritionBasis = options?.nutritionBasis ?? 'per_recipe';
      mealRecord.recipeServingsCount = options?.recipeServingsCount ?? 1;
      mealRecord.defaultPortionName = options?.defaultPortionName;
      mealRecord.servingGrams = options?.servingGrams;
      mealRecord.createdAt = now;
      mealRecord.updatedAt = now;
    });

    const mealFoods = foodItems.map((foodItem) =>
      mealFoodCollection.prepareCreate((mealFood) => {
        mealFood.mealId = meal.id;
        mealFood.foodId = foodItem.foodId;
        mealFood.amount = foodItem.amount;
        mealFood.portionId = foodItem.portionId;
        mealFood.createdAt = now;
        mealFood.updatedAt = now;
      })
    );

    await database.write(async () => {
      await database.batch(meal, ...mealFoods);
    });

    await this.assertMealHasExpectedFoods(
      meal.id,
      foodItems.length,
      'MealService.createMealFromFoods'
    );

    return meal;
  }

  /**
   * Get meal suggestions based on recent foods
   */
  static async getMealSuggestions(limit: number = 5): Promise<Meal[]> {
    // TODO: Implement more sophisticated meal suggestion logic (e.g. based on recent foods, preferences)
    return await this.getAllMeals()
      .then((meals) => meals.filter((meal) => !meal.isFavorite))
      .then((meals) => meals.slice(0, limit));
  }
}
