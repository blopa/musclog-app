import { Model, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import { FoodFoodPortion, MealFood, NutritionLog } from './index';

// TODO: import data from https://www.eurofir.org/food-information/food-composition-databases/
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

  [key: string]: number | undefined;
}

export type FoodNutritionBasis = 'per_100g' | 'per_serving';

export interface FoodLabels {
  organic?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  palmOilFree?: boolean;
  fairTrade?: boolean;
  highProtein?: boolean;
  highFiber?: boolean;
}

export default class Food extends Model {
  static table = 'foods';

  static associations = {
    food_food_portions: { type: 'has_many' as const, foreignKey: 'food_id' },
    nutrition_logs: { type: 'has_many' as const, foreignKey: 'food_id' },
    meal_foods: { type: 'has_many' as const, foreignKey: 'food_id' },
  };

  @field('is_ai_generated') declare isAiGenerated: boolean;
  @field('name') declare name: string;
  @field('brand') brand?: string;
  @field('barcode') barcode?: string;
  @field('description') description?: string;
  @field('external_id') externalId?: string;

  // Macros per standard serving (usually 100g or 1 serving)
  @field('calories') declare calories: number;
  @field('protein') declare protein: number;
  @field('carbs') declare carbs: number;
  @field('fat') declare fat: number;
  @field('fiber') declare fiber: number;
  @field('nutriscore') nutriscore?: string;
  @field('ecoscore') ecoscore?: string;
  @field('nova_group') novaGroup?: number;

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
      };
    }

    return {};
  })
  micros?: MicrosData;

  @json('labels_json', (data: any): FoodLabels => {
    if (typeof data === 'object' && data !== null) {
      return {
        organic: typeof data.organic === 'boolean' ? data.organic : undefined,
        vegan: typeof data.vegan === 'boolean' ? data.vegan : undefined,
        vegetarian: typeof data.vegetarian === 'boolean' ? data.vegetarian : undefined,
        palmOilFree: typeof data.palmOilFree === 'boolean' ? data.palmOilFree : undefined,
        fairTrade: typeof data.fairTrade === 'boolean' ? data.fairTrade : undefined,
        highProtein: typeof data.highProtein === 'boolean' ? data.highProtein : undefined,
        highFiber: typeof data.highFiber === 'boolean' ? data.highFiber : undefined,
      };
    }

    return {};
  })
  labels?: FoodLabels;

  @field('is_favorite') declare isFavorite: boolean;
  @field('source') source?: string; // 'user', 'usda', 'ai', 'openfood', 'foundation'
  @field('image_url') imageUrl?: string; // URL to product image
  @field('nutrition_basis') nutritionBasis?: FoodNutritionBasis;

  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('food_food_portions') declare foodPortions: Query<FoodFoodPortion>;
  @children('nutrition_logs') declare nutritionLogs: Query<NutritionLog>;
  @children('meal_foods') declare mealFoods: Query<MealFood>;

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
  /**
   * Get the default portion for this food
   */
  async getDefaultPortionAsync() {
    try {
      const ffp = await this.foodPortions.fetch();
      const defaultEntry = ffp.find((entry) => entry.isDefault && !entry.deletedAt);
      if (defaultEntry) {
        return defaultEntry.foodPortion;
      }
    } catch (error) {
      console.warn('Error getting default portion:', error);
    }
    return null;
  }

  /**
   * Get all portions for this food
   */
  async getPortionsAsync() {
    try {
      const ffp = await this.foodPortions.fetch();
      const activeLinks = ffp.filter((fp) => !fp.deletedAt);
      const portions = await Promise.all(activeLinks.map((fp) => fp.foodPortion));

      return portions.filter((portion) => !portion?.deletedAt);
    } catch (error) {
      console.warn('Error getting portions:', error);
      return [];
    }
  }

  /**
   * Get the base gram weight for this food's default portion
   */
  async getBaseGramWeight(): Promise<number> {
    const portion = await this.getDefaultPortionAsync();
    return portion?.gramWeight ?? 100;
  }

  get resolvedNutritionBasis(): FoodNutritionBasis {
    return this.nutritionBasis === 'per_serving' ? 'per_serving' : 'per_100g';
  }

  getCaloriesPer100g(): number {
    // Macros are stored as-is; we assume they refer to a standard 100g serving
    // New code should use portion-based calculations instead
    return this.calories;
  }

  getProteinPer100g(): number {
    return this.protein;
  }

  getCarbsPer100g(): number {
    return this.carbs;
  }

  getFiberPer100g(): number {
    return this.fiber;
  }

  getFatPer100g(): number {
    return this.fat;
  }

  /**
   * Get nutrients for a given amount in grams
   * @param amountInGrams - Amount in grams to calculate nutrients for
   */
  getNutrientsForAmount(amountInGrams: number): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micros?: MicrosData;
  } {
    // All macros are stored per 100g by convention
    const gramMultiplier = amountInGrams / 100;

    return {
      calories: Math.max(0, this.calories) * gramMultiplier,
      protein: Math.max(0, this.protein) * gramMultiplier,
      carbs: Math.max(0, this.carbs) * gramMultiplier,
      fat: Math.max(0, this.fat) * gramMultiplier,
      fiber: Math.max(0, this.fiber) * gramMultiplier,
      micros: this.micros
        ? Object.fromEntries(
            Object.entries(this.micros).map(([key, value]) => [
              key,
              value ? Math.max(0, value) * gramMultiplier : undefined,
            ])
          )
        : undefined,
    };
  }

  getNutrientsForServingCount(servings: number): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    micros?: MicrosData;
  } {
    return {
      calories: Math.max(0, this.calories) * servings,
      protein: Math.max(0, this.protein) * servings,
      carbs: Math.max(0, this.carbs) * servings,
      fat: Math.max(0, this.fat) * servings,
      fiber: Math.max(0, this.fiber) * servings,
      micros: this.micros
        ? Object.fromEntries(
            Object.entries(this.micros).map(([key, value]) => [
              key,
              value ? Math.max(0, value) * servings : undefined,
            ])
          )
        : undefined,
    };
  }
}
