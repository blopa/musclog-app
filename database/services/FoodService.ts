import { database } from '../index';
import Food from '../models/Food';
import { Q } from '@nozbe/watermelondb';
import { ProductV3 } from '../../types/openFoodFacts';

export class FoodService {
  /**
   * Create a new food from search result
   */

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
      sugars?: number;
      saturatedFat?: number;
      sodium?: number;
      salt?: number;
    }
  ): Promise<Food> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = product.product_name || 'Unknown Product';
        food.brand = product.brands;
        food.barcode = product.code;

        food.calories = nutritionData.calories;
        food.protein = nutritionData.protein;
        food.carbs = nutritionData.carbs;
        food.fat = nutritionData.fat;
        food.fiber = nutritionData.fiber || 0;

        food.servingUnit = 'g';
        food.servingAmount = 100;

        // Store micros
        const micros = {
          sugars: nutritionData.sugars,
          saturatedFat: nutritionData.saturatedFat,
          sodium: nutritionData.sodium,
          salt: nutritionData.salt,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = false;
        food.source = 'api';
        food.createdAt = now;
        food.updatedAt = now;
      });
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
      sugars?: number;
      saturatedFat?: number;
      sodium?: number;
      salt?: number;
    },
    brand?: string,
    servingAmount: number = 100,
    servingUnit: string = 'g'
  ): Promise<Food> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = name;
        food.brand = brand;

        food.calories = nutritionData.calories;
        food.protein = nutritionData.protein;
        food.carbs = nutritionData.carbs;
        food.fat = nutritionData.fat;
        food.fiber = nutritionData.fiber || 0;

        food.servingUnit = servingUnit;
        food.servingAmount = servingAmount;

        // Store micros
        const micros = {
          sugars: nutritionData.sugars,
          saturatedFat: nutritionData.saturatedFat,
          sodium: nutritionData.sodium,
          salt: nutritionData.salt,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = false;
        food.source = 'user';
        food.createdAt = now;
        food.updatedAt = now;
      });
    });
  }

  /**
   * Get all foods (non-deleted)
   */
  static async getAllFoods(): Promise<Food[]> {
    return await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /**
   * Get favorite foods
   */
  static async getFavoriteFoods(): Promise<Food[]> {
    return await database
      .get<Food>('foods')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('is_favorite', true))
      .fetch();
  }

  /**
   * Search foods by name
   */
  static async searchFoods(searchTerm: string): Promise<Food[]> {
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
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
      servingAmount?: number;
      servingUnit?: string;
      micros?: any;
    }
  ): Promise<Food> {
    return await database.write(async () => {
      const food = await database.get<Food>('foods').find(id);

      if (food.deletedAt) {
        throw new Error('Cannot update deleted food');
      }

      await food.update((record) => {
        if (updates.name !== undefined) record.name = updates.name;
        if (updates.brand !== undefined) record.brand = updates.brand;
        if (updates.calories !== undefined) record.calories = updates.calories;
        if (updates.protein !== undefined) record.protein = updates.protein;
        if (updates.carbs !== undefined) record.carbs = updates.carbs;
        if (updates.fat !== undefined) record.fat = updates.fat;
        if (updates.fiber !== undefined) record.fiber = updates.fiber;
        if (updates.servingAmount !== undefined) record.servingAmount = updates.servingAmount;
        if (updates.servingUnit !== undefined) record.servingUnit = updates.servingUnit;
        if (updates.micros !== undefined) record.micros = updates.micros;
        record.updatedAt = Date.now();
      });

      return food;
    });
  }

  /**
   * Delete food (soft delete)
   */
  static async deleteFood(id: string): Promise<void> {
    return await database.write(async () => {
      const food = await database.get<Food>('foods').find(id);
      await food.markAsDeleted();
    });
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
}
