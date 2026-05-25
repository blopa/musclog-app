/**
 * TypeScript port of training-data/train.py + predict.py — Segment-and-Score pipeline.
 *
 * Steps:
 *   1. preprocessTo1d    — unwrap Euler angles, EMA-smooth, Butterworth bandpass all 6 axes,
 *                          select the most periodic axis via spectral concentration score.
 *   2. overSegment       — valley-to-valley / peak-to-peak candidate full-rep segments.
 *   3. extractFeatures   — 41-feature vector per segment (must exactly match Python training).
 *   4. classifySegment   — RandomForestClassifier exported from train.py via m2cgen.
 *   5. detectPhases      — analytical split at the turning point → Phase A / Phase B timing + speed.
 */

import mlMax from 'ml-array-max';
import mlMin from 'ml-array-min';

import { classifySegment } from './repCountingModel';

// ─── Band-pass bounds (see train.py for rationale) ───────────────────────────
const BP_LO_HZ = 0.1;
const BP_HI_HZ = 3.0;

// ─── Over-segmentation constants (mirror train.py exactly) ───────────────────
const OVER_SEG_PROMINENCE_FRAC = 0.03;
const MIN_SEG_DURATION_MS = 300;
const MIN_HALF_REP_MS = 150;

// ─── Categorical lists (sorted, same as Python) ───────────────────────────────
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
];

const EQUIPMENT_TYPES = [
  'barbell',
  'bodyweight',
  'cable',
  'cardio',
  'dumbbell',
  'kettlebell',
  'machine',
  'other',
  'plate_machine',
  'pneumatic_machine',
  'resistance_band',
  'smith_machine',
  'unknown',
];

const MECHANIC_TYPES = [
  'cardio',
  'compound',
  'isolation',
  'mobility',
  'other',
  'plyometric',
  'stretching',
  'unknown',
];

// ─── Chart payload constants ──────────────────────────────────────────────────
// Same logic as visualize_loocv.py: 10 pts per predicted rep, floored here.
const CHART_MIN_SIGNAL_POINTS = 50;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MotionSample {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  angle: { x: number; y: number; z: number };
}

export interface RecordingMetadata {
  muscleGroup?: string;
  equipmentType?: string;
  mechanicType?: string;
  setNumber?: number;
}

export interface PerRepResult {
  index: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  phaseADurationMs: number;
  phaseBDurationMs: number;
  phaseASpeedDps: number;
  phaseBSpeedDps: number;
  classifierConfidence: number;
}

export interface BleSetChartRepAnnotation {
  startS: number;
  turningS: number;
  endS: number;
  phaseADurationMs: number;
  phaseBDurationMs: number;
  phaseASpeedDps: number;
  phaseBSpeedDps: number;
  confidence: number;
}

export interface BleSetChartPayload {
  /** Downsampled preprocessed 1D signal — x in seconds from start, y in signal units */
  signal: { x: number; y: number }[];
  reps: BleSetChartRepAnnotation[];
  yMin: number;
  yMax: number;
  durationS: number;
  /** Approximate JSON byte size of this payload */
  sizeBytes: number;
}

export interface SegmentAndScoreResult {
  predictedReps: number;
  candidateSegments: number;
  classifiedAsRep: number;
  reps: PerRepResult[];
  chartPayload?: BleSetChartPayload;
  error?: string;
}

// ─── Internal segment representation ─────────────────────────────────────────

interface Segment {
  startIdx: number;
  turningIdx: number;
  endIdx: number;
  startTs: number;
  turningTs: number;
  endTs: number;
}

// ─── Array helpers ────────────────────────────────────────────────────────────

function arrArgMax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[best]) {
      best = i;
    }
  }

  return best;
}

function arrArgMin(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[best]) {
      best = i;
    }
  }

  return best;
}

// ─── Step 1a — Butterworth bandpass (2nd-order, bilinear transform) ───────────
//
// Verified against scipy.signal.butter(2, [lo/nyq, hi/nyq], btype='band').
// Pre-warping: Ω = 2*tan(π*f/fs).  Bilinear: s → 2*(z−1)/(z+1).
// Result is always a 4th-order filter: b = [k, 0, −2k, 0, k].

function butterworthBPCoeffs(fl: number, fh: number, fs: number): { b: number[]; a: number[] } {
  const Ol = 2 * Math.tan((Math.PI * fl) / fs);
  const Oh = 2 * Math.tan((Math.PI * fh) / fs);
  const BW = Oh - Ol;
  const w0sq = Ol * Oh;
  const sq2 = Math.SQRT2;

  // Analog BP coefficients (descending s-power, s^4 … s^0)
  const numA: number[] = [0, 0, BW * BW, 0, 0];
  const denA: number[] = [1, sq2 * BW, 2 * w0sq + BW * BW, sq2 * BW * w0sq, w0sq * w0sq];

  // Polynomial multiply (coefficients in ascending powers of z)
  function polyMul(p: number[], q: number[]): number[] {
    const r = new Array<number>(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        r[i + j] += p[i] * q[j];
      }
    }

    return r;
  }

  // Apply bilinear s → 2*(z-1)/(z+1): result = Σ_k coeffs[n-k]*2^k*(z-1)^k*(z+1)^(n-k)
  function bilinear(coeffs: number[]): number[] {
    const n = 4;
    const res = new Float64Array(n + 1);

    // Build (z-1)^k and (z+1)^k tables (ascending z powers)
    const zm1pow: number[][] = [[1]];
    const zp1pow: number[][] = [[1]];
    for (let k = 1; k <= n; k++) {
      zm1pow.push(polyMul(zm1pow[k - 1], [-1, 1]));
      zp1pow.push(polyMul(zp1pow[k - 1], [1, 1]));
    }

    for (let k = 0; k <= n; k++) {
      const ak = coeffs[n - k]; // coefficient of s^k (descending → ascending index)
      if (ak === 0) {
        continue;
      }

      const factor = ak * Math.pow(2, k);
      const term = polyMul(zm1pow[k], zp1pow[n - k]);
      for (let i = 0; i <= n; i++) {
        res[i] += factor * term[i];
      }
    }

    // Ascending → descending z-powers
    return Array.from(res).reverse();
  }

  const bRaw = bilinear(numA);
  const aRaw = bilinear(denA);
  const a0 = aRaw[0];
  return { b: bRaw.map((v) => v / a0), a: aRaw.map((v) => v / a0) };
}

// Direct Form II IIR filter (one pass)
function applyIIR(b: number[], a: number[], x: number[]): number[] {
  const order = Math.max(b.length, a.length) - 1;
  const y = new Array<number>(x.length).fill(0);
  const z = new Array<number>(order).fill(0);

  for (let i = 0; i < x.length; i++) {
    y[i] = b[0] * x[i] + z[0];
    for (let j = 1; j < order; j++) {
      z[j - 1] = b[j] * x[i] - a[j] * y[i] + z[j];
    }

    z[order - 1] = b[order] * x[i] - a[order] * y[i];
  }

  return y;
}

// Zero-phase forward-backward filter (equivalent to scipy filtfilt)
function filtfilt(b: number[], a: number[], x: number[]): number[] {
  const y1 = applyIIR(b, a, x);
  const y2r = applyIIR(b, a, [...y1].reverse());
  return y2r.reverse();
}

// ─── Step 1b — Spectral concentration score (Goertzel DFT) ───────────────────

function spectralScore(signal: number[], sr: number): number {
  const n = signal.length;
  const df = sr / n;

  const loK = Math.max(1, Math.ceil(BP_LO_HZ / df));
  const hiK = Math.min(Math.floor(n / 2), Math.floor(BP_HI_HZ / df));
  if (loK > hiK) {
    return 0;
  }

  let maxPower = 0;
  let totalPower = 0;

  // Goertzel algorithm: O(N) per bin, avoids per-sample trig
  for (let k = loK; k <= hiK; k++) {
    const omega = (2 * Math.PI * k) / n;
    const coeff = 2 * Math.cos(omega);
    let s0 = 0,
      s1 = 0,
      s2 = 0;
    for (let j = 0; j < n; j++) {
      s0 = signal[j] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
    totalPower += power;
    if (power > maxPower) {
      maxPower = power;
    }
  }

  return totalPower > 1e-10 ? maxPower / totalPower : 0;
}

// ─── Step 1c — Preprocessing: select best axis → 1D bandpass-filtered signal ──

function unwrapAxis(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const result = [values[0]];
  for (let i = 1; i < values.length; i++) {
    let diff = values[i] - result[i - 1];
    while (diff > 180) {
      diff -= 360;
    }

    while (diff < -180) {
      diff += 360;
    }

    result.push(result[i - 1] + diff);
  }

  return result;
}

function smoothEMA(values: number[], alpha: number): number[] {
  if (values.length === 0) {
    return [];
  }

  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + (1 - alpha) * out[i - 1]);
  }

  return out;
}

function preprocessTo1d(samples: MotionSample[]): { signal1d: number[]; timestamps: number[] } {
  const ts = samples.map((s) => s.timestamp);
  const n = ts.length;
  const dur = (ts[n - 1] - ts[0]) / 1000;
  const sr = n / Math.max(dur, 1e-6);

  // EMA window ≈ 0.5 % of samples (mirrors Python's Savitzky-Golay smoothing role)
  const win = Math.max(5, Math.round(n * 0.005) | 1); // odd
  const alpha = 2 / (win + 1);

  // Unwrapped Euler angles + raw accelerometer
  const angAxes: number[][] = [
    unwrapAxis(samples.map((s) => s.angle.x)),
    unwrapAxis(samples.map((s) => s.angle.y)),
    unwrapAxis(samples.map((s) => s.angle.z)),
  ];

  const accAxes: number[][] = [
    samples.map((s) => s.accel.x),
    samples.map((s) => s.accel.y),
    samples.map((s) => s.accel.z),
  ];

  const { b, a } = butterworthBPCoeffs(BP_LO_HZ, BP_HI_HZ, sr);

  let bestSig: number[] | null = null;
  let bestScore = -1;

  for (const axisValues of [...angAxes, ...accAxes]) {
    const sm = smoothEMA(axisValues, alpha);
    const bp = filtfilt(b, a, sm);
    const rng = mlMax(bp) - mlMin(bp);
    if (rng < 1e-4) {
      continue;
    }

    const score = spectralScore(bp, sr);
    if (score > bestScore) {
      bestScore = score;
      bestSig = bp;
    }
  }

  if (bestSig === null) {
    const sm = smoothEMA(angAxes[2], alpha);
    bestSig = filtfilt(b, a, sm);
  }

  return { signal1d: bestSig, timestamps: ts };
}

// ─── Step 2 — Over-segmentation ───────────────────────────────────────────────

// Simplified peak detector: local max within a window, with rough prominence check.
function findPeaksLocal(signal: number[], minProminence: number, minDist: number): number[] {
  const peaks: number[] = [];
  const n = signal.length;

  for (let i = 1; i < n - 1; i++) {
    if (signal[i] < signal[i - 1] || signal[i] <= signal[i + 1]) {
      continue;
    }

    // Must be the max within [i-minDist, i+minDist]
    const lo = Math.max(0, i - minDist);
    const hi = Math.min(n - 1, i + minDist);
    let isMax = true;
    for (let j = lo; j <= hi; j++) {
      if (j !== i && signal[j] >= signal[i]) {
        isMax = false;
        break;
      }
    }

    if (!isMax) {
      continue;
    }

    // Rough prominence: depth to nearest valley on each side
    let leftMin = signal[i];
    for (let j = i - 1; j >= lo; j--) {
      if (signal[j] < leftMin) {
        leftMin = signal[j];
      }
    }

    let rightMin = signal[i];
    for (let j = i + 1; j <= hi; j++) {
      if (signal[j] < rightMin) {
        rightMin = signal[j];
      }
    }

    if (signal[i] - Math.max(leftMin, rightMin) >= minProminence) {
      peaks.push(i);
    }
  }

  return peaks;
}

function overSegment(signal1d: number[], timestamps: number[]): Segment[] {
  const sigRange = mlMax(signal1d) - mlMin(signal1d);
  if (sigRange < 1e-3) {
    return [];
  }

  const dur = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  const sr = timestamps.length / Math.max(dur, 1e-6);
  const minProm = sigRange * OVER_SEG_PROMINENCE_FRAC;
  const minDist = Math.max(1, Math.floor((sr * MIN_HALF_REP_MS) / 1000));
  const negSig = signal1d.map((v) => -v);

  const peaks = findPeaksLocal(signal1d, minProm, minDist);
  const valleys = findPeaksLocal(negSig, minProm, minDist);

  function buildSegs(boundaries: number[], isValleyBoundary: boolean): Segment[] {
    const segs: Segment[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const sIdx = boundaries[i];
      const eIdx = boundaries[i + 1];
      if (timestamps[eIdx] - timestamps[sIdx] < MIN_SEG_DURATION_MS) {
        continue;
      }

      const chunk = signal1d.slice(sIdx, eIdx + 1);
      const turnRel = isValleyBoundary ? arrArgMax(chunk) : arrArgMin(chunk);
      const turnIdx = sIdx + turnRel;

      segs.push({
        startIdx: sIdx,
        turningIdx: turnIdx,
        endIdx: eIdx,
        startTs: timestamps[sIdx],
        turningTs: timestamps[turnIdx],
        endTs: timestamps[eIdx],
      });
    }

    return segs;
  }

  const segsV = buildSegs(valleys, true);
  const segsP = buildSegs(peaks, false);

  function durCV(segs: Segment[]): number {
    if (segs.length < 2) {
      return Infinity;
    }

    const durs = segs.map((s) => s.endTs - s.startTs);
    const mean = durs.reduce((a, b) => a + b, 0) / durs.length;
    const std = Math.sqrt(durs.reduce((acc, d) => acc + (d - mean) ** 2, 0) / durs.length);
    return std / (mean + 1e-6);
  }

  if (segsV.length > segsP.length) {
    return segsV;
  }

  if (segsP.length > segsV.length) {
    return segsP;
  }

  return durCV(segsV) <= durCV(segsP) ? segsV : segsP;
}

// ─── Step 3 — Feature extraction (must match Python SEGMENT_FEATURE_COLS exactly) ──

function extractFeatures(
  segIdx: number,
  seg: Segment,
  signal1d: number[],
  timestamps: number[],
  allSegs: Segment[],
  metadata: RecordingMetadata
): number[] {
  const { startIdx: si, endIdx: ei, turningIdx: ti, startTs, endTs } = seg;
  const chunk = signal1d.slice(si, ei + 1);
  const amplitude = mlMax(chunk) - mlMin(chunk);
  const durationMs = endTs - startTs;
  const avgDtS = durationMs / 1000 / Math.max(1, chunk.length - 1);
  const energy = chunk.reduce((acc, v) => acc + v * v, 0) * avgDtS;

  const globalRange = Math.max(mlMax(signal1d) - mlMin(signal1d), 1e-9);

  // Prominence of the turning point (simplified global approximation)
  let prominence: number;
  if (signal1d[ti] >= signal1d[si]) {
    // Turning point is a peak
    let leftMin = Infinity,
      rightMin = Infinity;
    for (let j = 0; j <= ti; j++) {
      if (signal1d[j] < leftMin) {
        leftMin = signal1d[j];
      }
    }

    for (let j = ti; j < signal1d.length; j++) {
      if (signal1d[j] < rightMin) {
        rightMin = signal1d[j];
      }
    }
    prominence = Math.max(0, signal1d[ti] - Math.max(leftMin, rightMin));
  } else {
    // Turning point is a trough
    let leftMax = -Infinity,
      rightMax = -Infinity;
    for (let j = 0; j <= ti; j++) {
      if (signal1d[j] > leftMax) {
        leftMax = signal1d[j];
      }
    }

    for (let j = ti; j < signal1d.length; j++) {
      if (signal1d[j] > rightMax) {
        rightMax = signal1d[j];
      }
    }

    prominence = Math.max(0, Math.min(leftMax, rightMax) - signal1d[ti]);
  }

  // Context features across all segments in this recording
  const allDurs = allSegs.map((sg) => sg.endTs - sg.startTs);
  const medDur = [...allDurs].sort((a, b) => a - b)[Math.floor(allDurs.length / 2)] ?? 1;
  const relAmp = amplitude / globalRange;
  const relDur = durationMs / (medDur || 1);

  let temporalRegularity = 0.5;
  if (allSegs.length > 2) {
    const starts = allSegs.map((sg) => sg.startTs);
    const intervals = starts.slice(1).map((t, i) => t - starts[i]);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const std = Math.sqrt(
      intervals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / intervals.length
    );
    temporalRegularity = 1 / (1 + std / (mean + 1e-6));
  }

  const recStart = timestamps[0];
  const recEnd = timestamps[timestamps.length - 1];
  const positionFrac = (startTs - recStart) / Math.max(1, recEnd - recStart);

  const nbAmps: number[] = [];
  for (const nbIdx of [segIdx - 1, segIdx + 1]) {
    if (nbIdx >= 0 && nbIdx < allSegs.length) {
      const nb = allSegs[nbIdx];
      const nbChunk = signal1d.slice(nb.startIdx, nb.endIdx + 1);
      nbAmps.push(mlMax(nbChunk) - mlMin(nbChunk));
    }
  }

  const neighbourAmpRatio =
    nbAmps.length > 0 ? amplitude / (nbAmps.reduce((a, b) => a + b, 0) / nbAmps.length + 1e-6) : 1;

  const setNumber = Number(metadata.setNumber ?? 1);

  // One-hot categorical (fallback to 'unknown' for unrecognised values)
  const mg = (metadata.muscleGroup ?? 'unknown').toLowerCase();
  const eq = (metadata.equipmentType ?? 'unknown').toLowerCase();
  const mt = (metadata.mechanicType ?? 'unknown').toLowerCase();

  const muscleVec = MUSCLE_GROUPS.map((g) =>
    MUSCLE_GROUPS.includes(mg) ? (g === mg ? 1 : 0) : g === 'unknown' ? 1 : 0
  );
  const equipVec = EQUIPMENT_TYPES.map((e) =>
    EQUIPMENT_TYPES.includes(eq) ? (e === eq ? 1 : 0) : e === 'unknown' ? 1 : 0
  );
  const mechanicVec = MECHANIC_TYPES.map((m) =>
    MECHANIC_TYPES.includes(mt) ? (m === mt ? 1 : 0) : m === 'unknown' ? 1 : 0
  );

  return [
    amplitude,
    durationMs,
    energy,
    prominence,
    relAmp,
    relDur,
    temporalRegularity,
    positionFrac,
    neighbourAmpRatio,
    setNumber,
    ...muscleVec,
    ...equipVec,
    ...mechanicVec,
  ];
}

// ─── Step 4 — Phase detection (analytical) ────────────────────────────────────

function detectPhases(seg: Segment, signal1d: number[], timestamps: number[]) {
  const { startIdx: si, endIdx: ei } = seg;
  const chunk = signal1d.slice(si, ei + 1);

  const peakRel = arrArgMax(chunk);
  const valleyRel = arrArgMin(chunk);
  const peakDisp = Math.abs(chunk[peakRel] - chunk[0]);
  const valleyDisp = Math.abs(chunk[valleyRel] - chunk[0]);
  const turnRel = peakDisp >= valleyDisp ? peakRel : valleyRel;
  const turnIdx = si + turnRel;

  const phaseAMs = timestamps[turnIdx] - timestamps[si];
  const phaseBMs = timestamps[ei] - timestamps[turnIdx];
  const dispA = Math.abs(signal1d[turnIdx] - signal1d[si]);
  const dispB = Math.abs(signal1d[ei] - signal1d[turnIdx]);

  return {
    phaseADurationMs: Math.round(phaseAMs * 10) / 10,
    phaseBDurationMs: Math.round(phaseBMs * 10) / 10,
    phaseASpeedDps: phaseAMs > 0 ? Math.round((dispA / (phaseAMs / 1000)) * 100) / 100 : 0,
    phaseBSpeedDps: phaseBMs > 0 ? Math.round((dispB / (phaseBMs / 1000)) * 100) / 100 : 0,
  };
}

// ─── Chart payload builder ────────────────────────────────────────────────────

function buildBleSetChartPayload(
  signal1d: number[],
  timestamps: number[],
  repPairs: { seg: Segment; conf: number }[],
  reps: PerRepResult[]
): BleSetChartPayload {
  const n = signal1d.length;
  const recStart = timestamps[0];
  const durationS = (timestamps[n - 1] - recStart) / 1000;

  // 10 pts per predicted rep, floored at CHART_MIN_SIGNAL_POINTS
  const maxPts = Math.max(repPairs.length * 10, CHART_MIN_SIGNAL_POINTS);
  const step = Math.max(1, Math.floor(n / maxPts));

  const signal: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += step) {
    signal.push({
      x: +((timestamps[i] - recStart) / 1000).toFixed(3),
      y: +signal1d[i].toFixed(3),
    });
  }

  let yMin = signal1d[0];
  let yMax = signal1d[0];
  for (let i = 1; i < n; i++) {
    if (signal1d[i] < yMin) {
      yMin = signal1d[i];
    }

    if (signal1d[i] > yMax) {
      yMax = signal1d[i];
    }
  }

  const repAnnotations: BleSetChartRepAnnotation[] = repPairs.map(({ seg, conf }, i) => ({
    startS: +((seg.startTs - recStart) / 1000).toFixed(3),
    turningS: +((seg.turningTs - recStart) / 1000).toFixed(3),
    endS: +((seg.endTs - recStart) / 1000).toFixed(3),
    phaseADurationMs: reps[i]?.phaseADurationMs ?? 0,
    phaseBDurationMs: reps[i]?.phaseBDurationMs ?? 0,
    phaseASpeedDps: reps[i]?.phaseASpeedDps ?? 0,
    phaseBSpeedDps: reps[i]?.phaseBSpeedDps ?? 0,
    confidence: +conf.toFixed(3),
  }));

  const payloadWithoutSize = {
    signal,
    reps: repAnnotations,
    yMin: +yMin.toFixed(3),
    yMax: +yMax.toFixed(3),
    durationS: +durationS.toFixed(2),
  };

  return {
    ...payloadWithoutSize,
    sizeBytes: JSON.stringify(payloadWithoutSize).length,
  };
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

export function segmentAndScore(
  samples: MotionSample[],
  metadata: RecordingMetadata = {},
  generatePayload: boolean = false
): SegmentAndScoreResult {
  if (samples.length < 20) {
    return {
      predictedReps: 0,
      candidateSegments: 0,
      classifiedAsRep: 0,
      reps: [],
      error: `Recording too short (${samples.length} samples)`,
    };
  }

  const { signal1d, timestamps } = preprocessTo1d(samples);
  const allSegs = overSegment(signal1d, timestamps);

  if (allSegs.length === 0) {
    return {
      predictedReps: 0,
      candidateSegments: 0,
      classifiedAsRep: 0,
      reps: [],
      error: 'No segments found (motion too small?)',
    };
  }

  const repPairs: { seg: Segment; conf: number }[] = [];

  for (let i = 0; i < allSegs.length; i++) {
    const features = extractFeatures(i, allSegs[i], signal1d, timestamps, allSegs, metadata);
    const probs = classifySegment(features);
    if (probs[1] > 0.5) {
      repPairs.push({ seg: allSegs[i], conf: probs[1] });
    }
  }

  repPairs.sort((a, b) => a.seg.startTs - b.seg.startTs);

  const recStart = timestamps[0];
  const reps: PerRepResult[] = repPairs.map(({ seg, conf }, i) => {
    const phases = detectPhases(seg, signal1d, timestamps);
    return {
      index: i + 1,
      startMs: Math.round((seg.startTs - recStart) * 10) / 10,
      endMs: Math.round((seg.endTs - recStart) * 10) / 10,
      durationMs: Math.round((seg.endTs - seg.startTs) * 10) / 10,
      ...phases,
      classifierConfidence: Math.round(conf * 1000) / 1000,
    };
  });

  const chartPayload = generatePayload
    ? buildBleSetChartPayload(signal1d, timestamps, repPairs, reps)
    : undefined;

  return {
    predictedReps: reps.length,
    candidateSegments: allSegs.length,
    classifiedAsRep: reps.length,
    reps,
    chartPayload,
  };
}
