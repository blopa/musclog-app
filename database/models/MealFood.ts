import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

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
      const portion = await this.portion;
      if (portion) {
        return this.amount * (portion.gramWeight ?? 0);
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
    const food = await this.food;

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
      const portion = await this.portion;
      if (portion) {
        // Use portion-based calculation
        const multiplier = this.amount; // Number of portions
        return {
          calories: food.calories * ((portion.gramWeight ?? 0) / food.servingAmount) * multiplier,
          protein: food.protein * ((portion.gramWeight ?? 0) / food.servingAmount) * multiplier,
          carbs: food.carbs * ((portion.gramWeight ?? 0) / food.servingAmount) * multiplier,
          fat: food.fat * ((portion.gramWeight ?? 0) / food.servingAmount) * multiplier,
          fiber: food.fiber * ((portion.gramWeight ?? 0) / food.servingAmount) * multiplier,
        };
      }
    }

    // Use direct amount (assume grams)
    return food.getNutrientsForAmount(this.amount, 'g');
  }
}
