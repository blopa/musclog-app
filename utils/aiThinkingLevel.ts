// How hard the AI thinks, as the person chose it in AI settings. Pure and relative-import-only.
//
// A level decides two things, each in one table: how much each request reasons (`utils/aiEffort.ts`
// maps a job and a level to an effort) and how many requests a job makes (`THINKING_PIPELINE`
// below: the verified meal path, review rounds, independent samples). Every caller reads the level
// through `effectiveThinkingLevel`, which is the one place a provider or a background task can
// lower it, so no feature decides that on its own.

export const THINKING_LEVELS = ['off', 'medium', 'high', 'tokenmaxxing'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'off';

/**
 * Reads the stored level. The setting keeps its historical key `use_thinking_mode`, which held a
 * boolean before the levels existed: `'true'` (the old "Use thinking mode") is `medium`, what that
 * switch did, and anything else unknown is `off`, so an old install, an old backup and a row from a
 * newer build all read safely.
 */
export function parseThinkingLevel(raw: string | null | undefined): ThinkingLevel {
  if (raw === 'true') {
    return 'medium';
  }

  return (THINKING_LEVELS as readonly string[]).includes(raw ?? '')
    ? (raw as ThinkingLevel)
    : DEFAULT_THINKING_LEVEL;
}

/** Where a level is compared with another: higher means more requests and more reasoning. */
export function thinkingLevelRank(level: ThinkingLevel): number {
  return THINKING_LEVELS.indexOf(level);
}

/** The highest level a background task (daily insights) may run at, with nobody watching it. */
export const BACKGROUND_THINKING_CEILING: ThinkingLevel = 'high';

/**
 * The providers the person can choose a level for. The Musclog free tier is not one: it runs on a
 * key every free user shares, with one daily budget, so extra requests by a few would use up the
 * quota of all; it always runs at `off`.
 */
export function providerAllowsThinking(provider: string): boolean {
  return provider !== 'gateway';
}

/**
 * The level a request actually runs at: the stored one, `off` on a provider that allows no
 * thinking, and at most `BACKGROUND_THINKING_CEILING` for a background task.
 */
export function effectiveThinkingLevel(
  stored: ThinkingLevel,
  config: { provider: string; background?: boolean }
): ThinkingLevel {
  if (!providerAllowsThinking(config.provider)) {
    return 'off';
  }

  if (
    config.background &&
    thinkingLevelRank(stored) > thinkingLevelRank(BACKGROUND_THINKING_CEILING)
  ) {
    return BACKGROUND_THINKING_CEILING;
  }

  return stored;
}

/** What a level makes a job do beyond its first request. */
export type ThinkingPipeline = {
  /**
   * A meal estimate takes the verified path: the recipe is read first, each claimed food id is
   * checked against the database, the rest is estimated, then the plausibility recheck runs.
   */
  verifiedMeal: boolean;
  /** Rounds of critique and revision after the first answer (meals, plans, insights, chat). */
  reviewRounds: number;
  /** Independent answers to one job, combined by code (a meal's median, a field's vote). */
  samples: number;
  /** A coach chat reply is drafted unseen, then reviewed, and only the review is shown. */
  chatReview: boolean;
};

export const THINKING_PIPELINE: Record<ThinkingLevel, ThinkingPipeline> = {
  off: { verifiedMeal: false, reviewRounds: 0, samples: 1, chatReview: false },
  medium: { verifiedMeal: true, reviewRounds: 0, samples: 1, chatReview: false },
  high: { verifiedMeal: true, reviewRounds: 1, samples: 1, chatReview: false },
  tokenmaxxing: { verifiedMeal: true, reviewRounds: 2, samples: 3, chatReview: true },
};

/**
 * Independent extractions of a label, a past workout or a food log. One more than the other jobs at
 * `high`, since two readings are what shows where a reading is unsure: only the fields they
 * disagree on are asked again.
 */
export function extractionSamples(level: ThinkingLevel): number {
  return level === 'high' ? 2 : THINKING_PIPELINE[level].samples;
}

export type ThinkingLevelChangeGate = 'none' | 'note' | 'noteAndAuth';

/**
 * What changing the level asks of the person first. On Musclog Iron every extra request counts
 * against the monthly allowance, so moving up to `high` explains that, and `tokenmaxxing`, which
 * spends it several times faster, also asks the device to confirm it is them. Moving down, staying
 * put and every other provider ask nothing.
 */
export function thinkingLevelChangeGate(
  from: ThinkingLevel,
  to: ThinkingLevel,
  provider: string
): ThinkingLevelChangeGate {
  if (provider !== 'hosted' || thinkingLevelRank(to) <= thinkingLevelRank(from)) {
    return 'none';
  }

  if (to === 'tokenmaxxing') {
    return 'noteAndAuth';
  }

  return to === 'high' ? 'note' : 'none';
}
