/**
 * Feature extraction for the ML rep-counting model (repCountingModel.js).
 *
 * Mirrors training-data/train.py extract_features() exactly so the input
 * vector fed to classifySegment() matches what the model was trained on.
 *
 * Input order (45 features):
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
 *  25  equip_barbell
 *  26  equip_bodyweight
 *  27  equip_cable
 *  28  equip_cardio
 *  29  equip_dumbbell
 *  30  equip_kettlebell
 *  31  equip_other
 *  32  equip_plate_machine
 *  33  equip_pneumatic_machine
 *  34  equip_resistance_band
 *  35  equip_smith_machine
 *  36  equip_unknown
 *  37  mechanic_cardio
 *  38  mechanic_compound
 *  39  mechanic_isolation
 *  40  mechanic_mobility
 *  41  mechanic_other
 *  42  mechanic_plyometric
 *  43  mechanic_stretching
 *  44  mechanic_unknown
 */

import mlMax from 'ml-array-max';
import mlMin from 'ml-array-min';
import { FFT } from 'ml-fft';
import { median, standardDeviation } from 'simple-statistics';

import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';

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

const EQUIPMENT_TYPES = [
  'barbell',
  'bodyweight',
  'cable',
  'cardio',
  'dumbbell',
  'kettlebell',
  'other',
  'plate_machine',
  'pneumatic_machine',
  'resistance_band',
  'smith_machine',
  'medicine_ball',
  'unknown',
] as const;

const MECHANIC_TYPES = [
  'cardio',
  'compound',
  'isolation',
  'mobility',
  'other',
  'plyometric',
  'stretching',
  'unknown',
] as const;

export interface RepCountingMetadata {
  muscleGroup?: MuscleGroup | 'unknown';
  equipmentType?: EquipmentType | 'unknown';
  mechanicType?: MechanicType | 'unknown';
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

/**
 * Local-maxima peak finder: returns indices of peaks above minHeight that
 * are at least minDistance samples apart (keeps the taller one when two peaks
 * are too close). Mirrors scipy.signal.find_peaks for our use case.
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

function dominantFrequencyHz(
  signal: number[],
  sampleRateHz: number,
  fMin: number,
  fMax: number
): number {
  const n = signal.length;
  let size = 1;
  while (size < n) {
    size <<= 1;
  }

  const re = new Array<number>(size).fill(0);
  const im = new Array<number>(size).fill(0);
  for (let i = 0; i < n; i++) {
    re[i] = signal[i];
  }

  FFT.init(size);
  FFT.fft(re, im, 1);

  let bestMag = -1;
  let bestFreq = 0;
  const halfLen = size / 2 + 1;
  for (let k = 0; k < halfLen; k++) {
    const freq = (k * sampleRateHz) / size;
    if (freq < fMin || freq > fMax) {
      continue;
    }
    const mag = Math.sqrt(re[k] ** 2 + im[k] ** 2);
    if (mag > bestMag) {
      bestMag = mag;
      bestFreq = freq;
    }
  }
  return bestFreq;
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

  // Dominant angle axis (whichever has the larger range)
  const rx = mlMax(angX) - mlMin(angX);
  const ry = mlMax(angY) - mlMin(angY);
  const dominantRaw = rx >= ry ? angX : angY;
  const dominantRange = Math.max(rx, ry);
  const nondominantRange = Math.min(rx, ry);

  // EMA smooth → subtract median of first 20 samples as baseline
  const smoothed = smoothEma(dominantRaw, SMOOTH_ALPHA);
  const baseline = median(smoothed.slice(0, Math.min(20, n)));
  const centered = smoothed.map((v) => v - baseline);
  const centeredMin = mlMin(centered);
  const centeredMax = mlMax(centered);
  const signalRange = centeredMax - centeredMin;

  // Gyro drift: compare start vs end window means
  const win = Math.max(1, Math.min(20, Math.floor(n * 0.05)));
  const startMean = centered.slice(0, win).reduce((s, v) => s + v, 0) / win;
  const endMean = centered.slice(-win).reduce((s, v) => s + v, 0) / win;
  const driftRatio = signalRange > 0 ? Math.abs(endMean - startMean) / signalRange : 0;

  // Peak / valley detection
  let peakCount = 0;
  let valleyCount = 0;
  let medianHalfAmp = 0;
  let stdHalfAmp = 0;

  if (signalRange > 0) {
    const minGap = Math.max(1, Math.round((sampleRate * MIN_PEAK_GAP_MS) / 1000));
    const pkMinH = centeredMin + signalRange * PEAK_THRESHOLD_FRAC;
    const vlMinH = -centeredMax + signalRange * PEAK_THRESHOLD_FRAC;

    const peaks = findPeaks(centered, pkMinH, minGap);
    const valleys = findPeaks(
      centered.map((v) => -v),
      vlMinH,
      minGap
    );

    peakCount = peaks.length;
    valleyCount = valleys.length;

    if (peakCount > 0 && valleyCount > 0) {
      const pairs = Math.min(peakCount, valleyCount);
      const halfAmps = Array.from({ length: pairs }, (_, i) =>
        Math.abs(centered[peaks[i]] - centered[valleys[i]])
      );
      medianHalfAmp = median(halfAmps);
      stdHalfAmp = halfAmps.length > 1 ? standardDeviation(halfAmps) : 0;
    }
  }

  // FFT dominant frequency (0.2–3 Hz human movement range)
  const dominantFreqHz =
    n > 10 && sampleRate > 0
      ? dominantFrequencyHz(centered, sampleRate, FFT_MIN_HZ, FFT_MAX_HZ)
      : 0;
  const freqEstReps = dominantFreqHz * durationS;

  // Zero crossings
  let zeroCrossingCount = 0;
  for (let i = 1; i < centered.length; i++) {
    if (Math.sign(centered[i]) !== Math.sign(centered[i - 1]) && centered[i - 1] !== 0) {
      zeroCrossingCount++;
    }
  }

  // Accel Z (vertical axis — key for cable/stack machines)
  const azSmoothed = smoothEma(az, SMOOTH_ALPHA);
  const azBaseline = median(azSmoothed.slice(0, Math.min(20, n)));
  const azCentered = azSmoothed.map((v) => v - azBaseline);
  const azRange = mlMax(az) - mlMin(az);
  const azSigRange = mlMax(azCentered) - mlMin(azCentered);
  let azPeakCount = 0;

  if (azSigRange > 0) {
    const azPkMin = mlMin(azCentered) + azSigRange * PEAK_THRESHOLD_FRAC;
    const azGap = Math.max(1, Math.round(sampleRate * 0.1));
    azPeakCount = findPeaks(azCentered, azPkMin, azGap).length;
  }

  // Categorical one-hot encoding
  const mg = (MUSCLE_GROUPS as readonly string[]).includes(metadata.muscleGroup ?? '')
    ? metadata.muscleGroup!
    : 'unknown';
  const eq = (EQUIPMENT_TYPES as readonly string[]).includes(metadata.equipmentType ?? '')
    ? metadata.equipmentType!
    : 'unknown';
  const mt = (MECHANIC_TYPES as readonly string[]).includes(metadata.mechanicType ?? '')
    ? metadata.mechanicType!
    : 'unknown';

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
    dominantRange <= 5.0 ? 1 : 0,
    ...MUSCLE_GROUPS.map((g) => (g === mg ? 1 : 0)),
    ...EQUIPMENT_TYPES.map((t) => (t === eq ? 1 : 0)),
    ...MECHANIC_TYPES.map((t) => (t === mt ? 1 : 0)),
  ];
}
