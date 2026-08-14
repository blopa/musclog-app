import { z } from 'zod';

import { INCLUDE_FIBER_IN_CARBS_SETTING_TYPE, UNITS_SETTING_TYPE } from '@/constants/settings';
import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import { localDayStartMs } from '@/utils/calendarDate';
import {
  catalogueExerciseIdForCartridgeIndex,
  unmappedGameBoyExerciseId,
} from '@/utils/optical/gameBoyExerciseMapping';
import { getTimezoneAt } from '@/utils/timezone';
import { generateUUID } from '@/utils/uuid';

/**
 * Compact, sender-friendly database snapshot emitted by Musclog GB.
 *
 * The cartridge has no JSON library and only a few KB of working RAM, so it writes this
 * deliberately small tuple schema as a virtual string. The regular import path expands it to
 * WatermelonDB-shaped rows before validation and before the destructive restore begins.
 */
export const GAME_BOY_EXPORT_VERSION = gameBoyOpticalProtocol.gameBoyExportVersion;
export const GAME_BOY_EXPORT_DATABASE_VERSION = gameBoyOpticalProtocol.databaseExportVersion;

const {
  muscleGroups: MUSCLE_GROUPS,
  equipmentTypes: EQUIPMENT_TYPES,
  mechanicTypes: MECHANIC_TYPES,
} = gameBoyOpticalProtocol.exerciseEnums;

const daySchema = z.number().int().min(0).max(65_535);
const uint8Schema = z.number().int().min(0).max(255);
const uint16Schema = z.number().int().min(0).max(65_535);
const muscleGroupSchema = z
  .number()
  .int()
  .min(0)
  .max(MUSCLE_GROUPS.length - 1);
const equipmentTypeSchema = z
  .number()
  .int()
  .min(0)
  .max(EQUIPMENT_TYPES.length - 1);
const mechanicTypeSchema = z
  .number()
  .int()
  .min(0)
  .max(MECHANIC_TYPES.length - 1);

const profileSchema = z
  .object({
    units: z.number().int().min(0).max(1),
    gender: z.number().int().min(0).max(2),
    age: z.number().int().min(13).max(99),
    heightCm: z.number().int().min(120).max(230),
    weightKgTenths: z.number().int().min(300).max(2500),
    activity: z.number().int().min(1).max(5),
    experience: z.number().int().min(0).max(2),
    focus: z.number().int().min(0).max(3),
    weightGoal: z.number().int().min(0).max(2),
    calories: z.number().int().min(0).max(10_000),
    protein: z.number().int().min(0).max(2000),
    carbs: z.number().int().min(0).max(2000),
    fat: z.number().int().min(0).max(2000),
    fiber: z.number().int().min(0).max(500),
    todayDay: daySchema,
  })
  .strict();

/**
 * [global food index, name, kcal, protein dg, fat dg, total-carbs dg, fiber dg]
 *
 * Exported because `render_food_tuple` in `gameboy/src/features/optical/optical_export.c` emits
 * this exact tuple for BOTH cartridge payloads — the whole-database export and `SHARE DAY` — so
 * `utils/optical/gameBoyDayShare.ts` must read the same shape rather than its own copy of it.
 * Names arrive truncated to `FF_NAME_VISIBLE` (16) characters for a bundled food.
 */
export const cartridgeFoodTupleSchema = z.tuple([
  uint16Schema,
  z.string().min(1).max(32),
  uint16Schema,
  uint16Schema,
  uint16Schema,
  uint16Schema,
  uint16Schema,
]);

// [day since 2000-01-01, global food index, grams]
const foodLogSchema = z.tuple([daySchema, uint16Schema, uint16Schema]);

/** Days since 2000-01-01, the cartridge's only notion of a date. */
export const cartridgeDaySchema = daySchema;

// [day since 2000-01-01, weight in kg tenths]
const weightSchema = z.tuple([daySchema, uint16Schema]);

// [exercise index, name, muscle enum, equipment enum, mechanic enum, multiplier centi]
const exerciseSchema = z.tuple([
  uint8Schema,
  z.string().min(1).max(64),
  muscleGroupSchema,
  equipmentTypeSchema,
  mechanicTypeSchema,
  uint16Schema,
]);

// [exercise index, reps, weight in kg tenths]
const workoutSetSchema = z.tuple([uint8Schema, uint8Schema, uint16Schema]);

// [day since 2000-01-01, stored volume kg, performed sets]
const workoutSchema = z.tuple([daySchema, uint16Schema, z.array(workoutSetSchema).min(1).max(255)]);

const compactGameBoyExportSchema = z
  .object({
    _exportVersion: z.literal(GAME_BOY_EXPORT_DATABASE_VERSION),
    _gameBoyExport: z.literal(GAME_BOY_EXPORT_VERSION),
    profile: profileSchema,
    foods: z.array(cartridgeFoodTupleSchema).max(2048),
    foodLogs: z.array(foodLogSchema).max(2048),
    weights: z.array(weightSchema).max(2048),
    exercises: z.array(exerciseSchema).max(255),
    workouts: z.array(workoutSchema).max(255),
  })
  .strict();

export type CompactGameBoyExport = z.infer<typeof compactGameBoyExportSchema>;

export class GameBoyExportError extends Error {
  constructor(
    readonly code: 'malformed' | 'unsupported-version',
    message: string
  ) {
    super(message);
    this.name = 'GameBoyExportError';
  }
}

const GENDERS = ['male', 'female', 'other'] as const;
const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const;
const FITNESS_GOALS = ['hypertrophy', 'strength', 'endurance', 'general'] as const;
const WEIGHT_GOALS = ['lose', 'maintain', 'gain'] as const;
const EATING_PHASES = ['cut', 'maintain', 'bulk'] as const;
const DEFAULT_PROFILE_NAME = 'Game Boy Player';
const DEFAULT_AVATAR_ICON = 'person';
const DEFAULT_AVATAR_COLOR = 'blue';

const DAY_ZERO_UTC_MS = Date.UTC(2000, 0, 1);
const DAY_MS = 86_400_000;

export type CartridgeDay = {
  dayStartMs: number;
  dayTimezone: string;
  eventTimestamp: number;
  eventTimezone: string;
};

function cartridgeDayParts(day: number): [year: number, month: number, date: number] {
  const utcDate = new Date(DAY_ZERO_UTC_MS + day * DAY_MS);
  return [utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()];
}

/**
 * A cartridge day number as instants this app can store.
 *
 * The cartridge records calendar days and no times at all, so every event it sends is anchored to
 * device-local NOON: far enough from both midnights that no timezone the receiver might be in can
 * drag the entry onto the day before or after. Metrics use the day's local midnight instead,
 * because `user_metrics.date` is a day key rather than a datetime.
 *
 * Shared with `utils/optical/gameBoyDayShare.ts` — a day share and a whole-database import must
 * place a cartridge day at exactly the same instant, or the same data would land on two different
 * days depending on which way it arrived.
 */
export function cartridgeDay(day: number): CartridgeDay {
  const [year, month, date] = cartridgeDayParts(day);
  const dayStartMs = localDayStartMs(new Date(year, month, date, 12));
  const eventDate = new Date(year, month, date, 12);
  return {
    dayStartMs,
    dayTimezone: getTimezoneAt(dayStartMs),
    eventTimestamp: eventDate.getTime(),
    eventTimezone: getTimezoneAt(eventDate),
  };
}

function inferredDateOfBirthMs(todayDay: number, age: number): number {
  const [todayYear, month, todayDate] = cartridgeDayParts(todayDay);
  const year = todayYear - age;
  const date = Math.min(todayDate, new Date(year, month + 1, 0).getDate());
  return localDayStartMs(new Date(year, month, date, 12));
}

function missingFoodMessage(foodIndex: number): string {
  return `Food log references missing food ${foodIndex}`;
}

function assertUniqueIndexes(
  rows: readonly (readonly [number, ...unknown[]])[],
  label: string
): void {
  const seen = new Set<number>();
  for (const [index] of rows) {
    if (seen.has(index)) {
      throw new GameBoyExportError('malformed', `Duplicate ${label} index ${index}`);
    }
    seen.add(index);
  }
}

export function parseGameBoyExport(value: unknown): CompactGameBoyExport {
  if (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, '_gameBoyExport') &&
    (value as { _gameBoyExport?: unknown })._gameBoyExport !== GAME_BOY_EXPORT_VERSION
  ) {
    throw new GameBoyExportError('unsupported-version', 'Unsupported Musclog GB export version');
  }

  const result = compactGameBoyExportSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.map(String).join('.') || 'export';
    throw new GameBoyExportError('malformed', `${path}: ${first?.message ?? 'Invalid data'}`);
  }

  assertUniqueIndexes(result.data.foods, 'food');
  assertUniqueIndexes(result.data.exercises, 'exercise');

  const foodIds = new Set(result.data.foods.map(([index]) => index));
  for (const [, foodIndex] of result.data.foodLogs) {
    if (!foodIds.has(foodIndex)) {
      throw new GameBoyExportError('malformed', missingFoodMessage(foodIndex));
    }
  }

  const exerciseIds = new Set(result.data.exercises.map(([index]) => index));
  for (const [, , sets] of result.data.workouts) {
    for (const [exerciseIndex] of sets) {
      if (!exerciseIds.has(exerciseIndex)) {
        throw new GameBoyExportError(
          'malformed',
          `Workout references missing exercise ${exerciseIndex}`
        );
      }
    }
  }

  return result.data;
}

/** Expand the compact cartridge schema into the regular portable database dump schema. */
export function gameBoyExportToDatabaseDump(
  compact: CompactGameBoyExport
): Record<string, unknown> {
  const { profile } = compact;
  const today = cartridgeDay(profile.todayDay);
  const now = today.eventTimestamp;
  const userSyncId = generateUUID();
  const foods = compact.foods.map(
    ([index, name, calories, proteinDg, fatDg, carbsDg, fiberDg]) => ({
      id: `gb-f-${index}`,
      is_ai_generated: false,
      name,
      calories,
      protein: proteinDg / 10,
      carbs: carbsDg / 10,
      fat: fatDg / 10,
      fiber: fiberDg / 10,
      is_favorite: false,
      source: index >= 0x8000 ? 'user' : 'gameboy',
      nutrition_basis: 'per_100g',
      created_at: now,
      updated_at: now,
    })
  );

  const foodByIndex = new Map(compact.foods.map((food) => [food[0], food]));
  const nutritionLogs = compact.foodLogs.map(([day, foodIndex, grams], index) => {
    const food = foodByIndex.get(foodIndex);
    if (!food) {
      throw new GameBoyExportError('malformed', missingFoodMessage(foodIndex));
    }

    const consumedDay = cartridgeDay(day);
    const consumedAt = consumedDay.eventTimestamp;
    return {
      id: `gb-n-${index}`,
      food_id: `gb-f-${foodIndex}`,
      type: 'other',
      amount: grams,
      logged_food_name: food[1],
      logged_calories: food[2],
      logged_protein: food[3] / 10,
      logged_carbs: food[5] / 10,
      logged_fat: food[4] / 10,
      logged_fiber: food[6] / 10,
      snapshot_basis: 'per_100g',
      date: consumedAt,
      timezone: consumedDay.eventTimezone,
      created_at: consumedAt,
      updated_at: consumedAt,
    };
  });

  // A cartridge exercise is an index into the frozen Game Boy table, so it resolves to the
  // bundled catalogue row the app already owns — keeping the user's localized name, photos
  // and target muscles instead of a stub rebuilt from the cartridge's 64-char uppercase
  // label. `AppExerciseCatalogueService.sync` reconciles those rows right after the restore
  // populates the database, so the dump carries only the identity, never the content.
  // Anything the frozen list does not cover comes from a newer cartridge and is imported as
  // a plain user exercise from the tuple it sent.
  const exerciseIdByIndex = new Map<number, string>();
  const exercises: Record<string, unknown>[] = [];
  for (const [index, name, muscle, equipment, mechanic, multiplierCenti] of compact.exercises) {
    const catalogueId = catalogueExerciseIdForCartridgeIndex(index);
    if (catalogueId) {
      exerciseIdByIndex.set(index, catalogueId);
      continue;
    }

    const importedId = unmappedGameBoyExerciseId(index);
    exerciseIdByIndex.set(index, importedId);
    exercises.push({
      id: importedId,
      name,
      description: 'Imported from Musclog GB',
      muscle_group: MUSCLE_GROUPS[muscle],
      equipment_type: EQUIPMENT_TYPES[equipment],
      mechanic_type: MECHANIC_TYPES[mechanic],
      source: 'user',
      load_multiplier: multiplierCenti / 100,
      created_at: now,
      updated_at: now,
    });
  }

  const workoutLogs: Record<string, unknown>[] = [];
  const workoutLogExercises: Record<string, unknown>[] = [];
  const workoutLogSets: Record<string, unknown>[] = [];

  compact.workouts.forEach(([day, volumeKg, sets], workoutIndex) => {
    const workoutDay = cartridgeDay(day);
    const timestamp = workoutDay.eventTimestamp;
    const workoutId = `gb-w-${workoutIndex}`;
    workoutLogs.push({
      id: workoutId,
      template_id: '',
      workout_name: 'Game Boy Workout',
      started_at: timestamp,
      completed_at: timestamp,
      timezone: workoutDay.eventTimezone,
      total_volume: volumeKg,
      type: 'free',
      exhaustion_level: 0,
      workout_score: 0,
      created_at: timestamp,
      updated_at: timestamp,
    });

    let group = -1;
    let previousExercise = -1;
    sets.forEach(([exerciseIndex, reps, weightKgTenths], setIndex) => {
      if (exerciseIndex !== previousExercise) {
        previousExercise = exerciseIndex;
        group++;
        workoutLogExercises.push({
          id: `gb-x-${workoutIndex}-${group}`,
          workout_log_id: workoutId,
          // parseGameBoyExport already rejected a workout referencing an absent tuple.
          exercise_id: exerciseIdByIndex.get(exerciseIndex),
          exercise_order: group,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }

      workoutLogSets.push({
        id: `gb-s-${workoutIndex}-${setIndex}`,
        log_exercise_id: `gb-x-${workoutIndex}-${group}`,
        reps,
        weight: weightKgTenths / 10,
        rest_time_after: 0,
        reps_in_reserve: 0,
        completion_status: 'performed',
        set_type: 'normal',
        set_order: setIndex,
        created_at: timestamp,
        updated_at: timestamp,
      });
    });
  });

  const weightMetrics = compact.weights.map(([day, weightKgTenths], index) => {
    const metricDay = cartridgeDay(day);
    return {
      id: `gb-m-${index}`,
      type: 'weight',
      value: weightKgTenths / 10,
      unit: 'kg',
      date: metricDay.dayStartMs,
      timezone: metricDay.dayTimezone,
      created_at: metricDay.eventTimestamp,
      updated_at: metricDay.eventTimestamp,
    };
  });
  if (!compact.weights.some(([day]) => day === profile.todayDay)) {
    weightMetrics.push({
      id: 'gb-m-current',
      type: 'weight',
      value: profile.weightKgTenths / 10,
      unit: 'kg',
      date: today.dayStartMs,
      timezone: today.dayTimezone,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    _exportVersion: compact._exportVersion,
    exercises,
    users: [
      {
        id: 'gb-user',
        full_name: DEFAULT_PROFILE_NAME,
        email: '',
        date_of_birth: inferredDateOfBirthMs(profile.todayDay, profile.age),
        gender: GENDERS[profile.gender],
        fitness_goal: FITNESS_GOALS[profile.focus],
        weight_goal: WEIGHT_GOALS[profile.weightGoal],
        activity_level: profile.activity,
        lifting_experience: EXPERIENCES[profile.experience],
        avatar_icon: DEFAULT_AVATAR_ICON,
        avatar_color: DEFAULT_AVATAR_COLOR,
        sync_id: userSyncId,
        created_at: now,
        updated_at: now,
      },
    ],
    foods,
    settings: [
      {
        id: 'gb-units',
        type: UNITS_SETTING_TYPE,
        value: String(profile.units),
        created_at: now,
        updated_at: now,
      },
      {
        id: 'gb-carbs-convention',
        type: INCLUDE_FIBER_IN_CARBS_SETTING_TYPE,
        value: profile.units === 1 ? 'true' : 'false',
        created_at: now,
        updated_at: now,
      },
    ],
    nutrition_goals: [
      {
        id: 'gb-goal',
        total_calories: profile.calories,
        protein: profile.protein,
        carbs: profile.carbs,
        fats: profile.fat,
        fiber: profile.fiber,
        eating_phase: EATING_PHASES[profile.weightGoal],
        target_weight: profile.weightKgTenths / 10,
        timezone: today.eventTimezone,
        is_dynamic: false,
        created_at: now,
        updated_at: now,
      },
    ],
    workout_logs: workoutLogs,
    workout_log_exercises: workoutLogExercises,
    workout_log_sets: workoutLogSets,
    nutrition_logs: nutritionLogs,
    user_metrics: [
      {
        id: 'gb-height',
        type: 'height',
        value: profile.heightCm,
        unit: 'cm',
        date: today.dayStartMs,
        timezone: today.dayTimezone,
        created_at: now,
        updated_at: now,
      },
      ...weightMetrics,
    ],
  };
}

/** Leave regular exports untouched; reject marked-but-unknown cartridge exports before a wipe. */
function expandGameBoyExportIfNeeded(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, '_gameBoyExport')) {
    return value;
  }
  return gameBoyExportToDatabaseDump(parseGameBoyExport(value));
}

/** Parse received database JSON and expand the cartridge tuple schema before normal validation. */
export function parseDatabaseExportJson(value: string): unknown {
  return expandGameBoyExportIfNeeded(JSON.parse(value));
}
