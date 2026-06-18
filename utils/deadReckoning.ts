/**
 * Dead-reckoning position estimation from a WT901 BLE recording.
 *
 * Faithful TypeScript port of `training-data/ble_dead_reckoning.py` (verified to
 * match its `compute_position` output to ~1e-5 m on real recordings). Used by the
 * web Rep Marker tool to chart world-frame position so rep boundaries are visible
 * alongside the video.
 *
 *   Step                                         Python reference
 *   ──────────────────────────────────────────── ──────────────────────────────
 *   1. Orientation from raw accel + gyro          ahrs.filters.Madgwick (gain 0.033)
 *   2. Quaternion → world-frame rotation          scipy.spatial.transform.Rotation
 *   3. Rolling mean / std for ZUPT detection       scipy.ndimage.uniform_filter1d
 *   4. Bias interpolation between rests            numpy.interp
 *   5. Velocity = ∫ accel dt (+ ZUPT)              scipy.integrate.cumulative_trapezoid
 *   6. Position = ∫ velocity dt                    scipy.integrate.cumulative_trapezoid
 *
 * The Madgwick step uses the `ahrs` npm package. We seed its initial attitude from
 * the first accelerometer sample via `init(ax, ay, az, 1, 0, 0)` (a synthetic
 * world-X magnetometer yields heading 0), reproducing the Python `acc2q`
 * initialisation so gravity lands on world +Z from the very first sample.
 *
 * References:
 *   - Madgwick (2010), "An efficient orientation filter for inertial sensor arrays".
 *   - Skog et al. (2010), "Zero-velocity detection — An algorithm evaluation".
 */

import AHRS from 'ahrs';

const G_MS2 = 9.80665; // m/s² per 1 g
const DEG2RAD = Math.PI / 180;
const MADGWICK_GAIN = 0.033; // ahrs.filters.Madgwick IMU default

export interface DeadReckoningSample {
  timestamp: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  /**
   * Device-fused Euler orientation (degrees), as emitted by the WT901. Ignored by
   * the dead-reckoning math here, but carried through so callers can chart it: it
   * is drift-corrected on-device and shows reps far more clearly than the
   * doubly-integrated position for rotational movements.
   */
  angle?: { x: number; y: number; z: number };
}

export interface DeadReckoningResult {
  /** Sorted sample timestamps (ms). */
  timestampsMs: number[];
  /** World-frame position per axis (metres), aligned with `timestampsMs`. */
  px: number[];
  py: number[];
  pz: number[];
  /** Raw accelerometer magnitude (g) — drift-free reference channel. */
  accelMagG: number[];
  /** Per-sample zero-velocity (stationary) flag. */
  stationary: boolean[];
  srHz: number;
}

interface ZuptOptions {
  zuptAccelStdG?: number;
  zuptGyroDps?: number;
  zuptWindowS?: number;
  minStationarySamples?: number;
}

/** Active rotation of vector `v` by quaternion `q` — matches scipy `Rotation.apply`. */
function rotateByQuat(
  vx: number,
  vy: number,
  vz: number,
  q: { w: number; x: number; y: number; z: number }
): [number, number, number] {
  const { w, x, y, z } = q;
  // v' = v + 2w(u×v) + 2(u×(u×v)), with u = (x, y, z)
  const cx = y * vz - z * vy;
  const cy = z * vx - x * vz;
  const cz = x * vy - y * vx;
  const ccx = y * cz - z * cy;
  const ccy = z * cx - x * cz;
  const ccz = x * cy - y * cx;
  return [vx + 2 * (w * cx + ccx), vy + 2 * (w * cy + ccy), vz + 2 * (w * cz + ccz)];
}

/** Centred moving average, odd window, edge mode "nearest" — matches scipy uniform_filter1d. */
function uniformFilter1d(arr: number[], win: number): number[] {
  const n = arr.length;
  const half = (win - 1) >> 1;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) {
      let j = i + k;
      if (j < 0) {
        j = 0;
      } else if (j >= n) {
        j = n - 1;
      }
      sum += arr[j];
    }
    out[i] = sum / win;
  }
  return out;
}

/** Inclusive [start, end] index pairs for every run of `true` at least `minLen` long. */
function runsOfTrue(mask: boolean[], minLen: number): [number, number][] {
  const segments: [number, number][] = [];
  let i = 0;
  while (i < mask.length) {
    if (mask[i]) {
      let j = i;
      while (j + 1 < mask.length && mask[j + 1]) {
        j++;
      }
      if (j - i + 1 >= minLen) {
        segments.push([i, j]);
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return segments;
}

/** Linear interpolation matching numpy.interp (clamps to endpoints; `xp` ascending). */
function interp(xq: number[], xp: number[], fp: number[]): number[] {
  const out = new Array<number>(xq.length);
  const last = xp.length - 1;
  for (let i = 0; i < xq.length; i++) {
    const x = xq[i];
    if (x <= xp[0]) {
      out[i] = fp[0];
      continue;
    }
    if (x >= xp[last]) {
      out[i] = fp[last];
      continue;
    }
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xp[mid] <= x) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const t = (x - xp[lo]) / (xp[hi] - xp[lo]);
    out[i] = fp[lo] + t * (fp[hi] - fp[lo]);
  }
  return out;
}

/** Cumulative trapezoidal integral with leading 0 — matches scipy cumulative_trapezoid(initial=0). */
function cumtrapz(y: number[], t: number[]): number[] {
  const out = new Array<number>(y.length);
  out[0] = 0;
  let acc = 0;
  for (let i = 1; i < y.length; i++) {
    acc += 0.5 * (y[i] + y[i - 1]) * (t[i] - t[i - 1]);
    out[i] = acc;
  }
  return out;
}

/**
 * Run the dead-reckoning pipeline on raw IMU samples. Samples are sorted by
 * timestamp internally (BLE batches can arrive slightly out of order).
 */
export function computePosition(
  rawSamples: DeadReckoningSample[],
  options: ZuptOptions = {}
): DeadReckoningResult {
  const {
    minStationarySamples = 5,
    zuptAccelStdG = 0.025,
    zuptGyroDps = 8.0,
    zuptWindowS = 0.1,
  } = options;

  const samples = rawSamples.slice().sort((a, b) => a.timestamp - b.timestamp);
  const n = samples.length;

  if (n < 2) {
    const zeros = new Array<number>(n).fill(0);
    return {
      accelMagG: samples.map((s) => Math.hypot(s.accel.x, s.accel.y, s.accel.z)),
      px: zeros.slice(),
      py: zeros.slice(),
      pz: zeros.slice(),
      srHz: 0,
      stationary: new Array<boolean>(n).fill(false),
      timestampsMs: samples.map((s) => s.timestamp),
    };
  }

  const tsMs = samples.map((s) => s.timestamp);
  const t0 = tsMs[0];
  const tSec = tsMs.map((t) => (t - t0) / 1000);
  const srHz = tSec[n - 1] > 0 ? (n - 1) / tSec[n - 1] : 100;

  // ── 1. Orientation: Madgwick on raw accel + gyro, seeded from first accel ──
  // `init` exists at runtime (copied onto the instance) but is missing from the
  // package's bundled types; a synthetic world-X magnetometer yields heading 0,
  // so this reproduces the Python `acc2q` attitude initialisation.
  const ahrs = new AHRS({
    algorithm: 'Madgwick',
    beta: MADGWICK_GAIN,
    sampleInterval: 1000 / srHz,
  }) as AHRS & {
    init: (ax: number, ay: number, az: number, mx: number, my: number, mz: number) => void;
  };
  ahrs.init(samples[0].accel.x, samples[0].accel.y, samples[0].accel.z, 1, 0, 0);

  // ── 2./3./4. accumulate world-frame linear accel (g) and ZUPT signals ──
  const linGx = new Array<number>(n);
  const linGy = new Array<number>(n);
  const linGz = new Array<number>(n);
  const accelMagG = new Array<number>(n);
  const gyroMagDps = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const { accel, gyro } = samples[i];
    ahrs.update(gyro.x * DEG2RAD, gyro.y * DEG2RAD, gyro.z * DEG2RAD, accel.x, accel.y, accel.z);
    const q = ahrs.getQuaternion();
    const [wx, wy, wz] = rotateByQuat(accel.x, accel.y, accel.z, q);
    // Subtract nominal gravity; any residual is the bias step 4 will absorb.
    linGx[i] = wx;
    linGy[i] = wy;
    linGz[i] = wz - 1.0;
    accelMagG[i] = Math.hypot(accel.x, accel.y, accel.z);
    gyroMagDps[i] = Math.hypot(gyro.x, gyro.y, gyro.z);
  }

  // ── 3. ZUPT detection: rolling |accel| std + rolling |gyro| mean ──
  const win = Math.max(5, Math.round(zuptWindowS * srHz) | 1); // force odd
  const accelMean = uniformFilter1d(accelMagG, win);
  const accelMeanSq = uniformFilter1d(
    accelMagG.map((v) => v * v),
    win
  );
  const gyroAvg = uniformFilter1d(gyroMagDps, win);
  const stationary = new Array<boolean>(n);
  for (let i = 0; i < n; i++) {
    const std = Math.sqrt(Math.max(0, accelMeanSq[i] - accelMean[i] * accelMean[i]));
    stationary[i] = std < zuptAccelStdG && gyroAvg[i] < zuptGyroDps;
  }

  const statSegments = runsOfTrue(stationary, minStationarySamples);

  // ── 4. Bias = mean(linear accel) inside each rest, np.interp between anchors ──
  const linG = [linGx, linGy, linGz];
  const bias: number[][] = [];
  if (statSegments.length > 0) {
    const anchorIdx = statSegments.map(([s, e]) => (s + e) >> 1);
    const allIdx = Array.from({ length: n }, (_, i) => i);
    for (let axis = 0; axis < 3; axis++) {
      const anchorVal = statSegments.map(([s, e]) => {
        let sum = 0;
        for (let k = s; k <= e; k++) {
          sum += linG[axis][k];
        }
        return sum / (e - s + 1);
      });
      bias.push(interp(allIdx, anchorIdx, anchorVal));
    }
  } else {
    for (let axis = 0; axis < 3; axis++) {
      let mean = 0;
      for (let i = 0; i < n; i++) {
        mean += linG[axis][i];
      }
      mean /= n;
      bias.push(new Array<number>(n).fill(mean));
    }
  }

  // ── 5. Velocity = ∫ (linear accel − bias) dt + ZUPT ──
  const position: number[][] = [];
  for (let axis = 0; axis < 3; axis++) {
    const linMs2 = linG[axis].map((v, i) => (v - bias[axis][i]) * G_MS2);
    const velocity = cumtrapz(linMs2, tSec);
    for (let i = 0; i < n; i++) {
      if (stationary[i]) {
        velocity[i] = 0;
      }
    }
    // Linear-ramp residual correction across each motion segment (kept for
    // fidelity with the Python reference; velocity[b] is already zeroed there).
    for (let k = 0; k < statSegments.length - 1; k++) {
      const a = statSegments[k][1];
      const b = statSegments[k + 1][0];
      const segLen = b - a;
      if (segLen > 1) {
        const vb = velocity[b];
        for (let i = 0; i <= segLen; i++) {
          velocity[a + i] -= (i / segLen) * vb;
        }
      }
    }
    // ── 6. Position = ∫ velocity dt ──
    position.push(cumtrapz(velocity, tSec));
  }

  return {
    accelMagG,
    px: position[0],
    py: position[1],
    pz: position[2],
    srHz,
    stationary,
    timestampsMs: tsMs,
  };
}
