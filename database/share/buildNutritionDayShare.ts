/**
 * Builds a `nutritionDay` share: one calendar day of the food diary, as diary entries.
 *
 * The neighbouring `buildLoggedMealShare` sends a diary SECTION as a meal, which the receiver saves
 * into My Meals as a recipe. This is the other thing a user might mean by sharing what they ate:
 * the day itself, restored into the receiver's diary on the same date, with each entry's amount,
 * meal type and consumed time intact. Musclog GB's `SHARE DAY` produces the same kind through
 * `utils/optical/gameBoyDayShare.ts`, so both senders land on one receive path.
 *
 * Two things are carried differently from every other share kind:
 *
 * - **`date` + `timezone` travel unchanged.** That pair is how the app buckets a log into a
 *   calendar day (`utcNormalizedDayKey` re-applies the stored offset), so passing them through is
 *   what makes a day sent from UTC+2 still read as that day on a phone in UTC-5. Nothing rewrites a
 *   date on import.
 * - **The encrypted macro snapshot goes out as plaintext.** `logged_*` columns are encrypted with
 *   the SENDER's key, which the receiver does not have, so they are decrypted here and re-encrypted
 *   on the far side — the same handoff a database export/restore performs. `NUTRITION_DAY_SHARE_SPEC`
 *   declares that contract via `encrypt`.
 */

import {
  decryptNutritionLogSnapshotRow,
  nutritionLogSnapshotToExportFields,
} from '@/database/encryptionHelpers';
import type Food from '@/database/models/Food';
import type FoodFoodPortion from '@/database/models/FoodFoodPortion';
import type FoodPortion from '@/database/models/FoodPortion';
import type NutritionLog from '@/database/models/NutritionLog';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import {
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  MusclogShareError,
  type NutritionDayShareEntry,
  type NutritionDayShareEnvelope,
  type ShareNutrients,
  type ShareRow,
} from '@/utils/share/shareEnvelope';
import { NUTRITION_DAY_SHARE_SPEC } from '@/utils/share/shareKinds';

import {
  applyCarriedFoodImage,
  defaultPortionLink,
  isActive,
  type ShareBuild,
  shareRow,
  shareSenderPayload,
} from './shareRecords';

export interface BuildNutritionDayShareOptions {
  /** The day being sent, `YYYY-MM-DD`. Display metadata — the rows file themselves. */
  dayKey: string;
}

interface ResolvedEntry {
  food: Food;
  portion?: FoodPortion;
  nutrients: ShareNutrients;
  row: ShareRow;
  summary: NutritionDayShareEntry;
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
 * The log's portion, but only when it can travel: a portion owned by a meal (or by another food)
 * has no owner in this envelope to point at, and carrying it would fail the import on a foreign key
 * that cannot resolve. Same rule as the logged-meal builder.
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
    const owner = portion.ownerType;
    return !owner || (owner === 'food' && portion.ownerId === food.id) ? portion : undefined;
  } catch {
    return undefined;
  }
}

async function resolveEntry(log: NutritionLog): Promise<ResolvedEntry | undefined> {
  const food = await relatedFood(log);
  if (!food) {
    // A log whose food was deleted keeps only its encrypted snapshot, which is not a food row the
    // receiver could reference. Skipping it is the same call every other builder makes.
    return undefined;
  }

  const portion = await carriablePortion(log, food);
  const nutrients = await log.getNutrients();
  const snapshot = nutritionLogSnapshotToExportFields(
    await decryptNutritionLogSnapshotRow(log._raw as Record<string, unknown>)
  );

  const row: ShareRow = {
    ...shareRow(log),
    // Plaintext, overwriting the ciphertext `shareRow` copied out of `_raw`.
    logged_calories: snapshot.logged_calories,
    logged_carbs: snapshot.logged_carbs,
    logged_fat: snapshot.logged_fat,
    logged_fiber: snapshot.logged_fiber,
    logged_food_name: snapshot.logged_food_name,
    logged_micros_json: snapshot.logged_micros_json,
    logged_protein: snapshot.logged_protein,
  };
  if (!portion) {
    // The portion did not travel, so the reference to it must not either.
    delete row.portion_id;
  }

  const unit =
    food.resolvedNutritionBasis === 'per_serving' ? 'serving' : portion ? 'portion' : 'g';
  return {
    food,
    nutrients,
    portion,
    row,
    summary: {
      amount: log.amount,
      calories: nutrients.calories,
      mealType: log.type,
      name: snapshot.logged_food_name || food.name,
      ...(unit === 'portion' && portion?.name ? { portionName: portion.name } : undefined),
      unit,
    },
  };
}

export async function buildNutritionDayShareEnvelope(
  logs: NutritionLog[],
  options: BuildNutritionDayShareOptions
): Promise<ShareBuild<NutritionDayShareEnvelope>> {
  const resolved = await Promise.all(logs.filter(isActive).map(resolveEntry));
  const entries = resolved.filter((entry): entry is ResolvedEntry => Boolean(entry));

  if (entries.length === 0) {
    // Same typed failure the meal builder raises, so the send screen can say it in the user's
    // language instead of matching on an English message.
    throw new MusclogShareError('no-ingredients', 'Cannot share a day with nothing logged');
  }

  const foods = new Map<string, Food>();
  const portions = new Map<string, FoodPortion>();
  for (const { food, portion } of entries) {
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

  const totals = entries.reduce<ShareNutrients>(
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
      createdAtMs: Date.now(),
      kind: 'nutritionDay',
      kindVersion: NUTRITION_DAY_SHARE_SPEC.kindVersion,
      records: {
        food_food_portions: defaultFoodLinks.map(shareRow),
        food_portions: [...portions.values()].map(shareRow),
        foods: [...foods.values()].map((food) => {
          const row = shareRow(food);
          // A day carries no pictures: the diary rows have none, and the ingredients' photos are
          // not what the user asked to send.
          applyCarriedFoodImage(row, false);
          return row;
        }),
        nutrition_logs: entries.map((entry) => entry.row),
      },
      summary: {
        dayKey: options.dayKey,
        entries: entries.map((entry) => entry.summary),
        totals,
      },
    },
    photo: 'none',
  };
}

export async function buildNutritionDaySharePayload(
  logs: NutritionLog[],
  options: BuildNutritionDayShareOptions
) {
  return shareSenderPayload(await buildNutritionDayShareEnvelope(logs, options));
}

/** The `YYYY-MM-DD` key a device-local diary date is shared as. */
export function nutritionDayShareKey(date: Date): string {
  return formatLocalCalendarDayIso(date);
}
