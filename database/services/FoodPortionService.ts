import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Food from '../models/Food';
import FoodPortion from '../models/FoodPortion';

export class FoodPortionService {
  /**
   * Create a new food portion
   */
  static async createFoodPortion(
    foodId: string,
    name: string,
    gramWeight: number
  ): Promise<FoodPortion> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.foodId = foodId;
        portion.name = name;
        portion.gramWeight = gramWeight;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }

  /**
   * Get all portions for a food
   */
  static async getFoodPortions(foodId: string): Promise<FoodPortion[]> {
    return await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('food_id', foodId))
      .fetch();
  }

  /**
   * Get portion by ID
   */
  static async getPortionById(id: string): Promise<FoodPortion | null> {
    try {
      const portion = await database.get<FoodPortion>('food_portions').find(id);
      return portion.deletedAt ? null : portion;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update food portion
   */
  static async updateFoodPortion(
    id: string,
    updates: {
      name?: string;
      gramWeight?: number;
    }
  ): Promise<FoodPortion> {
    return await database.write(async () => {
      const portion = await database.get<FoodPortion>('food_portions').find(id);

      if (portion.deletedAt) {
        throw new Error('Cannot update deleted food portion');
      }

      await portion.update((record) => {
        if (updates.name !== undefined) record.name = updates.name;
        if (updates.gramWeight !== undefined) record.gramWeight = updates.gramWeight;
        record.updatedAt = Date.now();
      });

      return portion;
    });
  }

  /**
   * Delete food portion
   */
  static async deleteFoodPortion(id: string): Promise<void> {
    return await database.write(async () => {
      const portion = await database.get<FoodPortion>('food_portions').find(id);
      await portion.markAsDeleted();
    });
  }

  /**
   * Create common portions for a food
   */
  static async createCommonPortions(foodId: string): Promise<FoodPortion[]> {
    const food = await database.get<Food>('foods').find(foodId);
    const portions: FoodPortion[] = [];

    // Common portion sizes based on food type
    const commonPortions = this.getCommonPortionsForFoodType(
      food.name ?? '',
      food.servingUnit ?? ''
    );

    return await database.write(async () => {
      const now = Date.now();

      for (const portion of commonPortions) {
        const newPortion = await database.get<FoodPortion>('food_portions').create((p) => {
          p.foodId = foodId;
          p.name = portion.name;
          p.gramWeight = portion.gramWeight;
          p.createdAt = now;
          p.updatedAt = now;
        });

        portions.push(newPortion);
      }

      return portions;
    });
  }

  /**
   * Get common portions based on food name and serving unit
   */
  private static getCommonPortionsForFoodType(
    foodName: string,
    servingUnit: string
  ): { name: string; gramWeight: number }[] {
    const name = foodName.toLowerCase();
    const portions: { name: string; gramWeight: number }[] = [];

    // Common portions for different food types
    if (name.includes('bread') || name.includes('slice')) {
      portions.push({ name: 'Slice', gramWeight: 25 });
      portions.push({ name: '2 Slices', gramWeight: 50 });
    }

    if (name.includes('rice') || name.includes('pasta')) {
      portions.push({ name: '1 Cup (cooked)', gramWeight: 158 });
      portions.push({ name: '1/2 Cup (cooked)', gramWeight: 79 });
    }

    if (name.includes('chicken') || name.includes('meat') || name.includes('fish')) {
      portions.push({ name: '3 oz', gramWeight: 85 });
      portions.push({ name: '4 oz', gramWeight: 113 });
      portions.push({ name: '6 oz', gramWeight: 170 });
    }

    if (name.includes('egg')) {
      portions.push({ name: '1 Large', gramWeight: 50 });
      portions.push({ name: '2 Large', gramWeight: 100 });
    }

    if (name.includes('milk') || name.includes('juice') || name.includes('water')) {
      portions.push({ name: '1 Cup', gramWeight: 240 });
      portions.push({ name: '1/2 Cup', gramWeight: 120 });
      portions.push({ name: '1 Glass', gramWeight: 200 });
    }

    if (name.includes('cheese')) {
      portions.push({ name: '1 Slice', gramWeight: 20 });
      portions.push({ name: '1 oz', gramWeight: 28 });
    }

    if (name.includes('banana')) {
      portions.push({ name: '1 Small', gramWeight: 90 });
      portions.push({ name: '1 Medium', gramWeight: 118 });
      portions.push({ name: '1 Large', gramWeight: 136 });
    }

    if (name.includes('apple')) {
      portions.push({ name: '1 Small', gramWeight: 149 });
      portions.push({ name: '1 Medium', gramWeight: 182 });
      portions.push({ name: '1 Large', gramWeight: 223 });
    }

    // Add some generic portions if no specific ones were added
    if (portions.length === 0) {
      if (servingUnit === 'g') {
        portions.push({ name: '25g', gramWeight: 25 });
        portions.push({ name: '50g', gramWeight: 50 });
        portions.push({ name: '100g', gramWeight: 100 });
      } else if (servingUnit === 'ml') {
        portions.push({ name: '100ml', gramWeight: 100 });
        portions.push({ name: '200ml', gramWeight: 200 });
        portions.push({ name: '250ml', gramWeight: 250 });
      }
    }

    return portions;
  }

  /**
   * Get all portions across all foods (for management)
   */
  static async getAllPortions(): Promise<FoodPortion[]> {
    return await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  /**
   * Search portions by name
   */
  static async searchPortions(searchTerm: string): Promise<FoodPortion[]> {
    return await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', Q.like(`%${searchTerm}%`)))
      .fetch();
  }

  /**
   * Bulk create portions for multiple foods
   */
  static async bulkCreatePortions(
    foodPortions: {
      foodId: string;
      name: string;
      gramWeight: number;
    }[]
  ): Promise<FoodPortion[]> {
    return await database.write(async () => {
      const now = Date.now();
      const createdPortions: FoodPortion[] = [];

      for (const portionData of foodPortions) {
        const portion = await database.get<FoodPortion>('food_portions').create((p) => {
          p.foodId = portionData.foodId;
          p.name = portionData.name;
          p.gramWeight = portionData.gramWeight;
          p.createdAt = now;
          p.updatedAt = now;
        });

        createdPortions.push(portion);
      }

      return createdPortions;
    });
  }
}
