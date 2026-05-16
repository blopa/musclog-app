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
// wraps at ±180°). The AHRS angle signal represents actual limb position and
// naturally integrates velocity, so it produces one clean peak per rep
// regardless of whether the movement is slow/unidirectional or fast/bidirectional.
const REP_ANGLE_SMOOTH_ALPHA = 0.15;
const REP_ANGLE_PEAK_THRESHOLD_DEG = 4;
const REP_MIN_PEAK_GAP_MS = 1500;

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

  const baselineWindow = Math.min(20, rawValues.length);
  const baselineSorted = rawValues.slice(0, baselineWindow).slice().sort((a, b) => a - b);
  const baseline = baselineSorted[Math.floor(baselineSorted.length / 2)];

  // Smooth the absolute deviation from baseline
  const devs = rawValues.map((v) => Math.abs(v - baseline));
  const smoothed: number[] = [devs[0]];
  for (let i = 1; i < devs.length; i++) {
    smoothed.push(REP_ANGLE_SMOOTH_ALPHA * devs[i] + (1 - REP_ANGLE_SMOOTH_ALPHA) * smoothed[i - 1]);
  }

  let repCount = 0;
  let lastPeakMs: number | null = null;

  for (let i = 1; i < smoothed.length - 1; i++) {
    const isPeak = smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1];
    const gapMs = lastPeakMs === null ? Infinity : samples[i].timestamp - lastPeakMs;

    if (isPeak && smoothed[i] > REP_ANGLE_PEAK_THRESHOLD_DEG && gapMs >= REP_MIN_PEAK_GAP_MS) {
      repCount++;
      lastPeakMs = samples[i].timestamp;
    }
  }

  return {
    repCount,
    sampleCount: samples.length,
    durationMs: Math.max(0, samples[samples.length - 1].timestamp - samples[0].timestamp),
  };
}
