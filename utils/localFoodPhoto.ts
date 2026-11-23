/**
 * The pure half of reading a meal photo with the downloaded on-device model.
 *
 * The small vision model only NAMES what it sees and guesses how many grams each item weighs. It is
 * never asked for calories or macros: a 450M model cannot read those off a plate. The names are
 * matched against the foods this phone already has, whose macros are real; only an item with no
 * confident match is estimated afterwards from its name by the same follow-up the cloud path uses.
 * Everything lands in the review screen, where the person edits it before anything is saved.
 */
import type { TrackedMeal, TrackMealIngredient, TrackMealResponse } from './coachAI';

export const MAX_IDENTIFIED_FOODS = 12;
export const MIN_IDENTIFIED_GRAMS = 5;
export const MAX_IDENTIFIED_GRAMS = 1500;
export const DEFAULT_IDENTIFIED_GRAMS = 100;

/**
 * The food id of an item the database had no match for. It names no row, so the lookup that
 * resolves ids drops it and the estimate follow-up fills the numbers in; it is never stored.
 */
export const LOCAL_PHOTO_UNMATCHED_FOOD_ID = 'local-photo-unmatched';

export type IdentifiedFood = { name: string; grams: number };

/** What the model is asked for: names and grams, nothing else. */
export const LOCAL_FOOD_IDENTIFY_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: MAX_IDENTIFIED_FOODS,
      items: {
        type: 'object',
        required: ['name', 'grams'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
        },
      },
    },
  },
} as const;

export function localFoodIdentifyPrompt(): string {
  return [
    'You look at one photo of a meal and list each distinct food or drink you can see.',
    'Name each item with a short, common food name in English, such as "grilled chicken breast", "white rice" or "orange juice". One item per food; do not group a plate into one item.',
    `For each item give "grams": your best guess of its weight on the plate, a whole number between ${MIN_IDENTIFIED_GRAMS} and ${MAX_IDENTIFIED_GRAMS}.`,
    'Never give calories or nutrients. If you cannot see any food, return an empty list.',
    'Reply with JSON only.',
  ].join('\n');
}

const clampGrams = (value: unknown): number => {
  const grams =
    typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_IDENTIFIED_GRAMS;

  return Math.min(MAX_IDENTIFIED_GRAMS, Math.max(MIN_IDENTIFIED_GRAMS, Math.round(grams)));
};

/** Reads the model's answer defensively: trims, clamps grams, merges repeats, caps the count. */
export function parseIdentifiedFoods(value: unknown): IdentifiedFood[] {
  const items =
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items)
      ? ((value as { items: unknown[] }).items as unknown[])
      : [];
  const byName = new Map<string, IdentifiedFood>();

  for (const entry of items) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const rawName = (entry as { name?: unknown }).name;
    const name =
      typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    if (!name) {
      continue;
    }

    const grams = clampGrams((entry as { grams?: unknown }).grams);
    const key = name.toLowerCase();
    const existing = byName.get(key);
    byName.set(key, {
      name: existing?.name ?? name,
      grams: existing ? Math.min(MAX_IDENTIFIED_GRAMS, existing.grams + grams) : grams,
    });
    if (byName.size >= MAX_IDENTIFIED_FOODS) {
      break;
    }
  }

  return [...byName.values()];
}

/** The meal a photo taken at this hour most likely belongs to; the review screen lets the person change it. */
export function mealTypeForHour(hour: number): TrackedMeal['mealType'] {
  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  }

  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }

  return hour >= 15 && hour < 22 ? 'dinner' : 'snack';
}

/** A food the phone already has, with its numbers per 100 g. */
export type FoodCandidate = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'without',
  'of',
  'in',
  'on',
  'raw',
  'cooked',
  'fresh',
  'plain',
  'whole',
  'grilled',
  'fried',
  'baked',
  'boiled',
  'roasted',
  'steamed',
  'slice',
  'slices',
  'piece',
  'pieces',
  'small',
  'large',
  'half',
  'some',
  'side',
]);

/** Lowercase, no diacritics, a naive singular, and none of the filler words. */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
    );
}

/** Words worth searching the food table for, most specific (longest) first. */
export function searchTermsFor(name: string): string[] {
  return [...new Set(tokenize(name))].sort((a, b) => b.length - a.length).slice(0, 3);
}

/**
 * The one candidate this name clearly means, or null. A candidate must carry every significant word
 * of the name; among those, the one with the fewest extra words wins, and a tie is no match (the
 * person picks, as `findExerciseByName` does).
 */
export function pickFoodMatch(
  name: string,
  candidates: readonly FoodCandidate[]
): FoodCandidate | null {
  const wanted = new Set(tokenize(name));
  if (wanted.size === 0) {
    return null;
  }

  const scored = candidates
    .map((candidate) => {
      const have = new Set(tokenize(candidate.name));
      const covered = [...wanted].filter((word) => have.has(word)).length;

      return { candidate, covered, extra: have.size - covered };
    })
    .filter((entry) => entry.covered === wanted.size)
    .sort((a, b) => a.extra - b.extra);

  if (scored.length === 0) {
    return null;
  }

  return scored.length > 1 && scored[0].extra === scored[1].extra ? null : scored[0].candidate;
}

/**
 * The review payload: matched items carry their food id (the lookup fills the real numbers in at
 * normalization), the rest carry the unmatched id and zeros until the estimate follow-up runs.
 */
export function buildPhotoMeal(
  foods: readonly IdentifiedFood[],
  matches: ReadonlyMap<string, FoodCandidate | null>,
  mealType: TrackedMeal['mealType']
): TrackMealResponse {
  const ingredients: TrackMealIngredient[] = foods.map((food) => {
    const match = matches.get(food.name) ?? null;

    return {
      name: match?.name ?? food.name,
      grams: food.grams,
      foodId: match?.id ?? LOCAL_PHOTO_UNMATCHED_FOOD_ID,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  });

  return { meals: [{ mealType, ingredients }] };
}
