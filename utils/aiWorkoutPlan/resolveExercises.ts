import type { PlanExercise, WorkoutPlanDraft } from './contract';

/** What the matcher needs to know about one catalogue exercise: its slug and every name it has. */
export type CatalogueNames = { exerciseSlug: string; names: readonly string[] };

export type ResolvedWorkout = { name?: string; exercises: PlanExercise[] };

export type UnmatchedExercise = {
  /** What the file called it. */
  requested: string;
  /** Position of the workout in the file, for the review. */
  workoutIndex: number;
};

export type ResolvedPlan = {
  plan: WorkoutPlanDraft;
  /** The same plan with every exercise's slug replaced by a real catalogue slug, empties dropped. */
  workouts: ResolvedWorkout[];
  unmatched: UnmatchedExercise[];
};

/** Case, accents and separators carry no meaning: "3/4 Sit-Up", "3_4_Sit-Up" and "3 4 sit up" agree. */
export function normalizeExerciseKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, ' ')
    .trim();
}

/**
 * Matches each exercise the file names to a catalogue slug: the slug itself first (the assistant
 * was given the list), then a name in any bundled language. It never guesses between plausible
 * exercises: a name that is not exactly one catalogue exercise is reported, not substituted.
 */
export function resolvePlanExercises(
  plan: WorkoutPlanDraft,
  catalogue: readonly CatalogueNames[]
): ResolvedPlan {
  const bySlug = new Map<string, string>();
  const byKey = new Map<string, Set<string>>();
  for (const { exerciseSlug, names } of catalogue) {
    bySlug.set(exerciseSlug, exerciseSlug);
    for (const key of [exerciseSlug, ...names].map(normalizeExerciseKey)) {
      if (key) {
        const slugs = byKey.get(key) ?? new Set<string>();
        slugs.add(exerciseSlug);
        byKey.set(key, slugs);
      }
    }
  }

  const find = (requested: string): string | undefined => {
    const exact = bySlug.get(requested);
    if (exact) {
      return exact;
    }

    const slugs = byKey.get(normalizeExerciseKey(requested));
    return slugs?.size === 1 ? [...slugs][0] : undefined;
  };

  const unmatched: UnmatchedExercise[] = [];
  const workouts: ResolvedWorkout[] = [];
  plan.workouts.forEach((workout, workoutIndex) => {
    const exercises: PlanExercise[] = [];
    for (const exercise of workout.exercises) {
      const slug = find(exercise.exerciseSlug);
      if (!slug) {
        unmatched.push({ requested: exercise.exerciseSlug, workoutIndex });
      } else if (!exercises.some((chosen) => chosen.exerciseSlug === slug)) {
        // One exercise appears once per workout; the template builder keeps the first anyway.
        exercises.push({ ...exercise, exerciseSlug: slug });
      }
    }

    if (exercises.length > 0) {
      workouts.push({ name: workout.name, exercises });
    }
  });

  return { plan, workouts, unmatched };
}
