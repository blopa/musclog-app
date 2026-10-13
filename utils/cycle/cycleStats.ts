import {
  DEFAULT_PERIOD_DURATION,
  HIGHLY_VARIABLE_SPREAD_DAYS,
  MAX_CYCLES_FOR_STATS,
  MIN_CYCLES_HIGH_CONFIDENCE,
  MIN_CYCLES_MODERATE_CONFIDENCE,
  REGULAR_SPREAD_MAX_DAYS,
} from '@/constants/cycle';

import { median } from './cycleHistory';
import type { CycleHistoryEntry, CycleVariability, PredictionConfidence } from './types';

export const DEFAULT_CYCLE_LENGTH = 28;

export interface PredictionStats {
  usableCount: number;
  periodCount: number;
  /** Median usable cycle length, or the configured fallback when none is usable yet. */
  medianLength: number;
  rangeLow: number;
  rangeHigh: number;
  spread: number;
  variability: CycleVariability;
  confidence: PredictionConfidence;
  avgPeriodDuration: number;
  basis: { used: number; excluded: number; from: number | null; to: number | null };
}

export interface StatsFallback {
  avgCycleLength?: number | null;
  avgPeriodDuration?: number | null;
}

const CONFIDENCE_ORDER: PredictionConfidence[] = ['none', 'low', 'moderate', 'high'];

function lower(confidence: PredictionConfidence): PredictionConfidence {
  return CONFIDENCE_ORDER[Math.max(1, CONFIDENCE_ORDER.indexOf(confidence) - 1)];
}

/**
 * Prediction inputs from a cycle history. Confidence depends on how many cycles were actually
 * usable AND how much they vary, not on how many periods were logged: four starts 70 days apart
 * are four logs but a poor basis for a date.
 */
export function computePredictionStats(
  history: CycleHistoryEntry[],
  fallback: StatsFallback = {}
): PredictionStats {
  const periodCount = history.length;
  const fallbackLength = fallback.avgCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const fallbackDuration = fallback.avgPeriodDuration ?? DEFAULT_PERIOD_DURATION;

  const used = history.filter((e) => e.status === 'used').slice(-MAX_CYCLES_FOR_STATS);
  const lengths = used.map((e) => e.lengthDays!);
  const excluded = history.filter((e) => e.status === 'excluded').length;

  const durations = history
    .filter((e) => e.durationKnown && e.durationDays != null)
    .map((e) => e.durationDays!)
    .filter((d) => d >= 1 && d <= 14);

  const avgPeriodDuration =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : fallbackDuration;

  const medianLength = lengths.length > 0 ? Math.round(median(lengths)) : fallbackLength;
  const rangeLow = lengths.length > 0 ? Math.min(...lengths) : medianLength;
  const rangeHigh = lengths.length > 0 ? Math.max(...lengths) : medianLength;
  const spread = rangeHigh - rangeLow;

  let variability: CycleVariability = 'regular';
  if (spread > HIGHLY_VARIABLE_SPREAD_DAYS) {
    variability = 'highly_variable';
  } else if (spread > REGULAR_SPREAD_MAX_DAYS) {
    variability = 'variable';
  }

  let confidence: PredictionConfidence;
  if (periodCount === 0) {
    confidence = 'none';
  } else if (lengths.length < MIN_CYCLES_MODERATE_CONFIDENCE) {
    confidence = 'low';
  } else if (lengths.length < MIN_CYCLES_HIGH_CONFIDENCE) {
    confidence = 'moderate';
  } else {
    confidence = 'high';
  }

  if (variability === 'highly_variable') {
    confidence = 'low';
  } else if (variability === 'variable') {
    confidence = lower(confidence);
  }

  return {
    usableCount: lengths.length,
    periodCount,
    medianLength,
    rangeLow,
    rangeHigh,
    spread,
    variability,
    confidence,
    avgPeriodDuration,
    basis: {
      used: used.length,
      excluded,
      from: used.length > 0 ? used[0].start : null,
      to: used.length > 0 ? used[used.length - 1].nextStart! : null,
    },
  };
}
