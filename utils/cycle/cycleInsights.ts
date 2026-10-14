import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { median } from './cycleHistory';
import type { CycleDayLogDto, CycleHistoryEntry, CyclePeriodInput } from './types';

/** An insight needs at least this many cycles to compare. Fewer is an anecdote, not a pattern. */
export const MIN_INSIGHT_CYCLES = 3;
/** Only the most recent cycles are examined, so an old pattern does not outlive the person. */
export const MAX_INSIGHT_CYCLES = 6;
/** "Near the start of a period" means this many days either side of a logged start. */
export const NEAR_START_DAYS = 2;
const MIN_HIT_SHARE = 0.6;
const HIGH_PAIN = 6;

export type InsightKind =
  | 'recurring_preperiod_symptom'
  | 'recurring_symptom'
  | 'high_pain'
  | 'cycle_length'
  | 'bleeding_duration'
  | 'mood_near_start'
  | 'workout_near_start'
  | 'energy_near_start'
  | 'sleep_near_start';

export interface InsightEvidence {
  /** Local-midnight starts of the cycles the observation rests on. */
  cycleStarts: number[];
  /** The individual days that were logged, for "view the data". */
  days: number[];
  workoutIds: string[];
}

export interface Insight {
  kind: InsightKind;
  /** Stable per observation, so a dismissal or a list key can refer to it. */
  id: string;
  /** Interpolation values; `symptom` is a symptom key the UI translates. */
  params: Record<string, string | number>;
  evidence: InsightEvidence;
}

export interface MoodPoint {
  date: number;
  value: number;
}

export interface WorkoutPoint {
  id: string;
  date: number;
  volume: number;
  /**
   * Which workout this was (template id, else its name). Sessions are only compared with the
   * same workout: a leg day near a period start against an arm day otherwise is not a finding.
   */
  workoutKey: string;
}

/**
 * Workouts need more cycles than the other observations: session volume is noisier than a
 * symptom tick, and with three of five cycles a 15% dip appears by chance alone about half the
 * time when each comparison is a coin flip.
 */
export const MIN_WORKOUT_INSIGHT_CYCLES = 4;
/** A comparable workout needs this many sessions away from any period start as its baseline. */
const MIN_BASELINE_SESSIONS = 2;

export interface InsightInput {
  periods: CyclePeriodInput[];
  history: CycleHistoryEntry[];
  dayLogs: (Pick<CycleDayLogDto, 'date' | 'symptoms' | 'pain' | 'noSymptoms'> &
    Partial<Pick<CycleDayLogDto, 'energy' | 'observations'>>)[];
  moods?: MoodPoint[];
  workouts?: WorkoutPoint[];
}

const dayDiff = (from: number, to: number) => Math.round((to - from) / MS_PER_SOLAR_DAY);

function recentStarts(periods: CyclePeriodInput[]): number[] {
  return periods
    .map((p) => p.startDate)
    .sort((a, b) => a - b)
    .slice(-MAX_INSIGHT_CYCLES);
}

const nearStart = (start: number, day: number) => Math.abs(dayDiff(start, day)) <= NEAR_START_DAYS;

function sharePasses(hits: number, total: number): boolean {
  return total >= MIN_INSIGHT_CYCLES && hits >= MIN_INSIGHT_CYCLES && hits / total >= MIN_HIT_SHARE;
}

function symptomInsights(input: InsightInput, starts: number[], before = false): Insight[] {
  const matches = (start: number, day: number) =>
    before ? dayDiff(start, day) >= -7 && dayDiff(start, day) <= -1 : nearStart(start, day);
  const out: Insight[] = [];

  // A cycle only counts when something was logged around its start; otherwise "no cramps" and
  // "never opened the app" would look the same.
  const logged = starts.filter((s) =>
    input.dayLogs.some((l) => matches(s, l.date) && (l.noSymptoms || l.symptoms.length > 0))
  );
  if (logged.length < MIN_INSIGHT_CYCLES) {
    return out;
  }

  const keys = new Set(input.dayLogs.flatMap((l) => l.symptoms.map((s) => s.key)));
  for (const key of keys) {
    const days: number[] = [];
    const hitStarts = logged.filter((s) => {
      const hits = input.dayLogs.filter(
        (l) => matches(s, l.date) && l.symptoms.some((x) => x.key === key)
      );
      days.push(...hits.map((h) => h.date));

      return hits.length > 0;
    });

    if (sharePasses(hitStarts.length, logged.length)) {
      out.push({
        kind: before ? 'recurring_preperiod_symptom' : 'recurring_symptom',
        id: `${before ? 'before' : 'symptom'}:${key}`,
        params: {
          symptom: key,
          hits: hitStarts.length,
          total: logged.length,
          days: NEAR_START_DAYS,
        },
        evidence: { cycleStarts: hitStarts, days, workoutIds: [] },
      });
    }
  }

  return out;
}

function painInsight(input: InsightInput, starts: number[]): Insight[] {
  const logged = starts.filter((s) =>
    input.dayLogs.some((l) => l.pain != null && nearStart(s, l.date))
  );
  const days: number[] = [];
  const hitStarts = logged.filter((s) => {
    const hits = input.dayLogs.filter(
      (l) => l.pain != null && l.pain >= HIGH_PAIN && nearStart(s, l.date)
    );
    days.push(...hits.map((h) => h.date));

    return hits.length > 0;
  });

  return sharePasses(hitStarts.length, logged.length)
    ? [
        {
          kind: 'high_pain',
          id: 'pain:high',
          params: {
            hits: hitStarts.length,
            total: logged.length,
            days: NEAR_START_DAYS,
            level: HIGH_PAIN,
          },
          evidence: { cycleStarts: hitStarts, days, workoutIds: [] },
        },
      ]
    : [];
}

function cycleLengthInsight(history: CycleHistoryEntry[]): Insight[] {
  const used = history.filter((e) => e.status === 'used' && e.lengthDays != null);
  const latest = used[used.length - 1];
  const previous = used.slice(-MAX_INSIGHT_CYCLES - 1, -1);
  if (!latest || previous.length < MIN_INSIGHT_CYCLES) {
    return [];
  }

  const typical = Math.round(median(previous.map((e) => e.lengthDays!)));
  const diff = latest.lengthDays! - typical;
  if (Math.abs(diff) < 7) {
    return [];
  }

  return [
    {
      kind: 'cycle_length',
      id: `length:${latest.start}`,
      params: {
        length: latest.lengthDays!,
        typical,
        diff: Math.abs(diff),
        direction: diff > 0 ? 'longer' : 'shorter',
        count: previous.length,
      },
      evidence: { cycleStarts: [latest.start], days: [latest.start], workoutIds: [] },
    },
  ];
}

function bleedingDurationInsight(history: CycleHistoryEntry[]): Insight[] {
  const known = history.filter((e) => e.durationKnown && e.durationDays != null);
  const latest = known[known.length - 1];
  const previous = known.slice(-MAX_INSIGHT_CYCLES - 1, -1);
  if (!latest || previous.length < MIN_INSIGHT_CYCLES) {
    return [];
  }

  const typical = Math.round(median(previous.map((e) => e.durationDays!)));
  const diff = latest.durationDays! - typical;
  if (Math.abs(diff) < 2) {
    return [];
  }

  return [
    {
      kind: 'bleeding_duration',
      id: `duration:${latest.start}`,
      params: {
        duration: latest.durationDays!,
        typical,
        diff: Math.abs(diff),
        direction: diff > 0 ? 'longer' : 'shorter',
        count: previous.length,
      },
      evidence: { cycleStarts: [latest.start], days: [latest.start], workoutIds: [] },
    },
  ];
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** Cycle windows run from one logged start to the next (the last runs to `end`). */
function cycleWindows(starts: number[], end: number) {
  return starts.map((start, i) => ({ start, end: starts[i + 1] ?? end }));
}

function moodInsight(input: InsightInput, starts: number[]): Insight[] {
  const moods = input.moods ?? [];
  const end =
    Math.max(...moods.map((m) => m.date), starts[starts.length - 1] ?? 0) + MS_PER_SOLAR_DAY;
  const days: number[] = [];
  let total = 0;
  const hitStarts: number[] = [];

  for (const { start, end: windowEnd } of cycleWindows(starts, end)) {
    const inCycle = moods.filter((m) => m.date >= start && m.date < windowEnd);
    const near = inCycle.filter((m) => nearStart(start, m.date));
    const rest = inCycle.filter((m) => !nearStart(start, m.date));
    if (near.length === 0 || rest.length < 3) {
      continue;
    }

    total += 1;
    if (mean(near.map((m) => m.value)) <= mean(rest.map((m) => m.value)) - 0.5) {
      hitStarts.push(start);
      days.push(...near.map((m) => m.date));
    }
  }

  return sharePasses(hitStarts.length, total)
    ? [
        {
          kind: 'mood_near_start',
          id: 'mood:start',
          params: { hits: hitStarts.length, total, days: NEAR_START_DAYS },
          evidence: { cycleStarts: hitStarts, days, workoutIds: [] },
        },
      ]
    : [];
}

function workoutInsight(input: InsightInput, starts: number[]): Insight[] {
  const workouts = input.workouts ?? [];
  const nearAny = (date: number) => starts.some((start) => nearStart(start, date));

  // Each workout's own typical volume, from sessions away from every period start.
  const baselineByKey = new Map<string, number>();
  const awayByKey = new Map<string, number[]>();
  for (const w of workouts) {
    if (!nearAny(w.date)) {
      awayByKey.set(w.workoutKey, [...(awayByKey.get(w.workoutKey) ?? []), w.volume]);
    }
  }

  for (const [key, volumes] of awayByKey) {
    if (volumes.length >= MIN_BASELINE_SESSIONS) {
      baselineByKey.set(key, median(volumes));
    }
  }

  const days: number[] = [];
  const workoutIds: string[] = [];
  const hitStarts: number[] = [];
  let total = 0;
  for (const start of starts) {
    const near = workouts.filter(
      (w) => nearStart(start, w.date) && (baselineByKey.get(w.workoutKey) ?? 0) > 0
    );
    if (near.length === 0) {
      continue;
    }

    total += 1;
    const ratio = mean(near.map((w) => w.volume / baselineByKey.get(w.workoutKey)!));
    if (ratio <= 0.85) {
      hitStarts.push(start);
      days.push(...near.map((w) => w.date));
      workoutIds.push(...near.map((w) => w.id));
    }
  }

  return total >= MIN_WORKOUT_INSIGHT_CYCLES && sharePasses(hitStarts.length, total)
    ? [
        {
          kind: 'workout_near_start',
          id: 'workout:start',
          params: { hits: hitStarts.length, total, days: NEAR_START_DAYS },
          evidence: { cycleStarts: hitStarts, days, workoutIds },
        },
      ]
    : [];
}

/** Compares energy or sleep in the days around each start with the rest of that cycle. */
function recoveryInsight(
  input: InsightInput,
  starts: number[],
  metric: 'energy' | 'sleepHours'
): Insight[] {
  const value = (log: InsightInput['dayLogs'][number]) =>
    metric === 'energy' ? log.energy : log.observations?.sleepHours;
  const days: number[] = [];
  const hits: number[] = [];
  let total = 0;
  const end =
    Math.max(...input.dayLogs.map((d) => d.date), starts[starts.length - 1] ?? 0) +
    MS_PER_SOLAR_DAY;
  for (const window of cycleWindows(starts, end)) {
    const logs = input.dayLogs.filter(
      (d) => d.date >= window.start && d.date < window.end && value(d) != null
    );
    const near = logs.filter((d) => nearStart(window.start, d.date));
    const rest = logs.filter((d) => !nearStart(window.start, d.date));
    if (!near.length || rest.length < 3) {
      continue;
    }

    total++;
    if (
      mean(near.map((d) => value(d)!)) <=
      mean(rest.map((d) => value(d)!)) - (metric === 'energy' ? 1 : 0.5)
    ) {
      hits.push(window.start);
      // The days the observation is ABOUT, like every other insight's evidence.
      days.push(...near.map((d) => d.date));
    }
  }

  return sharePasses(hits.length, total)
    ? [
        {
          kind: metric === 'energy' ? 'energy_near_start' : 'sleep_near_start',
          id: `recovery:${metric}`,
          params: { hits: hits.length, total },
          evidence: { cycleStarts: hits, days, workoutIds: [] },
        },
      ]
    : [];
}

/**
 * Observations from the person's OWN records. Each one states how many of how many cycles it
 * rests on and carries the exact days behind it. Nothing here says a phase CAUSED anything, and
 * nothing is produced from fewer than three cycles.
 */
export function computeInsights(input: InsightInput): Insight[] {
  const starts = recentStarts(input.periods);
  if (starts.length < MIN_INSIGHT_CYCLES) {
    return [];
  }

  return [
    ...recoveryInsight(input, starts, 'energy'),
    ...recoveryInsight(input, starts, 'sleepHours'),
    ...workoutInsight(input, starts),
    ...symptomInsights(input, starts),
    ...symptomInsights(input, starts, true),
    ...painInsight(input, starts),
    ...moodInsight(input, starts),
    ...cycleLengthInsight(input.history),
    ...bleedingDurationInsight(input.history),
  ];
}
