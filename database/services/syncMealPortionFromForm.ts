import { FoodPortionService } from './FoodPortionService';

interface SyncMealPortionFromFormOptions {
  nutritionBasis: 'per_recipe' | 'per_serving' | 'per_gram';
  defaultPortionName: string;
  mealName: string;
  fallbackPortionName: string;
  servingGrams: number;
}

/** Rebuilds a meal's private default portion from create/edit form state. */
export async function syncMealPortionFromForm(
  mealId: string,
  options: SyncMealPortionFromFormOptions
): Promise<void> {
  await FoodPortionService.clearMealPortions(mealId);

  if (options.nutritionBasis === 'per_recipe') {
    return;
  }

  const portionName =
    options.defaultPortionName.trim() || options.mealName.trim() || options.fallbackPortionName;

  if (options.nutritionBasis === 'per_serving') {
    const portion = await FoodPortionService.createPrivateNamedPortion(portionName, 'meal', mealId);
    await FoodPortionService.addPortionToMeal(mealId, portion.id, true);
    return;
  }

  const portion = await FoodPortionService.createFoodPortion(
    portionName,
    Math.max(1, options.servingGrams),
    undefined,
    'custom',
    {
      dedupe: false,
      kind: 'mass',
      ownerId: mealId,
      ownerType: 'meal',
      scope: 'private',
    }
  );
  await FoodPortionService.addPortionToMeal(mealId, portion.id, true);
}
