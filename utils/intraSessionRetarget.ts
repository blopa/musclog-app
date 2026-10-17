import type { WorkoutAutonomy } from '@/constants/settings';
import { type ProgressionRule } from '@/utils/progressionRuleSchema';
import { parseSetPrescription } from '@/utils/setPrescription';
import {
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isWarmupSet,
  type WorkoutSetCompletionState,
  type WorkoutSetCompletionStatus,
  type WorkoutSetTypeState,
} from '@/utils/workoutSetCompletion';

export type RetargetableSet = WorkoutSetCompletionState &
  WorkoutSetTypeState & {
    id: string;
    setOrder: number;
    prescriptionJson?: string | null;
  };

export type RetargetPlan<S extends RetargetableSet> = {
  /** The performed working set the targets are re-derived from. */
  previous: S;
  previousIsTopSet: boolean;
  targets: S[];
};

/**
 * Which unfinished sets of one exercise block are re-targeted after `set` was resolved, and from
 * which set. This is the ONLY place that decides it: the session service persists the result, and
 * the screens read the persisted values rather than recomputing them.
 *
 * - `manual` autonomy means the app changes no number on its own, so nothing is re-targeted — unless
 *   the exercise carries an explicit progression rule (top-set/back-off), which the user chose.
 * - A set the user typed over (`override`) is never re-targeted.
 * - A skipped set re-targets the next planned set from the last performed working set before it.
 * - `siblings` are the block's live, non-warm-up sets in `set_order`, `set` included.
 */
export function selectRetargets<S extends RetargetableSet>({
  set,
  status,
  siblings,
  rule,
  autonomy,
}: {
  set: S;
  status: WorkoutSetCompletionStatus;
  siblings: readonly S[];
  rule: ProgressionRule | null;
  autonomy: WorkoutAutonomy;
}): RetargetPlan<S> | null {
  if (status === 'planned' || isWarmupSet(set) || (autonomy === 'manual' && !rule)) {
    return null;
  }

  // `set` may already carry its new status or not yet; the explicit `status` is authoritative.
  const resolvedAs = (row: S) => (row.id === set.id ? status : row.completionStatus);
  const performedBefore = siblings.filter(
    (row) => row.setOrder < set.setOrder && isPerformedWorkoutSet(row)
  );
  const previous = status === 'performed' ? set : performedBefore.at(-1);
  if (!previous) {
    return null;
  }

  const top = siblings[0];
  const previousIsTopSet =
    rule?.type === 'top_set_backoff' && !!top && resolvedAs(top) === 'performed';
  const unfinished = siblings.filter(
    (row) => row.id !== set.id && row.setOrder > set.setOrder && isPlannedWorkoutSet(row)
  );
  // Only the next set follows a straight block; a set the user typed over is left exactly as typed.
  const targets = (previousIsTopSet ? unfinished : unfinished.slice(0, 1)).filter(
    (row) => !parseSetPrescription(row.prescriptionJson)?.override
  );
  if (targets.length === 0) {
    return null;
  }

  return { previous: previousIsTopSet ? top : previous, previousIsTopSet, targets };
}
