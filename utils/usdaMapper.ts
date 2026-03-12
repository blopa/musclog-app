import { UnifiedFoodResult } from '../hooks/useUnifiedFoodSearch';
import i18n from '../lang/lang';
import { components } from '../types/usda-types';

type USDAFood = components['schemas']['SearchResultFood'];

export function mapUSDANutritient(nutrients: any[] | undefined, nutrientNumber: string): number | undefined {
  if (!nutrients) {
    return undefined;
  }
  const nutrient = nutrients.find((n: any) => {
    const num = n.nutrientNumber || n.number || n.nutrient?.number;
    return String(num) === nutrientNumber;
  });
  return nutrient ? nutrient.value ?? nutrient.amount : undefined;
}

export function mapUSDAFoodToUnified(food: USDAFood): UnifiedFoodResult {
  const nutrients = food.foodNutrients;

  const calories = mapUSDANutritient(nutrients, '1008') ?? mapUSDANutritient(nutrients, '208');
  const protein = mapUSDANutritient(nutrients, '1003') ?? mapUSDANutritient(nutrients, '203');
  const carbs = mapUSDANutritient(nutrients, '1005') ?? mapUSDANutritient(nutrients, '205');
  const fat = mapUSDANutritient(nutrients, '1004') ?? mapUSDANutritient(nutrients, '204');
  const fiber = mapUSDANutritient(nutrients, '1079') ?? mapUSDANutritient(nutrients, '291');

  // Brand can be brandOwner or brandName
  const brand = food.brandOwner || (food as any).brandName;

  const servingSizeValue = (food as any).servingSize;
  const servingSizeUnit = (food as any).servingSizeUnit || 'g';
  const servingSize = servingSizeValue ? `${servingSizeValue}${servingSizeUnit}` : '100g';

  const description = calories !== undefined
    ? i18n.t('food.descriptionFormat', {
        brand: brand || food.dataType || i18n.t('food.generic'),
        calories: Math.round(calories),
        amount: servingSize,
        unit: '',
      })
    : `${brand || food.dataType || i18n.t('food.generic')} • ${i18n.t('food.notAvailable')}`;

  return {
    id: String(food.fdcId),
    name: food.description,
    description,
    brand,
    serving_size: servingSize,
    calories: calories !== undefined ? Math.round(calories) : undefined,
    protein,
    carbs,
    fat,
    fiber,
    source: 'usda',
    _raw: food,
  };
}
