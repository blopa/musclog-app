"""
Dead-reckoning position estimation from a WT901 BLE recording.

Every numeric step is delegated to a published library — the only project-local
code is index bookkeeping (finding runs of True, anchoring the bias estimate,
spreading the residual velocity linearly across each motion segment).

  Step                                        Library function used
  ─────────────────────────────────────────── ─────────────────────────────────
  1. Orientation from raw accel + gyro        ahrs.filters.Madgwick
     (Madgwick, S. O. H., 2010; widely cited
      published algorithm)
  2. Quaternion → rotation                    scipy.spatial.transform.Rotation
  3. Rolling mean / std for ZUPT detection    scipy.ndimage.uniform_filter1d
  4. Bias interpolation between rests         numpy.interp
  5. Velocity = ∫ accel dt                    scipy.integrate.cumulative_trapezoid
  6. Position = ∫ velocity dt                 scipy.integrate.cumulative_trapezoid

References:
  - Madgwick, "An efficient orientation filter for inertial and
    inertial/magnetic sensor arrays", 2010.
  - Skog, Händel, Nilsson, Rantakokko, "Zero-velocity detection — An
    algorithm evaluation", IEEE Trans. Biomed. Eng., 2010.
  - Foxlin, "Pedestrian tracking with shoe-mounted inertial sensors",
    IEEE Computer Graphics & Applications, 2005.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
from ahrs.filters import Madgwick
from scipy.integrate import cumulative_trapezoid
from scipy.ndimage import uniform_filter1d
from scipy.spatial.transform import Rotation

G_MS2 = 9.80665  # m/s^2 per 1 g


def _runs_of_true(mask: np.ndarray, min_len: int = 3) -> List[Tuple[int, int]]:
    """Inclusive (start, end) index pairs for every run of True in `mask`."""
    if not mask.any():
        return []
    diff = np.diff(mask.astype(np.int8))
    starts = list(np.where(diff == 1)[0] + 1)
    ends = list(np.where(diff == -1)[0])
    if mask[0]:
        starts.insert(0, 0)
    if mask[-1]:
        ends.append(len(mask) - 1)
    return [(s, e) for s, e in zip(starts, ends) if e - s + 1 >= min_len]


def compute_position(
    samples_sorted: list,
    *,
    zupt_accel_std_g: float = 0.025,
    zupt_gyro_dps: float = 8.0,
    zupt_window_s: float = 0.10,
    min_stationary_samples: int = 5,
) -> dict:
    """
    Run the dead-reckoning pipeline on a list of samples already sorted by timestamp.
    See module docstring for the algorithm and library mapping.

    Returns a dict with ``timestamps_ms``, ``position_m`` (N,3), ``velocity_ms``,
    ``linear_acc_ms2``, ``accel_bias_g``, ``stationary``, ``sr_hz``, ``orientation_q``.
    """
    n = len(samples_sorted)
    if n < 2:
        z = np.zeros((n, 3))
        return {
            "timestamps_ms":  np.array([s["timestamp"] for s in samples_sorted], dtype=float),
            "position_m":     z, "velocity_ms": z, "linear_acc_ms2": z, "accel_bias_g": z,
            "stationary":     np.zeros(n, dtype=bool), "sr_hz": 0.0,
            "orientation_q":  np.zeros((n, 4)),
        }

    ts_ms     = np.array([s["timestamp"] for s in samples_sorted], dtype=float)
    accel_g   = np.array([[s["accel"]["x"], s["accel"]["y"], s["accel"]["z"]] for s in samples_sorted], dtype=float)
    gyro_dps  = np.array([[s["gyro"]["x"],  s["gyro"]["y"],  s["gyro"]["z"]]  for s in samples_sorted], dtype=float)

    t_s = (ts_ms - ts_ms[0]) / 1000.0
    sr_hz = (n - 1) / t_s[-1] if t_s[-1] > 0 else 100.0

    # ── 1. Orientation: Madgwick filter on raw accel + gyro ─────────────────
    # ahrs.filters.Madgwick expects accel in m/s² and gyro in rad/s and
    # returns quaternions in [w, x, y, z] order (Hamilton convention).
    madg   = Madgwick(gyr=np.deg2rad(gyro_dps), acc=accel_g * G_MS2, frequency=sr_hz)
    q_wxyz = madg.Q

    # ── 2. Body → world rotation via scipy (needs [x, y, z, w] order) ───────
    q_xyzw    = np.roll(q_wxyz, -1, axis=1)
    rotations = Rotation.from_quat(q_xyzw)
    accel_world_g = rotations.apply(accel_g)

    # Subtract nominal gravity; any residual is the bias step 4 will absorb.
    linear_acc_g_biased = accel_world_g - np.array([0.0, 0.0, 1.0])

    # ── 3. ZUPT detection: Skog-style threshold on rolling |accel| std + |gyro| mean ─
    win = max(5, int(round(zupt_window_s * sr_hz)) | 1)  # force odd
    accel_mag = np.linalg.norm(accel_g, axis=1)
    gyro_mag  = np.linalg.norm(gyro_dps, axis=1)
    accel_mean    = uniform_filter1d(accel_mag,             win, mode="nearest")
    accel_mean_sq = uniform_filter1d(accel_mag * accel_mag, win, mode="nearest")
    accel_std     = np.sqrt(np.maximum(0.0, accel_mean_sq - accel_mean ** 2))
    gyro_avg      = uniform_filter1d(gyro_mag, win, mode="nearest")
    stationary    = (accel_std < zupt_accel_std_g) & (gyro_avg < zupt_gyro_dps)

    stat_segments = _runs_of_true(stationary, min_len=min_stationary_samples)

    # ── 4. Bias = mean(linear_acc) inside each stationary window, np.interp between ──
    if stat_segments:
        anchor_idx = np.array([(s + e) // 2 for s, e in stat_segments])
        anchor_val = np.array([linear_acc_g_biased[s : e + 1].mean(axis=0) for s, e in stat_segments])
        accel_bias_g = np.column_stack([
            np.interp(np.arange(n), anchor_idx, anchor_val[:, j]) for j in range(3)
        ])
    else:
        accel_bias_g = np.tile(linear_acc_g_biased.mean(axis=0), (n, 1))

    linear_acc_ms2 = (linear_acc_g_biased - accel_bias_g) * G_MS2

    # ── 5. Velocity = ∫ linear_acc dt + ZUPT ────────────────────────────────
    velocity = cumulative_trapezoid(linear_acc_ms2, t_s, axis=0, initial=0.0)
    velocity[stationary] = 0.0

    # Linear-ramp residual correction across each motion segment.
    for k in range(len(stat_segments) - 1):
        a = stat_segments[k][1]
        b = stat_segments[k + 1][0]
        seg_len = b - a
        if seg_len > 1:
            ramp = np.linspace(0.0, 1.0, seg_len + 1)[:, None]
            velocity[a : b + 1] -= ramp * velocity[b]

    # ── 6. Position = ∫ velocity dt ─────────────────────────────────────────
    position = cumulative_trapezoid(velocity, t_s, axis=0, initial=0.0)

    return {
        "timestamps_ms":  ts_ms,
        "position_m":     position,
        "velocity_ms":    velocity,
        "linear_acc_ms2": linear_acc_ms2,
        "accel_bias_g":   accel_bias_g,
        "stationary":     stationary,
        "sr_hz":          sr_hz,
        "orientation_q":  q_wxyz,
    }
