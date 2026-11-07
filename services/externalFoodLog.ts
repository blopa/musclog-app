import { randomUUID } from 'expo-crypto';

import type { MealType } from '@/database/models/NutritionLog';
import { FoodService } from '@/database/services/FoodService';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import type { FoodLogDraft, FoodLogParseError } from '@/utils/aiFoodLog/contract';
import {
  buildFoodLogInstructions,
  type FoundationFoodReference,
} from '@/utils/aiFoodLog/instructions';
import {
  type FoodLogGrouping,
  type FoodLogIngredient,
  partitionResolved,
  resolveGrouping,
  toBatchIngredients,
  toIngredients,
} from '@/utils/aiFoodLog/logPlan';
import { parseFoodLogText } from '@/utils/aiFoodLog/parse';
import { handleError } from '@/utils/handleError';

/**
 * The most foundation foods listed in the prompt. The in-app prompts use the same cap
 * (`getFoundationFoodsPrompt`), which keeps the pasted text a size a chat box accepts.
 */
const FOUNDATION_FOODS_LIMIT = 200;

/**
 * The instructions to paste into ChatGPT or Claude. Foundation foods are listed only while the
 * person lets foods be sent to an LLM (`sendFoundationFoodsToLlm`, the same switch the in-app AI
 * respects), and a failure to read them only costs the prompt its list: the file is still valid
 * without one.
 */
export async function loadFoodLogInstructions(language: string): Promise<string> {
  let foundationFoods: FoundationFoodReference[] = [];
  try {
    if (await SettingsService.getSendFoundationFoodsToLlm()) {
      const foods = await FoodService.getFoundationFoods(FOUNDATION_FOODS_LIMIT);
      foundationFoods = foods.map((food) => ({ id: food.id, name: food.name }));
    }
  } catch (error) {
    handleError(error, 'externalFoodLog.loadFoundationFoods');
  }

  return buildFoodLogInstructions({ language, foundationFoods });
}

export type ExternalFoodLogReview = {
  log: FoodLogDraft;
  /** Everything that can be logged, with Musclog's own macros where a foundation food matched. */
  ingredients: FoodLogIngredient[];
  /** Foods in the file that could not be read at all. */
  skippedFoods: number;
  /** Foods that named a foundation id Musclog does not have and gave no numbers of their own. */
  unresolvedNames: string[];
};

export type ExternalFoodLogReadResult =
  ({ ok: true } & ExternalFoodLogReview) | { ok: false; error: FoodLogParseError };

/**
 * Reads pasted or imported text into something that can be reviewed. A food that matched a
 * foundation food takes Musclog's macros for the amount (`normalizeAiMealIngredients`, whose
 * lookup failure is deliberately left to reject: carrying on would log those foods at 0 kcal).
 */
export async function readExternalFoodLog(text: string): Promise<ExternalFoodLogReadResult> {
  const parsed = parseFoodLogText(text);
  if (!parsed.ok) {
    return parsed;
  }

  const ingredients = toIngredients(parsed.log.foods);
  const resolved = ingredients.some((ingredient) => ingredient.foodId)
    ? await NutritionService.normalizeAiMealIngredients(ingredients)
    : ingredients;
  const { usable, unresolved } = partitionResolved(resolved);
  if (usable.length === 0) {
    return { ok: false, error: 'noFoods' };
  }

  return {
    ok: true,
    log: parsed.log,
    ingredients: usable,
    skippedFoods: parsed.skippedFoods,
    unresolvedNames: unresolved.map((ingredient) => ingredient.name),
  };
}

/**
 * Logs the reviewed foods in one write. Two or more foods the person chose to group share a fresh
 * group id and a meal name (an AI meal, like the coach's), anything else is a set of loose
 * entries. Carbs reach the service as the assistant's NET carbs, which it converts to the
 * canonical total for the `ai` source.
 */
export function logExternalFoods({
  ingredients,
  date,
  time,
  mealType,
  grouping,
}: {
  ingredients: readonly FoodLogIngredient[];
  /** The calendar day. */
  date: Date;
  /** The time of day on it. */
  time: Date;
  mealType: MealType;
  grouping: FoodLogGrouping;
}) {
  const resolvedGrouping = resolveGrouping(ingredients, grouping);

  return NutritionService.logCustomMealsBatch(toBatchIngredients(ingredients), date, mealType, {
    consumedTime: time,
    ...(resolvedGrouping.grouped
      ? { groupId: randomUUID(), loggedMealName: resolvedGrouping.loggedMealName }
      : {}),
  });
}
