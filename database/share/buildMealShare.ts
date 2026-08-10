import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import type MealFood from '@/database/models/MealFood';
import type MealFoodPortion from '@/database/models/MealFoodPortion';
import { MealService } from '@/database/services/MealService';
import {
  type MealShareEnvelope,
  type MealShareIngredient,
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  MusclogShareError,
} from '@/utils/share/shareEnvelope';
import { MEAL_SHARE_SPEC } from '@/utils/share/shareKinds';

import {
  applyCarriedFoodImage,
  applyShareImage,
  defaultPortionLink,
  isActive,
  optionalNumber,
  prepareShareImage,
  type ShareBuild,
  shareRow,
  shareSenderPayload,
} from './shareRecords';

export interface BuildMealShareOptions {
  includeImage: boolean;
}

async function relatedFood(mealFood: MealFood): Promise<Food | undefined> {
  try {
    const food = await mealFood.food;
    return isActive(food) ? food : undefined;
  } catch {
    return undefined;
  }
}

async function relatedPortion(mealFood: MealFood): Promise<FoodPortion | undefined> {
  if (!mealFood.portionId) {
    return undefined;
  }
  try {
    const portion = await mealFood.portion;
    return isActive(portion) ? portion : undefined;
  } catch {
    return undefined;
  }
}

export async function buildMealShareEnvelope(
  mealId: string,
  options: BuildMealShareOptions
): Promise<ShareBuild<MealShareEnvelope>> {
  const mealData = await MealService.getMealWithFoods(mealId);
  if (!mealData) {
    throw new Error('Meal not found');
  }
  const { meal } = mealData;

  // Every read below is independent per ingredient, so they run together rather than one
  // round trip at a time — a 20-ingredient recipe was 60+ serialized queries. Order is preserved
  // because `Promise.all` resolves positionally, which the envelope's row order depends on.
  const resolvedMealFoods = await Promise.all(
    mealData.foods.map(async (model) => ({
      food: await relatedFood(model),
      model,
      portion: await relatedPortion(model),
    }))
  );

  const foods = new Map<string, Food>();
  const portions = new Map<string, FoodPortion>();
  const mealFoods: { model: MealFood; food: Food; portion?: FoodPortion }[] = [];
  for (const { food, model, portion } of resolvedMealFoods) {
    if (!food) {
      continue;
    }
    foods.set(food.id, food);
    if (portion) {
      portions.set(portion.id, portion);
    }
    mealFoods.push({ food, model, portion });
  }

  if (mealFoods.length === 0) {
    throw new MusclogShareError('no-ingredients', 'Cannot share a meal without ingredients');
  }

  const mealPortionLinks = await database
    .get<MealFoodPortion>('meal_food_portions')
    .query(Q.where('meal_id', meal.id), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  const resolvedMealPortionLinks = await Promise.all(
    mealPortionLinks.map(async (link) => {
      try {
        const portion = await link.foodPortion;
        return isActive(link) && isActive(portion) ? { link, portion } : undefined;
      } catch {
        // A broken optional portion link does not make the meal itself unshareable.
        return undefined;
      }
    })
  );

  const carriedMealPortionLinks: MealFoodPortion[] = [];
  for (const resolved of resolvedMealPortionLinks) {
    if (resolved) {
      portions.set(resolved.portion.id, resolved.portion);
      carriedMealPortionLinks.push(resolved.link);
    }
  }

  const defaultFoodLinks: FoodFoodPortion[] = [];
  for (const linked of await Promise.all([...foods.values()].map(defaultPortionLink))) {
    if (linked) {
      portions.set(linked.portion.id, linked.portion);
      defaultFoodLinks.push(linked.link);
    }
  }

  const ingredients: MealShareIngredient[] = await Promise.all(
    mealFoods.map(async ({ food, model, portion }): Promise<MealShareIngredient> => {
      const nutrients = await model.getNutrients();
      const unit =
        food.resolvedNutritionBasis === 'per_serving' ? 'serving' : portion ? 'portion' : 'g';
      return {
        amount: model.amount,
        calories: nutrients.calories,
        name: food.name,
        ...(unit === 'portion' && portion?.name ? { portionName: portion.name } : undefined),
        unit,
      };
    })
  );

  const mealRow = shareRow(meal);
  const mealImage = await prepareShareImage(meal.imageUrl, 'mealImage', options.includeImage);
  applyShareImage(mealRow, 'image_url', mealImage);
  const assets: MealShareEnvelope['assets'] = mealImage.asset
    ? { mealImage: mealImage.asset }
    : undefined;

  const foodRows = [...foods.values()].map((food) => {
    const row = shareRow(food);
    applyCarriedFoodImage(row, options.includeImage);
    return row;
  });

  const mealFoodRows = mealFoods.map(({ model, portion }) => {
    const row = shareRow(model);
    if (model.portionId && !portion) {
      delete row.portion_id;
    }
    return row;
  });

  return {
    envelope: {
      _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
      ...(assets ? { assets } : undefined),
      createdAtMs: Date.now(),
      kind: 'meal',
      kindVersion: MEAL_SHARE_SPEC.kindVersion,
      records: {
        food_food_portions: defaultFoodLinks.map(shareRow),
        food_portions: [...portions.values()].map(shareRow),
        foods: foodRows,
        meal_food_portions: carriedMealPortionLinks.map(shareRow),
        meal_foods: mealFoodRows,
        meals: [mealRow],
      },
      rootId: meal.id,
      rootTable: MEAL_SHARE_SPEC.rootTable,
      summary: {
        description: meal.description || undefined,
        // The value, not the asset: a remote photo rides along as a URL and embeds nothing.
        hasImage: Boolean(mealImage.value),
        ingredients,
        name: meal.name,
        nutritionBasis: meal.resolvedNutritionBasis,
        preparedWeightGrams: optionalNumber(meal.preparedWeightGrams),
        recipeServingsCount: optionalNumber(meal.recipeServingsCount),
        servingGrams: optionalNumber(meal.servingGrams),
        totals: await meal.getTotalNutrients(),
      },
    },
    // Only the meal's OWN photo counts here: an ingredient's photo is never embedded
    // (`applyCarriedFoodImage`), so it can neither cost transfer time nor go missing.
    photo: mealImage.outcome,
  };
}

export async function buildMealSharePayload(mealId: string, options: BuildMealShareOptions) {
  return shareSenderPayload(await buildMealShareEnvelope(mealId, options));
}
