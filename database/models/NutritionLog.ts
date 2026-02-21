import { Model } from '@nozbe/watermelondb';
import { field, json, relation, writer } from '@nozbe/watermelondb/decorators';

import type { MicrosData } from './Food';
import Food from './Food';
import FoodPortion from './FoodPortion';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

function parseMicrosData(data: unknown): MicrosData {
  if (typeof data !== 'object' || data === null) return {};
  const out: MicrosData = {};
  for (const k of Object.keys(data)) {
    const v = (data as Record<string, unknown>)[k];
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}

export default class NutritionLog extends Model {
  static table = 'nutrition_logs';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('food_id') foodId!: string;
  @field('date') date!: number; // Midnight timestamp for the day
  @field('type') type!: MealType; // 'breakfast', 'lunch', 'dinner', 'snack', 'other'

  @field('amount') amount!: number; // Quantity eaten
  @field('portion_id') portionId?: string; // Unit used (e.g., linked to food_portions)

  // Snapshot at log time (per 100g) so values don't change if food is edited or deleted (optional for legacy rows)
  @field('logged_food_name') loggedFoodName?: string;
  @field('logged_calories') loggedCalories?: number;
  @field('logged_protein') loggedProtein?: number;
  @field('logged_carbs') loggedCarbs?: number;
  @field('logged_fat') loggedFat?: number;
  @field('logged_fiber') loggedFiber?: number;
  @json('logged_micros_json', parseMicrosData) loggedMicros?: MicrosData;

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

  /**
   * Whether this log has snapshot data (new logs always do).
   * Legacy rows without snapshot fall back to resolving the food.
   */
  hasSnapshot(): boolean {
    return (
      typeof this.loggedCalories === 'number' &&
      !Number.isNaN(this.loggedCalories) &&
      typeof this.loggedProtein === 'number' &&
      typeof this.loggedCarbs === 'number' &&
      typeof this.loggedFat === 'number' &&
      typeof this.loggedFiber === 'number'
    );
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

    if (this.hasSnapshot()) {
      return {
        calories: (this.loggedCalories ?? 0) * scale,
        protein: (this.loggedProtein ?? 0) * scale,
        carbs: (this.loggedCarbs ?? 0) * scale,
        fat: (this.loggedFat ?? 0) * scale,
        fiber: (this.loggedFiber ?? 0) * scale,
      };
    }

    // Fallback for legacy rows without snapshot
    try {
      const food = await this.food;
      if (!food) throw new Error('Food not found for nutrition log');
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
    if (this.loggedFoodName?.trim()) {
      return this.loggedFoodName.trim();
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
    const date = new Date(this.date);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
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
