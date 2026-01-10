import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class FoodLog extends Model {
  static table = 'food_logs';

  @field('food_name') foodName!: string;
  @field('external_id') externalId?: string;
  @field('external_source') externalSource?: string;
  @field('calories') calories!: number;
  @field('protein') protein!: number;
  @field('carbs') carbs!: number;
  @field('fat') fat!: number;
  @field('fiber') fiber?: number;
  @field('sugar') sugar?: number;
  @field('meal_type') mealType!: string;
  @field('grams') grams!: number;
  @field('consumed_at') consumedAt!: number;

  // Computed property for calorie summary
  get calorieSummary() {
    return {
      calories: this.calories,
      protein: this.protein,
      carbs: this.carbs,
      fat: this.fat,
      fiber: this.fiber || 0,
      sugar: this.sugar || 0,
    };
  }
}
