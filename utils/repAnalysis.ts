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
// score a rep when three significant turns form a full excursion. For cable or
// stack machines where x/y barely move, we fall back to accel.z peaks because
// that axis carries the repeated load spike more clearly than orientation.
// For rack exercises (e.g. barbell press), the initial unracking creates a large
// transient spike that inflates the signal range. We detect this via gyroscope
// and trim the setup phase from turning-point scoring while using a lower
// threshold fraction to compensate for the inflated range.
const REP_ANGLE_SMOOTH_ALPHA = 0.15;
const REP_TURNING_POINT_MIN_DELTA_FRACTION = 0.15;
const REP_HEIGHT_THRESHOLD_FRACTION = 0.45;
const REP_CABLE_FLAT_ANGLE_RANGE_THRESHOLD_DEG = 5;
const REP_ACCEL_Z_SMOOTH_ALPHA = 0.15;
const REP_ACCEL_Z_PEAK_THRESHOLD_FRACTION = 0.3;
const REP_ACCEL_Z_MIN_PEAK_GAP_MS = 100;
const RACK_GYRO_STILL_DPS = 2;
const RACK_GYRO_UNRACK_DPS = 50;
const RACK_MIN_REST_MS = 3000;
const RACK_UNRACK_WINDOW_MS = 2000;
const RACK_SETUP_SKIP_MS = 4000;
const RACK_HEIGHT_THRESHOLD_FRACTION = 0.37;
const RACK_GYRO_SMOOTH_ALPHA = 0.05;

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

function collectTurningPoints(
  values: number[],
  timestamps: number[],
  minDelta: number
): Array<[number, number]> {
  if (values.length < 3) {
    return [];
  }

  const turningPoints: Array<[number, number]> = [];
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

function filterCloseTurningPoints(
  tps: Array<[number, number]>,
  minGapMs: number
): Array<[number, number]> {
  if (tps.length === 0) {
    return [];
  }

  const filtered: Array<[number, number]> = [tps[0]];

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

function detectRackExerciseStart(
  samples: MotionSample[],
  firstTurningPoint: number,
  turningPointMedian: number
): number | null {
  // First TP must point the opposite direction from the exercise median —
  // the unracking spike goes the wrong way before settling into the working range.
  const firstOppositeToMedian =
    (firstTurningPoint > 0 && turningPointMedian < 0) ||
    (firstTurningPoint < 0 && turningPointMedian > 0);

  if (!firstOppositeToMedian) {
    return null;
  }

  let smoothedGmag = 0;
  let motionStartTs: number | null = null;

  for (const s of samples) {
    const gmag = Math.sqrt(s.gyro.x ** 2 + s.gyro.y ** 2 + s.gyro.z ** 2);
    smoothedGmag = RACK_GYRO_SMOOTH_ALPHA * gmag + (1 - RACK_GYRO_SMOOTH_ALPHA) * smoothedGmag;

    if (motionStartTs === null && smoothedGmag > RACK_GYRO_STILL_DPS) {
      motionStartTs = s.timestamp;
    }
  }

  if (motionStartTs === null || motionStartTs - samples[0].timestamp < RACK_MIN_REST_MS) {
    return null;
  }

  const windowEnd = motionStartTs + RACK_UNRACK_WINDOW_MS;
  let maxGmag = 0;

  for (const s of samples) {
    if (s.timestamp < motionStartTs) {
      continue;
    }

    if (s.timestamp > windowEnd) {
      break;
    }

    const gmag = Math.sqrt(s.gyro.x ** 2 + s.gyro.y ** 2 + s.gyro.z ** 2);
    maxGmag = Math.max(maxGmag, gmag);
  }

  if (maxGmag < RACK_GYRO_UNRACK_DPS) {
    return null;
  }

  return motionStartTs + RACK_SETUP_SKIP_MS;
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
      if (sample.angle[axis] < mins[axis]) mins[axis] = sample.angle[axis];
      if (sample.angle[axis] > maxs[axis]) maxs[axis] = sample.angle[axis];
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
  const allTurningPointValues = filteredTurningPoints.map(([, v]) => v);

  const tpMedian = median(allTurningPointValues);
  const exerciseStartTs =
    allTurningPointValues.length > 0
      ? detectRackExerciseStart(samples, allTurningPointValues[0], tpMedian)
      : null;

  const scoringTurningPoints =
    exerciseStartTs !== null
      ? filteredTurningPoints.filter(([ts]) => ts >= exerciseStartTs)
      : filteredTurningPoints;

  const repHeightThreshold =
    signalRange *
    (exerciseStartTs !== null ? RACK_HEIGHT_THRESHOLD_FRACTION : REP_HEIGHT_THRESHOLD_FRACTION);

  let repCount = 0;
  const turningPointBuffer: number[] = [];

  for (const [, turningPoint] of scoringTurningPoints) {
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
