import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import FoodPortion from './FoodPortion';
import Meal from './Meal';

export default class MealFoodPortion extends Model {
  static table = 'meal_food_portions';

  static associations = {
    meals: { type: 'belongs_to' as const, key: 'meal_id' },
    food_portions: { type: 'belongs_to' as const, key: 'food_portion_id' },
  };

  @field('meal_id') mealId!: string;
  @field('food_portion_id') foodPortionId!: string;
  @field('is_default') isDefault!: boolean;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('meals', 'meal_id') meal!: Meal;
  @relation('food_portions', 'food_portion_id') foodPortion!: FoodPortion;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }
}
