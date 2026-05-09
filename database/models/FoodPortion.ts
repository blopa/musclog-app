import { Model } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

export default class FoodPortion extends Model {
  static table = 'food_portions';

  static associations = {
    food_food_portions: { type: 'has_many' as const, foreignKey: 'food_portion_id' },
    meal_food_portions: { type: 'has_many' as const, foreignKey: 'food_portion_id' },
    meal_foods: { type: 'has_many' as const, foreignKey: 'portion_id' },
    nutrition_logs: { type: 'has_many' as const, foreignKey: 'portion_id' },
  };

  @field('name') name!: string; // e.g., "Slice", "Cup", "Bowl"
  @field('gram_weight') gramWeight?: number; // How many grams is this portion?
  @field('icon') icon?: string; // e.g., 'droplet', 'scale', 'egg', 'cup'
  /** `'basic'` = seeded common portions; `'custom'` = item-created. */
  @field('source') source?: string; // 'basic' or 'custom'
  @field('kind') kind?: string; // 'mass' | 'named'
  @field('scope') scope?: string; // 'global' | 'private'
  @field('owner_type') ownerType?: string; // 'food' | 'meal'
  @field('owner_id') ownerId?: string;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_food_portions') foodFoodPortions!: any; // Query<FoodFoodPortion>

  get resolvedKind(): 'mass' | 'named' {
    return this.kind === 'named' ? 'named' : 'mass';
  }

  get resolvedSource(): 'basic' | 'custom' {
    return this.source === 'custom' ? 'custom' : 'basic';
  }

  get resolvedScope(): 'global' | 'private' {
    return this.scope === 'private' ? 'private' : 'global';
  }

  @writer
  async markAsDeleted(): Promise<void> {
    if (this.resolvedSource === 'basic') {
      throw new Error('Cannot delete a built-in app food portion.');
    }

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
      record.kind = 'mass';
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
}
