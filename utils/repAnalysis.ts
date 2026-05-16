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

// Rep counting uses the dominant gyroscope axis, which has a much larger
// signal range than raw acceleration for slow/controlled movements.
const REP_SMOOTH_ALPHA = 0.15;
const REP_PEAK_THRESHOLD_DPS = 10;
const REP_MIN_PEAK_GAP_MS = 500;

export function analyzeRecordedReps(samples: MotionSample[]): RepAnalysisSummary {
  if (samples.length === 0) {
    return { repCount: 0, sampleCount: 0, durationMs: 0 };
  }

  const axes = ['x', 'y', 'z'] as const;
  const mins: Record<'x' | 'y' | 'z', number> = { x: Infinity, y: Infinity, z: Infinity };
  const maxs: Record<'x' | 'y' | 'z', number> = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const sample of samples) {
    for (const axis of axes) {
      if (sample.gyro[axis] < mins[axis]) mins[axis] = sample.gyro[axis];
      if (sample.gyro[axis] > maxs[axis]) maxs[axis] = sample.gyro[axis];
    }
  }

  const dominantAxis = axes.reduce((best, axis) => {
    return maxs[axis] - mins[axis] > maxs[best] - mins[best] ? axis : best;
  }, 'z' as const);

  const rawValues = samples.map((s) => s.gyro[dominantAxis]);

  const smoothed: number[] = [rawValues[0]];
  for (let i = 1; i < rawValues.length; i++) {
    smoothed.push(REP_SMOOTH_ALPHA * rawValues[i] + (1 - REP_SMOOTH_ALPHA) * smoothed[i - 1]);
  }

  const baselineWindow = Math.min(20, rawValues.length);
  const baselineSorted = rawValues.slice(0, baselineWindow).slice().sort((a, b) => a - b);
  const baseline = baselineSorted[Math.floor(baselineSorted.length / 2)];

  let repCount = 0;
  let lastPeakMs: number | null = null;

  for (let i = 1; i < smoothed.length - 1; i++) {
    const dev = Math.abs(smoothed[i] - baseline);
    const devPrev = Math.abs(smoothed[i - 1] - baseline);
    const devNext = Math.abs(smoothed[i + 1] - baseline);
    const isPeak = dev > devPrev && dev >= devNext;
    const gapMs = lastPeakMs === null ? Infinity : samples[i].timestamp - lastPeakMs;

    if (isPeak && dev > REP_PEAK_THRESHOLD_DPS && gapMs >= REP_MIN_PEAK_GAP_MS) {
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
