import { z } from 'zod';

/**
 * Compact, sender-friendly database snapshot emitted by Musclog GB.
 *
 * The cartridge has no JSON library and only a few KB of working RAM, so it writes this
 * deliberately small tuple schema as a virtual string. The regular import path expands it to
 * WatermelonDB-shaped rows before validation and before the destructive restore begins.
 */
export const GAME_BOY_EXPORT_VERSION = 1;
export const GAME_BOY_EXPORT_DATABASE_VERSION = 26;

const daySchema = z.number().int().min(0).max(65_535);
const uint8Schema = z.number().int().min(0).max(255);
const uint16Schema = z.number().int().min(0).max(65_535);

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

// [global food index, name, kcal, protein dg, fat dg, total-carbs dg, fiber dg]
const foodSchema = z.tuple([
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

// [day since 2000-01-01, weight in kg tenths]
const weightSchema = z.tuple([daySchema, uint16Schema]);

// [exercise index, name, muscle enum, equipment enum, mechanic enum, multiplier centi]
const exerciseSchema = z.tuple([
  uint8Schema,
  z.string().min(1).max(64),
  uint8Schema,
  uint8Schema,
  uint8Schema,
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
    foods: z.array(foodSchema).max(2048),
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
const MUSCLE_GROUPS = [
  'abdomen',
  'arms',
  'back',
  'chest',
  'core',
  'full_body',
  'glutes',
  'legs',
  'shoulders',
] as const;
const EQUIPMENT_TYPES = [
  'barbell',
  'bodyweight',
  'cable',
  'cardio',
  'dumbbell',
  'kettlebell',
  'medicine_ball',
  'other',
  'plate_machine',
  'resistance_band',
  'smith_machine',
] as const;
const MECHANIC_TYPES = ['cardio', 'compound', 'isolation', 'plyometric'] as const;

const DAY_ZERO_UTC_MS = Date.UTC(2000, 0, 1);
const DAY_MS = 86_400_000;

function dayToUtcMs(day: number): number {
  return DAY_ZERO_UTC_MS + day * DAY_MS;
}

function dateOfBirthMs(todayMs: number, age: number): number {
  const today = new Date(todayMs);
  const year = today.getUTCFullYear() - age;
  const month = today.getUTCMonth();
  const day = Math.min(today.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return Date.UTC(year, month, day);
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
      throw new GameBoyExportError('malformed', `Food log references missing food ${foodIndex}`);
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
  const now = dayToUtcMs(profile.todayDay);
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
    const food = foodByIndex.get(foodIndex) as (typeof compact.foods)[number];
    const consumedAt = dayToUtcMs(day);
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
      timezone: '+00:00',
      created_at: consumedAt,
      updated_at: consumedAt,
    };
  });

  const exercises = compact.exercises.map(
    ([index, name, muscle, equipment, mechanic, multiplierCenti]) => ({
      id: `gb-e-${index}`,
      name,
      description: 'Imported from Musclog GB',
      muscle_group: MUSCLE_GROUPS[muscle] ?? 'full_body',
      equipment_type: EQUIPMENT_TYPES[equipment] ?? 'other',
      mechanic_type: MECHANIC_TYPES[mechanic] ?? 'compound',
      source: 'user',
      load_multiplier: multiplierCenti / 100,
      created_at: now,
      updated_at: now,
    })
  );

  const workoutLogs: Record<string, unknown>[] = [];
  const workoutLogExercises: Record<string, unknown>[] = [];
  const workoutLogSets: Record<string, unknown>[] = [];

  compact.workouts.forEach(([day, volumeKg, sets], workoutIndex) => {
    const timestamp = dayToUtcMs(day);
    const workoutId = `gb-w-${workoutIndex}`;
    workoutLogs.push({
      id: workoutId,
      template_id: '',
      workout_name: 'Game Boy Workout',
      started_at: timestamp,
      completed_at: timestamp,
      timezone: '+00:00',
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
          exercise_id: `gb-e-${exerciseIndex}`,
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
    const timestamp = dayToUtcMs(day);
    return {
      id: `gb-m-${index}`,
      type: 'weight',
      value: weightKgTenths / 10,
      unit: 'kg',
      date: timestamp,
      timezone: '+00:00',
      created_at: timestamp,
      updated_at: timestamp,
    };
  });
  if (!compact.weights.some(([day]) => day === profile.todayDay)) {
    weightMetrics.push({
      id: 'gb-m-current',
      type: 'weight',
      value: profile.weightKgTenths / 10,
      unit: 'kg',
      date: now,
      timezone: '+00:00',
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
        full_name: 'Game Boy Player',
        date_of_birth: dateOfBirthMs(now, profile.age),
        gender: GENDERS[profile.gender],
        fitness_goal: FITNESS_GOALS[profile.focus],
        weight_goal: WEIGHT_GOALS[profile.weightGoal],
        activity_level: profile.activity,
        lifting_experience: EXPERIENCES[profile.experience],
        sync_id: 'gameboy-export',
        created_at: now,
        updated_at: now,
      },
    ],
    foods,
    settings: [
      {
        id: 'gb-units',
        type: 'unit_system',
        value: String(profile.units),
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
        timezone: '+00:00',
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
        date: now,
        timezone: '+00:00',
        created_at: now,
        updated_at: now,
      },
      ...weightMetrics,
    ],
  };
}

/** Leave regular exports untouched; reject marked-but-unknown cartridge exports before a wipe. */
export function expandGameBoyExportIfNeeded(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, '_gameBoyExport')) {
    return value;
  }
  return gameBoyExportToDatabaseDump(parseGameBoyExport(value));
}
