/**
 * Musclog GB's `SHARE DAY` payload, and its expansion into a `nutritionDay` share envelope.
 *
 * The cartridge has no JSON library and a few KB of RAM, so — exactly as it does for the
 * whole-database export — it writes a compact tuple schema and the app expands it before any
 * validation runs. This is the share equivalent of `gameBoyExportToDatabaseDump`, and the two
 * deliberately share the food tuple and the day→instant anchoring in `./gameBoyExport.ts`: the same
 * cartridge data must land on the same day at the same time whichever way it arrived.
 *
 * What the cartridge can and cannot say shapes the result:
 *
 * - **No time of day and no meal type.** The food log stores `{ day, food index, grams }` and
 *   nothing else, so every entry is filed at local noon under `other`, and the envelope sets
 *   `summary.timesUnknown` so the receive screen can explain that rather than let it look like the
 *   transfer dropped something.
 * - **No `external_id` or barcode, and only 16 characters of a food's name.** So a bundled food is
 *   identified by its INDEX, which `./gameBoyFoodMapping.ts` resolves to the `external_id` (and the
 *   full seed row) the receiver already knows — that is what makes the importer's food dedupe reuse
 *   the receiver's own copy instead of growing a truncated near-duplicate. The cartridge still sends
 *   every referenced food's tuple, which is the fallback for a custom food (there is nothing to
 *   resolve) and for an index a newer cartridge added that this build has never heard of.
 */

import { z } from 'zod';

import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import {
  cartridgeDay,
  cartridgeDaySchema,
  cartridgeFoodTupleSchema,
  GameBoyExportError,
} from '@/utils/optical/gameBoyExport';
import {
  catalogueFoodForCartridgeIndex,
  externalIdForCartridgeFoodIndex,
  isCartridgeCustomFoodIndex,
} from '@/utils/optical/gameBoyFoodMapping';
import {
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  type NutritionDayShareEntry,
  type NutritionDayShareEnvelope,
  type ShareNutrients,
  type ShareRow,
} from '@/utils/share/shareEnvelope';
import { NUTRITION_DAY_SHARE_SPEC } from '@/utils/share/shareKinds';

export const GAME_BOY_DAY_SHARE_VERSION = gameBoyOpticalProtocol.gameBoyDayShareVersion;

/** [global food index, grams] — the cartridge's food-log record minus the day it already declared. */
const dayLogSchema = z.tuple([
  z.number().int().min(0).max(65_535),
  z.number().int().min(0).max(65_535),
]);

const compactGameBoyDayShareSchema = z
  .object({
    _gameBoyShare: z.literal(GAME_BOY_DAY_SHARE_VERSION),
    day: cartridgeDaySchema,
    foods: z.array(cartridgeFoodTupleSchema).min(1).max(255),
    kind: z.literal('day'),
    logs: z.array(dayLogSchema).min(1).max(255),
  })
  .strict();

export type CompactGameBoyDayShare = z.infer<typeof compactGameBoyDayShareSchema>;

export function parseGameBoyDayShare(value: unknown): CompactGameBoyDayShare {
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, '_gameBoyShare') &&
    (value as { _gameBoyShare?: unknown })._gameBoyShare !== GAME_BOY_DAY_SHARE_VERSION
  ) {
    throw new GameBoyExportError('unsupported-version', 'Unsupported Musclog GB share version');
  }

  const result = compactGameBoyDayShareSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.map(String).join('.') || 'share';
    throw new GameBoyExportError('malformed', `${path}: ${first?.message ?? 'Invalid data'}`);
  }

  const foodIndexes = new Set(result.data.foods.map(([index]) => index));
  if (foodIndexes.size !== result.data.foods.length) {
    throw new GameBoyExportError('malformed', 'Day share repeats a food index');
  }
  for (const [foodIndex] of result.data.logs) {
    if (!foodIndexes.has(foodIndex)) {
      throw new GameBoyExportError('malformed', `Day share references missing food ${foodIndex}`);
    }
  }

  return result.data;
}

/** Envelope-local row ids. Namespaced per table and remapped on import, so fixed strings are safe. */
function foodRowId(index: number): string {
  return `gb-day-food-${index}`;
}

interface WireFood {
  row: ShareRow;
  /** Per-100 g macros, for scaling an entry's grams into what the receiver will display. */
  per100g: ShareNutrients;
  name: string;
}

function wireFood(tuple: CompactGameBoyDayShare['foods'][number], nowMs: number): WireFood {
  const [index, cartridgeName, kcal, proteinDg, fatDg, carbsDg, fiberDg] = tuple;
  // Decigrams on the wire; whole grams in the database. Carbs are already TOTAL (fiber included)
  // in both bundled tables and in the cartridge's own custom-food entry screen, which is the
  // convention `foods.carbs` stores — so nothing is re-normalized here.
  const tupleMacros: ShareNutrients = {
    calories: kcal,
    carbs: carbsDg / 10,
    fat: fatDg / 10,
    fiber: fiberDg / 10,
    protein: proteinDg / 10,
  };

  const catalogue = isCartridgeCustomFoodIndex(index)
    ? undefined
    : catalogueFoodForCartridgeIndex(index);

  const row: ShareRow = {
    calories: catalogue?.calories ?? tupleMacros.calories,
    carbs: catalogue?.carbs ?? tupleMacros.carbs,
    created_at: nowMs,
    fat: catalogue?.fat ?? tupleMacros.fat,
    fiber: catalogue?.fiber ?? tupleMacros.fiber,
    id: foodRowId(index),
    is_ai_generated: false,
    is_favorite: false,
    name: catalogue?.name || cartridgeName,
    nutrition_basis: 'per_100g',
    protein: catalogue?.protein ?? tupleMacros.protein,
    // A bundled food keeps the identity the receiver's own seeding used, so dedupe matches on
    // `external_id` first. A custom food has none and falls through to name + macros.
    source: catalogue ? 'foundation' : 'gameboy',
    updated_at: nowMs,
    ...(catalogue?.barcode ? { barcode: catalogue.barcode } : undefined),
    ...(catalogue?.description ? { description: catalogue.description } : undefined),
    ...(Object.keys(catalogue?.micros ?? {}).length > 0
      ? { micros_json: JSON.stringify(catalogue?.micros) }
      : undefined),
    ...(externalIdForCartridgeFoodIndex(index) && catalogue
      ? { external_id: externalIdForCartridgeFoodIndex(index) }
      : undefined),
  };

  const per100g: ShareNutrients = catalogue
    ? {
        calories: catalogue.calories,
        carbs: catalogue.carbs,
        fat: catalogue.fat,
        fiber: catalogue.fiber,
        protein: catalogue.protein,
      }
    : tupleMacros;

  return { name: String(row.name), per100g, row };
}

/** Expand the compact cartridge schema into the `nutritionDay` envelope the importer consumes. */
export function gameBoyDayShareToEnvelope(
  compact: CompactGameBoyDayShare,
  nowMs = Date.now()
): NutritionDayShareEnvelope {
  const day = cartridgeDay(compact.day);
  const foods = new Map(compact.foods.map((tuple) => [tuple[0], wireFood(tuple, nowMs)] as const));

  const entries: NutritionDayShareEntry[] = [];
  const totals: ShareNutrients = { calories: 0, carbs: 0, fat: 0, fiber: 0, protein: 0 };
  const logs = compact.logs.map(([foodIndex, grams], position) => {
    // `parseGameBoyDayShare` already rejected a log pointing at an absent tuple.
    const food = foods.get(foodIndex) as WireFood;
    const scale = grams / 100;

    entries.push({
      amount: grams,
      calories: food.per100g.calories * scale,
      mealType: 'other',
      name: food.name,
      unit: 'g',
    });
    totals.calories += food.per100g.calories * scale;
    totals.carbs += food.per100g.carbs * scale;
    totals.fat += food.per100g.fat * scale;
    totals.fiber += food.per100g.fiber * scale;
    totals.protein += food.per100g.protein * scale;

    return {
      amount: grams,
      created_at: nowMs,
      date: day.eventTimestamp,
      food_id: foodRowId(foodIndex),
      id: `gb-day-log-${position}`,
      // Plaintext per-100 g snapshot; the importer re-encrypts it with this device's key. Values
      // are per 100 g because `snapshot_basis` says so — `NutritionLog.getNutrients()` scales them
      // by the logged gram weight.
      logged_calories: food.per100g.calories,
      logged_carbs: food.per100g.carbs,
      logged_fat: food.per100g.fat,
      logged_fiber: food.per100g.fiber,
      logged_food_name: food.name,
      logged_protein: food.per100g.protein,
      snapshot_basis: 'per_100g',
      timezone: day.eventTimezone,
      // The cartridge records no meal type, and guessing one from position in the day would invent
      // information it never had.
      type: 'other',
      updated_at: nowMs,
    } satisfies ShareRow;
  });

  return {
    _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
    createdAtMs: nowMs,
    kind: 'nutritionDay',
    kindVersion: NUTRITION_DAY_SHARE_SPEC.kindVersion,
    records: {
      // Only the foods an entry actually points at: the cartridge sends exactly those, and an
      // unreferenced food row would be a food the receiver never asked to save.
      foods: [...foods.values()].map((food) => food.row),
      nutrition_logs: logs,
    },
    summary: {
      dayKey: formatLocalCalendarDayIso(new Date(day.eventTimestamp)),
      entries,
      timesUnknown: true,
      totals,
    },
  };
}

/** Is this reassembled payload a Musclog GB day share rather than an app-built envelope? */
export function isGameBoyDayShareJson(value: unknown): boolean {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, '_gameBoyShare');
}
