import { differenceInCalendarDays } from 'date-fns';

import {
  type BreakLength,
  COMEBACK_CHECKPOINT_WEEKS,
  type ComebackAnswers,
  type ComebackCheckpointWeek,
  type ComebackState,
  MAX_WEEK_SHIFT,
} from '@/utils/comeback/comebackState';

/**
 * The comeback ramp in one place. The research behind it gives the SHAPE — a few sets, plenty of reps in
 * reserve, add one thing at a time, never double up after a miss — but not load percentages, so the
 * numbers below are product choices (recorded in RESEARCH.md) and live only here.
 */

/** Weeks of eased training before ordinary progression takes over. */
export const COMEBACK_RAMP_WEEKS = 4;

/** Heaviest the ramp ever asks for, as a share of the pre-break load: it never reaches 100%. */
export const COMEBACK_MAX_LOAD_FACTOR = 0.95;

export type ComebackPhase = 'none' | 'ramp' | 'graduated' | 'ended';

export type WorkoutRamp = {
  /** Share of the pre-break load for this week. */
  loadFactor: number;
  /** Planned reps in reserve, which also stops between-sets re-targeting pushing the load back up. */
  targetRir: number;
  /** Working sets kept per exercise; null = the plan's own count. */
  maxWorkingSets: number | null;
  week: number;
};

/** Where the first week starts, by how long the break was. */
const BASE_LOAD_FACTOR: Record<BreakLength, number> = {
  under1m: 0.9,
  '1to3m': 0.8,
  '3to6m': 0.7,
  over6m: 0.6,
};
const DEFAULT_BREAK_LENGTH: BreakLength = '1to3m';

const RAMP_TARGET_RIR = [4, 3, 3, 2] as const;
const RAMP_LOAD_STEP = [0, 0.1, 0.2, 0.3] as const;

/** Whole weeks the calendar says have passed since day 1, 1-based (day 1 is week 1). */
export function calendarComebackWeek(startedAt: number, today: number): number {
  return Math.floor(Math.max(0, differenceInCalendarDays(today, startedAt)) / 7) + 1;
}

/** The week of the ramp the person is on, after any weeks held back. */
export function comebackWeek(state: ComebackState, today: number): number | null {
  if (state.startedAt === null) {
    return null;
  }

  return Math.max(1, calendarComebackWeek(state.startedAt, today) - state.weekShift);
}

export function comebackPhase(state: ComebackState, today: number): ComebackPhase {
  if (state.status === 'none' || state.startedAt === null) {
    return 'none';
  }

  if (state.status === 'ended' || state.endedAt !== null) {
    return 'ended';
  }

  const week = comebackWeek(state, today);

  return week !== null && week > COMEBACK_RAMP_WEEKS ? 'graduated' : 'ramp';
}

/** True while the eased ramp should shape workouts. */
export function isComebackRamp(state: ComebackState, today: number): boolean {
  return comebackPhase(state, today) === 'ramp';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** null once the ramp is over (or before it begins): ordinary progression applies. */
export function workoutRamp(answers: ComebackAnswers, week: number): WorkoutRamp | null {
  if (!Number.isInteger(week) || week < 1 || week > COMEBACK_RAMP_WEEKS) {
    return null;
  }

  const index = week - 1;
  const base = BASE_LOAD_FACTOR[answers.breakLength ?? DEFAULT_BREAK_LENGTH];
  const lowEnergy = answers.energy === 'low';

  let maxWorkingSets: number | null;
  if (week === 1) {
    maxWorkingSets = lowEnergy ? 1 : 2;
  } else if (week === 2) {
    maxWorkingSets = 2;
  } else if (week === 3) {
    maxWorkingSets = 3;
  } else {
    maxWorkingSets = null;
  }

  return {
    loadFactor: round2(Math.min(COMEBACK_MAX_LOAD_FACTOR, base + RAMP_LOAD_STEP[index])),
    targetRir: RAMP_TARGET_RIR[index],
    maxWorkingSets,
    week,
  };
}

/** The ramp for today, or null when no comeback ramp is running. */
export function currentWorkoutRamp(state: ComebackState, today: number): WorkoutRamp | null {
  if (!isComebackRamp(state, today)) {
    return null;
  }

  const week = comebackWeek(state, today);

  return week === null ? null : workoutRamp(state.answers, week);
}

/**
 * Check-in weeks the person has reached (that many full weeks have passed since day 1) and not yet
 * answered. Uses the calendar, not the held-back week: a person who held a week should still be asked.
 */
export function checkpointsDue(state: ComebackState, today: number): ComebackCheckpointWeek[] {
  if (state.status !== 'active' || state.startedAt === null || state.endedAt !== null) {
    return [];
  }

  const fullWeeks = Math.floor(Math.max(0, differenceInCalendarDays(today, state.startedAt)) / 7);
  const answered = new Set(
    state.checkpoints.filter((checkpoint) => checkpoint.feel !== undefined).map((c) => c.week)
  );

  return COMEBACK_CHECKPOINT_WEEKS.filter((week) => fullWeeks >= week && !answered.has(week));
}

/** What an answered check-in changes: only "too hard" holds the ramp back a week. */
export function weekShiftAfterCheckpoint(
  current: number,
  feel: 'easy' | 'right' | 'hard',
  week: ComebackCheckpointWeek
): number {
  // Only the ramp checkpoints can hold it; 8 and 12 are reflections after graduation.
  if (feel !== 'hard' || week > COMEBACK_RAMP_WEEKS) {
    return current;
  }

  return Math.min(MAX_WEEK_SHIFT, current + 1);
}
