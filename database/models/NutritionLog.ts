import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import { formatLocalCalendarDayIso } from '../../utils/calendarDate';
import { decryptJson, decryptNumber, decryptOptionalString } from '../encryptionHelpers';
import type { MicrosData } from './Food';
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
  loggedMicros?: MicrosData;
}

export default class NutritionLog extends Model {
  static table = 'nutrition_logs';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('food_id') foodId!: string;
  @field('external_id') externalId?: string;
  @field('date') date!: number; // Midnight timestamp for the day
  @field('type') type!: MealType; // 'breakfast', 'lunch', 'dinner', 'snack', 'other'

  @field('amount') amount!: number; // Quantity eaten
  @field('portion_id') portionId?: string; // Unit used (e.g., linked to food_portions)

  // Encrypted at rest (ciphertext in DB)
  @field('logged_food_name') loggedFoodNameRaw?: string;
  @field('logged_calories') loggedCaloriesRaw?: string;
  @field('logged_protein') loggedProteinRaw?: string;
  @field('logged_carbs') loggedCarbsRaw?: string;
  @field('logged_fat') loggedFatRaw?: string;
  @field('logged_fiber') loggedFiberRaw?: string;
  @field('logged_micros_json') loggedMicrosRaw?: string;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('foods', 'food_id') food!: Food;
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
      loggedMicros: Object.keys(loggedMicros).length > 0 ? loggedMicros : undefined,
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
    if (this.portionId) {
      const portion = await this.portion;
      if (portion) {
        return this.amount * (portion.gramWeight ?? 0);
      }
    }

    // If no portion, assume amount is in grams
    return this.amount;
  }

  // Get nutrients for this specific nutrition log entry (uses snapshot when present)
  async getNutrients(): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> {
    const totalGrams = await this.getGramWeight();
    const scale = totalGrams / 100;
    const hasSnap = await this.hasSnapshot();
    if (hasSnap) {
      const s = await this.getDecryptedSnapshot();
      return {
        calories: (s.loggedCalories ?? 0) * scale,
        protein: (s.loggedProtein ?? 0) * scale,
        carbs: (s.loggedCarbs ?? 0) * scale,
        fat: (s.loggedFat ?? 0) * scale,
        fiber: (s.loggedFiber ?? 0) * scale,
      };
    }

    // Fallback for legacy rows without snapshot
    try {
      const food = await this.food;
      if (!food) {
        throw new Error('Food not found for nutrition log');
      }
      return food.getNutrientsForAmount(totalGrams);
    } catch (error) {
      console.error('Error getting nutrients for nutrition log:', error);
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
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
      return food?.name ?? 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  // Helper method to get formatted date string
  getDateString(): string {
    return formatLocalCalendarDayIso(new Date(this.date));
  }

  // Helper method to get readable meal type
  getMealTypeLabel(): string {
    const labels = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      other: 'Other',
    };
    return labels[this.type] || this.type;
  }
}
