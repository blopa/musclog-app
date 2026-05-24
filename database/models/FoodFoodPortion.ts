import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import Food from './Food';
import FoodPortion from './FoodPortion';

/**
 * Junction table linking Foods to FoodPortions (Many-to-Many relationship)
 * Each entry represents a portion that can be used with a specific food
 */
export default class FoodFoodPortion extends Model {
  static table = 'food_food_portions';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'food_portion_id' },
  };

  @field('food_id') declare foodId: string;
  @field('food_portion_id') declare foodPortionId: string;
  /** Which linked portion is the default for this food. */
  @field('is_default') declare isDefault: boolean;

  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @relation('foods', 'food_id') declare food: Food;
  @relation('food_portions', 'food_portion_id') declare foodPortion: FoodPortion;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async setAsDefault(): Promise<void> {
    await this.update((record) => {
      record.isDefault = true;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async unsetDefault(): Promise<void> {
    await this.update((record) => {
      record.isDefault = false;
      record.updatedAt = Date.now();
    });
  }
}
