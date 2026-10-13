import type { ProgressionMode } from '@/constants/settings';

import { sameLoad, WEIGHT_EPSILON } from './sameLoad';
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
  /** The fewest reps any performed working set got: the set the whole session is judged by. */
  lowestReps?: number;
  /** Every prescribed working set was performed. Absent means "assume so". */
  complete?: boolean;
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
   * The session before `last` also fell short of the planned reps at the same load. Rated effort
   * alone cannot see this stall — a lifter missing reps at 1 in reserve never reaches 0 — so two
   * misses in a row deload just as two sessions at failure do.
   */
  missedPlanBefore?: boolean;
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
  /**
   * Set for an UNLOADED bodyweight exercise: its reps climb to this ceiling and then hold, and load
   * is never added — the app cannot know whether the lifter owns a vest or a dip belt. A bodyweight
   * exercise already done with external load (`last.weightKg > 0`) progresses its load as usual.
   */
  repCeiling?: number;
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

/**
 * A load step bigger than this share of the current load is too coarse to progress by: +2.5 kg on a
 * 6 kg lateral raise is a 40% jump. Such an exercise keeps climbing reps instead.
 */
const MAX_LOAD_STEP_SHARE = 0.25;

/**
 * Whether adding `incrementKg` to `loadKg` is a sensible progression step. An unloaded exercise
 * (bodyweight) has no share to measure, so the step stands.
 */
export const loadStepIsUsable = (loadKg: number, incrementKg: number): boolean =>
  loadKg <= 0 || incrementKg <= loadKg * MAX_LOAD_STEP_SHARE;

/**
 * The deload is a share of the load, not one step: 2.5 kg is about 2% of a 120 kg squat and clears
 * nothing. Matches the linear rule's default deload.
 */
const DELOAD_SHARE = 0.1;

/** How many load steps {@link loadBelow} walks down before deciding nothing lighter exists. */
const MAX_LOAD_STEPS_DOWN = 64;

type LoadSnap = { incrementKg: number; roundLoad: (kg: number) => number };

/**
 * The heaviest load the equipment can really be set to that is at or below `targetKg` AND strictly
 * below `currentKg` — the snap every deload goes through.
 *
 * Rounding to the nearest loadable weight is not enough for a deload: a 10% cut of a 10 kg dumbbell
 * is 9 kg, which rounds straight back to 10 kg, so the "deload" changes nothing and the lifter is
 * held at a load they keep failing, forever. Walking down one step at a time until the load is both
 * no heavier than asked and lighter than now guarantees a real drop whenever one exists. When none
 * does (an empty bar, the lightest dumbbell), `currentKg` comes back unchanged and the caller must
 * not claim a deload.
 */
export function loadBelow(
  currentKg: number,
  targetKg: number,
  { incrementKg, roundLoad }: LoadSnap
) {
  const ceiling = Math.min(targetKg, currentKg);
  let load = roundLoad(Math.max(0, ceiling));
  for (let i = 0; i < MAX_LOAD_STEPS_DOWN && load > 0; i++) {
    if (load <= ceiling + WEIGHT_EPSILON && !sameLoad(load, currentKg)) {
      return load;
    }

    const next = roundLoad(Math.max(0, load - incrementKg));
    if (next >= load) {
      break;
    }

    load = next;
  }

  return load < currentKg && !sameLoad(load, currentKg) ? load : currentKg;
}

/**
 * The load after a deload: a share of the load or one step, whichever is larger, snapped DOWN to
 * a load that is really lighter ({@link loadBelow}). Every deload in the app — automatic, the
 * linear rule's, the rep-range rules' and a lighter week's — goes through {@link loadBelow}, so none
 * of them can round back up to the load it was meant to reduce.
 */
export const deloadedLoad = (loadKg: number, step: LoadSnap): number =>
  loadBelow(loadKg, loadKg - Math.max(step.incrementKg, loadKg * DELOAD_SHARE), step);

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
/**
 * The next reps for an unloaded bodyweight exercise that earned a progression: one more rep, up to
 * its ceiling. At the ceiling the reps hold and the explanation says how to keep progressing.
 */
function bodyweightRepTarget(
  last: LastWorkingSession,
  fromReps: number,
  ceiling: number
): StartTarget {
  if (fromReps >= ceiling) {
    return {
      weightKg: last.weightKg,
      reps: Math.max(fromReps, last.reps),
      kind: 'repeat',
      rule: { kind: 'ceiling', ceiling },
    };
  }

  return { weightKg: last.weightKg, reps: fromReps + 1, kind: 'progression' };
}

function computeUnratedTarget({
  last,
  planReps,
  isCompound,
  incrementKg,
  roundLoad,
  repCeiling,
}: StartTargetInput): StartTarget {
  const hold: StartTarget = { weightKg: last.weightKg, reps: last.reps, kind: 'repeat' };
  // The session is judged by its weakest set: one strong first set says nothing about the rest.
  const worstReps = last.lowestReps ?? last.reps;
  if (planReps == null || planReps <= 0 || worstReps < planReps) {
    return hold;
  }

  const { minReps, maxReps } = repsFirstRange(isCompound, planReps);
  const range = { repMin: minReps, repMax: maxReps };
  if (repCeiling != null) {
    const target = bodyweightRepTarget(last, worstReps, repCeiling);
    return target.rule
      ? target
      : { ...target, rule: { kind: 'range', outcome: 'add_reps', ...range } };
  }

  if (worstReps < maxReps || !loadStepIsUsable(last.weightKg, incrementKg)) {
    return {
      weightKg: last.weightKg,
      reps: worstReps + 1,
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
 *  - Nothing left (average 0), or the planned reps missed, for the second session in a row at
 *    this load: deload (`deloadedLoad`). The first such session repeats — one hard day is noise,
 *    not a stall.
 *  - Otherwise: repeat last time.
 *  - Effort never rated: double progression on reps alone (`computeUnratedTarget`).
 *  - An unloaded bodyweight exercise (`repCeiling`) only ever adds reps, up to its ceiling.
 */
export function computeStartTarget(input: StartTargetInput): StartTarget {
  const {
    last,
    failedBefore = false,
    missedPlanBefore = false,
    planReps,
    progressionMode,
    isCompound,
    incrementKg,
    roundLoad,
    repCeiling,
  } = input;
  const averageRir = last.averageRepsInReserve;
  // Unfinished work never counts as success: hold until the whole prescription was done.
  if (last.complete === false) {
    return { weightKg: last.weightKg, reps: last.reps, kind: 'repeat' };
  }

  if (last.rirRecorded === false) {
    return computeUnratedTarget(input);
  }

  const hitPlan = planReps == null || (last.lowestReps ?? last.reps) >= planReps;
  if (averageRir >= PROGRESS_REPS_IN_RESERVE && hitPlan) {
    if (repCeiling != null) {
      return bodyweightRepTarget(last, last.reps, repCeiling);
    }

    if (progressionMode === 'weight_first' && loadStepIsUsable(last.weightKg, incrementKg)) {
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

    if (!loadStepIsUsable(last.weightKg, incrementKg)) {
      // No sensible load step for this load: keep adding reps past the range.
      return { weightKg: last.weightKg, reps: last.reps + 1, kind: 'progression' };
    }

    return { weightKg: roundLoad(last.weightKg + incrementKg), reps: minReps, kind: 'progression' };
  }

  if ((averageRir === 0 && failedBefore) || (!hitPlan && missedPlanBefore)) {
    const weightKg = deloadedLoad(last.weightKg, { incrementKg, roundLoad });
    // Nothing lighter to go to (an unloaded or already-lightest exercise): it is a repeat, not a
    // deload the numbers do not show.
    return { weightKg, reps: last.reps, kind: weightKg < last.weightKg ? 'deload' : 'repeat' };
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
        last: {
          weightKg: last.weightKg,
          reps: last.reps,
          averageRepsInReserve: last.averageRepsInReserve,
        },
        now: { weightKg: target.weightKg, reps: target.reps },
        ...(target.rule ? { rule: target.rule } : {}),
      },
    });
  }

  return changes;
}
