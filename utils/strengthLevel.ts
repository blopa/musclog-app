import {
  loadBenchmarkFor,
  MAX_E1RM_REPS,
  normalizedRelativeStrength,
  RS_ADVANCED,
  RS_ELITE,
  RS_INTERMEDIATE,
  RS_NOVICE,
  type StrengthGender,
  strengthGenderFactor,
} from '@/utils/relativeStrength';
import { calculateAverage1RM } from '@/utils/workoutCalculator';

export const STRENGTH_LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

/** The window of recent training that counts as "current" strength. A product choice. */
export const STRENGTH_LEVEL_WINDOW_DAYS = 180;

export interface StrengthGradeInput {
  estimated1RmKg: number;
  bodyWeightKg: number | null;
  loadMultiplier: number;
  gender: StrengthGender;
  muscleGroup: string | null;
}

export interface StrengthGrade {
  level: StrengthLevel;
  /** `other` only, when the female scale grades differently from the male scale. */
  upperLevel: StrengthLevel | null;
  normalizedStrength: number;
  nextLevel: StrengthLevel | null;
  /** Estimated 1RM needed for `nextLevel`, in kg, unrounded. */
  nextLevelKg: number | null;
}

export interface StrengthSetInput {
  weightKg: number;
  reps: number;
  repsInReserve: number;
  rirRecorded: boolean;
  isWorkingSet: boolean;
}

/** The tier boundary that starts each level above beginner, in ascending order. */
const LEVEL_BOUNDARIES: readonly { level: StrengthLevel; boundary: number }[] = [
  { level: 'novice', boundary: RS_NOVICE },
  { level: 'intermediate', boundary: RS_INTERMEDIATE },
  { level: 'advanced', boundary: RS_ADVANCED },
  { level: 'elite', boundary: RS_ELITE },
];

// Floating point division can land a value that should be exactly on a boundary a hair below
// it. Treating anything within this tolerance as on the boundary keeps `nextLevelKg` round-trips
// stable.
const BOUNDARY_TOLERANCE = 1e-9;

function levelFor(normalized: number): StrengthLevel {
  let level: StrengthLevel = 'beginner';
  for (const { level: candidate, boundary } of LEVEL_BOUNDARIES) {
    if (normalized + BOUNDARY_TOLERANCE >= boundary) {
      level = candidate;
    }
  }

  return level;
}

/** The boundary crossed to reach the level after `level`; null at elite. */
function nextAbove(level: StrengthLevel): { level: StrengthLevel; boundary: number } | null {
  // Beginner is not in the table (it has no lower boundary), so its index is -1 and the first
  // entry, novice, is the next step.
  const index = LEVEL_BOUNDARIES.findIndex((entry) => entry.level === level);
  return LEVEL_BOUNDARIES[index + 1] ?? null;
}

/**
 * Grades a lift against the shared strength tiers. Returns null when the lift can't be graded:
 * no weigh-in, a bodyweight or cardio exercise (loadMultiplier 0), or no usable estimate.
 */
export function gradeStrength(input: StrengthGradeInput): StrengthGrade | null {
  const { estimated1RmKg, bodyWeightKg, loadMultiplier, gender, muscleGroup } = input;

  if (bodyWeightKg === null || !(bodyWeightKg > 0)) {
    return null;
  }

  if (!(loadMultiplier > 0)) {
    return null;
  }

  if (!Number.isFinite(estimated1RmKg) || estimated1RmKg <= 0) {
    return null;
  }

  const benchmark = loadBenchmarkFor(loadMultiplier);

  if (gender === 'other') {
    const maleScale = normalizedRelativeStrength(
      estimated1RmKg,
      bodyWeightKg,
      loadMultiplier,
      'other',
      muscleGroup
    );
    const femaleScale = normalizedRelativeStrength(
      estimated1RmKg,
      bodyWeightKg,
      loadMultiplier,
      'female',
      muscleGroup
    );
    const level = levelFor(maleScale);
    const femaleLevel = levelFor(femaleScale);
    return {
      level,
      upperLevel: femaleLevel === level ? null : femaleLevel,
      normalizedStrength: maleScale,
      nextLevel: null,
      nextLevelKg: null,
    };
  }

  const normalized = normalizedRelativeStrength(
    estimated1RmKg,
    bodyWeightKg,
    loadMultiplier,
    gender,
    muscleGroup
  );
  const level = levelFor(normalized);
  const next = nextAbove(level);
  const factor = strengthGenderFactor(gender, muscleGroup);

  return {
    level,
    upperLevel: null,
    normalizedStrength: normalized,
    nextLevel: next?.level ?? null,
    nextLevelKg: next ? next.boundary * bodyWeightKg * benchmark * factor : null,
  };
}

/**
 * The best estimated 1RM across the working sets of a lift, or null when none qualify.
 * Warm-ups, sets over MAX_E1RM_REPS, and empty or zero-weight sets are ignored. An unrated
 * set counts as RIR 0, the same as the volume calculation.
 */
export function bestEstimated1RmKg(sets: readonly StrengthSetInput[]): number | null {
  let best: number | null = null;

  for (const set of sets) {
    if (!set.isWorkingSet || set.reps <= 0 || set.reps > MAX_E1RM_REPS || set.weightKg <= 0) {
      continue;
    }

    const rir = set.rirRecorded ? set.repsInReserve : 0;
    const estimate = calculateAverage1RM(set.weightKg, set.reps, rir);
    if (Number.isFinite(estimate) && estimate > 0 && (best === null || estimate > best)) {
      best = estimate;
    }
  }

  return best;
}
