import { Model } from '@nozbe/watermelondb';
import { field, writer, relation } from '@nozbe/watermelondb/decorators';
import Food from './Food';

export default class FoodPortion extends Model {
  static table = 'food_portions';

  static associations = {
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    meal_foods: { type: 'has_many' as const, foreignKey: 'portion_id' },
    nutrition_logs: { type: 'has_many' as const, foreignKey: 'portion_id' },
  };

  @field('food_id') foodId!: string;
  @field('name') name!: string; // e.g., "Slice", "Cup", "Bowl"
  @field('gram_weight') gramWeight!: number; // How many grams is this portion?

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('foods', 'food_id') food!: Food;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update(record => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateName(name: string): Promise<void> {
    await this.update(record => {
      record.name = name;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateGramWeight(gramWeight: number): Promise<void> {
    await this.update(record => {
      record.gramWeight = gramWeight;
      record.updatedAt = Date.now();
    });
  }
}
