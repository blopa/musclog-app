import { addDays, format } from 'date-fns';

import { weekShiftAfterCheckpoint } from '@/utils/comeback/comebackProgram';
import {
  type ComebackAnswers,
  type ComebackCheckpointWeek,
  type ComebackFeel,
  type ComebackState,
  type ComebackTrack,
  DEFAULT_COMEBACK_STATE,
} from '@/utils/comeback/comebackState';

/**
 * Every way comeback mode's state moves, as a pure function of the state before it. The service
 * runs them inside its serialised read-merge-write, so a tap can never lose a concurrent one.
 */

const MAX_MINIMUM_DAYS = 120;

/** The `yyyy-MM-dd` key a local day is stored under in `minimumDays`. */
export const minimumDayKey = (day: number): string => format(new Date(day), 'yyyy-MM-dd');

export type StartInput = {
  track: ComebackTrack;
  answers: ComebackAnswers;
  /** Local-midnight ms of day 1. */
  today: number;
};

/**
 * A comeback begins. `baseBefore` — the cutoff for the pre-break baseline — is set once, here, and
 * kept when a running comeback is started again; a new comeback after an ended one takes a fresh
 * cutoff, since the earlier comeback's eased sessions are by then ordinary history.
 */
export function startedState(current: ComebackState, input: StartInput): ComebackState {
  const running = current.status === 'active' && current.baseBefore !== null;

  return {
    ...current,
    status: 'active',
    track: input.track,
    startedAt: input.today,
    baseBefore: running ? current.baseBefore : input.today,
    endedAt: null,
    weekShift: 0,
    answers: input.answers,
    checkpoints: [],
    offerDismissal: null,
    deficitDecision: null,
  };
}

/** "Restart week 1": day 1 is today again; the baseline cutoff stays where it was. */
export function restartedState(current: ComebackState, today: number): ComebackState {
  return {
    ...current,
    status: 'active',
    startedAt: today,
    endedAt: null,
    weekShift: 0,
    checkpoints: [],
  };
}

/** The person ends it early, or acknowledges that the ramp is over. History stays. */
export function endedState(current: ComebackState, now: number): ComebackState {
  return { ...current, status: 'ended', endedAt: now };
}

/** Edited answers (and track) on a running comeback; nothing about its dates moves. */
export function answersUpdatedState(
  current: ComebackState,
  patch: { track?: ComebackTrack; answers: ComebackAnswers }
): ComebackState {
  return {
    ...current,
    track: patch.track ?? current.track,
    answers: { ...current.answers, ...patch.answers },
  };
}

/** "Not now" on the offer, remembered for this gap. */
export function dismissedState(
  current: ComebackState,
  now: number,
  lastActivityAt: number
): ComebackState {
  return { ...current, offerDismissal: { at: now, lastActivityAt } };
}

/** "I did my minimum today": idempotent, sorted, and capped so the list cannot grow without bound. */
export function minimumDayLoggedState(current: ComebackState, day: number): ComebackState {
  const key = minimumDayKey(day);
  if (current.minimumDays.includes(key)) {
    return current;
  }

  return {
    ...current,
    minimumDays: [...current.minimumDays, key].sort().slice(-MAX_MINIMUM_DAYS),
  };
}

export function minimumDayUndoneState(current: ComebackState, day: number): ComebackState {
  const key = minimumDayKey(day);

  return current.minimumDays.includes(key)
    ? { ...current, minimumDays: current.minimumDays.filter((entry) => entry !== key) }
    : current;
}

/**
 * A check-in answered. Weeks 2 and 4 are the ramp's: "too hard" holds the ramp back a week. Weeks 8
 * and 12 are reflections after graduation and only record how it felt.
 */
export function checkpointAnsweredState(
  current: ComebackState,
  week: ComebackCheckpointWeek,
  feel: ComebackFeel,
  now: number
): ComebackState {
  const others = current.checkpoints.filter((checkpoint) => checkpoint.week !== week);

  return {
    ...current,
    weekShift: weekShiftAfterCheckpoint(current.weekShift, feel, week),
    checkpoints: [...others, { week, at: now, feel }].sort((a, b) => a.week - b.week),
  };
}

/** The week-2 offer of a small deficit was answered. */
export function deficitDecidedState(
  current: ComebackState,
  decision: 'accepted' | 'declined'
): ComebackState {
  return { ...current, deficitDecision: decision };
}

/** A fresh, empty state; used when the person wipes comeback mode entirely. */
export function clearedState(): ComebackState {
  return parseDefault();
}

function parseDefault(): ComebackState {
  return {
    ...DEFAULT_COMEBACK_STATE,
    answers: {},
    checkpoints: [],
    minimumDays: [],
  };
}

/** Day 1 of the week after the ramp ends, for display ("graduates on …"). */
export function rampEndsAt(state: ComebackState, rampWeeks: number): number | null {
  return state.startedAt === null
    ? null
    : addDays(new Date(state.startedAt), (rampWeeks + state.weekShift) * 7).getTime();
}
