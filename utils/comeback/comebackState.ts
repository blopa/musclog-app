import { TRAINING_LOCATIONS, type TrainingLocation } from '@/utils/onboardingTraining';

/**
 * The persisted shape of "comeback mode": a person returning after weeks or months away who has opted
 * in to an eased restart. Everything is plain JSON in one setting (`comeback_state`) and read field by
 * field, so a hand-edited, backed-up or newer-version value degrades to a default instead of throwing.
 *
 * Whether the person is still in the ramp is DERIVED from `startedAt`/`weekShift`/`endedAt`
 * (`comebackPhase`), never stored: a restored backup can carry an old `active` state, and a stored flag
 * would read "week 14 of 4".
 */

export const COMEBACK_STATUSES = ['none', 'active', 'ended'] as const;
export type ComebackStatus = (typeof COMEBACK_STATUSES)[number];

export const COMEBACK_TRACKS = ['workout', 'nutrition', 'both'] as const;
export type ComebackTrack = (typeof COMEBACK_TRACKS)[number];

export const BREAK_LENGTHS = ['under1m', '1to3m', '3to6m', 'over6m'] as const;
export type BreakLength = (typeof BREAK_LENGTHS)[number];

export const COMEBACK_START_CHOICES = ['ownPlan', 'shortPlan', 'chooseLater'] as const;
export type ComebackStartChoice = (typeof COMEBACK_START_CHOICES)[number];

export const COMEBACK_EATING = ['cook', 'mix', 'out', 'varies'] as const;
export type ComebackEating = (typeof COMEBACK_EATING)[number];

export const COMEBACK_TRACKING_DEPTHS = ['full', 'caloriesProtein', 'mealsOnly'] as const;
export type ComebackTrackingDepth = (typeof COMEBACK_TRACKING_DEPTHS)[number];

export const COMEBACK_NUTRITION_GOALS = ['regular', 'loseSlowly', 'rebuild', 'keep'] as const;
export type ComebackNutritionGoal = (typeof COMEBACK_NUTRITION_GOALS)[number];

export const COMEBACK_ENERGY = ['plenty', 'some', 'low'] as const;
export type ComebackEnergy = (typeof COMEBACK_ENERGY)[number];

export const COMEBACK_DEFICIT_DECISIONS = ['accepted', 'declined'] as const;
export type ComebackDeficitDecision = (typeof COMEBACK_DEFICIT_DECISIONS)[number];

export const COMEBACK_CHECKPOINT_WEEKS = [2, 4, 8, 12] as const;
export type ComebackCheckpointWeek = (typeof COMEBACK_CHECKPOINT_WEEKS)[number];

export const COMEBACK_FEELS = ['easy', 'right', 'hard'] as const;
export type ComebackFeel = (typeof COMEBACK_FEELS)[number];

export const MIN_COMEBACK_DAYS_PER_WEEK = 1;
export const MAX_COMEBACK_DAYS_PER_WEEK = 4;
/** A held week ("too hard") can push the ramp back at most this far, so it always ends. */
export const MAX_WEEK_SHIFT = 8;
const MAX_MINIMUM_DAYS = 120;

/** Every field is optional: a missing one means "not asked" or "skipped". */
export type ComebackAnswers = {
  breakLength?: BreakLength;
  location?: TrainingLocation;
  daysPerWeek?: number;
  /** Monday-first (0 = Monday … 6 = Sunday, as `WeekdayPicker` and plans store it), ascending and unique. */
  weekDays?: number[];
  /** `HH:mm`, local. */
  time?: string;
  start?: ComebackStartChoice;
  eating?: ComebackEating;
  tracking?: ComebackTrackingDepth;
  nutritionGoal?: ComebackNutritionGoal;
  energy?: ComebackEnergy;
};

export type ComebackCheckpoint = {
  week: ComebackCheckpointWeek;
  at: number;
  feel?: ComebackFeel;
};

export type ComebackState = {
  status: ComebackStatus;
  track: ComebackTrack;
  /** Local-midnight ms of day 1. "Restart week 1" resets it. */
  startedAt: number | null;
  /**
   * Cutoff for the pre-break baseline: sessions completed before it are what the ramp scales.
   * Set ONCE, when a comeback first starts, and never moved by a restart — otherwise a second attempt
   * would take the first attempt's eased sessions as its baseline and ease them again.
   */
  baseBefore: number | null;
  /** Set on graduation or when the person ends it, so the window can be rebuilt afterwards. */
  endedAt: number | null;
  /** Weeks held back by "too hard" check-ins. */
  weekShift: number;
  answers: ComebackAnswers;
  checkpoints: ComebackCheckpoint[];
  /** `yyyy-MM-dd` days the person did their minimum. */
  minimumDays: string[];
  /** Remembers which gap an "offer" was declined for, so a new gap re-arms it. */
  offerDismissal: { at: number; lastActivityAt: number } | null;
  /**
   * The calorie target setup (or an accepted deficit) wrote to the nutrition goal. A later offer to
   * take the deficit checks the goal still holds it: if a Weekly Review changed the targets since,
   * the offer stands down instead of overwriting the person's newer numbers.
   */
  appliedTargets: { totalCalories: number; at: number } | null;
  /** What the person said to the week-2 offer of a small deficit; null = not asked yet. */
  deficitDecision: ComebackDeficitDecision | null;
  /** The plan created for "a short plan for me", so starting again never creates a second one. */
  shortPlanId: string | null;
};

export const DEFAULT_COMEBACK_STATE: ComebackState = {
  status: 'none',
  track: 'both',
  startedAt: null,
  baseBefore: null,
  endedAt: null,
  weekShift: 0,
  answers: {},
  checkpoints: [],
  minimumDays: [],
  offerDismissal: null,
  appliedTargets: null,
  shortPlanId: null,
  deficitDecision: null,
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pick<T extends string>(allowed: readonly T[], value: unknown): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseAnswers(value: unknown): ComebackAnswers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const answers: ComebackAnswers = {};

  const breakLength = pick(BREAK_LENGTHS, raw['breakLength']);
  if (breakLength) {
    answers.breakLength = breakLength;
  }

  const location = pick(TRAINING_LOCATIONS, raw['location']);
  if (location) {
    answers.location = location;
  }

  const days = raw['daysPerWeek'];
  if (typeof days === 'number' && Number.isFinite(days)) {
    answers.daysPerWeek = Math.min(
      MAX_COMEBACK_DAYS_PER_WEEK,
      Math.max(MIN_COMEBACK_DAYS_PER_WEEK, Math.round(days))
    );
  }

  const weekDays = raw['weekDays'];
  if (Array.isArray(weekDays)) {
    const unique = Array.from(
      new Set(
        weekDays.filter(
          (day): day is number =>
            typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6
        )
      )
    ).sort((a, b) => a - b);
    if (unique.length > 0) {
      answers.weekDays = unique;
    }
  }

  const time = raw['time'];
  if (typeof time === 'string' && TIME_PATTERN.test(time)) {
    answers.time = time;
  }

  const start = pick(COMEBACK_START_CHOICES, raw['start']);
  if (start) {
    answers.start = start;
  }

  const eating = pick(COMEBACK_EATING, raw['eating']);
  if (eating) {
    answers.eating = eating;
  }

  const tracking = pick(COMEBACK_TRACKING_DEPTHS, raw['tracking']);
  if (tracking) {
    answers.tracking = tracking;
  }

  const nutritionGoal = pick(COMEBACK_NUTRITION_GOALS, raw['nutritionGoal']);
  if (nutritionGoal) {
    answers.nutritionGoal = nutritionGoal;
  }

  const energy = pick(COMEBACK_ENERGY, raw['energy']);
  if (energy) {
    answers.energy = energy;
  }

  return answers;
}

function parseCheckpoints(value: unknown): ComebackCheckpoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byWeek = new Map<ComebackCheckpointWeek, ComebackCheckpoint>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const raw = entry as Record<string, unknown>;
    const week = COMEBACK_CHECKPOINT_WEEKS.find((candidate) => candidate === raw['week']);
    const at = finiteOrNull(raw['at']);
    if (week === undefined || at === null) {
      continue;
    }

    const feel = pick(COMEBACK_FEELS, raw['feel']);
    byWeek.set(week, feel ? { week, at, feel } : { week, at });
  }

  return Array.from(byWeek.values()).sort((a, b) => a.week - b.week);
}

function parseMinimumDays(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const days = Array.from(
    new Set(value.filter((day): day is string => typeof day === 'string' && DAY_PATTERN.test(day)))
  ).sort();

  return days.slice(-MAX_MINIMUM_DAYS);
}

function parseAppliedTargets(value: unknown): ComebackState['appliedTargets'] {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const totalCalories = finiteOrNull(raw['totalCalories']);
  const at = finiteOrNull(raw['at']);

  return totalCalories !== null && at !== null ? { totalCalories, at } : null;
}

function parseDismissal(value: unknown): ComebackState['offerDismissal'] {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const at = finiteOrNull(raw['at']);
  const lastActivityAt = finiteOrNull(raw['lastActivityAt']);

  return at !== null && lastActivityAt !== null ? { at, lastActivityAt } : null;
}

/** Reads the stored JSON field by field; anything malformed is replaced by its default. */
export function parseComebackState(raw: string | null | undefined): ComebackState {
  if (!raw) {
    return { ...DEFAULT_COMEBACK_STATE, answers: {}, checkpoints: [], minimumDays: [] };
  }

  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return parseComebackState(null);
    }

    parsed = value as Record<string, unknown>;
  } catch {
    return parseComebackState(null);
  }

  const status = pick(COMEBACK_STATUSES, parsed['status']) ?? 'none';
  const shift = finiteOrNull(parsed['weekShift']);

  return {
    status,
    track: pick(COMEBACK_TRACKS, parsed['track']) ?? DEFAULT_COMEBACK_STATE.track,
    startedAt: finiteOrNull(parsed['startedAt']),
    baseBefore: finiteOrNull(parsed['baseBefore']),
    endedAt: finiteOrNull(parsed['endedAt']),
    weekShift: shift === null ? 0 : Math.min(MAX_WEEK_SHIFT, Math.max(0, Math.round(shift))),
    answers: parseAnswers(parsed['answers']),
    checkpoints: parseCheckpoints(parsed['checkpoints']),
    minimumDays: parseMinimumDays(parsed['minimumDays']),
    offerDismissal: parseDismissal(parsed['offerDismissal']),
    appliedTargets: parseAppliedTargets(parsed['appliedTargets']),
    deficitDecision: pick(COMEBACK_DEFICIT_DECISIONS, parsed['deficitDecision']) ?? null,
    shortPlanId:
      typeof parsed['shortPlanId'] === 'string' && parsed['shortPlanId'] !== ''
        ? parsed['shortPlanId']
        : null,
  };
}

export function serializeComebackState(state: ComebackState): string {
  return JSON.stringify(state);
}

/** True when the state's track includes the workout half. */
export function tracksWorkouts(track: ComebackTrack): boolean {
  return track !== 'nutrition';
}

/** True when the state's track includes the nutrition half. */
export function tracksNutrition(track: ComebackTrack): boolean {
  return track !== 'workout';
}
