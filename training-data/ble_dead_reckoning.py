"""
Dead-reckoning position estimation from a WT901 BLE recording.

Pipeline (standard "IMU double integration with ZUPT"):
  1. Rotate accelerometer vectors from sensor body frame to world (Earth) frame
     using the Euler angles already produced by the WT901's internal AHRS.
  2. Subtract gravity in the world frame to get linear acceleration.
  3. Detect Zero-Velocity moments via rolling-window variance of |accel| and
     average |gyro| (ZUPT — Zero-velocity UPdaTe).
  4. Double-integrate linear acceleration to velocity then position, forcing
     velocity to zero inside every detected stationary window.
  5. High-pass filter each position axis to remove residual integration drift.

References:
  - "Pedestrian dead reckoning based on motion mode recognition using a smartphone"
  - "Zero-velocity detection — A Bayesian approach to adaptive thresholding"
  - WitMotion WT901BLE protocol docs (Euler order is yaw-pitch-roll, ZYX intrinsic)
"""

from __future__ import annotations

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, filtfilt
from scipy.spatial.transform import Rotation

G_MS2 = 9.80665  # m/s^2 per 1g


def _rolling_std(x: np.ndarray, window: int) -> np.ndarray:
    """Population std over a centred rolling window — fast via uniform_filter1d."""
    mean = uniform_filter1d(x, window, mode="nearest")
    mean_sq = uniform_filter1d(x * x, window, mode="nearest")
    return np.sqrt(np.maximum(0.0, mean_sq - mean * mean))


def _highpass(x: np.ndarray, sr_hz: float, cutoff_hz: float = 0.2) -> np.ndarray:
    """4th-order zero-phase Butterworth high-pass per axis."""
    if sr_hz <= 0 or len(x) < 30 or cutoff_hz <= 0:
        return x
    nyq = 0.5 * sr_hz
    wn = min(0.99, cutoff_hz / nyq)
    b, a = butter(4, wn, btype="highpass")
    return filtfilt(b, a, x, axis=0)


def compute_position(
    samples_sorted: list,
    *,
    zupt_accel_std_g: float = 0.025,
    zupt_gyro_dps: float = 8.0,
    zupt_window_s: float = 0.10,
    hp_cutoff_hz: float = 0.2,
) -> dict:
    """
    Run the dead-reckoning pipeline on a list of samples already sorted by timestamp.

    Each sample must have:
        timestamp (ms, int)
        accel = {x, y, z}  in g
        gyro  = {x, y, z}  in deg/s
        angle = {x=roll, y=pitch, z=yaw} in degrees

    Returns a dict:
        timestamps_ms : (N,)  original sample timestamps (ms)
        position_m    : (N, 3) [x, y, z] in metres, world-frame, drift-corrected
        velocity_ms   : (N, 3) world-frame velocity in m/s
        linear_acc_g  : (N, 3) world-frame linear acceleration in g
        stationary    : (N,)   bool mask of detected ZUPT windows
        sr_hz         : float  effective sample rate
    """
    n = len(samples_sorted)
    if n < 2:
        empty = np.zeros((n, 3))
        return {
            "timestamps_ms": np.array([s["timestamp"] for s in samples_sorted], dtype=float),
            "position_m":    empty,
            "velocity_ms":   empty,
            "linear_acc_g":  empty,
            "stationary":    np.zeros(n, dtype=bool),
            "sr_hz":         0.0,
        }

    ts_ms     = np.array([s["timestamp"] for s in samples_sorted], dtype=float)
    accel_g   = np.array([[s["accel"]["x"], s["accel"]["y"], s["accel"]["z"]] for s in samples_sorted], dtype=float)
    gyro_dps  = np.array([[s["gyro"]["x"],  s["gyro"]["y"],  s["gyro"]["z"]]  for s in samples_sorted], dtype=float)
    angle_deg = np.array([[s["angle"]["x"], s["angle"]["y"], s["angle"]["z"]] for s in samples_sorted], dtype=float)

    duration_s = (ts_ms[-1] - ts_ms[0]) / 1000.0
    sr_hz = n / duration_s if duration_s > 0 else 100.0

    # 1. Rotate body-frame accel into the world frame.
    # WT901 Euler convention: angle.x = roll, angle.y = pitch, angle.z = yaw,
    # applied as ZYX intrinsic. scipy 'ZYX' expects [yaw, pitch, roll].
    euler_zyx = angle_deg[:, [2, 1, 0]]
    rotations = Rotation.from_euler("ZYX", euler_zyx, degrees=True)
    accel_world_g = rotations.apply(accel_g)

    # 2. Subtract gravity. Z is up so at rest accel_world ≈ (0, 0, +1g).
    linear_acc_g = accel_world_g - np.array([0.0, 0.0, 1.0])
    linear_acc_ms2 = linear_acc_g * G_MS2

    # 3. Detect stationary windows (ZUPT).
    win = max(5, int(round(zupt_window_s * sr_hz)))
    if win % 2 == 0:
        win += 1
    accel_mag_g  = np.linalg.norm(accel_g, axis=1)
    gyro_mag_dps = np.linalg.norm(gyro_dps, axis=1)
    accel_std    = _rolling_std(accel_mag_g, win)
    gyro_avg     = uniform_filter1d(gyro_mag_dps, win, mode="nearest")
    stationary   = (accel_std < zupt_accel_std_g) & (gyro_avg < zupt_gyro_dps)

    # 4. Integrate acceleration → velocity → position, resetting velocity to 0
    #    every time we are inside a stationary window.
    dt_s = np.diff(ts_ms) / 1000.0
    dt_s = np.append(dt_s, dt_s[-1] if len(dt_s) else 0.0)
    # Clamp ridiculous gaps so a single dropped batch doesn't blow up the integral.
    dt_s = np.clip(dt_s, 0.0, 0.1)

    velocity = np.zeros((n, 3))
    for i in range(1, n):
        if stationary[i]:
            velocity[i] = 0.0
        else:
            # Trapezoidal step on acceleration
            a_avg = 0.5 * (linear_acc_ms2[i] + linear_acc_ms2[i - 1])
            velocity[i] = velocity[i - 1] + a_avg * dt_s[i]

    position = np.zeros((n, 3))
    for i in range(1, n):
        v_avg = 0.5 * (velocity[i] + velocity[i - 1])
        position[i] = position[i - 1] + v_avg * dt_s[i]

    # 5. High-pass each axis to remove residual drift bias.
    if hp_cutoff_hz > 0:
        position = _highpass(position, sr_hz, hp_cutoff_hz)

    return {
        "timestamps_ms": ts_ms,
        "position_m":    position,
        "velocity_ms":   velocity,
        "linear_acc_g":  linear_acc_g,
        "stationary":    stationary,
        "sr_hz":         sr_hz,
    }
