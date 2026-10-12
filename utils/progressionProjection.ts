import type { ProgressionMode } from '@/constants/settings';

import {
  type HistorySession,
  type PlannedRuleSet,
  planRuleChanges,
  type ProgressionRule,
  type ProgressionSessionState,
  type RuleLoadStep,
} from './progressionRules';
import { computeStartTarget, planStartChanges, type StartSetChange } from './setProgression';

export type ExerciseRecommendation = {
  sets: PlannedRuleSet[];
  changes: StartSetChange[];
  state: ProgressionSessionState | null;
  previous: HistorySession | null;
  rule: ProgressionRule | null;
  status: 'rule' | 'suggested' | 'learning' | 'attention';
};

export function projectExerciseProgression(input: {
  planned: PlannedRuleSet[];
  history: HistorySession[];
  rule: ProgressionRule | null;
  step: RuleLoadStep;
  automatic: boolean;
  progressionMode: ProgressionMode;
  isCompound: boolean;
  isBodyweight: boolean;
}): ExerciseRecommendation {
  const { planned, history, rule, step } = input;
  let changes: StartSetChange[] = [];
  let state: ProgressionSessionState | null = null;
  if (rule) {
    ({ changes, state } = planRuleChanges(rule, planned, history, step));
  } else if (input.automatic && history[0]?.sets.length) {
    const previous = history[0].sets;
    const rated = previous.filter((set) => set.rirRecorded !== false);
    const last = {
      weightKg: previous[0].weightKg,
      reps: previous[0].reps,
      averageRepsInReserve: rated.length
        ? rated.reduce((sum, set) => sum + set.repsInReserve, 0) / rated.length
        : 0,
      rirRecorded: rated.length > 0,
    };
    changes = planStartChanges(
      planned,
      computeStartTarget({
        last,
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
