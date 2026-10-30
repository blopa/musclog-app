import {
  type DoubleProgressionRule,
  type LinearProgressionRule,
  type PercentageRule,
  type ProgressionRule,
  type ProgressionSessionState,
  type ResetMarker,
  type TopSetBackoffRule,
} from './progressionRuleSchema';
import { sameLoad } from './sameLoad';
import type { StartAdjustmentCause, StartRuleDetail } from './setAdjustment';
import { deloadedLoad, loadBelow, type StartSetChange } from './setProgression';
import { calculateAverage1RM } from './workoutCalculator';

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
  /** When the session's workout was completed (ms). Optional: only comeback mode reads it. */
  completedAt?: number;
  /** Every prescribed working set of that session was performed. */
  allPrescribedSetsPerformed: boolean;
  /** Its performed working sets in set order; never empty. */
  sets: HistorySet[];
  /** The rule that session ran under, and what it remembered. Absent for an unruled session. */
  rule: ProgressionRule | null;
  state: ProgressionSessionState | null;
};

/**
 * The state a session that does NOT advance the rule (a Weekly Review's repeat or lighter week)
 * hands on from `last`, so the next ordinary session continues from it — or null when it must not.
 *
 * It may only be handed on while it still belongs to this rule: the same percentage method, the same
 * starting training max and the same reset. Pairing the current rule with an older rule's state
 * would hide the user's change from {@link resolveTrainingMax}, which detects a new starting max or
 * a reset precisely by comparing the rule with the one the last session ran under.
 */
export function carriedSessionState(
  rule: ProgressionRule | null,
  last: HistorySession | undefined
): ProgressionSessionState | null {
  const lastRule = last?.rule;
  if (
    rule?.type !== 'percentage' ||
    lastRule?.type !== 'percentage' ||
    lastRule.trainingMaxKg !== rule.trainingMaxKg ||
    lastRule.resetAt !== rule.resetAt
  ) {
    return null;
  }

  return last?.state ?? null;
}

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

/**
 * The performed set that stood at prescription position `index` last time, if any. The one
 * definition of "the same set last time", shared by the rules, a review's week override and the
 * prescription the session start records.
 */
export const counterpartAt = (sets: readonly HistorySet[], index: number): HistorySet | undefined =>
  sets.find((set, i) => (set.prescribedIndex ?? i) === index);

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

  const deloaded = deloadedLoad(last.weightKg, step);
  if (bestReps < repMin && last.weightKg > 0) {
    // With nothing lighter to load, a second miss can only hold.
    return missedBefore && deloaded < last.weightKg
      ? {
          weightKg: deloaded,
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
      : [counterpartAt(before.sets, setIndex)].filter((set): set is HistorySet => !!set);
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
    last.allPrescribedSetsPerformed &&
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
    const counterpart = counterpartAt(last.sets, index) ?? {
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

/**
 * Whether a past session got every rep it PRESCRIBED. A session is judged against the reps its own
 * copy of the rule asked for, not the rule as edited since: raising a rule from 5 to 8 reps must not
 * turn two successful 5-rep sessions into failures (and lower the training max). `currentReps` is
 * only the fallback for a session that ran no rep-based rule.
 */
const sessionGotEveryRep = (session: HistorySession, currentReps: number) => {
  const reps = session.rule && 'reps' in session.rule ? session.rule.reps : currentReps;
  return (
    session.allPrescribedSetsPerformed &&
    session.sets.length > 0 &&
    session.sets.every((set) => set.reps >= reps)
  );
};

const linearDetail = (rule: LinearProgressionRule) => ({
  kind: 'linear' as const,
  reps: rule.reps,
  failuresBeforeDeload: rule.failuresBeforeDeload,
  deloadPercent: rule.deloadPercent,
});

/**
 * Linear progression. Misses are counted only at the load of the last session: after a deload the
 * count starts again, instead of the misses that caused it triggering another one straight away.
 */
function linearTargets(
  rule: LinearProgressionRule & ResetMarker,
  planned: readonly PlannedRuleSet[],
  history: readonly HistorySession[],
  step: RuleLoadStep
): SetTarget[] {
  const lastLoad = history[0].sets[0].weightKg;
  const detail = linearDetail(rule);

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
      const sessionResetAt = session.rule?.resetAt;
      const otherResetAt = sessionResetAt !== rule.resetAt;
      if (
        (rule.resetAt != null && otherResetAt) ||
        (session.rule && (session.rule.type !== rule.type || otherResetAt))
      ) {
        break;
      }

      if (!sameLoad(session.sets[0].weightKg, lastLoad) || sessionGotEveryRep(session, rule.reps)) {
        break;
      }

      failures++;
    }

    // The rule's own percentage, snapped DOWN to a load that is really lighter: rounding to the
    // nearest load could land back on the load being failed and hold the lifter there forever.
    const deloaded = loadBelow(lastLoad, lastLoad * (1 - rule.deloadPercent / 100), step);
    target =
      failures >= rule.failuresBeforeDeload && deloaded < lastLoad
        ? {
            weightKg: deloaded,
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
 * The top set + back-off targets when there is no top set to follow from: the plan's first set
 * stands as the top set, and every later one is loaded at `backoffPercent` of it.
 */
function topSetBackoffWithoutHistory(
  rule: TopSetBackoffRule,
  planned: readonly PlannedRuleSet[],
  step: RuleLoadStep
): SetTarget[] {
  return planned.map((set, index) =>
    index === 0
      ? {
          weightKg: set.weight,
          reps: rule.repMin,
          cause: 'repeat',
          rule: { kind: 'range', outcome: 'hold', repMin: rule.repMin, repMax: rule.repMax },
        }
      : {
          weightKg: step.roundLoad((planned[0].weight * rule.backoffPercent) / 100),
          reps: rule.backoffReps,
          cause: 'repeat',
          rule: { kind: 'backoff', topSetKg: planned[0].weight, percent: rule.backoffPercent },
        }
  );
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
  const lastTop = counterpartAt(last.sets, 0);
  if (!lastTop) {
    return topSetBackoffWithoutHistory(rule, planned, step);
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
  const lastBackoffLoad = counterpartAt(last.sets, 1)?.weightKg ?? backoffLoad;
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
 * carried one (up a step if it got every rep; cut by `resetPercent` once `failuresBeforeReset`
 * sessions in a row missed reps at it; otherwise held); the rule names one; or it is estimated from
 * the last session's best set.
 *
 * Re-estimating every session instead would ratchet the loads down: a set at 72% of a 1RM for 3
 * reps implies a lower 1RM than the lifter has, unless every set was rated for reps in reserve.
 * That is why a stall cuts the carried number by a fixed share rather than re-estimating it.
 */
export function resolveTrainingMax(
  rule: PercentageRule & ResetMarker,
  history: readonly HistorySession[],
  step: RuleLoadStep
): {
  trainingMaxKg: number;
  source: 'raised' | 'held' | 'lowered' | 'set' | 'estimated';
  failures?: number;
} | null {
  const carried = history[0]?.rule?.type === 'percentage' ? history[0] : undefined;
  const carriedRule = carried?.rule as PercentageRule | undefined;
  const startChanged =
    carriedRule != null &&
    (carriedRule.trainingMaxKg !== rule.trainingMaxKg || carried?.rule?.resetAt !== rule.resetAt);

  if (carried?.state && !startChanged) {
    const carriedMax = carried.state.trainingMaxKg;
    if (sessionGotEveryRep(carried, rule.reps)) {
      return { trainingMaxKg: carriedMax + step.incrementKg, source: 'raised' };
    }

    const failures = consecutiveMissesAtTrainingMax(rule, history, carriedMax);
    if (failures >= rule.failuresBeforeReset) {
      return {
        trainingMaxKg: carriedMax * (1 - rule.resetPercent / 100),
        source: 'lowered',
        failures,
      };
    }

    return { trainingMaxKg: carriedMax, source: 'held' };
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

/**
 * Sessions in a row, most recent first, that ran this same rule (same start, same reset) at
 * `trainingMaxKg` and missed reps. A session at another training max ends the streak, so after a
 * reset the misses that caused it cannot trigger another one straight away.
 */
function consecutiveMissesAtTrainingMax(
  rule: PercentageRule & ResetMarker,
  history: readonly HistorySession[],
  trainingMaxKg: number
): number {
  let failures = 0;
  for (const session of history) {
    const sessionRule = session.rule;
    if (
      sessionRule?.type !== 'percentage' ||
      sessionRule.trainingMaxKg !== rule.trainingMaxKg ||
      sessionRule.resetAt !== rule.resetAt ||
      !session.state ||
      !sameLoad(session.state.trainingMaxKg, trainingMaxKg) ||
      sessionGotEveryRep(session, rule.reps)
    ) {
      break;
    }

    failures++;
  }

  return failures;
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

  const exactKg = (trainingMax.trainingMaxKg * rule.percentOfTrainingMax) / 100;
  const previousLoad = history[0]?.sets[0].weightKg;
  // A lowered training max must lower the load: rounding to the nearest load could land back on
  // the one the lifter kept missing.
  const weightKg =
    trainingMax.source === 'lowered' && previousLoad != null
      ? loadBelow(previousLoad, exactKg, step)
      : step.roundLoad(exactKg);
  const target: SetTarget = {
    weightKg,
    reps: rule.reps,
    cause: causeFromLoad(weightKg, previousLoad ?? weightKg),
    rule: {
      kind: 'percentage',
      trainingMaxKg: trainingMax.trainingMaxKg,
      percent: rule.percentOfTrainingMax,
      raised: trainingMax.source === 'raised',
      ...(trainingMax.source === 'lowered'
        ? { lowered: { failures: trainingMax.failures ?? 0, resetPercent: rule.resetPercent } }
        : {}),
    },
  };

  return {
    targets: planned.map(() => target),
    state: { trainingMaxKg: trainingMax.trainingMaxKg },
  };
}

/** What a rule prescribes for an exercise with no history: the plan, held, in the rule's terms. */
function targetsWithoutHistory(
  rule: Exclude<ProgressionRule, PercentageRule>,
  planned: readonly PlannedRuleSet[],
  step: RuleLoadStep
): SetTarget[] {
  switch (rule.type) {
    case 'top_set_backoff':
      return topSetBackoffWithoutHistory(rule, planned, step);
    case 'linear':
      return planned.map((set) => ({
        weightKg: set.weight,
        reps: rule.reps,
        cause: 'repeat',
        rule: { ...linearDetail(rule), outcome: 'hold', failures: 0 },
      }));
    case 'double_progression':
      return planned.map((set) => ({
        weightKg: set.weight,
        reps: rule.repMin,
        cause: 'repeat',
        rule: { kind: 'range', repMin: rule.repMin, repMax: rule.repMax, outcome: 'hold' },
      }));
  }
}

function ruleTargets(
  rule: ProgressionRule,
  planned: readonly PlannedRuleSet[],
  history: readonly HistorySession[],
  step: RuleLoadStep
): { targets: SetTarget[]; state: ProgressionSessionState | null } {
  if (rule.type === 'percentage') {
    return percentageTargets(rule, planned, history, step);
  }

  if (history.length === 0) {
    return { targets: targetsWithoutHistory(rule, planned, step), state: null };
  }

  const [last, before] = history;
  switch (rule.type) {
    case 'double_progression':
      return { targets: doubleProgressionTargets(rule, planned, last, before, step), state: null };
    case 'linear':
      return { targets: linearTargets(rule, planned, history, step), state: null };
    case 'top_set_backoff':
      return { targets: topSetBackoffTargets(rule, planned, last, before, step), state: null };
  }
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

  const { targets, state } = ruleTargets(rule, planned, history, step);

  const lastSets = history[0]?.sets ?? [];
  const changes: StartSetChange[] = [];
  targets.forEach((target, index) => {
    const set = planned[index];
    const weightChanged = !sameLoad(set.weight, target.weightKg);
    if (!weightChanged && set.reps === target.reps) {
      return;
    }

    const field = weightChanged ? 'weight' : 'reps';
    const counterpart = counterpartAt(lastSets, index);
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
