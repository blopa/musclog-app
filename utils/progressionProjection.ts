import type { ProgressionMode } from '@/constants/settings';

import {
  type HistorySession,
  type PlannedRuleSet,
  planRuleChanges,
  type ProgressionRule,
  type ProgressionSessionState,
  type RuleLoadStep,
} from './progressionRules';
import { sameLoad } from './sameLoad';
import { computeStartTarget, planStartChanges, type StartSetChange } from './setProgression';

export type ExerciseRecommendation = {
  sets: PlannedRuleSet[];
  changes: StartSetChange[];
  state: ProgressionSessionState | null;
  previous: HistorySession | null;
  rule: ProgressionRule | null;
  status: 'rule' | 'suggested' | 'learning' | 'attention';
};

/** Movements with no load or reps to progress: their sets are timed or done as prescribed. */
const NON_PROGRESSING_MECHANICS: ReadonlySet<string> = new Set([
  'cardio',
  'mobility',
  'stretching',
]);

/**
 * Whether progression may move an exercise's numbers at all. The ONE definition: the session start,
 * the workout preview and Weekly Review's "Next up" all project through this module, and a check
 * kept only at the session start let the preview promise "+1 rep" on a stretch the session would
 * never apply.
 */
export const progressesLoad = (mechanicType: string | null | undefined): boolean =>
  !NON_PROGRESSING_MECHANICS.has(mechanicType ?? '');

/** A past session's first working set and its average RATED reps in reserve. */
function summarize(session: HistorySession) {
  const rated = session.sets.filter((set) => set.rirRecorded !== false);
  return {
    weightKg: session.sets[0].weightKg,
    reps: session.sets[0].reps,
    lowestReps: Math.min(...session.sets.map((set) => set.reps)),
    complete: session.allPrescribedSetsPerformed,
    averageRepsInReserve: rated.length
      ? rated.reduce((sum, set) => sum + set.repsInReserve, 0) / rated.length
      : 0,
    rirRecorded: rated.length > 0,
  };
}

export function projectExerciseProgression(input: {
  planned: PlannedRuleSet[];
  history: HistorySession[];
  rule: ProgressionRule | null;
  step: RuleLoadStep;
  automatic: boolean;
  progressionMode: ProgressionMode;
  isCompound: boolean;
  isBodyweight: boolean;
  /** `Exercise.mechanicType`; cardio, mobility and stretching are never progressed. */
  mechanicType?: string;
  /**
   * `planned` was copied from the last session rather than from a plan (an exercise added or
   * swapped in mid-session), so it says nothing about the reps the lifter is aiming for.
   */
  plannedFromHistory?: boolean;
}): ExerciseRecommendation {
  const { planned, history, rule, step } = input;
  let changes: StartSetChange[] = [];
  let state: ProgressionSessionState | null = null;
  if (!progressesLoad(input.mechanicType)) {
    // Nothing to move: the plan stands as written.
  } else if (rule) {
    ({ changes, state } = planRuleChanges(rule, planned, history, step));
  } else if (input.automatic && history[0]?.sets.length) {
    const last = summarize(history[0]);
    const before = history[1]?.sets.length ? summarize(history[1]) : null;
    const failedBefore =
      before != null &&
      before.rirRecorded &&
      before.averageRepsInReserve === 0 &&
      sameLoad(before.weightKg, last.weightKg);
    const planReps = input.plannedFromHistory ? undefined : planned[0]?.reps;
    const missedPlanBefore =
      before != null &&
      planReps != null &&
      before.lowestReps < planReps &&
      sameLoad(before.weightKg, last.weightKg);
    changes = planStartChanges(
      planned,
      computeStartTarget({
        last,
        failedBefore,
        missedPlanBefore,
        planReps,
        ...step,
        progressionMode:
          input.isBodyweight && last.weightKg === 0 ? 'reps_first' : input.progressionMode,
        isCompound: input.isCompound,
      }),
      last
    );
  }
  const byId = new Map(changes.map((change) => [change.setId, change]));
  return {
    sets: planned.map((set) => {
      const change = byId.get(set.id);
      return change ? { id: set.id, weight: change.weightKg, reps: change.reps } : { ...set };
    }),
    changes,
    state,
    previous: history[0] ?? null,
    rule,
    status:
      rule?.type === 'percentage' && !state
        ? 'learning'
        : rule
          ? 'rule'
          : history.length && input.automatic
            ? 'suggested'
            : 'learning',
  };
}
