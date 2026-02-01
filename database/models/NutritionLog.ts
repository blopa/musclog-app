import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import Food from './Food';
import FoodPortion from './FoodPortion';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export default class NutritionLog extends Model {
  static table = 'nutrition_logs';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('food_id') foodId?: string;
  @field('date') date?: number; // Midnight timestamp for the day
  @field('type') type?: MealType; // 'breakfast', 'lunch', 'dinner', 'snack', 'other'

  @field('amount') amount?: number; // Quantity eaten
  @field('portion_id') portionId?: string; // Unit used (e.g., linked to food_portions)

  @field('created_at') createdAt?: number;
  @field('updated_at') updatedAt?: number;
  @field('deleted_at') deletedAt?: number;

  @relation('foods', 'food_id') food?: Food;
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
        return (this.amount ?? 0) * (portion.gramWeight ?? 0);
      }
    }

    // If no portion, assume amount is in grams
    return this.amount ?? 0;
  }

  // Get nutrients for this specific nutrition log entry
  async getNutrients(): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> {
    try {
      const food = await this.food;

      if (!food) {
        throw new Error('Food not found for nutrition log');
      }

      if (this.portionId) {
        const portion = await this.portion;
        if (portion) {
          // Use portion-based calculation
          const multiplier = this.amount ?? 0; // Number of portions
          return {
            calories:
              (food.calories ?? 0) *
              ((portion.gramWeight ?? 0) / (food.servingAmount ?? 1)) *
              multiplier,
            protein:
              (food.protein ?? 0) *
              ((portion.gramWeight ?? 0) / (food.servingAmount ?? 1)) *
              multiplier,
            carbs:
              (food.carbs ?? 0) *
              ((portion.gramWeight ?? 0) / (food.servingAmount ?? 1)) *
              multiplier,
            fat:
              (food.fat ?? 0) *
              ((portion.gramWeight ?? 0) / (food.servingAmount ?? 1)) *
              multiplier,
            fiber:
              (food.fiber ?? 0) *
              ((portion.gramWeight ?? 0) / (food.servingAmount ?? 1)) *
              multiplier,
          };
        }
      }

      // Use direct amount (assume grams)
      return food.getNutrientsForAmount(this.amount ?? 0, 'g');
    } catch (error) {
      console.error('Error getting nutrients for nutrition log:', error);
      // Return default values to prevent crashes
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };
    }
  }

  // Helper method to get formatted date string
  getDateString(): string {
    const date = new Date(this.date ?? 0);
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
    return labels[this.type ?? 'breakfast'] || (this.type ?? 'breakfast');
  }
}
