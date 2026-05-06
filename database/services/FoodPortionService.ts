import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Food from '@/database/models/Food';
import FoodFoodPortion from '@/database/models/FoodFoodPortion';
import FoodPortion from '@/database/models/FoodPortion';
import Meal from '@/database/models/Meal';
import MealFoodPortion from '@/database/models/MealFoodPortion';
import i18n from '@/lang/lang';

const PORTION_DISPLAY_NAME_I18N_KEYS = [
  'food.portions.slice',
  'food.portions.twoSlices',
  'food.portions.cup',
  'food.portions.tbsp',
  'food.portions.tsp',
  'food.portions.oz',
  'food.portions.100g',
  'food.portions.50g',
  'food.portions.200g',
  'food.portions.250g',
] as const;

export class FoodPortionService {
  static isBasicPortion(portion: FoodPortion): boolean {
    return portion.resolvedSource === 'basic';
  }

  static async findExistingPortionByGramWeight(gramWeight: number): Promise<FoodPortion | null> {
    const rows = await database
      .get<FoodPortion>('food_portions')
      .query(
        Q.where('gram_weight', gramWeight),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('source', 'basic')
      )
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  static async createFoodPortion(
    name: string,
    gramWeight?: number,
    icon?: string,
    source: 'basic' | 'custom' = 'custom',
    options?: {
      kind?: 'mass' | 'named';
      scope?: 'global' | 'private';
      ownerType?: 'food' | 'meal';
      ownerId?: string;
      dedupe?: boolean;
    }
  ): Promise<FoodPortion> {
    const kind = options?.kind ?? (gramWeight != null ? 'mass' : 'named');
    const scope = options?.scope ?? (source === 'basic' ? 'global' : 'private');

    if (options?.dedupe !== false && source === 'basic' && kind === 'mass' && gramWeight != null) {
      const duplicate = await this.findExistingPortionByGramWeight(gramWeight);
      if (duplicate) {
        return duplicate;
      }
    }

    return await database.write(async () => {
      const now = Date.now();

      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = name;
        portion.gramWeight = gramWeight;
        if (icon) {
          portion.icon = icon;
        }
        portion.source = source;
        portion.kind = kind;
        portion.scope = scope;
        portion.ownerType = options?.ownerType;
        portion.ownerId = options?.ownerId;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }

  static async createPrivateNamedPortion(
    name: string,
    ownerType: 'food' | 'meal',
    ownerId: string,
    icon?: string
  ): Promise<FoodPortion> {
    return this.createFoodPortion(name, undefined, icon, 'custom', {
      kind: 'named',
      scope: 'private',
      ownerType,
      ownerId,
      dedupe: false,
    });
  }

  static async getOrCreatePortion(
    name: string,
    gramWeight?: number,
    icon?: string,
    source: 'basic' | 'custom' = 'custom',
    options?: {
      kind?: 'mass' | 'named';
      scope?: 'global' | 'private';
      ownerType?: 'food' | 'meal';
      ownerId?: string;
      dedupe?: boolean;
    }
  ): Promise<FoodPortion> {
    return this.createFoodPortion(name, gramWeight, icon, source, options);
  }

  static async getAllPortions(options?: {
    source?: 'basic' | 'custom';
    scope?: 'global' | 'private';
    ownerType?: 'food' | 'meal';
    ownerId?: string;
  }): Promise<FoodPortion[]> {
    const clauses = [Q.where('deleted_at', Q.eq(null))];
    if (options?.source) {
      clauses.push(Q.where('source', options.source));
    }

    if (options?.scope) {
      clauses.push(Q.where('scope', options.scope));
    }

    if (options?.ownerType) {
      clauses.push(Q.where('owner_type', options.ownerType));
    }

    if (options?.ownerId) {
      clauses.push(Q.where('owner_id', options.ownerId));
    }

    return await database
      .get<FoodPortion>('food_portions')
      .query(...clauses)
      .fetch();
  }

  static async getPortionsPaginated(
    limit: number,
    offset: number,
    options?: {
      source?: 'basic' | 'custom';
      scope?: 'global' | 'private';
      ownerType?: 'food' | 'meal';
      ownerId?: string;
    }
  ): Promise<FoodPortion[]> {
    const clauses = [
      Q.where('deleted_at', Q.eq(null)),
      ...(options?.source ? [Q.where('source', options.source)] : []),
      ...(options?.scope ? [Q.where('scope', options.scope)] : []),
      ...(options?.ownerType ? [Q.where('owner_type', options.ownerType)] : []),
      ...(options?.ownerId ? [Q.where('owner_id', options.ownerId)] : []),
      Q.sortBy('created_at', Q.desc),
    ];

    let query = database.get<FoodPortion>('food_portions').query(...clauses);
    if (limit > 0) {
      query =
        offset > 0 ? query.extend(Q.skip(offset), Q.take(limit)) : query.extend(Q.take(limit));
    }
    return await query.fetch();
  }

  static async get100gPortion(): Promise<FoodPortion | null> {
    const portions = await database
      .get<FoodPortion>('food_portions')
      .query(
        Q.where('gram_weight', 100),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('source', 'basic')
      )
      .fetch();
    return portions.length > 0 ? portions[0] : null;
  }

  static async getDefaultPortion(): Promise<FoodPortion | null> {
    return this.get100gPortion();
  }

  static async getPortionById(id: string): Promise<FoodPortion | null> {
    try {
      const portion = await database.get<FoodPortion>('food_portions').find(id);
      return portion.deletedAt ? null : portion;
    } catch {
      return null;
    }
  }

  static async updateFoodPortion(
    id: string,
    updates: {
      name?: string;
      gramWeight?: number;
      icon?: string;
      kind?: 'mass' | 'named';
      scope?: 'global' | 'private';
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
          record.kind = 'mass';
        }

        if (updates.icon !== undefined) {
          record.icon = updates.icon;
        }

        if (updates.kind !== undefined) {
          record.kind = updates.kind;
        }

        if (updates.scope !== undefined) {
          record.scope = updates.scope;
        }
        record.updatedAt = Date.now();
      });

      return portion;
    });
  }

  static async deleteFoodPortion(id: string): Promise<void> {
    const portion = await database.get<FoodPortion>('food_portions').find(id);
    if (portion.resolvedSource === 'basic') {
      throw new Error('Cannot delete a built-in app food portion.');
    }
    await portion.markAsDeleted();
  }

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
        const source: 'basic' | 'custom' = i < appPortionCount ? 'basic' : 'custom';
        await portion.update((record) => {
          record.source = source;
          record.scope = source === 'basic' ? 'global' : 'private';
          record.kind = record.kind || 'mass';
          record.updatedAt = Date.now();
        });
      }
    });
  }

  static async fixPortionNamesStoredAsI18nKeys(): Promise<void> {
    const rows = await database
      .get<FoodPortion>('food_portions')
      .query(
        Q.where('name', Q.oneOf([...PORTION_DISPLAY_NAME_I18N_KEYS])),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    if (rows.length === 0) {
      return;
    }

    await database.write(async () => {
      for (const portion of rows) {
        const translated = i18n.t(portion.name);
        if (translated === portion.name) {
          continue;
        }

        await portion.update((record) => {
          record.name = translated;
          record.updatedAt = Date.now();
        });
      }
    });
  }

  static async createCommonPortions(): Promise<FoodPortion[]> {
    const portions: FoodPortion[] = [];
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
        'basic',
        {
          kind: 'mass',
          scope: 'global',
        }
      );
      portions.push(created);
    }

    return portions;
  }

  static async searchPortions(searchTerm: string): Promise<FoodPortion[]> {
    return await database
      .get<FoodPortion>('food_portions')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', Q.like(`%${searchTerm}%`)))
      .fetch();
  }

  static async addPortionToFood(
    foodId: string,
    foodPortionId: string,
    isDefault = false
  ): Promise<FoodFoodPortion> {
    return await database.write(async () => {
      const table = database.get<FoodFoodPortion>('food_food_portions');
      const now = Date.now();

      if (isDefault) {
        const currentDefault = await table
          .query(
            Q.where('food_id', foodId),
            Q.where('is_default', true),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();
        for (const row of currentDefault) {
          await row.update((record) => {
            record.isDefault = false;
            record.updatedAt = now;
          });
        }
      }

      return await table.create((ffp) => {
        ffp.foodId = foodId;
        ffp.foodPortionId = foodPortionId;
        ffp.isDefault = isDefault;
        ffp.createdAt = now;
        ffp.updatedAt = now;
      });
    });
  }

  static async addPortionToMeal(
    mealId: string,
    foodPortionId: string,
    isDefault = false
  ): Promise<MealFoodPortion> {
    return await database.write(async () => {
      const table = database.get<MealFoodPortion>('meal_food_portions');
      const now = Date.now();

      if (isDefault) {
        const currentDefault = await table
          .query(
            Q.where('meal_id', mealId),
            Q.where('is_default', true),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();
        for (const row of currentDefault) {
          await row.update((record) => {
            record.isDefault = false;
            record.updatedAt = now;
          });
        }
      }

      return await table.create((record) => {
        record.mealId = mealId;
        record.foodPortionId = foodPortionId;
        record.isDefault = isDefault;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  static async setDefaultPortionForFood(foodId: string, foodPortionId: string): Promise<void> {
    return await database.write(async () => {
      const table = database.get<FoodFoodPortion>('food_food_portions');
      const now = Date.now();

      const currentDefault = await table
        .query(Q.where('food_id', foodId), Q.where('is_default', true))
        .fetch();
      for (const row of currentDefault) {
        await row.update((record) => {
          record.isDefault = false;
          record.updatedAt = now;
        });
      }

      const linked = await table
        .query(Q.where('food_id', foodId), Q.where('food_portion_id', foodPortionId))
        .fetch();
      if (linked.length > 0) {
        await linked[0].update((record) => {
          record.isDefault = true;
          record.updatedAt = now;
        });
      }
    });
  }

  static async removePortionFromFood(foodId: string, foodPortionId: string): Promise<void> {
    const table = database.get<FoodFoodPortion>('food_food_portions');
    const rows = await table
      .query(Q.where('food_id', foodId), Q.where('food_portion_id', foodPortionId))
      .fetch();
    if (rows.length > 0) {
      await rows[0].markAsDeleted();
    }
  }

  static async getPortionsForFood(foodId: string): Promise<FoodPortion[]> {
    const rows = await database
      .get<FoodFoodPortion>('food_food_portions')
      .query(Q.where('food_id', foodId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const portions = await Promise.all(
      rows.map(async (row) => {
        try {
          return await row.foodPortion;
        } catch {
          return null;
        }
      })
    );
    return portions.filter((p): p is FoodPortion => p !== null);
  }

  static async getPortionsForMeal(mealId: string): Promise<FoodPortion[]> {
    const rows = await database
      .get<MealFoodPortion>('meal_food_portions')
      .query(Q.where('meal_id', mealId), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const portions = await Promise.all(
      rows.map(async (row) => {
        try {
          return await row.foodPortion;
        } catch {
          return null;
        }
      })
    );
    return portions.filter((p): p is FoodPortion => p !== null);
  }

  static async getPortionUsageSummary(
    portionId: string
  ): Promise<{ foods: string[]; meals: string[] }> {
    const [foodLinks, mealLinks] = await Promise.all([
      database
        .get<FoodFoodPortion>('food_food_portions')
        .query(Q.where('food_portion_id', portionId), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      database
        .get<MealFoodPortion>('meal_food_portions')
        .query(Q.where('food_portion_id', portionId), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
    ]);

    const foods = (
      await Promise.all(
        foodLinks.map(async (row) => {
          try {
            const food = await database.get<Food>('foods').find(row.foodId);
            return food.deletedAt ? null : food.name;
          } catch {
            return null;
          }
        })
      )
    ).filter((name): name is string => !!name);

    const meals = (
      await Promise.all(
        mealLinks.map(async (row) => {
          try {
            const meal = await database.get<Meal>('meals').find(row.mealId);
            return meal.deletedAt ? null : meal.name;
          } catch {
            return null;
          }
        })
      )
    ).filter((name): name is string => !!name);

    return { foods: Array.from(new Set(foods)), meals: Array.from(new Set(meals)) };
  }

  static async duplicatePortion(id: string): Promise<FoodPortion> {
    const original = await database.get<FoodPortion>('food_portions').find(id);
    if (original.deletedAt) {
      throw new Error('Cannot duplicate deleted portion');
    }

    if (original.resolvedSource === 'basic' && original.gramWeight != null) {
      const existing = await this.findExistingPortionByGramWeight(original.gramWeight);
      if (existing) {
        return existing;
      }
    }

    return await database.write(async () => {
      const now = Date.now();
      return await database.get<FoodPortion>('food_portions').create((portion) => {
        portion.name = `${original.name} (Copy)`;
        portion.gramWeight = original.gramWeight;
        portion.icon = original.icon;
        portion.source = original.source;
        portion.kind = original.kind;
        portion.scope = original.scope;
        portion.ownerType = original.ownerType;
        portion.ownerId = original.ownerId;
        portion.createdAt = now;
        portion.updatedAt = now;
      });
    });
  }
}
