import type { ProgressionMode } from '@/constants/settings';

import { DEFAULT_BODYWEIGHT_REP_CEILING } from './bodyweightRepCeiling';
import {
  type HistorySession,
  type PlannedRuleSet,
  planRuleChanges,
  type RuleLoadStep,
} from './progressionRules';
import { type ProgressionRule, type ProgressionSessionState } from './progressionRuleSchema';
import { sameLoad } from './sameLoad';
import { computeStartTarget, planStartChanges, type StartSetChange } from './setProgression';

/**
 * Where an exercise's targets come from. `holding` is the automatic progression with history that
 * changed nothing — the targets are last time's — so it is not presented as a "suggestion".
 */
export type GuidanceState = 'rule' | 'suggested' | 'holding' | 'learning' | 'attention';

export type ExerciseRecommendation = {
  sets: PlannedRuleSet[];
  changes: StartSetChange[];
  state: ProgressionSessionState | null;
  previous: HistorySession | null;
  rule: ProgressionRule | null;
  status: GuidanceState;
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
    failed:
      rated.length > 0 && rated.filter((set) => set.repsInReserve === 0).length * 2 >= rated.length,
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
  /**
   * The exercise's rep ceiling (`utils/bodyweightRepCeiling.ts`), applied while a bodyweight
   * exercise is done unloaded. Defaults to the app's ceiling.
   */
  bodyweightRepCeiling?: number;
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
    // Bodyweight work that has never been loaded only adds reps; once the lifter logs external
    // load on it, the load progresses like any other exercise.
    const unloadedBodyweight = input.isBodyweight && last.weightKg === 0;
    const before = history[1]?.sets.length ? summarize(history[1]) : null;
    const failedBefore =
      before != null &&
      before.rirRecorded &&
      before.failed &&
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
        progressionMode: unloadedBodyweight ? 'reps_first' : input.progressionMode,
        repCeiling: unloadedBodyweight
          ? (input.bodyweightRepCeiling ?? DEFAULT_BODYWEIGHT_REP_CEILING)
          : undefined,
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
    status: recommendationStatus({
      rule,
      state,
      hasHistory: history.length > 0,
      automatic: input.automatic,
      changed: changes.length > 0,
    }),
  };
}

/** Where a projection's targets come from, as the badge beside them names it. */
function recommendationStatus({
  rule,
  state,
  hasHistory,
  automatic,
  changed,
}: {
  rule: ProgressionRule | null;
  state: ProgressionSessionState | null;
  hasHistory: boolean;
  automatic: boolean;
  changed: boolean;
}): GuidanceState {
  if (rule) {
    // A percentage rule with no training max yet is still learning one.
    return rule.type === 'percentage' && !state ? 'learning' : 'rule';
  }

  if (!hasHistory || !automatic) {
    return 'learning';
  }

  return changed ? 'suggested' : 'holding';
}
