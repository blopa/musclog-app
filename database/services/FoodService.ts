import { Q } from '@nozbe/watermelondb';
import convert from 'convert';

import { ProductV3 } from '../../types/openFoodFacts';
import { database } from '../index';
import Food from '../models/Food';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';

export class FoodService {
  /**
   * Create a new food from V3 product details
   */
  static async createFromV3Product(
    product: ProductV3,
    nutritionData: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
      saturatedFat?: number;
      sodium?: number;
      isFavorite?: boolean;
    },
    customPortion?: FoodPortion | null
  ): Promise<Food> {
    return await database.write(async () => {
      const now = Date.now();

      // Use custom portion if provided, otherwise find or create "100g" portion
      let defaultPortion: FoodPortion;

      if (customPortion) {
        defaultPortion = customPortion;
      } else {
        // Find or create a "100g" portion (global, reusable)
        const existingPortion = await database
          .get<FoodPortion>('food_portions')
          .query(Q.where('name', '100g'), Q.where('gram_weight', 100))
          .fetch();

        defaultPortion =
          existingPortion.length > 0
            ? existingPortion[0]
            : await database.get<FoodPortion>('food_portions').create((portion) => {
                portion.name = '100g';
                portion.gramWeight = 100;
                portion.createdAt = now;
                portion.updatedAt = now;
              });
      }

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = product.product_name || 'Unknown Product';
        food.brand = product.brands;
        food.barcode = product.code;
        food.imageUrl = product.image_url; // Save image URL from API

        food.calories = nutritionData.calories;
        food.protein = nutritionData.protein;
        food.carbs = nutritionData.carbs;
        food.fat = nutritionData.fat;
        food.fiber = nutritionData.fiber || 0;

        // Store micros
        const micros = {
          sugar: nutritionData.sugar,
          saturatedFat: nutritionData.saturatedFat,
          sodium: nutritionData.sodium,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = nutritionData.isFavorite ?? false;
        food.source = 'api';
        food.createdAt = now;
        food.updatedAt = now;
      });

      // Link food to the default portion
      await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
        ffp.foodId = food.id;
        ffp.foodPortionId = defaultPortion.id;
        ffp.isDefault = true;
        ffp.createdAt = now;
        ffp.updatedAt = now;
      });

      return food;
    });
  }

  /**
   * Create a custom food (user-entered)
   */
  static async createCustomFood(
    name: string,
    nutritionData: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
      saturatedFat?: number;
      sodium?: number;
    },
    brand?: string,
    servingAmount: number = 100,
    servingUnit: string = 'g'
  ): Promise<Food> {
    return await database.write(async () => {
      const now = Date.now();

      // Convert serving amount to grams
      let gramWeight = servingAmount;
      if (servingUnit === 'oz') {
        gramWeight = convert(servingAmount, 'oz').to('g');
      } else if (servingUnit === 'ml') {
        // For ml, assume 1:1 with grams
        gramWeight = servingAmount;
      }
      // For 'g' or other units, assume gramWeight = servingAmount

      // Create portion label
      const portionName = servingAmount === 100 && servingUnit === 'g' ? '100g' : 'Default';

      // Create a new portion for this food's serving amount (global, can be reused)
      const portion = await database.get<FoodPortion>('food_portions').create((p) => {
        p.name = portionName;
        p.gramWeight = gramWeight;
        p.createdAt = now;
        p.updatedAt = now;
      });

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = name;
        food.brand = brand;

        food.calories = nutritionData.calories;
        food.protein = nutritionData.protein;
        food.carbs = nutritionData.carbs;
        food.fat = nutritionData.fat;
        food.fiber = nutritionData.fiber || 0;

        // Store micros
        const micros = {
          sugar: nutritionData.sugar,
          saturatedFat: nutritionData.saturatedFat,
          sodium: nutritionData.sodium,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = false;
        food.source = 'user';
        food.createdAt = now;
        food.updatedAt = now;
      });

      // Link food to the portion as default
      await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
        ffp.foodId = food.id;
        ffp.foodPortionId = portion.id;
        ffp.isDefault = true;
        ffp.createdAt = now;
        ffp.updatedAt = now;
      });

      return food;
    });
  }

  /**
   * Get all foods (non-deleted)
   */
  static async getAllFoods(): Promise<Food[]> {
    if (!database) {
      return [];
    }

    return await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /**
   * Get foods with pagination (for food library modal), most recent first
   */
  static async getFoodsPaginated(limit: number, offset: number): Promise<Food[]> {
    if (!database) {
      return [];
    }

    let query = database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));

    if (offset > 0) {
      query = query.extend(Q.skip(offset), Q.take(limit));
    } else {
      query = query.extend(Q.take(limit));
    }

    return await query.fetch();
  }

  /**
   * Get favorite foods
   */
  static async getFavoriteFoods(): Promise<Food[]> {
    if (!database) {
      return [];
    }

    return await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_favorite', true))
      .fetch();
  }

  /**
   * Search foods by name
   */
  static async searchFoods(searchTerm: string): Promise<Food[]> {
    if (!database) {
      return [];
    }

    return await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', Q.like(`%${searchTerm}%`)))
      .fetch();
  }

  /**
   * Get food by barcode
   */
  static async getFoodByBarcode(barcode: string): Promise<Food | null> {
    try {
      const foods = await database
        .get<Food>('foods')
        .query(Q.where('deleted_at', Q.eq(null)), Q.where('barcode', barcode))
        .fetch();

      return foods.length > 0 ? foods[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get food by ID
   */
  static async getFoodById(id: string): Promise<Food | null> {
    try {
      const food = await database.get<Food>('foods').find(id);
      return food.deletedAt ? null : food;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update food
   */
  static async updateFood(
    id: string,
    updates: {
      name?: string;
      brand?: string;
      barcode?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      micros?: any;
    }
  ): Promise<Food> {
    return await database.write(async () => {
      const food = await database.get<Food>('foods').find(id);

      if (food.deletedAt) {
        throw new Error('Cannot update deleted food');
      }

      await food.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }
        if (updates.brand !== undefined) {
          record.brand = updates.brand;
        }
        if (updates.barcode !== undefined) {
          record.barcode = updates.barcode;
        }
        if (updates.calories !== undefined) {
          record.calories = updates.calories;
        }
        if (updates.protein !== undefined) {
          record.protein = updates.protein;
        }
        if (updates.carbs !== undefined) {
          record.carbs = updates.carbs;
        }
        if (updates.fat !== undefined) {
          record.fat = updates.fat;
        }
        if (updates.fiber !== undefined) {
          record.fiber = updates.fiber;
        }
        if (updates.micros !== undefined) {
          record.micros = updates.micros;
        }
        record.updatedAt = Date.now();
      });

      return food;
    });
  }

  /**
   * Delete food (soft delete)
   */
  static async deleteFood(id: string): Promise<void> {
    const food = await database.get<Food>('foods').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await food.markAsDeleted();
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(id: string): Promise<Food> {
    return await database.write(async () => {
      const food = await database.get<Food>('foods').find(id);
      await food.toggleFavorite();
      return food;
    });
  }

  /**
   * Duplicate food (create a copy with all portions)
   */
  static async duplicateFood(id: string): Promise<Food> {
    return await database.write(async () => {
      const originalFood = await database.get<Food>('foods').find(id);

      if (originalFood.deletedAt) {
        throw new Error('Cannot duplicate deleted food');
      }

      const now = Date.now();

      // Get all portions associated with this food
      const foodPortions = await database
        .get<FoodFoodPortion>('food_food_portions')
        .query(Q.where('food_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      // Create new food with "(Copy)" suffix
      const newFood = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = originalFood.isAiGenerated;
        food.name = `${originalFood.name} (Copy)`;
        food.brand = originalFood.brand;
        food.barcode = originalFood.barcode;
        food.imageUrl = originalFood.imageUrl;
        food.calories = originalFood.calories;
        food.protein = originalFood.protein;
        food.carbs = originalFood.carbs;
        food.fat = originalFood.fat;
        food.fiber = originalFood.fiber;
        food.micros = originalFood.micros;
        food.isFavorite = false; // New copy is not favorite by default
        food.source = originalFood.source;
        food.createdAt = now;
        food.updatedAt = now;
      });

      // Copy all portion relationships
      for (const ffp of foodPortions) {
        await database.get<FoodFoodPortion>('food_food_portions').create((newFfp) => {
          newFfp.foodId = newFood.id;
          newFfp.foodPortionId = ffp.foodPortionId;
          newFfp.isDefault = ffp.isDefault;
          newFfp.createdAt = now;
          newFfp.updatedAt = now;
        });
      }

      return newFood;
    });
  }
}
