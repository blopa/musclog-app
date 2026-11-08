import type { MuscleGroup } from '@/database/models/Exercise';
import { muscleGroupFamily } from '@/database/models/muscleGroupFamily';

/**
 * The single definition of relative strength and its tier boundaries. Goal projection
 * (`utils/exerciseGoalProjection.ts`) and the strength level grader (`utils/strengthLevel.ts`)
 * both read from here, so they cannot disagree about where a lifter sits.
 */

export const RS_NOVICE = 0.6;
export const RS_INTERMEDIATE = 1.0;
export const RS_ADVANCED = 1.5;
export const RS_ELITE = 1.8;

/** Above this many reps a set gives no 1RM estimate: it measures endurance, not strength. */
export const MAX_E1RM_REPS = 10;

export type StrengthGender = 'male' | 'female' | 'other';

/**
 * Female-to-male ratio of the median best lift relative to body weight, used to put a
 * female lifter on the same scale as the male-referenced boundaries.
 *
 * Evidence: OpenPowerlifting raw lifters aged 18-39 (data of 2026-10-31), female median
 * divided by male median of best lift per kg bodyweight: squat 0.74, deadlift 0.76,
 * bench 0.59. Upper body is split into the torso and arms groups, which sit at the bench
 * figure; the legs group uses the squat and deadlift figures together.
 */
export const FEMALE_STRENGTH_FACTOR_LEGS = 0.75;
export const FEMALE_STRENGTH_FACTOR_UPPER = 0.6;
/** Used when no body region applies (core, other, unknown). The previous flat value. */
export const FEMALE_STRENGTH_FACTOR_DEFAULT = 0.7;

/**
 * Factor that scales the strength benchmark for a lifter's sex and the body region of
 * the lift. `other` is graded on the male scale; `gradeStrength` also reports the female scale.
 */
export function strengthGenderFactor(
  gender: StrengthGender,
  muscleGroup?: MuscleGroup | null
): number {
  if (gender !== 'female') {
    return 1;
  }

  if (!muscleGroup) {
    return FEMALE_STRENGTH_FACTOR_DEFAULT;
  }

  switch (muscleGroupFamily(muscleGroup)) {
    case 'legs':
      return FEMALE_STRENGTH_FACTOR_LEGS;
    case 'torso':
    case 'arms':
      return FEMALE_STRENGTH_FACTOR_UPPER;
    default:
      return FEMALE_STRENGTH_FACTOR_DEFAULT;
  }
}

/** The load benchmark used as a divisor. A stored 0 (bodyweight, holds, cardio) falls back to 1. */
export function loadBenchmarkFor(loadMultiplier: number): number {
  return loadMultiplier > 0 ? loadMultiplier : 1;
}

/** Who is lifting what: the facts a lift's relative strength is measured against. */
export type StrengthSubject = {
  bodyWeightKg: number;
  /** `Exercise.loadMultiplier`. A stored 0 (bodyweight, holds, cardio) falls back to 1. */
  loadMultiplier: number;
  gender: StrengthGender;
  /** The lift's muscle group, which picks the female benchmark for its body region. */
  muscleGroup?: MuscleGroup | null;
};

/** Estimated 1RM divided by the bodyweight-and-benchmark reference, for the sex and body region. */
export function normalizedRelativeStrength(
  estimated1RmKg: number,
  { bodyWeightKg, loadMultiplier, gender, muscleGroup }: StrengthSubject
): number {
  return (
    estimated1RmKg /
    (bodyWeightKg * loadBenchmarkFor(loadMultiplier) * strengthGenderFactor(gender, muscleGroup))
  );
}
