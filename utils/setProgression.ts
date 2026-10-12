import type { ProgressionMode } from '@/constants/settings';

import type { StartAdjustmentCause, StartSetAdjustment } from './setAdjustment';

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
}

/** Rep ranges the reps-first mode works within: compound lifts live lower than isolation work. */
const COMPOUND_BASE_REPS = 10;
const ISOLATION_BASE_REPS = 14;
const REP_RANGE_HALF_WIDTH = 2;
/** Reps in reserve at or above which last time was clearly too easy. */
const TOO_EASY_REPS_IN_RESERVE = 3;

/** The default reps for an exercise with no history. */
export const defaultRepsFor = (isCompound: boolean): number =>
  isCompound ? COMPOUND_BASE_REPS : ISOLATION_BASE_REPS;

/**
 * What the next session of an exercise should start at, from how the last one went — the smart
 * double progression the app has always offered when an exercise is added mid-session, now with the
 * REASON attached so it can be shown.
 *
 *  - Plenty left in the tank (average ≥ 3 reps in reserve): progress. `weight_first` adds one
 *    increment; `reps_first` adds a rep until the top of the range, then adds the increment and
 *    resets to the bottom.
 *  - Nothing left (average 0): deload by one increment.
 *  - Otherwise: repeat last time.
 */
export function computeStartTarget({
  last,
  progressionMode,
  isCompound,
  incrementKg,
  roundLoad,
}: StartTargetInput): StartTarget {
  const averageRir = last.averageRepsInReserve;
  if (last.rirRecorded === false) {
    return { weightKg: last.weightKg, reps: last.reps, kind: 'repeat' };
  }

  if (averageRir >= TOO_EASY_REPS_IN_RESERVE) {
    if (progressionMode === 'weight_first') {
      return {
        weightKg: roundLoad(last.weightKg + incrementKg),
        reps: last.reps,
        kind: 'progression',
      };
    }

    const baseReps = defaultRepsFor(isCompound);
    const maxReps = baseReps + REP_RANGE_HALF_WIDTH;
    const minReps = baseReps - REP_RANGE_HALF_WIDTH;
    if (last.reps < maxReps) {
      return { weightKg: last.weightKg, reps: last.reps + 1, kind: 'progression' };
    }
    return { weightKg: roundLoad(last.weightKg + incrementKg), reps: minReps, kind: 'progression' };
  }

  if (averageRir === 0) {
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
      },
    });
  }

  return changes;
}
