import { differenceInCalendarDays } from 'date-fns';

import type { MoodPoint } from './cycleInsights';
import { addCalendarDays } from './dates';
import type { CycleDayLogDto, CyclePeriodInput } from './types';

export type ComparisonMetric = 'bleeding' | 'pain' | 'energy' | 'mood' | `symptom:${string}`;
export type ComparisonAnchor = 'start' | 'before';
export interface ComparisonCell {
  date: number;
  day: number;
  value: number | null;
}
export interface ComparisonRow {
  start: number;
  complete: boolean;
  cells: ComparisonCell[];
}
const FLOW = { none: 0, spotting: 1, light: 2, medium: 3, heavy: 4, very_heavy: 5 };

export function comparisonValue(
  log: CycleDayLogDto | undefined,
  mood: number | undefined,
  metric: ComparisonMetric
): number | null {
  if (metric === 'mood') {
    return mood ?? null;
  }

  if (!log) {
    return null;
  }

  if (metric === 'bleeding') {
    return log.bleeding == null ? null : FLOW[log.bleeding];
  }

  if (metric === 'pain') {
    return log.pain;
  }

  if (metric === 'energy') {
    return log.energy;
  }

  const symptom = log.symptoms.find((s) => s.key === metric.slice(8));
  // Unrated historic symptoms still count as present, but are not given invented severity.
  if (symptom) {
    return symptom.severity ?? -1;
  }

  return log.noSymptoms ? 0 : null;
}

/** Align by logged starts, or by days before the NEXT logged start; no estimated hormone phases. */
export function buildCycleComparison(
  periods: CyclePeriodInput[],
  logs: CycleDayLogDto[],
  moods: MoodPoint[],
  metric: ComparisonMetric,
  anchor: ComparisonAnchor,
  now: number
): ComparisonRow[] {
  const sorted = [...periods].sort((a, b) => a.startDate - b.startDate);
  const byDay = new Map(logs.map((d) => [d.date, d]));
  const byMood = new Map(moods.map((m) => [m.date, m.value]));
  return sorted
    .map((period, i) => {
      const next = sorted[i + 1]?.startDate;
      if (anchor === 'before' && next == null) {
        return null;
      }

      const total =
        next == null
          ? differenceInCalendarDays(now, period.startDate) + 1
          : differenceInCalendarDays(next, period.startDate);
      const count = anchor === 'before' ? 14 : Math.min(60, total);
      const base = anchor === 'before' ? next! : period.startDate;
      const cells = Array.from({ length: Math.max(0, count) }, (_, index) => {
        const offset = anchor === 'before' ? index - count : index;
        const date = addCalendarDays(base, offset);
        return {
          date,
          day: anchor === 'before' ? offset : offset + 1,
          value: comparisonValue(byDay.get(date), byMood.get(date), metric),
        };
      });
      return { start: period.startDate, complete: next != null, cells };
    })
    .filter((row): row is ComparisonRow => row != null)
    .slice(-6);
}
