import { Units } from '@/constants/settings';
import { UnifiedFoodResult } from '@/hooks/useUnifiedFoodSearch';
import i18n from '@/lang/lang';
import { components } from '@/types/usda-types';

import { totalCarbsForFoodSource } from './carbsConvention';
import { resolveRoundedPer100gCaloriesForDisplay } from './inferCaloriesFromMacros';
import { gramsToDisplay } from './unitConversion';
import { getMassUnitI18nKey } from './units';

export type USDAFood = components['schemas']['SearchResultFood'];
export type USDANutrient = {
  nutrientNumber?: string | number;
  number?: string | number;
  nutrient?: { number?: string | number };
  value?: number;
  amount?: number;
};
export type USDAFoodWithServingFields = USDAFood & {
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
};

export function mapUSDANutritient(
  nutrients: USDANutrient[] | undefined,
  nutrientNumber: string
): number | undefined {
  if (!nutrients || !Array.isArray(nutrients)) {
    return undefined;
  }

  const nutrient = nutrients.find((n) => {
    const num = n.nutrientNumber || n.number || n.nutrient?.number;
    return String(num) === nutrientNumber;
  });

  return nutrient ? (nutrient.value ?? nutrient.amount) : undefined;
}

export function mapUSDAFoodToUnified(food: USDAFood, units: Units = 'metric'): UnifiedFoodResult {
  const brandedFood = food as USDAFoodWithServingFields;
  const nutrients = food.foodNutrients as USDANutrient[] | undefined;

  const rawCalories = mapUSDANutritient(nutrients, '1008') ?? mapUSDANutritient(nutrients, '208');
  const protein = mapUSDANutritient(nutrients, '1003') ?? mapUSDANutritient(nutrients, '203');
  // USDA nutrient 1005 "Carbohydrate, by difference" already includes fiber (= canonical total).
  const carbs = mapUSDANutritient(nutrients, '1005') ?? mapUSDANutritient(nutrients, '205');
  const fat = mapUSDANutritient(nutrients, '1004') ?? mapUSDANutritient(nutrients, '204');
  const fiber = mapUSDANutritient(nutrients, '1079') ?? mapUSDANutritient(nutrients, '291');

  const roundedCalories = resolveRoundedPer100gCaloriesForDisplay({
    calories: rawCalories,
    protein,
    carbs,
    fat,
    fiber,
  });
  const calories = roundedCalories > 0 ? roundedCalories : undefined;

  // Brand can be brandOwner or brandName
  const brand = food.brandOwner || brandedFood.brandName;

  const servingSizeValue = brandedFood.servingSize;
  const servingSizeUnit = brandedFood.servingSizeUnit || 'g';
  const servingSize = servingSizeValue ? `${servingSizeValue}${servingSizeUnit}` : '100g';

  // When the USDA serving is in grams, convert to oz for imperial users
  let descriptionAmount: number | string;
  let descriptionUnit: string;
  if (servingSizeUnit === 'g') {
    const rawGrams = servingSizeValue ?? 100;
    descriptionAmount =
      units === 'imperial' ? Math.round(gramsToDisplay(rawGrams, units)) : rawGrams;
    descriptionUnit = i18n.t(getMassUnitI18nKey(units));
  } else {
    // Non-gram unit (ml, cup, etc.) — keep as-is combined in the amount field
    descriptionAmount = servingSize;
    descriptionUnit = '';
  }

  const description =
    calories !== undefined
      ? i18n.t('food.descriptionFormat', {
          brand: brand || food.dataType || i18n.t('food.generic'),
          calories,
          amount: descriptionAmount,
          unit: descriptionUnit,
        })
      : `${brand || food.dataType || i18n.t('food.generic')} • ${i18n.t('food.notAvailable')}`;

  return {
    id: String(food.fdcId),
    name: food.description,
    description,
    brand,
    serving_size: servingSize,
    calories: calories !== undefined ? Math.max(0, calories) : undefined,
    protein: protein !== undefined ? Math.max(0, protein) : undefined,
    carbs:
      carbs !== undefined
        ? totalCarbsForFoodSource('usda', { carbs, fiber: fiber ?? 0 })
        : undefined,
    fat: fat !== undefined ? Math.max(0, fat) : undefined,
    fiber: fiber !== undefined ? Math.max(0, fiber) : undefined,
    source: 'usda',
    _raw: food,
  };
}
