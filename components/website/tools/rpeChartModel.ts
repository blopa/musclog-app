import type { Units } from '@/constants/settings';
import { roundToLoadable } from '@/utils/plateCalculator';
import { repsInReserveFromRpe } from '@/utils/setEffort';
import { displayToKg } from '@/utils/unitConversion';
import { calculateAverage1RM, calculateWeightForTargetRIR } from '@/utils/workoutCalculator';

import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';

/** The RPE columns of the chart, highest effort first. */
export const CHART_RPES = [10, 9, 8, 7, 6] as const;
/** The rep rows of the chart. */
export const CHART_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
/** The RPE values the calculator offers. */
export const CALCULATOR_RPES = [10, 9, 8, 7, 6, 5] as const;
export const MAX_CALCULATOR_REPS = 10;
export const MAX_CALCULATOR_WEIGHT_KG = 2500;

/** Reps in reserve for an RPE. Every RPE the tool offers is rated, so this is never null here. */
export function reserveForRpe(rpe: number): number {
  return repsInReserveFromRpe(rpe) ?? 0;
}

/**
 * The share of a one-rep max a set of `reps` at `rpe` lifts, in whole percent. It is the app's
 * averaged formula (`calculateAverage1RM`) run at a weight of 1, so a chart cell and a logged set
 * use the same arithmetic.
 */
export function percentOfOneRepMax(reps: number, rpe: number): number {
  const multiplier = calculateAverage1RM(1, reps, reserveForRpe(rpe));
  return Math.round(100 / multiplier);
}

export interface RpeChartRow {
  reps: number;
  cells: { rpe: number; percent: number }[];
}

export function rpeChartRows(): RpeChartRow[] {
  return CHART_REPS.map((reps) => ({
    reps,
    cells: CHART_RPES.map((rpe) => ({ rpe, percent: percentOfOneRepMax(reps, rpe) })),
  }));
}

export type RpeCalculatorProblem = 'weight' | 'reps' | 'targetReps';

export interface RpeCalculatorInput {
  units: Units;
  weightKg: number;
  reps: number;
  rpe: number;
  targetReps: number;
  targetRpe: number;
}

export type RpeCalculatorValidation =
  { ok: true; input: RpeCalculatorInput } | { ok: false; problem: RpeCalculatorProblem | null };

/**
 * Reads the calculator's typed fields. `problem: null` while a field is still empty. The weight
 * is typed in the visitor's units and converted to kilograms here. RPE comes from a choice, so
 * it is already one of the offered values.
 */
export function validateRpeCalculator({
  units,
  weightText,
  repsText,
  rpe,
  targetRepsText,
  targetRpe,
}: {
  units: Units;
  weightText: string;
  repsText: string;
  rpe: number;
  targetRepsText: string;
  targetRpe: number;
}): RpeCalculatorValidation {
  if (weightText.trim() === '' || repsText.trim() === '' || targetRepsText.trim() === '') {
    return { ok: false, problem: null };
  }

  const weightValue = parseToolNumber(weightText);
  const weightKg = weightValue === null ? null : displayToKg(weightValue, units);
  if (!isInRange(weightKg, 0.1, MAX_CALCULATOR_WEIGHT_KG)) {
    return { ok: false, problem: 'weight' };
  }

  const reps = parseToolNumber(repsText);
  if (!isWholeInRange(reps, 1, MAX_CALCULATOR_REPS)) {
    return { ok: false, problem: 'reps' };
  }

  const targetReps = parseToolNumber(targetRepsText);
  if (!isWholeInRange(targetReps, 1, MAX_CALCULATOR_REPS)) {
    return { ok: false, problem: 'targetReps' };
  }

  return {
    ok: true,
    input: { units, weightKg, reps, rpe, targetReps, targetRpe },
  };
}

export interface RpeCalculatorResult {
  /** The one-rep max the set implies, in kilograms. */
  oneRepMaxKg: number;
  /** The load for the target reps at the target RPE, in kilograms, unrounded. */
  targetKg: number;
  /** The same load rounded to what a bar with standard plates can make, in kilograms. */
  roundedTargetKg: number;
}

export function calculateRpeTarget({
  units,
  weightKg,
  reps,
  rpe,
  targetReps,
  targetRpe,
}: RpeCalculatorInput): RpeCalculatorResult {
  const oneRepMaxKg = calculateAverage1RM(weightKg, reps, reserveForRpe(rpe));
  const targetKg = calculateWeightForTargetRIR(oneRepMaxKg, targetReps, reserveForRpe(targetRpe));

  return {
    oneRepMaxKg,
    targetKg,
    roundedTargetKg: roundToLoadable(targetKg, 'barbell', null, units),
  };
}
