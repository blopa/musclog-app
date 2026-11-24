// Combines several independent estimates of one meal into one (Tokenmaxxing).
// Pure and relative-import-only. Two keep rules, then one median:
// - Ungrouped: a vote. An ingredient is kept only when strictly more than half of the samples
//   found it (a reading that saw something the others did not is more often wrong than right).
// - Grouped (`groups[i]` is the independent first look sample i came from): an ingredient is kept
//   only when it was seen under EVERY group that remains after the layout filter. An error inside
//   one look must not be outvoted into the result by that look's own samples alone. With fewer
//   than two groups left it falls back to the plain vote.
// Every number is the median of what the readings said, per gram, so one wild figure never moves
// the result.

import { median } from 'simple-statistics';

import type { TrackedMeal, TrackMealIngredient, TrackMealResponse } from './coachAI';

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
  const distinctGroups = groups ? [...new Set(groups)] : [];
  const byGroupRule = distinctGroups.length >= 2;
  const order: string[] = [];
  const byName = new Map<string, TrackMealIngredient[]>();
  const groupsByName = new Map<string, Set<number>>();

  for (const [index, meal] of meals.entries()) {
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
      if (groups) {
        if (!groupsByName.has(key)) {
          groupsByName.set(key, new Set());
        }

        groupsByName.get(key)!.add(groups[index]);
      }
    }
  }

  const kept = (key: string): boolean =>
    byGroupRule
      ? distinctGroups.every((group) => groupsByName.get(key)?.has(group))
      : byName.get(key)!.length > need;

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
