#!/usr/bin/env python3
"""
Predict the rep count for a single recording and reconcile with the peak
detector to produce per-rep duration estimates.

Usage:
    python predict.py recordings/deadlift.json
    python predict.py /path/to/any_recording.json

Requires output/model.pkl — run train.py first.
"""

import json
import pickle
import sys
from pathlib import Path

import numpy as np
from scipy.signal import detrend as scipy_detrend

ROOT = Path(__file__).parent

RECONCILE_MIN_PEAK_GAP_MS = 300
RECONCILE_MAX_SEEK_ITERATIONS = 30


def reconcile_rep_counts(samples: list, ml_rep_count: int) -> dict:
    """
    Uses the ML rep count as ground truth and bends a simple peak detector to
    match it, producing per-rep duration estimates as a by-product.

    Mirrors the three-stage logic in repAnalysis.ts reconcileRepCounts():
      1. Target seek   — binary-search the peak-height threshold until the
                         detector finds exactly ml_rep_count peaks.
      2. Amplitude pruning — if the seek overshoots, keep the N tallest peaks.
      3. Outlier splitting — if the seek undershoots, split the longest
                             inter-peak gap until the duration array is full.

    Returns {"rep_count": int, "rep_durations_ms": list[float]}.
    """
    from train import smooth_ema, SMOOTH_ALPHA

    target = max(0, round(ml_rep_count))

    if len(samples) < 10 or target == 0:
        return {"rep_count": target, "rep_durations_ms": []}

    n     = len(samples)
    ts    = np.array([s["timestamp"]  for s in samples], dtype=float)
    ang_x = np.array([s["angle"]["x"] for s in samples], dtype=float)
    ang_y = np.array([s["angle"]["y"] for s in samples], dtype=float)

    # Dominant angle axis — same selection rule as train.py / repAnalysis.ts
    rx  = float(ang_x.max() - ang_x.min())
    ry  = float(ang_y.max() - ang_y.min())
    raw = ang_x if rx >= ry else ang_y

    # EMA smooth → subtract median of first 20 samples as baseline
    smoothed     = smooth_ema(raw, SMOOTH_ALPHA)
    baseline     = float(np.median(smoothed[: min(20, n)]))
    centered_raw = smoothed - baseline
    sig_range_raw = float(centered_raw.max() - centered_raw.min())

    # Linear detrend when gyro drift dominates (same 65 % threshold as repAnalysis.ts)
    drift_window = max(1, min(20, int(n * 0.05)))
    drift_ratio  = (
        abs(centered_raw[-drift_window:].mean() - centered_raw[:drift_window].mean())
        / sig_range_raw
        if sig_range_raw > 0
        else 0.0
    )
    centered = scipy_detrend(centered_raw, type="linear") if drift_ratio >= 0.65 else centered_raw

    sig_min   = float(centered.min())
    sig_max   = float(centered.max())
    sig_range = sig_max - sig_min

    if sig_range == 0:
        return {"rep_count": target, "rep_durations_ms": []}

    def find_peaks_at(threshold_fraction: float) -> list:
        threshold = sig_min + sig_range * threshold_fraction
        peaks: list = []
        last_ts = -np.inf
        for i in range(1, n - 1):
            is_peak = centered[i] > centered[i - 1] and centered[i] >= centered[i + 1]
            if is_peak and centered[i] > threshold and ts[i] - last_ts >= RECONCILE_MIN_PEAK_GAP_MS:
                peaks.append((float(ts[i]), float(centered[i])))
                last_ts = ts[i]
        return peaks

    # Stage 1: binary search on threshold fraction ∈ [0, 1]
    lo, hi    = 0.0, 1.0
    best_peaks = find_peaks_at(0.0)

    for _ in range(RECONCILE_MAX_SEEK_ITERATIONS):
        mid   = (lo + hi) / 2
        peaks = find_peaks_at(mid)

        if len(peaks) == target:
            best_peaks = peaks
            break

        if len(peaks) > target:
            lo = mid   # too many → raise threshold to suppress minor peaks
        else:
            hi = mid   # too few  → lower threshold to surface smaller ones

        if abs(len(peaks) - target) < abs(len(best_peaks) - target):
            best_peaks = peaks

    # Stage 2: amplitude pruning — keep the N tallest peaks, re-sort by time
    if len(best_peaks) > target:
        best_peaks = sorted(best_peaks, key=lambda p: -p[1])[:target]
        best_peaks = sorted(best_peaks, key=lambda p:  p[0])

    peak_ts = [p[0] for p in best_peaks]

    if len(peak_ts) < 2:
        return {"rep_count": target, "rep_durations_ms": []}

    raw_durations = [peak_ts[i + 1] - peak_ts[i] for i in range(len(peak_ts) - 1)]

    # Stage 3: outlier splitting — split longest gap until duration count is right
    missing_gaps = target - len(best_peaks)   # = (target−1) − len(raw_durations)
    durations    = list(raw_durations)

    for _ in range(missing_gaps):
        max_idx = max(range(len(durations)), key=lambda i: durations[i])
        half    = durations[max_idx] / 2
        durations[max_idx : max_idx + 1] = [half, half]

    return {"rep_count": target, "rep_durations_ms": durations}


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python predict.py <path-to-recording.json>")

    recording_path = Path(sys.argv[1])
    if not recording_path.exists():
        sys.exit(f"File not found: {recording_path}")

    pkl_path = ROOT / "output" / "model.pkl"
    if not pkl_path.exists():
        sys.exit("output/model.pkl not found — run train.py first.")

    with open(pkl_path, "rb") as f:
        bundle = pickle.load(f)
    model        = bundle["model"]
    feature_cols = bundle["feature_cols"]

    sys.path.insert(0, str(ROOT))
    from train import extract_features, build_categorical_features

    with open(recording_path) as f:
        data = json.load(f)

    samples = data["samples"]
    feats   = extract_features(samples)
    feats["set_number"] = float(data.get("setNumber") or 1)
    build_categorical_features(
        feats,
        str(data.get("muscleGroup")  or "unknown"),
        str(data.get("equipmentType") or "unknown"),
        str(data.get("mechanicType")  or "unknown"),
    )

    x            = [[feats.get(col, 0.0) for col in feature_cols]]
    raw_pred     = float(model.predict(x)[0])
    rounded_pred = round(raw_pred)

    print(f"\nRecording : {recording_path.name}")
    print(f"Samples   : {len(samples)}")
    print(f"Duration  : {feats['duration_ms'] / 1000:.1f}s")
    print(f"ML model  : {rounded_pred} reps  (raw: {raw_pred:.2f})")

    if "reps" in data:
        true_count = int(data["reps"])
        err        = rounded_pred - true_count
        print(f"Ground truth: {true_count} reps  (error: {err:+d})")

    # Reconcile ML count with the peak detector → per-rep durations
    result = reconcile_rep_counts(samples, rounded_pred)
    durs   = result["rep_durations_ms"]

    if durs:
        avg  = sum(durs) / len(durs)
        total = sum(durs)
        print(f"\nPer-rep durations (ML-reconciled):")
        for i, d in enumerate(durs, 1):
            bar = "█" * int(d / 500)   # one block per 0.5 s
            print(f"  Rep {i:>2}: {d / 1000:5.2f}s  {bar}")
        print(f"\n  Avg : {avg  / 1000:.2f}s")
        print(f"  Total working time: {total / 1000:.1f}s")
    else:
        print("\n  (signal too flat to compute rep durations)")

    print()


if __name__ == "__main__":
    main()
