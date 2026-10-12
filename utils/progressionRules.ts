import type { StartAdjustmentCause, StartRuleDetail } from './setAdjustment';
import type { StartSetChange } from './setProgression';
import { calculateAverage1RM } from './workoutCalculator';

/**
 * Progression rules a user attaches to an exercise of a workout: the method the numbers move by,
 * stored as data (`workout_template_exercises.progression_json`) instead of being the one algorithm
 * the app ships. An exercise with no rule keeps the automatic progression (`computeStartTarget`),
 * which is unchanged.
 *
 * A rule only ever reads PERFORMED reps and loads, never reps in reserve: RIR is optional, and a
 * performed set that was never rated carries a 0 placeholder that would read as "to failure". The
 * one exception is the percentage rule's estimated 1RM, where a rated RIR only makes the estimate
 * better and an unrated 0 costs nothing.
 */
export const PROGRESSION_RULE_TYPES = [
  'double_progression',
  'linear',
  'top_set_backoff',
  'percentage',
] as const;

export type ProgressionRuleType = (typeof PROGRESSION_RULE_TYPES)[number];

/** Work in a rep range at one load; when every set reaches the top, add load and start again. */
export type DoubleProgressionRule = {
  type: 'double_progression';
  repMin: number;
  repMax: number;
};

/** Fixed reps; add load after every session that got them all, deload after repeated misses. */
export type LinearProgressionRule = {
  type: 'linear';
  reps: number;
  failuresBeforeDeload: number;
  deloadPercent: number;
};

/** One heavy set progressed through a rep range, then back-off sets at a share of its load. */
export type TopSetBackoffRule = {
  type: 'top_set_backoff';
  repMin: number;
  repMax: number;
  backoffPercent: number;
  backoffReps: number;
};

/**
 * Every working set at a share of a training max. The training max is carried from session to
 * session (see {@link resolveTrainingMax}) and goes up one load step after a session that got every
 * rep. `trainingMaxKg` is where it starts; without one it is estimated from the last session.
 */
export type PercentageRule = {
  type: 'percentage';
  reps: number;
  percentOfTrainingMax: number;
  trainingMaxPercent: number;
  trainingMaxKg?: number;
};

export type ProgressionRule = (
  DoubleProgressionRule | LinearProgressionRule | TopSetBackoffRule | PercentageRule
) & { resetAt?: number };

type NumericField<R> = {
  [K in keyof R]-?: R[K] extends number | undefined ? K : never;
}[keyof R];

export type FieldBounds = { min: number; max: number; step: number };

/**
 * How many recent sessions a rule may look back over. The history read and the linear rule's
 * deload threshold share it, so the threshold can never ask for more sessions than are read.
 */
export const PROGRESSION_HISTORY_SESSIONS = 5;

/**
 * The one definition of every field's range, shared by the parser (an out-of-range value makes the
 * whole rule untrusted) and the editor (its steppers clamp to it), so they cannot disagree.
 */
export const PROGRESSION_RULE_BOUNDS = {
  double_progression: {
    repMin: { min: 1, max: 50, step: 1 },
    repMax: { min: 1, max: 50, step: 1 },
  },
  linear: {
    reps: { min: 1, max: 50, step: 1 },
    failuresBeforeDeload: { min: 1, max: PROGRESSION_HISTORY_SESSIONS, step: 1 },
    deloadPercent: { min: 5, max: 50, step: 5 },
  },
  top_set_backoff: {
    repMin: { min: 1, max: 50, step: 1 },
    repMax: { min: 1, max: 50, step: 1 },
    backoffPercent: { min: 50, max: 95, step: 5 },
    backoffReps: { min: 1, max: 50, step: 1 },
  },
  percentage: {
    reps: { min: 1, max: 50, step: 1 },
    percentOfTrainingMax: { min: 30, max: 100, step: 2.5 },
    trainingMaxPercent: { min: 70, max: 100, step: 5 },
    trainingMaxKg: { min: 1, max: 1000, step: 2.5 },
  },
} as const satisfies {
  [T in ProgressionRuleType]: Record<
    NumericField<Omit<Extract<ProgressionRule, { type: T }>, 'type' | 'resetAt'>>,
    FieldBounds
  >;
};

export const DEFAULT_PROGRESSION_RULES = {
  double_progression: { type: 'double_progression', repMin: 8, repMax: 12 },
  linear: { type: 'linear', reps: 5, failuresBeforeDeload: 3, deloadPercent: 10 },
  top_set_backoff: {
    type: 'top_set_backoff',
    repMin: 4,
    repMax: 6,
    backoffPercent: 85,
    backoffReps: 8,
  },
  percentage: { type: 'percentage', reps: 5, percentOfTrainingMax: 80, trainingMaxPercent: 90 },
} as const satisfies { [T in ProgressionRuleType]: Extract<ProgressionRule, { type: T }> };

export const defaultProgressionRule = (type: ProgressionRuleType): ProgressionRule => ({
  ...DEFAULT_PROGRESSION_RULES[type],
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const inBounds = (value: unknown, bounds: FieldBounds): value is number =>
  isFiniteNumber(value) && value >= bounds.min && value <= bounds.max;

/**
 * Reduces an unknown value to a rule carrying only the fields its type declares, or null when it is
 * not a valid rule. A row can come from a newer build, a backup or a share: a rule that cannot be
 * trusted is dropped (the exercise falls back to the automatic progression) rather than run.
 */
function toProgressionRule(value: unknown): ProgressionRule | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const type = candidate.type;
  if (!PROGRESSION_RULE_TYPES.includes(type as ProgressionRuleType)) {
    return null;
  }

  const bounds: Record<string, FieldBounds> = PROGRESSION_RULE_BOUNDS[type as ProgressionRuleType];
  const rule: Record<string, unknown> = { type };
  if (isFiniteNumber(candidate.resetAt) && candidate.resetAt > 0) {
    rule.resetAt = candidate.resetAt;
  }
  for (const [field, fieldBounds] of Object.entries(bounds)) {
    const fieldValue = candidate[field];
    // The training max is the only optional field: absent means "estimate it".
    if (field === 'trainingMaxKg' && fieldValue == null) {
      continue;
    }
    if (!inBounds(fieldValue, fieldBounds)) {
      return null;
    }
    rule[field] = fieldValue;
  }

  if ('repMin' in rule && (rule.repMin as number) > (rule.repMax as number)) {
    return null;
  }
  return rule as ProgressionRule;
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The rule stored on a template or log exercise, or null for "automatic". */
export function parseProgressionRule(raw: string | null | undefined): ProgressionRule | null {
  return toProgressionRule(parseJson(raw));
}

/** The column value for a rule; `undefined` (no rule) stores nothing. */
export function serializeProgressionRule(
  rule: ProgressionRule | null | undefined
): string | undefined {
  const normalized = rule ? toProgressionRule(rule) : null;
  return normalized ? JSON.stringify(normalized) : undefined;
}

/**
 * What a session's copy of its rule remembers beyond the rule itself. Only the percentage rule has
 * any: the training max that session was loaded from. Lives on `workout_log_exercises`
 * (never on a template, where it would be overwritten by the next save of the workout).
 */
export type ProgressionSessionState = { trainingMaxKg: number };

/** A log exercise's column: the rule as it stood when the session started, plus its state. */
export function serializeSessionProgression(
  rule: ProgressionRule,
  state: ProgressionSessionState | null
): string | undefined {
  const serialized = serializeProgressionRule(rule);
  if (!serialized || !state) {
    return serialized;
  }
  return JSON.stringify({ ...JSON.parse(serialized), state });
}

export function parseSessionProgressionState(
  raw: string | null | undefined
): ProgressionSessionState | null {
  const parsed = parseJson(raw) as { state?: { trainingMaxKg?: unknown } } | null;
  const trainingMaxKg = parsed?.state?.trainingMaxKg;
  return isFiniteNumber(trainingMaxKg) && trainingMaxKg > 0 ? { trainingMaxKg } : null;
}

/** One performed working set of a past session, in set order. */
export type HistorySet = {
  weightKg: number;
  reps: number;
  repsInReserve: number;
  rirRecorded?: boolean;
  prescribedIndex?: number;
};

/** A past session of the exercise, as far as a rule is concerned. */
export type HistorySession = {
  allPrescribedSetsPerformed?: boolean;
  /** Its performed working sets in set order; never empty. */
  sets: HistorySet[];
  /** The rule that session ran under, and what it remembered. Absent for an unruled session. */
  rule: ProgressionRule | null;
  state: ProgressionSessionState | null;
};

export type RuleLoadStep = {
  /** The smallest sensible change in load, in kg (`loadStepFor`). */
  incrementKg: number;
  /** Snaps a computed load to one the equipment can really be set to. */
  roundLoad: (kg: number) => number;
};

export type PlannedRuleSet = { id: string; weight: number; reps: number };

export type RulePlan = {
  changes: StartSetChange[];
  /** State this session's copy of the rule must remember (see {@link ProgressionSessionState}). */
  state: ProgressionSessionState | null;
};

/** Whether a rule can set loads for an exercise that has no history yet. */
export const ruleWorksWithoutHistory = (rule: ProgressionRule): boolean =>
  rule.type === 'percentage' && rule.trainingMaxKg != null;

type SetTarget = {
  weightKg: number;
  reps: number;
  cause: StartAdjustmentCause;
  rule: StartRuleDetail;
};

const WEIGHT_EPSILON = 0.01;
const sameLoad = (a: number, b: number) => Math.abs(a - b) < WEIGHT_EPSILON;

const causeFromLoad = (next: number, previous: number): StartAdjustmentCause =>
  sameLoad(next, previous) ? 'repeat' : next > previous ? 'progression' : 'deload';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * One rep range worked at one load: the double progression rule, and the top set of the top set +
 * back-off rule. `last` is the performed set this target follows from.
 *
 * Missing the bottom of the range deloads only when the session before missed it too, at the same
 * load (`missedBefore`): a single short session is a bad day, and the first answer to it is to hold
 * the load and aim for the bottom of the range again — the same patience the linear rule's
 * `failuresBeforeDeload` gives.
 */
function rangeTarget(
  last: HistorySet,
  allReachedTop: boolean,
  bestReps: number,
  { repMin, repMax }: { repMin: number; repMax: number },
  step: RuleLoadStep,
  missedBefore = false
): SetTarget {
  const range = { repMin, repMax };
  if (allReachedTop) {
    return {
      weightKg: step.roundLoad(last.weightKg + step.incrementKg),
      reps: repMin,
      cause: 'progression',
      rule: { kind: 'range', outcome: 'add_weight', ...range },
    };
  }
  if (bestReps < repMin && last.weightKg > 0) {
    return missedBefore
      ? {
          weightKg: step.roundLoad(Math.max(0, last.weightKg - step.incrementKg)),
          reps: repMin,
          cause: 'deload',
          rule: { kind: 'range', outcome: 'deload', ...range },
        }
      : {
          weightKg: last.weightKg,
          reps: repMin,
          cause: 'repeat',
          rule: { kind: 'range', outcome: 'hold', ...range },
        };
  }
  const reps = clamp(last.reps + 1, repMin, repMax);
  const addsReps = reps > last.reps;
  return {
    weightKg: last.weightKg,
    reps,
    cause: addsReps ? 'progression' : 'repeat',
    rule: { kind: 'range', outcome: addsReps ? 'add_reps' : 'hold', ...range },
  };
}

/**
 * Whether `before` — the session ahead of the last one — also fell short of `repMin` at the last
 * session's load, which is what turns a miss into a stall worth deloading for.
 */
function missedAtSameLoad(
  before: HistorySession | undefined,
  lastLoadKg: number,
  repMin: number,
  setIndex?: number
): boolean {
  if (!before?.sets.length) {
    return false;
  }
  const sets =
    setIndex == null
      ? before.sets
      : before.sets.filter((set, i) => (set.prescribedIndex ?? i) === setIndex);
  return (
    sets.length > 0 &&
    sameLoad(sets[0].weightKg, lastLoadKg) &&
    Math.max(...sets.map((set) => set.reps)) < repMin
  );
}

/** Double progression: each set aims one rep past its counterpart last time, within the range. */
function doubleProgressionTargets(
  rule: DoubleProgressionRule,
  planned: readonly PlannedRuleSet[],
  last: HistorySession,
  before: HistorySession | undefined,
  step: RuleLoadStep
): SetTarget[] {
  const allReachedTop =
    last.allPrescribedSetsPerformed !== false &&
    last.sets.length >= planned.length &&
    last.sets.every((set) => set.reps >= rule.repMax);
  const bestReps = Math.max(...last.sets.map((set) => set.reps));
  // Load moves for the whole exercise at once, from its first working set; while it holds, each
  // set aims one rep past its own counterpart.
  const lead = rangeTarget(
    last.sets[0],
    allReachedTop,
    bestReps,
    rule,
    step,
    missedAtSameLoad(before, last.sets[0].weightKg, rule.repMin)
  );
  if (!sameLoad(lead.weightKg, last.sets[0].weightKg)) {
    return planned.map(() => lead);
  }
  return planned.map((_, index) => {
    const counterpart = last.sets.find((set, i) => (set.prescribedIndex ?? i) === index) ?? {
      weightKg: planned[index].weight,
      reps: rule.repMin - 1,
      repsInReserve: 0,
    };
    return rangeTarget(
      { ...counterpart, weightKg: last.sets[0].weightKg },
      false,
      bestReps,
      rule,
      step
    );
  });
}

const sessionGotEveryRep = (session: HistorySession, reps: number) =>
  session.allPrescribedSetsPerformed !== false &&
  session.sets.length > 0 &&
  session.sets.every((set) => set.reps >= reps);

/**
 * Linear progression. Misses are counted only at the load of the last session: after a deload the
 * count starts again, instead of the misses that caused it triggering another one straight away.
 */
function linearTargets(
  rule: LinearProgressionRule,
  planned: readonly PlannedRuleSet[],
  history: readonly HistorySession[],
  step: RuleLoadStep
): SetTarget[] {
  const lastLoad = history[0].sets[0].weightKg;
  const detail = {
    kind: 'linear' as const,
    reps: rule.reps,
    failuresBeforeDeload: rule.failuresBeforeDeload,
    deloadPercent: rule.deloadPercent,
  };

  let target: SetTarget;
  if (sessionGotEveryRep(history[0], rule.reps)) {
    target = {
      weightKg: step.roundLoad(lastLoad + step.incrementKg),
      reps: rule.reps,
      cause: 'progression',
      rule: { ...detail, outcome: 'add_weight', failures: 0 },
    };
  } else {
    let failures = 0;
    for (const session of history) {
      if (
        ((rule as ProgressionRule).resetAt != null &&
          session.rule?.resetAt !== (rule as ProgressionRule).resetAt) ||
        (session.rule &&
          (session.rule.type !== rule.type ||
            session.rule.resetAt !== (rule as ProgressionRule).resetAt))
      ) {
        break;
      }
      if (!sameLoad(session.sets[0].weightKg, lastLoad) || sessionGotEveryRep(session, rule.reps)) {
        break;
      }
      failures++;
    }
    target =
      failures >= rule.failuresBeforeDeload && lastLoad > 0
        ? {
            weightKg: step.roundLoad(lastLoad * (1 - rule.deloadPercent / 100)),
            reps: rule.reps,
            cause: 'deload',
            rule: { ...detail, outcome: 'deload', failures },
          }
        : {
            weightKg: lastLoad,
            reps: rule.reps,
            cause: 'repeat',
            rule: { ...detail, outcome: 'hold', failures },
          };
  }
  return planned.map(() => target);
}

/**
 * Top set + back-offs: the first working set is the top set, every later one a back-off at
 * `backoffPercent` of the top set's load. Back-offs are recomputed from the top set actually
 * performed once the session is under way (`computeIntraSessionAdjustment`).
 */
function topSetBackoffTargets(
  rule: TopSetBackoffRule,
  planned: readonly PlannedRuleSet[],
  last: HistorySession,
  before: HistorySession | undefined,
  step: RuleLoadStep
): SetTarget[] {
  const lastTop = last.sets.find((set, index) => (set.prescribedIndex ?? index) === 0);
  if (!lastTop) {
    return planned.map((set, index) => ({
      weightKg:
        index === 0 ? set.weight : step.roundLoad((planned[0].weight * rule.backoffPercent) / 100),
      reps: index === 0 ? rule.repMin : rule.backoffReps,
      cause: 'repeat' as const,
      rule:
        index === 0
          ? {
              kind: 'range' as const,
              outcome: 'hold' as const,
              repMin: rule.repMin,
              repMax: rule.repMax,
            }
          : { kind: 'backoff' as const, topSetKg: planned[0].weight, percent: rule.backoffPercent },
    }));
  }
  if (lastTop.weightKg <= 0) {
    return [];
  }
  const top = rangeTarget(
    lastTop,
    lastTop.reps >= rule.repMax,
    lastTop.reps,
    { repMin: rule.repMin, repMax: rule.repMax },
    step,
    missedAtSameLoad(before, lastTop.weightKg, rule.repMin, 0)
  );
  const backoffLoad = step.roundLoad((top.weightKg * rule.backoffPercent) / 100);
  const lastBackoffLoad = last.sets[1]?.weightKg ?? backoffLoad;
  const backoff: SetTarget = {
    weightKg: backoffLoad,
    reps: rule.backoffReps,
    cause: causeFromLoad(backoffLoad, lastBackoffLoad),
    rule: { kind: 'backoff', topSetKg: top.weightKg, percent: rule.backoffPercent },
  };
  return planned.map((_, index) => (index === 0 ? top : backoff));
}

/**
 * The training max a percentage session is loaded from, and why. In order: the user changed the
 * rule's starting training max since the last session (their number wins); the last session
 * carried one (up a step if it got every rep, otherwise held); the rule names one; or it is
 * estimated from the last session's best set.
 *
 * Re-estimating every session instead would ratchet the loads down: a set at 72% of a 1RM for 3
 * reps implies a lower 1RM than the lifter has, unless every set was rated for reps in reserve.
 */
export function resolveTrainingMax(
  rule: PercentageRule,
  history: readonly HistorySession[],
  step: RuleLoadStep
): { trainingMaxKg: number; source: 'raised' | 'held' | 'set' | 'estimated' } | null {
  const carried = history[0]?.rule?.type === 'percentage' ? history[0] : undefined;
  const carriedRule = carried?.rule as PercentageRule | undefined;
  const startChanged =
    carriedRule != null &&
    (carriedRule.trainingMaxKg !== rule.trainingMaxKg ||
      carried?.rule?.resetAt !== (rule as ProgressionRule).resetAt);

  if (carried?.state && !startChanged) {
    const raised = sessionGotEveryRep(carried, rule.reps);
    return {
      trainingMaxKg: raised
        ? carried.state.trainingMaxKg + step.incrementKg
        : carried.state.trainingMaxKg,
      source: raised ? 'raised' : 'held',
    };
  }
  if (rule.trainingMaxKg != null) {
    return { trainingMaxKg: rule.trainingMaxKg, source: 'set' };
  }
  const last = history[0];
  if (!last) {
    return null;
  }
  const estimatedOneRepMaxKg = Math.max(
    ...last.sets.map((set) =>
      calculateAverage1RM(set.weightKg, set.reps, set.rirRecorded === false ? 0 : set.repsInReserve)
    )
  );
  if (!(estimatedOneRepMaxKg > 0)) {
    return null;
  }
  return {
    trainingMaxKg: (estimatedOneRepMaxKg * rule.trainingMaxPercent) / 100,
    source: 'estimated',
  };
}

function percentageTargets(
  rule: PercentageRule,
  planned: readonly PlannedRuleSet[],
  history: readonly HistorySession[],
  step: RuleLoadStep
): { targets: SetTarget[]; state: ProgressionSessionState | null } {
  const trainingMax = resolveTrainingMax(rule, history, step);
  if (!trainingMax) {
    return { targets: [], state: null };
  }
  const weightKg = step.roundLoad((trainingMax.trainingMaxKg * rule.percentOfTrainingMax) / 100);
  const previousLoad = history[0]?.sets[0].weightKg ?? weightKg;
  const target: SetTarget = {
    weightKg,
    reps: rule.reps,
    cause: causeFromLoad(weightKg, previousLoad),
    rule: {
      kind: 'percentage',
      trainingMaxKg: trainingMax.trainingMaxKg,
      percent: rule.percentOfTrainingMax,
      raised: trainingMax.source === 'raised',
    },
  };
  return {
    targets: planned.map(() => target),
    state: { trainingMaxKg: trainingMax.trainingMaxKg },
  };
}

/**
 * The start-of-workout changes a rule makes to an exercise's planned working sets (warm-ups
 * excluded, in set order), each with the explanation it carries.
 *
 * Unlike the automatic progression — which rewrites only a block of straight sets — a rule owns
 * every working set of its exercise: the top set + back-off rule exists precisely to prescribe sets
 * that differ. `history` is most recent first and may be empty only for a rule that
 * {@link ruleWorksWithoutHistory}. A set whose target equals the plan is not touched.
 */
export function planRuleChanges(
  rule: ProgressionRule,
  planned: readonly PlannedRuleSet[],
  history: readonly HistorySession[],
  step: RuleLoadStep
): RulePlan {
  if (planned.length === 0) {
    return { changes: [], state: null };
  }

  let targets: SetTarget[];
  let state: ProgressionSessionState | null = null;
  if (rule.type === 'percentage') {
    ({ targets, state } = percentageTargets(rule, planned, history, step));
  } else if (history.length === 0) {
    if (rule.type === 'top_set_backoff') {
      targets = planned.map((set, index) =>
        index === 0
          ? {
              weightKg: set.weight,
              reps: rule.repMin,
              cause: 'repeat',
              rule: { kind: 'range', repMin: rule.repMin, repMax: rule.repMax, outcome: 'hold' },
            }
          : {
              weightKg: step.roundLoad((planned[0].weight * rule.backoffPercent) / 100),
              reps: rule.backoffReps,
              cause: 'repeat',
              rule: { kind: 'backoff', topSetKg: planned[0].weight, percent: rule.backoffPercent },
            }
      );
    } else {
      targets = planned.map((set) => ({
        weightKg: set.weight,
        reps: rule.type === 'linear' ? rule.reps : rule.repMin,
        cause: 'repeat',
        rule:
          rule.type === 'linear'
            ? {
                kind: 'linear',
                reps: rule.reps,
                failuresBeforeDeload: rule.failuresBeforeDeload,
                deloadPercent: rule.deloadPercent,
                outcome: 'hold',
                failures: 0,
              }
            : { kind: 'range', repMin: rule.repMin, repMax: rule.repMax, outcome: 'hold' },
      }));
    }
  } else if (rule.type === 'double_progression') {
    targets = doubleProgressionTargets(rule, planned, history[0], history[1], step);
  } else if (rule.type === 'linear') {
    targets = linearTargets(rule, planned, history, step);
  } else {
    targets = topSetBackoffTargets(rule, planned, history[0], history[1], step);
  }

  const lastSets = history[0]?.sets ?? [];
  const changes: StartSetChange[] = [];
  targets.forEach((target, index) => {
    const set = planned[index];
    const weightChanged = !sameLoad(set.weight, target.weightKg);
    if (!weightChanged && set.reps === target.reps) {
      return;
    }
    const field = weightChanged ? 'weight' : 'reps';
    const counterpart = lastSets.find((set, i) => (set.prescribedIndex ?? i) === index);
    changes.push({
      setId: set.id,
      weightKg: target.weightKg,
      reps: target.reps,
      adjustment: {
        cause: target.cause,
        field,
        from: field === 'weight' ? set.weight : set.reps,
        to: field === 'weight' ? target.weightKg : target.reps,
        plan: { weightKg: set.weight, reps: set.reps },
        // A rule with no history (a set training max) has no "last time": it reads as the plan.
        last: counterpart
          ? {
              weightKg: counterpart.weightKg,
              reps: counterpart.reps,
              averageRepsInReserve: counterpart.repsInReserve,
            }
          : { weightKg: set.weight, reps: set.reps, averageRepsInReserve: 0 },
        now: { weightKg: target.weightKg, reps: target.reps },
        rule: target.rule,
      },
    });
  });

  return { changes, state };
}
