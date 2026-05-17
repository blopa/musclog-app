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

// Rep counting uses the dominant angle axis (x or y — z is excluded because it
// wraps at ±180°). The signal is smoothed, then we track turning points and
// score a rep when three significant turns form a full excursion.
//
// Two types of outlier turning points are removed:
//
//   Leading: if the first TP is in the opposite direction from the TP median
//   (e.g. rack exercises where the unracking spike is directionally opposite
//   to the actual working range), those leading TPs are trimmed — no hardcoded
//   timing required.
//
//   Trailing: only when the median half-amplitude (medH) is representative of
//   the exercise amplitude (signalRange / (2 × medH) < 2), we apply an IQR
//   fence on consecutive half-amplitudes and trim the trailing TP when its
//   half-amplitude is a clear outlier (e.g. the bar being re-racked pulls the
//   signal to an unusual position).
//
// When trimming occurs the rep height threshold adapts to 2 × medH × 0.45
// (median half-amplitude of the remaining cluster). When no trimming occurs the
// original signalRange × 0.45 threshold is used. For cable or stack machines
// where x/y barely move, we fall back to accel.z peaks. A peak-cluster
// cross-check on all signal axes corrects the rare case where a re-rack or
// stutter TP creates exactly one spurious extra triplet.
const REP_ANGLE_SMOOTH_ALPHA = 0.15;
const REP_TURNING_POINT_MIN_DELTA_FRACTION = 0.15;
const REP_HEIGHT_THRESHOLD_FRACTION = 0.45;
const REP_PEAK_CLUSTER_THRESHOLD_FRACTION = 0.35;
const REP_PEAK_CLUSTER_GAP_QUANTILE = 0.8;
const REP_CABLE_FLAT_ANGLE_RANGE_THRESHOLD_DEG = 5;
const REP_ACCEL_Z_SMOOTH_ALPHA = 0.15;
const REP_ACCEL_Z_PEAK_THRESHOLD_FRACTION = 0.3;
const REP_ACCEL_Z_MIN_PEAK_GAP_MS = 100;
// When signalRange / (2 × medH) is below this value, medH is considered a
// reliable proxy for the exercise half-amplitude, enabling IQR trailing trim.
const REP_MEDH_REPRESENTATIVE_RATIO = 2;

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

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = position - lowerIndex;
  return sorted[lowerIndex] + weight * (sorted[upperIndex] - sorted[lowerIndex]);
}

function detrendLinear(values: number[]): number[] {
  if (values.length < 2) {
    return values.slice();
  }

  const start = values[0];
  const end = values[values.length - 1];

  return values.map((value, index) => {
    const trend = start + ((end - start) * index) / (values.length - 1);
    return value - trend;
  });
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
  if (values.length < 3) {
    return null;
  }

  const smoothed = smoothEma(values, REP_ANGLE_SMOOTH_ALPHA);
  const centered = detrendLinear(smoothed);
  const signalRange = Math.max(...centered) - Math.min(...centered);

  if (signalRange <= 0) {
    return null;
  }

  const peakThreshold = signalRange * REP_PEAK_CLUSTER_THRESHOLD_FRACTION;
  const peaks: [number, number][] = [];

  for (let i = 1; i < centered.length - 1; i++) {
    const isPeak = centered[i] > centered[i - 1] && centered[i] >= centered[i + 1];

    if (isPeak && centered[i] > peakThreshold) {
      peaks.push([timestamps[i], centered[i]]);
    }
  }

  if (peaks.length < 3) {
    return null;
  }

  const gaps: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    gaps.push(peaks[i][0] - peaks[i - 1][0]);
  }

  const gapThreshold = quantile(gaps, REP_PEAK_CLUSTER_GAP_QUANTILE);

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
  const prominence = median(bestCluster.map(([, value]) => value)) / signalRange;
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
// Trailing trim: only when medH is representative (ratio < threshold), strips
// the trailing TP if its adjacent half-amplitude is above the IQR fence of all
// half-amplitudes in the remaining cluster (e.g. re-racking the bar).
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
      const sorted = [...halfAmps].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const fence = q3 + 1.5 * (q3 - q1);

      while (end - start > 3 && halfAmps[halfAmps.length - 1] > fence) {
        end--;
        halfAmps.pop();
      }
    }
  }

  return tps.slice(start, end);
}

function countPositivePeaks(
  values: number[],
  timestamps: number[],
  smoothAlpha: number,
  thresholdFraction: number,
  minPeakGapMs: number
): number {
  if (values.length < 3) {
    return 0;
  }

  const smoothed = smoothEma(values, smoothAlpha);
  const baselineWindow = Math.min(20, smoothed.length);
  const baseline = median(smoothed.slice(0, baselineWindow));
  const centered = smoothed.map((value) => value - baseline);
  const signalRange = Math.max(...centered) - Math.min(...centered);
  const peakThreshold = signalRange * thresholdFraction;

  let count = 0;
  let lastPeakMs: number | null = null;

  for (let i = 1; i < centered.length - 1; i++) {
    const isPeak = centered[i] > centered[i - 1] && centered[i] >= centered[i + 1];
    const gapMs = lastPeakMs === null ? Infinity : timestamps[i] - lastPeakMs;

    if (isPeak && centered[i] > peakThreshold && gapMs >= minPeakGapMs) {
      count++;
      lastPeakMs = timestamps[i];
    }
  }

  return count;
}

export function analyzeRecordedReps(samples: MotionSample[]): RepAnalysisSummary {
  if (samples.length === 0) {
    return { repCount: 0, sampleCount: 0, durationMs: 0 };
  }

  const axes = ['x', 'y'] as const;
  const mins: Record<'x' | 'y', number> = { x: Infinity, y: Infinity };
  const maxs: Record<'x' | 'y', number> = { x: -Infinity, y: -Infinity };

  for (const sample of samples) {
    for (const axis of axes) {
      if (sample.angle[axis] < mins[axis]) {
        mins[axis] = sample.angle[axis];
      }

      if (sample.angle[axis] > maxs[axis]) {
        maxs[axis] = sample.angle[axis];
      }
    }
  }

  const timestamps = samples.map((sample) => sample.timestamp);
  const angleFlatRangeDeg = Math.max(maxs.x - mins.x, maxs.y - mins.y);
  const dominantAxis = (maxs.x - mins.x >= maxs.y - mins.y ? 'x' : 'y') as 'x' | 'y';
  const rawValues = samples.map((s) => s.angle[dominantAxis]);
  const smoothed = smoothEma(rawValues, REP_ANGLE_SMOOTH_ALPHA);
  const baselineWindow = Math.min(20, smoothed.length);
  const baseline = median(smoothed.slice(0, baselineWindow));
  const centered = smoothed.map((value) => value - baseline);
  const signalRange = Math.max(...centered) - Math.min(...centered);
  const minTurningPointDelta = signalRange * REP_TURNING_POINT_MIN_DELTA_FRACTION;

  const rawTurningPoints = collectTurningPoints(centered, timestamps, minTurningPointDelta);
  const filteredTurningPoints = filterCloseTurningPoints(rawTurningPoints, 300);

  // Pre-compute cluster characteristics from all filtered TPs
  const allHalfAmps: number[] = [];
  for (let i = 0; i < filteredTurningPoints.length - 1; i++) {
    allHalfAmps.push(Math.abs(filteredTurningPoints[i + 1][1] - filteredTurningPoints[i][1]));
  }
  const medH = allHalfAmps.length > 0 ? median(allHalfAmps) : signalRange / 4;
  const tpMedian = median(filteredTurningPoints.map(([, v]) => v));

  const trimmedTurningPoints = trimBoundaryTurningPoints(
    filteredTurningPoints,
    tpMedian,
    medH,
    signalRange
  );
  const trimHappened = trimmedTurningPoints.length < filteredTurningPoints.length;

  // When trimming removed setup/racking TPs, the remaining cluster's medH is
  // the right scale reference for the threshold. Otherwise use signal range.
  let repHeightThreshold: number;
  if (trimHappened) {
    const trimmedHalfAmps: number[] = [];
    for (let i = 0; i < trimmedTurningPoints.length - 1; i++) {
      trimmedHalfAmps.push(Math.abs(trimmedTurningPoints[i + 1][1] - trimmedTurningPoints[i][1]));
    }
    const trimmedMedH = trimmedHalfAmps.length > 0 ? median(trimmedHalfAmps) : signalRange / 4;
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

  // The TP method overcounts by exactly 1 when a setup/re-rack motion creates a
  // spurious triplet at the boundary. A peak cluster with count = repCount − 1
  // is the signal that this happened — correct it, then stop. Never correct
  // upward here; the trimBoundaryTurningPoints adaptive threshold already handles
  // exercises where AHRS drift compresses apparent rep amplitude.
  const downByOneCandidates = peakClusterCandidates.filter(
    (candidate) => candidate.count === repCount - 1
  );

  if (downByOneCandidates.length > 0) {
    downByOneCandidates.sort((a, b) => b.score - a.score);
    repCount = downByOneCandidates[0].count;
  }

  if (angleFlatRangeDeg <= REP_CABLE_FLAT_ANGLE_RANGE_THRESHOLD_DEG) {
    const accelZRepCount = countPositivePeaks(
      samples.map((sample) => sample.accel.z),
      timestamps,
      REP_ACCEL_Z_SMOOTH_ALPHA,
      REP_ACCEL_Z_PEAK_THRESHOLD_FRACTION,
      REP_ACCEL_Z_MIN_PEAK_GAP_MS
    );

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
