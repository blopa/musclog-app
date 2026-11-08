import { z } from 'zod';

import type { MealType } from '@/database/models/NutritionLog';
import {
  type DocumentParseError,
  type NormalizerError,
  readEnvelope,
  trimmedText,
} from '@/utils/externalDocument';
import { isRecord } from '@/utils/isRecord';

/**
 * The food-log contract: the one shape ChatGPT or Claude is asked to write when someone tracks
 * food outside the app. Everything that comes back (a file or pasted text) is untrusted until it
 * has been through {@link normalizeFoodLog}.
 *
 * A document is one or more foods eaten together, each with the macros of the amount eaten (not
 * per 100 g), the same shape the in-app AI meal tracker works with. It carries no date or time:
 * those are the person's to confirm in the review. A food may instead name a foundation food by
 * `foodId`, in which case Musclog's own macros replace whatever the file says.
 *
 * `carbs` is NET (digestible) carbohydrate, total carbohydrate minus fiber, and `fiber` is its own
 * field. That is the convention every AI estimate in the app uses (`FOOD_SOURCE_CARBS_CONVENTION.ai`)
 * and `NutritionService` stores the canonical total from it, so the instructions must say so.
 */
export const FOOD_LOG_SCHEMA_ID = 'musclog-food-log';
export const FOOD_LOG_MAJOR = 1;
export const MAX_FOOD_LOG_BYTES = 64 * 1024;

export const MAX_FOODS = 30;
export const FOOD_NAME_MAX = 100;
export const MEAL_NAME_MAX = 80;
export const FOOD_ID_MAX = 100;
export const GRAMS_RANGE = [1, 5000] as const;
export const CALORIES_MAX = 10000;
export const MACRO_GRAMS_MAX = 1000;

export const FOOD_LOG_MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'other',
] as const satisfies readonly MealType[];
export type FoodLogMealType = (typeof FOOD_LOG_MEAL_TYPES)[number];

const nameSchema = z.string().min(1).max(FOOD_NAME_MAX);
const gramsSchema = z.number().min(GRAMS_RANGE[0]).max(GRAMS_RANGE[1]);
const caloriesSchema = z.number().min(0).max(CALORIES_MAX);
const macroSchema = z.number().min(0).max(MACRO_GRAMS_MAX);
const foodIdSchema = z.string().min(1).max(FOOD_ID_MAX);

/** A food that carries its own macros: the shape handed out when no foundation foods are offered. */
const foodSchema = z.strictObject({
  name: nameSchema,
  grams: gramsSchema,
  calories: caloriesSchema,
  protein: macroSchema,
  carbs: macroSchema,
  fat: macroSchema,
  fiber: macroSchema.optional(),
});

/** With foundation foods on offer, a match names `foodId` and may leave the macros out. */
const foodWithIdSchema = z.strictObject({
  name: nameSchema,
  grams: gramsSchema,
  foodId: foodIdSchema.optional(),
  calories: caloriesSchema.optional(),
  protein: macroSchema.optional(),
  carbs: macroSchema.optional(),
  fat: macroSchema.optional(),
  fiber: macroSchema.optional(),
});

/**
 * The document an external assistant is asked to produce. Strict, so the schema forbids stray
 * keys. Two shapes of food exist because the JSON Schema is what the assistant reads: offering
 * `foodId` only when foundation foods are in the prompt keeps the file it writes unambiguous.
 */
export function buildFoodLogDocumentSchema({ withFoodIds }: { withFoodIds: boolean }) {
  return z.strictObject({
    schema: z.literal(FOOD_LOG_SCHEMA_ID),
    version: z.literal(FOOD_LOG_MAJOR),
    mealType: z.enum(FOOD_LOG_MEAL_TYPES).optional(),
    mealName: z.string().min(1).max(MEAL_NAME_MAX).optional(),
    foods: z
      .array(withFoodIds ? foodWithIdSchema : foodSchema)
      .min(1)
      .max(MAX_FOODS),
  });
}

/** One food as read from a file: bounded, trimmed, numbers rounded to one decimal. */
export type FoodLogFood = {
  name: string;
  grams: number;
  /** Absent only when the file named a `foodId` and left the macros to Musclog. */
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  foodId?: string;
};

export type FoodLogDraft = {
  mealType?: FoodLogMealType;
  /** Set when the assistant says the foods were one dish or plate. */
  mealName?: string;
  foods: FoodLogFood[];
};

export type FoodLogParseError = DocumentParseError | 'invalidLog' | 'noFoods';

export type NormalizedFoodLog =
  | {
      ok: true;
      log: FoodLogDraft;
      /** Foods that were unusable (bad numbers, no name, over the cap) and left out. */
      skippedFoods: number;
    }
  | {
      ok: false;
      error: NormalizerError<FoodLogParseError>;
    };

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * A number from a number or a numeric string ("150", "1,5"); anything else is not a number.
 * Assistants answering in Portuguese or Dutch sometimes write a decimal comma inside a string.
 */
function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(value)) {
    return Number(value.trim().replace(',', '.'));
  }

  return undefined;
}

/** A number kept only when it sits inside the range the contract allows; never clamped. */
function bounded(value: unknown, schema: z.ZodNumber): number | undefined {
  const number = toNumber(value);
  if (number === undefined) {
    return undefined;
  }

  const parsed = schema.safeParse(number);
  return parsed.success ? round1(parsed.data) : undefined;
}

function readFood(raw: unknown): FoodLogFood | null {
  if (!isRecord(raw)) {
    return null;
  }

  const name = trimmedText(raw.name, FOOD_NAME_MAX);
  const grams = bounded(raw.grams, gramsSchema);
  if (!name || grams === undefined) {
    return null;
  }

  const foodId = trimmedText(raw.foodId, FOOD_ID_MAX);
  const calories = bounded(raw.calories, caloriesSchema);
  const protein = bounded(raw.protein, macroSchema);
  const carbs = bounded(raw.carbs, macroSchema);
  const fat = bounded(raw.fat, macroSchema);
  const fiber = bounded(raw.fiber, macroSchema);

  // Without a foundation match the food stands on its own numbers, so all four must be usable. A
  // food that does name one may omit them: Musclog's own macros replace them on import.
  const hasMacros =
    calories !== undefined && protein !== undefined && carbs !== undefined && fat !== undefined;
  if (!foodId && !hasMacros) {
    return null;
  }

  return {
    name,
    grams,
    ...(calories === undefined ? {} : { calories }),
    ...(protein === undefined ? {} : { protein }),
    ...(carbs === undefined ? {} : { carbs }),
    ...(fat === undefined ? {} : { fat }),
    ...(fiber === undefined ? {} : { fiber }),
    ...(foodId ? { foodId } : {}),
  };
}

/**
 * Reads an already parsed document into a draft. Lenient where an assistant is likely to slip
 * (numbers as strings, a stray key) and strict about identity: the wrong schema or a newer major
 * version is refused rather than half-understood. A food that cannot be read is left out and
 * counted, never repaired by guessing.
 */
export function normalizeFoodLog(parsed: unknown): NormalizedFoodLog {
  const envelope = readEnvelope(parsed, { schemaId: FOOD_LOG_SCHEMA_ID, major: FOOD_LOG_MAJOR });
  if (!envelope.ok) {
    return envelope;
  }

  const raw = envelope.record;
  if (!Array.isArray(raw.foods) || raw.foods.length === 0) {
    return { ok: false, error: 'invalidLog' };
  }

  const foods: FoodLogFood[] = [];
  let skippedFoods = 0;
  for (const rawFood of raw.foods) {
    const food = readFood(rawFood);
    if (food && foods.length < MAX_FOODS) {
      foods.push(food);
    } else {
      skippedFoods += 1;
    }
  }

  if (foods.length === 0) {
    return { ok: false, error: 'noFoods' };
  }

  const mealType = (FOOD_LOG_MEAL_TYPES as readonly unknown[]).includes(raw.mealType)
    ? (raw.mealType as FoodLogMealType)
    : undefined;

  const mealName = trimmedText(raw.mealName, MEAL_NAME_MAX);

  return {
    ok: true,
    skippedFoods,
    log: {
      ...(mealType ? { mealType } : {}),
      ...(mealName ? { mealName } : {}),
      foods,
    },
  };
}
