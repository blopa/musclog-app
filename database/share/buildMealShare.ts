import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import type MealFood from '@/database/models/MealFood';
import type MealFoodPortion from '@/database/models/MealFoodPortion';
import { MealService } from '@/database/services/MealService';
import { createThumbnail } from '@/utils/file';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import {
  type MealShareEnvelope,
  type MealShareIngredient,
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  SHARE_ASSET_REF_PREFIX,
  type ShareRow,
} from '@/utils/share/shareEnvelope';
import { MEAL_SHARE_SPEC } from '@/utils/share/shareKinds';

export interface BuildMealShareOptions {
  includeImage: boolean;
}

function shareRow(model: { id: string; _raw?: Record<string, unknown> }): ShareRow {
  const raw = { ...(model._raw ?? {}), id: model.id };
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) =>
        !['_changed', '_status', 'deleted_at'].includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== ''
    )
  );
}

function isActive(model: { deletedAt?: number } | null | undefined): boolean {
  return Boolean(model && model.deletedAt == null);
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

async function defaultPortionLink(
  food: Food
): Promise<{ link: FoodFoodPortion; portion: FoodPortion } | undefined> {
  try {
    const links = await food.foodPortions.fetch();
    for (const link of links) {
      if (link.isDefault && isActive(link)) {
        const portion = await link.foodPortion;
        if (isActive(portion)) {
          return { link, portion };
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function buildMealShareEnvelope(
  mealId: string,
  options: BuildMealShareOptions
): Promise<MealShareEnvelope> {
  const mealData = await MealService.getMealWithFoods(mealId);
  if (!mealData) {
    throw new Error('Meal not found');
  }
  const { meal } = mealData;

  const foods = new Map<string, Food>();
  const portions = new Map<string, FoodPortion>();
  const mealFoods: { model: MealFood; food: Food; portion?: FoodPortion }[] = [];
  for (const model of mealData.foods) {
    const food = await relatedFood(model);
    if (!food) {
      continue;
    }
    const portion = await relatedPortion(model);
    foods.set(food.id, food);
    if (portion) {
      portions.set(portion.id, portion);
    }
    mealFoods.push({ food, model, portion });
  }

  if (mealFoods.length === 0) {
    throw new Error('Cannot share a meal without ingredients');
  }

  const mealPortionLinks = await database
    .get<MealFoodPortion>('meal_food_portions')
    .query(Q.where('meal_id', meal.id), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  const carriedMealPortionLinks: MealFoodPortion[] = [];
  for (const link of mealPortionLinks) {
    try {
      const portion = await link.foodPortion;
      if (isActive(link) && isActive(portion)) {
        portions.set(portion.id, portion);
        carriedMealPortionLinks.push(link);
      }
    } catch {
      // A broken optional portion link does not make the meal itself unshareable.
    }
  }

  const defaultFoodLinks: FoodFoodPortion[] = [];
  for (const food of foods.values()) {
    const linked = await defaultPortionLink(food);
    if (linked) {
      portions.set(linked.portion.id, linked.portion);
      defaultFoodLinks.push(linked.link);
    }
  }

  const ingredients: MealShareIngredient[] = [];
  for (const { food, model, portion } of mealFoods) {
    const nutrients = await model.getNutrients();
    const unit =
      food.resolvedNutritionBasis === 'per_serving' ? 'serving' : portion ? 'portion' : 'g';
    ingredients.push({
      amount: model.amount,
      calories: nutrients.calories,
      name: food.name,
      ...(unit === 'portion' && portion?.name ? { portionName: portion.name } : undefined),
      unit,
    });
  }

  const mealRow = shareRow(meal);
  let assets: MealShareEnvelope['assets'];
  if (options.includeImage && meal.imageUrl) {
    const thumbnail = await createThumbnail(meal.imageUrl, 400);
    if (thumbnail.base64) {
      assets = {
        mealImage: {
          base64: thumbnail.base64,
          height: thumbnail.height,
          mime: 'image/jpeg',
          width: thumbnail.width,
        },
      };
      mealRow.image_url = `${SHARE_ASSET_REF_PREFIX}mealImage`;
    } else {
      delete mealRow.image_url;
    }
  } else {
    delete mealRow.image_url;
  }

  const mealFoodRows = mealFoods.map(({ model, portion }) => {
    const row = shareRow(model);
    if (model.portionId && !portion) {
      delete row.portion_id;
    }
    return row;
  });

  return {
    _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
    ...(assets ? { assets } : undefined),
    createdAtMs: Date.now(),
    kind: 'meal',
    kindVersion: MEAL_SHARE_SPEC.kindVersion,
    records: {
      food_food_portions: defaultFoodLinks.map(shareRow),
      food_portions: [...portions.values()].map(shareRow),
      foods: [...foods.values()].map(shareRow),
      meal_food_portions: carriedMealPortionLinks.map(shareRow),
      meal_foods: mealFoodRows,
      meals: [mealRow],
    },
    rootId: meal.id,
    rootTable: MEAL_SHARE_SPEC.rootTable,
    summary: {
      description: meal.description || undefined,
      hasImage: Boolean(assets),
      ingredients,
      name: meal.name,
      nutritionBasis: meal.resolvedNutritionBasis,
      preparedWeightGrams: meal.preparedWeightGrams,
      recipeServingsCount: meal.recipeServingsCount,
      servingGrams: meal.servingGrams,
      totals: await meal.getTotalNutrients(),
    },
  };
}

export async function buildMealSharePayload(mealId: string, options: BuildMealShareOptions) {
  const envelope = await buildMealShareEnvelope(mealId, options);
  return {
    exportVersion: OPTICAL_EXPORT_VERSION_SHARE,
    json: JSON.stringify(envelope),
    payloadKind: OPTICAL_PAYLOAD_KIND_SHARE,
  };
}
