import { Q } from '@nozbe/watermelondb';
import convert from 'convert';

import { ProductV3 } from '../../types/openFoodFacts';
import { getProductName } from '../../utils/openFoodFactsMapper';
import { database } from '../index';
import Food, { type MicrosData } from '../models/Food';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';
import { FoodPortionService } from './FoodPortionService';

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
      micros?: MicrosData;
      isFavorite?: boolean;
    },
    customPortion?: FoodPortion | null,
    externalId?: string
  ): Promise<Food> {
    const defaultPortion =
      customPortion ?? (await FoodPortionService.createFoodPortion('100g', 100));

    return await database.write(async () => {
      const now = Date.now();

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = getProductName(product);
        food.brand = product.brands;
        food.barcode = product.code;
        food.externalId = externalId ?? product._id; // Use provided externalId or default to product.code
        food.imageUrl = product.image_url; // Save image URL from API
        food.description = (product as any).ingredients_text || undefined;

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
          ...nutritionData.micros,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = nutritionData.isFavorite ?? false;
        food.source = 'openfood';
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
   * Create a new food from USDA product details
   */
  static async createFromUSDAProduct(
    product: any,
    nutritionData: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      sugar?: number;
      saturatedFat?: number;
      sodium?: number;
      micros?: MicrosData;
      isFavorite?: boolean;
    },
    customPortion?: FoodPortion | null,
    externalId?: string
  ): Promise<Food> {
    const defaultPortion =
      customPortion ?? (await FoodPortionService.createFoodPortion('100g', 100));

    return await database.write(async () => {
      const now = Date.now();

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = product.description;
        food.brand = product.brandOwner || product.brandName;
        food.barcode = product.gtinUpc || String(product.fdcId);
        food.externalId = externalId ?? String(product.fdcId); // Use provided externalId or default to fdcId
        food.description = product.ingredients || undefined;

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
          ...nutritionData.micros,
        };

        food.micros = Object.fromEntries(
          Object.entries(micros).filter(([_, value]) => value !== undefined)
        );

        food.isFavorite = nutritionData.isFavorite ?? false;
        food.source = 'usda';
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
   * Create a food entry from a Musclog API product
   */
  static async createFromMusclogProduct(
    product: { name: string; brand?: string; [key: string]: any },
    nutritionData: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      isFavorite?: boolean;
    },
    barcode?: string
  ): Promise<Food> {
    const defaultPortion = await FoodPortionService.createFoodPortion('100g', 100);

    return await database.write(async () => {
      const now = Date.now();

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = product.name;
        food.brand = product.brand;
        food.barcode = barcode;
        food.externalId = barcode;

        food.calories = nutritionData.calories;
        food.protein = nutritionData.protein;
        food.carbs = nutritionData.carbs;
        food.fat = nutritionData.fat;
        food.fiber = nutritionData.fiber || 0;
        food.micros = {};
        food.isFavorite = nutritionData.isFavorite ?? false;
        food.source = 'musclog';
        food.createdAt = now;
        food.updatedAt = now;
      });

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
    servingUnit: string = 'g',
    description?: string
  ): Promise<Food> {
    // Convert serving amount to grams
    let gramWeight = servingAmount;
    if (servingUnit === 'oz') {
      gramWeight = convert(servingAmount, 'oz').to('g');
    } else if (servingUnit === 'ml') {
      // For ml, assume 1:1 with grams
      gramWeight = servingAmount;
    }
    // For 'g' or other units, assume gramWeight = servingAmount

    const portionName = servingAmount === 100 && servingUnit === 'g' ? '100g' : 'Default';
    const portion = await FoodPortionService.createFoodPortion(portionName, gramWeight);

    return await database.write(async () => {
      const now = Date.now();

      const food = await database.get<Food>('foods').create((food) => {
        food.isAiGenerated = false;
        food.name = name;
        food.brand = brand;
        food.description = description;

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
   * Get food by external ID (from external data integrations like USDA or Open Food Facts)
   */
  static async getFoodByExternalId(externalId: string): Promise<Food | null> {
    try {
      const foods = await database
        .get<Food>('foods')
        .query(Q.where('deleted_at', Q.eq(null)), Q.where('external_id', externalId))
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
      description?: string;
      externalId?: string;
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
        if (updates.description !== undefined) {
          record.description = updates.description;
        }
        if (updates.externalId !== undefined) {
          record.externalId = updates.externalId;
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
        food.description = originalFood.description;
        food.externalId = originalFood.externalId; // Copy external ID
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

  /**
   * Get all foundation foods (up to a limit)
   */
  static async getFoundationFoods(limit: number = 200): Promise<Food[]> {
    if (!database) {
      return [];
    }

    return await database
      .get<Food>('foods')
      .query(Q.where('source', 'foundation'), Q.where('deleted_at', Q.eq(null)), Q.take(limit))
      .fetch();
  }
}
