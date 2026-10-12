import type { ProgressionMode } from '@/constants/settings';

import type { ProgressionRule } from './progressionRules';
import {
  calculateAverage1RM,
  calculateRepsForTargetRIR,
  calculateWeightForTargetRIR,
} from './workoutCalculator';

/**
 * Reps in reserve a set is held at when its plan does not name one.
 *
 * A planned zero is a reset placeholder, so it takes the default target. Performed effort is
 * separate: `rir_recorded = false` means unrated and cannot supply new RIR guidance; an explicitly
 * recorded zero is failure. Legacy rows without the flag retain their previous interpretation.
 */
export const DEFAULT_TARGET_REPS_IN_RESERVE = 2;

/** Smallest weight difference (kg) that counts as the user having changed the load. */
const WEIGHT_CARRY_OVER_EPSILON = 0.1;

/** Smallest change worth rewriting a planned value for. */
const ADJUSTMENT_EPSILON = 1;

/** A back-off load is exact arithmetic on the top set, so any real difference is worth showing. */
const BACKOFF_EPSILON = 0.01;

export type SetAdjustmentField = 'reps' | 'weight';

/** Causes that arise between sets, from what just happened in this session. */
export type IntraSessionAdjustmentCause =
  /** The plan's weight was replaced by the load actually used on the previous set. */
  | 'carry_over'
  /** The value was recomputed so the set still lands on its target reps in reserve. */
  | 'target_rir'
  /** A back-off set was reloaded from the top set just performed (top set + back-off rule). */
  | 'backoff';

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
export type IntraSessionSetAdjustment =
  | {
      cause: 'carry_over' | 'target_rir';
      field: SetAdjustmentField;
      /** The planned value, before the session changed it. */
      from: number;
      /** The value the set now carries. */
      to: number;
      /** Estimated 1RM implied by the previous set, in kg — bodyweight included for bodyweight moves. */
      estimatedOneRepMaxKg: number;
      /** Reps in reserve this set is being held at. */
      targetRepsInReserve: number;
    }
  | {
      cause: 'backoff';
      field: 'weight';
      from: number;
      to: number;
      /** The load the top set was actually performed at, in kg. */
      topSetKg: number;
      /** The share of it the back-off is loaded at. */
      percent: number;
    };

/**
 * What a progression rule (`utils/progressionRules.ts`) said about a start adjustment, so the
 * session can explain it in the rule's own terms. Keyed on the shape of the explanation, not on the
 * rule: a double progression and the top set of a top set + back-off rule are both a rep range.
 */
export type StartRuleDetail =
  | {
      kind: 'range';
      outcome: 'add_weight' | 'add_reps' | 'hold' | 'deload';
      repMin: number;
      repMax: number;
    }
  | {
      kind: 'linear';
      outcome: 'add_weight' | 'hold' | 'deload';
      reps: number;
      /** Sessions in a row that missed reps at this load, the last one included. */
      failures: number;
      failuresBeforeDeload: number;
      deloadPercent: number;
    }
  | { kind: 'backoff'; topSetKg: number; percent: number }
  | {
      kind: 'percentage';
      trainingMaxKg: number;
      percent: number;
      /** The training max went up a step because the last session got every rep. */
      raised: boolean;
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
  /** Present when the exercise's own progression rule set the numbers, not the automatic one. */
  rule?: StartRuleDetail;
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

function isStartRuleDetail(value: any): value is StartRuleDetail {
  switch (value?.kind) {
    case 'range':
      return (
        ['add_weight', 'add_reps', 'hold', 'deload'].includes(value.outcome) &&
        finite(value.repMin) &&
        finite(value.repMax)
      );
    case 'linear':
      return (
        ['add_weight', 'hold', 'deload'].includes(value.outcome) &&
        finite(value.reps) &&
        finite(value.failures) &&
        finite(value.failuresBeforeDeload) &&
        finite(value.deloadPercent)
      );
    case 'backoff':
      return finite(value.topSetKg) && finite(value.percent);
    case 'percentage':
      return (
        finite(value.trainingMaxKg) && finite(value.percent) && typeof value.raised === 'boolean'
      );
    default:
      return false;
  }
}

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
    finite(parsed.now?.reps) &&
    (parsed.rule === undefined || isStartRuleDetail(parsed.rule));
  return valid ? (parsed as StartSetAdjustment) : null;
}

export const serializeStartAdjustment = (adjustment: StartSetAdjustment): string =>
  JSON.stringify(adjustment);

/** Whether undoing a start adjustment restores the plan's numbers rather than last time's. */
export const revertsToPlan = (adjustment: StartSetAdjustment): boolean =>
  adjustment.cause === 'repeat' || adjustment.rule !== undefined;

/**
 * What "undo" means for a start adjustment: the OTHER number the user could have started with.
 * After a progression or a deload that is what they did last time; after a "repeat" — which already
 * IS last time — it is the plan's own number. A rule's adjustment always goes back to the plan: a
 * back-off or a percentage of a training max has no "last time" counterpart that would make sense
 * on its own.
 */
export function revertTargetFor(adjustment: StartSetAdjustment): {
  weightKg: number;
  reps: number;
} {
  return revertsToPlan(adjustment)
    ? { weightKg: adjustment.plan.weightKg, reps: adjustment.plan.reps }
    : { weightKg: adjustment.last.weightKg, reps: adjustment.last.reps };
}

export type IntraSessionAdjustmentInput = {
  /** The last performed set of the same exercise in this session. */
  previousSet: { weight: number; reps: number; repsInReserve: number; rirRecorded?: boolean };
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
  /**
   * The exercise's own progression rule, if it has one. A rule owns the numbers: the set is NOT
   * re-targeted for reps in reserve (that would undo a 5×5 or a percentage prescription mid-session)
   * and only the user's own load is carried over — except that a back-off set is reloaded from the
   * top set just performed.
   */
  rule?: ProgressionRule | null;
  /** The previous set was the exercise's first working set: the top set of a top set + back-off rule. */
  previousIsTopSet?: boolean;
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
  rule,
  previousIsTopSet = false,
}: IntraSessionAdjustmentInput): IntraSessionAdjustment {
  const plannedWeight = plannedSet.weight;
  const plannedReps = plannedSet.reps;

  if (rule?.type === 'top_set_backoff' && previousIsTopSet && previousSet.weight > 0) {
    const backoffWeight = roundLoad((previousSet.weight * rule.backoffPercent) / 100);
    return {
      weight: backoffWeight,
      reps: plannedReps,
      adjustment:
        Math.abs(backoffWeight - plannedWeight) >= BACKOFF_EPSILON
          ? {
              cause: 'backoff',
              field: 'weight',
              from: plannedWeight,
              to: backoffWeight,
              topSetKg: previousSet.weight,
              percent: rule.backoffPercent,
            }
          : null,
    };
  }
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

  if (rule || previousSet.rirRecorded === false) {
    // A rule's prescription is not re-targeted; only the carry-over below can apply.
  } else if (progressionMode === 'weight_first') {
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
