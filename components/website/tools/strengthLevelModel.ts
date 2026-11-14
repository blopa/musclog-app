import type { Units } from '@/constants/settings';
import exercisesData from '@/data/exercisesData.json';
import type { MuscleGroup } from '@/database/models/Exercise';
import {
  loadBenchmarkFor,
  MAX_E1RM_REPS,
  RS_ADVANCED,
  RS_ELITE,
  RS_INTERMEDIATE,
  RS_NOVICE,
  type StrengthGender,
  strengthGenderFactor,
} from '@/utils/relativeStrength';
import { gradeStrength, type StrengthGrade, type StrengthLevel } from '@/utils/strengthLevel';
import { STRENGTH_GRADED_EXERCISE_IDS } from '@/utils/strengthGradedLifts';
import { displayToKg } from '@/utils/unitConversion';
import { calculateAverage1RM } from '@/utils/workoutCalculator';

import { MAX_REPS_IN_RESERVE } from './oneRepMaxModel';
import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';

/** Body weight the page accepts, in kilograms. */
export const MIN_BODY_WEIGHT_KG = 20;
export const MAX_BODY_WEIGHT_KG = 400;
/** Lifted weight the page accepts, in kilograms (the one-rep-max tool's bound). */
export const MAX_LIFTED_WEIGHT_KG = 2500;

/** The levels a boundary table lists, lowest first (beginner has no boundary of its own). */
const TABLE_BOUNDARIES: readonly { level: StrengthLevel; boundary: number }[] = [
  { level: 'novice', boundary: RS_NOVICE },
  { level: 'intermediate', boundary: RS_INTERMEDIATE },
  { level: 'advanced', boundary: RS_ADVANCED },
  { level: 'elite', boundary: RS_ELITE },
];

interface CatalogueRow {
  __freeExerciseDbId: string;
  muscleGroup: MuscleGroup;
  equipmentType: string;
  loadMultiplier: number;
}

export interface StrengthLift {
  /** Catalogue id, `fx-<slug>`. */
  id: string;
  slug: string;
  name: string;
  muscleGroup: MuscleGroup;
  loadMultiplier: number;
  /** Dumbbell lifts are graded per hand: both the benchmark and the logged weight are per hand. */
  perHand: boolean;
}

/**
 * The lifts that get a level, from the same list the app grades. `nameFor` supplies the name in
 * the visitor's language (the page passes the localized catalogue copy).
 */
export function strengthLifts(nameFor: (slug: string) => string): StrengthLift[] {
  const rows = exercisesData as CatalogueRow[];

  return rows
    .filter((row) => STRENGTH_GRADED_EXERCISE_IDS.has(`fx-${row.__freeExerciseDbId}`))
    .map((row) => ({
      id: `fx-${row.__freeExerciseDbId}`,
      slug: row.__freeExerciseDbId,
      name: nameFor(row.__freeExerciseDbId),
      muscleGroup: row.muscleGroup,
      loadMultiplier: row.loadMultiplier,
      perHand: row.equipmentType === 'dumbbell',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type StrengthCheckProblem = 'bodyWeight' | 'weight' | 'reps' | 'repsTooHigh' | 'reserve';

export interface StrengthCheckInput {
  bodyWeightKg: number;
  weightKg: number;
  reps: number;
  repsInReserve: number;
  gender: StrengthGender;
  lift: StrengthLift;
}

export type StrengthCheckValidation =
  { ok: true; input: StrengthCheckInput } | { ok: false; problem: StrengthCheckProblem | null };

export interface StrengthCheckFields {
  units: Units;
  gender: StrengthGender;
  /** The lift the visitor picked; null when nothing valid is selected. */
  lift: StrengthLift | null;
  bodyWeightText: string;
  weightText: string;
  repsText: string;
  reserveText: string;
}

/**
 * Reads the fields. Body weight, weight and reps are required: while any is empty the page shows
 * nothing (`problem: null`). The weight fields are typed in the visitor's units and converted to
 * kilograms here, once. Reps above `MAX_E1RM_REPS` are refused for the same reason the
 * one-rep-max tool refuses them: a long set measures endurance, not strength.
 */
export function validateStrengthCheck({
  units,
  gender,
  lift,
  bodyWeightText,
  weightText,
  repsText,
  reserveText,
}: StrengthCheckFields): StrengthCheckValidation {
  if (!lift || bodyWeightText.trim() === '' || weightText.trim() === '' || repsText.trim() === '') {
    return { ok: false, problem: null };
  }

  const bodyWeightValue = parseToolNumber(bodyWeightText);
  const bodyWeightKg = bodyWeightValue === null ? null : displayToKg(bodyWeightValue, units);
  if (!isInRange(bodyWeightKg, MIN_BODY_WEIGHT_KG, MAX_BODY_WEIGHT_KG)) {
    return { ok: false, problem: 'bodyWeight' };
  }

  const weightValue = parseToolNumber(weightText);
  const weightKg = weightValue === null ? null : displayToKg(weightValue, units);
  if (!isInRange(weightKg, 0.1, MAX_LIFTED_WEIGHT_KG)) {
    return { ok: false, problem: 'weight' };
  }

  const reps = parseToolNumber(repsText);
  if (reps !== null && Number.isInteger(reps) && reps > MAX_E1RM_REPS) {
    return { ok: false, problem: 'repsTooHigh' };
  }

  if (!isWholeInRange(reps, 1, MAX_E1RM_REPS)) {
    return { ok: false, problem: 'reps' };
  }

  const reserve = reserveText.trim() === '' ? 0 : parseToolNumber(reserveText);
  if (!isWholeInRange(reserve, 0, MAX_REPS_IN_RESERVE)) {
    return { ok: false, problem: 'reserve' };
  }

  return {
    ok: true,
    input: {
      bodyWeightKg,
      weightKg,
      reps,
      repsInReserve: reserve,
      gender,
      lift,
    },
  };
}

export interface StrengthTableRow {
  level: StrengthLevel;
  /** Estimated one-rep max a man of this body weight needs for the level. */
  maleKg: number;
  /** Same for the women's scale, which the app uses for a female lifter on this body region. */
  femaleKg: number;
}

/**
 * The estimated 1RM each level needs at a body weight, on both scales, for this lift. The same
 * arithmetic `gradeStrength` inverts, so a table row and a grade cannot disagree.
 */
export function strengthTable(bodyWeightKg: number, lift: StrengthLift): StrengthTableRow[] {
  const benchmark = bodyWeightKg * loadBenchmarkFor(lift.loadMultiplier);

  return TABLE_BOUNDARIES.map(({ level, boundary }) => ({
    level,
    maleKg: boundary * benchmark * strengthGenderFactor('male', lift.muscleGroup),
    femaleKg: boundary * benchmark * strengthGenderFactor('female', lift.muscleGroup),
  }));
}

/** The grade for an estimated 1RM, from the app's own `gradeStrength`. Null when ungradable. */
export function gradeEstimate({
  estimated1RmKg,
  bodyWeightKg,
  gender,
  lift,
}: Omit<StrengthCheckInput, 'weightKg' | 'reps' | 'repsInReserve'> & {
  estimated1RmKg: number;
}): StrengthGrade | null {
  return gradeStrength({
    estimated1RmKg,
    bodyWeightKg,
    loadMultiplier: lift.loadMultiplier,
    gender,
    muscleGroup: lift.muscleGroup,
  });
}

export interface StrengthCheckResult {
  estimated1RmKg: number;
  grade: StrengthGrade;
  table: StrengthTableRow[];
}

/**
 * The estimate (the app's averaged formula for a logged set, with reps in reserve), its grade and
 * the table. Null when the lift cannot be graded.
 */
export function checkStrength(input: StrengthCheckInput): StrengthCheckResult | null {
  const estimated1RmKg = calculateAverage1RM(input.weightKg, input.reps, input.repsInReserve);
  const grade = gradeEstimate({
    estimated1RmKg,
    bodyWeightKg: input.bodyWeightKg,
    gender: input.gender,
    lift: input.lift,
  });

  if (!grade) {
    return null;
  }

  return {
    estimated1RmKg,
    grade,
    table: strengthTable(input.bodyWeightKg, input.lift),
  };
}
