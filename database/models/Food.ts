import { Model, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import { FoodPortion, MealFood, NutritionLog } from './index';

export interface MicrosData {
  // Basic micronutrients
  sugar?: number;
  alcohol?: number;
  monoFat?: number;
  polyFat?: number;

  // Fats
  monounsaturatedFat?: number;
  saturatedFat?: number;
  transFat?: number;
  unsaturatedFat?: number;

  // Vitamins
  zinc?: number;
  vitaminK?: number;
  vitaminC?: number;
  vitaminB12?: number;
  vitaminA?: number;
  vitaminE?: number;
  thiamin?: number;
  selenium?: number;
  vitaminB6?: number;
  pantothenicAcid?: number;
  niacin?: number;
  calcium?: number;
  iodine?: number;
  molybdenum?: number;
  vitaminD?: number;
  manganese?: number;
  magnesium?: number;
  folicAcid?: number;
  copper?: number;
  iron?: number;
  chromium?: number;
  caffeine?: number;
  cholesterol?: number;
  phosphorus?: number;
  chloride?: number;
  folate?: number;
  biotin?: number;
  sodium?: number;
  riboflavin?: number;
  potassium?: number;

  // Legacy fields for backward compatibility
  sugars?: number;
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
  @field('fiber') fiber!: number;

  // Base measurement that the above numbers refer to
  @field('serving_unit') servingUnit!: string; // 'g', 'ml', 'oz'
  @field('serving_amount') servingAmount!: number; // e.g., 100

  // Extended data stored as JSON
  @json('micros_json', (data: any): MicrosData => {
    if (typeof data === 'object' && data !== null) {
      return {
        // Basic micronutrients
        sugar: typeof data.sugar === 'number' ? data.sugar : undefined,
        alcohol: typeof data.alcohol === 'number' ? data.alcohol : undefined,
        monoFat: typeof data.monoFat === 'number' ? data.monoFat : undefined,
        polyFat: typeof data.polyFat === 'number' ? data.polyFat : undefined,

        // Fats
        monounsaturatedFat:
          typeof data.monounsaturatedFat === 'number' ? data.monounsaturatedFat : undefined,
        saturatedFat: typeof data.saturatedFat === 'number' ? data.saturatedFat : undefined,
        transFat: typeof data.transFat === 'number' ? data.transFat : undefined,
        unsaturatedFat: typeof data.unsaturatedFat === 'number' ? data.unsaturatedFat : undefined,

        // Vitamins
        zinc: typeof data.zinc === 'number' ? data.zinc : undefined,
        vitaminK: typeof data.vitaminK === 'number' ? data.vitaminK : undefined,
        vitaminC: typeof data.vitaminC === 'number' ? data.vitaminC : undefined,
        vitaminB12: typeof data.vitaminB12 === 'number' ? data.vitaminB12 : undefined,
        vitaminA: typeof data.vitaminA === 'number' ? data.vitaminA : undefined,
        vitaminE: typeof data.vitaminE === 'number' ? data.vitaminE : undefined,
        thiamin: typeof data.thiamin === 'number' ? data.thiamin : undefined,
        selenium: typeof data.selenium === 'number' ? data.selenium : undefined,
        vitaminB6: typeof data.vitaminB6 === 'number' ? data.vitaminB6 : undefined,
        pantothenicAcid:
          typeof data.pantothenicAcid === 'number' ? data.pantothenicAcid : undefined,
        niacin: typeof data.niacin === 'number' ? data.niacin : undefined,
        calcium: typeof data.calcium === 'number' ? data.calcium : undefined,
        iodine: typeof data.iodine === 'number' ? data.iodine : undefined,
        molybdenum: typeof data.molybdenum === 'number' ? data.molybdenum : undefined,
        vitaminD: typeof data.vitaminD === 'number' ? data.vitaminD : undefined,
        manganese: typeof data.manganese === 'number' ? data.manganese : undefined,
        magnesium: typeof data.magnesium === 'number' ? data.magnesium : undefined,
        folicAcid: typeof data.folicAcid === 'number' ? data.folicAcid : undefined,
        copper: typeof data.copper === 'number' ? data.copper : undefined,
        iron: typeof data.iron === 'number' ? data.iron : undefined,
        chromium: typeof data.chromium === 'number' ? data.chromium : undefined,
        caffeine: typeof data.caffeine === 'number' ? data.caffeine : undefined,
        cholesterol: typeof data.cholesterol === 'number' ? data.cholesterol : undefined,
        phosphorus: typeof data.phosphorus === 'number' ? data.phosphorus : undefined,
        chloride: typeof data.chloride === 'number' ? data.chloride : undefined,
        folate: typeof data.folate === 'number' ? data.folate : undefined,
        biotin: typeof data.biotin === 'number' ? data.biotin : undefined,
        sodium: typeof data.sodium === 'number' ? data.sodium : undefined,
        riboflavin: typeof data.riboflavin === 'number' ? data.riboflavin : undefined,
        potassium: typeof data.potassium === 'number' ? data.potassium : undefined,

        // Legacy fields for backward compatibility
        sugars: typeof data.sugars === 'number' ? data.sugars : undefined,
        salt: typeof data.salt === 'number' ? data.salt : undefined,
      };
    }
    return {};
  })
  micros?: MicrosData;

  @field('is_favorite') isFavorite!: boolean;
  @field('source') source?: string; // 'user', 'api', 'scanned'
  @field('image_url') imageUrl?: string; // URL to product image

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_portions') portions!: Query<FoodPortion>;
  @children('nutrition_logs') nutritionLogs!: Query<NutritionLog>;
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
  async updateMicros(micros: MicrosData): Promise<void> {
    await this.update((record) => {
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

  getFiberPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.fiber;
    }
    return (this.fiber / this.servingAmount) * 100;
  }

  getFatPer100g(): number {
    if (this.servingUnit === 'g' && this.servingAmount === 100) {
      return this.fat;
    }
    return (this.fat / this.servingAmount) * 100;
  }

  getNutrientsForAmount(
    amount: number,
    unit: string = this.servingUnit
  ): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micros?: MicrosData;
  } {
    // Prevent division by zero
    if (this.servingAmount <= 0) {
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
      multiplier = amount / this.servingAmount;
    } else if (unit === 'ml' && this.servingUnit === 'ml') {
      multiplier = amount / this.servingAmount;
    } else {
      // For other units, assume they're equivalent to the base serving amount
      multiplier = amount / this.servingAmount;
    }

    // Ensure multiplier is a valid number
    if (!isFinite(multiplier) || isNaN(multiplier)) {
      console.error('Invalid multiplier calculated:', multiplier);
      multiplier = 1;
    }

    return {
      calories: this.calories * multiplier,
      protein: this.protein * multiplier,
      carbs: this.carbs * multiplier,
      fat: this.fat * multiplier,
      fiber: this.fiber * multiplier,
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
