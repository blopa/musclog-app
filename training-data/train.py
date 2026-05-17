#!/usr/bin/env python3
"""
Rep counting model trainer.

Reads labeled motion recordings, extracts signal features, trains two
model types side-by-side, evaluates both with leave-one-out cross-
validation (the right strategy for small datasets), then exports the
better one to JavaScript via m2cgen.

Usage:
    python train.py

Input:
    labels.csv          — ground truth: filename + rep_count
    recordings/*.json   — motion sensor recordings

Output:
    output/features.csv — extracted feature matrix (for inspection)
    output/model.pkl    — trained sklearn model  (used by predict.py)
    output/model.js     — same model as a JS function (for app later)
    output/summary.txt  — evaluation report
"""

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import signal as scipy_signal
from scipy.fft import rfft, rfftfreq
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import LeaveOneOut
import m2cgen as m2c

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent
RECORDINGS_DIR = ROOT / "recordings"
LABELS_FILE = ROOT / "labels.csv"
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Signal-processing constants — kept in sync with the app's repAnalysis.ts
# ---------------------------------------------------------------------------
SMOOTH_ALPHA = 0.15        # EMA smoothing factor
PEAK_THRESHOLD_FRAC = 0.30 # minimum peak height as fraction of signal range
MIN_PEAK_GAP_MS = 300      # minimum time between peaks (ms)
FFT_MIN_HZ = 0.2           # lower bound for human movement frequency
FFT_MAX_HZ = 3.0           # upper bound for human movement frequency

# ---------------------------------------------------------------------------
# Categorical metadata — fixed lists so the one-hot feature vector size is
# always the same regardless of which exercises appear in a training run.
# "unknown" is a valid value for recordings where the exercise isn't identified.
# ---------------------------------------------------------------------------
MUSCLE_GROUPS = sorted([
    "abdomen", "arms", "back", "chest", "core",
    "full_body", "glutes", "legs", "shoulders", "unknown",
])
EXERCISE_TYPES = sorted([
    "bodyweight", "cardio", "compound", "isolation",
    "machine", "plyometric", "unknown",
])

# ---------------------------------------------------------------------------
# Feature names — order matters: this list defines the model's input vector.
# Signal features come first; one-hot categoricals follow.
# ---------------------------------------------------------------------------
_SIGNAL_FEATURES = [
    "duration_ms",           # total recording length
    "sample_rate_hz",        # sensor sampling rate
    "dominant_range_deg",    # full range of the main angle axis (x or y)
    "nondominant_range_deg", # range of the other angle axis
    "drift_ratio",           # gyro drift: how much the signal drifts end-to-end
    "peak_count",            # number of peaks detected in the angle signal
    "valley_count",          # number of valleys detected
    "median_half_amp_deg",   # typical peak-to-valley distance (half a rep)
    "std_half_amp_deg",      # variability of half-amplitudes
    "dominant_freq_hz",      # main oscillation frequency from FFT
    "freq_est_reps",         # dominant_freq_hz × duration_s (frequency-based rep estimate)
    "zero_crossing_count",   # number of zero-crossings (≈ 2 × rep count for clean signals)
    "accel_z_range",         # range of vertical acceleration (important for cable machines)
    "accel_z_peak_count",    # peaks in vertical acceleration
    "is_angle_flat",         # 1 if angle barely moves (cable/stack machine indicator)
]
_CATEGORICAL_FEATURES = (
    [f"muscle_{g}" for g in MUSCLE_GROUPS]   # one-hot: muscle group
    + [f"type_{t}" for t in EXERCISE_TYPES]  # one-hot: exercise type
)
FEATURE_COLS = _SIGNAL_FEATURES + _CATEGORICAL_FEATURES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def smooth_ema(values: np.ndarray, alpha: float) -> np.ndarray:
    out = np.empty_like(values, dtype=float)
    out[0] = values[0]
    for i in range(1, len(values)):
        out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
    return out


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------
def extract_features(samples: list) -> dict:
    """
    Turn a raw list of motion samples into a fixed-size numeric feature vector.

    Each sample is expected to have the shape:
        { timestamp, accel: {x,y,z}, gyro: {x,y,z}, angle: {x,y,z} }
    """
    n = len(samples)
    if n < 10:
        raise ValueError(f"Recording too short ({n} samples)")

    ts    = np.array([s["timestamp"]  for s in samples], dtype=float)
    az    = np.array([s["accel"]["z"] for s in samples], dtype=float)
    ang_x = np.array([s["angle"]["x"] for s in samples], dtype=float)
    ang_y = np.array([s["angle"]["y"] for s in samples], dtype=float)

    duration_ms = float(ts[-1] - ts[0])
    duration_s  = duration_ms / 1000.0
    sample_rate = n / duration_s if duration_s > 0 else 0.0

    # ── Dominant angle axis (whichever has the larger range) ────────────────
    rx = float(ang_x.max() - ang_x.min())
    ry = float(ang_y.max() - ang_y.min())
    dominant_raw      = ang_x if rx >= ry else ang_y
    dominant_range    = max(rx, ry)
    nondominant_range = min(rx, ry)

    # ── EMA smooth → subtract floor-median of first 20 samples ─────────────
    smoothed     = smooth_ema(dominant_raw, SMOOTH_ALPHA)
    baseline     = float(np.median(smoothed[: min(20, n)]))
    centered     = smoothed - baseline
    signal_range = float(centered.max() - centered.min())

    # ── Gyro drift: compare start window vs end window ─────────────────────
    window      = max(1, min(20, int(n * 0.05)))
    drift       = float(abs(centered[-window:].mean() - centered[:window].mean()))
    drift_ratio = drift / signal_range if signal_range > 0 else 0.0

    # ── Peak / valley detection on the angle signal ─────────────────────────
    peak_count = valley_count = 0
    median_half_amp = std_half_amp = 0.0

    if signal_range > 0:
        min_gap      = max(1, int(sample_rate * MIN_PEAK_GAP_MS / 1000))
        pk_min_h     = float(centered.min() + signal_range * PEAK_THRESHOLD_FRAC)
        vl_min_h     = float(-centered.max() + signal_range * PEAK_THRESHOLD_FRAC)

        peaks,   _ = scipy_signal.find_peaks(centered,  height=pk_min_h, distance=min_gap)
        valleys, _ = scipy_signal.find_peaks(-centered, height=vl_min_h, distance=min_gap)

        peak_count   = len(peaks)
        valley_count = len(valleys)

        if peak_count > 0 and valley_count > 0:
            pairs     = min(peak_count, valley_count)
            half_amps = np.abs(centered[peaks[:pairs]] - centered[valleys[:pairs]])
            median_half_amp = float(np.median(half_amps))
            std_half_amp    = float(np.std(half_amps))

    # ── FFT: find dominant frequency in the human-movement range (0.2–3 Hz) ─
    dominant_freq_hz = 0.0
    freq_est_reps    = 0.0

    if n > 10 and sample_rate > 0:
        freqs   = rfftfreq(n, d=1.0 / sample_rate)
        fft_mag = np.abs(rfft(centered))
        mask    = (freqs >= FFT_MIN_HZ) & (freqs <= FFT_MAX_HZ)
        if mask.any():
            dominant_freq_hz = float(freqs[mask][np.argmax(fft_mag[mask])])
            freq_est_reps    = dominant_freq_hz * duration_s

    # ── Zero crossings ──────────────────────────────────────────────────────
    zero_crossing_count = int(np.sum(np.diff(np.sign(centered)) != 0))

    # ── Accel Z (vertical axis — the key signal for cable/stack machines) ───
    az_smoothed = smooth_ema(az, SMOOTH_ALPHA)
    az_baseline = float(np.median(az_smoothed[: min(20, n)]))
    az_centered = az_smoothed - az_baseline
    az_range    = float(az.max() - az.min())
    az_sig_rng  = float(az_centered.max() - az_centered.min())
    az_peak_count = 0

    if az_sig_rng > 0:
        az_pk_min = float(az_centered.min() + az_sig_rng * PEAK_THRESHOLD_FRAC)
        az_gap    = max(1, int(sample_rate * 0.1))
        az_pks, _ = scipy_signal.find_peaks(az_centered, height=az_pk_min, distance=az_gap)
        az_peak_count = len(az_pks)

    return {
        "duration_ms":           duration_ms,
        "sample_rate_hz":        sample_rate,
        "dominant_range_deg":    dominant_range,
        "nondominant_range_deg": nondominant_range,
        "drift_ratio":           drift_ratio,
        "peak_count":            float(peak_count),
        "valley_count":          float(valley_count),
        "median_half_amp_deg":   median_half_amp,
        "std_half_amp_deg":      std_half_amp,
        "dominant_freq_hz":      dominant_freq_hz,
        "freq_est_reps":         freq_est_reps,
        "zero_crossing_count":   float(zero_crossing_count),
        "accel_z_range":         az_range,
        "accel_z_peak_count":    float(az_peak_count),
        "is_angle_flat":         1.0 if dominant_range <= 5.0 else 0.0,
    }


# ---------------------------------------------------------------------------
# Dataset builder
# ---------------------------------------------------------------------------
def build_dataset() -> pd.DataFrame:
    labels = pd.read_csv(LABELS_FILE)
    rows = []

    for _, row in labels.iterrows():
        path = RECORDINGS_DIR / row["filename"]
        if not path.exists():
            print(f"  WARNING: {path.name} not found — skipping")
            continue
        with open(path) as f:
            data = json.load(f)
        try:
            feats = extract_features(data["samples"])

            # One-hot encode categorical metadata.
            # Falls back to "unknown" when the column is missing or blank.
            mg = str(row.get("muscle_group", "unknown") or "unknown").strip().lower()
            et = str(row.get("exercise_type", "unknown") or "unknown").strip().lower()
            if mg not in MUSCLE_GROUPS:
                mg = "unknown"
            if et not in EXERCISE_TYPES:
                et = "unknown"
            for g in MUSCLE_GROUPS:
                feats[f"muscle_{g}"] = 1.0 if mg == g else 0.0
            for t in EXERCISE_TYPES:
                feats[f"type_{t}"] = 1.0 if et == t else 0.0

            feats["filename"]  = row["filename"]
            feats["rep_count"] = int(row["rep_count"])
            rows.append(feats)
        except Exception as e:
            print(f"  ERROR {row['filename']}: {e}")

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------
def loocv(df: pd.DataFrame, model_cls, **kwargs) -> tuple[list, list]:
    """Leave-one-out cross-validation. Returns (predictions, actuals)."""
    X = df[FEATURE_COLS].values
    y = df["rep_count"].values
    preds, actuals = [], []

    for train_idx, test_idx in LeaveOneOut().split(X):
        m = model_cls(**kwargs)
        m.fit(X[train_idx], y[train_idx])
        preds.append(round(float(m.predict(X[test_idx])[0])))
        actuals.append(int(y[test_idx[0]]))

    return preds, actuals


def print_results(preds, actuals, filenames, label) -> float:
    col = 42
    print(f"\n{'─' * (col + 20)}")
    print(f"  {label}  —  Leave-One-Out CV")
    print(f"{'─' * (col + 20)}")
    print(f"  {'Recording':<{col}} {'True':>5} {'Pred':>5} {'Err':>5}")
    print(f"  {'─' * col} {'─'*5} {'─'*5} {'─'*5}")

    for fn, true, pred in zip(filenames, actuals, preds):
        err    = pred - true
        marker = "  !" if err != 0 else ""
        print(f"  {fn:<{col}} {true:>5} {pred:>5} {err:>+5}{marker}")

    mae   = mean_absolute_error(actuals, preds)
    exact = sum(1 for t, p in zip(actuals, preds) if t == p)
    print(f"\n  MAE:         {mae:.2f}")
    print(f"  Exact match: {exact}/{len(actuals)}  ({100 * exact / len(actuals):.0f}%)")
    return mae


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("\n── Loading dataset ────────────────────────────────────────────")
    df = build_dataset()
    print(f"  {len(df)} recordings loaded")

    if len(df) < 5:
        sys.exit("Need at least 5 recordings. Add more to recordings/ and labels.csv.")

    # ── Categorical coverage report ─────────────────────────────────────────
    n_known_mg = int((df["muscle_unknown"] == 0).sum())
    n_known_et = int((df["type_unknown"]   == 0).sum())
    print(f"  muscle_group labeled: {n_known_mg}/{len(df)}  "
          f"({'%.0f' % (100*n_known_mg/len(df))}%)")
    print(f"  exercise_type labeled: {n_known_et}/{len(df)}  "
          f"({'%.0f' % (100*n_known_et/len(df))}%)")
    if n_known_mg < len(df) * 0.7 or n_known_et < len(df) * 0.7:
        print("  NOTE: fewer than 70% of recordings have categorical labels.")
        print("        Fill in muscle_group / exercise_type in labels.csv as you")
        print("        add more recordings — the model will improve noticeably.\n")

    df.to_csv(OUTPUT_DIR / "features.csv", index=False)
    print(f"  Feature matrix saved → output/features.csv")

    filenames = df["filename"].tolist()

    # ── Compare two model families ──────────────────────────────────────────
    rf_preds, rf_actuals = loocv(
        df, RandomForestRegressor,
        n_estimators=100, max_depth=4, random_state=42,
    )
    mae_rf = print_results(rf_preds, rf_actuals, filenames, "Random Forest (depth=4)")

    gb_preds, gb_actuals = loocv(
        df, GradientBoostingRegressor,
        n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42,
    )
    mae_gb = print_results(gb_preds, gb_actuals, filenames, "Gradient Boosting (depth=3)")

    # ── Train final model on ALL data ───────────────────────────────────────
    X_all = df[FEATURE_COLS].values
    y_all = df["rep_count"].values

    use_rf   = mae_rf <= mae_gb
    best_name = "Random Forest" if use_rf else "Gradient Boosting"
    print(f"\n── Best model: {best_name} (LOOCV MAE = {min(mae_rf, mae_gb):.2f}) ─────")

    if use_rf:
        final = RandomForestRegressor(n_estimators=100, max_depth=4, random_state=42)
    else:
        final = GradientBoostingRegressor(
            n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42
        )
    final.fit(X_all, y_all)

    # ── Feature importances ─────────────────────────────────────────────────
    print("\n── Feature importances ────────────────────────────────────────")
    ranked = sorted(zip(FEATURE_COLS, final.feature_importances_), key=lambda x: -x[1])
    for feat, imp in ranked:
        bar = "█" * int(imp * 50)
        print(f"  {feat:<30} {imp:.3f}  {bar}")

    # ── Save Python model (used by predict.py) ──────────────────────────────
    pkl_path = OUTPUT_DIR / "model.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump({"model": final, "feature_cols": FEATURE_COLS}, f)
    print(f"\n── Saved → output/model.pkl")

    # ── Export to JavaScript (for future app integration) ───────────────────
    raw_js = m2c.export_to_javascript(final, function_name="predictRepCount")

    # Minify: strip indentation + blank lines, collapse to a single line.
    # The output is treated like a binary — not meant to be edited by hand.
    minified = " ".join(line.strip() for line in raw_js.splitlines() if line.strip())

    feature_list = ", ".join(FEATURE_COLS)
    js_path = OUTPUT_DIR / "model.js"
    js_path.write_text(
        "// @ts-nocheck\n"
        "/* eslint-disable */\n"
        f"/* auto-generated by train.py — do not edit. input order: {feature_list} */\n"
        + minified
        + "\nexport{predictRepCount};\n"
    )
    print(f"── Saved → output/model.js")

    # ── Summary report ──────────────────────────────────────────────────────
    best_mae   = min(mae_rf, mae_gb)
    best_preds = rf_preds if use_rf else gb_preds
    exact      = sum(1 for t, p in zip(rf_actuals if use_rf else gb_actuals, best_preds) if t == p)

    summary = [
        "Training summary",
        "=" * 40,
        f"Recordings:   {len(df)}",
        f"Best model:   {best_name}",
        f"LOOCV MAE:    {best_mae:.2f}",
        f"Exact match:  {exact}/{len(df)} ({100*exact/len(df):.0f}%)",
        "",
        "Feature order for inference (input array index → name):",
        *[f"  {i:>2}: {name}" for i, name in enumerate(FEATURE_COLS)],
    ]
    (OUTPUT_DIR / "summary.txt").write_text("\n".join(summary))
    print(f"── Saved → output/summary.txt\n")


if __name__ == "__main__":
    main()
