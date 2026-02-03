import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import FoodPortion from '../models/FoodPortion';

export class FoodPortionService {
  /**
   * Create a new global portion (not tied to any specific food)
   */
  static async createFoodPortion(name: string, gramWeight: number): Promise<FoodPortion> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = name;
        portion.gramWeight = gramWeight;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }

  /**
   * Get or create a portion by name and gram weight
   * Returns existing portion if found, creates new one if not
   */
  static async getOrCreatePortion(name: string, gramWeight: number): Promise<FoodPortion> {
    // Try to find existing portion with same name and gram weight
    const existing = await database
      .get<FoodPortion>('food_portions')
      .query(
        Q.where('name', name),
        Q.where('gram_weight', gramWeight),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new portion
    return this.createFoodPortion(name, gramWeight);
  }

  /**
   * Get all global portions (not deleted)
   */
  static async getAllPortions(): Promise<FoodPortion[]> {
    return await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('deleted_at', Q.eq(null)))
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
   * Create common portions for a food type
   * Returns array of global portion definitions
   */
  static async createCommonPortions(): Promise<FoodPortion[]> {
    const portions: FoodPortion[] = [];

    // Standard portions (global, not tied to any specific food)
    const commonPortions = [
      { name: 'Slice', gramWeight: 25 },
      { name: '2 Slices', gramWeight: 50 },
      { name: 'Cup', gramWeight: 240 },
      { name: 'Tbsp', gramWeight: 15 },
      { name: 'Tsp', gramWeight: 5 },
      { name: 'Oz', gramWeight: 28.35 },
      { name: '100g', gramWeight: 100 },
      { name: '50g', gramWeight: 50 },
      { name: '200g', gramWeight: 200 },
      { name: '250g', gramWeight: 250 },
    ];

    return await database.write(async () => {
      const now = Date.now();

      for (const portion of commonPortions) {
        // Check if portion already exists
        const existing = await database
          .get<FoodPortion>('food_portions')
          .query(Q.where('name', portion.name), Q.where('gram_weight', portion.gramWeight))
          .fetch();

        if (existing.length === 0) {
          const newPortion = await database.get<FoodPortion>('food_portions').create((p) => {
            p.name = portion.name;
            p.gramWeight = portion.gramWeight;
            p.createdAt = now;
            p.updatedAt = now;
          });

          portions.push(newPortion);
        } else {
          portions.push(existing[0]);
        }
      }

      return portions;
    });
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
}
