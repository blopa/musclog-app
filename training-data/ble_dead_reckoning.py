"""
Dead-reckoning position estimation from a WT901 BLE recording.

Pipeline ("INS with ZUPT-aided bias correction" — standard in pedestrian
dead-reckoning and foot-mounted IMU navigation literature):

  1. Rotate body-frame accelerometer vectors into the world (Earth) frame using
     the Euler angles produced by the WT901's onboard AHRS.
       Body axes follow WitMotion convention; angles are applied as
       ZYX intrinsic (yaw → pitch → roll), matching the WT901 datasheet.

  2. Subtract nominal gravity (0, 0, +1g) in the world frame.
     This gives a *biased* linear acceleration: the WT901's AHRS is not
     perfectly calibrated, so even at rest the rotation does not map body
     gravity exactly to world-Z, leaving a residual offset of ~0.05–0.1 g
     in linear_acc. Step 4 removes that.

  3. Detect Zero-Velocity moments (ZUPT) — sliding-window std of |accel|
     and average |gyro|. Standard thresholds (Skog et al., 2010-ish range):
     accel std < ~0.025 g, gyro mean < ~8 deg/s.

  4. Estimate the acceleration bias from the stationary windows. Because
     true linear_acc = 0 inside a stationary window, the mean of measured
     linear_acc over that window IS the bias at that moment. We then
     piecewise-linearly interpolate the bias between stationary windows
     and subtract it from the full trace. This is the dominant correction.

  5. Trapezoidal integration of corrected acceleration → velocity, with
     velocity forced to 0 inside detected stationary windows (classical ZUPT).

  6. Linear velocity-drift correction between consecutive stationary windows.
     The residual integrated velocity at the END of each motion segment
     should be ≈ 0 (entering the next stationary window). Any non-zero
     remainder is treated as the leftover bias-induced ramp and subtracted
     linearly across the motion segment. This is "ZUPT linear correction"
     (Foxlin 2005, Solin et al. 2018).

  7. Trapezoidal integration of corrected velocity → world-frame position.

No high-pass filter is applied — the ZUPT-aided bias correction handles drift
in a physically meaningful way, and an HP filter at the rep frequency (~0.3 Hz)
would attenuate the very signal we want.

References:
  - Foxlin, "Pedestrian tracking with shoe-mounted inertial sensors", 2005
  - Skog et al., "Zero-velocity detection — An algorithm evaluation", 2010
  - Park & Suh, "A zero velocity detection algorithm using inertial sensors
    for pedestrian navigation systems", 2010
  - WitMotion WT901BLE protocol docs (ZYX intrinsic Euler convention)
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.spatial.transform import Rotation

G_MS2 = 9.80665  # m/s^2 per 1g


def _rolling_std(x: np.ndarray, window: int) -> np.ndarray:
    """Population std over a centred rolling window — fast via uniform_filter1d."""
    mean = uniform_filter1d(x, window, mode="nearest")
    mean_sq = uniform_filter1d(x * x, window, mode="nearest")
    return np.sqrt(np.maximum(0.0, mean_sq - mean * mean))


def _find_segments(mask: np.ndarray, min_len: int = 3) -> List[Tuple[int, int]]:
    """
    Return inclusive (start, end) index pairs for every run of True in `mask`.
    Runs shorter than `min_len` samples are discarded (they are usually noise).
    """
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


def _piecewise_linear_bias(
    anchor_idx: np.ndarray,
    anchor_val: np.ndarray,
    n: int,
) -> np.ndarray:
    """
    Linearly interpolate a 3-vector bias signal between `anchor_idx` positions,
    holding the first and last value flat outside the anchor range.
    """
    out = np.zeros((n, 3))
    grid = np.arange(n)
    for j in range(3):
        out[:, j] = np.interp(grid, anchor_idx, anchor_val[:, j])
    return out


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

    Each sample must have:
        timestamp (ms, int)
        accel = {x, y, z}  in g
        gyro  = {x, y, z}  in deg/s
        angle = {x=roll, y=pitch, z=yaw} in degrees

    Returns dict with:
        timestamps_ms : (N,)    sample timestamps (ms)
        position_m    : (N, 3)  world-frame position in metres, drift-corrected
        velocity_ms   : (N, 3)  world-frame velocity in m/s, drift-corrected
        linear_acc_ms2: (N, 3)  world-frame linear acceleration, bias-corrected
        accel_bias_g  : (N, 3)  estimated acceleration bias trace (in g)
        stationary    : (N,)    bool — detected ZUPT windows
        sr_hz         : float   effective sample rate
    """
    n = len(samples_sorted)
    if n < 2:
        empty = np.zeros((n, 3))
        return {
            "timestamps_ms":  np.array([s["timestamp"] for s in samples_sorted], dtype=float),
            "position_m":     empty,
            "velocity_ms":    empty,
            "linear_acc_ms2": empty,
            "accel_bias_g":   empty,
            "stationary":     np.zeros(n, dtype=bool),
            "sr_hz":          0.0,
        }

    ts_ms     = np.array([s["timestamp"] for s in samples_sorted], dtype=float)
    accel_g   = np.array([[s["accel"]["x"], s["accel"]["y"], s["accel"]["z"]] for s in samples_sorted], dtype=float)
    gyro_dps  = np.array([[s["gyro"]["x"],  s["gyro"]["y"],  s["gyro"]["z"]]  for s in samples_sorted], dtype=float)
    angle_deg = np.array([[s["angle"]["x"], s["angle"]["y"], s["angle"]["z"]] for s in samples_sorted], dtype=float)

    duration_s = (ts_ms[-1] - ts_ms[0]) / 1000.0
    sr_hz = n / duration_s if duration_s > 0 else 100.0

    # ── 1. Rotate body → world ──────────────────────────────────────────────
    euler_zyx = angle_deg[:, [2, 1, 0]]
    rotations = Rotation.from_euler("ZYX", euler_zyx, degrees=True)
    accel_world_g = rotations.apply(accel_g)

    # ── 2. Subtract nominal gravity (biased linear_acc) ─────────────────────
    linear_acc_g_biased = accel_world_g - np.array([0.0, 0.0, 1.0])

    # ── 3. ZUPT detection ───────────────────────────────────────────────────
    win = max(5, int(round(zupt_window_s * sr_hz)))
    if win % 2 == 0:
        win += 1
    accel_mag_g  = np.linalg.norm(accel_g, axis=1)
    gyro_mag_dps = np.linalg.norm(gyro_dps, axis=1)
    accel_std    = _rolling_std(accel_mag_g, win)
    gyro_avg     = uniform_filter1d(gyro_mag_dps, win, mode="nearest")
    stationary   = (accel_std < zupt_accel_std_g) & (gyro_avg < zupt_gyro_dps)

    stat_segments = _find_segments(stationary, min_len=min_stationary_samples)

    # ── 4. Acceleration-bias estimation from stationary windows ─────────────
    if len(stat_segments) >= 1:
        anchor_idx = []
        anchor_val = []
        for s, e in stat_segments:
            mid = (s + e) // 2
            anchor_idx.append(mid)
            anchor_val.append(linear_acc_g_biased[s : e + 1].mean(axis=0))
        anchor_val = np.array(anchor_val)

        if anchor_idx[0] > 0:
            anchor_idx = [0] + anchor_idx
            anchor_val = np.vstack([anchor_val[0:1], anchor_val])
        if anchor_idx[-1] < n - 1:
            anchor_idx = anchor_idx + [n - 1]
            anchor_val = np.vstack([anchor_val, anchor_val[-1:]])

        accel_bias_g = _piecewise_linear_bias(np.array(anchor_idx), anchor_val, n)
    else:
        # No stationary window detected — use a single global mean as bias
        accel_bias_g = np.tile(linear_acc_g_biased.mean(axis=0), (n, 1))

    linear_acc_g    = linear_acc_g_biased - accel_bias_g
    linear_acc_ms2  = linear_acc_g * G_MS2

    # ── 5. Velocity integration with ZUPT ───────────────────────────────────
    dt_s = np.diff(ts_ms) / 1000.0
    dt_s = np.append(dt_s, dt_s[-1] if len(dt_s) else 0.0)
    dt_s = np.clip(dt_s, 0.0, 0.1)

    velocity = np.zeros((n, 3))
    for i in range(1, n):
        if stationary[i]:
            velocity[i] = 0.0
        else:
            a_avg = 0.5 * (linear_acc_ms2[i] + linear_acc_ms2[i - 1])
            velocity[i] = velocity[i - 1] + a_avg * dt_s[i]

    # ── 6. Linear velocity-drift correction over each motion segment ────────
    # Between two stationary windows, residual velocity at the end of motion
    # should be ≈ 0. Any leftover is treated as a linear drift and removed.
    if len(stat_segments) >= 2:
        for k in range(len(stat_segments) - 1):
            mot_start = stat_segments[k][1]        # last stationary sample
            mot_end   = stat_segments[k + 1][0]    # first stationary sample of next window
            seg_len = mot_end - mot_start
            if seg_len <= 1:
                continue
            v_residual = velocity[mot_end].copy()  # should be 0
            ramp = (np.arange(seg_len + 1) / seg_len)[:, None] * v_residual[None, :]
            velocity[mot_start : mot_end + 1] -= ramp

    # ── 7. Position integration ─────────────────────────────────────────────
    position = np.zeros((n, 3))
    for i in range(1, n):
        v_avg = 0.5 * (velocity[i] + velocity[i - 1])
        position[i] = position[i - 1] + v_avg * dt_s[i]

    return {
        "timestamps_ms":  ts_ms,
        "position_m":     position,
        "velocity_ms":    velocity,
        "linear_acc_ms2": linear_acc_ms2,
        "accel_bias_g":   accel_bias_g,
        "stationary":     stationary,
        "sr_hz":          sr_hz,
    }
