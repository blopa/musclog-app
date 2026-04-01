import { Q } from '@nozbe/watermelondb';

import i18n from '../../lang/lang';
import { database } from '../index';
import FoodFoodPortion from '../models/FoodFoodPortion';
import FoodPortion from '../models/FoodPortion';

export class FoodPortionService {
  /**
   * Non-deleted portion with this exact gram_weight, if any (at most one should exist after dedupe).
   */
  static async findExistingPortionByGramWeight(gramWeight: number): Promise<FoodPortion | null> {
    const rows = await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('gram_weight', gramWeight), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Create a new global portion (not tied to any specific food).
   * If a non-deleted portion with the same gram_weight already exists, returns it and does not create.
   */
  static async createFoodPortion(
    name: string,
    gramWeight: number,
    icon?: string,
    source: 'app' | 'user' = 'user'
  ): Promise<FoodPortion> {
    const duplicate = await this.findExistingPortionByGramWeight(gramWeight);
    if (duplicate) {
      return duplicate;
    }

    return await database.write(async () => {
      const now = Date.now();

      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = name;
        portion.gramWeight = gramWeight;
        // Deprecated: `food_portions.is_default` — use `source === 'app'` for built-in catalog rows.
        portion.isDefault = false;
        if (icon) {
          portion.icon = icon;
        }
        portion.source = source;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }

  /**
   * Same as {@link createFoodPortion} — uniqueness is by gram_weight only.
   */
  static async getOrCreatePortion(
    name: string,
    gramWeight: number,
    icon?: string,
    source: 'app' | 'user' = 'user'
  ): Promise<FoodPortion> {
    return this.createFoodPortion(name, gramWeight, icon, source);
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
   * Get the standard 100g portion (from createCommonPortions).
   * Returns null if it has not been created yet.
   * Queries by gram_weight only since the name may be localized.
   */
  static async get100gPortion(): Promise<FoodPortion | null> {
    const portions = await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('gram_weight', 100), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return portions.length > 0 ? portions[0] : null;
  }

  /**
   * @deprecated Prefer {@link get100gPortion} or filter with `source === 'app'`.
   * The canonical “default” serving for macros is the 100g row from {@link createCommonPortions}.
   */
  static async getDefaultPortion(): Promise<FoodPortion | null> {
    return this.get100gPortion();
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
        if (updates.name !== undefined) {
          record.name = updates.name;
        }
        if (updates.gramWeight !== undefined) {
          record.gramWeight = updates.gramWeight;
        }
        if (updates.icon !== undefined) {
          record.icon = updates.icon;
        }
        record.updatedAt = Date.now();
      });

      return portion;
    });
  }

  /**
   * Delete food portion. Throws if the portion is a built-in app portion (source='app').
   */
  static async deleteFoodPortion(id: string): Promise<void> {
    const portion = await database.get<FoodPortion>('food_portions').find(id);
    if (portion.source === 'app') {
      throw new Error('Cannot delete a built-in app food portion.');
    }

    // markAsDeleted is a @writer method, so it already manages its own write transaction
    await portion.markAsDeleted();
  }

  /**
   * Backfills the `source` field for food portions that predate the column addition.
   * Portions with no source are ordered by creation date (oldest first); the first
   * `appPortionCount` are assumed to be app-seeded and get 'app', the rest get 'user'.
   * Safe to call on every app start — it's a no-op when all portions already have a source.
   * Used as the web (LokiJS) fallback since unsafeExecuteSql is ignored by that adapter.
   */
  static async backfillPortionSources(appPortionCount: number = 9): Promise<void> {
    const unsourced = await database
      .get<FoodPortion>('food_portions')
      .query(
        Q.or(Q.where('source', Q.eq(null)), Q.where('source', Q.eq(''))),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();

    if (unsourced.length === 0) {
      return;
    }

    await database.write(async () => {
      for (let i = 0; i < unsourced.length; i++) {
        const portion = unsourced[i];
        const source: 'app' | 'user' = i < appPortionCount ? 'app' : 'user';
        await portion.update((record) => {
          record.source = source;
          record.updatedAt = Date.now();
        });
      }
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
      { name: i18n.t('food.portions.slice'), gramWeight: 25, icon: 'egg' },
      { name: i18n.t('food.portions.twoSlices'), gramWeight: 50, icon: 'egg' },
      { name: i18n.t('food.portions.cup'), gramWeight: 240, icon: 'cup' },
      { name: i18n.t('food.portions.tbsp'), gramWeight: 15, icon: 'droplet' },
      { name: i18n.t('food.portions.tsp'), gramWeight: 5, icon: 'droplet' },
      { name: i18n.t('food.portions.oz'), gramWeight: 28.35, icon: 'scale' },
      { name: i18n.t('food.portions.100g'), gramWeight: 100, icon: 'scale' },
      { name: i18n.t('food.portions.50g'), gramWeight: 50, icon: 'scale' },
      { name: i18n.t('food.portions.200g'), gramWeight: 200, icon: 'scale' },
      { name: i18n.t('food.portions.250g'), gramWeight: 250, icon: 'scale' },
    ];

    for (const portion of commonPortions) {
      const created = await this.createFoodPortion(
        portion.name,
        portion.gramWeight,
        portion.icon,
        'app'
      );
      portions.push(created);
    }

    return portions;
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
    const originalPortion = await database.get<FoodPortion>('food_portions').find(id);

    if (originalPortion.deletedAt) {
      throw new Error('Cannot duplicate deleted portion');
    }

    const existingSameGrams = await this.findExistingPortionByGramWeight(
      originalPortion.gramWeight
    );
    if (existingSameGrams) {
      return existingSameGrams;
    }

    return await database.write(async () => {
      const now = Date.now();

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
