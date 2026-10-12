import type { ProgressionMode } from '@/constants/settings';

import {
  DEFAULT_TARGET_REPS_IN_RESERVE,
  type StartAdjustmentCause,
  type StartRuleDetail,
  type StartSetAdjustment,
} from './setAdjustment';

/** How the last session of an exercise went, as far as the next one is concerned. */
export interface LastWorkingSession {
  /** The first working set's load: the one the next session is built from. */
  weightKg: number;
  /** The first working set's reps. */
  reps: number;
  /** Average reps in reserve across ALL its working sets. */
  averageRepsInReserve: number;
  rirRecorded?: boolean;
}

export interface StartTargetInput {
  last: LastWorkingSession;
  /**
   * The session before `last` also ended with no reps in reserve at the same load. One session at
   * failure is a hard day, not a stall, so it alone never deloads.
   */
  failedBefore?: boolean;
  /**
   * The reps the plan prescribes, when there is a plan. `reps_first` then works upward from them
   * instead of from a generic range, so a 5-rep strength block stays a 5-rep block.
   */
  planReps?: number;
  progressionMode: ProgressionMode;
  isCompound: boolean;
  /** The smallest sensible change in load for this equipment (see `incrementFor`). */
  incrementKg: number;
  /** Snaps a load to what the equipment can really be set to. */
  roundLoad: (kg: number) => number;
}

export interface StartTarget {
  weightKg: number;
  reps: number;
  kind: StartAdjustmentCause;
  /**
   * Why, when the reason is not "reps in reserve". An unrated session progresses on reps alone,
   * and its explanation must not claim a reps-in-reserve figure nobody recorded.
   */
  rule?: StartRuleDetail;
}

/**
 * Rep ranges the reps-first mode works within when there is no plan to anchor it (an exercise added
 * mid-session): compound lifts live lower than isolation work.
 */
const COMPOUND_BASE_REPS = 10;
const ISOLATION_BASE_REPS = 14;
const REP_RANGE_HALF_WIDTH = 2;
/** With a plan, reps climb this far above the planned reps before the load goes up instead. */
const PLAN_REP_HEADROOM = 2;
/**
 * Reps in reserve at or above which last time met its target and the load can move on. This is the
 * target the live session holds sets at (`DEFAULT_TARGET_REPS_IN_RESERVE`): waiting for 3 meant a
 * lifter who trained exactly as prescribed, at 1–2 in reserve, was told to repeat forever.
 */
const PROGRESS_REPS_IN_RESERVE = DEFAULT_TARGET_REPS_IN_RESERVE;

/** The default reps for an exercise with no history. */
export const defaultRepsFor = (isCompound: boolean): number =>
  isCompound ? COMPOUND_BASE_REPS : ISOLATION_BASE_REPS;

/** The rep range `reps_first` progresses through: anchored on the plan when there is one. */
export function repsFirstRange(
  isCompound: boolean,
  planReps?: number
): { minReps: number; maxReps: number } {
  if (planReps != null && planReps > 0) {
    return { minReps: planReps, maxReps: planReps + PLAN_REP_HEADROOM };
  }
  const baseReps = defaultRepsFor(isCompound);
  return { minReps: baseReps - REP_RANGE_HALF_WIDTH, maxReps: baseReps + REP_RANGE_HALF_WIDTH };
}

/**
 * Progression for a session whose effort was never rated. Reps in reserve is optional, and without
 * it the only evidence is the reps themselves, so this is double progression: climb the plan's rep
 * range, then add load. Without a plan to anchor the range (an exercise added mid-session) there is
 * nothing to judge the reps against, so the load holds.
 */
function computeUnratedTarget({
  last,
  planReps,
  isCompound,
  incrementKg,
  roundLoad,
}: StartTargetInput): StartTarget {
  const hold: StartTarget = { weightKg: last.weightKg, reps: last.reps, kind: 'repeat' };
  if (planReps == null || planReps <= 0 || last.reps < planReps) {
    return hold;
  }

  const { minReps, maxReps } = repsFirstRange(isCompound, planReps);
  const range = { repMin: minReps, repMax: maxReps };
  if (last.reps < maxReps) {
    return {
      weightKg: last.weightKg,
      reps: last.reps + 1,
      kind: 'progression',
      rule: { kind: 'range', outcome: 'add_reps', ...range },
    };
  }

  return {
    weightKg: roundLoad(last.weightKg + incrementKg),
    reps: minReps,
    kind: 'progression',
    rule: { kind: 'range', outcome: 'add_weight', ...range },
  };
}

/**
 * What the next session of an exercise should start at, from how the last one went — the smart
 * double progression the app has always offered when an exercise is added mid-session, now with the
 * REASON attached so it can be shown.
 *
 *  - Target effort met or beaten (average ≥ the target reps in reserve) and the planned reps hit:
 *    progress. `weight_first` adds one increment; `reps_first` adds a rep until the top of the range (`repsFirstRange`), then adds
 *    the increment and resets to the bottom.
 *  - Nothing left (average 0) for the second session in a row at this load: deload by one
 *    increment. The first such session repeats — one hard day is noise, not a stall.
 *  - Otherwise: repeat last time.
 *  - Effort never rated: double progression on reps alone (`computeUnratedTarget`).
 */
export function computeStartTarget(input: StartTargetInput): StartTarget {
  const {
    last,
    failedBefore = false,
    planReps,
    progressionMode,
    isCompound,
    incrementKg,
    roundLoad,
  } = input;
  const averageRir = last.averageRepsInReserve;
  if (last.rirRecorded === false) {
    return computeUnratedTarget(input);
  }

  const hitPlan = planReps == null || last.reps >= planReps;
  if (averageRir >= PROGRESS_REPS_IN_RESERVE && hitPlan) {
    if (progressionMode === 'weight_first') {
      return {
        weightKg: roundLoad(last.weightKg + incrementKg),
        reps: last.reps,
        kind: 'progression',
      };
    }

    const { minReps, maxReps } = repsFirstRange(isCompound, planReps);
    if (last.reps < maxReps) {
      return { weightKg: last.weightKg, reps: last.reps + 1, kind: 'progression' };
    }

    return { weightKg: roundLoad(last.weightKg + incrementKg), reps: minReps, kind: 'progression' };
  }

  if (averageRir === 0 && failedBefore) {
    return {
      weightKg: roundLoad(Math.max(0, last.weightKg - incrementKg)),
      reps: last.reps,
      kind: 'deload',
    };
  }

  return { weightKg: last.weightKg, reps: last.reps, kind: 'repeat' };
}

export interface PlannedWorkingSet {
  id: string;
  weight: number;
  reps: number;
}

export interface StartSetChange {
  setId: string;
  weightKg: number;
  reps: number;
  adjustment: StartSetAdjustment;
}

/** Smallest change in kg that counts as a different load (SQLite floats are not exact). */
const WEIGHT_EPSILON = 0.01;
const sameLoad = (a: number, b: number) => Math.abs(a - b) < WEIGHT_EPSILON;

/**
 * Which planned sets of an exercise get the new start target, and the explanation each carries.
 *
 * Only a block of STRAIGHT sets is rewritten — those that share the plan's first working set's
 * weight and reps. A pyramid, a back-off or a drop set deliberately differs set to set, and one
 * number from last time cannot say how to move each of them, so those are left exactly as planned.
 * A set whose target would not change is not touched and carries no explanation.
 */
export function planStartChanges(
  sets: readonly PlannedWorkingSet[],
  target: StartTarget,
  last: LastWorkingSession
): StartSetChange[] {
  const baseline = sets[0];
  if (!baseline) {
    return [];
  }

  const changes: StartSetChange[] = [];
  for (const set of sets) {
    const isStraight = sameLoad(set.weight, baseline.weight) && set.reps === baseline.reps;
    if (!isStraight) {
      continue;
    }

    const weightChanged = !sameLoad(set.weight, target.weightKg);
    const repsChanged = set.reps !== target.reps;
    if (!weightChanged && !repsChanged) {
      continue;
    }

    const field = weightChanged ? 'weight' : 'reps';
    changes.push({
      setId: set.id,
      weightKg: target.weightKg,
      reps: target.reps,
      adjustment: {
        cause: target.kind,
        field,
        from: field === 'weight' ? set.weight : set.reps,
        to: field === 'weight' ? target.weightKg : target.reps,
        plan: { weightKg: set.weight, reps: set.reps },
        last: { ...last },
        now: { weightKg: target.weightKg, reps: target.reps },
        ...(target.rule ? { rule: target.rule } : {}),
      },
    });
  }

  return changes;
}
