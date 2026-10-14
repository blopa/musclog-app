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
 * session (see {@link resolveTrainingMax}): it goes up one load step after a session that got every
 * rep, and is cut by `resetPercent` after `failuresBeforeReset` sessions in a row that missed reps
 * at it (the 5/3/1 reset — without it a lifter who outgrew a training max was held there forever).
 * `trainingMaxKg` is where it starts; without one it is estimated from the last session.
 */
export type PercentageRule = {
  type: 'percentage';
  reps: number;
  percentOfTrainingMax: number;
  trainingMaxPercent: number;
  failuresBeforeReset: number;
  resetPercent: number;
  trainingMaxKg?: number;
};

/** Set when the user restarts a rule's history: sessions run under an older reset are ignored. */
export type ResetMarker = { resetAt?: number };

export type ProgressionRule = (
  DoubleProgressionRule | LinearProgressionRule | TopSetBackoffRule | PercentageRule
) &
  ResetMarker;

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
    failuresBeforeReset: { min: 1, max: PROGRESSION_HISTORY_SESSIONS, step: 1 },
    resetPercent: { min: 5, max: 20, step: 5 },
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
  percentage: {
    type: 'percentage',
    reps: 5,
    percentOfTrainingMax: 80,
    trainingMaxPercent: 90,
    failuresBeforeReset: 2,
    resetPercent: 10,
  },
} as const satisfies { [T in ProgressionRuleType]: Extract<ProgressionRule, { type: T }> };

export const defaultProgressionRule = (type: ProgressionRuleType): ProgressionRule => ({
  ...DEFAULT_PROGRESSION_RULES[type],
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const inBounds = (value: unknown, bounds: FieldBounds): value is number =>
  isFiniteNumber(value) && value >= bounds.min && value <= bounds.max;

/**
 * Fields added after rules were first stored. A rule saved before one existed carries no value for
 * it, which means "the default" — not an untrusted rule — so the parser fills it in instead of
 * dropping every rule written by an older build.
 */
const FIELDS_ADDED_LATER: Partial<Record<ProgressionRuleType, Record<string, number>>> = {
  percentage: {
    failuresBeforeReset: DEFAULT_PROGRESSION_RULES.percentage.failuresBeforeReset,
    resetPercent: DEFAULT_PROGRESSION_RULES.percentage.resetPercent,
  },
};

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

  const addedLater = FIELDS_ADDED_LATER[type as ProgressionRuleType] ?? {};
  for (const [field, fieldBounds] of Object.entries(bounds)) {
    const fieldValue = candidate[field] ?? addedLater[field];
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
