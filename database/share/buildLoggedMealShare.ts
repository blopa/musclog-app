/**
 * Builds a `meal` share out of what the user actually logged — the diary's Breakfast/Lunch/Dinner
 * section — rather than out of a saved recipe.
 *
 * There is deliberately no `loggedMeal` share kind. A logged meal and a saved meal describe the
 * same thing (a named set of foods with amounts), so this synthesizes the `meals` row the receiver
 * would have had and reuses `MEAL_SHARE_SPEC` end to end: the same envelope, the same preview, the
 * same dedupe, and no new branch on the receiving phone. The receiver saves it into My Meals.
 *
 * A nutrition log and a `meal_foods` row read `amount` + `portion_id` identically — servings for a
 * per-serving food, `amount × portion.gramWeight` grams with a portion, plain grams without one —
 * so the amounts transfer as-is rather than being flattened to grams.
 */

import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import type NutritionLog from '@/database/models/NutritionLog';
import {
  type MealShareEnvelope,
  type MealShareIngredient,
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  MusclogShareError,
  type ShareNutrients,
  type ShareRow,
} from '@/utils/share/shareEnvelope';
import { MEAL_SHARE_SPEC } from '@/utils/share/shareKinds';

import {
  applyCarriedFoodImage,
  defaultPortionLink,
  isActive,
  type ShareBuild,
  shareRow,
  shareSenderPayload,
} from './shareRecords';

/**
 * The envelope-local id of the meal that never existed on this phone. Ids are namespaced per table
 * and remapped by `planShareImport`, so a fixed string is safe — and keeps the payload byte-stable
 * for a given diary, which a random id would not.
 */
const SYNTHETIC_MEAL_ID = 'logged-meal';

export interface BuildLoggedMealShareOptions {
  /** What the receiver will see this meal called — the sender's meal-section label. */
  name: string;
}

interface LoggedIngredient {
  log: NutritionLog;
  food: Food;
  amount: number;
  portion?: FoodPortion;
  nutrients: ShareNutrients;
}

async function relatedFood(log: NutritionLog): Promise<Food | undefined> {
  try {
    const food = await log.food;
    return isActive(food) ? food : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The log's portion, but only when it can travel: a portion owned by a meal (or by some other food)
 * has no owner in this envelope to point at, and carrying it would fail the import on a foreign key
 * that cannot resolve.
 */
async function carriablePortion(log: NutritionLog, food: Food): Promise<FoodPortion | undefined> {
  if (!log.portionId) {
    return undefined;
  }
  try {
    const portion = await log.portion;
    if (!isActive(portion) || !portion) {
      return undefined;
    }
    const owned = portion.ownerType;
    return !owned || (owned === 'food' && portion.ownerId === food.id) ? portion : undefined;
  } catch {
    return undefined;
  }
}

async function resolveIngredient(log: NutritionLog): Promise<LoggedIngredient | undefined> {
  const food = await relatedFood(log);
  if (!food) {
    // A log whose food was deleted carries only an encrypted snapshot, which is not a food row the
    // receiver could save. Skipping it is the same call the saved-meal builder makes.
    return undefined;
  }

  const portion = await carriablePortion(log, food);
  const nutrients = await log.getNutrients();
  const amount = portion
    ? log.amount
    : // Without a portion the amount has to already mean what a portion-less row means: servings
      // for a per-serving food, grams for everything else.
      food.resolvedNutritionBasis === 'per_serving'
      ? log.amount
      : await log.getGramWeight();

  return { amount, food, log, nutrients, portion };
}

export async function buildLoggedMealShareEnvelope(
  logs: NutritionLog[],
  options: BuildLoggedMealShareOptions
): Promise<ShareBuild<MealShareEnvelope>> {
  const resolved = await Promise.all(logs.filter(isActive).map(resolveIngredient));
  const ingredients = resolved.filter((entry): entry is LoggedIngredient => Boolean(entry));

  if (ingredients.length === 0) {
    throw new MusclogShareError('no-ingredients', 'Cannot share a meal without ingredients');
  }

  const foods = new Map<string, Food>();
  const portions = new Map<string, FoodPortion>();
  for (const { food, portion } of ingredients) {
    foods.set(food.id, food);
    if (portion) {
      portions.set(portion.id, portion);
    }
  }

  const defaultFoodLinks: FoodFoodPortion[] = [];
  for (const linked of await Promise.all([...foods.values()].map(defaultPortionLink))) {
    if (linked) {
      portions.set(linked.portion.id, linked.portion);
      defaultFoodLinks.push(linked.link);
    }
  }

  const now = Date.now();
  const mealRow: ShareRow = {
    created_at: now,
    id: SYNTHETIC_MEAL_ID,
    is_ai_generated: false,
    is_favorite: false,
    name: options.name,
    // The receiver's own defaults for a hand-made meal (`MealService.createMeal`): the whole thing
    // is one recipe of one serving.
    nutrition_basis: 'per_recipe',
    recipe_servings_count: 1,
    updated_at: now,
  };

  const mealFoodRows: ShareRow[] = ingredients.map(({ amount, food, log, portion }) => ({
    amount,
    created_at: now,
    food_id: food.id,
    id: log.id,
    meal_id: SYNTHETIC_MEAL_ID,
    ...(portion ? { portion_id: portion.id } : undefined),
    updated_at: now,
  }));

  const summaryIngredients: MealShareIngredient[] = ingredients.map(
    ({ amount, food, nutrients, portion }) => {
      const unit =
        food.resolvedNutritionBasis === 'per_serving' ? 'serving' : portion ? 'portion' : 'g';
      return {
        amount,
        calories: nutrients.calories,
        name: food.name,
        ...(unit === 'portion' && portion?.name ? { portionName: portion.name } : undefined),
        unit,
      };
    }
  );

  const totals = ingredients.reduce<ShareNutrients>(
    (sum, { nutrients }) => ({
      calories: sum.calories + nutrients.calories,
      carbs: sum.carbs + nutrients.carbs,
      fat: sum.fat + nutrients.fat,
      fiber: sum.fiber + nutrients.fiber,
      protein: sum.protein + nutrients.protein,
    }),
    { calories: 0, carbs: 0, fat: 0, fiber: 0, protein: 0 }
  );

  return {
    envelope: {
      _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
      createdAtMs: now,
      kind: 'meal',
      kindVersion: MEAL_SHARE_SPEC.kindVersion,
      records: {
        food_food_portions: defaultFoodLinks.map(shareRow),
        food_portions: [...portions.values()].map(shareRow),
        foods: [...foods.values()].map((food) => {
          const row = shareRow(food);
          // A logged meal has no photo of its own, and its ingredients' photos are not what the
          // user asked to send.
          applyCarriedFoodImage(row, false);
          return row;
        }),
        meal_food_portions: [],
        meal_foods: mealFoodRows,
        meals: [mealRow],
      },
      rootId: SYNTHETIC_MEAL_ID,
      rootTable: MEAL_SHARE_SPEC.rootTable,
      summary: {
        hasImage: false,
        ingredients: summaryIngredients,
        name: options.name,
        nutritionBasis: 'per_recipe',
        recipeServingsCount: 1,
        totals,
      },
    },
    // There is no photo to offer, so the send screen never shows the toggle for this kind.
    photo: 'none',
  };
}

export async function buildLoggedMealSharePayload(
  logs: NutritionLog[],
  options: BuildLoggedMealShareOptions
) {
  return shareSenderPayload(await buildLoggedMealShareEnvelope(logs, options));
}
