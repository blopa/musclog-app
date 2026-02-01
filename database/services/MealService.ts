import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Food from '../models/Food';
import FoodPortion from '../models/FoodPortion';
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

      const foods = await meal.mealFoods.fetch();

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
        if (updates.name !== undefined) record.name = updates.name;
        if (updates.description !== undefined) record.description = updates.description;
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
    return await database.write(async () => {
      const mealFood = await database.get<MealFood>('meal_foods').find(mealFoodId);
      await mealFood.markAsDeleted();
    });
  }

  /**
   * Delete meal (soft delete)
   */
  static async deleteMeal(mealId: string): Promise<void> {
    return await database.write(async () => {
      const meal = await database.get<Meal>('meals').find(mealId);
      await meal.markAsDeleted();
    });
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
    return await database.write(async () => {
      const originalMeal = await database.get<Meal>('meals').find(mealId);

      if (originalMeal.deletedAt) {
        throw new Error('Cannot duplicate deleted meal');
      }

      const originalFoods = await originalMeal.mealFoods.fetch();

      // Create new meal
      const now = Date.now();
      const newMeal = await database.get<Meal>('meals').create((meal) => {
        meal.isAiGenerated = false;
        meal.name = newName || `${originalMeal.name} (Copy)`;
        meal.description = originalMeal.description;
        meal.isFavorite = false;
        meal.createdAt = now;
        meal.updatedAt = now;
      });

      // Copy all foods
      for (const mealFood of originalFoods) {
        if (!mealFood.deletedAt) {
          await database.get<MealFood>('meal_foods').create((newMealFood) => {
            newMealFood.mealId = newMeal.id;
            newMealFood.foodId = mealFood.foodId;
            newMealFood.amount = mealFood.amount;
            newMealFood.portionId = mealFood.portionId;
            newMealFood.createdAt = now;
            newMealFood.updatedAt = now;
          });
        }
      }

      return newMeal;
    });
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
    description?: string
  ): Promise<Meal> {
    return await database.write(async () => {
      const now = Date.now();

      // Create meal
      const meal = await database.get<Meal>('meals').create((mealRecord) => {
        mealRecord.isAiGenerated = false;
        mealRecord.name = name;
        mealRecord.description = description ?? '';
        mealRecord.isFavorite = false;
        mealRecord.createdAt = now;
        mealRecord.updatedAt = now;
      });

      // Add all foods to meal
      for (const foodItem of foodItems) {
        await database.get<MealFood>('meal_foods').create((mealFood) => {
          mealFood.mealId = meal.id;
          mealFood.foodId = foodItem.foodId;
          mealFood.amount = foodItem.amount;
          mealFood.portionId = foodItem.portionId;
          mealFood.createdAt = now;
          mealFood.updatedAt = now;
        });
      }

      return meal;
    });
  }

  /**
   * Get meal suggestions based on recent foods
   */
  static async getMealSuggestions(limit: number = 5): Promise<Meal[]> {
    // This is a simplified version - you could implement more sophisticated logic
    return await this.getAllMeals()
      .then((meals) => meals.filter((meal) => !meal.isFavorite))
      .then((meals) => meals.slice(0, limit));
  }
}
