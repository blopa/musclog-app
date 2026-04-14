import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import { captureException } from '@/utils/sentry';

import Food from './Food';
import FoodPortion from './FoodPortion';
import Meal from './Meal';

export default class MealFood extends Model {
  static table = 'meal_foods';

  static associations = {
    meals: { type: 'belongs_to' as const, key: 'meal_id' },
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('meal_id') mealId!: string;
  @field('food_id') foodId!: string;
  @field('amount') amount!: number; // How much of the food
  @field('portion_id') portionId?: string; // If null, assume base unit (grams)

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('meals', 'meal_id') meal!: Meal;
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
  async updatePortion(portionId?: string): Promise<void> {
    await this.update((record) => {
      record.portionId = portionId;
      record.updatedAt = Date.now();
    });
  }

  // Get the actual gram weight for this meal food entry
  async getGramWeight(): Promise<number> {
    if (this.portionId) {
      try {
        const portion = await this.portion;
        if (portion) {
          return this.amount * (portion.gramWeight ?? 0);
        }
      } catch (error) {
        captureException(error, { data: { context: 'MealFood.getGramWeight' } });
      }
    }

    // If no portion, assume amount is in grams
    return this.amount;
  }

  // Get nutrients for this specific meal food entry
  async getNutrients(): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> {
    let food: Food | null = null;
    try {
      food = await this.food;
    } catch {
      // Food missing — return zeroes
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };
    }

    if (!food) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };
    }

    if (this.portionId) {
      try {
        const portion = await this.portion;
        if (portion) {
          // Use portion-based calculation
          // amount = number of portions
          const totalGrams = this.amount * (portion.gramWeight ?? 0);
          return food.getNutrientsForAmount(totalGrams);
        }
      } catch (error) {
        captureException(error, { data: { context: 'MealFood.getNutrients' } });
      }
    }

    // Use direct amount (assume grams)
    return food.getNutrientsForAmount(this.amount);
  }
}
