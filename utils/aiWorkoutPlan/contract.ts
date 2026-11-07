import { z } from 'zod';

import {
  type DocumentParseError,
  type NormalizerError,
  readEnvelope,
  trimmedText,
} from '@/utils/externalDocument';
import { isRecord } from '@/utils/isRecord';

/**
 * The workout-plan contract: the one shape ChatGPT or Claude is asked to write when someone builds
 * a plan outside the app. Everything that comes back (a file or pasted text) is untrusted until it
 * has been through {@link normalizeWorkoutPlan}.
 *
 * The document names exercises by their catalogue slug (`data/exercisesData.json`'s
 * `__freeExerciseDbId`), the same identity bundled programs use, and carries no loads: Musclog
 * suggests starting weights from the person's own profile when the plan is created.
 */
export const PLAN_SCHEMA_ID = 'musclog-workout-plan';
export const PLAN_MAJOR = 1;
export const MAX_PLAN_BYTES = 64 * 1024;

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const WORKOUT_NAME_MAX = 60;
export const NOTES_MAX = 200;
export const SUPERSET_GROUP_MAX = 20;
export const SLUG_MAX = 100;
export const MAX_WORKOUTS = 7;
export const MAX_EXERCISES_PER_WORKOUT = 20;
export const SETS_RANGE = [1, 10] as const;
export const REPS_RANGE = [1, 100] as const;
export const REST_SECONDS_RANGE = [0, 600] as const;

export const PLAN_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type PlanDifficulty = (typeof PLAN_DIFFICULTIES)[number];

/** Monday first, matching `utils/weekdays.ts` (index 0 is Monday). */
export const PLAN_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const exerciseSchema = z.strictObject({
  exerciseSlug: z.string().min(1).max(SLUG_MAX),
  sets: z.number().int().min(SETS_RANGE[0]).max(SETS_RANGE[1]),
  reps: z.number().int().min(REPS_RANGE[0]).max(REPS_RANGE[1]),
  minReps: z.number().int().min(REPS_RANGE[0]).max(REPS_RANGE[1]).optional(),
  restSeconds: z.number().int().min(REST_SECONDS_RANGE[0]).max(REST_SECONDS_RANGE[1]).optional(),
  notes: z.string().max(NOTES_MAX).optional(),
  supersetGroup: z.string().min(1).max(SUPERSET_GROUP_MAX).optional(),
});

const workoutSchema = z.strictObject({
  name: z.string().min(1).max(WORKOUT_NAME_MAX),
  exercises: z.array(exerciseSchema).min(1).max(MAX_EXERCISES_PER_WORKOUT),
});

/** The document an external assistant is asked to produce. Strict, so the schema forbids stray keys. */
export const planDocumentSchema = z.strictObject({
  schema: z.literal(PLAN_SCHEMA_ID),
  version: z.literal(PLAN_MAJOR),
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().max(DESCRIPTION_MAX).optional(),
  difficulty: z.enum(PLAN_DIFFICULTIES).optional(),
  weekdays: z.array(z.enum(PLAN_WEEKDAYS)).max(7).optional(),
  workouts: z.array(workoutSchema).min(1).max(MAX_WORKOUTS),
});

export type PlanExercise = {
  exerciseSlug: string;
  sets: number;
  /** The top of the rep range (or the only number). */
  reps: number;
  /** The bottom of the rep range, only when it is lower than {@link reps}. */
  minReps?: number;
  restSeconds?: number;
  notes?: string;
  supersetGroup?: string;
};

export type PlanWorkout = {
  /** Absent when the file named none; the plan then falls back to "Day N". */
  name?: string;
  exercises: PlanExercise[];
};

/** A plan as read from a file: bounded, trimmed, weekdays as Monday-first indexes. */
export type WorkoutPlanDraft = {
  title: string;
  description?: string;
  difficulty?: PlanDifficulty;
  weekDays: number[];
  workouts: PlanWorkout[];
};

export type PlanParseError = DocumentParseError | 'invalidPlan' | 'noExercises';

export type NormalizedPlan =
  | {
      ok: true;
      plan: WorkoutPlanDraft;
      /** Exercises that were unusable (bad numbers, no slug) and left out. */
      skippedExercises: number;
    }
  | {
      ok: false;
      error: NormalizerError<PlanParseError>;
    };

/** A whole number from a number or a numeric string ("8"); anything else is not a number. */
function toWholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)) {
    return Math.round(Number(value));
  }

  return undefined;
}

/**
 * Assistants like to write reps as a range ("8-12"). The range's top is the target and its bottom
 * is kept, which is how bundled programs store a range.
 */
function readReps(value: unknown): { reps?: number; minReps?: number } {
  if (typeof value === 'string') {
    const range = /^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/.exec(value);
    if (range) {
      const low = Number(range[1]);
      const high = Number(range[2]);
      return low < high ? { reps: high, minReps: low } : { reps: low };
    }
  }

  return { reps: toWholeNumber(value) };
}

function readExercise(raw: unknown): PlanExercise | null {
  if (!isRecord(raw)) {
    return null;
  }

  const { reps, minReps: rangeMin } = readReps(raw.reps);
  const candidate = {
    exerciseSlug: trimmedText(raw.exerciseSlug, SLUG_MAX),
    sets: toWholeNumber(raw.sets),
    reps,
    minReps: toWholeNumber(raw.minReps) ?? rangeMin,
    restSeconds: toWholeNumber(raw.restSeconds),
    notes: trimmedText(raw.notes, NOTES_MAX),
    supersetGroup: trimmedText(raw.supersetGroup, SUPERSET_GROUP_MAX),
  };
  const parsed = exerciseSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }

  const { minReps, ...rest } = parsed.data;
  return minReps !== undefined && minReps < parsed.data.reps ? { ...rest, minReps } : rest;
}

function readWeekDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const indexes = value
    .map((day) =>
      typeof day === 'string'
        ? (PLAN_WEEKDAYS as readonly string[]).indexOf(day.trim().toLowerCase())
        : -1
    )
    .filter((index) => index >= 0);
  return Array.from(new Set(indexes)).sort((a, b) => a - b);
}

/**
 * Reads an already parsed document into a plan. Lenient where an assistant is likely to slip (rep
 * ranges as text, numbers as strings, a stray key) and strict about identity: the wrong schema or a
 * newer major version is refused rather than half-understood. An exercise that cannot be read is
 * left out and counted, never repaired by guessing.
 */
export function normalizeWorkoutPlan(parsed: unknown): NormalizedPlan {
  const envelope = readEnvelope(parsed, { schemaId: PLAN_SCHEMA_ID, major: PLAN_MAJOR });
  if (!envelope.ok) {
    return envelope;
  }

  const raw = envelope.record;

  const title = trimmedText(raw.title, TITLE_MAX);
  if (!title || !Array.isArray(raw.workouts) || raw.workouts.length === 0) {
    return { ok: false, error: 'invalidPlan' };
  }

  let skippedExercises = 0;
  const workouts: PlanWorkout[] = [];
  for (const rawWorkout of raw.workouts.slice(0, MAX_WORKOUTS)) {
    if (!isRecord(rawWorkout) || !Array.isArray(rawWorkout.exercises)) {
      continue;
    }

    const exercises: PlanExercise[] = [];
    for (const rawExercise of rawWorkout.exercises) {
      const exercise = readExercise(rawExercise);
      if (exercise && exercises.length < MAX_EXERCISES_PER_WORKOUT) {
        exercises.push(exercise);
      } else {
        skippedExercises += 1;
      }
    }

    if (exercises.length > 0) {
      workouts.push({ name: trimmedText(rawWorkout.name, WORKOUT_NAME_MAX), exercises });
    }
  }

  if (workouts.length === 0) {
    return { ok: false, error: 'noExercises' };
  }

  const difficulty = (PLAN_DIFFICULTIES as readonly unknown[]).includes(raw.difficulty)
    ? (raw.difficulty as PlanDifficulty)
    : undefined;

  return {
    ok: true,
    skippedExercises,
    plan: {
      title,
      description: trimmedText(raw.description, DESCRIPTION_MAX),
      difficulty,
      weekDays: readWeekDays(raw.weekdays),
      workouts,
    },
  };
}
