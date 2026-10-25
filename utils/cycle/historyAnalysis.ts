import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { buildCycleHistory } from './cycleHistory';
import type { MoodPoint } from './cycleInsights';
import { computePredictionStats } from './cycleStats';
import { computeCycleTimeline } from './cycleTimeline';
import type { CycleConfig, CycleDayLogDto, CycleHistoryEntry, CyclePeriodDto } from './types';

export interface TrendPoint {
  date: number;
  value: number;
  source?: 'healthkit' | 'health_connect';
}
export type TrendMetric =
  | 'pain'
  | 'energy'
  | 'mood'
  | 'sleepHours'
  | 'temperatureC'
  | 'importedTemperatureC'
  | 'impact'
  | 'bleeding'
  | `custom:${string}`;
const FLOW = { none: 0, spotting: 1, light: 2, medium: 3, heavy: 4, very_heavy: 5 };

/** Missing values are omitted, never interpolated into symptom-free days. */
export function trendPoints(
  logs: CycleDayLogDto[],
  moods: MoodPoint[],
  metric: TrendMetric
): TrendPoint[] {
  if (metric === 'importedTemperatureC') {
    return logs
      .flatMap((log) =>
        (log.observations?.health ?? [])
          .filter((o) => o.kind === 'temperatureC' && typeof o.value === 'number')
          .map((o) => ({ date: log.date, value: Number(o.value), source: o.source }))
      )
      .sort((a, b) => a.date - b.date);
  }

  if (metric === 'mood') {
    return [...moods].sort((a, b) => a.date - b.date);
  }

  return logs
    .flatMap((log) => {
      let value: unknown;
      if (metric === 'bleeding') {
        value = log.bleeding == null ? null : FLOW[log.bleeding];
      } else if (metric === 'pain' || metric === 'energy') {
        value = log[metric];
      } else if (metric.startsWith('custom:')) {
        value = log.observations?.custom?.[metric.slice(7)];
      } else {
        value = log.observations?.[metric as 'sleepHours' | 'temperatureC' | 'impact'];
      }

      return typeof value === 'number' && Number.isFinite(value) ? [{ date: log.date, value }] : [];
    })
    .sort((a, b) => a.date - b.date);
}

/** Search only local records; all tokens must match. No health text is sent to an AI service. */
export function searchCycleLogs(
  logs: CycleDayLogDto[],
  query: string,
  labels: Record<string, string> = {}
): CycleDayLogDto[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return [...logs]
    .filter((log) => {
      const text = [
        log.note,
        log.bleeding ?? '',
        ...log.symptoms.map((s) => `${s.key} ${labels[s.key] ?? ''}`),
        ...Object.values(log.observations ?? {}).flatMap((value) =>
          typeof value === 'object' ? JSON.stringify(value) : String(value)
        ),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return tokens.every((token) => text.includes(token));
    })
    .sort((a, b) => b.date - a.date);
}

export function summarizeWindow(logs: CycleDayLogDto[], from: number, to: number) {
  const days = logs.filter((d) => d.date >= from && d.date <= to);
  const rated = days.filter((d) => d.pain != null);
  const symptoms = new Map<string, { days: number; severe: number }>();
  for (const day of days) {
    for (const symptom of day.symptoms) {
      const value = symptoms.get(symptom.key) ?? { days: 0, severe: 0 };
      value.days++;
      if (symptom.severity === 3) {
        value.severe++;
      }

      symptoms.set(symptom.key, value);
    }
  }

  return {
    loggedDays: days.length,
    heavyDays: days.filter((d) => d.bleeding === 'heavy' || d.bleeding === 'very_heavy').length,
    spottingDays: days.filter((d) => d.bleeding === 'spotting').length,
    impactDays: days.filter((d) => (d.observations?.impact ?? 0) > 0).length,
    painDays: rated.length,
    maxPain: rated.length ? Math.max(...rated.map((d) => d.pain!)) : null,
    symptoms: [...symptoms]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.days - a.days),
  };
}

export interface PredictionEvaluation {
  checked: number;
  hits: number;
  meanErrorDays: number | null;
  /**
   * Average number of days the predicted window spans, inclusive. A wider window always hits more
   * often, so a hit rate means nothing without it.
   */
  meanWindowDays: number | null;
}

/** Retrospective one-step evaluation; each window uses only earlier starts. Not clinical validation. */
export function evaluatePredictions(
  periods: CyclePeriodDto[],
  history: CycleHistoryEntry[],
  config: CycleConfig
): PredictionEvaluation {
  const sorted = [...periods].sort((a, b) => a.startDate - b.startDate);
  let hits = 0;
  const errors: number[] = [];
  const widths: number[] = [];
  for (let i = 3; i < sorted.length; i++) {
    const previous = sorted.slice(0, i);
    const training = buildCycleHistory(previous, (start) => {
      const row = history.find((h) => h.start === start);
      return row?.reason === 'hormonal_context' ||
        row?.reason === 'postpartum_context' ||
        row?.reason === 'life_context'
        ? row.reason
        : null;
    });
    const target = history.find((h) => h.start === previous[previous.length - 1].startDate);
    if (target?.status === 'excluded') {
      continue;
    }

    const stats = computePredictionStats(training, {
      avgCycleLength: config.fallbackCycleLength,
      cycleLengthKnown: config.cycleLengthKnown,
    });

    if (stats.usableCount < 2) {
      continue;
    }

    const prediction = computeCycleTimeline(previous, stats, {
      today: previous[previous.length - 1].startDate,
    }).prediction;

    if (prediction.earliest == null || prediction.latest == null || prediction.mostLikely == null) {
      continue;
    }

    const actual = sorted[i].startDate;
    if (actual >= prediction.earliest && actual <= prediction.latest) {
      hits++;
    }

    errors.push(Math.abs(Math.round((actual - prediction.mostLikely) / MS_PER_SOLAR_DAY)));
    widths.push(Math.round((prediction.latest - prediction.earliest) / MS_PER_SOLAR_DAY) + 1);
  }

  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return {
    checked: errors.length,
    hits,
    meanErrorDays: mean(errors),
    meanWindowDays: mean(widths),
  };
}
