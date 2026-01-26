import { Model } from '@nozbe/watermelondb';
import { field, writer, relation } from '@nozbe/watermelondb/decorators';
import Food from './Food';
import Meal from './Meal';
import FoodPortion from './FoodPortion';

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
    await this.update(record => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateAmount(amount: number): Promise<void> {
    await this.update(record => {
      record.amount = amount;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updatePortion(portionId?: string): Promise<void> {
    await this.update(record => {
      record.portionId = portionId;
      record.updatedAt = Date.now();
    });
  }

  // Get the actual gram weight for this meal food entry
  async getGramWeight(): Promise<number> {
    if (this.portionId) {
      const portion = await this.portion;
      if (portion) {
        return this.amount * portion.gramWeight;
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
  }> {
    const food = await this.food;
    
    if (this.portionId) {
      const portion = await this.portion;
      if (portion) {
        // Use portion-based calculation
        const multiplier = this.amount; // Number of portions
        return {
          calories: food.calories * (portion.gramWeight / food.servingAmount) * multiplier,
          protein: food.protein * (portion.gramWeight / food.servingAmount) * multiplier,
          carbs: food.carbs * (portion.gramWeight / food.servingAmount) * multiplier,
          fat: food.fat * (portion.gramWeight / food.servingAmount) * multiplier,
        };
      }
    }
    
    // Use direct amount (assume grams)
    return food.getNutrientsForAmount(this.amount, 'g');
  }
}
