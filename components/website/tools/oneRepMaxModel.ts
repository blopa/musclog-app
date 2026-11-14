import { MAX_E1RM_REPS } from '@/utils/relativeStrength';
import {
  calculate1RM,
  calculateAverage1RM,
  calculateRepsForTargetRIR,
  type FormulaType,
} from '@/utils/workoutCalculator';

import { isWholeInRange, isInRange, parseToolNumber } from './toolNumbers';

/** Reps in reserve the app accepts on a set (RIR 0 to 9). */
export const MAX_REPS_IN_RESERVE = 9;
export const MAX_ONE_REP_MAX_WEIGHT = 2500;

/** The percentages the table lists, heaviest first. */
export const ONE_REP_MAX_PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] as const;

/** The seven formulas the app averages, in the order it averages them. */
export const ONE_REP_MAX_FORMULAS: readonly FormulaType[] = [
  'Epley',
  'Brzycki',
  'Lander',
  'Lombardi',
  'Mayhew',
  'OConner',
  'Wathen',
];

export interface OneRepMaxInput {
  weight: number;
  reps: number;
  repsInReserve: number;
}

export type OneRepMaxProblem = 'weight' | 'reps' | 'repsTooHigh' | 'reserve';

export type OneRepMaxValidation =
  { ok: true; input: OneRepMaxInput } | { ok: false; problem: OneRepMaxProblem | null };

/**
 * Reads the three fields. `problem: null` means nothing has been typed yet (no message wanted);
 * a named problem is a field that has text but cannot be used. Reps above `MAX_E1RM_REPS` are
 * refused on purpose: the app gives no estimate for them either, because a long set measures
 * endurance, and every formula drifts further from the truth the more reps it extrapolates.
 */
export function validateOneRepMaxInput(
  weightText: string,
  repsText: string,
  reserveText: string
): OneRepMaxValidation {
  const weight = parseToolNumber(weightText);
  const reps = parseToolNumber(repsText);
  const reserve = reserveText.trim() === '' ? 0 : parseToolNumber(reserveText);

  if (weightText.trim() === '' || repsText.trim() === '') {
    return { ok: false, problem: null };
  }

  if (!isInRange(weight, 0.1, MAX_ONE_REP_MAX_WEIGHT)) {
    return { ok: false, problem: 'weight' };
  }

  if (reps !== null && Number.isInteger(reps) && reps > MAX_E1RM_REPS) {
    return { ok: false, problem: 'repsTooHigh' };
  }

  if (!isWholeInRange(reps, 1, MAX_E1RM_REPS)) {
    return { ok: false, problem: 'reps' };
  }

  if (!isWholeInRange(reserve, 0, MAX_REPS_IN_RESERVE)) {
    return { ok: false, problem: 'reserve' };
  }

  return { ok: true, input: { weight, reps, repsInReserve: reserve } };
}

export interface OneRepMaxRow {
  percent: number;
  weight: number;
  /** Reps to failure the average of the formulas gives at that load. */
  reps: number;
}

export interface OneRepMaxEstimate {
  /** The average of the seven formulas: the number the app uses. */
  oneRepMax: number;
  /** The lowest and highest single-formula estimates, so the spread is visible. */
  low: number;
  high: number;
  formulas: { formula: FormulaType; value: number }[];
  rows: OneRepMaxRow[];
}

/**
 * The estimate and the percentage table, from the SAME functions the app uses for a logged set
 * (`calculateAverage1RM`, `calculateRepsForTargetRIR`), so this page and the app cannot disagree.
 */
export function estimateOneRepMax({
  weight,
  reps,
  repsInReserve,
}: OneRepMaxInput): OneRepMaxEstimate {
  const oneRepMax = calculateAverage1RM(weight, reps, repsInReserve);
  const formulas = ONE_REP_MAX_FORMULAS.map((formula) => ({
    formula,
    value: calculate1RM(weight, reps, formula, repsInReserve) ?? 0,
  }));
  const values = formulas.map((entry) => entry.value);

  return {
    oneRepMax,
    low: Math.min(...values),
    high: Math.max(...values),
    formulas,
    rows: ONE_REP_MAX_PERCENTAGES.map((percent) => {
      const load = (oneRepMax * percent) / 100;
      return { percent, weight: load, reps: calculateRepsForTargetRIR(oneRepMax, load, 0) };
    }),
  };
}
