import { Model, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import { FoodPortion, MealFood, NutritionLog } from './index';

export interface MicrosData {
  sugars?: number;
  saturatedFat?: number;
  sodium?: number;
  salt?: number;
  [key: string]: number | undefined;
}

export default class Food extends Model {
  static table = 'foods';

  static associations = {
    food_portions: { type: 'has_many' as const, foreignKey: 'food_id' },
    nutrition_logs: { type: 'has_many' as const, foreignKey: 'food_id' },
    meal_foods: { type: 'has_many' as const, foreignKey: 'food_id' },
  };

  @field('is_ai_generated') isAiGenerated?: boolean;
  @field('name') name?: string;
  @field('brand') brand?: string;
  @field('barcode') barcode?: string;

  // Macros per standard serving (usually 100g or 1 serving)
  @field('calories') calories?: number;
  @field('protein') protein?: number;
  @field('carbs') carbs?: number;
  @field('fat') fat?: number;
  @field('fiber') fiber?: number;

  // Base measurement that the above numbers refer to
  @field('serving_unit') servingUnit?: string; // 'g', 'ml', 'oz'
  @field('serving_amount') servingAmount?: number; // e.g., 100

  // Extended data stored as JSON
  @json('micros_json', (data: any): MicrosData => {
    if (typeof data === 'object' && data !== null) {
      return {
        sugars: typeof data.sugars === 'number' ? data.sugars : undefined,
        saturatedFat: typeof data.saturatedFat === 'number' ? data.saturatedFat : undefined,
        sodium: typeof data.sodium === 'number' ? data.sodium : undefined,
        salt: typeof data.salt === 'number' ? data.salt : undefined,
      };
    }
    return {};
  })
  micros?: MicrosData;

  @field('is_favorite') isFavorite?: boolean;
  @field('source') source?: string; // 'user', 'api', 'scanned'
  @field('image_url') imageUrl?: string; // URL to product image

  @field('created_at') createdAt?: number;
  @field('updated_at') updatedAt?: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_portions') portions?: Query<FoodPortion>;
  @children('nutrition_logs') nutritionLogs?: Query<NutritionLog>;
  @children('meal_foods') mealFoods?: Query<MealFood>;

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
  async updateMicros(micros: MicrosData): Promise<void> {
    await this.update((record) => {
      record.micros = micros;
      record.updatedAt = Date.now();
    });
  }

  // Helper methods for nutritional calculations
  getCaloriesPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.calories ?? 0;
    }
    return ((this.calories ?? 0) / (this.servingAmount ?? 1)) * 100;
  }

  getProteinPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.protein ?? 0;
    }
    return ((this.protein ?? 0) / (this.servingAmount ?? 1)) * 100;
  }

  getCarbsPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.carbs ?? 0;
    }
    return ((this.carbs ?? 0) / (this.servingAmount ?? 1)) * 100;
  }

  getFiberPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.fiber ?? 0;
    }
    return ((this.fiber ?? 0) / (this.servingAmount ?? 1)) * 100;
  }

  getFatPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.fat ?? 0;
    }
    return ((this.fat ?? 0) / (this.servingAmount ?? 1)) * 100;
  }

  getNutrientsForAmount(
    amount: number,
    unit: string = this.servingUnit ?? 'g'
  ): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micros?: MicrosData;
  } {
    // Prevent division by zero
    if ((this.servingAmount ?? 0) <= 0) {
      console.error('Invalid serving amount:', this.servingAmount);
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };
    }

    // Convert to base unit (grams) for calculation
    let multiplier = 1;

    if (unit === 'g') {
      multiplier = amount / (this.servingAmount ?? 1);
    } else if (unit === 'ml' && (this.servingUnit ?? 'g') === 'ml') {
      multiplier = amount / (this.servingAmount ?? 1);
    } else {
      // For other units, assume they're equivalent to the base serving amount
      multiplier = amount / (this.servingAmount ?? 1);
    }

    // Ensure multiplier is a valid number
    if (!isFinite(multiplier) || isNaN(multiplier)) {
      console.error('Invalid multiplier calculated:', multiplier);
      multiplier = 1;
    }

    return {
      calories: (this.calories ?? 0) * multiplier,
      protein: (this.protein ?? 0) * multiplier,
      carbs: (this.carbs ?? 0) * multiplier,
      fat: (this.fat ?? 0) * multiplier,
      fiber: (this.fiber ?? 0) * multiplier,
      micros: this.micros
        ? Object.fromEntries(
            Object.entries(this.micros).map(([key, value]) => [
              key,
              value ? value * multiplier : undefined,
            ])
          )
        : undefined,
    };
  }
}
