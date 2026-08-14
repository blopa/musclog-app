import type { ProgressionMode } from '@/constants/settings';

import {
  calculateAverage1RM,
  calculateRepsForTargetRIR,
  calculateWeightForTargetRIR,
} from './workoutCalculator';

/** Reps in reserve a set is held at when its plan does not name one. */
export const DEFAULT_TARGET_REPS_IN_RESERVE = 2;

/** Smallest weight difference (kg) that counts as the user having changed the load. */
const WEIGHT_CARRY_OVER_EPSILON = 0.1;

/** Smallest change worth rewriting a planned value for. */
const ADJUSTMENT_EPSILON = 1;

export type SetAdjustmentField = 'reps' | 'weight';

export type SetAdjustmentCause =
  /** The plan's weight was replaced by the load actually used on the previous set. */
  | 'carry_over'
  /** The value was recomputed so the set still lands on its target reps in reserve. */
  | 'target_rir';

/**
 * Why the set on screen differs from the set the plan asked for. Exists so the session can
 * *say* what it changed instead of silently rewriting the user's numbers.
 */
export type SetAdjustment = {
  cause: SetAdjustmentCause;
  field: SetAdjustmentField;
  /** The planned value, before the session changed it. */
  from: number;
  /** The value the set now carries. */
  to: number;
  /** Estimated 1RM implied by the previous set, in kg — bodyweight included for bodyweight moves. */
  estimatedOneRepMaxKg: number;
  /** Reps in reserve this set is being held at. */
  targetRepsInReserve: number;
};

export type IntraSessionAdjustmentInput = {
  /** The last performed set of the same exercise in this session. */
  previousSet: { weight: number; reps: number; repsInReserve?: number };
  /** The set the plan asks for next. */
  plannedSet: { weight: number; reps: number; repsInReserve?: number };
  progressionMode: ProgressionMode;
  isBodyweight: boolean;
  bodyWeightKg: number;
};

export type IntraSessionAdjustment = {
  weight: number;
  reps: number;
  /** Null when the set is presented exactly as planned. */
  adjustment: SetAdjustment | null;
};

/**
 * Re-targets the next planned set against what actually happened on the previous one, and
 * reports the change rather than only applying it.
 *
 * Two things can move a value: the previous set's real load is carried over (so a manual
 * change there is not thrown away), and then either weight or reps — whichever
 * `progressionMode` prefers — is recomputed to hold the set at its target reps in reserve.
 * The `target_rir` step wins the explanation when both apply, because it is the one that
 * changes a number the user did not choose.
 */
export function computeIntraSessionAdjustment({
  previousSet,
  plannedSet,
  progressionMode,
  isBodyweight,
  bodyWeightKg,
}: IntraSessionAdjustmentInput): IntraSessionAdjustment {
  const plannedWeight = plannedSet.weight ?? 0;
  const plannedReps = plannedSet.reps ?? 0;
  const targetRepsInReserve = plannedSet.repsInReserve ?? DEFAULT_TARGET_REPS_IN_RESERVE;

  const estimatedOneRepMaxKg = calculateAverage1RM(
    previousSet.weight + (isBodyweight ? bodyWeightKg : 0),
    previousSet.reps,
    previousSet.repsInReserve ?? 0
  );

  // Carry the previous set's actual load over so a manual change there is respected.
  const previousWeight = previousSet.weight ?? 0;
  const didCarryOver =
    previousWeight > 0 &&
    plannedWeight > 0 &&
    Math.abs(previousWeight - plannedWeight) >= WEIGHT_CARRY_OVER_EPSILON;
  const weight = didCarryOver ? previousWeight : plannedWeight;

  const reason = { estimatedOneRepMaxKg, targetRepsInReserve };

  if (progressionMode === 'weight_first') {
    const adjustedWeight = Math.round(
      calculateWeightForTargetRIR(estimatedOneRepMaxKg, plannedReps, targetRepsInReserve)
    );

    if (Math.abs(adjustedWeight - weight) >= ADJUSTMENT_EPSILON) {
      return {
        weight: adjustedWeight,
        reps: plannedReps,
        adjustment: {
          ...reason,
          cause: 'target_rir',
          field: 'weight',
          from: plannedWeight,
          to: adjustedWeight,
        },
      };
    }
  } else {
    const adjustedReps = calculateRepsForTargetRIR(
      estimatedOneRepMaxKg,
      isBodyweight ? weight + bodyWeightKg : weight,
      targetRepsInReserve
    );

    if (Math.abs(adjustedReps - plannedReps) >= ADJUSTMENT_EPSILON) {
      return {
        weight,
        reps: adjustedReps,
        adjustment: {
          ...reason,
          cause: 'target_rir',
          field: 'reps',
          from: plannedReps,
          to: adjustedReps,
        },
      };
    }
  }

  if (didCarryOver) {
    return {
      weight,
      reps: plannedReps,
      adjustment: {
        ...reason,
        cause: 'carry_over',
        field: 'weight',
        from: plannedWeight,
        to: weight,
      },
    };
  }

  return { weight, reps: plannedReps, adjustment: null };
}
