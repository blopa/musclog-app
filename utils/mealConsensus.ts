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
import { normalizeFoodName } from './foodName';
import type { MealObservation } from './mealObservation';
import { ingredientMacroProblems } from './mealPlausibility';

/** Rounded to one decimal, the precision every merged figure is shown with. */
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

/**
 * The occurrence whose per-gram figures are nearest the per-gram medians, scaled to `grams`. Used
 * when the field-wise medians contradict each other. Energy is linear in the macros, but a median
 * taken field by field over three or more samples is not, so the merged figures can break the
 * kcal/macro relation even though every sample kept it.
 */
function nearestOccurrence(
  occurrences: TrackMealIngredient[],
  medians: Record<(typeof MACRO_KEYS)[number], number>,
  grams: number
): TrackMealIngredient {
  let best = occurrences[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const item of occurrences) {
    let distance = 0;
    for (const key of MACRO_KEYS) {
      const value =
        item.grams > 0 && Number.isFinite(item[key] ?? 0) ? (item[key] ?? 0) / item.grams : 0;
      distance += Math.abs(value - medians[key]) / (Math.abs(medians[key]) + 0.01);
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }

  const scaled = {} as Record<(typeof MACRO_KEYS)[number], number>;
  for (const key of MACRO_KEYS) {
    const value =
      best.grams > 0 && Number.isFinite(best[key] ?? 0) ? (best[key] ?? 0) / best.grams : 0;
    scaled[key] = value * grams;
  }

  return { ...best, grams, ...scaled };
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

  const medians = {} as Record<(typeof MACRO_KEYS)[number], number>;
  for (const key of MACRO_KEYS) {
    medians[key] = perGram(key);
  }

  const noFiber = occurrences.every((item) => item.fiber == null);
  const fromMedians = { ...merged };
  for (const key of MACRO_KEYS) {
    if (key === 'fiber' && noFiber) {
      continue;
    }

    fromMedians[key] = round1(medians[key] * grams);
  }

  if (ingredientMacroProblems(fromMedians).length === 0) {
    Object.assign(merged, fromMedians);
  } else {
    // The contradiction is in the medians, so the answer is one real reading, not a blend of them.
    const nearest = nearestOccurrence(occurrences, medians, grams);
    for (const key of MACRO_KEYS) {
      if (key === 'fiber' && noFiber) {
        continue;
      }

      merged[key] = round1(nearest[key] ?? 0);
    }
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

/**
 * Which keep rule applies to a layout's samples, given the first look each one came from. With at
 * least two independent looks an ingredient is kept when at least half of the samples found it;
 * otherwise it must be strictly more than half. No looks (undefined) means the plain vote.
 */
export function keepsAtHalf(agreeingLooks: readonly number[] | undefined): boolean {
  return agreeingLooks ? new Set(agreeingLooks).size >= 2 : false;
}

function mergeMeals(meals: TrackedMeal[], keepAtHalf: boolean): TrackedMeal {
  const first = meals[0];
  const need = meals.length / 2;
  const order: string[] = [];
  const byName = new Map<string, TrackMealIngredient[]>();

  for (const meal of meals) {
    const seenInMeal = new Set<string>();
    for (const ingredient of meal.ingredients ?? []) {
      const key = normalizeFoodName(ingredient.name);
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

    return keepAtHalf ? found >= need : found > need;
  };

  return {
    ...first,
    ingredients: order.filter(kept).map((key) => mergeIngredient(byName.get(key)!)),
  };
}

const normalizedMealName = (meal: TrackedMeal): string => normalizeFoodName(meal.mealName ?? '');

/** Return source indexes in reference order only when every meal has a unique identity. */
function alignMeals(reference: TrackedMeal[], candidate: TrackedMeal[]): number[] | undefined {
  if (reference.length === 1 && candidate.length === 1) {
    return [0];
  }

  const typeCounts = new Map<string, number>();
  for (const { mealType } of reference) {
    typeCounts.set(mealType, (typeCounts.get(mealType) ?? 0) + 1);
  }

  const indexes: number[] = [];
  const used = new Set<number>();
  for (const meal of reference) {
    const repeated = typeCounts.get(meal.mealType) !== 1;
    const name = repeated ? normalizedMealName(meal) : '';
    const matches = candidate.flatMap((item, index) =>
      item.mealType === meal.mealType && (!repeated || (name && normalizedMealName(item) === name))
        ? [index]
        : []
    );
    if (matches.length !== 1 || used.has(matches[0])) {
      return undefined;
    }

    indexes.push(matches[0]);
    used.add(matches[0]);
  }

  return used.size === candidate.length ? indexes : undefined;
}

/**
 * One meal estimate from several. With one sample it is returned as it is. The layout (how many
 * meals) is the most common one among the samples, the first sample's on a tie, and only samples
 * with that layout are merged, meal by meal. `lookOfSample[i]` is the first look `samples[i]` came
 * from; see `keepsAtHalf` for how the looks change the keep rule.
 */
export function consensusMeals(
  samples: TrackMealResponse[],
  lookOfSample?: number[]
): TrackMealResponse {
  if (samples.length <= 1) {
    return samples[0];
  }

  const counts = samples.map((sample) => sample.meals?.length ?? 0);
  const layout = mostCommon(counts);
  const agreeingIndexes = samples
    .map((_, index) => index)
    .filter((index) => (samples[index].meals?.length ?? 0) === layout);
  const agreeing = agreeingIndexes.map((index) => samples[index]);
  const keepAtHalf = keepsAtHalf(
    lookOfSample ? agreeingIndexes.map((index) => lookOfSample[index]) : undefined
  );
  const reference = agreeing[0];
  const referenceMeals = reference.meals ?? [];
  const aligned = [referenceMeals];
  for (const sample of agreeing.slice(1)) {
    const meals = sample.meals ?? [];
    const order = alignMeals(referenceMeals, meals);
    if (!order) {
      return reference;
    }

    aligned.push(order.map((index) => meals[index]));
  }

  return {
    ...reference,
    meals: referenceMeals.map((_, position) =>
      mergeMeals(
        aligned.map((meals) => meals[position]),
        keepAtHalf
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
    (meal.ingredients ?? []).map((ingredient) => normalizeFoodName(ingredient.name)).filter(Boolean)
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

  const alignment = alignMeals(left, right);
  if (!alignment) {
    return false;
  }

  return left.every((meal, position) => {
    const other = right[alignment[position]];
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
