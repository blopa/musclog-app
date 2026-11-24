/**
 * The pure half of reading a meal photo with the downloaded on-device model.
 *
 * The small vision model only NAMES what it sees and guesses how many grams each item weighs. It is
 * never asked for calories or macros: a 450M model cannot read those off a plate. The names are
 * matched against the foods this phone already has, whose macros are real; only an item with no
 * confident match is estimated afterwards from its name by the same follow-up the cloud path uses.
 * Everything lands in the review screen, where the person edits it before anything is saved.
 */
import { median } from 'simple-statistics';

import type { TrackedMeal, TrackMealIngredient, TrackMealResponse } from './coachAI';

export const MAX_IDENTIFIED_FOODS = 12;
export const MIN_IDENTIFIED_GRAMS = 5;
export const MAX_IDENTIFIED_GRAMS = 1500;
export const DEFAULT_IDENTIFIED_GRAMS = 100;
/** Longest food name asked for and kept: a bounded string cannot run on until the token limit. */
export const MAX_IDENTIFIED_NAME_CHARS = 80;
/**
 * A first reply at temperature 0 that is not usable is retried once warmer: the same prompt at 0
 * would only give the same words again.
 */
export const LOCAL_PHOTO_RETRY_TEMPERATURE = 0.3;

/**
 * The food id of an item the database had no match for. It names no row, so the lookup that
 * resolves ids drops it and the estimate follow-up fills the numbers in; it is never stored.
 */
export const LOCAL_PHOTO_UNMATCHED_FOOD_ID = 'local-photo-unmatched';

export type IdentifiedFood = {
  name: string;
  grams: number;
  /** The plain English name when `name` is not English; only for matching, never shown. */
  englishName?: string;
};

/**
 * The name a food is looked up by: its English name when it has one, else the name it was given.
 * Stored foods are named in English, so a name in another language finds nothing by its own words.
 * The wording the person reads is always `name`.
 */
export function matchNameOf(food: { name: string; englishName?: string }): string {
  return food.englishName?.trim() || food.name;
}

/** A food's name as readings are compared: case, accents and spacing do not count. */
function foodKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Several readings of one photo (the High and Tokenmaxxing thinking levels) made into one: a food
 * stays when at least half the readings name it, with the median of the grams they gave (a reading
 * that names a food twice counts its grams together), in the order foods were first named and with
 * their first spelling. One reading is returned as it is.
 */
export function voteIdentifiedFoods(readings: IdentifiedFood[][]): IdentifiedFood[] {
  if (readings.length <= 1) {
    return readings[0] ?? [];
  }

  const order: string[] = [];
  const spelling = new Map<string, string>();
  const english = new Map<string, string>();
  const grams = new Map<string, number[]>();
  for (const reading of readings) {
    const totals = new Map<string, number>();
    for (const food of reading) {
      const key = foodKey(food.name);
      if (!key) {
        continue;
      }

      if (!spelling.has(key)) {
        spelling.set(key, food.name);
        order.push(key);
      }

      if (food.englishName && !english.has(key)) {
        english.set(key, food.englishName);
      }

      totals.set(key, (totals.get(key) ?? 0) + food.grams);
    }

    for (const [key, total] of totals) {
      grams.set(key, [...(grams.get(key) ?? []), total]);
    }
  }

  const needed = Math.ceil(readings.length / 2);
  return order.flatMap((key) => {
    const seen = grams.get(key) ?? [];
    if (seen.length < needed) {
      return [];
    }

    const englishName = english.get(key);

    return [
      {
        name: spelling.get(key) ?? key,
        grams: Math.round(median(seen)),
        ...(englishName ? { englishName } : {}),
      },
    ];
  });
}

/**
 * Several photos of the SAME meal (the downloaded model reads one image per request) made into one
 * list. A food is matched across photos by the same key `voteIdentifiedFoods` uses (case, accents
 * and spacing; no plural folding). Photos overlap, so a food seen in several of them is counted
 * ONCE and the entry with the larger `grams` wins: summing would count the same plate again for
 * every angle. The kept entry brings its own spelling; foods come out in first-seen order, photo 0
 * first. Empty lists are ignored, and a name that repeats inside one list is deduped the same way.
 */
export function mergeFoodsAcrossPhotos(
  perPhoto: readonly (readonly IdentifiedFood[])[]
): IdentifiedFood[] {
  const merged = new Map<string, IdentifiedFood>();
  for (const photo of perPhoto) {
    for (const food of photo) {
      const key = foodKey(food.name);
      if (!key) {
        continue;
      }

      const existing = merged.get(key);
      const englishName = food.englishName ?? existing?.englishName;
      if (!existing || food.grams > existing.grams) {
        // Map keeps the original insertion position when a key is set again.
        merged.set(key, {
          name: food.name,
          grams: food.grams,
          ...(englishName ? { englishName } : {}),
        });
      } else if (!existing.englishName && englishName) {
        merged.set(key, { ...existing, englishName });
      }
    }
  }

  return [...merged.values()];
}

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
          name: { type: 'string', maxLength: MAX_IDENTIFIED_NAME_CHARS },
          grams: { type: 'number' },
          // Optional, to keep a 450M model's grammar small: left out, matching falls back to `name`.
          englishName: { type: 'string', maxLength: MAX_IDENTIFIED_NAME_CHARS },
        },
      },
    },
  },
} as const;

export function localFoodIdentifyPrompt(): string {
  return [
    'You look at one photo of a meal and list each distinct food or drink you can see.',
    // No example foods here: a 450M model copies them. With "grilled chicken breast", "white rice"
    // and "orange juice" as examples it answered with them on 8 of 10 Nutrition5k plates, most of
    // which held neither (docs/ON_DEVICE_AI_PLAN.md, P7 notes).
    'Name each item with a short, common food name in English. One item per food; do not group a plate into one item.',
    'Leave "englishName" out unless "name" is not in English; then give the plain English food name there.',
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
      typeof rawName === 'string'
        ? rawName.trim().replace(/\s+/g, ' ').slice(0, MAX_IDENTIFIED_NAME_CHARS)
        : '';
    if (!name) {
      continue;
    }

    const grams = clampGrams((entry as { grams?: unknown }).grams);
    const rawEnglish = (entry as { englishName?: unknown }).englishName;
    const read =
      typeof rawEnglish === 'string'
        ? rawEnglish.trim().replace(/\s+/g, ' ').slice(0, MAX_IDENTIFIED_NAME_CHARS)
        : '';
    const key = name.toLowerCase();
    const existing = byName.get(key);
    // Said only when it adds something: the same words as `name` change nothing.
    const englishName =
      existing?.englishName ?? (read && read.toLowerCase() !== key ? read : undefined);
    byName.set(key, {
      name: existing?.name ?? name,
      grams: existing ? Math.min(MAX_IDENTIFIED_GRAMS, existing.grams + grams) : grams,
      ...(englishName ? { englishName } : {}),
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
  /** What the food is, in the words of its source (a foundation food's is its generic English name). */
  description?: string;
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

type CandidateScore = { covered: number; extra: number };

/** How many wanted words a text carries, and how many words it has besides them. */
function scoreWords(wanted: ReadonlySet<string>, text: string): CandidateScore {
  const have = new Set(tokenize(text));
  const covered = [...wanted].filter((word) => have.has(word)).length;

  return { covered, extra: have.size - covered };
}

/**
 * A candidate is scored on the words of its name OR of its description, whichever fits the wanted
 * words better (more covered, then fewer extra words). The two are never pooled: a word from the
 * name and another from the description do not make a match together.
 */
function scoreCandidate(wanted: ReadonlySet<string>, candidate: FoodCandidate): CandidateScore {
  const byName = scoreWords(wanted, candidate.name);
  if (!candidate.description) {
    return byName;
  }

  const byDescription = scoreWords(wanted, candidate.description);
  const descriptionFitsBetter =
    byDescription.covered > byName.covered ||
    (byDescription.covered === byName.covered && byDescription.extra < byName.extra);

  return descriptionFitsBetter ? byDescription : byName;
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
    .map((candidate) => ({ candidate, ...scoreCandidate(wanted, candidate) }))
    .filter((entry) => entry.covered === wanted.size)
    .sort((a, b) => a.extra - b.extra);

  if (scored.length === 0) {
    return null;
  }

  return scored.length > 1 && scored[0].extra === scored[1].extra ? null : scored[0].candidate;
}

/** The most candidates a name match ranks: a common word ("rice") can name hundreds of foods. */
export const MAX_FOOD_CANDIDATES = 50;

/**
 * At most `limit` candidates for a name, the ones `pickFoodMatch` would prefer first: those that
 * carry every significant word, fewest extra words first, then the partial ones. `pickFoodMatch`
 * therefore answers the same on the capped list as on the whole one (its winner, and any tie at the
 * top, always survive the cut); the cap only stops it from ranking a huge result. A list within the
 * limit is returned as it is.
 */
export function limitFoodCandidates(
  name: string,
  candidates: readonly FoodCandidate[],
  limit: number = MAX_FOOD_CANDIDATES
): FoodCandidate[] {
  if (candidates.length <= limit) {
    return [...candidates];
  }

  const wanted = new Set(tokenize(name));

  return candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(wanted, candidate) }))
    .sort((a, b) => b.covered - a.covered || a.extra - b.extra)
    .slice(0, limit)
    .map((entry) => entry.candidate);
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

  const mealName = photoMealName(ingredients.map((ingredient) => ingredient.name));

  return { meals: [{ mealType, ...(mealName ? { mealName } : {}), ingredients }] };
}

/**
 * What the review calls a photo meal: the foods on it ("Steak, potatoes, cheese"), never the meal
 * type, which said "breakfast" for any plate photographed before noon. Cut at a word, like a name
 * the person typed would be, and left out when nothing was found.
 */
export function photoMealName(names: readonly string[]): string | undefined {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return undefined;
  }

  const joined = unique.join(', ');
  const name =
    joined.length <= MAX_IDENTIFIED_NAME_CHARS
      ? joined
      : `${joined.slice(0, MAX_IDENTIFIED_NAME_CHARS).replace(/[,\s]+\S*$/, '')}…`;

  return name.charAt(0).toUpperCase() + name.slice(1);
}
