/**
 * The training half of a Weekly Review: what the user decided for next week, and the frozen
 * evidence it was decided on. Pure (no database, no React) so the Jest `node` project can pin it.
 */

export const TRAINING_DECISIONS = ['progress', 'repeat', 'lighter'] as const;
export type TrainingDecision = (typeof TRAINING_DECISIONS)[number];

/** How the consistency goal (workouts per week) went in the reviewed week. */
export type ConsistencyStatus = 'met' | 'missed' | 'exceeded';

/** Where a 1RM goal stands against its target date. */
export const ONE_RM_STATUSES = [
  'reached',
  'onPace',
  'behind',
  'stalling',
  'declining',
  'notEnoughData',
] as const;
export type OneRmStatus = (typeof ONE_RM_STATUSES)[number];

export type GoalVerdict =
  | {
      kind: 'consistency';
      goalId: string;
      target: number;
      done: number;
      status: ConsistencyStatus;
    }
  | {
      kind: '1rm';
      goalId: string;
      exerciseId: string;
      exerciseName: string;
      status: OneRmStatus;
      /** Projected completion, local ms; null when the lift is not progressing or has no history. */
      projectedDate: number | null;
    };

/** Why a decision was recommended. Codes, not sentences: the UI owns the wording. */
export const TRAINING_REASON_CODES = [
  'noWorkouts',
  'missedConsistency',
  'repeatedDeloads',
  'lowReserveStalled',
  'dueForLighter',
  'onTrack',
  /** A comeback check-in answered the training half; older builds drop this reason and keep the decision. */
  'comeback',
] as const;
export type TrainingReasonCode = (typeof TRAINING_REASON_CODES)[number];
export type TrainingReason = { code: TrainingReasonCode; count?: number };

export type TrainingDecisionSnapshot = {
  decision: TrainingDecision;
  recommended: TrainingDecision;
  reasons: TrainingReason[];
  goals: GoalVerdict[];
  /** The span the decision shapes, local ms: from the moment it was made until `until`. */
  window: { from: number; until: number };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isDecision = (value: unknown): value is TrainingDecision =>
  typeof value === 'string' && (TRAINING_DECISIONS as readonly string[]).includes(value);

function parseVerdict(value: unknown): GoalVerdict | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const v = value as Record<string, unknown>;
  if (typeof v.goalId !== 'string') {
    return null;
  }

  if (
    v.kind === 'consistency' &&
    isFiniteNumber(v.target) &&
    isFiniteNumber(v.done) &&
    (v.status === 'met' || v.status === 'missed' || v.status === 'exceeded')
  ) {
    return {
      kind: 'consistency',
      goalId: v.goalId,
      target: v.target,
      done: v.done,
      status: v.status,
    };
  }

  if (
    v.kind === '1rm' &&
    typeof v.exerciseId === 'string' &&
    typeof v.exerciseName === 'string' &&
    (ONE_RM_STATUSES as readonly unknown[]).includes(v.status) &&
    (v.projectedDate === null || isFiniteNumber(v.projectedDate))
  ) {
    return {
      kind: '1rm',
      goalId: v.goalId,
      exerciseId: v.exerciseId,
      exerciseName: v.exerciseName,
      status: v.status as OneRmStatus,
      projectedDate: v.projectedDate as number | null,
    };
  }

  return null;
}

function parseReason(value: unknown): TrainingReason | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const v = value as Record<string, unknown>;
  if (!(TRAINING_REASON_CODES as readonly unknown[]).includes(v.code)) {
    return null;
  }

  return {
    code: v.code as TrainingReasonCode,
    ...(isFiniteNumber(v.count) ? { count: v.count } : {}),
  };
}

/**
 * Reads a stored snapshot. Anything malformed is `null` — a decision that cannot be trusted must
 * never change anyone's workouts, so there is no best-effort repair. Individual goal verdicts or
 * reasons that fail to parse are dropped (they only explain), the decision and window are not.
 */
export function parseTrainingDecisionSnapshot(
  raw?: string | null
): TrainingDecisionSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const window = value.window as Record<string, unknown> | undefined;
    if (
      !value ||
      !isDecision(value.decision) ||
      !isDecision(value.recommended) ||
      !window ||
      !isFiniteNumber(window.from) ||
      !isFiniteNumber(window.until) ||
      window.until <= window.from
    ) {
      return null;
    }

    return {
      decision: value.decision,
      recommended: value.recommended,
      reasons: (Array.isArray(value.reasons) ? value.reasons : [])
        .map(parseReason)
        .filter((reason): reason is TrainingReason => reason !== null),
      goals: (Array.isArray(value.goals) ? value.goals : [])
        .map(parseVerdict)
        .filter((goal): goal is GoalVerdict => goal !== null),
      window: { from: window.from, until: window.until },
    };
  } catch {
    return null;
  }
}

export const serializeTrainingDecisionSnapshot = (snapshot: TrainingDecisionSnapshot): string =>
  JSON.stringify(snapshot);

/** Whether a decision is live at `at`: it changes workouts only between its window's ends. */
export const isDecisionLive = (snapshot: TrainingDecisionSnapshot, at: number): boolean =>
  at >= snapshot.window.from && at < snapshot.window.until;
