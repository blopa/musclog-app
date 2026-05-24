/** THIS FILE IS DEPRECATED AND FOR DEBUGGING USE ONLY **/

import mlMax from 'ml-array-max';
import mlMin from 'ml-array-min';
import { PCA } from 'ml-pca';
import savitzkyGolay from 'ml-savitzky-golay';
import otsuThreshold from 'otsu';
import { linearRegression, linearRegressionLine, quantile as ssQuantile } from 'simple-statistics';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface MotionSample {
  timestamp: number;
  accel: Vector3;
  gyro: Vector3;
  angle: Vector3;
}

export interface RepAnalysisSummary {
  repCount: number;
  sampleCount: number;
  durationMs: number;
}

// Rep counting uses the dominant angle axis (x or y, selected by signal range).
// The signal is smoothed with EMA, then turning points with a minimum-delta
// filter detect direction reversals. Each rep is scored when three consecutive
// turning points form a full excursion.
//
// Two types of outlier turning points are removed:
//
//   Leading: if the first TP is in the opposite direction from the TP median
//   (e.g. rack exercises where the unracking spike is directionally opposite
//   to the actual working range), those leading TPs are trimmed.
//
//   Trailing: only when the median half-amplitude (medH) is representative of
//   the exercise amplitude (signalRange / (2 × medH) < 2), an Otsu threshold
//   on consecutive half-amplitudes trims the trailing TP when Otsu detects a
//   bimodal distribution (outlier re-rack amplitude vs regular exercise range).
//
// TODO: there's a lot of magic here and stuff based specifically for my weight lifting style, like REP_ACCEL_Z_DOUBLET_GAP_MS
// consider in the future to train a small model based on data from different lifters
//
// When trimming occurs the rep height threshold adapts to 2 × medH × 0.45.
// For cable/stack machines where x/y barely move, we fall back to accel.z peaks.
// A peak-cluster cross-check corrects the rare case where a re-rack or stutter
// TP creates exactly one spurious extra triplet.
const REP_ANGLE_SMOOTH_ALPHA = 0.15;
const REP_TURNING_POINT_MIN_DELTA_FRACTION = 0.15;
const REP_HEIGHT_THRESHOLD_FRACTION = 0.45;
const REP_PEAK_CLUSTER_THRESHOLD_FRACTION = 0.35;
const REP_PEAK_CLUSTER_SG_WINDOW = 11;
const REP_PEAK_CLUSTER_SG_POLYNOMIAL = 3;
const REP_CABLE_FLAT_ANGLE_RANGE_THRESHOLD_DEG = 5;
const REP_ACCEL_Z_SMOOTH_ALPHA = 0.15;
const REP_ACCEL_Z_PEAK_THRESHOLD_FRACTION = 0.3;
const REP_ACCEL_Z_LOOSE_PEAK_THRESHOLD_FRACTION = 0.2;
const REP_ACCEL_Z_MIN_PEAK_GAP_MS = 100;
// Peaks within this gap in the loose pass are doublets (noise bounce), not reps.
const REP_ACCEL_Z_DOUBLET_GAP_MS = 500;
// When signalRange / (2 × medH) is below this value, medH is considered a
// reliable proxy for the exercise half-amplitude, enabling IQR trailing trim.
const REP_MEDH_REPRESENTATIVE_RATIO = 2;

const RECONCILE_MIN_PEAK_GAP_MS = 300;
const RECONCILE_MAX_SEEK_ITERATIONS = 30;

// Original floor-based median (upper median for even-length arrays)
function floorMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function smoothEma(values: number[], alpha: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const smoothed: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }

  return smoothed;
}

// OLS linear detrend: fits the best-fit line through all points (minimises
// sum of squared residuals) rather than connecting only the two endpoints.
function detrendLinear(values: number[]): number[] {
  if (values.length < 2) {
    return values.slice();
  }

  const pairs = values.map((y, i) => [i, y] as [number, number]);
  const line = linearRegressionLine(linearRegression(pairs));
  return values.map((y, i) => y - line(i));
}

function collectTurningPoints(
  values: number[],
  timestamps: number[],
  minDelta: number
): [number, number][] {
  if (values.length < 3) {
    return [];
  }

  const turningPoints: [number, number][] = [];
  let trend = 0;
  let lastAcceptedValue = values[0];

  for (let i = 1; i < values.length - 1; i++) {
    const delta = values[i] - values[i - 1];
    const nextTrend = delta > 0 ? 1 : delta < 0 ? -1 : trend;

    if (trend !== 0 && nextTrend !== 0 && nextTrend !== trend) {
      if (Math.abs(values[i] - lastAcceptedValue) >= minDelta) {
        turningPoints.push([timestamps[i], values[i]]);
        lastAcceptedValue = values[i];
        trend = nextTrend;
      }
    } else if (nextTrend !== 0) {
      trend = nextTrend;
    }
  }

  return turningPoints;
}

function collectPeakClusterCandidate(
  values: number[],
  timestamps: number[]
): { count: number; score: number } | null {
  if (values.length < REP_PEAK_CLUSTER_SG_WINDOW) {
    return null;
  }

  const step = Math.floor(REP_PEAK_CLUSTER_SG_WINDOW / 2);
  // SG uses a symmetric centered window, so peaks are neither shifted in time
  // nor attenuated in amplitude — unlike causal EMA smoothing.
  const smoothed = savitzkyGolay(values, 1, {
    windowSize: REP_PEAK_CLUSTER_SG_WINDOW,
    polynomial: REP_PEAK_CLUSTER_SG_POLYNOMIAL,
    derivative: 0,
  });
  // SG output is shorter by `step` samples on each end; align timestamps.
  const trimmedTimestamps = timestamps.slice(step, timestamps.length - step);

  const centered = detrendLinear(smoothed);
  const signalRange = mlMax(centered) - mlMin(centered);

  if (signalRange <= 0) {
    return null;
  }

  const peakThreshold = signalRange * REP_PEAK_CLUSTER_THRESHOLD_FRACTION;
  const peaks: [number, number][] = [];

  for (let i = 1; i < centered.length - 1; i++) {
    const isPeak = centered[i] > centered[i - 1] && centered[i] >= centered[i + 1];

    if (isPeak && centered[i] > peakThreshold) {
      peaks.push([trimmedTimestamps[i], centered[i]]);
    }
  }

  if (peaks.length < 3) {
    return null;
  }

  const gaps: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    gaps.push(peaks[i][0] - peaks[i - 1][0]);
  }

  const gapThreshold = ssQuantile(gaps, 0.8);

  let bestCluster = [peaks[0]];
  let currentCluster = [peaks[0]];

  for (let i = 1; i < peaks.length; i++) {
    const gap = peaks[i][0] - peaks[i - 1][0];

    if (gap <= gapThreshold) {
      currentCluster.push(peaks[i]);
    } else {
      if (currentCluster.length > bestCluster.length) {
        bestCluster = currentCluster;
      }
      currentCluster = [peaks[i]];
    }
  }

  if (currentCluster.length > bestCluster.length) {
    bestCluster = currentCluster;
  }

  if (bestCluster.length < 3) {
    return null;
  }

  const clusterGaps: number[] = [];
  for (let i = 1; i < bestCluster.length; i++) {
    clusterGaps.push(bestCluster[i][0] - bestCluster[i - 1][0]);
  }

  const meanGap = clusterGaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, clusterGaps.length);
  const gapStdDev = Math.sqrt(
    clusterGaps.reduce((sum, gap) => sum + (gap - meanGap) * (gap - meanGap), 0) /
      Math.max(1, clusterGaps.length)
  );
  const gapCv = meanGap > 0 ? gapStdDev / meanGap : 0;
  const coverage = peaks.length > 0 ? bestCluster.length / peaks.length : 0;
  const prominence = floorMedian(bestCluster.map(([, value]) => value)) / signalRange;
  const score = (coverage * prominence) / (1 + gapCv);

  return { count: bestCluster.length, score };
}

function filterCloseTurningPoints(tps: [number, number][], minGapMs: number): [number, number][] {
  if (tps.length === 0) {
    return [];
  }

  const filtered: [number, number][] = [tps[0]];

  for (let i = 1; i < tps.length; i++) {
    const [prevTs, prevVal] = filtered[filtered.length - 1];
    const [curTs, curVal] = tps[i];

    if (curTs - prevTs < minGapMs) {
      // Keep the more extreme (larger absolute) value
      if (Math.abs(curVal) > Math.abs(prevVal)) {
        filtered[filtered.length - 1] = tps[i];
      }
    } else {
      filtered.push(tps[i]);
    }
  }

  return filtered;
}

// Removes boundary turning points that don't belong to the exercise cluster.
//
// Leading trim: strips TPs that are in the opposite direction from the
// exercise median (e.g. setup spike from unracking a barbell). Purely
// data-driven — no timing heuristics.
//
// Trailing trim: only when medH is representative (ratio < threshold) and
// Otsu detects a bimodal distribution in the half-amplitudes (regular exercise
// range vs outlier re-rack amplitude), strips the trailing TP.
function trimBoundaryTurningPoints(
  tps: [number, number][],
  tpMedian: number,
  medH: number,
  signalRange: number
): [number, number][] {
  if (tps.length < 4) {
    return tps;
  }

  // Leading trim: direction-based
  let start = 0;
  const firstOppositeToMedian = (tps[0][1] > 0 && tpMedian < 0) || (tps[0][1] < 0 && tpMedian > 0);

  if (firstOppositeToMedian) {
    while (
      tps.length - start > 3 &&
      ((tps[start][1] > 0 && tpMedian < 0) || (tps[start][1] < 0 && tpMedian > 0))
    ) {
      start++;
    }
  }

  let end = tps.length;

  // Trailing trim: IQR-based, only when medH is a reliable half-amplitude proxy
  const ratio = medH > 0 ? signalRange / (2 * medH) : Infinity;
  if (ratio < REP_MEDH_REPRESENTATIVE_RATIO) {
    const halfAmps: number[] = [];
    for (let i = start; i < end - 1; i++) {
      halfAmps.push(Math.abs(tps[i + 1][1] - tps[i][1]));
    }

    if (halfAmps.length > 0) {
      // Otsu finds the optimal threshold between regular-rep half-amplitudes
      // and the outlier re-rack amplitude. Skip trim when the distribution is
      // unimodal (Otsu returns ≤ median, meaning no clear outlier class exists).
      const fence = otsuThreshold(halfAmps);

      if (fence > floorMedian(halfAmps)) {
        while (end - start > 3 && halfAmps[halfAmps.length - 1] >= fence) {
          end--;
          halfAmps.pop();
        }
      }
    }
  }

  return tps.slice(start, end);
}

// Removes turning points whose value falls strictly between their predecessor
// and successor — these are noise blips within a monotone excursion (e.g. a
// brief stall mid-rep that flips the trend without a meaningful reversal).
// Iterates until no more monotone TPs remain (cascading removals are rare but
// possible when consecutive noise blips are adjacent).
function removeMonotoneTurningPoints(tps: [number, number][]): [number, number][] {
  let current = tps;

  for (;;) {
    const filtered: [number, number][] = [];

    for (let i = 0; i < current.length; i++) {
      if (filtered.length === 0 || i === current.length - 1) {
        filtered.push(current[i]);
        continue;
      }

      const prevVal = filtered[filtered.length - 1][1];
      const currVal = current[i][1];
      const nextVal = current[i + 1][1];
      const isBetween =
        (prevVal < currVal && currVal < nextVal) || (prevVal > currVal && currVal > nextVal);

      if (!isBetween) {
        filtered.push(current[i]);
      }
    }

    if (filtered.length === current.length) {
      return current;
    }

    current = filtered;
  }
}

function findPositivePeakTimestamps(
  values: number[],
  timestamps: number[],
  smoothAlpha: number,
  thresholdFraction: number,
  minPeakGapMs: number
): number[] {
  if (values.length < 3) {
    return [];
  }

  const smoothed = smoothEma(values, smoothAlpha);
  const baselineWindow = Math.min(20, smoothed.length);
  const baseline = floorMedian(smoothed.slice(0, baselineWindow));
  const centered = smoothed.map((value) => value - baseline);
  const signalRange = mlMax(centered) - mlMin(centered);
  const peakThreshold = signalRange * thresholdFraction;

  const peakTimestamps: number[] = [];
  let lastPeakMs: number | null = null;

  for (let i = 1; i < centered.length - 1; i++) {
    const isPeak = centered[i] > centered[i - 1] && centered[i] >= centered[i + 1];
    const gapMs = lastPeakMs === null ? Infinity : timestamps[i] - lastPeakMs;

    if (isPeak && centered[i] > peakThreshold && gapMs >= minPeakGapMs) {
      peakTimestamps.push(timestamps[i]);
      lastPeakMs = timestamps[i];
    }
  }

  return peakTimestamps;
}

function countPositivePeaks(
  values: number[],
  timestamps: number[],
  smoothAlpha: number,
  thresholdFraction: number,
  minPeakGapMs: number
): number {
  return findPositivePeakTimestamps(
    values,
    timestamps,
    smoothAlpha,
    thresholdFraction,
    minPeakGapMs
  ).length;
}

export function analyzeRecordedReps(samples: MotionSample[]): RepAnalysisSummary {
  if (samples.length === 0) {
    return { repCount: 0, sampleCount: 0, durationMs: 0 };
  }

  const timestamps = samples.map((sample) => sample.timestamp);

  const axes = ['x', 'y'] as const;
  const axisRanges: Record<'x' | 'y', number> = { x: -Infinity, y: -Infinity };
  for (const axis of axes) {
    const vals = samples.map((s) => s.angle[axis]);
    axisRanges[axis] = mlMax(vals) - mlMin(vals);
  }

  const dominantAxis = (axisRanges.x >= axisRanges.y ? 'x' : 'y') as 'x' | 'y';

  const rawValues = samples.map((s) => s.angle[dominantAxis]);
  const smoothed = smoothEma(rawValues, REP_ANGLE_SMOOTH_ALPHA);
  const baselineWindow = Math.min(20, smoothed.length);
  const baseline = floorMedian(smoothed.slice(0, baselineWindow));
  const centeredRaw = smoothed.map((value) => value - baseline);
  const signalRangeRaw = mlMax(centeredRaw) - mlMin(centeredRaw);

  // When gyro drift is dominant (start/end differ by ≥ 65 % of signal range),
  // linear detrend removes the accumulated error before turning-point analysis.
  const driftWindowSize = Math.min(20, Math.floor(centeredRaw.length * 0.05));
  const startMean =
    centeredRaw.slice(0, driftWindowSize).reduce((s, v) => s + v, 0) / driftWindowSize;
  const endMean = centeredRaw.slice(-driftWindowSize).reduce((s, v) => s + v, 0) / driftWindowSize;
  const driftRatio = signalRangeRaw > 0 ? Math.abs(endMean - startMean) / signalRangeRaw : 0;
  const driftActive = driftRatio >= 0.65;
  const centered = driftActive ? detrendLinear(centeredRaw) : centeredRaw;
  const signalRange = mlMax(centered) - mlMin(centered);
  const minTurningPointDelta = signalRange * REP_TURNING_POINT_MIN_DELTA_FRACTION;

  const rawTurningPoints = collectTurningPoints(centered, timestamps, minTurningPointDelta);
  const closeTrimmedTurningPoints = filterCloseTurningPoints(rawTurningPoints, 300);
  // Monotone TP cleanup: only needed for detrended signals where gyro-drift
  // correction can leave sub-amplitude noise peaks inside a rep's excursion.
  const filteredTurningPoints = driftActive
    ? removeMonotoneTurningPoints(closeTrimmedTurningPoints)
    : closeTrimmedTurningPoints;

  // Pre-compute cluster characteristics from all filtered TPs
  const allHalfAmps: number[] = [];
  for (let i = 0; i < filteredTurningPoints.length - 1; i++) {
    allHalfAmps.push(Math.abs(filteredTurningPoints[i + 1][1] - filteredTurningPoints[i][1]));
  }

  const medH = allHalfAmps.length > 0 ? floorMedian(allHalfAmps) : signalRange / 4;
  const tpMedian =
    filteredTurningPoints.length > 0 ? floorMedian(filteredTurningPoints.map(([, v]) => v)) : 0;

  const trimmedTurningPoints = trimBoundaryTurningPoints(
    filteredTurningPoints,
    tpMedian,
    medH,
    signalRange
  );
  const trimHappened = trimmedTurningPoints.length < filteredTurningPoints.length;
  // Leading trim means a setup/unrack phase was detected, which also implies a
  // potential re-rack at the end that the triplet scorer may count as a rep.
  const leadingTrimHappened =
    trimHappened &&
    filteredTurningPoints.length > 0 &&
    trimmedTurningPoints.length > 0 &&
    trimmedTurningPoints[0] !== filteredTurningPoints[0];

  // When trimming removed setup/racking TPs, the remaining cluster's medH is
  // the right scale reference for the threshold. Otherwise use signal range.
  let repHeightThreshold: number;
  if (trimHappened) {
    const trimmedHalfAmps: number[] = [];
    for (let i = 0; i < trimmedTurningPoints.length - 1; i++) {
      trimmedHalfAmps.push(Math.abs(trimmedTurningPoints[i + 1][1] - trimmedTurningPoints[i][1]));
    }

    const trimmedMedH = trimmedHalfAmps.length > 0 ? floorMedian(trimmedHalfAmps) : signalRange / 4;
    repHeightThreshold = 2 * trimmedMedH * REP_HEIGHT_THRESHOLD_FRACTION;
  } else {
    repHeightThreshold = signalRange * REP_HEIGHT_THRESHOLD_FRACTION;
  }

  let repCount = 0;
  const turningPointBuffer: number[] = [];

  for (const [, turningPoint] of trimmedTurningPoints) {
    turningPointBuffer.push(turningPoint);

    while (turningPointBuffer.length >= 3) {
      const repHeight =
        Math.abs(turningPointBuffer[0] - turningPointBuffer[1]) +
        Math.abs(turningPointBuffer[1] - turningPointBuffer[2]);

      if (repHeight > repHeightThreshold) {
        repCount++;
        turningPointBuffer.splice(0, 2);
      } else {
        turningPointBuffer.splice(0, 1);
      }
    }
  }

  const peakClusterCandidates: { count: number; score: number }[] = [];

  // PCA on the 2D angle data: the PC1 projection captures the true axis of
  // maximum variance, including diagonal motion that pure x/y axes miss.
  // Adding it as an extra candidate strengthens the cross-check without
  // touching the main turning-point path.
  const pc1Scores = new PCA(samples.map((s) => [s.angle.x, s.angle.y]))
    .predict(samples.map((s) => [s.angle.x, s.angle.y]))
    .to2DArray()
    .map((r) => r[0]);
  const pc1Candidate = collectPeakClusterCandidate(pc1Scores, timestamps);
  if (pc1Candidate) {
    peakClusterCandidates.push(pc1Candidate);
  }

  for (const axis of axes) {
    const angleCandidate = collectPeakClusterCandidate(
      samples.map((sample) => sample.angle[axis]),
      timestamps
    );

    if (angleCandidate) {
      peakClusterCandidates.push(angleCandidate);
    }
  }

  for (const axis of ['x', 'y', 'z'] as const) {
    const accelCandidate = collectPeakClusterCandidate(
      samples.map((sample) => sample.accel[axis]),
      timestamps
    );

    if (accelCandidate) {
      peakClusterCandidates.push(accelCandidate);
    }
  }

  // When leading trim detected a setup/unrack, there's likely also a re-rack at
  // the end that the triplet scorer can miscount as one extra rep. A peak cluster
  // at repCount - 1 is the signal that this happened. Guard on leadingTrimHappened
  // so the correction never fires for clean exercises where peak counting simply
  // undershoots by 1 due to amplitude variation.
  if (leadingTrimHappened) {
    const downByOneCandidates = peakClusterCandidates.filter(
      (candidate) => candidate.count === repCount - 1
    );

    if (downByOneCandidates.length > 0) {
      downByOneCandidates.sort((a, b) => b.score - a.score);
      repCount = downByOneCandidates[0].count;
    }
  }

  const angleFlatRangeDeg = Math.max(
    mlMax(samples.map((s) => s.angle.x)) - mlMin(samples.map((s) => s.angle.x)),
    mlMax(samples.map((s) => s.angle.y)) - mlMin(samples.map((s) => s.angle.y))
  );

  if (angleFlatRangeDeg <= REP_CABLE_FLAT_ANGLE_RANGE_THRESHOLD_DEG) {
    const accelZValues = samples.map((sample) => sample.accel.z);
    const strictPeakTs = findPositivePeakTimestamps(
      accelZValues,
      timestamps,
      REP_ACCEL_Z_SMOOTH_ALPHA,
      REP_ACCEL_Z_PEAK_THRESHOLD_FRACTION,
      REP_ACCEL_Z_MIN_PEAK_GAP_MS
    );
    const loosePeakTs = findPositivePeakTimestamps(
      accelZValues,
      timestamps,
      REP_ACCEL_Z_SMOOTH_ALPHA,
      REP_ACCEL_Z_LOOSE_PEAK_THRESHOLD_FRACTION,
      REP_ACCEL_Z_MIN_PEAK_GAP_MS
    );

    // Prefer the loose count when it finds more peaks that are all well-spaced.
    // If any consecutive pair is suspiciously close (doublet bounce from a lower
    // threshold), the loose pass is over-sensitive — fall back to the strict count.
    const hasDoublets = loosePeakTs.some(
      (t, i) => i > 0 && t - loosePeakTs[i - 1] < REP_ACCEL_Z_DOUBLET_GAP_MS
    );
    const accelZRepCount =
      !hasDoublets && loosePeakTs.length > strictPeakTs.length
        ? loosePeakTs.length
        : strictPeakTs.length;

    if (accelZRepCount > repCount) {
      repCount = accelZRepCount;
    }
  }

  return {
    repCount,
    sampleCount: samples.length,
    durationMs: Math.max(0, samples[samples.length - 1].timestamp - samples[0].timestamp),
  };
}

export interface ReconciledRepResult {
  repCount: number;
  repDurationsMs: number[];
}

/**
 * Uses the ML model's rep count as ground truth and bends the peak detector to
 * match it, producing a per-rep duration array as a byproduct.
 *
 * Three-stage reconciliation:
 *   1. Target seek  — binary-search the peak threshold until the detector finds
 *      exactly mlRepCount peaks.
 *   2. Amplitude pruning — if the seek overshoots, keep the N tallest peaks.
 *   3. Outlier splitting — if the seek undershoots, split the longest inter-peak
 *      gaps until the duration count reaches mlRepCount − 1.
 */
export function reconcileRepCounts(
  samples: MotionSample[],
  mlRepCount: number
): ReconciledRepResult {
  const target = Math.max(0, Math.round(mlRepCount));

  if (samples.length < 10 || target === 0) {
    return { repCount: target, repDurationsMs: [] };
  }

  const n = samples.length;
  const timestamps = samples.map((s) => s.timestamp);
  const angX = samples.map((s) => s.angle.x);
  const angY = samples.map((s) => s.angle.y);

  // Dominant axis — same selection as analyzeRecordedReps
  const rawValues = mlMax(angX) - mlMin(angX) >= mlMax(angY) - mlMin(angY) ? angX : angY;

  // EMA smooth → subtract first-20 baseline
  const smoothed = smoothEma(rawValues, REP_ANGLE_SMOOTH_ALPHA);
  const baseline = floorMedian(smoothed.slice(0, Math.min(20, n)));
  const centeredRaw = smoothed.map((v) => v - baseline);
  const signalRangeRaw = mlMax(centeredRaw) - mlMin(centeredRaw);

  // Linear detrend when gyro drift dominates (same 65 % threshold as analyzeRecordedReps)
  const driftWindow = Math.min(20, Math.floor(n * 0.05));
  const startMean = centeredRaw.slice(0, driftWindow).reduce((s, v) => s + v, 0) / driftWindow;
  const endMean = centeredRaw.slice(-driftWindow).reduce((s, v) => s + v, 0) / driftWindow;
  const driftRatio = signalRangeRaw > 0 ? Math.abs(endMean - startMean) / signalRangeRaw : 0;
  const centered = driftRatio >= 0.65 ? detrendLinear(centeredRaw) : centeredRaw;

  const signalMin = mlMin(centered);
  const signalMax = mlMax(centered);
  const signalRange = signalMax - signalMin;

  if (signalRange === 0) {
    return { repCount: target, repDurationsMs: [] };
  }

  // Positive-peak finder on the already-processed signal.
  // thresholdFraction ∈ [0, 1]: 0 = find nearly every peak, 1 = find nothing.
  function findPeaks(thresholdFraction: number): [number, number][] {
    const threshold = signalMin + signalRange * thresholdFraction;
    const result: [number, number][] = [];
    let lastPeakMs: number | null = null;

    for (let i = 1; i < centered.length - 1; i++) {
      const isPeak = centered[i] > centered[i - 1] && centered[i] >= centered[i + 1];
      const gapMs = lastPeakMs === null ? Infinity : timestamps[i] - lastPeakMs;

      if (isPeak && centered[i] > threshold && gapMs >= RECONCILE_MIN_PEAK_GAP_MS) {
        result.push([timestamps[i], centered[i]]);
        lastPeakMs = timestamps[i];
      }
    }

    return result;
  }

  // Stage 1: binary search — raise/lower threshold until peak count hits target.
  let lo = 0.0;
  let hi = 1.0;
  let bestPeaks = findPeaks(0.0);

  for (let iter = 0; iter < RECONCILE_MAX_SEEK_ITERATIONS; iter++) {
    const mid = (lo + hi) / 2;
    const peaks = findPeaks(mid);

    if (peaks.length === target) {
      bestPeaks = peaks;
      break;
    }

    if (peaks.length > target) {
      lo = mid; // too many peaks → raise threshold to suppress minor ones
    } else {
      hi = mid; // too few peaks → lower threshold to surface smaller ones
    }

    if (Math.abs(peaks.length - target) < Math.abs(bestPeaks.length - target)) {
      bestPeaks = peaks;
    }
  }

  // Stage 2: amplitude pruning — if we still have more peaks than target, keep
  // the N tallest (they are most likely to be genuine reps), then re-sort by time.
  if (bestPeaks.length > target) {
    bestPeaks = [...bestPeaks]
      .sort((a, b) => b[1] - a[1])
      .slice(0, target)
      .sort((a, b) => a[0] - b[0]);
  }

  const peakTimestamps = bestPeaks.map(([ts]) => ts);

  if (peakTimestamps.length < 2) {
    return { repCount: target, repDurationsMs: [] };
  }

  // Inter-peak durations: N peaks → N−1 gaps
  const rawDurations = peakTimestamps.slice(1).map((ts, i) => ts - peakTimestamps[i]);

  // Stage 3: outlier splitting — if the seek couldn't reach target, we're short
  // by (target − peakCount) peaks, which means (target − peakCount) missing gaps.
  // Split the longest gap repeatedly until the duration array is the right size.
  const missingGaps = target - bestPeaks.length; // = (target−1) − rawDurations.length

  if (missingGaps > 0) {
    const durations = [...rawDurations];

    for (let m = 0; m < missingGaps; m++) {
      let maxIdx = 0;
      for (let i = 1; i < durations.length; i++) {
        if (durations[i] > durations[maxIdx]) {
          maxIdx = i;
        }
      }

      const half = durations[maxIdx] / 2;
      durations.splice(maxIdx, 1, half, half);
    }

    return { repCount: target, repDurationsMs: durations };
  }

  return { repCount: target, repDurationsMs: rawDurations };
}
