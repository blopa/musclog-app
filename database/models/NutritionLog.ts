import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import { decryptJson, decryptNumber, decryptOptionalString } from '@/database/encryptionHelpers';
import i18n from '@/lang/lang';
import { formatLocalCalendarDayIso, localDayStartFromUtcMs } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { inferCaloriesFromMacrosPer100g } from '@/utils/inferCaloriesFromMacros';

import type { FoodNutritionBasis, MicrosData } from './Food';
import Food from './Food';
import FoodPortion from './FoodPortion';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export interface DecryptedNutritionLogSnapshot {
  loggedFoodName?: string;
  loggedCalories: number;
  loggedProtein: number;
  loggedCarbs: number;
  loggedFat: number;
  loggedFiber: number;
  loggedNutriscore?: string;
  loggedEcoscore?: string;
  loggedNovaGroup?: number;
  loggedMicros?: MicrosData;
  snapshotBasis?: FoodNutritionBasis;
}

export default class NutritionLog extends Model {
  static table = 'nutrition_logs';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('food_id') declare foodId: string;
  @field('external_id') externalId?: string;
  @field('date') declare date: number; // Midnight timestamp for the day
  @field('timezone') timezone?: string; // UTC offset captured when logged (e.g. "-05:00")
  @field('type') declare type: MealType; // 'breakfast', 'lunch', 'dinner', 'snack', 'other'

  @field('amount') declare amount: number; // Quantity eaten
  @field('portion_id') portionId?: string; // Unit used (e.g., linked to food_portions)

  // Encrypted at rest (ciphertext in DB)
  @field('logged_food_name') loggedFoodNameRaw?: string;
  @field('logged_calories') loggedCaloriesRaw?: string;
  @field('logged_protein') loggedProteinRaw?: string;
  @field('logged_carbs') loggedCarbsRaw?: string;
  @field('logged_fat') loggedFatRaw?: string;
  @field('logged_fiber') loggedFiberRaw?: string;
  @field('logged_nutriscore') loggedNutriscore?: string;
  @field('logged_ecoscore') loggedEcoscore?: string;
  @field('logged_nova_group') loggedNovaGroup?: number;
  @field('logged_micros_json') loggedMicrosRaw?: string;
  @field('snapshot_basis') snapshotBasis?: FoodNutritionBasis;

  @field('group_id') groupId?: string;
  @field('logged_meal_name') loggedMealName?: string;

  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @relation('foods', 'food_id') declare food: Food;
  @relation('food_portions', 'portion_id') portion?: FoodPortion;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateAmount(amount: number): Promise<void> {
    await this.update((record) => {
      record.amount = amount;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateMealType(type: MealType): Promise<void> {
    await this.update((record) => {
      record.type = type;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updatePortion(portionId?: string): Promise<void> {
    await this.update((record) => {
      record.portionId = portionId;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateDate(date: number): Promise<void> {
    await this.update((record) => {
      record.date = date;
      record.updatedAt = Date.now();
    });
  }

  /** Decrypt snapshot fields (logged_*). Use this for display and calculations. */
  async getDecryptedSnapshot(): Promise<DecryptedNutritionLogSnapshot> {
    const [
      loggedFoodName,
      loggedCalories,
      loggedProtein,
      loggedCarbs,
      loggedFat,
      loggedFiber,
      loggedMicros,
    ] = await Promise.all([
      decryptOptionalString(this.loggedFoodNameRaw),
      decryptNumber(this.loggedCaloriesRaw),
      decryptNumber(this.loggedProteinRaw),
      decryptNumber(this.loggedCarbsRaw),
      decryptNumber(this.loggedFatRaw),
      decryptNumber(this.loggedFiberRaw),
      decryptJson(this.loggedMicrosRaw),
    ]);
    return {
      loggedFoodName: loggedFoodName || undefined,
      loggedCalories,
      loggedProtein,
      loggedCarbs,
      loggedFat,
      loggedFiber,
      loggedNutriscore: this.loggedNutriscore || undefined,
      loggedEcoscore: this.loggedEcoscore || undefined,
      loggedNovaGroup: this.loggedNovaGroup ?? undefined,
      loggedMicros: Object.keys(loggedMicros).length > 0 ? loggedMicros : undefined,
      snapshotBasis: this.snapshotBasis ?? 'per_100g',
    };
  }

  /**
   * Whether this log has snapshot data (new logs always do).
   * Legacy rows without snapshot fall back to resolving the food.
   */
  async hasSnapshot(): Promise<boolean> {
    const s = await this.getDecryptedSnapshot();
    return (
      typeof s.loggedCalories === 'number' &&
      !Number.isNaN(s.loggedCalories) &&
      typeof s.loggedProtein === 'number' &&
      typeof s.loggedCarbs === 'number' &&
      typeof s.loggedFat === 'number' &&
      typeof s.loggedFiber === 'number'
    );
  }

  // Get the actual gram weight for this nutrition log entry
  async getGramWeight(): Promise<number> {
    if (this.snapshotBasis === 'per_serving') {
      return 0;
    }

    if (this.portionId) {
      try {
        const portion = await this.portion;
        if (portion) {
          return this.amount * (portion.gramWeight ?? 0);
        }
      } catch (error) {
        handleError(error, 'NutritionLog.getGramWeight');
      }
    }

    // If no portion, assume amount is in grams
    return this.amount;
  }

  async getDisplayAmount(): Promise<{ value: number; unit: string }> {
    if (this.snapshotBasis === 'per_serving') {
      try {
        const portion = this.portionId ? await this.portion : null;
        return {
          value: this.amount,
          unit: portion?.name || i18n.t('food.foodDetails.serving'),
        };
      } catch {
        return {
          value: this.amount,
          unit: i18n.t('food.foodDetails.serving'),
        };
      }
    }

    return { value: await this.getGramWeight(), unit: 'g' };
  }

  // Get nutrients for this specific nutrition log entry (uses snapshot when present)
  async getNutrients(): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    alcohol: number;
  }> {
    const hasSnap = await this.hasSnapshot();
    if (hasSnap) {
      const s = await this.getDecryptedSnapshot();
      if (s.snapshotBasis === 'per_serving') {
        const servings = this.amount;
        return {
          calories: Math.max(0, s.loggedCalories ?? 0) * servings,
          protein: Math.max(0, s.loggedProtein ?? 0) * servings,
          carbs: Math.max(0, s.loggedCarbs ?? 0) * servings,
          fat: Math.max(0, s.loggedFat ?? 0) * servings,
          fiber: Math.max(0, s.loggedFiber ?? 0) * servings,
          alcohol: Math.max(0, s.loggedMicros?.alcohol ?? 0) * servings,
        };
      }

      const totalGrams = await this.getGramWeight();
      const scale = totalGrams / 100;
      const loggedAlcohol = s.loggedMicros?.alcohol ?? 0;

      // If no explicit calories but alcohol is present, derive calories including alcohol.
      // When loggedCalories > 0, the source (USDA/OFF/user) already included alcohol energy.
      let caloriesPer100g = s.loggedCalories ?? 0;
      if (caloriesPer100g === 0 && loggedAlcohol > 0) {
        caloriesPer100g = inferCaloriesFromMacrosPer100g(
          s.loggedProtein,
          s.loggedCarbs,
          s.loggedFat,
          s.loggedFiber,
          loggedAlcohol
        );
      }

      return {
        calories: Math.max(0, caloriesPer100g) * scale,
        protein: Math.max(0, s.loggedProtein ?? 0) * scale,
        carbs: Math.max(0, s.loggedCarbs ?? 0) * scale,
        fat: Math.max(0, s.loggedFat ?? 0) * scale,
        fiber: Math.max(0, s.loggedFiber ?? 0) * scale,
        alcohol: Math.max(0, loggedAlcohol) * scale,
      };
    }

    // Fallback for legacy rows without snapshot
    try {
      const food = await this.food;
      if (!food) {
        throw new Error('Food not found for nutrition log');
      }
      if (food.resolvedNutritionBasis === 'per_serving') {
        const nutrients = food.getNutrientsForServingCount(this.amount);
        return {
          ...nutrients,
          alcohol: (food.micros?.alcohol ?? 0) * this.amount,
        };
      }

      const totalGrams = await this.getGramWeight();
      const scale = totalGrams / 100;
      const nutrients = food.getNutrientsForAmount(totalGrams);
      return {
        ...nutrients,
        alcohol: (food.micros?.alcohol ?? 0) * scale,
      };
    } catch (error) {
      console.error('Error getting nutrients for nutrition log:', error);
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        alcohol: 0,
      };
    }
  }

  /** Display name: snapshot name when food is missing or deleted. */
  async getDisplayName(): Promise<string> {
    const s = await this.getDecryptedSnapshot();
    if (s.loggedFoodName?.trim()) {
      return s.loggedFoodName.trim();
    }
    try {
      const food = await this.food;
      return food?.name ?? i18n.t('meals.unknownFood');
    } catch {
      return i18n.t('meals.unknownFood');
    }
  }

  // Helper method to get formatted date string
  getDateString(): string {
    return formatLocalCalendarDayIso(new Date(localDayStartFromUtcMs(this.date)));
  }

  // Helper method to get readable meal type
  getMealTypeLabel(): string {
    return i18n.t(`meals.tags.${this.type}`);
  }
}
