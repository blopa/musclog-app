import type { ProgressionMode } from '@/constants/settings';

import {
  calculateAverage1RM,
  calculateRepsForTargetRIR,
  calculateWeightForTargetRIR,
} from './workoutCalculator';

/**
 * Reps in reserve a set is held at when its plan does not name one.
 *
 * `workout_log_sets.reps_in_reserve` is a non-null number column with no "unset" value, and a
 * planned set is created carrying 0 as a reset placeholder (`WorkoutService.duplicateWorkoutLog`). So a
 * PLANNED target of 0 is read as "no target named" and takes this default. A user who deliberately
 * holds a set at 0 RIR is indistinguishable from that in the schema and gets the same treatment —
 * separating the two needs a nullable column, not a branch here.
 *
 * This only ever applies to the plan's target. The reps in reserve actually PERFORMED on the
 * previous set are used as recorded, including a genuine 0.
 */
export const DEFAULT_TARGET_REPS_IN_RESERVE = 2;

/** Smallest weight difference (kg) that counts as the user having changed the load. */
const WEIGHT_CARRY_OVER_EPSILON = 0.1;

/** Smallest change worth rewriting a planned value for. */
const ADJUSTMENT_EPSILON = 1;

export type SetAdjustmentField = 'reps' | 'weight';

/** Causes that arise between sets, from what just happened in this session. */
export type IntraSessionAdjustmentCause =
  /** The plan's weight was replaced by the load actually used on the previous set. */
  | 'carry_over'
  /** The value was recomputed so the set still lands on its target reps in reserve. */
  | 'target_rir';

/** Causes that arise when a workout is STARTED, from how the last session of this exercise went. */
export type StartAdjustmentCause =
  /** Last time left reps in the tank: the load or reps went up. */
  | 'progression'
  /** Last time left nothing in the tank: the load went down. */
  | 'deload'
  /** Last time was about right: repeat it instead of the plan's possibly stale numbers. */
  | 'repeat';

export type SetAdjustmentCause = IntraSessionAdjustmentCause | StartAdjustmentCause;

/**
 * Why the set on screen differs from the set the plan asked for, when the session changed it
 * between sets. Exists so the session can *say* what it changed instead of silently rewriting the
 * user's numbers.
 */
export type IntraSessionSetAdjustment = {
  cause: IntraSessionAdjustmentCause;
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

/** The same promise for the numbers a workout was STARTED with. Persisted with the set. */
export type StartSetAdjustment = {
  cause: StartAdjustmentCause;
  /** The primary value that changed: the weight when it moved, otherwise the reps. */
  field: SetAdjustmentField;
  /** The plan's value of `field`. */
  from: number;
  /** The value of `field` the set now carries. */
  to: number;
  /** What the plan asked for. */
  plan: { weightKg: number; reps: number };
  /** How the last session of this exercise went: its first working set and the average RIR. */
  last: { weightKg: number; reps: number; averageRepsInReserve: number };
  /** What the set carries now. */
  now: { weightKg: number; reps: number };
};

export type SetAdjustment = IntraSessionSetAdjustment | StartSetAdjustment;

export function isStartAdjustment(adjustment: SetAdjustment): adjustment is StartSetAdjustment {
  return (
    adjustment.cause === 'progression' ||
    adjustment.cause === 'deload' ||
    adjustment.cause === 'repeat'
  );
}

/**
 * Which numbers on the set the APP calculated, and so should carry the "adjusted" marker.
 *
 * A carry-over is deliberately unmarked: that load is the user's own from the previous set, not
 * something the app worked out. A re-targeted value is marked on the field `field` names; a start
 * adjustment can move both (a progression that resets the reps), so it is judged from the plan's
 * numbers against the ones the set now carries.
 */
export function adjustedFields(adjustment: SetAdjustment | null | undefined): {
  weight: boolean;
  reps: boolean;
} {
  if (!adjustment || adjustment.cause === 'carry_over') {
    return { weight: false, reps: false };
  }
  if (isStartAdjustment(adjustment)) {
    return {
      weight: Math.abs(adjustment.plan.weightKg - adjustment.now.weightKg) >= 0.01,
      reps: adjustment.plan.reps !== adjustment.now.reps,
    };
  }
  return { weight: adjustment.field === 'weight', reps: adjustment.field === 'reps' };
}

const START_CAUSES: readonly string[] = ['progression', 'deload', 'repeat'];
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Reads a persisted start adjustment, or null when it is missing or not shaped like one. A row may
 * come from a newer build or a hand-edited backup; an explanation that cannot be trusted is better
 * dropped than shown.
 */
export function parseStartAdjustment(raw: string | null | undefined): StartSetAdjustment | null {
  if (!raw) {
    return null;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const valid =
    parsed &&
    START_CAUSES.includes(parsed.cause) &&
    (parsed.field === 'weight' || parsed.field === 'reps') &&
    finite(parsed.from) &&
    finite(parsed.to) &&
    finite(parsed.plan?.weightKg) &&
    finite(parsed.plan?.reps) &&
    finite(parsed.last?.weightKg) &&
    finite(parsed.last?.reps) &&
    finite(parsed.last?.averageRepsInReserve) &&
    finite(parsed.now?.weightKg) &&
    finite(parsed.now?.reps);
  return valid ? (parsed as StartSetAdjustment) : null;
}

export const serializeStartAdjustment = (adjustment: StartSetAdjustment): string =>
  JSON.stringify(adjustment);

/**
 * What "undo" means for a start adjustment: the OTHER number the user could have started with.
 * After a progression or a deload that is what they did last time; after a "repeat" — which already
 * IS last time — it is the plan's own number.
 */
export function revertTargetFor(adjustment: StartSetAdjustment): {
  weightKg: number;
  reps: number;
} {
  return adjustment.cause === 'repeat'
    ? { weightKg: adjustment.plan.weightKg, reps: adjustment.plan.reps }
    : { weightKg: adjustment.last.weightKg, reps: adjustment.last.reps };
}

export type IntraSessionAdjustmentInput = {
  /** The last performed set of the same exercise in this session. */
  previousSet: { weight: number; reps: number; repsInReserve: number };
  /**
   * The set the plan asks for next. `repsInReserve` of 0 means the plan names no target — see
   * {@link DEFAULT_TARGET_REPS_IN_RESERVE}.
   */
  plannedSet: { weight: number; reps: number; repsInReserve: number };
  progressionMode: ProgressionMode;
  isBodyweight: boolean;
  bodyWeightKg: number;
  /**
   * Rounds a recomputed weight to one the equipment can really be set to. Without it the weight
   * lands on a whole kilogram, which is right for a lifter who never described their gym and wrong
   * for one whose bar only moves in 2.5 kg steps. See `roundToLoadable`.
   */
  roundLoad?: (kg: number) => number;
};

export type IntraSessionAdjustment = {
  weight: number;
  reps: number;
  /** Null when the set is presented exactly as planned. */
  adjustment: IntraSessionSetAdjustment | null;
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
  roundLoad = Math.round,
}: IntraSessionAdjustmentInput): IntraSessionAdjustment {
  const plannedWeight = plannedSet.weight;
  const plannedReps = plannedSet.reps;
  const targetRepsInReserve =
    plannedSet.repsInReserve > 0 ? plannedSet.repsInReserve : DEFAULT_TARGET_REPS_IN_RESERVE;

  const estimatedOneRepMaxKg = calculateAverage1RM(
    previousSet.weight + (isBodyweight ? bodyWeightKg : 0),
    previousSet.reps,
    previousSet.repsInReserve
  );

  // Carry the previous set's actual load over so a manual change there is respected.
  const previousWeight = previousSet.weight;
  const didCarryOver =
    previousWeight > 0 &&
    plannedWeight > 0 &&
    Math.abs(previousWeight - plannedWeight) >= WEIGHT_CARRY_OVER_EPSILON;
  const weight = didCarryOver ? previousWeight : plannedWeight;

  const reason = { estimatedOneRepMaxKg, targetRepsInReserve };

  if (progressionMode === 'weight_first') {
    const adjustedWeight = roundLoad(
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
