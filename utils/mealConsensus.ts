// Combines several independent estimates of one meal into one (Tokenmaxxing).
// Pure and relative-import-only. Two keep rules, then one median:
// - Ungrouped: a vote. An ingredient is kept only when strictly more than half of the samples
//   found it (a reading that saw something the others did not is more often wrong than right).
// - Grouped (`groups[i]` is the independent first look sample i came from, and at least two looks
//   remain after the layout filter): an ingredient is kept when AT LEAST half of the answered
//   samples found it, whichever look they came from (with four samples, two). Requiring every look
//   to agree let one look that missed the cooking oil or the dressing delete it from the meal, so
//   a food that one look's two samples both saw is enough; a single sample of four still is not.
//   With fewer than two groups left it falls back to the plain vote.
// Every number is the median of what the readings said, per gram, so one wild figure never moves
// the result.

import { median } from 'simple-statistics';

import type { TrackedMeal, TrackMealIngredient, TrackMealResponse } from './coachAI';
import type { MealObservation } from './mealObservation';

/** The key two readings of an ingredient are matched by: no case, accents or extra spaces. */
export function normalizeIngredientName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const;

function mostCommon(counts: number[]): number {
  const tally = new Map<number, number>();
  for (const count of counts) {
    tally.set(count, (tally.get(count) ?? 0) + 1);
  }

  let best = counts[0];
  for (const [count, times] of tally) {
    if (times > (tally.get(best) ?? 0)) {
      best = count;
    }
  }

  return best;
}

function mergeIngredient(occurrences: TrackMealIngredient[]): TrackMealIngredient {
  const grams = median(occurrences.map((item) => item.grams));
  const merged: TrackMealIngredient = {
    name: occurrences[0].name,
    grams: round1(grams),
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  const perGram = (key: (typeof MACRO_KEYS)[number]) =>
    median(
      occurrences.map((item) =>
        item.grams > 0 && Number.isFinite(item[key] ?? 0) ? (item[key] ?? 0) / item.grams : 0
      )
    );

  for (const key of MACRO_KEYS) {
    if (key === 'fiber' && occurrences.every((item) => item.fiber == null)) {
      continue;
    }

    merged[key] = round1(perGram(key) * grams);
  }

  const ids = new Map<string, number>();
  for (const item of occurrences) {
    if (item.foodId) {
      ids.set(item.foodId, (ids.get(item.foodId) ?? 0) + 1);
    }
  }

  const [topId, topTimes] = [...ids.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topId && topTimes > occurrences.length / 2) {
    merged.foodId = topId;
  }

  return merged;
}

function mergeMeals(meals: TrackedMeal[], groups?: number[]): TrackedMeal {
  const first = meals[0];
  const need = meals.length / 2;
  const byGroupRule = groups ? new Set(groups).size >= 2 : false;
  const order: string[] = [];
  const byName = new Map<string, TrackMealIngredient[]>();

  for (const meal of meals) {
    const seenInMeal = new Set<string>();
    for (const ingredient of meal.ingredients ?? []) {
      const key = normalizeIngredientName(ingredient.name);
      if (!key || seenInMeal.has(key)) {
        continue;
      }

      seenInMeal.add(key);
      if (!byName.has(key)) {
        byName.set(key, []);
        order.push(key);
      }

      byName.get(key)!.push(ingredient);
    }
  }

  // One entry per sample that found the ingredient (a sample names it once, see `seenInMeal`).
  const kept = (key: string): boolean => {
    const found = byName.get(key)!.length;

    return byGroupRule ? found >= need : found > need;
  };

  return {
    ...first,
    ingredients: order.filter(kept).map((key) => mergeIngredient(byName.get(key)!)),
  };
}

/**
 * One meal estimate from several. With one sample it is returned as it is. The layout (how many
 * meals) is the most common one among the samples, the first sample's on a tie, and only samples
 * with that layout are merged, meal by meal. `groups[i]` is the look (group) `samples[i]` came
 * from; see the header for how groups change the keep rule.
 */
export function consensusMeals(samples: TrackMealResponse[], groups?: number[]): TrackMealResponse {
  if (samples.length <= 1) {
    return samples[0];
  }

  const counts = samples.map((sample) => sample.meals?.length ?? 0);
  const layout = mostCommon(counts);
  const agreeingIndexes = samples
    .map((_, index) => index)
    .filter((index) => (samples[index].meals?.length ?? 0) === layout);
  const agreeing = agreeingIndexes.map((index) => samples[index]);
  const agreeingGroups = groups ? agreeingIndexes.map((index) => groups[index]) : undefined;

  return {
    ...agreeing[0],
    meals: Array.from({ length: layout }, (_, position) =>
      mergeMeals(
        agreeing.map((sample) => sample.meals[position]),
        agreeingGroups
      )
    ),
  };
}

/**
 * How far apart two estimates of one meal's total energy may be and still count as the same answer,
 * as a share of the larger one. A product choice, not a measurement: it is loose enough that two
 * honest readings of one plate agree, and tight enough that a missed oil or a doubled portion does not.
 */
export const MEAL_AGREEMENT_KCAL_TOLERANCE = 0.15;

const mealKcal = (meal: TrackedMeal): number =>
  (meal.ingredients ?? []).reduce((total, ingredient) => total + (ingredient.kcal || 0), 0);

const ingredientKeys = (meal: TrackedMeal): Set<string> =>
  new Set(
    (meal.ingredients ?? [])
      .map((ingredient) => normalizeIngredientName(ingredient.name))
      .filter(Boolean)
  );

/**
 * Whether two estimates read the same meal: the same number of meals, in each the same set of
 * ingredients (by normalized name; grams and order do not matter) and a total energy within
 * `tolerance` of the larger one. Two meals of zero energy agree.
 */
export function mealsAgree(
  a: TrackMealResponse,
  b: TrackMealResponse,
  tolerance: number = MEAL_AGREEMENT_KCAL_TOLERANCE
): boolean {
  const left = a.meals ?? [];
  const right = b.meals ?? [];
  if (left.length !== right.length) {
    return false;
  }

  return left.every((meal, position) => {
    const other = right[position];
    const keys = ingredientKeys(meal);
    const otherKeys = ingredientKeys(other);
    if (keys.size !== otherKeys.size || [...keys].some((key) => !otherKeys.has(key))) {
      return false;
    }

    const kcal = mealKcal(meal);
    const otherKcal = mealKcal(other);
    const larger = Math.max(kcal, otherKcal);

    return larger === 0 || Math.abs(kcal - otherKcal) / larger <= tolerance;
  });
}

/** Whether a first look says it could not tell something (`MealObservation.uncertain`). */
export function observationIsUncertain(observation: Pick<MealObservation, 'uncertain'>): boolean {
  return observation.uncertain.length > 0;
}

/**
 * Whether the first stage of a Tokenmaxxing meal estimate (one look and the samples that read it)
 * is stable enough to stop there. It needs at least two answered samples that all agree with the
 * first (`mealsAgree`), a look that lists nothing uncertain, and no sample that needed the
 * plausibility recheck. A single answered sample proves nothing, so it never settles.
 */
export function mealStageIsSettled({
  samples,
  look,
  rechecked,
}: {
  samples: TrackMealResponse[];
  look: Pick<MealObservation, 'uncertain'>;
  /** One flag per answered sample: it needed the plausibility recheck. */
  rechecked: boolean[];
}): boolean {
  return (
    samples.length >= 2 &&
    !observationIsUncertain(look) &&
    !rechecked.some(Boolean) &&
    samples.slice(1).every((sample) => mealsAgree(samples[0], sample))
  );
}
