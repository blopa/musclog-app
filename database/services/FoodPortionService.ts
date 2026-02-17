import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';

export class FoodPortionService {
  /**
   * Create a new global portion (not tied to any specific food)
   */
  static async createFoodPortion(
    name: string,
    gramWeight: number,
    icon?: string
  ): Promise<FoodPortion> {
    return await database.write(async () => {
      const now = Date.now();

      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = name;
        portion.gramWeight = gramWeight;
        if (icon) {
          portion.icon = icon;
        }
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }

  /**
   * Get or create a portion by name and gram weight
   * Returns existing portion if found, creates new one if not
   */
  static async getOrCreatePortion(
    name: string,
    gramWeight: number,
    icon?: string
  ): Promise<FoodPortion> {
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
    return this.createFoodPortion(name, gramWeight, icon);
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
   * Get portions paginated (for data log modal), sorted by created_at desc
   */
  static async getPortionsPaginated(limit: number, offset: number): Promise<FoodPortion[]> {
    let query = database
      .get<FoodPortion>('food_portions')
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
      icon?: string;
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
        if (updates.icon !== undefined) record.icon = updates.icon;
        record.updatedAt = Date.now();
      });

      return portion;
    });
  }

  /**
   * Delete food portion
   */
  static async deleteFoodPortion(id: string): Promise<void> {
    const portion = await database.get<FoodPortion>('food_portions').find(id);
    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await portion.markAsDeleted();
  }

  /**
   * Create common portions for a food type
   * Returns array of global portion definitions
   */
  static async createCommonPortions(): Promise<FoodPortion[]> {
    const portions: FoodPortion[] = [];

    // Standard portions (global, not tied to any specific food)
    const commonPortions = [
      // TODO: use translations here
      { name: 'Slice', gramWeight: 25, icon: 'egg' },
      { name: '2 Slices', gramWeight: 50, icon: 'egg' },
      { name: 'Cup', gramWeight: 240, icon: 'cup' },
      { name: 'Tbsp', gramWeight: 15, icon: 'droplet' },
      { name: 'Tsp', gramWeight: 5, icon: 'droplet' },
      { name: 'Oz', gramWeight: 28.35, icon: 'scale' },
      { name: '100g', gramWeight: 100, icon: 'scale' },
      { name: '50g', gramWeight: 50, icon: 'scale' },
      { name: '200g', gramWeight: 200, icon: 'scale' },
      { name: '250g', gramWeight: 250, icon: 'scale' },
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
            if (portion.icon) {
              p.icon = portion.icon;
            }
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

  /**
   * Add a portion to a food
   */
  static async addPortionToFood(
    foodId: string,
    foodPortionId: string,
    isDefault = false
  ): Promise<FoodFoodPortion> {
    return await database.write(async () => {
      const FFP = database.get<FoodFoodPortion>('food_food_portions');
      const now = Date.now();

      // If marking as default, unset default for other portions of this food
      if (isDefault) {
        const currentDefault = await FFP.query(
          Q.where('food_id', foodId),
          Q.where('is_default', true)
        ).fetch();

        for (const ffp of currentDefault) {
          await ffp.update((record) => {
            record.isDefault = false;
            record.updatedAt = now;
          });
        }
      }

      // Create new food-portion link
      return await FFP.create((ffp) => {
        ffp.foodId = foodId;
        ffp.foodPortionId = foodPortionId;
        ffp.isDefault = isDefault;
        ffp.createdAt = now;
        ffp.updatedAt = now;
      });
    });
  }

  /**
   * Set a portion as the default for a food
   */
  static async setDefaultPortionForFood(foodId: string, foodPortionId: string): Promise<void> {
    return await database.write(async () => {
      const FFP = database.get<FoodFoodPortion>('food_food_portions');
      const now = Date.now();

      // Unset current default
      const currentDefault = await FFP.query(
        Q.where('food_id', foodId),
        Q.where('is_default', true)
      ).fetch();

      for (const ffp of currentDefault) {
        await ffp.update((record) => {
          record.isDefault = false;
          record.updatedAt = now;
        });
      }

      // Set new default
      const foodFoodPortion = await FFP.query(
        Q.where('food_id', foodId),
        Q.where('food_portion_id', foodPortionId)
      ).fetch();

      if (foodFoodPortion.length > 0) {
        await foodFoodPortion[0].update((record) => {
          record.isDefault = true;
          record.updatedAt = now;
        });
      }
    });
  }

  /**
   * Remove a portion from a food
   */
  static async removePortionFromFood(foodId: string, foodPortionId: string): Promise<void> {
    const FFP = database.get<FoodFoodPortion>('food_food_portions');

    const ffp = await FFP.query(
      Q.where('food_id', foodId),
      Q.where('food_portion_id', foodPortionId)
    ).fetch();

    if (ffp.length > 0) {
      // markAsDeleted is a @writer method, so it already manages its own write transaction
      await ffp[0].markAsDeleted();
    }
  }

  /**
   * Get all portions for a specific food
   */
  static async getPortionsForFood(foodId: string): Promise<FoodPortion[]> {
    const FFP = database.get<FoodFoodPortion>('food_food_portions');

    const foodFoodPortions = await FFP.query(
      Q.where('food_id', foodId),
      Q.where('deleted_at', Q.eq(null))
    ).fetch();

    // Extract the FoodPortion objects from each junction entry
    return Promise.all(foodFoodPortions.map((ffp) => ffp.foodPortion));
  }

  /**
   * Duplicate portion (create a copy)
   */
  static async duplicatePortion(id: string): Promise<FoodPortion> {
    return await database.write(async () => {
      const originalPortion = await database.get<FoodPortion>('food_portions').find(id);

      if (originalPortion.deletedAt) {
        throw new Error('Cannot duplicate deleted portion');
      }

      const now = Date.now();

      // Create new portion with "(Copy)" suffix
      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = `${originalPortion.name} (Copy)`;
        portion.gramWeight = originalPortion.gramWeight;
        portion.icon = originalPortion.icon;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }
}
