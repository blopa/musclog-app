import { differenceInCalendarDays } from 'date-fns';

import {
  type BreakLength,
  type ComebackState,
  type ComebackTrack,
} from '@/utils/comeback/comebackState';

/**
 * Detecting that someone has been away. Nothing here reads the database: the caller hands in the
 * most recent activity it found, so the rules run in the Jest `node` project.
 */

/** A gap shorter than this is a holiday or a busy fortnight, not a lapse. */
export const COMEBACK_OFFER_MIN_GAP_DAYS = 14;
/** After "Not now" for the SAME gap, the offer comes back no sooner than this. */
export const COMEBACK_OFFER_REMIND_AFTER_DAYS = 30;

/** A running comeback with no activity for this long is offered a gentle restart. */
export const COMEBACK_STALL_DAYS = 10;

export type LapseInput = {
  /** Latest completed workout (cardio included), ms; null = none. */
  lastWorkoutAt: number | null;
  /** Latest food log or flagged fasting day, ms; null = none. */
  lastFoodAt: number | null;
  /** Latest weigh-in, ms; null = none. A weigh-in alone never counts as a lapse half. */
  lastWeighInAt: number | null;
  everWorkout: boolean;
  everFood: boolean;
  now: number;
};

export type LapseResult = {
  /** Whole calendar days since the last workout; null when they never trained. */
  workoutGapDays: number | null;
  foodGapDays: number | null;
  /** Which halves have lapsed, i.e. which the offer should suggest. */
  suggestedTrack: ComebackTrack | null;
  breakLength: BreakLength;
  /** The most recent thing the person did at all; keys the dismissal. */
  lastActivityAt: number | null;
  eligible: boolean;
};

function gapDays(last: number | null, now: number): number | null {
  return last === null ? null : Math.max(0, differenceInCalendarDays(now, last));
}

export function breakLengthForDays(days: number): BreakLength {
  if (days < 30) {
    return 'under1m';
  }

  if (days < 90) {
    return '1to3m';
  }

  if (days < 180) {
    return '3to6m';
  }

  return 'over6m';
}

export function detectLapse(input: LapseInput): LapseResult {
  const workoutGapDays = input.everWorkout ? gapDays(input.lastWorkoutAt, input.now) : null;
  const foodGapDays = input.everFood ? gapDays(input.lastFoodAt, input.now) : null;

  // A half the person never used cannot have lapsed.
  const workoutLapsed = workoutGapDays !== null && workoutGapDays >= COMEBACK_OFFER_MIN_GAP_DAYS;
  const foodLapsed = foodGapDays !== null && foodGapDays >= COMEBACK_OFFER_MIN_GAP_DAYS;

  // Someone who lapsed on one half but is still active on the other is offered only the lapsed half;
  // someone who lapsed on both gets 'both'.
  let suggestedTrack: ComebackTrack | null = null;
  if (workoutLapsed && foodLapsed) {
    suggestedTrack = 'both';
  } else if (workoutLapsed) {
    suggestedTrack = 'workout';
  } else if (foodLapsed) {
    suggestedTrack = 'nutrition';
  }

  const activity = [input.lastWorkoutAt, input.lastFoodAt, input.lastWeighInAt].filter(
    (value): value is number => value !== null
  );
  const lastActivityAt = activity.length > 0 ? Math.max(...activity) : null;

  // The break length describes the half(s) being restarted, so use the longest lapsed gap.
  const lapsedGaps = [
    workoutLapsed ? workoutGapDays : null,
    foodLapsed ? foodGapDays : null,
  ].filter((value): value is number => value !== null);
  const longestGap = lapsedGaps.length > 0 ? Math.max(...lapsedGaps) : 0;

  return {
    workoutGapDays,
    foodGapDays,
    suggestedTrack,
    breakLength: breakLengthForDays(longestGap),
    lastActivityAt,
    eligible: suggestedTrack !== null,
  };
}

/**
 * Should Home offer to ease back in? Never while a comeback is running, and a declined offer stays
 * quiet for that gap — unless the person was active again since (a new gap re-arms it) or the
 * reminder interval has passed.
 */
export function shouldOfferComeback(
  state: ComebackState,
  lapse: LapseResult,
  now: number
): boolean {
  if (!lapse.eligible || state.status === 'active') {
    return false;
  }

  const dismissal = state.offerDismissal;
  if (!dismissal) {
    return true;
  }

  const activeSinceDismissal =
    lapse.lastActivityAt !== null && lapse.lastActivityAt > dismissal.lastActivityAt;
  if (activeSinceDismissal) {
    return true;
  }

  return differenceInCalendarDays(now, dismissal.at) >= COMEBACK_OFFER_REMIND_AFTER_DAYS;
}

/**
 * Has a running comeback gone quiet? Counted from the latest of: any logged activity, the comeback's
 * own first day, and the last "minimum day" — so one that has only just begun after a long break is
 * not stalled by the very gap it exists to end, and doing the minimum counts as showing up.
 */
export function isComebackStalled(
  state: ComebackState,
  lapse: LapseResult,
  today: number
): boolean {
  if (state.status !== 'active' || state.startedAt === null || state.endedAt !== null) {
    return false;
  }

  const lastMinimum =
    state.minimumDays.length > 0 ? state.minimumDays[state.minimumDays.length - 1] : null;
  const lastMinimumAt = lastMinimum ? new Date(`${lastMinimum}T00:00:00`).getTime() : 0;
  const lastShownUp = Math.max(state.startedAt, lapse.lastActivityAt ?? 0, lastMinimumAt);

  return differenceInCalendarDays(today, lastShownUp) >= COMEBACK_STALL_DAYS;
}
