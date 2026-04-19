import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import { decryptJson, decryptNumber, decryptOptionalString } from '@/database/encryptionHelpers';

import type { MicrosData } from './Food';
import Food from './Food';
import FoodPortion from './FoodPortion';
import SavedForLaterGroup from './SavedForLaterGroup';

export default class SavedForLaterItem extends Model {
  static table = 'saved_for_later_items';

  static associations = {
    saved_for_later_groups: { type: 'belongs_to' as const, key: 'group_id' },
    foods: { type: 'belongs_to' as const, key: 'food_id' },
    food_portions: { type: 'belongs_to' as const, key: 'portion_id' },
  };

  @field('group_id') groupId!: string;
  @field('food_id') foodId?: string;
  @field('amount') amount!: number;
  @field('portion_id') portionId?: string;

  @field('logged_food_name') loggedFoodNameRaw?: string;
  @field('logged_calories') loggedCaloriesRaw!: string;
  @field('logged_protein') loggedProteinRaw!: string;
  @field('logged_carbs') loggedCarbsRaw!: string;
  @field('logged_fat') loggedFatRaw!: string;
  @field('logged_fiber') loggedFiberRaw!: string;
  @field('logged_micros_json') loggedMicrosRaw?: string;

  @field('logged_meal_name') loggedMealName?: string;
  @field('original_group_id') originalGroupId?: string;

  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('saved_for_later_groups', 'group_id') group!: SavedForLaterGroup;
  @relation('foods', 'food_id') food!: Food;
  @relation('food_portions', 'portion_id') portion?: FoodPortion;

  async getDecryptedSnapshot() {
    const [
      loggedFoodName,
      loggedCalories,
      loggedProtein,
      loggedCarbs,
      loggedFat,
      loggedFiber,
      loggedMicros,
    ] = await Promise.all([
      decryptOptionalString(this.loggedFoodNameRaw),
      decryptNumber(this.loggedCaloriesRaw),
      decryptNumber(this.loggedProteinRaw),
      decryptNumber(this.loggedCarbsRaw),
      decryptNumber(this.loggedFatRaw),
      decryptNumber(this.loggedFiberRaw),
      decryptJson(this.loggedMicrosRaw),
    ]);
    return {
      loggedFoodName: loggedFoodName || undefined,
      loggedCalories,
      loggedProtein,
      loggedCarbs,
      loggedFat,
      loggedFiber,
      loggedMicros: Object.keys(loggedMicros).length > 0 ? (loggedMicros as MicrosData) : undefined,
    };
  }

  async getGramWeight(): Promise<number> {
    if (this.portionId) {
      try {
        const portion = await this.portion;
        if (portion) {
          return this.amount * (portion.gramWeight ?? 0);
        }
      } catch {
        // Fallback
      }
    }
    return this.amount;
  }

  async getNutrients() {
    const totalGrams = await this.getGramWeight();
    const scale = totalGrams / 100;
    const s = await this.getDecryptedSnapshot();
    return {
      calories: (s.loggedCalories ?? 0) * scale,
      protein: (s.loggedProtein ?? 0) * scale,
      carbs: (s.loggedCarbs ?? 0) * scale,
      fat: (s.loggedFat ?? 0) * scale,
      fiber: (s.loggedFiber ?? 0) * scale,
      alcohol: (s.loggedMicros?.alcohol ?? 0) * scale,
    };
  }
}
