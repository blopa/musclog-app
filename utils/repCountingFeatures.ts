/**
 * Feature extraction for the ML rep-counting model (repCountingModel.js).
 *
 * Mirrors training-data/train.py extract_features() exactly so the input
 * vector fed to predictRepCount() matches what the model was trained on.
 *
 * Input order (32 features):
 *   0  duration_ms
 *   1  sample_rate_hz
 *   2  dominant_range_deg
 *   3  nondominant_range_deg
 *   4  drift_ratio
 *   5  peak_count
 *   6  valley_count
 *   7  median_half_amp_deg
 *   8  std_half_amp_deg
 *   9  dominant_freq_hz
 *  10  freq_est_reps
 *  11  zero_crossing_count
 *  12  accel_z_range
 *  13  accel_z_peak_count
 *  14  is_angle_flat
 *  15  muscle_abdomen
 *  16  muscle_arms
 *  17  muscle_back
 *  18  muscle_chest
 *  19  muscle_core
 *  20  muscle_full_body
 *  21  muscle_glutes
 *  22  muscle_legs
 *  23  muscle_shoulders
 *  24  muscle_unknown
 *  25  type_bodyweight
 *  26  type_cardio
 *  27  type_compound
 *  28  type_isolation
 *  29  type_machine
 *  30  type_plyometric
 *  31  type_unknown
 */

const SMOOTH_ALPHA = 0.15;
const PEAK_THRESHOLD_FRAC = 0.3;
const MIN_PEAK_GAP_MS = 300;
const FFT_MIN_HZ = 0.2;
const FFT_MAX_HZ = 3.0;

const MUSCLE_GROUPS = [
  'abdomen',
  'arms',
  'back',
  'chest',
  'core',
  'full_body',
  'glutes',
  'legs',
  'shoulders',
  'unknown',
] as const;

const EXERCISE_TYPES = [
  'bodyweight',
  'cardio',
  'compound',
  'isolation',
  'machine',
  'plyometric',
  'unknown',
] as const;

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
type ExerciseType = (typeof EXERCISE_TYPES)[number];

export interface RepCountingMetadata {
  muscleGroup?: MuscleGroup;
  exerciseType?: ExerciseType;
}

interface MotionSample {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  angle: { x: number; y: number; z: number };
}

function smoothEma(values: number[], alpha: number): number[] {
  const out = new Array<number>(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function arrayMin(a: number[]): number {
  let m = a[0];
  for (let i = 1; i < a.length; i++) {
    if (a[i] < m) {
      m = a[i];
    }
  }
  return m;
}

function arrayMax(a: number[]): number {
  let m = a[0];
  for (let i = 1; i < a.length; i++) {
    if (a[i] > m) {
      m = a[i];
    }
  }
  return m;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Simple peak finder: returns indices of local maxima in `signal` that
 * exceed `minHeight` and are at least `minDistance` samples apart.
 * Mirrors scipy.signal.find_peaks behaviour closely enough for feature extraction.
 */
function findPeaks(signal: number[], minHeight: number, minDistance: number): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] >= signal[i + 1] && signal[i] >= minHeight) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      } else if (signal[i] > signal[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
      }
    }
  }
  return peaks;
}

/**
 * Real FFT magnitude (Cooley-Tukey, power-of-two via zero-padding).
 * Returns [frequencies_hz, magnitudes] for the positive half of the spectrum.
 */
function realFft(signal: number[], sampleRateHz: number): [number[], number[]] {
  const n = signal.length;
  // Zero-pad to next power of two
  let size = 1;
  while (size < n) {
    size <<= 1;
  }

  // Build complex array [re, im, re, im, ...]
  const buf = new Float64Array(size * 2);
  for (let i = 0; i < n; i++) {
    buf[i * 2] = signal[i];
  }

  // Cooley-Tukey iterative FFT (in-place, decimation-in-time)
  // Bit-reversal permutation
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      let tmp = buf[i * 2];
      buf[i * 2] = buf[j * 2];
      buf[j * 2] = tmp;
      tmp = buf[i * 2 + 1];
      buf[i * 2 + 1] = buf[j * 2 + 1];
      buf[j * 2 + 1] = tmp;
    }
  }
  // Butterfly stages
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let curRe = 1,
        curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = buf[(i + j) * 2];
        const uIm = buf[(i + j) * 2 + 1];
        const vRe = buf[(i + j + len / 2) * 2] * curRe - buf[(i + j + len / 2) * 2 + 1] * curIm;
        const vIm = buf[(i + j + len / 2) * 2] * curIm + buf[(i + j + len / 2) * 2 + 1] * curRe;
        buf[(i + j) * 2] = uRe + vRe;
        buf[(i + j) * 2 + 1] = uIm + vIm;
        buf[(i + j + len / 2) * 2] = uRe - vRe;
        buf[(i + j + len / 2) * 2 + 1] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  const halfLen = size / 2 + 1;
  const freqs: number[] = [];
  const mags: number[] = [];
  for (let k = 0; k < halfLen; k++) {
    freqs.push((k * sampleRateHz) / size);
    mags.push(Math.sqrt(buf[k * 2] ** 2 + buf[k * 2 + 1] ** 2));
  }
  return [freqs, mags];
}

export function extractRepCountingFeatures(
  samples: MotionSample[],
  metadata: RepCountingMetadata = {}
): number[] {
  const n = samples.length;
  if (n < 10) {
    throw new Error(`Recording too short (${n} samples)`);
  }

  const ts = samples.map((s) => s.timestamp);
  const az = samples.map((s) => s.accel.z);
  const angX = samples.map((s) => s.angle.x);
  const angY = samples.map((s) => s.angle.y);

  const durationMs = ts[n - 1] - ts[0];
  const durationS = durationMs / 1000;
  const sampleRate = durationS > 0 ? n / durationS : 0;

  // Dominant angle axis
  const rx = arrayMax(angX) - arrayMin(angX);
  const ry = arrayMax(angY) - arrayMin(angY);
  const dominantRaw = rx >= ry ? angX : angY;
  const dominantRange = Math.max(rx, ry);
  const nondominantRange = Math.min(rx, ry);

  // EMA smooth → subtract baseline from first 20 samples
  const smoothed = smoothEma(dominantRaw, SMOOTH_ALPHA);
  const baselineWindow = smoothed.slice(0, Math.min(20, n)).sort((a, b) => a - b);
  const baseline = median(baselineWindow);
  const centered = smoothed.map((v) => v - baseline);
  const centeredMin = arrayMin(centered);
  const centeredMax = arrayMax(centered);
  const signalRange = centeredMax - centeredMin;

  // Gyro drift
  const window = Math.max(1, Math.min(20, Math.floor(n * 0.05)));
  const startMean = centered.slice(0, window).reduce((s, v) => s + v, 0) / window;
  const endMean = centered.slice(-window).reduce((s, v) => s + v, 0) / window;
  const drift = Math.abs(endMean - startMean);
  const driftRatio = signalRange > 0 ? drift / signalRange : 0;

  // Peak / valley detection
  let peakCount = 0;
  let valleyCount = 0;
  let medianHalfAmp = 0;
  let stdHalfAmp = 0;

  if (signalRange > 0) {
    const minGap = Math.max(1, Math.round((sampleRate * MIN_PEAK_GAP_MS) / 1000));
    const pkMinH = centeredMin + signalRange * PEAK_THRESHOLD_FRAC;
    const vlMinH = -centeredMax + signalRange * PEAK_THRESHOLD_FRAC;

    const negCentered = centered.map((v) => -v);
    const peaks = findPeaks(centered, pkMinH, minGap);
    const valleys = findPeaks(negCentered, vlMinH, minGap);

    peakCount = peaks.length;
    valleyCount = valleys.length;

    if (peakCount > 0 && valleyCount > 0) {
      const pairs = Math.min(peakCount, valleyCount);
      const halfAmps = Array.from({ length: pairs }, (_, i) =>
        Math.abs(centered[peaks[i]] - centered[valleys[i]])
      ).sort((a, b) => a - b);
      medianHalfAmp = median(halfAmps);
      stdHalfAmp = stdDev(halfAmps);
    }
  }

  // FFT dominant frequency
  let dominantFreqHz = 0;
  let freqEstReps = 0;

  if (n > 10 && sampleRate > 0) {
    const [freqs, mags] = realFft(centered, sampleRate);
    let bestMag = -1;
    for (let k = 0; k < freqs.length; k++) {
      if (freqs[k] >= FFT_MIN_HZ && freqs[k] <= FFT_MAX_HZ && mags[k] > bestMag) {
        bestMag = mags[k];
        dominantFreqHz = freqs[k];
      }
    }
    freqEstReps = dominantFreqHz * durationS;
  }

  // Zero crossings
  let zeroCrossingCount = 0;
  for (let i = 1; i < centered.length; i++) {
    if (Math.sign(centered[i]) !== Math.sign(centered[i - 1]) && centered[i - 1] !== 0) {
      zeroCrossingCount++;
    }
  }

  // Accel Z
  const azSmoothed = smoothEma(az, SMOOTH_ALPHA);
  const azBaselineWindow = azSmoothed.slice(0, Math.min(20, n)).sort((a, b) => a - b);
  const azBaseline = median(azBaselineWindow);
  const azCentered = azSmoothed.map((v) => v - azBaseline);
  const azRange = arrayMax(az) - arrayMin(az);
  const azSigRange = arrayMax(azCentered) - arrayMin(azCentered);
  let azPeakCount = 0;

  if (azSigRange > 0) {
    const azPkMin = arrayMin(azCentered) + azSigRange * PEAK_THRESHOLD_FRAC;
    const azGap = Math.max(1, Math.round(sampleRate * 0.1));
    azPeakCount = findPeaks(azCentered, azPkMin, azGap).length;
  }

  const isAngleFlat = dominantRange <= 5.0 ? 1 : 0;

  // Categorical one-hot encoding
  const mg = (MUSCLE_GROUPS as readonly string[]).includes(metadata.muscleGroup ?? '')
    ? (metadata.muscleGroup as MuscleGroup)
    : 'unknown';
  const et = (EXERCISE_TYPES as readonly string[]).includes(metadata.exerciseType ?? '')
    ? (metadata.exerciseType as ExerciseType)
    : 'unknown';

  const muscleOneHot = MUSCLE_GROUPS.map((g) => (g === mg ? 1 : 0));
  const typeOneHot = EXERCISE_TYPES.map((t) => (t === et ? 1 : 0));

  return [
    durationMs,
    sampleRate,
    dominantRange,
    nondominantRange,
    driftRatio,
    peakCount,
    valleyCount,
    medianHalfAmp,
    stdHalfAmp,
    dominantFreqHz,
    freqEstReps,
    zeroCrossingCount,
    azRange,
    azPeakCount,
    isAngleFlat,
    ...muscleOneHot,
    ...typeOneHot,
  ];
}
