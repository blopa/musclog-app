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
// score a rep when three significant turns form a full excursion. This is more
// stable than counting raw peaks because it tolerates mixed cadence and
// amplitude changes within the same set.
const REP_ANGLE_SMOOTH_ALPHA = 0.15;
const REP_TURNING_POINT_MIN_DELTA_FRACTION = 0.15;
const REP_HEIGHT_THRESHOLD_FRACTION = 0.45;

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

export function analyzeRecordedReps(samples: MotionSample[]): RepAnalysisSummary {
  if (samples.length === 0) {
    return { repCount: 0, sampleCount: 0, durationMs: 0 };
  }

  // angle.z wraps at ±180° so we only consider x and y
  const axes = ['x', 'y'] as const;
  const mins: Record<'x' | 'y', number> = { x: Infinity, y: Infinity };
  const maxs: Record<'x' | 'y', number> = { x: -Infinity, y: -Infinity };

  for (const sample of samples) {
    for (const axis of axes) {
      if (sample.angle[axis] < mins[axis]) mins[axis] = sample.angle[axis];
      if (sample.angle[axis] > maxs[axis]) maxs[axis] = sample.angle[axis];
    }
  }

  const dominantAxis = (maxs.x - mins.x >= maxs.y - mins.y ? 'x' : 'y') as 'x' | 'y';
  const rawValues = samples.map((s) => s.angle[dominantAxis]);
  const smoothed = smoothEma(rawValues, REP_ANGLE_SMOOTH_ALPHA);
  const baselineWindow = Math.min(20, smoothed.length);
  const baseline = median(smoothed.slice(0, baselineWindow));
  const centered = smoothed.map((value) => value - baseline);
  const signalRange = Math.max(...centered) - Math.min(...centered);
  const minTurningPointDelta = signalRange * REP_TURNING_POINT_MIN_DELTA_FRACTION;
  const repHeightThreshold = signalRange * REP_HEIGHT_THRESHOLD_FRACTION;

  const timestamps = samples.map((s) => s.timestamp);
  const rawTurningPoints = collectTurningPoints(centered, timestamps, minTurningPointDelta);
  const filteredTurningPoints = filterCloseTurningPoints(rawTurningPoints, 300);
  const turningPointValues = filteredTurningPoints.map(([, v]) => v);

  let repCount = 0;
  const turningPointBuffer: number[] = [];

  for (const turningPoint of turningPointValues) {
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

  return {
    repCount,
    sampleCount: samples.length,
    durationMs: Math.max(0, samples[samples.length - 1].timestamp - samples[0].timestamp),
  };
}
