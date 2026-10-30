import {
  DEFAULT_PERIOD_DURATION,
  HIGHLY_VARIABLE_SPREAD_DAYS,
  MAX_CYCLES_FOR_STATS,
  MIN_CYCLES_HIGH_CONFIDENCE,
  MIN_CYCLES_MEDIUM_WINDOW_MARGIN,
  MIN_CYCLES_MODERATE_CONFIDENCE,
  MIN_CYCLES_SMALL_WINDOW_MARGIN,
  MIN_CYCLES_TO_DISCOUNT_OUTLIER,
  RECENT_CYCLE_HALF_LIFE,
  REGULAR_SPREAD_MAX_DAYS,
} from '@/constants/cycle';

import { median } from './cycleHistory';
import type { CycleHistoryEntry, CycleVariability, PredictionConfidence } from './types';

export const DEFAULT_CYCLE_LENGTH = 28;

export interface PredictionWindow {
  /** Days before `predictedLength` the window opens (zero or negative). */
  earlyDays: number;
  /** Days after `predictedLength` the window closes (zero or positive). */
  lateDays: number;
}

export interface PredictionStats {
  usableCount: number;
  periodCount: number;
  /** Plain median usable cycle length, or the configured fallback when none is usable yet. */
  medianLength: number;
  /**
   * The cycle length the prediction is centred on: a median that weights recent cycles more, so
   * a lasting change is followed within a few cycles. Equals `medianLength` while cycles are steady.
   */
  predictedLength: number;
  /** Shortest and longest usable cycle. Shown to the user as facts, so never trimmed. */
  rangeLow: number;
  rangeHigh: number;
  /** Shortest-to-longest spread behind `variability`, without one outlier (see constants). */
  spread: number;
  variability: CycleVariability;
  confidence: PredictionConfidence;
  window: PredictionWindow;
  fallbackKnown?: boolean;
  avgPeriodDuration: number;
  basis: { used: number; excluded: number; from: number | null; to: number | null };
}

export interface StatsFallback {
  avgCycleLength?: number | null;
  cycleLengthKnown?: boolean;
  avgPeriodDuration?: number | null;
}

const CONFIDENCE_ORDER: PredictionConfidence[] = ['none', 'low', 'moderate', 'high'];

function lower(confidence: PredictionConfidence): PredictionConfidence {
  return CONFIDENCE_ORDER[Math.max(1, CONFIDENCE_ORDER.indexOf(confidence) - 1)];
}

/**
 * Median where each value counts by its weight. With equal weights it is exactly `median`,
 * including the average of the two middle values for an even count.
 */
export function weightedMedian(values: number[], weights: number[]): number {
  const pairs = values.map((value, i) => ({ value, weight: weights[i] }));
  pairs.sort((a, b) => a.value - b.value);
  const half = pairs.reduce((sum, p) => sum + p.weight, 0) / 2;

  let cumulative = 0;
  for (let i = 0; i < pairs.length; i++) {
    cumulative += pairs[i].weight;
    if (Math.abs(cumulative - half) < 1e-9 && i + 1 < pairs.length) {
      return (pairs[i].value + pairs[i + 1].value) / 2;
    }

    if (cumulative > half) {
      return pairs[i].value;
    }
  }

  return pairs[pairs.length - 1].value;
}

/** Recency-weighted median of cycle lengths, oldest first; the newest cycle has weight 1. */
export function recentWeightedLength(lengths: number[]): number {
  const weights = lengths.map((_, i) => 0.5 ** ((lengths.length - 1 - i) / RECENT_CYCLE_HALF_LIFE));

  return weightedMedian(lengths, weights);
}

/** Shortest-to-longest spread, leaving out the cycle farthest from the median once there are enough. */
function robustSpread(lengths: number[]): number {
  if (lengths.length === 0) {
    return 0;
  }

  let kept = lengths;
  if (lengths.length >= MIN_CYCLES_TO_DISCOUNT_OUTLIER) {
    const mid = median(lengths);
    const outlier = lengths.reduce(
      (worst, length, i) => (Math.abs(length - mid) > Math.abs(lengths[worst] - mid) ? i : worst),
      0
    );
    kept = lengths.filter((_, i) => i !== outlier);
  }

  return Math.max(...kept) - Math.min(...kept);
}

/**
 * The window around the predicted start: the shortest and longest recent cycles, widened by a
 * margin while there are few of them. The benchmark in `__tests__/predictionBenchmark.test.ts`
 * compared it with a window learned from the person's own past prediction errors (no narrower at
 * the same hit rate) and with one that leaves out an outlier (about 10% more starts missed).
 * This is not a probability interval.
 */
function predictionWindow(
  predictedLength: number,
  rangeLow: number,
  rangeHigh: number,
  usableCount: number
): PredictionWindow {
  let padding = 1;
  if (usableCount < MIN_CYCLES_MEDIUM_WINDOW_MARGIN) {
    padding = 7;
  } else if (usableCount < MIN_CYCLES_SMALL_WINDOW_MARGIN) {
    padding = 3;
  }

  return {
    earlyDays: Math.min(rangeLow - predictedLength, -padding),
    lateDays: Math.max(rangeHigh - predictedLength, padding),
  };
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
  const predictedLength =
    lengths.length > 0 ? Math.round(recentWeightedLength(lengths)) : fallbackLength;
  const rangeLow = lengths.length > 0 ? Math.min(...lengths) : medianLength;
  const rangeHigh = lengths.length > 0 ? Math.max(...lengths) : medianLength;
  const spread = robustSpread(lengths);

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
    predictedLength,
    rangeLow,
    rangeHigh,
    spread,
    variability,
    confidence,
    window: predictionWindow(predictedLength, rangeLow, rangeHigh, lengths.length),
    fallbackKnown: fallback.cycleLengthKnown !== false,
    avgPeriodDuration,
    basis: {
      used: used.length,
      excluded,
      from: used.length > 0 ? used[0].start : null,
      to: used.length > 0 ? used[used.length - 1].nextStart! : null,
    },
  };
}
