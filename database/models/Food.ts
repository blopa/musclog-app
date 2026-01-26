import { Model, Query } from '@nozbe/watermelondb';
import { field, children, writer, json } from '@nozbe/watermelondb/decorators';
import { FoodPortion, NutritionLog, MealFood } from './index';

export interface MicrosData {
  fiber?: number;
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

  @field('is_ai_generated') isAiGenerated!: boolean;
  @field('name') name!: string;
  @field('brand') brand?: string;
  @field('barcode') barcode?: string;

  // Macros per standard serving (usually 100g or 1 serving)
  @field('calories') calories!: number;
  @field('protein') protein!: number;
  @field('carbs') carbs!: number;
  @field('fat') fat!: number;

  // Base measurement that the above numbers refer to
  @field('serving_unit') servingUnit!: string; // 'g', 'ml', 'oz'
  @field('serving_amount') servingAmount!: number; // e.g., 100

  // Extended data stored as JSON
  @json('micros_json', (data: any): MicrosData => {
    if (typeof data === 'object' && data !== null) {
      return {
        fiber: typeof data.fiber === 'number' ? data.fiber : undefined,
        sugars: typeof data.sugars === 'number' ? data.sugars : undefined,
        saturatedFat: typeof data.saturatedFat === 'number' ? data.saturatedFat : undefined,
        sodium: typeof data.sodium === 'number' ? data.sodium : undefined,
        salt: typeof data.salt === 'number' ? data.salt : undefined,
      };
    }
    return {};
  }) micros?: MicrosData;

  @field('is_favorite') isFavorite!: boolean;
  @field('source') source?: string; // 'user', 'api', 'scanned'

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_portions') portions!: Query<FoodPortion>;
  @children('nutrition_logs') nutritionLogs!: Query<NutritionLog>;
  @children('meal_foods') mealFoods!: Query<MealFood>;

  @writer
  async markAsDeleted(): Promise<void> {
    await this.update(record => {
      record.deletedAt = Date.now();
      record.updatedAt = Date.now();
    });
  }

  @writer
  async toggleFavorite(): Promise<void> {
    await this.update(record => {
      record.isFavorite = !record.isFavorite;
      record.updatedAt = Date.now();
    });
  }

  @writer
  async updateMicros(micros: MicrosData): Promise<void> {
    await this.update(record => {
      record.micros = micros;
      record.updatedAt = Date.now();
    });
  }

  // Helper methods for nutritional calculations
  getCaloriesPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.calories;
    }
    return (this.calories / this.servingAmount) * 100;
  }

  getProteinPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.protein;
    }
    return (this.protein / this.servingAmount) * 100;
  }

  getCarbsPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.carbs;
    }
    return (this.carbs / this.servingAmount) * 100;
  }

  getFatPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.fat;
    }
    return (this.fat / this.servingAmount) * 100;
  }

  getNutrientsForAmount(amount: number, unit: string = this.servingUnit): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    micros?: MicrosData;
  } {
    // Convert to base unit (grams) for calculation
    let multiplier = 1;
    
    if (unit === 'g') {
      multiplier = amount / this.servingAmount;
    } else if (unit === 'ml' && this.servingUnit === 'ml') {
      multiplier = amount / this.servingAmount;
    } else {
      // For other units, assume they're equivalent to the base serving amount
      multiplier = amount / this.servingAmount;
    }

    return {
      calories: this.calories * multiplier,
      protein: this.protein * multiplier,
      carbs: this.carbs * multiplier,
      fat: this.fat * multiplier,
      micros: this.micros ? Object.fromEntries(
        Object.entries(this.micros).map(([key, value]) => [key, value ? value * multiplier : undefined])
      ) : undefined,
    };
  }
}
