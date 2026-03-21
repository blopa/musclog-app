import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Meal from '../models/Meal';
import MealFood from '../models/MealFood';

export class MealService {
  /**
   * Create a new meal
   */
  static async createMeal(name: string, description?: string): Promise<Meal> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<Meal>('meals').create((meal) => {
        meal.isAiGenerated = false;
        meal.name = name;
        meal.description = description ?? '';
        meal.isFavorite = false;
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
    return await database
      .get<Meal>('meals')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
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
  static async getMealWithFoods(mealId: string): Promise<{ meal: Meal; foods: MealFood[] } | null> {
    try {
      const meal = await database.get<Meal>('meals').find(mealId);

      if (meal.deletedAt) {
        return null;
      }

      const allFoods = await meal.mealFoods.fetch();
      const foods = allFoods.filter((f) => !f.deletedAt);

      return { meal, foods };
    } catch (error) {
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
        record.updatedAt = Date.now();
      });

      return meal;
    });
  }

  /**
   * Update meal food amount
   */
  static async updateMealFoodAmount(mealFoodId: string, amount: number): Promise<MealFood> {
    return await database.write(async () => {
      const mealFood = await database.get<MealFood>('meal_foods').find(mealFoodId);

      if (mealFood.deletedAt) {
        throw new Error('Cannot update deleted meal food');
      }

      await mealFood.updateAmount(amount);

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
    return await database.write(async () => {
      const meal = await database.get<Meal>('meals').find(mealId);
      await meal.toggleFavorite();
      return meal;
    });
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
    isAiGenerated = false
  ): Promise<Meal> {
    const now = Date.now();
    const mealCollection = database.get<Meal>('meals');
    const mealFoodCollection = database.get<MealFood>('meal_foods');

    const meal = mealCollection.prepareCreate((mealRecord) => {
      mealRecord.isAiGenerated = isAiGenerated;
      mealRecord.name = name;
      mealRecord.description = description ?? '';
      mealRecord.isFavorite = false;
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
