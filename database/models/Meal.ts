import { Model, Query } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

import { MealFood } from './index';

export default class Meal extends Model {
  static table = 'meals';

  static associations = {
    meal_foods: { type: 'has_many' as const, foreignKey: 'meal_id' },
  };

  @field('is_ai_generated') isAiGenerated!: boolean;
  @field('name') name!: string;
  @field('description') description?: string;
  @field('image_url') imageUrl?: string; // URL to meal image
  @field('is_favorite') isFavorite!: boolean;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('meal_foods') mealFoods!: Query<MealFood>;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update((record) => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async toggleFavorite(): Promise<void> {
    await this.update((record) => {
      record.isFavorite = !record.isFavorite;
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
  async updateDescription(description?: string): Promise<void> {
    await this.update((record) => {
      record.description = description;
      record.updatedAt = Date.now();
    });
  }

  // Calculate total macros for the meal
  async getTotalNutrients(): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> {
    const mealFoods = await this.mealFoods.fetch();

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    for (const mealFood of mealFoods) {
      const nutrients = await mealFood.getNutrients();

      totalCalories += nutrients.calories;
      totalProtein += nutrients.protein;
      totalCarbs += nutrients.carbs;
      totalFat += nutrients.fat;
      totalFiber += nutrients.fiber;
    }

    return {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      fiber: totalFiber,
    };
  }

  // Get nutrients per serving (assuming meal is divided into servings)
  async getNutrientsPerServings(servings: number = 1): Promise<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  }> {
    const totals = await this.getTotalNutrients();

    return {
      calories: totals.calories / servings,
      protein: totals.protein / servings,
      carbs: totals.carbs / servings,
      fat: totals.fat / servings,
      fiber: totals.fiber / servings,
    };
  }
}
