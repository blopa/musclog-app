import { Model } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

export default class FoodPortion extends Model {
  static table = 'food_portions';

  static associations = {
    food_food_portions: { type: 'has_many' as const, foreignKey: 'food_portion_id' },
    meal_foods: { type: 'has_many' as const, foreignKey: 'portion_id' },
    nutrition_logs: { type: 'has_many' as const, foreignKey: 'portion_id' },
  };

  @field('name') name!: string; // e.g., "Slice", "Cup", "Bowl"
  @field('gram_weight') gramWeight!: number; // How many grams is this portion?
  @field('is_default') isDefault!: boolean; // Whether this is the default portion for foods
  @field('icon') icon?: string; // e.g., 'droplet', 'scale', 'egg', 'cup'

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_food_portions') foodFoodPortions!: any; // Query<FoodFoodPortion>

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateName(name: string): Promise<void> {
    await this.update((record) => {
      record.name = name;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateGramWeight(gramWeight: number): Promise<void> {
    await this.update((record) => {
      record.gramWeight = gramWeight;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateIcon(icon: string | undefined): Promise<void> {
    await this.update((record) => {
      record.icon = icon;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateIsDefault(isDefault: boolean): Promise<void> {
    await this.update((record) => {
      record.isDefault = isDefault;
      record.updatedAt = Date.now();
    });
  }
}
